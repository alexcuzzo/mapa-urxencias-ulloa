// Recursos sanitarios — coordenadas de OSM, datos verificados contra Sergas (08/2026).
window.SANIDAD = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.86037, 42.87454] },
      "properties": {
        "tipo": "pac",
        "n": "CS + PAC Palas de Rei",
        "dir": "Avda. de Lugo s/n (esquina R/ Bernardino Pardo Ouro), 27200 Palas de Rei",
        "tel": ["982 374 132"],
        "nota": "PAC da Ulloa: urgencias 24h/365 de Palas de Rei, Monterroso y Antas de Ulla (confirmado Sergas 08/2026). Base de ambulancia 061 en Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.83712, 42.79229] },
      "properties": {
        "tipo": "cs",
        "n": "Centro de Saúde de Monterroso",
        "dir": "Rúa Concepción Arenal s/n, 27560 Monterroso",
        "tel": ["982 377 759", "982 371 765"],
        "nota": "Sin PAC propio: fuera de horario, PAC de Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.88842, 42.78238] },
      "properties": {
        "tipo": "cs",
        "n": "Centro de Saúde de Antas de Ulla",
        "dir": "Praza das Tendas s/n, 27570 Antas de Ulla",
        "tel": ["982 379 300", "982 379 950"],
        "nota": "Sin PAC propio: fuera de horario, PAC de Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.53323, 43.02057] },
      "properties": {
        "tipo": "hospital",
        "n": "HULA — Hospital Universitario Lucus Augusti",
        "dir": "Rúa Doutor Ulises Romero 1, 27003 Lugo",
        "tel": ["982 296 000", "982 295 475"],
        "nota": "Hospital de referencia del área (~37-45 km por N-547 / A-54). Centralita e información."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.56191, 43.01158] },
      "properties": {
        "tipo": "hospital",
        "n": "Hospital Quirónsalud Lugo",
        "dir": "Rúa Montevideo 23, 27001 Lugo",
        "tel": ["982 298 404", "982 284 040"],
        "nota": "Hospital privado. Urgencias 24h y recepción."
      }
    }
  ]
};
