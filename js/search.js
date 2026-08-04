// Buscador local del mapa de urgencias da Ulloa.
// Formato del aviso: "lugar [nº] [, parroquia o concello] [CP]".
// Tolera castellano ("Puente"→Ponte), grafías del Catastro ("Airexe"→Eirexe),
// orden de palabras ("donas vilar") y erratas de dictado ("Curbian"→Curbián).
(function () {
  "use strict";

  const STOP = { de: 1, do: 1, da: 1, dos: 1, das: 1, del: 1, la: 1, las: 1,
    el: 1, los: 1, e: 1, y: 1 };

  // Equivalencias castellano↔gallego y grafías alternativas frecuentes en los
  // avisos y en el callejero del Catastro. Se aplican palabra a palabra.
  const EQUIV = {
    iglesia: "eirexe", iglesias: "eirexe", igrexa: "eirexe", igrexas: "eirexe",
    eirexa: "eirexe", airexe: "eirexe", airexa: "eirexe", eirexi: "eirexe",
    puente: "ponte", puentes: "pontes", fuente: "fonte", fuentes: "fontes",
    otero: "outeiro", oteiro: "outeiro", soto: "souto", posada: "pousada",
    villa: "vila", villar: "vilar", villanueva: "vilanova",
    villaverde: "vilaverde", villamayor: "vilamaior", villanova: "vilanova",
    nueva: "nova", nuevo: "novo", vieja: "vella", viejo: "vello",
    rey: "rei", reyes: "reis", mayor: "maior",
    abajo: "abaixo", bajo: "baixo",
    piedra: "pedra", piedras: "pedras", puerto: "porto",
    agua: "auga", aguas: "augas", molino: "muino", molinos: "muinos",
    sta: "santa", sto: "santo", sn: "san",
  };

  function sinDiacriticos(s) {
    return (s || "").normalize("NFD").split("").filter(function (ch) {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f;
    }).join("");
  }

  // Normalización básica: minúsculas, sin acentos, sin artículo inicial ni
  // final ("Outeiro, O"), sin paréntesis ni puntuación.
  function norm(s) {
    s = sinDiacriticos(s).toLowerCase().trim();
    s = s.replace(/,\s*(a|o|as|os)$/, "");
    s = s.replace(/^(a|o|as|os)\s+/, "");
    s = s.replace(/\(.*?\)/g, " ");
    s = s.replace(/[^a-z0-9]+/g, " ");
    return s.replace(/\s+/g, " ").trim();
  }

  // Clave fonética: agrupa grafías que suenan igual en la zona (seseo, b/v,
  // x/j/g, ll, ou/o) y aplica el diccionario castellano→gallego.
  function fon(s) {
    let t = norm(s).split(" ").map(function (w) { return EQUIV[w] || w; }).join(" ");
    t = t.replace(/ch/g, "0");        // protege ch antes de tocar h y c
    t = t.replace(/h/g, "");
    t = t.replace(/ct/g, "it");       // Victoria/Vitoria
    t = t.replace(/v/g, "b");
    t = t.replace(/ll/g, "l");        // Villa/Vila
    t = t.replace(/([rsn])\1/g, "$1");
    t = t.replace(/[gj]([ei])/g, "x$1");
    t = t.replace(/j/g, "x");         // Seijas/Seixas
    t = t.replace(/gu([ei])/g, "g$1");
    t = t.replace(/qu([ei])/g, "k$1");
    t = t.replace(/c([ei])/g, "s$1"); // Cima/Sima
    t = t.replace(/z/g, "s");         // seseo: Cruz/Crus
    t = t.replace(/c/g, "k");
    t = t.replace(/y/g, "i");
    t = t.replace(/ou/g, "o");        // Souto/Soto, Outeiro/Oteiro
    return t.replace(/\s+/g, " ").trim();
  }

  function tokens(s) {
    return s.split(" ").filter(function (w) { return w && !STOP[w]; });
  }

  function bigramas(s) {
    const b = new Set();
    const t = " " + s + " ";
    for (let i = 0; i < t.length - 1; i++) b.add(t.slice(i, i + 2));
    return b;
  }

  function dice(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return (2 * inter) / (a.size + b.size);
  }

  // Levenshtein acotada: si supera max devuelve max+1 (corte temprano).
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let previa = [];
    for (let j = 0; j <= b.length; j++) previa[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const actual = [i];
      let mejor = i;
      for (let j = 1; j <= b.length; j++) {
        const coste = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + coste);
        if (actual[j] < mejor) mejor = actual[j];
      }
      if (mejor > max) return max + 1;
      previa = actual;
    }
    return previa[b.length];
  }

  function levSim(a, b) {
    const largo = Math.max(a.length, b.length);
    if (!largo) return 0;
    const max = largo > 8 ? 3 : (largo > 4 ? 2 : 1);
    const d = lev(a, b, max);
    return d > max ? 0 : 1 - d / largo;
  }

  // Mejor coincidencia de cada palabra de la consulta contra una lista.
  function mejorPorToken(qt, lista) {
    return qt.map(function (q) {
      let mejor = 0;
      lista.forEach(function (t) {
        let s = 0;
        if (t === q) s = 1;
        else if (t.indexOf(q) === 0) s = q.length >= 3 ? 0.92 : 0.6;
        else if (q.indexOf(t) === 0 && t.length >= 4) s = 0.8;
        else if (Math.abs(t.length - q.length) <= 2 && q.length >= 4) {
          const sim = levSim(q, t);
          if (sim >= 0.75) s = sim * 0.85;
        }
        if (s > mejor) mejor = s;
      });
      return mejor;
    });
  }

  // Coincidencia por palabras, independiente del orden ("donas vilar").
  // Las palabras que no casan con el nombre se prueban contra la parroquia y
  // el concello, porque el aviso suele venir todo seguido ("eirexe frade").
  function porTokens(qt, it) {
    if (!qt.length || !it.ftok.length) return 0;
    const enNombre = mejorPorToken(qt, it.ftok);
    let suma = 0, usadas = 0;
    const sueltas = [];
    enNombre.forEach(function (s, i) {
      if (s >= 0.5) { suma += s; usadas++; } else sueltas.push(qt[i]);
    });
    if (sueltas.length && it.ctxtok.length) {
      mejorPorToken(sueltas, it.ctxtok).forEach(function (s) {
        if (s >= 0.6) suma += s * 0.85;
      });
    }
    if (!usadas) return 0; // algo del nombre tiene que casar
    const cobertura = suma / qt.length;
    // penaliza (con tope) que el nombre tenga palabras que nadie pidió
    const exceso = Math.min(0.12, Math.max(0, it.ftok.length - usadas) * 0.06);
    return Math.max(0, cobertura - exceso);
  }

  let indice = null;
  let ref = null; // {lat, lon} posición de referencia (GPS o centro del mapa)

  function distKm(lat1, lon1, lat2, lon2) {
    const dy = (lat1 - lat2) * 111.32;
    const dx = (lon1 - lon2) * 111.32 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function entrada(tipo, f, nombre, contexto, cp, ext) {
    const clave = norm(nombre), fkey = fon(nombre);
    const co = f.geometry ? f.geometry.coordinates : null;
    return {
      tipo: tipo, f: f, clave: clave, tok: tokens(clave),
      fkey: fkey, ftok: tokens(fkey), bg: bigramas(fkey),
      ctx: norm(contexto), ctxf: fon(contexto), ctxtok: tokens(fon(contexto)),
      cp: cp || "", ext: ext ? 1 : 0,
      lon: co ? co[0] : null, lat: co ? co[1] : null,
    };
  }

  function construir() {
    indice = [];
    const parroquias = new Map();

    ((window.ENTIDADES && window.ENTIDADES.features) || []).forEach(function (f) {
      const p = f.properties;
      indice.push(entrada("entidade", f, p.n,
        p.p + " " + p.adv + " " + p.c, p.cp, p.ext == 1));
      if (!p.p) return;
      const k = p.m + "|" + p.p;
      let g = parroquias.get(k);
      if (!g) {
        g = { n: p.p, adv: p.adv, c: p.c, m: p.m, ext: p.ext, cp: p.cp,
          lugares: 0, sx: 0, sy: 0, bbox: [180, 90, -180, -90] };
        parroquias.set(k, g);
      }
      const co = f.geometry.coordinates;
      g.lugares++; g.sx += co[0]; g.sy += co[1];
      g.bbox[0] = Math.min(g.bbox[0], co[0]); g.bbox[1] = Math.min(g.bbox[1], co[1]);
      g.bbox[2] = Math.max(g.bbox[2], co[0]); g.bbox[3] = Math.max(g.bbox[3], co[1]);
    });

    parroquias.forEach(function (g) {
      const f = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [g.sx / g.lugares, g.sy / g.lugares] },
        bbox: g.bbox,
        properties: { n: g.n, adv: g.adv, c: g.c, m: g.m, ext: g.ext,
          cp: g.cp, nlugares: g.lugares },
      };
      indice.push(entrada("parroquia", f, g.n, g.adv + " " + g.c, g.cp, g.ext == 1));
    });

    ((window.SANIDAD && window.SANIDAD.features) || []).forEach(function (f) {
      indice.push(entrada("sanidad", f, f.properties.n, f.properties.dir || "", "", false));
    });

    // casas del equipo: la nota ("portalón verde") también es texto buscable
    if (window.Edicion) {
      window.Edicion.fcCasas().features.forEach(function (f) {
        const p = f.properties;
        indice.push(entrada("casa", f,
          [p.lugar || "", p.n || "", p.nota || ""].join(" ").trim(),
          (p.lugar || "") + " " + (p.nota || ""), "", false));
      });
    }
  }

  function reindexar() { indice = null; }
  function setReferencia(lat, lon) {
    ref = (isFinite(lat) && isFinite(lon)) ? { lat: lat, lon: lon } : null;
  }

  // "vilanova 12, monterroso 27560" -> {texto, extra[], cp, num}
  function parseConsulta(q) {
    let cp = null, num = null;
    q = (q || "").trim();
    const mcp = q.match(/\b([1-5]\d{4})\b/);
    if (mcp) { cp = mcp[1]; q = q.replace(mcp[1], " "); }
    q = q.replace(/,\s*(a|o|as|os)\s*$/i, ""); // "Outeiro, O": el artículo no filtra
    const partes = q.split(",");
    // el nº de casa puede ir en cualquier posición del primer tramo
    partes[0] = partes[0].replace(/(?:^|\s)(?:n[ºo°.]{0,2}|num\.?|numero)?\s*(\d{1,4}\s?[a-zA-Z]?)(?=\s|$)/,
      function (todo, n) { num = n.replace(/\s/g, "").toUpperCase(); return " "; });
    const limpias = partes.map(norm).filter(Boolean)
      .filter(function (p, i) { return i === 0 || !/^(a|o|as|os)$/.test(p); });
    return { texto: limpias[0] || "", extra: limpias.slice(1), cp: cp, num: num };
  }

  function coincideCtx(it, ex, exf) {
    if (it.ctx.indexOf(ex) >= 0 || it.ctxf.indexOf(exf) >= 0) return true;
    return it.ctxtok.some(function (t) {
      return t.indexOf(exf) === 0 || (t.length >= 4 && levSim(t, exf) >= 0.8);
    });
  }

  function buscar(consulta, max) {
    if (!indice) construir();
    const c = parseConsulta(consulta);
    if (!c.texto && !c.cp) return { consulta: c, resultados: [] };

    const q = c.texto, qf = fon(q), qft = tokens(qf), qb = bigramas(qf);
    const extraFon = c.extra.map(fon);
    const res = [];

    for (let i = 0; i < indice.length; i++) {
      const it = indice[i];
      let s = 0;

      if (!q) {
        s = it.cp === c.cp ? 50 : 0;            // consulta solo con código postal
      } else if (it.clave === q || it.fkey === qf) {
        s = it.clave === q ? 100 : 96;
      } else if (it.clave.indexOf(q) === 0) {
        s = 88;
      } else if (it.fkey.indexOf(qf) === 0) {
        s = 84;
      } else {
        const d = dice(qb, it.bg);
        if (d < 0.15) continue;                 // descarte rápido: nada que ver
        const tk = porTokens(qft, it);
        let sub = 0;
        if (it.clave.indexOf(q) > 0) sub = 0.74;
        else if (it.fkey.indexOf(qf) > 0) sub = 0.70;
        const fz = d >= 0.34 ? Math.max(d, levSim(qf, it.fkey)) : 0;
        s = 100 * Math.max(tk * 0.86, sub, fz >= 0.62 ? fz * 0.78 : 0);
      }

      if (s < 28) continue;

      // contexto tras la coma (parroquia, concello): filtro blando
      let okExtra = true;
      for (let e = 0; e < extraFon.length; e++) {
        if (!coincideCtx(it, c.extra[e], extraFon[e])) { okExtra = false; break; }
      }
      if (okExtra && c.extra.length) s += 18;

      if (c.cp && q) {
        if (it.cp === c.cp) s += 15;
        else if (it.cp) s -= 25;
      }
      if (it.tipo === "sanidad") s += 15; // solo hay 5 y en un aviso urgen
      if (it.tipo === "parroquia") s -= 2;
      if (it.tipo === "casa") s += 4;
      if (it.f.properties && it.f.properties.f === "osm-extra") s -= 8;
      if (it.ext) s -= 3;

      let dist = null;
      if (ref && it.lat != null) {
        dist = distKm(ref.lat, ref.lon, it.lat, it.lon);
        s += dist < 3 ? 12 : dist < 8 ? 9 : dist < 15 ? 6 : dist < 30 ? 3 : 0;
      }
      if (s > 0) res.push({ item: it, score: s, d: dist, okExtra: okExtra });
    }

    // si el contexto no casó con nada, se ignora en vez de dejar la lista vacía
    const conCtx = res.filter(function (r) { return r.okExtra; });
    const usados = (c.extra.length && conCtx.length) ? conCtx : res;
    usados.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.d != null && b.d != null) return a.d - b.d;
      return a.item.clave.length - b.item.clave.length;
    });
    return {
      consulta: c,
      ignoradoCtx: !!(c.extra.length && !conCtx.length),
      resultados: usados.slice(0, max || 12),
    };
  }

  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // Resalta en el nombre original el trozo que casó con lo escrito.
  function resaltar(nombre, texto) {
    const t = norm(texto);
    if (!t) return escapar(nombre);
    const plano = sinDiacriticos(nombre).toLowerCase();
    let i = plano.indexOf(t);
    if (i < 0) {
      const primera = t.split(" ")[0];
      if (primera.length >= 3) i = plano.indexOf(primera);
      if (i < 0) return escapar(nombre);
      return escapar(nombre.slice(0, i)) + "<mark>" +
        escapar(nombre.slice(i, i + primera.length)) + "</mark>" +
        escapar(nombre.slice(i + primera.length));
    }
    return escapar(nombre.slice(0, i)) + "<mark>" +
      escapar(nombre.slice(i, i + t.length)) + "</mark>" +
      escapar(nombre.slice(i + t.length));
  }

  window.Buscador = {
    buscar: buscar, norm: norm, fon: fon, parseConsulta: parseConsulta,
    reindexar: reindexar, setReferencia: setReferencia,
    resaltar: resaltar, escapar: escapar,
  };
})();
