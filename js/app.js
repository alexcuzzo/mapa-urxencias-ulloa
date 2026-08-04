// Mapa de urgencias da Ulloa — Palas de Rei, Monterroso, Antas de Ulla.
(function () {
  "use strict";

  const PLACEHOLDER = "PEGA_AQUI_TU_CLAVE";
  const conClave = window.MAPTILER_KEY && window.MAPTILER_KEY !== PLACEHOLDER;
  const COLORES = { "27040": "#1d4ed8", "27032": "#b91c1c", "27003": "#047857" };
  // demotiles solo sirve el fontstack "Open Sans Semibold" (verificado)
  const FUENTE = conClave ? ["Noto Sans Regular"] : ["Open Sans Semibold"];

  const ESTILO_OSM = {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };

  const avisoClave = document.getElementById("aviso-clave");
  avisoClave.addEventListener("click", function () { avisoClave.hidden = true; });

  // ---------- carga de portales: arranca YA, no depende del mapa ----------
  const PORTALES = { type: "FeatureCollection", features: [] };
  const portalesEstado = { "27003": "pendiente", "27032": "pendiente", "27040": "pendiente" };
  const portalesListos = Promise.all(["27003", "27032", "27040"].map(function (m) {
    return new Promise(function (resolver) {
      const s = document.createElement("script");
      s.src = "data/portales-" + m + ".js";
      s.onload = function () {
        try {
          const fc = window["PORTALES_" + m];
          if (fc && fc.features) {
            fc.features.forEach(function (f) { f.properties.m = m; });
            PORTALES.features = PORTALES.features.concat(fc.features);
            portalesEstado[m] = "ok";
          } else {
            portalesEstado[m] = "fallo";
          }
        } catch (e) { portalesEstado[m] = "fallo"; }
        resolver();
      };
      s.onerror = function () { portalesEstado[m] = "fallo"; resolver(); };
      document.head.appendChild(s);
    });
  }));

  // ---------- mapa (protegido: sin CDN, el buscador y el panel siguen vivos) ----------
  let map = null;
  let usandoFuenteFallback = !conClave;
  if (typeof maplibregl !== "undefined") {
    try {
      map = new maplibregl.Map({
        container: "map",
        style: conClave
          ? "https://api.maptiler.com/maps/outdoor-v2/style.json?key=" +
            encodeURIComponent(window.MAPTILER_KEY)
          : ESTILO_OSM,
        center: [-7.855, 42.835],
        zoom: 10.6,
        attributionControl: { compact: true },
      });
    } catch (e) { map = null; }
  }
  if (!map) {
    avisoClave.textContent = "Sin conexión con el mapa: el buscador y los teléfonos siguen disponibles.";
    avisoClave.hidden = false;
  }

  if (map) {
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
    }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    // clave inválida (403) o estilo que nunca carga → caer a OSM con aviso
    let estiloCaido = false;
    const caerAFallback = function () {
      if (estiloCaido || !conClave) return;
      estiloCaido = true;
      usandoFuenteFallback = true;
      avisoClave.textContent = "No se pudo cargar MapTiler (¿clave inválida en config.js?): usando mapa básico OSM.";
      avisoClave.hidden = false;
      map.setStyle(ESTILO_OSM);
    };
    if (conClave) {
      map.on("error", function (e) {
        const st = e && e.error && e.error.status;
        if ((st === 401 || st === 403) && !map.isStyleLoaded()) caerAFallback();
      });
      let intentos = 0;
      const vigilancia = setInterval(function () {
        if (map.isStyleLoaded()) { clearInterval(vigilancia); return; }
        if (document.visibilityState !== "visible") return; // pestaña oculta: no juzgar
        if (++intentos >= 3) { clearInterval(vigilancia); caerAFallback(); }
      }, 5000);
    }

    map.on("load", montarCapas);
  }

  function montarCapas() {
    const fuente = usandoFuenteFallback ? ["Open Sans Semibold"] : FUENTE;

    map.addSource("limites", { type: "geojson", data: window.LIMITES });
    map.addLayer({
      id: "limites-linea", type: "line", source: "limites",
      paint: { "line-color": "#334155", "line-width": 2, "line-dasharray": [4, 2], "line-opacity": 0.85 },
    });

    map.addSource("entidades", { type: "geojson", data: window.ENTIDADES });
    map.addLayer({
      id: "entidades-circulo", type: "circle", source: "entidades",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 12, 4.5, 15, 7],
        "circle-color": ["match", ["get", "m"], "27040", COLORES["27040"],
          "27032", COLORES["27032"], "27003", COLORES["27003"], "#666"],
        "circle-stroke-width": 1.2,
        "circle-stroke-color": ["case", ["==", ["get", "f"], "osm-extra"], "#94a3b8", "#ffffff"],
        "circle-opacity": ["case", ["==", ["get", "f"], "osm-extra"], 0.6, 0.95],
      },
    });
    map.addLayer({
      id: "entidades-etiqueta", type: "symbol", source: "entidades", minzoom: 11.5,
      layout: {
        "text-field": ["get", "n"], "text-font": fuente,
        "text-size": ["interpolate", ["linear"], ["zoom"], 11.5, 10, 15, 13],
        "text-offset": [0, 1.0], "text-anchor": "top", "text-optional": true,
      },
      paint: {
        "text-color": ["match", ["get", "m"], "27040", COLORES["27040"],
          "27032", COLORES["27032"], "27003", COLORES["27003"], "#333"],
        "text-halo-color": "#ffffff", "text-halo-width": 1.6,
      },
    });

    map.addSource("portales", { type: "geojson", data: PORTALES });
    portalesListos.then(function () {
      const src = map.getSource("portales");
      if (src) src.setData(PORTALES);
    });
    map.addLayer({
      id: "portales-circulo", type: "circle", source: "portales", minzoom: 14,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 17, 5],
        "circle-color": "#d97706", "circle-stroke-width": 1, "circle-stroke-color": "#fff",
      },
    });
    map.addLayer({
      id: "portales-via", type: "circle", source: "portales", minzoom: 13,
      filter: ["==", ["get", "cv"], "__ninguna__"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 4, 17, 8],
        "circle-color": "#d97706", "circle-stroke-width": 2, "circle-stroke-color": "#1d4ed8",
      },
    });
    map.addLayer({
      id: "portales-etiqueta", type: "symbol", source: "portales", minzoom: 15,
      layout: {
        "text-field": ["get", "n"], "text-font": fuente, "text-size": 11,
        "text-offset": [0, 0.9], "text-anchor": "top",
      },
      paint: { "text-color": "#92400e", "text-halo-color": "#fff", "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "portal-obxectivo", type: "circle", source: "portales", minzoom: 10,
      filter: ["==", ["get", "cv"], "__ninguna__"],
      paint: {
        "circle-radius": 11, "circle-color": "rgba(220,38,38,0.25)",
        "circle-stroke-width": 3, "circle-stroke-color": "#dc2626",
      },
    });

    map.addSource("sanidad", { type: "geojson", data: window.SANIDAD });
    map.addLayer({
      id: "sanidad-circulo", type: "circle", source: "sanidad",
      paint: {
        "circle-radius": 8,
        "circle-color": ["match", ["get", "tipo"], "pac", "#dc2626", "hospital", "#7c3aed", "#0891b2"],
        "circle-stroke-width": 2, "circle-stroke-color": "#fff",
      },
    });
    map.addLayer({
      id: "sanidad-cruz", type: "symbol", source: "sanidad",
      layout: { "text-field": "+", "text-font": fuente, "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "sanidad-etiqueta", type: "symbol", source: "sanidad", minzoom: 9,
      layout: {
        "text-field": ["get", "n"], "text-font": fuente, "text-size": 11.5,
        "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true,
      },
      paint: { "text-color": "#7f1d1d", "text-halo-color": "#fff", "text-halo-width": 1.6 },
    });

    // un solo handler de click con caja de tolerancia táctil (±12 px)
    const CAPAS_CLICK = ["portal-obxectivo", "portales-via", "portales-circulo",
      "sanidad-circulo", "entidades-circulo"];
    map.on("click", function (e) {
      const r = 12;
      const caja = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
      const capas = CAPAS_CLICK.filter(function (c) { return map.getLayer(c); });
      const feats = map.queryRenderedFeatures(caja, { layers: capas });
      if (!feats.length) return;
      feats.sort(function (a, b) {
        return CAPAS_CLICK.indexOf(a.layer.id) - CAPAS_CLICK.indexOf(b.layer.id);
      });
      const f = feats[0];
      const coords = f.geometry.coordinates;
      if (f.layer.id.indexOf("portales") === 0 || f.layer.id === "portal-obxectivo") {
        popupPortal(f.properties, coords);
      } else if (f.layer.id === "sanidad-circulo") {
        popupSanidad(f.properties, coords);
      } else {
        popupEntidad(f.properties, coords);
      }
    });
    CAPAS_CLICK.forEach(function (capa) {
      map.on("mouseenter", capa, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", capa, function () { map.getCanvas().style.cursor = ""; });
    });
  }

  // ---------- popups ----------
  function botones(lat, lon) {
    return '<div class="pop-botones">' +
      '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + lat + "," + lon + '">🧭 Google Maps</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://waze.com/ul?ll=' + lat + "," + lon + '&navigate=yes">🚗 Waze</a>' +
      '<button class="btn" onclick="AppUlloa.copiar(' + lat + "," + lon + ',this)">📋 Coordenadas</button>' +
      "</div>";
  }

  let popup;
  function abrirPopup(lngLat, html) {
    if (!map) return;
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ maxWidth: "340px", offset: 10 })
      .setLngLat(lngLat).setHTML(html).addTo(map);
  }

  function popupEntidad(p, coords, aviso) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    let html = "<h3>" + p.n + (p.f === "osm-extra" ? ' <small>(nombre OSM, no oficial)</small>' : "") + "</h3>";
    if (p.p) html += "<div>Parroquia: <b>" + p.p + "</b>" + (p.adv ? " (" + p.adv + ")" : "") + "</div>";
    html += "<div>Concello: <b>" + p.c + "</b>" +
      (p.cp ? " · CP " + p.cp + (p.cpx ? " (aprox.)" : "") : "") + "</div>";
    if (p.dup == 1) html += '<div class="aviso">⚠ Hay más lugares con este nombre: comprueba parroquia y concello.</div>';
    if (aviso) html += '<div class="aviso">' + aviso + "</div>";
    if (p.np > 0) {
      html += '<div class="mini">' + p.np + ' direcciones de Catastro en este lugar</div>' +
        '<div class="pop-botones"><button class="btn" onclick="AppUlloa.verVia(\'' + p.m + "','" + p.cv + "'," + lon + "," + lat + ')">📍 Ver portales</button></div>';
    } else {
      html += '<div class="mini">Sin portales numerados en Catastro para este lugar.</div>';
    }
    html += '<div class="mini">' + lat + ", " + lon + "</div>" + botones(lat, lon);
    abrirPopup(coords, html);
  }

  function popupPortal(p, coords) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    const html = "<h3>Nº " + p.n + "</h3><div>" + p.via + "</div>" +
      (p.cp ? "<div>CP " + p.cp + "</div>" : "") +
      '<div class="mini">Fuente: Catastro · ' + lat + ", " + lon + "</div>" + botones(lat, lon);
    abrirPopup(coords, html);
  }

  function popupSanidad(p, coords) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    const tels = typeof p.tel === "string" ? JSON.parse(p.tel) : (p.tel || []);
    let html = "<h3>" + p.n + "</h3><div>" + p.dir + "</div>";
    tels.forEach(function (t) {
      html += '<div><a class="tel" href="tel:+34' + t.replace(/\s/g, "") + '">☎ ' + t + "</a></div>";
    });
    if (p.nota) html += '<div class="mini">' + p.nota + "</div>";
    html += botones(lat, lon);
    abrirPopup(coords, html);
  }

  // ---------- selección desde el buscador ----------
  function filtrarSeguro(capa, filtro) {
    if (map && map.getLayer(capa)) map.setFilter(capa, filtro);
  }
  function limpiarSeleccion() {
    filtrarSeguro("portales-via", ["==", ["get", "cv"], "__ninguna__"]);
    filtrarSeguro("portal-obxectivo", ["==", ["get", "cv"], "__ninguna__"]);
  }
  function normNum(n) { return (n || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }

  function seleccionarEntidad(f, num) {
    const p = f.properties, coords = f.geometry.coordinates;
    // si el estilo aún no cargó, reaplicar cuando existan las capas
    if (map && !map.getLayer("portales-via")) {
      map.once("load", function () { seleccionarEntidad(f, num); });
    }
    limpiarSeleccion();
    if (p.cv) {
      filtrarSeguro("portales-via", ["all", ["==", ["get", "m"], p.m], ["==", ["get", "cv"], p.cv]]);
    }

    if (num && p.cv) {
      portalesListos.then(function () {
        if (portalesEstado[p.m] !== "ok") {
          if (map) map.flyTo({ center: coords, zoom: 16 });
          popupEntidad(p, coords, "No se pudieron cargar los portales de este concello (sin conexión): se muestra la aldea.");
          return;
        }
        const objetivo = PORTALES.features.filter(function (pf) {
          return pf.properties.m === p.m && pf.properties.cv === p.cv;
        });
        let hit = objetivo.find(function (pf) { return normNum(pf.properties.n) === normNum(num); });
        if (!hit) hit = objetivo.find(function (pf) { return normNum(pf.properties.n).replace(/[A-Z]+$/, "") === normNum(num); });
        if (hit) {
          filtrarSeguro("portal-obxectivo", ["all", ["==", ["get", "m"], p.m],
            ["==", ["get", "cv"], p.cv], ["==", ["get", "n"], hit.properties.n]]);
          if (map) map.flyTo({ center: hit.geometry.coordinates, zoom: 17 });
          popupPortal(hit.properties, hit.geometry.coordinates);
        } else {
          if (map) map.flyTo({ center: coords, zoom: 16 });
          popupEntidad(p, coords, "El nº " + num + " no figura en el Catastro de este lugar; se muestra la aldea y sus portales.");
        }
      });
    } else {
      if (map) map.flyTo({ center: coords, zoom: p.np > 0 ? 15.5 : 15 });
      popupEntidad(p, coords);
    }
  }

  function verVia(m, cv, lon, lat) {
    filtrarSeguro("portal-obxectivo", ["==", ["get", "cv"], "__ninguna__"]);
    filtrarSeguro("portales-via", ["all", ["==", ["get", "m"], m], ["==", ["get", "cv"], cv]]);
    if (map) map.flyTo({ center: [lon, lat], zoom: 16 });
  }

  function copiar(lat, lon, btn) {
    const texto = lat + ", " + lon;
    const hecho = function () {
      if (btn) { btn.textContent = "✓ Copiado"; setTimeout(function () { btn.textContent = "📋 Coordenadas"; }, 1500); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(hecho, function () { window.prompt("Copia las coordenadas:", texto); });
    } else {
      window.prompt("Copia las coordenadas:", texto);
    }
  }

  // ---------- UI del buscador (independiente del mapa) ----------
  const input = document.getElementById("busqueda");
  const caja = document.getElementById("resultados");
  let resultadosActuales = [], marcado = -1;

  function pintarResultados(r) {
    resultadosActuales = r.resultados;
    marcado = -1;
    if (!r.resultados.length) {
      caja.innerHTML = input.value.trim() ? '<div class="res vacio">Sin resultados. Prueba sin artículo (O/A) o solo el inicio del nombre.</div>' : "";
      caja.hidden = !input.value.trim();
      return;
    }
    caja.innerHTML = r.resultados.map(function (x, i) {
      const p = x.item.f.properties;
      if (x.item.tipo === "sanidad") {
        return '<div class="res" data-i="' + i + '"><b>🏥 ' + p.n + "</b><br><small>" + p.dir + "</small></div>";
      }
      const extra = p.f === "osm-extra" ? ' <span class="tag">no oficial</span>' : "";
      const dup = p.dup == 1 ? ' <span class="tag warn">⚠ repetido</span>' : "";
      const portais = p.np > 0 ? " · " + p.np + " portales" : "";
      return '<div class="res" data-i="' + i + '"><b>' + p.n + "</b>" + dup + extra +
        "<br><small>" + (p.p ? p.p + (p.adv ? " (" + p.adv + ")" : "") + " · " : "") + p.c +
        (p.cp ? " · CP " + p.cp + (p.cpx ? "~" : "") : "") + portais + "</small></div>";
    }).join("");
    caja.hidden = false;
  }

  function elegir(i) {
    const r = resultadosActuales[i];
    if (!r) return;
    caja.hidden = true;
    const c = window.Buscador.parseConsulta(input.value);
    if (r.item.tipo === "sanidad") {
      limpiarSeleccion();
      const f = r.item.f;
      if (map) map.flyTo({ center: f.geometry.coordinates, zoom: 16 });
      popupSanidad(f.properties, f.geometry.coordinates);
    } else {
      seleccionarEntidad(r.item.f, c.num);
    }
  }

  input.addEventListener("input", function () {
    pintarResultados(window.Buscador.buscar(input.value));
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!caja.hidden) elegir(marcado >= 0 ? marcado : 0);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = resultadosActuales.length;
      if (!n) return;
      marcado = (marcado + (e.key === "ArrowDown" ? 1 : n - 1) + n) % n;
      Array.prototype.forEach.call(caja.children, function (el, i) {
        el.classList.toggle("marcado", i === marcado);
      });
    }
    if (e.key === "Escape") caja.hidden = true;
  });
  caja.addEventListener("click", function (e) {
    const el = e.target.closest(".res");
    if (el && el.dataset.i !== undefined) elegir(+el.dataset.i);
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#cabecera")) caja.hidden = true;
  });

  // ---------- panel lateral ----------
  const panel = document.getElementById("panel");
  const btnPanel = document.getElementById("btn-panel");
  function alternarPanel(abrir) {
    panel.classList.toggle("abierto", abrir);
    btnPanel.textContent = panel.classList.contains("abierto") ? "✕" : "☰";
    btnPanel.setAttribute("aria-expanded", panel.classList.contains("abierto"));
  }
  btnPanel.addEventListener("click", function () {
    alternarPanel(!panel.classList.contains("abierto"));
  });
  document.addEventListener("click", function (e) {
    if (panel.classList.contains("abierto") &&
        !e.target.closest("#panel") && !e.target.closest("#btn-panel")) {
      alternarPanel(false);
    }
  });
  const listaSan = document.getElementById("lista-sanidad");
  window.SANIDAD.features.forEach(function (f) {
    const p = f.properties;
    const div = document.createElement("div");
    div.className = "san-item san-" + p.tipo;
    div.innerHTML = "<b>" + p.n + "</b><br><small>" + p.dir + "</small><br>" +
      (p.tel || []).map(function (t) {
        return '<a class="tel" href="tel:+34' + t.replace(/\s/g, "") + '">☎ ' + t + "</a> ";
      }).join("");
    div.addEventListener("click", function (e) {
      if (e.target.tagName === "A") return;
      alternarPanel(false);
      limpiarSeleccion();
      if (map) map.flyTo({ center: f.geometry.coordinates, zoom: 16 });
      popupSanidad(p, f.geometry.coordinates);
    });
    listaSan.appendChild(div);
  });

  window.AppUlloa = { copiar: copiar, verVia: verVia, map: map };
})();
