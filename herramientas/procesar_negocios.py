# -*- coding: utf-8 -*-
"""Genera data/negocios.js: alojamientos y negocios de OSM clasificados.
Uso: procesar_negocios.py <munis.json> <dir_raw> <dir_data>
"""
import io
import json
import math
import sys
import unicodedata

CONF = json.load(io.open(sys.argv[1], encoding="utf-8"))
RAW = sys.argv[2]
OUT = sys.argv[3]

# grupo -> (emoji, nombre) se definen en la app; aquí solo clasificamos
SUBTIPOS = {
    "hotel": "Hotel", "guest_house": "Casa rural / pensión", "hostel": "Albergue",
    "motel": "Motel", "apartment": "Apartamentos", "chalet": "Casa vacacional",
    "camp_site": "Camping", "caravan_site": "Área de autocaravanas",
    "restaurant": "Restaurante", "bar": "Bar", "cafe": "Cafetería",
    "fast_food": "Comida rápida", "pub": "Pub", "ice_cream": "Heladería",
    "nightclub": "Discoteca",
    "pharmacy": "Farmacia", "dentist": "Dentista", "veterinary": "Veterinario",
    "fuel": "Gasolinera", "bank": "Banco", "atm": "Cajero",
    "post_office": "Correos", "taxi": "Taxi", "marketplace": "Mercado",
    "supermarket": "Supermercado", "convenience": "Tienda de alimentación",
    "bakery": "Panadería", "butcher": "Carnicería", "greengrocer": "Frutería",
    "seafood": "Pescadería", "clothes": "Ropa", "shoes": "Zapatería",
    "hairdresser": "Peluquería", "beauty": "Estética", "florist": "Floristería",
    "hardware": "Ferretería", "doityourself": "Bricolaje",
    "electronics": "Electrónica", "mobile_phone": "Telefonía",
    "car": "Concesionario", "car_repair": "Taller", "car_parts": "Recambios",
    "agrarian": "Agrícola", "farm": "Venta de granxa", "chemist": "Droguería",
    "kiosk": "Quiosco", "newsagent": "Prensa", "stationery": "Papelería",
    "furniture": "Muebles", "alcohol": "Bodega", "optician": "Óptica",
    "funeral_directors": "Funeraria", "travel_agency": "Axencia de viaxes",
    "tobacco": "Estanco", "pet": "Mascotas", "garden_centre": "Xardinería",
}
SIN_NOME_OK = {"pharmacy", "fuel", "bank", "atm", "supermarket", "post_office", "taxi"}


def grupo_de(t):
    if t.get("tourism"):
        return "aloxa"
    a = t.get("amenity", "")
    if a in ("restaurant", "bar", "cafe", "fast_food", "pub", "ice_cream", "nightclub"):
        return "comida"
    if a in ("pharmacy", "dentist", "veterinary"):
        return "saude"
    if a in ("fuel", "bank", "atm", "post_office", "taxi", "marketplace"):
        return "servizos"
    if t.get("shop"):
        return "tendas"
    if t.get("craft"):
        return "outros"
    return None


def subtipo_de(t):
    clave = t.get("tourism") or t.get("amenity") or t.get("shop") or t.get("craft") or ""
    return SUBTIPOS.get(clave, clave.replace("_", " ").capitalize())


def sa(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if not unicodedata.combining(c)).lower().strip()


feats = []
vistos = []  # (nombre_norm, lon, lat) para dedup nodo/way duplicado
stats = {}
for m in CONF:
    try:
        d = json.load(io.open(f"{RAW}/negocios-{m['ine']}.json", encoding="utf-8"))
    except FileNotFoundError:
        print(f"AVISO: falta negocios-{m['ine']}.json")
        continue
    n_muni = 0
    for e in d.get("elements", []):
        t = e.get("tags", {})
        g = grupo_de(t)
        if not g:
            continue
        clave = t.get("tourism") or t.get("amenity") or t.get("shop") or t.get("craft")
        nome = (t.get("name") or "").strip()
        if not nome:
            if clave not in SIN_NOME_OK:
                continue
            nome = SUBTIPOS.get(clave, clave)
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        if lon is None:
            continue
        nn = sa(nome)
        if any(v[0] == nn and abs(v[1] - lon) < 0.0015 and abs(v[2] - lat) < 0.0015
               for v in vistos):
            continue  # duplicado nodo/edificio
        vistos.append((nn, lon, lat))
        props = {
            "n": nome, "g": g, "t": subtipo_de(t), "m": m["ine"], "c": m["nombre"],
        }
        tel = t.get("phone") or t.get("contact:phone") or ""
        if tel:
            props["tel"] = tel.split(";")[0].strip()
        web = t.get("website") or t.get("contact:website") or ""
        if web:
            props["web"] = web.split(";")[0].strip()
        if t.get("opening_hours"):
            props["h"] = t["opening_hours"]
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": props,
        })
        n_muni += 1
    stats[m["nombre"]] = n_muni

fc = {"type": "FeatureCollection", "features": feats}
with io.open(f"{OUT}/negocios.js", "w", encoding="utf-8") as f:
    f.write("window.NEGOCIOS = ")
    json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

from collections import Counter
print("total:", len(feats), "| por grupo:", dict(Counter(x["properties"]["g"] for x in feats)))
print("por concello:", stats)
