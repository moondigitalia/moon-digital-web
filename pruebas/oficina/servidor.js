// La Oficina ya es la pantalla de inicio del Tablero (13-nov-2026): se prueba con el servidor de prueba del Tablero
// (datos de muestra completos) y la Oficina con oficina.json.
process.env.PUERTO = process.env.PUERTO || 8811;
require('../centro/servidor.js');
