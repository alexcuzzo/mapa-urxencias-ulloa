# Mapa de urgencias da Ulloa

Mapa web con **todas las aldeas oficiales** de Palas de Rei, Monterroso y
Antas de Ulla (comarca da Ulloa, Lugo) y los **portales numerados del
Catastro**, pensado para localizar avisos del servicio médico de urgencias
con el formato: *lugar + nº de casa + parroquia + concello + CP*.

## Uso

1. Abre `config.js` y pega tu clave API de MapTiler
   (https://cloud.maptiler.com/account/keys/) donde pone `PEGA_AQUI_TU_CLAVE`.
   Sin clave, el mapa funciona igualmente con teselas básicas de OpenStreetMap.
2. Abre `index.html` en el navegador (doble clic vale).
3. Busca como llega el aviso: `vilanova 7` · `outeiro, ligonde` · `lestedo 27216`.
   - ⚠ marca topónimos repetidos en varias parroquias (hay 83 nombres repetidos).
   - Al elegir un resultado se resaltan los portales de ese lugar; si diste
     número, se marca en rojo el portal exacto.
   - Botones de cada ficha: navegación en Google Maps / Waze y copiar coordenadas.
4. Botón ☰: recursos sanitarios (PAC Palas 24h, centros de salud, HULA),
   leyenda y ayuda. Botón de geolocalización arriba a la derecha.
5. Al seleccionar cualquier punto: **barra inferior** con 🧭 Navegar (Google
   Maps), 🚗 Waze y 📤 Compartir (envía un enlace que abre este mapa clavado
   en el punto). El buscador vacío muestra los **últimos destinos**.
6. Botón 🗺/🛰/🌙: alterna vista día / **satélite** (para identificar la casa
   por el tejado) / **nocturna** (conducción de noche).
7. La app también se puede abrir con el aviso en la URL: `?q=vilanova 12`.

Para usarlo en el móvil: sube la carpeta tal cual a cualquier hosting
estático (Netlify Drop, GitHub Pages…) — no necesita servidor dinámico.

## Datos (agosto 2026)

| Qué | Fuente | Cifras |
|---|---|---|
| Lugares oficiales + parroquia | Nomenclátor de Galicia (Xunta, CC BY-SA 4.0) | 639 lugares, 99 parroquias — **639/639 localizados** |
| Coordenadas de aldeas | OpenStreetMap (ODbL) + centroides Catastro | verificado con QA por muestreo (46 aldeas contra fuentes independientes) |
| Portales numerados + CP | Catastro INSPIRE Addresses + callejero OVC | 4.885 numerados |
| Sanidad | Sergas (verificado 08/2026) / OSM | 5 recursos; PAC da Ulloa 24h confirmado |

**Limitación real de la zona**: la mayoría de las direcciones rurales consta
en Catastro como "S/N": solo está numerado el 44% de las direcciones de aldea
en Antas, el 42% en Monterroso y el **23% en Palas de Rei** (64 lugares de
Palas no tienen ni un solo portal numerado). Si el aviso da un número que no
existe en Catastro, la app lo avisa y lleva al punto de la aldea. Un número
puede existir en Catastro y no estar rotulado en la fachada.

MapLibre GL va autoalojado en `lib/` (5.24.0): la app arranca sin depender
de ningún CDN, útil con la cobertura intermitente de la zona. Para usar la
geolocalización y el portapapeles desde el móvil, sírvela por HTTPS
(GitHub Pages / Netlify).

## Edición colaborativa (añadir/corregir casas)

Botón **✏️**: activa el modo edición (pide el PIN del equipo una vez por
dispositivo). Con él activo:
- **Tocar el mapa** donde esté una casa → formulario (número, lugar, nota
  y **foto opcional** de la fachada — se comprime en el móvil y se guarda en
  la carpeta "mapa-ulloa-fotos" de Drive).
- **Tocar un portal o casa** → mover posición, añadir nota con foto
  ("portalón verde"), o marcar como inexistente. Guardar una nota vacía
  borra la nota y la foto.
- Desde la ficha de una aldea: "➕ Añadir casa en este lugar".

Las ediciones se guardan al instante en el dispositivo (funciona sin
cobertura) y se sincronizan con una hoja de Google cuando hay señal; todos
los dispositivos ven lo mismo. Las casas del equipo salen en **verde** y el
buscador las encuentra igual que las del Catastro.

**Activar el servidor compartido (una vez, 5 min)**: sigue las instrucciones
de `herramientas/apps-script-edicion.gs` (Apps Script + PIN) y pega la URL
`/exec` en `config.js` → `EDITS_URL`. Sin configurar, las ediciones quedan
solo en cada dispositivo.

## Reproducir el pipeline de datos

Scripts en `herramientas/` (Python 3 + `pyproj`):

```bash
python herramientas/descargar_osm.py <dir_raw>
python herramientas/procesar_portales.py <dir_raw> data
python herramientas/procesar_entidades.py <dir_raw> data
```

`descargar_osm.py` baja límites y aldeas de Overpass; los ZIP del Catastro
(`A.ES.SDGC.AD.270XX.zip`), el CSV del Nomenclátor y el callejero OVC se
descargan según se documenta en cada script. El casado OSM↔Xunta↔Catastro
genera `data/entidades.js` y un informe de huecos.

> Herramienta de apoyo a la orientación. No sustituye a la central de
> coordinación (061/112) ni al criterio profesional.
