# -*- coding: utf-8 -*-
"""Genera data/aloxamentos.js con los alojamientos oficiales del REAT
(Rexistro de Empresas e Actividades Turísticas da Xunta), incluidas las
vivendas de uso turístico (los "pisos").

Uso: procesar_reat.py <munis.json> <dir_raw> <dir_data>
El CSV se descarga de:
https://descargascdn.xunta.gal/interno/smarxa/reat_directorio-alojamientos_esp.csv
"""
import csv
import io
import json
import sys
import unicodedata
from collections import Counter, defaultdict

CONF = json.load(io.open(sys.argv[1], encoding="utf-8"))
RAW = sys.argv[2]
OUT = sys.argv[3]

MINUS = {"de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "en",
         "con", "para", "por", "del", "la", "las", "los", "y", "al"}
# tipo del REAT -> (grupo en la app, etiqueta)
TIPOS = {
    "VIVIENDAS USO TURÍSTICO": ("vut", "Vivenda de uso turístico"),
    "VIVIENDAS TURÍSTICAS": ("vut", "Vivenda turística"),
    "APARTAMENTOS": ("vut", "Apartamento turístico"),
    "HOTELES": ("aloxa", "Hotel"),
    "PENSIONES": ("aloxa", "Pensión"),
    "ALBERGUES TURÍSTICOS": ("aloxa", "Albergue"),
    "TURISMO RURAL": ("aloxa", "Turismo rural"),
    "CAMPINGS": ("aloxa", "Camping"),
}


def sa(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if not unicodedata.combining(c)).upper().strip()


def bonito(s):
    """'ALBERGUE DO BARREIRO' -> 'Albergue do Barreiro'."""
    palabras = (s or "").strip().lower().split()
    salida = []
    for i, p in enumerate(palabras):
        if i and p in MINUS:
            salida.append(p)
        elif len(p) <= 2 and p.isalpha() and p not in MINUS:
            salida.append(p.upper())          # siglas cortas
        else:
            salida.append(p[:1].upper() + p[1:])
    return " ".join(salida)


ALIAS = {}
for m in CONF:
    for v in (m["nombre"], m["csv"], m["catNombre"]):
        ALIAS[sa(v)] = m
    n = sa(m["nombre"])
    if n.startswith(("O ", "A ")):
        art, resto = n.split(" ", 1)
        ALIAS[resto + ", " + art] = m

# bbox por concello a partir de las entidades ya generadas (control de calidad)
fc_ent = json.loads(io.open(f"{OUT}/entidades.js", encoding="utf-8")
                    .read().split("=", 1)[1].rstrip().rstrip(";"))
bbox = defaultdict(lambda: [180, 90, -180, -90])
for f in fc_ent["features"]:
    ine = f["properties"]["m"]
    lon, lat = f["geometry"]["coordinates"]
    b = bbox[ine]
    b[0] = min(b[0], lon); b[1] = min(b[1], lat)
    b[2] = max(b[2], lon); b[3] = max(b[3], lat)

# ---------- geocodificación de las que no traen coordenadas ----------
# (las vivendas de uso turístico casi nunca las traen, pero sí la dirección
#  completa: se casa contra el callejero del Catastro que ya tenemos)
TIPOS_VIA = ("CALLE", "RUA", "RÚA", "AVENIDA", "AVDA", "AV", "LUGAR", "LG",
             "TRAVESIA", "TRAVESÍA", "PLAZA", "PRAZA", "CAMINO", "CAMIÑO",
             "CARRETERA", "ESTRADA", "RONDA", "PASEO", "POLIGONO", "POLÍGONO",
             "URBANIZACION", "URBANIZACIÓN", "BARRIO", "CALLEJON", "GLORIETA",
             "COSTA", "SUBIDA", "BAJADA", "PRACTICABLE", "CARRIL")
ARTICULOS = {"DO", "DA", "DE", "DEL", "LA", "EL", "LOS", "LAS", "DOS", "DAS",
             "O", "A", "OS", "AS", "SAN", "SANTA"}


def clave_via(s):
    """'CALLE DO RIO' y 'RIO (DO)' -> 'RIO' (comparables)."""
    t = sa(s).replace("(", " ").replace(")", " ").replace(",", " ")
    t = t.replace("-", " ").replace(".", " ")
    palabras = [p for p in t.split() if p]
    while palabras and palabras[0] in TIPOS_VIA:
        palabras.pop(0)
    palabras = [p for p in palabras if p not in ARTICULOS or len(palabras) == 1]
    return " ".join(palabras).strip()


def cargar_portales(ine):
    ruta = f"{OUT}/portales-{ine}.js"
    try:
        txt = io.open(ruta, encoding="utf-8").read()
    except FileNotFoundError:
        return None
    return json.loads(txt.split("=", 1)[1].rstrip().rstrip(";"))


CALLEJERO = {}   # ine -> {clave_via: {"nums": {num: [lon,lat]}, "sx","sy","n"}}
for m in CONF:
    fcp = cargar_portales(m["ine"])
    if not fcp:
        continue
    vias = defaultdict(lambda: {"nums": {}, "sx": 0.0, "sy": 0.0, "n": 0})
    for f_ in fcp["features"]:
        p = f_["properties"]
        k = clave_via(p.get("via", ""))
        if not k:
            continue
        v = vias[k]
        co = f_["geometry"]["coordinates"]
        v["sx"] += co[0]; v["sy"] += co[1]; v["n"] += 1
        num = sa(p.get("n", "")).replace(" ", "")
        if num and num not in v["nums"]:
            v["nums"][num] = co
    CALLEJERO[m["ine"]] = vias

# también las aldeas, para direcciones tipo "LUGAR A PALLOTA, S/N"
ALDEAS = defaultdict(dict)
for f_ in fc_ent["features"]:
    p = f_["properties"]
    ALDEAS[p["m"]].setdefault(clave_via(p["n"]), f_["geometry"]["coordinates"])


def geocodificar(ine, direccion, lugar):
    """Devuelve (lon, lat, aprox) o None."""
    texto = (direccion or "").strip() or (lugar or "").strip()
    if not texto:
        return None
    num = None
    mnum = None
    import re as _re
    mnum = _re.search(r"N[ºO°]?\s*(\d{1,4}\s?[A-Za-z]?)", sa(texto))
    if mnum:
        num = mnum.group(1).replace(" ", "")
        texto = sa(texto)[:mnum.start()]
    else:
        texto = sa(texto).split(",")[0]
    k = clave_via(texto)
    if not k:
        return None
    vias = CALLEJERO.get(ine) or {}
    v = vias.get(k)
    if not v:                                  # prefijo (el Catastro trunca)
        cands = [kk for kk in vias if len(kk) >= 5 and (kk.startswith(k) or k.startswith(kk))]
        if len(cands) == 1:
            v = vias[cands[0]]
    if v:
        if num and num in v["nums"]:
            return v["nums"][num][0], v["nums"][num][1], 0
        if num:                                # nº sin portal en Catastro
            base = _re.sub(r"[A-Z]+$", "", num)
            if base in v["nums"]:
                return v["nums"][base][0], v["nums"][base][1], 0
        return v["sx"] / v["n"], v["sy"] / v["n"], 1
    co = ALDEAS.get(ine, {}).get(k)
    if co:
        return co[0], co[1], 1
    return None


f = io.open(f"{RAW}/reat-aloxamentos.csv", encoding="utf-8-sig", errors="replace")
for _ in range(5):
    f.readline()                              # cabecera descriptiva del fichero

feats, fuera, sincoord, geocod, geocod_apx = [], 0, 0, 0, 0
stats, grupos = Counter(), Counter()
for r in csv.DictReader(f, delimiter=";"):
    m = ALIAS.get(sa(r.get("municipio")))
    if not m:
        continue
    tipo = TIPOS.get((r.get("tipo") or "").strip())
    if not tipo:
        continue
    grupo, etiqueta = tipo
    aprox = 0
    try:
        lon = float((r.get("longitud") or "").replace(",", "."))
        lat = float((r.get("latitud") or "").replace(",", "."))
    except ValueError:
        g = geocodificar(m["ine"], r.get("direccion"), r.get("lugar"))
        if not g:
            sincoord += 1
            continue
        lon, lat, aprox = g
        geocod += 1
        geocod_apx += aprox
    b = bbox.get(m["ine"])
    if b and not (b[0] - 0.06 <= lon <= b[2] + 0.06 and b[1] - 0.06 <= lat <= b[3] + 0.06):
        fuera += 1                            # coordenada incoherente: se descarta
        continue

    esp = (r.get("especialidad") or "").strip()
    props = {
        "n": bonito(r.get("denominacion")),
        "g": grupo,
        "t": bonito(esp) if esp and grupo == "aloxa" else etiqueta,
        "m": m["ine"], "c": m["nombre"],
        "reat": (r.get("signatura") or "").strip(),
    }
    if aprox:
        props["apx"] = 1                      # posición de la vía, no del portal
    tel = (r.get("telefono") or "").strip()
    if tel:
        props["tel"] = tel
    plazas = (r.get("plazas") or "").strip()
    if plazas.isdigit() and int(plazas):
        props["pl"] = int(plazas)
    lugar = bonito(r.get("lugar"))
    direccion = (r.get("direccion") or "").strip()
    sitio = " ".join(x for x in (lugar, bonito(direccion)) if x).strip()
    if sitio:
        props["d"] = sitio
    cp = (r.get("codigo_postal") or "").strip()
    if cp:
        props["cp"] = cp
    parr = bonito(r.get("parroquia"))
    if parr:
        props["p"] = parr

    feats.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
        "properties": props,
    })
    stats[m["nombre"]] += 1
    grupos[grupo] += 1

fc = {"type": "FeatureCollection", "features": feats}
with io.open(f"{OUT}/aloxamentos.js", "w", encoding="utf-8") as g:
    g.write("window.ALOXAMENTOS = ")
    json.dump(fc, g, ensure_ascii=False, separators=(",", ":"))
    g.write(";\n")

print(f"total: {len(feats)} | por grupo: {dict(grupos)}")
print(f"geocodificados con el callejero: {geocod} ({geocod_apx} al eje de la vía)")
print(f"descartados: {fuera} fuera del concello, {sincoord} sin localizar")
print("por concello:", dict(stats))
