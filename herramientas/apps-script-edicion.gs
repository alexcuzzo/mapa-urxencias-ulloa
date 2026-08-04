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

const COLS = ["id", "ts", "accion", "m", "cv", "lugar", "numero", "nota", "lon", "lat", "objetivo"];

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
  return h;
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
  const filas = (body.edits || [])
    .filter(function (ed) { return ed.id && !existentes[String(ed.id)]; })
    .map(function (ed) {
      return COLS.map(function (c) { return ed[c] !== undefined ? ed[c] : ""; });
    });
  if (filas.length) {
    h.getRange(h.getLastRow() + 1, 1, filas.length, COLS.length).setValues(filas);
  }
  return salida_({ ok: true, guardados: filas.length });
}

function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
