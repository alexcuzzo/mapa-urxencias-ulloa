// Ediciones colaborativas de casas/números.
// Modelo: log de acciones (alta/mover/nota/editar/baja) que se reduce a un
// estado efectivo. Guardado inmediato en localStorage (funciona sin cobertura)
// y sincronización con la hoja de Google vía Apps Script cuando hay señal.
(function () {
  "use strict";
  const URL_SRV = window.EDITS_URL || "";
  const LS_CACHE = "ulloa-edits-cache";
  const LS_PEND = "ulloa-edits-pendientes";
  const LS_PIN = "ulloa-pin";

  function leer(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  let cache = leer(LS_CACHE);
  let pendientes = leer(LS_PEND);
  let alCambiar = null;

  function todas() { return cache.concat(pendientes); }

  // Reduce el log: la última acción sobre cada objetivo gana.
  function efectivas() {
    const altas = new Map();   // id -> casa añadida por el equipo
    const cambios = new Map(); // "m|cv|n" (portal Catastro) -> {lon,lat,nota,del}
    todas().slice().sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); })
      .forEach(function (ed) {
        if (ed.accion === "alta") {
          altas.set(ed.id, {
            id: ed.id, m: String(ed.m || ""), cv: String(ed.cv || ""),
            lugar: ed.lugar || "", numero: String(ed.numero || ""),
            nota: ed.nota || "", lon: +ed.lon, lat: +ed.lat,
            foto: ed.foto || null, fotoLocal: ed.imagenB64 || null,
          });
        } else if (ed.objetivo && altas.has(ed.objetivo)) {
          const c = altas.get(ed.objetivo);
          if (ed.accion === "baja") altas.delete(ed.objetivo);
          else if (ed.accion === "mover") { c.lon = +ed.lon; c.lat = +ed.lat; }
          else if (ed.accion === "nota") {
            c.nota = ed.nota || "";
            if (ed.foto) { c.foto = ed.foto; c.fotoLocal = null; }
            else if (ed.imagenB64) c.fotoLocal = ed.imagenB64;
            else if (!c.nota) { c.foto = null; c.fotoLocal = null; } // nota vacía limpia todo
          } else if (ed.accion === "editar") {
            if (ed.numero !== undefined && ed.numero !== "") c.numero = String(ed.numero);
            if (ed.nota !== undefined) c.nota = ed.nota || "";
            if (ed.foto) { c.foto = ed.foto; c.fotoLocal = null; }
            else if (ed.imagenB64) c.fotoLocal = ed.imagenB64;
          }
        } else if (ed.objetivo) {
          const c = cambios.get(ed.objetivo) || {};
          if (ed.accion === "mover") { c.lon = +ed.lon; c.lat = +ed.lat; }
          else if (ed.accion === "nota") {
            c.nota = ed.nota || "";
            if (ed.foto) { c.foto = ed.foto; c.fotoLocal = null; }
            else if (ed.imagenB64) c.fotoLocal = ed.imagenB64;
            else if (!c.nota) { c.foto = null; c.fotoLocal = null; } // nota vacía limpia todo
          } else if (ed.accion === "baja") c.del = 1;
          cambios.set(ed.objetivo, c);
        }
      });
    return { altas: altas, cambios: cambios };
  }

  function fcCasas() {
    return {
      type: "FeatureCollection",
      features: Array.from(efectivas().altas.values()).map(function (c) {
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lon, c.lat] },
          properties: { id: c.id, m: c.m, cv: c.cv, lugar: c.lugar,
                        n: c.numero, nota: c.nota, casa: 1,
                        foto: c.foto || "", fotoLocal: c.fotoLocal || "" },
        };
      }),
    };
  }

  // Aplica mover/nota/baja sobre los portales del Catastro (reaplicable).
  function aplicarAPortales(fc) {
    const cambios = efectivas().cambios;
    fc.features.forEach(function (f) {
      const p = f.properties;
      delete p.del; delete p.nota; delete p.foto; delete p.fotoLocal;
      if (p.orig) { f.geometry.coordinates = p.orig.slice(); delete p.orig; }
      const c = cambios.get(p.m + "|" + p.cv + "|" + p.n);
      if (!c) return;
      if (c.lon !== undefined) {
        p.orig = f.geometry.coordinates.slice();
        f.geometry.coordinates = [c.lon, c.lat];
      }
      if (c.nota) p.nota = c.nota;
      if (c.foto) p.foto = c.foto;
      if (c.fotoLocal) p.fotoLocal = c.fotoLocal;
      if (c.del) p.del = 1;
    });
  }

  function registrar(ed) {
    ed.id = ed.id || ("e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    ed.ts = Date.now();
    pendientes.push(ed);
    try {
      localStorage.setItem(LS_PEND, JSON.stringify(pendientes));
    } catch (e) {
      // cuota llena (fotos grandes en cola): no perder silenciosamente
      pendientes.pop();
      window.alert("Sin espacio local para guardar esto (fotos pendientes de sincronizar). Busca cobertura para sincronizar e inténtalo de nuevo.");
      return null;
    }
    if (alCambiar) alCambiar();
    sincronizar();
    return ed;
  }

  let sincronizando = false;
  function sincronizar() {
    if (!URL_SRV || sincronizando || !pendientes.length) { avisar(); return; }
    const lote = pendientes.slice();
    sincronizando = true;
    fetch(URL_SRV, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // simple request: sin preflight CORS
      body: JSON.stringify({ pin: localStorage.getItem(LS_PIN) || "", edits: lote }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) {
          // el servidor devuelve el lote procesado (con id de foto en Drive,
          // sin base64); si no, usamos lo enviado
          cache = cache.concat(Array.isArray(j.edits) ? j.edits : lote);
          pendientes = pendientes.slice(lote.length);
          guardar(LS_CACHE, cache);
          guardar(LS_PEND, pendientes);
          if (alCambiar) alCambiar();
        } else if (j.error && /PIN/i.test(j.error)) {
          localStorage.removeItem(LS_PIN);
          if (window.Edicion.alPinIncorrecto) window.Edicion.alPinIncorrecto();
        }
      })
      .catch(function () { /* sin cobertura: se reintenta */ })
      .finally(function () { sincronizando = false; avisar(); });
  }

  function refrescarRemoto() {
    if (!URL_SRV) return;
    fetch(URL_SRV)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok && j.edits) {
          cache = j.edits;
          guardar(LS_CACHE, cache);
          if (alCambiar) alCambiar();
        }
      })
      .catch(function () {});
  }

  function avisar() {
    const b = document.getElementById("banner-sync");
    if (!b) return;
    if (pendientes.length && URL_SRV) {
      b.textContent = "⏳ " + pendientes.length + " cambio(s) sin sincronizar — se enviarán al recuperar cobertura";
      b.hidden = false;
    } else if (pendientes.length && !URL_SRV) {
      b.textContent = "💾 " + pendientes.length + " cambio(s) guardados solo en este dispositivo (falta configurar el servidor)";
      b.hidden = false;
    } else {
      b.hidden = true;
    }
  }

  window.addEventListener("online", sincronizar);

  window.Edicion = {
    registrar: registrar,
    efectivas: efectivas,
    fcCasas: fcCasas,
    aplicarAPortales: aplicarAPortales,
    refrescarRemoto: refrescarRemoto,
    sincronizar: sincronizar,
    avisar: avisar,
    conServidor: !!URL_SRV,
    hayPin: function () { return !!localStorage.getItem(LS_PIN); },
    ponPin: function (p) { localStorage.setItem(LS_PIN, p); },
    alCambio: function (fn) { alCambiar = fn; },
    alPinIncorrecto: null,
  };
})();
