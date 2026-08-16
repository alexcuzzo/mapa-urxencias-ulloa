# -*- coding: utf-8 -*-
"""Genera data/entidades.js y data/limites.js.

Casado en tres fuentes:
  - CSV Nomenclátor de Galicia (Xunta): lista OFICIAL de lugares + parroquia.
  - OSM (Overpass): coordenadas de núcleos (place=*).
  - Callejero Catastro (vías LG "LUGAR - PARROQUIA" con centroide de portales):
    desambiguación, CP y coordenada de respaldo.

Prioridad de coordenada: nodo OSM (único o el más próximo al centroide
Catastro) > centroide de portales Catastro. Nunca se inventan coordenadas:
lo no casado va al informe de huecos.
"""
import csv
import io
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict

RAW = sys.argv[1]
OUT = sys.argv[2]

# munis.json: ine, csv (nombre en CSV Xunta), provNombre, nombre, rel, ext
CONF = json.load(io.open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else [
    {"ine": "27003", "csv": "ANTAS DE ULLA", "provNombre": "LUGO", "nombre": "Antas de Ulla", "rel": 340149, "ext": 0},
    {"ine": "27032", "csv": "MONTERROSO", "provNombre": "LUGO", "nombre": "Monterroso", "rel": 344818, "ext": 0},
    {"ine": "27040", "csv": "PALAS DE REI", "provNombre": "LUGO", "nombre": "Palas de Rei", "rel": 340770, "ext": 0},
]
POR_CSV = {(m["provNombre"], m["csv"]): m for m in CONF}
MUNIS = {m["ine"]: m for m in CONF}
DISPLAY = {m["ine"]: m["nombre"] for m in CONF}
EXT = {m["ine"]: m.get("ext", 0) for m in CONF}
REL_IDS = {m["rel"]: m["ine"] for m in CONF}
NUCLEOS = ("city", "town", "village", "hamlet", "isolated_dwelling",
           "suburb", "quarter", "neighbourhood")


def quitar_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if not unicodedata.combining(c))


def norm(s):
    """Clave de comparación tolerante entre Xunta/OSM/Catastro (solo matching)."""
    s = quitar_acentos(s).lower().strip()
    s = re.sub(r",\s*(a|o|as|os)$", "", s)      # "pazo, o" -> "pazo"
    s = re.sub(r"^(a|o|as|os)\s+", "", s)        # "o pazo" -> "pazo"
    s = re.sub(r"\(.*?\)", " ", s)               # advocaciones entre paréntesis
    s = s.replace("-", " ").replace("'", " ")
    s = re.sub(r"[^a-z0-9ñ ]", " ", s)
    s = s.replace("v", "b")                       # b/v inestable entre fuentes
    s = re.sub(r"\s+", " ", s).strip()
    return s


def display(s):
    """"Ermida de Érmora, A" -> "A Ermida de Érmora"."""
    m = re.match(r"^(.*),\s*(A|O|As|Os)$", s.strip())
    return f"{m.group(2)} {m.group(1)}" if m else s.strip()


def dist(lat1, lon1, lat2, lon2):
    return math.hypot((lat1 - lat2) * 111.0,
                      (lon1 - lon2) * 111.0 * math.cos(math.radians(lat1)))


# ---------- 1. CSV Xunta ----------
entidades = []
with io.open(f"{RAW}/nomenclator-galicia.csv", encoding="utf-8-sig") as f:
    for r in csv.reader(f, delimiter=";"):
        if len(r) < 9:
            continue
        m = POR_CSV.get((r[0].strip().upper(), r[2].strip()))
        if m:
            entidades.append({
                "muni": m["ine"],
                "lugar": display(r[8]), "nl": norm(r[8]),
                "parr": display(r[4]), "np": norm(r[4]),
                "adv": r[6].strip(),
            })

# ---------- 2. OSM ----------
osm = defaultdict(list)          # muni -> nodos núcleo
osm_loc = defaultdict(list)      # muni -> localities
for muni in MUNIS:
    archivos = [f"places-{muni}.json"]
    if muni == "27040":
        archivos.append("places-town-27040.json")  # el town de Palas se bajó aparte
    for a in archivos:
        with io.open(f"{RAW}/{a}", encoding="utf-8") as f:
            for e in json.load(f)["elements"]:
                t = e.get("tags", {})
                nombre = t.get("name")
                if not nombre:
                    continue
                # claves de casado: name + official_name + alt_name (OSM a veces
                # guarda el nombre del nomenclátor solo en official_name)
                claves = {norm(t[k]) for k in ("name", "official_name", "alt_name")
                          if t.get(k)}
                nodo = {"id": e["id"], "name": nombre, "place": t.get("place"),
                        "lat": e["lat"], "lon": e["lon"], "nl": norm(nombre),
                        "nls": claves,
                        "ofic": {norm(t["official_name"])} if t.get("official_name") else set()}
                (osm[muni] if nodo["place"] in NUCLEOS else osm_loc[muni]).append(nodo)

# ---------- 3. Vías Catastro (resumen de portales) ----------
with io.open(f"{RAW}/portales-resumen.json", encoding="utf-8") as f:
    resumen = json.load(f)
cat = defaultdict(list)  # muni -> [{nl, np, cp, lon, lat, cv, n_portales}]
for muni, vias in resumen.items():
    for cv, v in vias.items():
        if v["tv"] != "LG":
            continue
        partes = v["nv"].rsplit("-", 1)
        lug = partes[0].strip()
        par = partes[1].strip() if len(partes) > 1 else ""
        par = re.sub(r"^PQ\s+", "", par)  # Palas usa "LUGAR - PQ PARROQUIA"
        cat[muni].append({"nl": norm(lug), "np": norm(par), "cp": v["cp"],
                          "lon": v["lon"], "lat": v["lat"], "cv": cv,
                          "n_portales": v["n_portales"]})


def parr_casa(via_np, ent_np):
    """Compara parroquias tolerando truncados y advocaciones del Catastro."""
    if not via_np or not ent_np:
        return False
    vt = [t for t in via_np.split() if len(t) > 2]
    et = [t for t in ent_np.split() if len(t) > 2]
    if not vt or not et:
        return False
    return any(any(e.startswith(t) or t.startswith(e) for e in et) for t in vt)


def buscar_via(muni, nl, np_, estricto=False):
    """Vía Catastro para (lugar, parroquia); tolera truncados con prefijos.

    Con estricto=True (nombres duplicados) una vía de OTRA parroquia no vale.
    """
    cands = [v for v in cat[muni]
             if v["nl"] == nl or (len(v["nl"]) >= 6 and nl.startswith(v["nl"]))
             or (len(nl) >= 6 and v["nl"].startswith(nl))]
    if not cands:
        return None
    con_parr = [v for v in cands if parr_casa(v["np"], np_)]
    if con_parr:
        return con_parr[0]
    sin_parr = [v for v in cands if not v["np"]]
    if len(cands) == 1:
        v = cands[0]
        if estricto and v["np"] and not parr_casa(v["np"], np_):
            return None
        return v
    return sin_parr[0] if len(sin_parr) == 1 else None


# ---------- 4. Casado ----------
feats, huecos, ambiguos, fuzzy_usados = [], [], [], []
usados_osm = defaultdict(set)
conteo_nombre = defaultdict(int)
for e in entidades:
    conteo_nombre[e["nl"]] += 1

import difflib
import os

# huecos resueltos por QA con fuente: [{ine, lugar, parroquia, lon, lat, fuente}]
MANUALES = {}
_ruta_man = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "coordenadas-manuales.json")
if os.path.exists(_ruta_man):
    for _m in json.load(io.open(_ruta_man, encoding="utf-8")):
        MANUALES[(_m["ine"], norm(_m["lugar"]), norm(_m["parroquia"]))] = _m
    print(f"coordenadas manuales cargadas: {len(MANUALES)}")


def variantes(nombre):
    """"Pena do Boi Louro ou A Pena Loura" -> ambas; añade clave sin espacios."""
    alts = [norm(v) for v in re.split(r"\s+ou\s+", nombre, flags=re.I)]
    return [a for a in alts if a] or [norm(nombre)]


for e in entidades:
    muni = e["muni"]
    nls = variantes(e["lugar"])
    estricto = conteo_nombre[e["nl"]] > 1
    via = next((v for nl in nls if (v := buscar_via(muni, nl, e["np"], estricto))), None)
    compactas = [nl.replace(" ", "") for nl in nls]
    # "Tarrío" (Novelúa) puede figurar en OSM como "Tarrío de Novelúa"
    nl_comp = norm(e["lugar"] + " de " + e["parr"]) if e["parr"] else None

    def casa(n):
        # un nodo con official_name reservado para otra entidad no vale aquí
        if n["ofic"] and not (n["ofic"] & set(nls)):
            return False
        return any(k in nls or k.replace(" ", "") in compactas for k in n["nls"])

    cands = ([n for n in osm[muni] if nl_comp and nl_comp in n["nls"]]
             or [n for n in osm[muni] if casa(n)])
    fonte = "osm"
    if not cands:
        cands = ([n for n in osm_loc[muni] if nl_comp and nl_comp in n["nls"]]
                 or [n for n in osm_loc[muni] if casa(n)])
        fonte = "osm-loc" if cands else fonte
    if not cands:
        # fuzzy de último recurso contra OSM (revisado por QA)
        claves = {n["nl"] for n in osm[muni] + osm_loc[muni]}
        prox = difflib.get_close_matches(e["nl"], claves, n=1, cutoff=0.88)
        if prox:
            cands = [n for n in osm[muni] + osm_loc[muni] if n["nl"] == prox[0]]
            fonte = "osm-fuzzy"
            fuzzy_usados.append({**e, "osm": prox[0]})

    lat = lon = None
    if not cands and not via:
        # coordenadas verificadas a mano (QA): herramientas/coordenadas-manuales.json
        man = MANUALES.get((muni, e["nl"], e["np"]))
        if man:
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point",
                             "coordinates": [round(man["lon"], 6), round(man["lat"], 6)]},
                "properties": {"n": e["lugar"], "p": e["parr"], "adv": e["adv"],
                               "c": DISPLAY[muni], "m": muni, "cp": "", "cv": "",
                               "np": 0, "dup": 1 if conteo_nombre[e["nl"]] > 1 else 0,
                               "f": "manual", "ext": EXT[muni]},
            })
            continue
    if cands:
        if len(cands) > 1 and via:
            cands.sort(key=lambda n: dist(n["lat"], n["lon"], via["lat"], via["lon"]))
        elif len(cands) > 1:
            ambiguos.append({**e, "n_osm": len(cands)})
        # homónimos (dos Nugallás): no reutilizar un nodo ya asignado si hay otro libre
        nodo = next((n for n in cands if n["id"] not in usados_osm[muni]), cands[0])
        lat, lon = nodo["lat"], nodo["lon"]
        usados_osm[muni].add(nodo["id"])
    elif via:
        lat, lon = via["lat"], via["lon"]
        fonte = "catastro"
    else:
        huecos.append(e)
        continue

    feats.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
        "properties": {
            "n": e["lugar"], "p": e["parr"], "adv": e["adv"],
            "c": DISPLAY[muni], "m": muni,
            "cp": via["cp"] if via else "",
            "cv": via["cv"] if via else "",
            "np": via["n_portales"] if via else 0,
            "dup": 1 if conteo_nombre[e["nl"]] > 1 else 0,
            "f": fonte,
            "ext": EXT[muni],
        },
    })

# OSM núcleos no usados -> entrada extraoficial (útil si el aviso usa ese nombre)
extras = 0
oficiales_nl = {(e["muni"], e["nl"]) for e in entidades}
for muni in MUNIS:
    for n in osm[muni]:
        if n["id"] in usados_osm[muni] or (muni, n["nl"]) in oficiales_nl:
            continue
        via = buscar_via(muni, n["nl"], "")
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(n["lon"], 6), round(n["lat"], 6)]},
            "properties": {"n": n["name"], "p": "", "adv": "", "c": DISPLAY[muni],
                           "m": muni, "cp": via["cp"] if via else "",
                           "cv": via["cv"] if via else "",
                           "np": via["n_portales"] if via else 0,
                           "dup": 0, "f": "osm-extra", "ext": EXT[muni]},
        })
        extras += 1

# Homónimos que comparten un único nodo OSM: el que tenga vía Catastro propia
# a >250 m del nodo se reubica en el centroide de sus portales.
grupos = defaultdict(list)
for i, ft in enumerate(feats):
    if ft["properties"]["f"] in ("osm", "osm-fuzzy", "osm-loc"):
        grupos[tuple(ft["geometry"]["coordinates"])].append(i)
via_por_cv = {(m, v["cv"]): v for m in cat for v in cat[m]}
reubicados = 0
for coords, idxs in grupos.items():
    if len(idxs) < 2:
        continue
    lon0, lat0 = coords
    medidos = []
    for i in idxs:
        p = feats[i]["properties"]
        v = via_por_cv.get((p["m"], p["cv"])) if p["cv"] else None
        medidos.append((i, v, dist(lat0, lon0, v["lat"], v["lon"]) if v else None))
    lejanos = [x for x in medidos if x[2] is not None and x[2] > 0.25]
    # al menos un miembro debe conservar el nodo
    if len(lejanos) == len(medidos):
        lejanos.sort(key=lambda x: -x[2])
        lejanos = lejanos[:-1]
    for i, v, d in lejanos:
        feats[i]["geometry"]["coordinates"] = [v["lon"], v["lat"]]
        feats[i]["properties"]["f"] = "catastro"
        reubicados += 1
print(f"homónimos reubicados a su vía Catastro: {reubicados}")

# Correcciones puntuales verificadas (QA 08/2026 contra bases postales)
MANUAL_CP = {("27003", "fonfria", "cutian"): "27577"}
for ft in feats:
    p = ft["properties"]
    clave = (p["m"], norm(p["n"]), norm(p["p"]))
    if clave in MANUAL_CP:
        p["cp"] = MANUAL_CP[clave]

# CP ausente: rellenar con el mayoritario de su parroquia (marcado aproximado)
from collections import Counter
cp_parr = defaultdict(Counter)
for ft in feats:
    p = ft["properties"]
    if p["cp"] and p["p"]:
        cp_parr[(p["m"], p["p"])][p["cp"]] += 1
rellenados = 0
for ft in feats:
    p = ft["properties"]
    if not p["cp"] and p["p"] and cp_parr[(p["m"], p["p"])]:
        p["cp"] = cp_parr[(p["m"], p["p"])].most_common(1)[0][0]
        p["cpx"] = 1
        rellenados += 1
print(f"CP rellenados por mayoría de parroquia: {rellenados}")

fc = {"type": "FeatureCollection", "features": feats}
with io.open(f"{OUT}/entidades.js", "w", encoding="utf-8") as f:
    f.write("window.ENTIDADES = ")
    json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

# ---------- 5. Límites ----------
rels = []
for archivo in ("boundaries.json", "boundaries-vecinos.json"):
    try:
        with io.open(f"{RAW}/{archivo}", encoding="utf-8") as f:
            rels += json.load(f)["elements"]
    except FileNotFoundError:
        pass
lfeats = []
for rel in rels:
    if rel["id"] not in REL_IDS:
        continue
    muni = REL_IDS[rel["id"]]
    lineas = [[[round(p["lon"], 5), round(p["lat"], 5)] for p in m["geometry"]]
              for m in rel["members"]
              if m["type"] == "way" and m["role"] == "outer" and m.get("geometry")]
    lfeats.append({"type": "Feature",
                   "geometry": {"type": "MultiLineString", "coordinates": lineas},
                   "properties": {"m": muni, "n": DISPLAY[muni], "ext": EXT[muni]}})
with io.open(f"{OUT}/limites.js", "w", encoding="utf-8") as f:
    f.write("window.LIMITES = ")
    json.dump({"type": "FeatureCollection", "features": lfeats}, f,
              ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

# ---------- 6. Informe ----------
por_fonte = defaultdict(int)
for ft in feats:
    por_fonte[ft["properties"]["f"]] += 1
informe = {
    "total_oficiales": len(entidades),
    "casadas": len(entidades) - len(huecos),
    "por_fonte": dict(por_fonte),
    "extras_osm": extras,
    "huecos": huecos,
    "ambiguos_sin_catastro": ambiguos,
    "fuzzy_usados": fuzzy_usados,
}
with io.open(f"{RAW}/informe-casado.json", "w", encoding="utf-8") as f:
    json.dump(informe, f, ensure_ascii=False, indent=1)
print(f"oficiales={len(entidades)} casadas={informe['casadas']} "
      f"huecos={len(huecos)} fuentes={dict(por_fonte)} extras_osm={extras}")
for h in huecos:
    print("  HUECO:", h["muni"], h["lugar"], "/", h["parr"])
