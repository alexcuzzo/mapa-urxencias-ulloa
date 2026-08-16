// Recursos sanitarios de los 19 concellos — verificado contra el Sergas
// (buscador de centros, consulta de PAC y Guía de Servizos de Tarxeta
// Sanitaria) en agosto de 2026. Coordenadas contrastadas con OSM.
// "cob" = concellos (código INE) cuyas urgencias cubre ese PAC.
window.SANIDAD = {
  "type": "FeatureCollection",
  "features": [
    // ---------------- PAC (urgencias fuera de horario) ----------------
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.86037, 42.87454] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC Palas de Rei",
        "dir": "Avda. de Lugo s/n (esquina R/ Bernardino Pardo Ouro), 27200 Palas de Rei",
        "tel": ["982 374 132"], "cob": ["27040", "27032", "27003"],
        "nota": "PAC da Ulloa: urgencias 24h/365 de Palas de Rei, Monterroso y Antas de Ulla. Base de ambulancia 061 en Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.41013, 42.77706] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC de Sarria",
        "dir": "Rúa Calvo Sotelo 136-138, 27600 Sarria",
        "tel": ["982 530 958", "982 532 111"], "cob": ["27057", "27055", "27062"],
        "nota": "Cubre Sarria, Samos, Triacastela y Paradela. L-V 15:00-08:00; sábados, domingos y festivos 24h."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.69894, 42.88569] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC de Guntín",
        "dir": "Avenida Grupo Escolar s/n, 27211 Guntín",
        "tel": ["982 320 023", "982 320 040"], "cob": ["27023", "27060", "27049"],
        "nota": "Cubre Guntín, Taboada y Portomarín (ninguno de los dos últimos tiene PAC propio). ⚠ Para Portomarín el Sergas lista también el PAC de Becerreá: confirmar por teléfono."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.01595, 42.90661] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC de Melide",
        "dir": "Rúa Ourense 35 / Doutor Fleming s/n, 15800 Melide",
        "tel": ["881 546 244", "981 506 176"], "cob": ["15046", "15083", "15079"],
        "nota": "PAC Melide-Toques-Santiso: cubre los tres concellos."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.160188, 42.927776] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC de Arzúa",
        "dir": "Rúa Padre Pardo s/n, 15810 Arzúa",
        "tel": ["981 501 317", "981 500 450"], "cob": ["15006"],
        "nota": "Cubre Arzúa y Boimorto. NO cubre O Pino (ese va a Santiago)."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.565741, 42.869185] },
      "properties": {
        "tipo": "pac", "n": "PAC de Santiago de Compostela",
        "dir": "Recinto del Hospital Clínico, Rúa da Choupana s/n, 15706 Santiago",
        "tel": ["981 956 174"], "cob": ["15078", "15066"],
        "nota": "Cubre Santiago (sus 5 centros de salud), O PINO y Touro. L-V 15:00-08:00; fines de semana y festivos 24h. Está dentro del recinto del Clínico, no en un centro de salud."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.025222, 42.72715] },
      "properties": {
        "tipo": "pac", "n": "Punto de atención de Pedrafita (PAC Becerreá)",
        "dir": "Rúa Centro Médico s/n, 27670 Pedrafita do Cebreiro",
        "tel": ["982 367 201"], "cob": ["27045"],
        "nota": "Punto del PAC de Becerreá situado en el propio Pedrafita (Sergas: 'PAC BECERREA_CENTRO SAUDE PEDRAFITA'). Horario y dotación sin verificar."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.160138, 42.849293] },
      "properties": {
        "tipo": "pac", "n": "CS + PAC de Becerreá",
        "dir": "Rúa Anovello s/n, 27640 Becerreá",
        "tel": ["982 360 305"], "cob": ["27045"],
        "nota": "PAC de referencia de Pedrafita do Cebreiro (también Cervantes, Navia de Suarna y As Nogais)."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.56913, 43.01178] },
      "properties": {
        "tipo": "pac", "n": "PAC de Lugo (CIS)",
        "dir": "Centro Integral de Saúde, Rúa Saúde s/n, Lugo",
        "tel": ["982 149 900"], "cob": ["27020"],
        "nota": "PAC de referencia de FRIOL. Desde 11/2023 concentra todas las urgencias extrahospitalarias de Lugo; alberga también la base del 061."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.113058, 42.651881] },
      "properties": {
        "tipo": "pac", "n": "PAC de Lalín (CIS)",
        "dir": "CIS de Lalín, Alto de Vales, 36500 Lalín",
        "tel": ["986 787 138"], "cob": ["36020", "36047"],
        "nota": "PAC de referencia de AGOLADA y RODEIRO. Nuevo CIS desde 10/2024 (el Sergas aún publica la dirección antigua; posición tomada de OSM)."
      }
    },

    // ---------------- Hospitales ----------------
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.53323, 43.02057] },
      "properties": {
        "tipo": "hospital", "n": "HULA — Hospital Universitario Lucus Augusti",
        "dir": "Rúa Doutor Ulises Romero 1, 27003 Lugo",
        "tel": ["982 296 000", "982 295 475"],
        "nota": "Hospital de referencia del Área de Lugo, A Mariña e Monforte. Urgencias 24h."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.565873, 42.869839] },
      "properties": {
        "tipo": "hospital", "n": "CHUS — Hospital Clínico Universitario de Santiago",
        "dir": "Rúa da Choupana s/n, 15706 Santiago de Compostela",
        "tel": ["981 950 000"],
        "nota": "Sede principal del CHUS y ÚNICA del complejo con urgencias 24h. No hay teléfono público diferenciado de urgencias."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.519349, 42.527313] },
      "properties": {
        "tipo": "hospital", "n": "Hospital Público de Monforte de Lemos",
        "dir": "Rúa da Corredoira s/n, 27400 Monforte de Lemos",
        "tel": ["982 417 900"],
        "nota": "Hospital comarcal con urgencias 24h (Área de Lugo, A Mariña e Monforte)."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.564297, 42.868749] },
      "properties": {
        "tipo": "hospital", "n": "Hospital Gil Casares (CHUS)",
        "dir": "Travesa da Choupana s/n, 15706 Santiago de Compostela",
        "tel": ["981 950 000"],
        "nota": "Sede del CHUS: consultas y hospitalización. SIN urgencias propias."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.551787, 42.859835] },
      "properties": {
        "tipo": "hospital", "n": "Hospital Provincial de Conxo (CHUS)",
        "dir": "Rúa de Ramón Baltar s/n, 15706 Santiago de Compostela",
        "tel": ["981 951 500"],
        "nota": "Sede del CHUS, SIN urgencias generales. (OSM da 981 951 900; discrepancia sin resolver.)"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.556326, 42.862351] },
      "properties": {
        "tipo": "hospital", "n": "Hospital Psiquiátrico de Conxo (CHUS)",
        "dir": "Praza de Martín Herrera 2, 15706 Santiago de Compostela",
        "tel": ["981 951 900"],
        "nota": "Sede del CHUS, psiquiatría. Sin urgencias generales."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.56191, 43.01158] },
      "properties": {
        "tipo": "hospital", "n": "Hospital Quirónsalud Lugo",
        "dir": "Rúa Montevideo 23, 27001 Lugo",
        "tel": ["982 298 404", "982 284 040"],
        "nota": "Privado. Urgencias 24h y recepción."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.546384, 42.871758] },
      "properties": {
        "tipo": "hospital", "n": "Hospital HM Rosaleda",
        "dir": "Rúa de Santiago León de Caracas 1, 15701 Santiago de Compostela",
        "tel": ["981 551 200"],
        "nota": "Privado. Datos tomados de OSM, sin verificar en fuente oficial."
      }
    },

    // ---------------- Centros de saúde ----------------
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.83712, 42.79229] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Monterroso",
        "dir": "Rúa Concepción Arenal s/n, 27560 Monterroso",
        "tel": ["982 377 759", "982 371 765"],
        "nota": "Urgencias → PAC de Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.88842, 42.78238] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Antas de Ulla",
        "dir": "Praza das Tendas s/n, 27570 Antas de Ulla",
        "tel": ["982 379 300", "982 379 950"],
        "nota": "Urgencias → PAC de Palas de Rei."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.789238, 43.029793] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Friol",
        "dir": "Avenida de Lugo s/n, 27220 Friol",
        "tel": ["982 371 005", "982 371 098"],
        "nota": "Urgencias → PAC de Lugo (CIS), no hay PAC en el concello."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.615506, 42.809051] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Portomarín",
        "dir": "Rúa Lugo 5, 27170 Portomarín",
        "tel": ["982 545 113", "982 536 833"],
        "nota": "Urgencias → PAC de Guntín (⚠ el Sergas lista también Becerreá: confirmar)."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.759961, 42.716133] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Taboada",
        "dir": "Rúa Insuas 25, 27550 Taboada",
        "tel": ["982 465 187", "982 459 038"],
        "nota": "Urgencias → PAC de Guntín (no Chantada)."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.326473, 42.730505] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Samos",
        "dir": "Praza do Concello s/n, 27620 Samos",
        "tel": ["982 546 178", "982 536 834"],
        "nota": "Urgencias → PAC de Sarria."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.23944, 42.758522] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Triacastela",
        "dir": "Estrada de Santalla s/n, 27630 Triacastela",
        "tel": ["982 548 018", "982 536 835"],
        "nota": "Urgencias → PAC de Sarria."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.025222, 42.72715] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Pedrafita do Cebreiro",
        "dir": "Rúa Centro Médico s/n, 27670 Pedrafita do Cebreiro",
        "tel": ["982 367 201"],
        "nota": "Urgencias → PAC de Becerreá, con punto de atención en este mismo edificio."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.362607, 42.908066] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde do Pino",
        "dir": "Lugar Pedrouzo-Arca s/n, 15821 O Pino",
        "tel": ["981 511 196", "981 814 392"],
        "nota": "Urgencias → PAC de SANTIAGO (no Arzúa). O Pedrouzo es la última etapa antes de Compostela."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.97622, 42.963827] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Toques",
        "dir": "Lugar Ponte Queimadas s/n, 15806 Toques",
        "tel": ["981 507 301", "981 504 906"],
        "nota": "Urgencias → PAC de Melide."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.040619, 42.845024] },
      "properties": {
        "tipo": "cs", "n": "Consultorio de Arcediago (Santiso)",
        "dir": "Lugar Agro do Chao s/n, 15808 Santiso",
        "tel": ["981 517 803"],
        "nota": "Santiso NO tiene centro de saúde, solo dos consultorios. Urgencias → PAC de Melide."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.099758, 42.8743] },
      "properties": {
        "tipo": "cs", "n": "Consultorio de Visantoña (Santiso)",
        "dir": "Lugar Visantoña s/n, 15808 Santiso",
        "tel": ["981 510 749"],
        "nota": "Segundo consultorio de Santiso. Urgencias → PAC de Melide."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.023289, 42.76165] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Agolada",
        "dir": "Avenida Irida s/n, 36520 Agolada",
        "tel": ["986 788 027"],
        "nota": "Urgencias → PAC de Lalín."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-7.947165, 42.649113] },
      "properties": {
        "tipo": "cs", "n": "Centro de Saúde de Rodeiro",
        "dir": "Lugar A Raña s/n, 36530 Rodeiro",
        "tel": ["986 790 007", "986 791 967"],
        "nota": "Urgencias → PAC de Lalín."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.54628, 42.870884] },
      "properties": {
        "tipo": "cs", "n": "CS Concepción Arenal (Santiago)",
        "dir": "Rúa de Santiago León de Caracas 12, 15701 Santiago de Compostela",
        "tel": ["981 527 000", "981 527 002"],
        "nota": "Urgencias → PAC de Santiago."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.555432, 42.86229] },
      "properties": {
        "tipo": "cs", "n": "CS de Conxo (Santiago)",
        "dir": "Rúa de Ramón Baltar s/n, 15706 Santiago de Compostela",
        "tel": ["981 956 140", "981 956 141"],
        "nota": "Urgencias → PAC de Santiago."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.532494, 42.881849] },
      "properties": {
        "tipo": "cs", "n": "CS das Fontiñas (Santiago)",
        "dir": "Rúa de Londres 2-4, 15707 Santiago de Compostela",
        "tel": ["981 577 670", "981 552 914"],
        "nota": "Urgencias → PAC de Santiago."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.546881, 42.883495] },
      "properties": {
        "tipo": "cs", "n": "CS das Galeras (Santiago)",
        "dir": "Rúa de Entrerríos 3, 15705 Santiago de Compostela",
        "tel": ["981 956 507", "881 540 380"],
        "nota": "Urgencias → PAC de Santiago."
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-8.540013, 42.892014] },
      "properties": {
        "tipo": "cs", "n": "CS de Vite (Santiago)",
        "dir": "Rúa de Carlos Maside s/n, 15704 Santiago de Compostela",
        "tel": ["981 564 455"],
        "nota": "Urgencias → PAC de Santiago."
      }
    }
  ]
};

// Concello (código INE) -> PAC de referencia, para las fichas de cada lugar.
window.PAC_POR_CONCELLO = {
  "27040": "PAC de Palas de Rei (24h)", "27032": "PAC de Palas de Rei (24h)",
  "27003": "PAC de Palas de Rei (24h)",
  "27057": "PAC de Sarria", "27055": "PAC de Sarria", "27062": "PAC de Sarria",
  "27023": "PAC de Guntín", "27060": "PAC de Guntín",
  "27049": "PAC de Guntín (⚠ confirmar: el Sergas lista también Becerreá)",
  "27045": "PAC de Becerreá, con punto en Pedrafita",
  "27020": "PAC de Lugo (CIS)",
  "15046": "PAC de Melide", "15083": "PAC de Melide", "15079": "PAC de Melide",
  "15006": "PAC de Arzúa",
  "15078": "PAC de Santiago", "15066": "PAC de Santiago",
  "36020": "PAC de Lalín", "36047": "PAC de Lalín"
};
