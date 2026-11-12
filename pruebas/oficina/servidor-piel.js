// Servidor de prueba para la piel 3D: sirve la Oficina tal cual (index.html + piel.js) y contesta las APIs
// con la API real (api/oficina.js) sobre una base falsa. Uso: DATOS=/ruta/datos.json node servidor-piel.js
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const base = require(RAIZ + '/api/_base.js');
const datos = JSON.parse(fs.readFileSync(process.env.DATOS || (__dirname + '/crudo.json'), 'utf8'));
const TOKEN = 'T'.repeat(43);
require.cache[require.resolve(RAIZ + '/api/_base.js')].exports = Object.assign({}, base, {
  sql: async (q, p) => {
    if (q.includes('FROM sesiones')) return [{ usuario: 'kid', nombre: 'Kid', tipo: 'socio', activo: 1 }];
    if (q.includes('FROM oficina')) return Object.entries(datos).map(([clave, v]) => ({ clave, valor: JSON.stringify(v) }));
    if (q.includes('COUNT(*)')) return [{ n: 3, u: 41000 }];
    if (q.includes('FROM libreria')) return [{ titulo: 'MOON', texto: 'prueba' }];
    return [];
  },
});
const api = require(RAIZ + '/api/oficina.js');
const ahora = Date.now();
const C = {
  ok: true,
  personas: Array.from({ length: 20 }, (_, i) => ({ tel: '55000000' + String(i).padStart(2, '0'), nombre: 'Persona ' + i, etapa: 'pendiente' })),
  llamadas: [{ fecha: new Date(ahora - 40 * 60e3).toISOString(), quien: '5500000001', resumen: 'Preguntó por un recepcionista para su clínica', datos: '{"nombre":"Santi","negocio":"Clínica Sonrisa"}', prueba: 0 }],
  documentos: [], paneles: [], proyectos: [],
};
http.createServer((q, r) => {
  let b = ''; q.on('data', c => b += c); q.on('end', () => {
    const u = q.url.split('?')[0];
    if (u === '/api/oficina') {
      const res = { statusCode: 200, setHeader() {}, end(s) { r.setHeader('content-type', 'application/json'); r.end(s); } };
      return api({ method: 'POST', headers: { 'x-sesion': TOKEN }, body: JSON.parse(b || '{}') }, res);
    }
    if (u === '/api/centro') {
      const d = JSON.parse(b || '{}'); r.setHeader('content-type', 'application/json');
      if (d.accion === 'quienes') return r.end(JSON.stringify({ ok: true, usuarios: [{ id: 'daniel' }, { id: 'dan' }, { id: 'kid' }] }));
      if (d.accion === 'entrar') return r.end(JSON.stringify({ ok: true, sesion: TOKEN }));
      return r.end(JSON.stringify(C));
    }
    const f = u === '/oficina' ? '/oficina/index.html' : u;
    const ruta = path.join(RAIZ, f);
    if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { r.statusCode = 404; return r.end(); }
    r.setHeader('content-type', ruta.endsWith('.js') ? 'text/javascript' : ruta.endsWith('.webp') ? 'image/webp' : ruta.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
    r.end(fs.readFileSync(ruta));
  });
}).listen(process.env.PUERTO || 8822);
