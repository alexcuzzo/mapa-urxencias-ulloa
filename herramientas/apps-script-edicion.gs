/** Mapa de urgencias da Ulloa — backend de ediciones (casas y números).
 *
 * INSTRUCCIONES DE DESPLIEGUE (5 minutos, igual que el de Casa Andaina):
 *  1. Entra en script.google.com → "Nuevo proyecto" y pega este archivo entero.
 *  2. Cambia el PIN de la línea de abajo por el que quieras dar al equipo.
 *  3. Implementar → Nueva implementación → tipo "Aplicación web":
 *       - Ejecutar como: Tú (tu cuenta)
 *       - Quién tiene acceso: Cualquier usuario
 *     Autoriza los permisos cuando lo pida.
 *  4. Copia la URL que termina en /exec y pégala en config.js → window.EDITS_URL.
 *  5. Sube el cambio de config.js (git push) y listo.
 *
 * La hoja de cálculo "mapa-ulloa-edicions" se crea sola en tu Drive la
 * primera vez; cada fila es una edición (histórico completo, nada se pierde).
 */
const PIN = "CAMBIAME";

const COLS = ["id", "ts", "accion", "m", "cv", "lugar", "numero", "nota", "lon", "lat", "objetivo", "foto"];

function hoja_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SHEET_ID");
  let ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("mapa-ulloa-edicions");
    props.setProperty("SHEET_ID", ss.getId());
    ss.getActiveSheet().setName("casas");
    ss.getSheetByName("casas").appendRow(COLS);
  }
  let h = ss.getSheetByName("casas");
  if (!h) { h = ss.insertSheet("casas"); h.appendRow(COLS); }
  if (h.getLastColumn() < COLS.length) {
    h.getRange(1, 1, 1, COLS.length).setValues([COLS]); // ampliar cabecera (foto)
  }
  return h;
}

function carpeta_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("FOTOS_ID");
  let f = null;
  if (id) {
    try { f = DriveApp.getFolderById(id); } catch (e) { f = null; }
  }
  if (!f) {
    f = DriveApp.createFolder("mapa-ulloa-fotos");
    props.setProperty("FOTOS_ID", f.getId());
  }
  return f;
}

function guardarFoto_(ed) {
  const blob = Utilities.newBlob(Utilities.base64Decode(ed.imagenB64), "image/jpeg",
    (ed.id || "foto") + ".jpg");
  const file = carpeta_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function doGet() {
  const h = hoja_();
  const vals = h.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < vals.length; i++) {
    const o = {};
    COLS.forEach(function (c, j) { o[c] = vals[i][j]; });
    out.push(o);
  }
  return salida_({ ok: true, edits: out });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) {
    return salida_({ ok: false, error: "JSON invalido" });
  }
  if (String(body.pin) !== String(PIN)) {
    return salida_({ ok: false, error: "PIN incorrecto" });
  }
  const h = hoja_();
  // dedup por id: un lote reenviado (respuesta perdida, reintento) no duplica
  const existentes = {};
  h.getRange(1, 1, h.getLastRow(), 1).getValues().forEach(function (f) {
    if (f[0]) existentes[String(f[0])] = true;
  });
  const nuevos = (body.edits || [])
    .filter(function (ed) { return ed.id && !existentes[String(ed.id)]; });
  nuevos.forEach(function (ed) {
    if (ed.imagenB64) {
      try { ed.foto = guardarFoto_(ed); } catch (e) { ed.foto = ""; }
      delete ed.imagenB64;
    }
  });
  const filas = nuevos.map(function (ed) {
    return COLS.map(function (c) { return ed[c] !== undefined ? ed[c] : ""; });
  });
  if (filas.length) {
    h.getRange(h.getLastRow() + 1, 1, filas.length, COLS.length).setValues(filas);
  }
  // devolver el lote procesado (con id de foto en Drive, sin base64)
  return salida_({ ok: true, guardados: filas.length, edits: nuevos });
}

function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar una vez desde el editor para autorizar permisos y crear la hoja. */
function autorizar() {
  const h = hoja_();
  Logger.log("OK: " + h.getParent().getUrl());
}
