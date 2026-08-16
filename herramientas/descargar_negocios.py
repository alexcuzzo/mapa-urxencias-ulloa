# -*- coding: utf-8 -*-
"""Descarga de OSM los alojamientos y negocios de cada concello.
Uso: descargar_negocios.py <munis.json> <dir_raw>
"""
import io
import json
import sys
import time
import urllib.parse
import urllib.request

CONF = json.load(io.open(sys.argv[1], encoding="utf-8"))
RAW = sys.argv[2]
OVERPASS = "https://overpass-api.de/api/interpreter"

TOURISM = "hotel|guest_house|hostel|motel|apartment|chalet|camp_site|caravan_site"
AMENITY = ("restaurant|bar|cafe|fast_food|pub|ice_cream|pharmacy|dentist|"
           "veterinary|fuel|bank|atm|post_office|taxi|marketplace|nightclub")


def overpass(consulta, destino):
    body = urllib.parse.urlencode({"data": consulta}).encode()
    for i in range(1, 7):
        try:
            req = urllib.request.Request(OVERPASS, data=body,
                headers={"User-Agent": "mapa-urxencias-ulloa/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                raw = r.read()
            parsed = json.loads(raw)
            with open(f"{RAW}/{destino}", "wb") as f:
                f.write(raw)
            print(f"OK {destino}: {len(parsed.get('elements', []))}", flush=True)
            return
        except Exception as e:
            print(f"  reintento {i} {destino}: {type(e).__name__}", flush=True)
            time.sleep(15 * i)
    raise SystemExit(f"FALLO {destino}")


for i, m in enumerate(CONF):
    if i:
        time.sleep(8)
    q = (f"[out:json][timeout:120];area(id:{3600000000 + m['rel']})->.a;("
         f'nwr["tourism"~"^({TOURISM})$"](area.a);'
         f'nwr["amenity"~"^({AMENITY})$"](area.a);'
         f'nwr["shop"](area.a);'
         f'nwr["craft"](area.a);'
         f");out center tags;")
    overpass(q, f"negocios-{m['ine']}.json")
print("NEGOCIOS DESCARGADOS", flush=True)
