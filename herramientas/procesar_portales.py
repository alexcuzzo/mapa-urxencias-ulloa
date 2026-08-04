# -*- coding: utf-8 -*-
"""Procesa los GML INSPIRE Addresses del Catastro (EPSG:25829) y el callejero
OVC para generar data/portales-XXXXX.js en WGS84.

Cada portal: numero, código de vía, nombre de vía (lugar), CP.
Los "S-N" (sin número) se excluyen de la capa pero se contabilizan.
También emite portales-resumen.json (por vía: CP mayoritario, conteos,
centroide) para derivar el CP de cada aldea y para la QA del casado.
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from xml.etree import ElementTree as ET

from pyproj import Transformer

RAW = sys.argv[1]
OUT = sys.argv[2]  # carpeta data/ del proyecto
# munis.json: lista de concellos (ine, cat=código catastral, ...)
CONF = json.load(open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else [
    {"ine": m, "cat": m} for m in ("27003", "27032", "27040")]
CAT_DE = {m["ine"]: m["cat"] for m in CONF}
MUNIS = [m["ine"] for m in CONF]

NS = {
    "gml": "http://www.opengis.net/gml/3.2",
    "AD": "urn:x-inspire:specification:gmlas:Addresses:3.0",
    "xlink": "http://www.w3.org/1999/xlink",
}
TR = Transformer.from_crs("EPSG:25829", "EPSG:4326", always_xy=True)


def cargar_callejero(muni):
    """cv -> (tv, nv) desde el XML del OVC."""
    tree = ET.parse(f"{RAW}/callejero-{muni}.xml")
    ns = {"c": "http://www.catastro.meh.es/"}
    vias = {}
    for calle in tree.getroot().iter("{http://www.catastro.meh.es/}calle"):
        dir_ = calle.find("c:dir", ns)
        cv = dir_.find("c:cv", ns).text.strip()
        tv = (dir_.find("c:tv", ns).text or "").strip()
        nv = (dir_.find("c:nv", ns).text or "").strip()
        vias[cv] = (tv, nv)
    return vias


def procesar(muni):
    vias = cargar_callejero(muni)
    gml = f"{RAW}/AD-{muni}/A.ES.SDGC.AD.{CAT_DE[muni]}.gml"
    feats, xs, ys = [], [], []
    sn = 0
    resumen = defaultdict(lambda: {"cps": Counter(), "n_portales": 0, "sum_x": 0.0, "sum_y": 0.0})
    vistos = set()

    for _, addr in ET.iterparse(gml, events=("end",)):
        if addr.tag != f"{{{NS['AD']}}}Address":
            continue
        pos = addr.find(".//gml:pos", NS)
        desig = addr.find(".//AD:LocatorDesignator/AD:designator", NS)
        cv = cp = None
        for comp in addr.findall("AD:component", NS):
            href = comp.get(f"{{{NS['xlink']}}}href") or ""
            m = re.match(r"#ES\.SDGC\.TN\.\d+\.\d+\.(\d+)$", href)
            if m:
                cv = m.group(1)
            m = re.match(r"#ES\.SDGC\.PD\.\d+\.\d+\.(\d+)$", href)
            if m:
                cp = m.group(1)
        num = (desig.text or "").strip() if desig is not None else ""
        if pos is None or cv is None:
            addr.clear()
            continue
        x, y = (float(v) for v in pos.text.split())
        tv, nv = vias.get(cv, ("", f"VIA {cv}"))
        r = resumen[cv]
        r["cps"][cp or ""] += 1
        r["sum_x"] += x
        r["sum_y"] += y
        r["n_portales"] += 1
        if not num or num.upper() in ("S-N", "SN", "S/N"):
            sn += 1
        else:
            clave = (cv, num.upper(), round(x), round(y))
            if clave not in vistos:
                vistos.add(clave)
                feats.append({"n": num, "cv": cv, "tv": tv, "via": nv, "cp": cp or ""})
                xs.append(x)
                ys.append(y)
        addr.clear()

    lons, lats = TR.transform(xs, ys)
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature",
         "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
         "properties": p}
        for p, lon, lat in zip(feats, lons, lats)
    ]}
    with open(f"{OUT}/portales-{muni}.js", "w", encoding="utf-8") as f:
        f.write(f"window.PORTALES_{muni} = ")
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    res_out = {}
    for cv, r in resumen.items():
        tv, nv = vias.get(cv, ("", f"VIA {cv}"))
        cx = r["sum_x"] / r["n_portales"]
        cy = r["sum_y"] / r["n_portales"]
        lon, lat = TR.transform(cx, cy)
        res_out[cv] = {
            "tv": tv, "nv": nv,
            "cp": r["cps"].most_common(1)[0][0],
            "n_portales": r["n_portales"],
            "lon": round(lon, 6), "lat": round(lat, 6),
        }
    print(f"{muni}: {len(fc['features'])} portales numerados, {sn} S-N, "
          f"{len(res_out)} vías ({sum(1 for v in res_out.values() if v['tv'] == 'LG')} LG)")
    return res_out


os.makedirs(OUT, exist_ok=True)
todo = {muni: procesar(muni) for muni in MUNIS}
with open(f"{RAW}/portales-resumen.json", "w", encoding="utf-8") as f:
    json.dump(todo, f, ensure_ascii=False, indent=1)
print("portales-resumen.json escrito")
