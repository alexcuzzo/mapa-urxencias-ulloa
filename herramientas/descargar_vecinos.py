# -*- coding: utf-8 -*-
"""Descarga los datos de los concellos vecinos (ext=1 en munis.json):
OSM places, límites, ZIP INSPIRE Addresses del Catastro y callejero OVC.
Uso: descargar_vecinos.py <munis.json> <dir_raw>
"""
import io
import json
import sys
import time
import urllib.parse
import urllib.request
import zipfile

CONF = json.load(io.open(sys.argv[1], encoding="utf-8"))
RAW = sys.argv[2]
VECINOS = [m for m in CONF if m["ext"] == 1]
OVERPASS = "https://overpass-api.de/api/interpreter"
PLACES = "town|village|hamlet|isolated_dwelling|locality"


def pedir(url, data=None, intentos=5, espera_base=15):
    for i in range(1, intentos + 1):
        try:
            req = urllib.request.Request(url, data=data, headers={
                "User-Agent": "mapa-urxencias-ulloa/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:
            print(f"  reintento {i}: {type(e).__name__} {e}", flush=True)
            time.sleep(espera_base * i)
    raise SystemExit(f"FALLO definitivo: {url}")


def overpass(consulta, destino):
    body = urllib.parse.urlencode({"data": consulta}).encode()
    for i in range(1, 6):
        raw = pedir(OVERPASS, data=body)
        try:
            parsed = json.loads(raw)
            with open(f"{RAW}/{destino}", "wb") as f:
                f.write(raw)
            print(f"OK {destino}: {len(parsed.get('elements', []))} elementos", flush=True)
            return
        except ValueError:
            print(f"  overpass saturado ({destino}), intento {i}", flush=True)
            time.sleep(20 * i)
    raise SystemExit(f"FALLO overpass: {destino}")


# 1. límites de los 9 (una consulta)
rels = ",".join(str(m["rel"]) for m in VECINOS)
overpass(f"[out:json][timeout:120];relation(id:{rels});out geom;", "boundaries-vecinos.json")
time.sleep(10)

# 2. places por concello
for m in VECINOS:
    destino = f"places-{m['ine']}.json"
    q = (f"[out:json][timeout:120];area(id:{3600000000 + m['rel']})->.a;"
         f'node["place"~"^({PLACES})$"](area.a);out body;')
    overpass(q, destino)
    time.sleep(10)

# 3. Catastro AD zip + callejero OVC
for m in VECINOS:
    url = (f"https://www.catastro.hacienda.gob.es/INSPIRE/Addresses/{m['prov']}/"
           f"{m['cat']}-{urllib.parse.quote(m['catNombre'])}/A.ES.SDGC.AD.{m['cat']}.zip")
    raw = pedir(url)
    zpath = f"{RAW}/AD-{m['ine']}.zip"
    with open(zpath, "wb") as f:
        f.write(raw)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(f"{RAW}/AD-{m['ine']}")
    print(f"OK AD {m['ine']} ({m['catNombre']})", flush=True)

    ok = False
    for prov in (m["provNombre"], m["provNombre"].replace("A CORUÑA", "CORUÑA, A")):
        curl = ("https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/"
                "ConsultaVia?" + urllib.parse.urlencode({
                    "Provincia": prov, "Municipio": m["catNombre"],
                    "TipoVia": "", "NombreVia": ""}))
        raw = pedir(curl)
        if b"<calle>" in raw:
            with open(f"{RAW}/callejero-{m['ine']}.xml", "wb") as f:
                f.write(raw)
            print(f"OK callejero {m['ine']}: {raw.count(b'<calle>')} vías", flush=True)
            ok = True
            break
        print(f"  callejero {m['ine']} sin vías con Provincia={prov!r}: {raw[:120]!r}", flush=True)
    if not ok:
        raise SystemExit(f"FALLO callejero {m['ine']}")

print("VECINOS DESCARGADOS", flush=True)
