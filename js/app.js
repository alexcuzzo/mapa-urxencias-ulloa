// Mapa de urgencias da Ulloa — Palas de Rei, Monterroso, Antas de Ulla.
(function () {
  "use strict";

  const PLACEHOLDER = "PEGA_AQUI_TU_CLAVE";
  const conClave = window.MAPTILER_KEY && window.MAPTILER_KEY !== PLACEHOLDER;
  const COLORES = { "27040": "#1d4ed8", "27032": "#b91c1c", "27003": "#047857",
    "27020": "#c026d3" };
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

  // ---------- carga de portales: núcleo al arrancar, vecinos bajo demanda ----------
  const MUNIS_NUCLEO = ["27003", "27032", "27040", "27020"];
  const MUNIS_EXT = ["27023", "27049", "27060", "15046", "15079", "15083",
    "36020", "36047",
    "27057", "27062", "27055", "27045", "15006", "15066", "15078"];
  const PORTALES = { type: "FeatureCollection", features: [] };
  const portalesEstado = {};
  MUNIS_NUCLEO.concat(MUNIS_EXT).forEach(function (m) { portalesEstado[m] = "pendiente"; });

  const NOMES_MUNI = {
    "27003": "Antas de Ulla", "27032": "Monterroso", "27040": "Palas de Rei",
    "27020": "Friol", "27023": "Guntín", "27049": "Portomarín", "27060": "Taboada",
    "15046": "Melide", "15079": "Santiso", "15083": "Toques",
    "36020": "Agolada", "36047": "Rodeiro",
    "27057": "Sarria", "27062": "Triacastela", "27055": "Samos",
    "27045": "Pedrafita do Cebreiro", "15006": "Arzúa", "15066": "O Pino",
    "15078": "Santiago de Compostela",
  };

  // vías (calles/lugares del Catastro) de los concellos ya cargados: hace
  // buscable el callejero urbano ("Rúa do Vilar 15" en Santiago o Sarria)
  window.VIAS = [];
  const TIPO_VIA = { RU: "Rúa", CL: "Rúa", CALLE: "Rúa", AV: "Avenida", AVDA: "Avenida",
    PZ: "Praza", PLAZA: "Praza", PR: "Praza", CM: "Camiño", CJ: "Calexón",
    TR: "Travesía", PS: "Paseo", CR: "Estrada", CTRA: "Estrada", GL: "Glorieta",
    RD: "Ronda", ES: "Escalinata", UR: "Urbanización", PG: "Polígono", BO: "Barrio" };
  function indexarVias(m) {
    const agregado = {};
    PORTALES.features.forEach(function (f) {
      const p = f.properties;
      if (p.m !== m || p.tv === "LG" || p.tv === "PQ") return; // los LG ya son aldeas
      let a = agregado[p.cv];
      if (!a) {
        // "VILAR (DO)" → "Rúa Vilar (do)": el aviso urbano dice el tipo de vía
        const tipo = TIPO_VIA[p.tv] || "";
        a = agregado[p.cv] = { via: (tipo ? tipo + " " : "") + p.via, n: 0, sx: 0, sy: 0 };
      }
      a.n++;
      a.sx += f.geometry.coordinates[0];
      a.sy += f.geometry.coordinates[1];
    });
    Object.keys(agregado).forEach(function (cv) {
      const a = agregado[cv];
      window.VIAS.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.sx / a.n, a.sy / a.n] },
        properties: { n: a.via, p: "", adv: "", c: NOMES_MUNI[m] || "", m: m,
          cv: cv, np: a.n, dup: 0, ext: MUNIS_NUCLEO.indexOf(m) >= 0 ? 0 : 1,
          rua: 1 },
      });
    });
  }

  const portalPromesas = {};
  function cargarMuni(m) {
    if (!portalPromesas[m]) {
      portalPromesas[m] = new Promise(function (resolver) {
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
      }).then(function () {
        if (portalesEstado[m] === "ok") indexarVias(m);
        refrescarEdiciones();
      });
    }
    return portalPromesas[m];
  }
  const portalesListos = Promise.all(MUNIS_NUCLEO.map(cargarMuni));
  function portalesDe(m) { return cargarMuni(m); }

  // ---------- directorio de alojamientos y negocios ----------
  const GRUPOS = {
    aloxa: { e: "🛏", nome: "Aloxamento", c: "#0284c7" },
    vut: { e: "🏠", nome: "Vivendas turísticas", c: "#4f46e5" },
    comida: { e: "🍽", nome: "Comer e beber", c: "#ea580c" },
    tendas: { e: "🛒", nome: "Tendas", c: "#7c3aed" },
    saude: { e: "💊", nome: "Farmacias e saúde", c: "#e11d48" },
    servizos: { e: "⛽", nome: "Servizos", c: "#0f766e" },
    outros: { e: "🔧", nome: "Outros", c: "#737373" },
  };
  // por defecto todo menos las vivendas turísticas (son >1.000 y tapan el resto)
  const POR_DEFECTO = Object.keys(GRUPOS).filter(function (g) { return g !== "vut"; });
  let negociosVisible = false;
  const gruposActivos = (function () {
    try {
      const g = JSON.parse(localStorage.getItem("ulloa-dir-grupos"));
      if (Array.isArray(g) && g.length) {
        return new Set(g.filter(function (x) { return GRUPOS[x]; }));
      }
    } catch (e) {}
    return new Set(POR_DEFECTO);
  })();

  // OSM + REAT en una sola colección, quitando los duplicados de alojamiento
  // (el REAT es el registro oficial y manda sobre lo mapeado en OSM)
  function combinarPois() {
    const reat = (window.ALOXAMENTOS && window.ALOXAMENTOS.features) || [];
    const osm = (window.NEGOCIOS && window.NEGOCIOS.features) || [];
    const clave = function (s) {
      return window.Buscador.norm(s).replace(/^(albergue|hotel|pension|hostal|casa|apartamentos?|camping) /, "");
    };
    const oficiales = reat.map(function (f) {
      return { k: clave(f.properties.n), co: f.geometry.coordinates };
    });
    const limpios = osm.filter(function (f) {
      if (f.properties.g !== "aloxa") return true;
      const k = clave(f.properties.n), co = f.geometry.coordinates;
      return !oficiales.some(function (o) {
        if (!o.k || !k) return false;
        if (o.k.indexOf(k) < 0 && k.indexOf(o.k) < 0) return false;
        return Math.abs(o.co[0] - co[0]) < 0.004 && Math.abs(o.co[1] - co[1]) < 0.003;
      });
    });
    window.POIS = { type: "FeatureCollection", features: limpios.concat(reat) };
    return window.POIS;
  }

  let negociosPromesa = null;
  function cargarNegocios() {
    if (!negociosPromesa) {
      negociosPromesa = Promise.all(["data/negocios.js", "data/aloxamentos.js"].map(function (src) {
        return new Promise(function (resolver) {
          const s = document.createElement("script");
          s.src = src;
          s.onload = resolver;
          s.onerror = resolver;
          document.head.appendChild(s);
        });
      })).then(function () {
        const fc = combinarPois();
        if (map) {
          const src = map.getSource("negocios");
          if (src) src.setData(fc);
        }
        window.Buscador.reindexar();
      });
    }
    return negociosPromesa;
  }
  setTimeout(cargarNegocios, 2500); // en segundo plano: el buscador los conoce pronto

  function aplicarNegocios() {
    if (!map) return;
    ["negocios-circulo", "negocios-etiqueta"].forEach(function (capa) {
      if (map.getLayer(capa)) {
        map.setLayoutProperty(capa, "visibility", negociosVisible ? "visible" : "none");
      }
    });
    filtrarSeguro("negocios-circulo", ["in", ["get", "g"], ["literal", Array.from(gruposActivos)]]);
    filtrarSeguro("negocios-etiqueta", ["in", ["get", "g"], ["literal", Array.from(gruposActivos)]]);
    document.getElementById("btn-negocios").classList.toggle("activo", negociosVisible);
  }
  function ponerNegocios(v) {
    negociosVisible = v;
    if (v) cargarNegocios();
    aplicarNegocios();
  }

  // ---------- concellos veciños: selección individual ----------
  const VECINOS_NOMES = {
    "15046": "Melide", "15079": "Santiso", "15083": "Toques",
    "27023": "Guntín", "27049": "Portomarín", "27060": "Taboada",
    "36020": "Agolada", "36047": "Rodeiro",
    "27057": "Sarria", "27062": "Triacastela", "27055": "Samos",
    "27045": "Pedrafita do Cebreiro", "15006": "Arzúa", "15066": "O Pino",
    "15078": "Santiago de Compostela",
  };
  const seleccionVecinos = (function () {
    try {
      const guardada = JSON.parse(localStorage.getItem("ulloa-vecinos-sel"));
      if (Array.isArray(guardada)) {
        return new Set(guardada.filter(function (m) { return VECINOS_NOMES[m]; }));
      }
    } catch (e) {}
    // migración del interruptor antiguo todo/nada
    return localStorage.getItem("ulloa-vecinos") === "1" ? new Set(MUNIS_EXT) : new Set();
  })();
  function guardarSeleccion() {
    try {
      localStorage.setItem("ulloa-vecinos-sel", JSON.stringify(Array.from(seleccionVecinos)));
    } catch (e) {}
  }
  function aplicarVecinos() {
    const dentro = ["in", ["get", "m"],
      ["literal", MUNIS_NUCLEO.concat(Array.from(seleccionVecinos))]];
    ["entidades-circulo", "entidades-etiqueta", "limites-linea"].forEach(function (capa) {
      filtrarSeguro(capa, dentro);
    });
    filtrarSeguro("portales-circulo", ["all", ["!=", ["get", "del"], 1], dentro]);
    filtrarSeguro("portales-etiqueta", ["all", ["!=", ["get", "del"], 1], dentro]);
    Object.keys(VECINOS_NOMES).forEach(function (m) {
      const cb = document.getElementById("chk-v-" + m);
      if (cb) cb.checked = seleccionVecinos.has(m);
    });
    const todos = document.getElementById("chk-vecinos-todos");
    if (todos) todos.checked = seleccionVecinos.size === MUNIS_EXT.length;
  }
  function ponerVecino(m, activo) {
    if (activo) { seleccionVecinos.add(m); cargarMuni(m); }
    else seleccionVecinos.delete(m);
    guardarSeleccion();
    aplicarVecinos();
  }

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
    const geoloc = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
    });
    map.addControl(geoloc, "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    // referencia para ordenar por cercanía: el GPS manda; si no, el centro del mapa
    let hayGps = false;
    geoloc.on("geolocate", function (e) {
      hayGps = true;
      window.Buscador.setReferencia(e.coords.latitude, e.coords.longitude);
    });
    geoloc.on("trackuserlocationend", function () { hayGps = false; });
    map.on("moveend", function () {
      if (hayGps) return;
      const c = map.getCenter();
      window.Buscador.setReferencia(c.lat, c.lng);
    });
    const c0 = map.getCenter();
    window.Buscador.setReferencia(c0.lat, c0.lng);

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

    // style.load se dispara con cada estilo (inicial, satélite, nocturno,
    // fallback): las capas propias se remontan siempre encima.
    map.on("style.load", montarCapas);
    map.once("load", enlazarInteraccion);
  }

  // ---------- vistas: día / satélite / noche ----------
  const VISTAS = {
    dia: { icono: "🗺", nombre: "día", estilo: "outdoor-v2" },
    sat: { icono: "🛰", nombre: "satélite", estilo: "hybrid" },
    noche: { icono: "🌙", nombre: "noche", estilo: "streets-v2-dark" },
  };
  const ORDEN_VISTAS = ["dia", "sat", "noche"];
  let vistaActual = "dia";
  const btnVista = document.getElementById("btn-vista");
  if (conClave && map) {
    btnVista.hidden = false;
    btnVista.textContent = VISTAS.dia.icono;
    btnVista.addEventListener("click", function () {
      vistaActual = ORDEN_VISTAS[(ORDEN_VISTAS.indexOf(vistaActual) + 1) % ORDEN_VISTAS.length];
      const v = VISTAS[vistaActual];
      btnVista.textContent = v.icono;
      btnVista.setAttribute("aria-label", "Vista: " + v.nombre);
      document.body.classList.toggle("oscuro", vistaActual === "noche");
      map.setStyle("https://api.maptiler.com/maps/" + v.estilo + "/style.json?key=" +
        encodeURIComponent(window.MAPTILER_KEY));
    });
  }

  function montarCapas() {
    if (map.getSource("entidades")) return; // ya montadas para este estilo
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
          "27032", COLORES["27032"], "27003", COLORES["27003"],
          "27020", COLORES["27020"], "#64748b"],
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
          "27032", COLORES["27032"], "27003", COLORES["27003"],
          "27020", "#a21caf", "#475569"],
        "text-halo-color": "#ffffff", "text-halo-width": 1.6,
      },
    });

    map.addSource("portales", { type: "geojson", data: PORTALES });
    portalesListos.then(refrescarEdiciones);
    map.addLayer({
      id: "portales-circulo", type: "circle", source: "portales", minzoom: 14,
      filter: ["!=", ["get", "del"], 1],
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
      filter: ["!=", ["get", "del"], 1],
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

    // Casas añadidas/corregidas por el equipo (verde)
    map.addSource("casas", { type: "geojson", data: window.Edicion.fcCasas() });
    map.addLayer({
      id: "casas-circulo", type: "circle", source: "casas", minzoom: 12,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 4, 17, 7],
        "circle-color": "#16a34a", "circle-stroke-width": 1.5, "circle-stroke-color": "#fff",
      },
    });
    map.addLayer({
      id: "casas-etiqueta", type: "symbol", source: "casas", minzoom: 14,
      layout: {
        "text-field": ["get", "n"], "text-font": fuente, "text-size": 11.5,
        "text-offset": [0, 0.9], "text-anchor": "top",
      },
      paint: { "text-color": "#166534", "text-halo-color": "#fff", "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "casa-obxectivo", type: "circle", source: "casas", minzoom: 10,
      filter: ["==", ["get", "id"], "__ninguna__"],
      paint: {
        "circle-radius": 11, "circle-color": "rgba(22,163,74,0.25)",
        "circle-stroke-width": 3, "circle-stroke-color": "#16a34a",
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

    // Alojamientos y negocios (visibles solo con el directorio activo)
    map.addSource("negocios", {
      type: "geojson",
      data: (window.POIS || { type: "FeatureCollection", features: [] }),
    });
    map.addLayer({
      id: "negocios-circulo", type: "circle", source: "negocios", minzoom: 10,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 8],
        "circle-color": ["match", ["get", "g"],
          "aloxa", GRUPOS.aloxa.c, "vut", GRUPOS.vut.c, "comida", GRUPOS.comida.c,
          "tendas", GRUPOS.tendas.c, "saude", GRUPOS.saude.c,
          "servizos", GRUPOS.servizos.c, GRUPOS.outros.c],
        "circle-stroke-width": 1.5, "circle-stroke-color": "#fff",
      },
    });
    map.addLayer({
      id: "negocios-etiqueta", type: "symbol", source: "negocios", minzoom: 13.5,
      layout: {
        visibility: "none",
        "text-field": ["get", "n"], "text-font": fuente, "text-size": 11,
        "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true,
      },
      paint: { "text-color": "#0f172a", "text-halo-color": "#fff", "text-halo-width": 1.5 },
    });

    aplicarVecinos();
    aplicarNegocios();
  }

  // un solo handler de click con caja de tolerancia táctil (±12 px)
  const CAPAS_CLICK = ["portal-obxectivo", "casa-obxectivo", "casas-circulo",
    "negocios-circulo", "portales-via", "portales-circulo",
    "sanidad-circulo", "entidades-circulo"];
  function enlazarInteraccion() {
    map.on("click", function (e) {
      if (Editor.interceptarClick(e)) return; // modos mover / colocar casa
      const r = 12;
      const caja = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
      const capas = CAPAS_CLICK.filter(function (c) { return map.getLayer(c); });
      const feats = map.queryRenderedFeatures(caja, { layers: capas });
      if (!feats.length) { Editor.clickVacio(e); return; }
      feats.sort(function (a, b) {
        return CAPAS_CLICK.indexOf(a.layer.id) - CAPAS_CLICK.indexOf(b.layer.id);
      });
      const f = feats[0];
      const coords = f.geometry.coordinates;
      if (f.layer.id === "negocios-circulo") {
        popupNegocio(f.properties, coords);
      } else if (f.layer.id.indexOf("casa") === 0) {
        popupCasa(f.properties, coords);
      } else if (f.layer.id.indexOf("portales") === 0 || f.layer.id === "portal-obxectivo") {
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
  function esc(s) { return window.Buscador.escapar(s); }

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

  // Barra fija inferior: navegar al último punto seleccionado con un toque
  let ultimoDestino = null;
  function mostrarDestino(nombre, lat, lon) {
    ultimoDestino = { t: nombre, lat: lat, lon: lon };
    document.getElementById("bd-nombre").textContent = nombre;
    document.getElementById("bd-gmaps").href =
      "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;
    document.getElementById("bd-waze").href =
      "https://waze.com/ul?ll=" + lat + "," + lon + "&navigate=yes";
    document.getElementById("barra-destino").hidden = false;
    guardarReciente(ultimoDestino);
  }
  document.getElementById("bd-cerrar").addEventListener("click", function () {
    document.getElementById("barra-destino").hidden = true;
  });

  // Compartir el destino (enlace que abre esta app centrada en el punto)
  document.getElementById("bd-compartir").addEventListener("click", function () {
    if (!ultimoDestino) return;
    const url = location.origin + location.pathname + "?lat=" + ultimoDestino.lat +
      "&lon=" + ultimoDestino.lon + "&t=" + encodeURIComponent(ultimoDestino.t);
    const texto = "🚑 " + ultimoDestino.t + " — " + ultimoDestino.lat + ", " + ultimoDestino.lon;
    const boton = document.getElementById("bd-compartir");
    if (navigator.share) {
      navigator.share({ title: "Destino urxencias A Ulloa", text: texto, url: url })
        .catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto + "\n" + url).then(function () {
        boton.textContent = "✓";
        setTimeout(function () { boton.textContent = "📤"; }, 1500);
      }, function () { window.prompt("Copia el enlace:", url); });
    } else {
      window.prompt("Copia el enlace:", url);
    }
  });

  // Historial de últimos destinos
  function recientes() {
    try { return JSON.parse(localStorage.getItem("ulloa-recientes")) || []; }
    catch (e) { return []; }
  }
  function guardarReciente(d) {
    const r = recientes().filter(function (x) { return x.t !== d.t; });
    r.unshift({ t: d.t, lat: d.lat, lon: d.lon, ts: Date.now() });
    try { localStorage.setItem("ulloa-recientes", JSON.stringify(r.slice(0, 8))); } catch (e) {}
  }

  // Foto en popup: miniatura de Drive (sincronizada) o local (pendiente)
  function fotoHTML(p) {
    const src = p.foto
      ? "https://drive.google.com/thumbnail?id=" + p.foto + "&sz=w500"
      : (p.fotoLocal ? "data:image/jpeg;base64," + p.fotoLocal : null);
    if (!src) return "";
    const full = p.foto ? "https://drive.google.com/file/d/" + p.foto + "/view" : src;
    return '<a href="' + full + '" target="_blank" rel="noopener"><img class="pop-foto" src="' + src + '" alt="foto"></a>';
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
    const pac = (window.PAC_POR_CONCELLO || {})[p.m];
    if (pac) html += '<div class="mini">🚑 Urxencias: <b>' + esc(pac) + "</b></div>";
    html += '<div class="mini">' + lat + ", " + lon + "</div>" + botones(lat, lon) +
      Editor.botonEntidad(p);
    abrirPopup(coords, html);
    mostrarDestino(p.n + (p.p ? " (" + p.p + ")" : ""), lat, lon);
  }

  function popupPortal(p, coords) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    const html = "<h3>Nº " + p.n + "</h3><div>" + p.via + "</div>" +
      (p.cp ? "<div>CP " + p.cp + "</div>" : "") +
      (p.nota ? '<div class="aviso">📝 ' + esc(p.nota) + "</div>" : "") +
      fotoHTML(p) +
      (p.orig ? '<div class="mini">Posición corregida por el equipo</div>' : "") +
      '<div class="mini">Fuente: Catastro · ' + lat + ", " + lon + "</div>" +
      botones(lat, lon) + Editor.botonesPortal(p);
    abrirPopup(coords, html);
    mostrarDestino("Nº " + p.n + " · " + p.via, lat, lon);
  }

  function popupCasa(p, coords) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    const html = "<h3>" + (p.n ? "Nº " + p.n : "Casa") +
      ' <small>(añadida por el equipo)</small></h3>' +
      (p.lugar ? "<div>" + esc(p.lugar) + "</div>" : "") +
      (p.nota ? '<div class="aviso">📝 ' + esc(p.nota) + "</div>" : "") +
      fotoHTML(p) +
      '<div class="mini">' + lat + ", " + lon + "</div>" +
      botones(lat, lon) + Editor.botonesCasa(p);
    abrirPopup(coords, html);
    mostrarDestino((p.n ? "Nº " + p.n : "Casa") + (p.lugar ? " · " + p.lugar : ""), lat, lon);
  }

  function popupNegocio(p, coords) {
    const lat = coords[1].toFixed(5), lon = coords[0].toFixed(5);
    const g = GRUPOS[p.g] || GRUPOS.outros;
    let html = "<h3>" + g.e + " " + esc(p.n) + "</h3>" +
      "<div>" + esc(p.t) + " · " + esc(p.c) + "</div>";
    if (p.d) html += "<div>" + esc(p.d) + (p.cp ? " · CP " + esc(p.cp) : "") + "</div>";
    if (p.p) html += '<div class="mini">Parroquia: ' + esc(p.p) + "</div>";
    if (p.pl) html += '<div class="mini">🛏 ' + p.pl + " prazas</div>";
    if (p.tel) html += '<div><a class="tel" href="tel:' + esc(p.tel.replace(/\s/g, "")) + '">☎ ' + esc(p.tel) + "</a></div>";
    if (p.h) html += '<div class="mini">🕐 ' + esc(p.h) + "</div>";
    if (p.apx) html += '<div class="aviso">⚠ Posición aproximada: eje de la calle o del lugar, no el portal exacto.</div>';
    if (p.reat) html += '<div class="mini">Rexistro turístico: ' + esc(p.reat) + "</div>";
    if (p.web) html += '<div class="pop-botones"><a class="btn" target="_blank" rel="noopener" href="' + esc(p.web) + '">🌐 Web</a></div>';
    html += '<div class="mini">' + lat + ", " + lon + "</div>" + botones(lat, lon);
    abrirPopup(coords, html);
    mostrarDestino(p.n + " (" + p.c + ")", lat, lon);
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
    mostrarDestino(p.n, lat, lon);
  }

  // ---------- selección desde el buscador ----------
  function filtrarSeguro(capa, filtro) {
    if (map && map.getLayer(capa)) map.setFilter(capa, filtro);
  }
  function limpiarSeleccion() {
    filtrarSeguro("portales-via", ["==", ["get", "cv"], "__ninguna__"]);
    filtrarSeguro("portal-obxectivo", ["==", ["get", "cv"], "__ninguna__"]);
    filtrarSeguro("casa-obxectivo", ["==", ["get", "id"], "__ninguna__"]);
  }
  function normNum(n) { return (n || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }

  function seleccionarEntidad(f, num) {
    const p = f.properties, coords = f.geometry.coordinates;
    if (p.ext == 1 && !seleccionVecinos.has(p.m)) ponerVecino(p.m, true); // que se vea lo elegido
    // si el estilo aún no cargó, reaplicar cuando existan las capas
    if (map && !map.getLayer("portales-via")) {
      map.once("load", function () { seleccionarEntidad(f, num); });
    }
    limpiarSeleccion();
    if (p.cv) {
      filtrarSeguro("portales-via", ["all", ["==", ["get", "m"], p.m],
        ["==", ["get", "cv"], p.cv], ["!=", ["get", "del"], 1]]);
    }

    if (num) {
      portalesDe(p.m).then(function () {
        // 1º: casas añadidas por el equipo (por vía o por nombre del lugar)
        const nl = window.Buscador.norm(p.n);
        const casa = Array.from(window.Edicion.efectivas().altas.values()).find(function (c) {
          const mismoSitio = c.m === p.m &&
            ((p.cv && c.cv === p.cv) || window.Buscador.norm(c.lugar) === nl);
          return mismoSitio && normNum(c.numero) === normNum(num);
        });
        if (casa) {
          filtrarSeguro("casa-obxectivo", ["==", ["get", "id"], casa.id]);
          if (map) map.flyTo({ center: [casa.lon, casa.lat], zoom: 17 });
          popupCasa({ id: casa.id, n: casa.numero, lugar: casa.lugar || p.n, nota: casa.nota },
            [casa.lon, casa.lat]);
          return;
        }
        // 2º: portales del Catastro
        if (!p.cv) {
          if (map) map.flyTo({ center: coords, zoom: 15 });
          popupEntidad(p, coords, "El nº " + num + " no figura para este lugar; se muestra la aldea. Puedes añadir la casa con el modo edición ✏️.");
          return;
        }
        if (portalesEstado[p.m] !== "ok") {
          if (map) map.flyTo({ center: coords, zoom: 16 });
          popupEntidad(p, coords, "No se pudieron cargar los portales de este concello (sin conexión): se muestra la aldea.");
          return;
        }
        const objetivo = PORTALES.features.filter(function (pf) {
          return pf.properties.m === p.m && pf.properties.cv === p.cv && pf.properties.del !== 1;
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
          popupEntidad(p, coords, "El nº " + num + " no figura en el Catastro de este lugar; se muestra la aldea y sus portales. Puedes añadirlo con el modo edición ✏️.");
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

  function textoDistancia(d) {
    if (d == null) return "";
    return ' · <b>a ' + (d < 1 ? Math.round(d * 1000) + " m"
      : d.toFixed(d < 10 ? 1 : 0).replace(".", ",") + " km") + "</b>";
  }

  function pintarResultados(r) {
    const B = window.Buscador;
    const q = r.consulta ? r.consulta.texto : "";
    resultadosActuales = r.resultados;
    marcado = -1;
    if (!r.resultados.length) {
      caja.innerHTML = input.value.trim() ? '<div class="res vacio">Sin resultados. Prueba con menos letras, sin artículo (O/A) o solo el nombre del lugar.</div>' : "";
      caja.hidden = !input.value.trim();
      return;
    }
    const aviso = r.ignoradoCtx
      ? '<div class="res vacio">No encontré esa parroquia o concello: muestro por nombre de lugar.</div>' : "";
    caja.innerHTML = aviso + r.resultados.map(function (x, i) {
      const p = x.item.f.properties;
      const dist = textoDistancia(x.d);
      if (x.item.tipo === "sanidad") {
        return '<div class="res" data-i="' + i + '"><b>🏥 ' + B.resaltar(p.n, q) +
          "</b><br><small>" + B.escapar(p.dir) + dist + "</small></div>";
      }
      if (x.item.tipo === "parroquia") {
        return '<div class="res" data-i="' + i + '"><b>⛪ Parroquia de ' + B.resaltar(p.n, q) +
          "</b>" + (p.ext == 1 ? ' <span class="tag">outro concello</span>' : "") +
          '<br><small>' + B.escapar(p.c) + " · " + p.nlugares + " lugares" + dist + "</small></div>";
      }
      if (x.item.tipo === "rua") {
        return '<div class="res" data-i="' + i + '"><b>🛣 ' + B.resaltar(p.n, q) +
          "</b><br><small>" + B.escapar(p.c) + " · " + p.np + " portales" + dist + "</small></div>";
      }
      if (x.item.tipo === "poi") {
        const g = GRUPOS[p.g] || GRUPOS.outros;
        return '<div class="res" data-i="' + i + '"><b>' + g.e + " " + B.resaltar(p.n, q) +
          "</b><br><small>" + B.escapar(p.t) + " · " + B.escapar(p.c) + dist + "</small></div>";
      }
      if (x.item.tipo === "casa") {
        return '<div class="res" data-i="' + i + '"><b>🏠 ' +
          (p.n ? "Nº " + B.escapar(p.n) + " · " : "") + B.resaltar(p.lugar || "", q) +
          '</b> <span class="tag">equipo</span><br><small>' +
          (p.nota ? "📝 " + B.escapar(p.nota) : "casa añadida por el equipo") + dist + "</small></div>";
      }
      const extra = p.f === "osm-extra" ? ' <span class="tag">no oficial</span>' : "";
      const dup = p.dup == 1 ? ' <span class="tag warn">⚠ repetido</span>' : "";
      const vecino = p.ext == 1 ? ' <span class="tag">outro concello</span>' : "";
      const portais = p.np > 0 ? " · " + p.np + " portales" : "";
      return '<div class="res" data-i="' + i + '"><b>' + B.resaltar(p.n, q) + "</b>" +
        dup + vecino + extra + "<br><small>" +
        (p.p ? B.escapar(p.p) + (p.adv ? " (" + B.escapar(p.adv) + ")" : "") + " · " : "") +
        B.escapar(p.c) + (p.cp ? " · CP " + p.cp + (p.cpx ? "~" : "") : "") + portais +
        dist + "</small></div>";
    }).join("");
    caja.hidden = false;
  }

  function elegir(i) {
    const r = resultadosActuales[i];
    if (!r) return;
    caja.hidden = true;
    const c = window.Buscador.parseConsulta(input.value);
    const f = r.item.f, p = f.properties;
    if (r.item.tipo === "sanidad") {
      limpiarSeleccion();
      if (map) map.flyTo({ center: f.geometry.coordinates, zoom: 16 });
      popupSanidad(p, f.geometry.coordinates);
    } else if (r.item.tipo === "parroquia") {
      limpiarSeleccion();
      if (p.ext == 1 && !seleccionVecinos.has(p.m)) ponerVecino(p.m, true);
      if (map) {
        const b = f.bbox;
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]],
          { padding: 70, maxZoom: 14.5, duration: 800 });
      }
      mostrarDestino("Parroquia de " + p.n + " (" + p.c + ")",
        f.geometry.coordinates[1].toFixed(5), f.geometry.coordinates[0].toFixed(5));
    } else if (r.item.tipo === "poi") {
      limpiarSeleccion();
      ponerNegocios(true); // que se vea el punto elegido
      if (map) map.flyTo({ center: f.geometry.coordinates, zoom: 16.5 });
      popupNegocio(p, f.geometry.coordinates);
    } else if (r.item.tipo === "casa") {
      limpiarSeleccion();
      filtrarSeguro("casa-obxectivo", ["==", ["get", "id"], p.id]);
      if (map) map.flyTo({ center: f.geometry.coordinates, zoom: 17 });
      popupCasa(p, f.geometry.coordinates);
    } else {
      seleccionarEntidad(f, c.num);
    }
  }

  function pintarRecientes() {
    const r = recientes();
    if (!r.length) { caja.hidden = true; return; }
    resultadosActuales = [];
    marcado = -1;
    caja.innerHTML = '<div class="res vacio">Últimos destinos</div>' +
      r.map(function (x, i) {
        return '<div class="res" data-r="' + i + '">🕐 <b>' + x.t + "</b></div>";
      }).join("");
    caja.hidden = false;
  }

  input.addEventListener("input", function () {
    if (!input.value.trim()) { pintarRecientes(); return; }
    pintarResultados(window.Buscador.buscar(input.value));
  });
  input.addEventListener("focus", function () {
    if (!input.value.trim()) pintarRecientes();
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
    if (!el) return;
    if (el.dataset.r !== undefined) {
      const x = recientes()[+el.dataset.r];
      caja.hidden = true;
      if (x) {
        if (map) map.flyTo({ center: [+x.lon, +x.lat], zoom: 16 });
        mostrarDestino(x.t, x.lat, x.lon);
      }
      return;
    }
    if (el.dataset.i !== undefined) elegir(+el.dataset.i);
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
  // ---------- panel del directorio ----------
  const directorio = document.getElementById("directorio");
  const btnNegocios = document.getElementById("btn-negocios");
  const dirLista = document.getElementById("dir-lista");

  (function () {
    const chips = document.getElementById("dir-chips");
    Object.keys(GRUPOS).forEach(function (g) {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.setProperty("--cg", GRUPOS[g].c);
      b.textContent = GRUPOS[g].e + " " + GRUPOS[g].nome;
      b.classList.toggle("activo", gruposActivos.has(g));
      b.addEventListener("click", function () {
        if (gruposActivos.has(g)) gruposActivos.delete(g);
        else gruposActivos.add(g);
        b.classList.toggle("activo", gruposActivos.has(g));
        try { localStorage.setItem("ulloa-dir-grupos", JSON.stringify(Array.from(gruposActivos))); } catch (e) {}
        aplicarNegocios();
        pintarDirectorio();
      });
      chips.appendChild(b);
    });
  })();

  function pintarDirectorio() {
    if (!window.POIS) {
      dirLista.innerHTML = '<div class="mini">Cargando directorio…</div>';
      return;
    }
    const centro = map ? map.getCenter() : { lat: 42.87, lng: -7.87 };
    const cerca = window.POIS.features
      .filter(function (f) { return gruposActivos.has(f.properties.g); })
      .map(function (f) {
        const co = f.geometry.coordinates;
        const dy = (co[1] - centro.lat) * 111.32;
        const dx = (co[0] - centro.lng) * 111.32 * Math.cos(centro.lat * Math.PI / 180);
        return { f: f, d: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 40);
    dirLista.innerHTML = cerca.map(function (x, i) {
      const p = x.f.properties;
      const g = GRUPOS[p.g] || GRUPOS.outros;
      const dist = x.d < 1 ? Math.round(x.d * 1000) + " m"
        : x.d.toFixed(x.d < 10 ? 1 : 0).replace(".", ",") + " km";
      return '<div class="dir-item" data-i="' + i + '" style="--cg:' + g.c + '">' +
        "<b>" + g.e + " " + esc(p.n) + "</b><br><small>" + esc(p.t) +
        (p.pl ? " · " + p.pl + " prazas" : "") + " · " + esc(p.c) +
        " · a " + dist + (p.apx ? " ⚠" : "") + "</small>" +
        (p.d ? "<br><small>" + esc(p.d) + "</small>" : "") +
        (p.tel ? '<br><a class="tel" href="tel:' + esc(p.tel.replace(/\s/g, "")) + '">☎ ' + esc(p.tel) + "</a>" : "") +
        "</div>";
    }).join("") || '<div class="mini">Nada en las categorías marcadas.</div>';
    dirLista.__cerca = cerca;
  }
  dirLista.addEventListener("click", function (e) {
    if (e.target.tagName === "A") return;
    const el = e.target.closest(".dir-item");
    if (!el) return;
    const x = dirLista.__cerca[+el.dataset.i];
    if (!x) return;
    directorio.classList.remove("abierto");
    if (map) map.flyTo({ center: x.f.geometry.coordinates, zoom: 16.5 });
    popupNegocio(x.f.properties, x.f.geometry.coordinates);
  });

  function alternarDirectorio(abrir) {
    directorio.classList.toggle("abierto", abrir);
    if (abrir) {
      ponerNegocios(true);
      cargarNegocios().then(pintarDirectorio);
      pintarDirectorio();
    }
  }
  btnNegocios.addEventListener("click", function () {
    if (directorio.classList.contains("abierto")) {
      alternarDirectorio(false);
      ponerNegocios(false); // cerrar desde el botón apaga también la capa
    } else {
      alternarDirectorio(true);
    }
  });
  document.getElementById("dir-cerrar").addEventListener("click", function () {
    alternarDirectorio(false); // la capa queda encendida para seguir viéndola
  });
  let dirTemporizador = null;
  if (map) {
    map.on("moveend", function () {
      if (!directorio.classList.contains("abierto")) return;
      clearTimeout(dirTemporizador);
      dirTemporizador = setTimeout(pintarDirectorio, 350);
    });
  }

  // casillas de concellos veciños (una por concello + "Todos")
  (function () {
    const cont = document.getElementById("lista-vecinos");
    const ordenados = MUNIS_EXT.slice().sort(function (a, b) {
      return VECINOS_NOMES[a].localeCompare(VECINOS_NOMES[b]);
    });
    ordenados.forEach(function (m) {
      const lab = document.createElement("label");
      lab.className = "conmutador";
      lab.innerHTML = '<input type="checkbox" id="chk-v-' + m + '"><span>' +
        VECINOS_NOMES[m] + "</span>";
      lab.querySelector("input").addEventListener("change", function (e) {
        ponerVecino(m, e.target.checked);
      });
      cont.appendChild(lab);
    });
    const todos = document.getElementById("chk-vecinos-todos");
    todos.addEventListener("change", function () {
      MUNIS_EXT.forEach(function (m) {
        if (todos.checked) { seleccionVecinos.add(m); cargarMuni(m); }
        else seleccionVecinos.delete(m);
      });
      guardarSeleccion();
      aplicarVecinos();
    });
    aplicarVecinos(); // estado inicial de las casillas
  })();

  const listaSan = document.getElementById("lista-sanidad");
  const ORDEN_TIPO = { pac: 0, hospital: 1, cs: 2 };
  function pintarSanidad() {
    const c = map ? map.getCenter() : { lat: 42.87, lng: -7.87 };
    listaSan.innerHTML = "";
    window.SANIDAD.features.slice()
      .map(function (f) {
        const co = f.geometry.coordinates;
        const dy = (co[1] - c.lat) * 111.32;
        const dx = (co[0] - c.lng) * 111.32 * Math.cos(c.lat * Math.PI / 180);
        return { f: f, d: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort(function (a, b) {
        const t = ORDEN_TIPO[a.f.properties.tipo] - ORDEN_TIPO[b.f.properties.tipo];
        return t || a.d - b.d;   // primero los PAC, luego hospitales y centros
      })
      .forEach(function (x) {
        const p = x.f.properties;
        const div = document.createElement("div");
        div.className = "san-item san-" + p.tipo;
        const dist = x.d < 1 ? Math.round(x.d * 1000) + " m"
          : x.d.toFixed(x.d < 10 ? 1 : 0).replace(".", ",") + " km";
        div.innerHTML = "<b>" + esc(p.n) + "</b> <small>· a " + dist + "</small><br><small>" +
          esc(p.dir) + "</small><br>" +
          (p.tel || []).map(function (t) {
            return '<a class="tel" href="tel:+34' + t.replace(/\s/g, "") + '">☎ ' + t + "</a> ";
          }).join("");
        div.addEventListener("click", function (e) {
          if (e.target.tagName === "A") return;
          alternarPanel(false);
          limpiarSeleccion();
          if (map) map.flyTo({ center: x.f.geometry.coordinates, zoom: 16 });
          popupSanidad(p, x.f.geometry.coordinates);
        });
        listaSan.appendChild(div);
      });
  }
  pintarSanidad();
  if (map) {
    let tSan = null;
    map.on("moveend", function () {
      if (!panel.classList.contains("abierto")) return;
      clearTimeout(tSan);
      tSan = setTimeout(pintarSanidad, 350);
    });
  }

  // ---------- edición colaborativa ----------
  function refrescarEdiciones() {
    window.Edicion.aplicarAPortales(PORTALES);
    window.Buscador.reindexar(); // las casas y notas del equipo también se buscan
    if (map) {
      const sp = map.getSource("portales");
      if (sp) sp.setData(PORTALES);
      const sc = map.getSource("casas");
      if (sc) sc.setData(window.Edicion.fcCasas());
    }
  }
  window.Edicion.alCambio(refrescarEdiciones);
  window.Edicion.refrescarRemoto();
  window.Edicion.avisar();
  window.Edicion.alPinIncorrecto = function () {
    window.alert("PIN incorrecto: se te pedirá de nuevo al usar el modo edición.");
  };

  const Editor = (function () {
    let activo = false;
    let moviendo = null;   // objetivo (portal o casa) esperando nueva posición
    let preset = null;     // alta prefijada desde el popup de una aldea
    const btn = document.getElementById("btn-editar");
    const bannerModo = document.getElementById("banner-modo");
    const form = document.getElementById("form-casa");
    const fNumero = document.getElementById("f-numero");
    const fLugar = document.getElementById("f-lugar");
    const fNota = document.getElementById("f-nota");
    const fTitulo = document.getElementById("f-titulo");
    let formCtx = null;

    const dl = document.getElementById("lista-lugares");
    window.ENTIDADES.features.forEach(function (f) {
      const o = document.createElement("option");
      o.value = f.properties.n + (f.properties.p ? " (" + f.properties.p + ")" : "");
      dl.appendChild(o);
    });

    function mensaje(txt) {
      bannerModo.textContent = txt || "";
      bannerModo.hidden = !txt;
    }

    function alternar() {
      if (!activo && window.Edicion.conServidor && !window.Edicion.hayPin()) {
        const pin = window.prompt("PIN de edición del equipo:");
        if (!pin) return;
        window.Edicion.ponPin(pin.trim());
        window.Edicion.sincronizar();
      }
      activo = !activo;
      btn.classList.toggle("activo", activo);
      moviendo = null;
      preset = null;
      mensaje(activo ? "✏️ Modo edición: toca el mapa donde esté la casa para añadirla, o toca un punto existente para corregirlo" : "");
      if (!activo) { form.hidden = true; formCtx = null; }
    }
    btn.addEventListener("click", alternar);

    function entidadCercana(lngLat) {
      let mejor = null, mejorD = 1.2; // km
      window.ENTIDADES.features.forEach(function (f) {
        const c = f.geometry.coordinates;
        const d = Math.hypot((c[1] - lngLat.lat) * 111,
          (c[0] - lngLat.lng) * 111 * Math.cos(lngLat.lat * Math.PI / 180));
        if (d < mejorD) { mejorD = d; mejor = f.properties; }
      });
      return mejor;
    }

    const fFoto = document.getElementById("f-foto");
    const fFotoPrev = document.getElementById("f-foto-prev");
    fFoto.addEventListener("change", function () {
      const archivo = fFoto.files && fFoto.files[0];
      if (!archivo) {
        if (formCtx) formCtx.imagenB64 = null;
        fFotoPrev.hidden = true;
        return;
      }
      const lector = new FileReader();
      lector.onload = function () {
        const img = new Image();
        img.onload = function () {
          // comprimir a máx 1280 px / JPEG 0.72 para que quepa en la cola offline
          const MAX = 1280;
          const esc = Math.min(1, MAX / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * esc);
          c.height = Math.round(img.height * esc);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL("image/jpeg", 0.72);
          if (formCtx) formCtx.imagenB64 = dataUrl.split(",")[1];
          fFotoPrev.src = dataUrl;
          fFotoPrev.hidden = false;
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });

    function prepararForm(modo) {
      fFoto.value = "";
      fFotoPrev.hidden = true;
      document.getElementById("l-numero").style.display = modo === "nota" ? "none" : "";
      document.getElementById("l-lugar").style.display = modo === "nota" ? "none" : "";
    }

    function abrirForm(lngLat, pre, editando) {
      const cerca = pre || entidadCercana(lngLat) || {};
      formCtx = {
        lon: +(+lngLat.lng).toFixed(6), lat: +(+lngLat.lat).toFixed(6),
        m: cerca.m || "", cv: cerca.cv || "",
        editandoId: editando ? editando.id : null,
        imagenB64: null,
      };
      prepararForm("casa");
      fTitulo.textContent = editando ? "Editar casa" : "Añadir casa";
      fNumero.value = editando ? (editando.n || "") : "";
      fLugar.value = editando ? (editando.lugar || "") : (cerca.n || "");
      fNota.value = editando ? (editando.nota || "") : "";
      form.hidden = false;
      fNumero.focus();
    }

    function abrirFormNota(objetivo) {
      formCtx = { modo: "nota", objetivo: objetivo, imagenB64: null };
      prepararForm("nota");
      fTitulo.textContent = "Nota y foto";
      fNota.value = "";
      form.hidden = false;
      fNota.focus();
    }

    document.getElementById("f-guardar").addEventListener("click", function () {
      if (!formCtx) return;
      if (formCtx.modo === "nota") {
        window.Edicion.registrar({
          accion: "nota", objetivo: formCtx.objetivo,
          nota: fNota.value.trim(), imagenB64: formCtx.imagenB64 || undefined,
        });
      } else if (formCtx.editandoId) {
        window.Edicion.registrar({
          accion: "editar", objetivo: formCtx.editandoId,
          numero: fNumero.value.trim().toUpperCase(), nota: fNota.value.trim(),
          imagenB64: formCtx.imagenB64 || undefined,
        });
      } else {
        window.Edicion.registrar({
          accion: "alta", m: formCtx.m, cv: formCtx.cv,
          lugar: fLugar.value.replace(/\s*\(.*\)$/, "").trim(),
          numero: fNumero.value.trim().toUpperCase(), nota: fNota.value.trim(),
          lon: formCtx.lon, lat: formCtx.lat,
          imagenB64: formCtx.imagenB64 || undefined,
        });
      }
      form.hidden = true;
      formCtx = null;
      mensaje("✏️ Guardado. Sigues en modo edición.");
    });
    document.getElementById("f-cancelar").addEventListener("click", function () {
      form.hidden = true;
      formCtx = null;
    });

    return {
      interceptarClick: function (e) {
        if (moviendo) {
          window.Edicion.registrar({
            accion: "mover", objetivo: moviendo,
            lon: +e.lngLat.lng.toFixed(6), lat: +e.lngLat.lat.toFixed(6),
          });
          moviendo = null;
          mensaje("✏️ Posición corregida.");
          return true;
        }
        if (preset) {
          abrirForm(e.lngLat, preset, null);
          preset = null;
          mensaje("");
          return true;
        }
        return false;
      },
      clickVacio: function (e) {
        if (activo && form.hidden) abrirForm(e.lngLat, null, null);
      },
      botonesPortal: function (p) {
        if (!activo) return "";
        const k = p.m + "|" + p.cv + "|" + p.n;
        return '<div class="pop-botones">' +
          '<button class="btn verde" onclick="AppUlloa.edMover(\'' + k + '\')">📍 Mover</button>' +
          '<button class="btn verde" onclick="AppUlloa.edNota(\'' + k + '\')">📝 Nota</button>' +
          '<button class="btn rojo" onclick="AppUlloa.edBaja(\'' + k + '\')">🗑 No existe</button></div>';
      },
      botonesCasa: function (p) {
        if (!activo) return "";
        return '<div class="pop-botones">' +
          '<button class="btn verde" onclick="AppUlloa.edMover(\'' + p.id + '\')">📍 Mover</button>' +
          '<button class="btn verde" onclick="AppUlloa.edEditar(\'' + p.id + '\')">✏️ Editar</button>' +
          '<button class="btn rojo" onclick="AppUlloa.edBaja(\'' + p.id + '\')">🗑 Borrar</button></div>';
      },
      botonEntidad: function (p) {
        if (!activo) return "";
        return '<div class="pop-botones">' +
          '<button class="btn verde" onclick="AppUlloa.edAltaEn(\'' + p.m + "','" + (p.cv || "") + "','" +
          String(p.n).replace(/'/g, "") + '\')">➕ Añadir casa en este lugar</button></div>';
      },
      mover: function (objetivo) {
        moviendo = objetivo;
        if (popup) popup.remove();
        mensaje("📍 Toca el mapa en la posición correcta");
      },
      nota: function (objetivo) {
        if (popup) popup.remove();
        abrirFormNota(objetivo);
      },
      baja: function (objetivo) {
        if (!window.confirm("¿Marcar como inexistente / borrar?")) return;
        window.Edicion.registrar({ accion: "baja", objetivo: objetivo });
        if (popup) popup.remove();
      },
      editar: function (id) {
        const c = window.Edicion.efectivas().altas.get(id);
        if (!c) return;
        if (popup) popup.remove();
        abrirForm({ lng: c.lon, lat: c.lat }, { m: c.m, cv: c.cv, n: c.lugar },
          { id: id, n: c.numero, lugar: c.lugar, nota: c.nota });
      },
      altaEn: function (m, cv, lugar) {
        if (!activo) alternar();
        preset = { m: m, cv: cv, n: lugar };
        if (popup) popup.remove();
        mensaje("➕ Toca el mapa en la posición exacta de la casa (" + lugar + ")");
      },
    };
  })();

  // ---------- enlaces profundos: ?q=lestedo 14 · ?lat&lon&t (compartidos) ----------
  (function () {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const lat = parseFloat(params.get("lat"));
    const lon = parseFloat(params.get("lon"));
    if (q) {
      input.value = q;
      portalesListos.then(function () {
        setTimeout(function () {
          const r = window.Buscador.buscar(q);
          pintarResultados(r);
          if (r.resultados.length) elegir(0);
        }, 500);
      });
    } else if (isFinite(lat) && isFinite(lon)) {
      const t = params.get("t") || lat.toFixed(5) + ", " + lon.toFixed(5);
      if (map) {
        map.jumpTo({ center: [lon, lat], zoom: 16.5 });
        new maplibregl.Marker({ color: "#dc2626" }).setLngLat([lon, lat]).addTo(map);
      }
      mostrarDestino(t, lat.toFixed(6), lon.toFixed(6));
    }
  })();

  window.AppUlloa = {
    copiar: copiar, verVia: verVia, map: map,
    edMover: Editor.mover, edNota: Editor.nota, edBaja: Editor.baja,
    edEditar: Editor.editar, edAltaEn: Editor.altaEn,
  };
})();
