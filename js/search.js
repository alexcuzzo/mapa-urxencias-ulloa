// Buscador local sobre las entidades oficiales + sanidad.
// Pensado para el formato del aviso: "lugar [nº] [, parroquia/concello] [CP]".
(function () {
  "use strict";

  // Debe ser espejo de norm() en herramientas/procesar_entidades.py
  function norm(s) {
    s = (s || "").normalize("NFD").split("").filter(function (ch) {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f; // fuera diacríticos combinantes
    }).join("").toLowerCase().trim();
    s = s.replace(/,\s*(a|o|as|os)$/, "");
    s = s.replace(/^(a|o|as|os)\s+/, "");
    s = s.replace(/\(.*?\)/g, " ");
    s = s.replace(/[-']/g, " ");
    s = s.replace(/[^a-z0-9 ]/g, " ");
    s = s.replace(/v/g, "b");
    return s.replace(/\s+/g, " ").trim();
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

  let indice = null;

  function construirIndice() {
    indice = [];
    (window.ENTIDADES ? window.ENTIDADES.features : []).forEach(function (f) {
      const p = f.properties;
      const clave = norm(p.n);
      indice.push({
        tipo: "entidade", f: f, clave: clave, bg: bigramas(clave),
        contexto: norm(p.p + " " + p.adv + " " + p.c), cp: p.cp || "",
      });
    });
    (window.SANIDAD ? window.SANIDAD.features : []).forEach(function (f) {
      const clave = norm(f.properties.n);
      indice.push({
        tipo: "sanidad", f: f, clave: clave, bg: bigramas(clave),
        contexto: norm(f.properties.dir || ""), cp: "",
      });
    });
  }

  // "vilanova 12, monterroso 27560" -> {texto, extra[], cp, num}
  function parseConsulta(q) {
    let cp = null, num = null;
    q = (q || "").trim();
    const mcp = q.match(/\b(27\d{3})\b/);
    if (mcp) { cp = mcp[1]; q = q.replace(mcp[1], " "); }
    // "Outeiro, O" (formato oficial): el artículo tras coma no es un filtro
    q = q.replace(/,\s*(a|o|as|os)\s*$/i, "");
    const partes = q.split(",");
    // el nº de casa puede ir al final del primer tramo ("vilanova 12, monterroso")
    const mnum = partes[0].match(/(?:^|\s)(?:n[ºo°.]?\s*)?(\d{1,4}\s?[a-z]?)\s*$/i);
    if (mnum) {
      num = mnum[1].replace(/\s/g, "").toUpperCase();
      partes[0] = partes[0].slice(0, mnum.index);
    }
    const limpias = partes.map(norm).filter(Boolean)
      .filter(function (p, i) { return i === 0 || !/^(a|o|as|os)$/.test(p); });
    return { texto: limpias[0] || "", extra: limpias.slice(1), cp: cp, num: num };
  }

  function buscar(consulta, max) {
    if (!indice) construirIndice();
    const c = parseConsulta(consulta);
    if (!c.texto && !c.cp) return { consulta: c, resultados: [] };
    const qb = bigramas(c.texto);
    const res = [];
    for (const it of indice) {
      let score = 0;
      if (c.texto) {
        if (it.clave === c.texto) score = 100;
        else if (it.clave.startsWith(c.texto)) score = 80;
        else if (it.clave.split(" ").some(function (w) { return w.startsWith(c.texto); })) score = 70;
        else if (it.clave.includes(c.texto)) score = 60;
        else {
          const d = dice(qb, it.bg);
          if (d >= 0.45) score = 45 * d;
        }
      } else {
        score = 10; // solo CP
      }
      if (!score) continue;
      // filtros de contexto: parroquia/concello tras coma y CP
      let ok = true;
      for (const ex of c.extra) {
        if (ex && !it.contexto.includes(ex)) ok = false;
      }
      if (c.cp) {
        if (it.cp && it.cp === c.cp) score += 15;
        else if (it.cp && it.cp !== c.cp) score -= 25;
      }
      if (it.tipo === "sanidad") score += 5;
      if (it.f.properties.f === "osm-extra") score -= 8;
      if (!ok || score <= 0) continue;
      res.push({ item: it, score: score });
    }
    res.sort(function (a, b) { return b.score - a.score; });
    return { consulta: c, resultados: res.slice(0, max || 12) };
  }

  window.Buscador = { buscar: buscar, norm: norm, parseConsulta: parseConsulta };
})();
