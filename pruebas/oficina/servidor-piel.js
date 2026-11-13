// La piel 3D se prueba dentro del Tablero (su pantalla de inicio), con la API real de la Oficina sobre una base falsa.
// Uso: DATOS=/ruta/datos.json node servidor-piel.js
process.env.PUERTO = process.env.PUERTO || 8822;
process.env.DATOS = process.env.DATOS || (__dirname + '/crudo.json');
require('../centro/servidor.js');
