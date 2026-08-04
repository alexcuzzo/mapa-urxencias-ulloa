# -*- coding: utf-8 -*-
"""Descarga datos OSM (Overpass) para el mapa de urgencias da Ulloa.

Consultas espaciadas con reintentos: Overpass devuelve HTML de error
cuando está saturado, nunca JSON parcial.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

RAW = sys.argv[1]  # carpeta de salida
ENDPOINT = "https://overpass-api.de/api/interpreter"

# Áreas: id de relación OSM + 3600000000 (verificadas por ine:municipio)
A_ANTAS = 3600340149      # 27003
A_MONTERROSO = 3600344818  # 27032
A_PALAS = 3600340770      # 27040

PLACES = "town|village|hamlet|isolated_dwelling|locality"

QUERIES = {
    "places-27032.json": f'[out:json][timeout:120];area(id:{A_MONTERROSO})->.a;node["place"~"^({PLACES})$"](area.a);out body;',
    "places-27003.json": f'[out:json][timeout:120];area(id:{A_ANTAS})->.a;node["place"~"^({PLACES})$"](area.a);out body;',
    "places-town-27040.json": f'[out:json][timeout:120];area(id:{A_PALAS})->.a;node["place"~"^(town|village)$"](area.a);out body;',
    "boundaries.json": "[out:json][timeout:120];relation(id:340149,340770,344818);out geom;",
    "sanidad-osm.json": (
        f'[out:json][timeout:120];'
        f'area(id:{A_ANTAS},{A_MONTERROSO},{A_PALAS})->.a;'
        f'area["ine:municipio"="27028"]->.lugo;'
        f'(nwr["amenity"~"^(clinic|doctors|hospital)$"](area.a);'
        f'nwr["amenity"="hospital"](area.lugo););'
        f'out center;'
    ),
}


def fetch(name, query):
    data = urllib.parse.urlencode({"data": query}).encode()
    for intento in range(1, 6):
        try:
            req = urllib.request.Request(ENDPOINT, data=data, headers={
                "User-Agent": "mapa-urxencias-ulloa/1.0 (uso puntual, contacto via OSM)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                body = r.read()
            parsed = json.loads(body)  # valida que no sea HTML de error
            with open(f"{RAW}/{name}", "wb") as f:
                f.write(body)
            print(f"OK {name}: {len(parsed.get('elements', []))} elementos", flush=True)
            return
        except Exception as e:  # HTML de error, timeout o HTTP 429/504
            espera = 15 * intento
            print(f"reintento {intento} {name}: {type(e).__name__} {e}; espero {espera}s", flush=True)
            time.sleep(espera)
    raise SystemExit(f"FALLO definitivo en {name}")


for i, (name, query) in enumerate(QUERIES.items()):
    if i:
        time.sleep(10)  # espaciar para no saturar Overpass
    fetch(name, query)
print("TODO DESCARGADO", flush=True)
