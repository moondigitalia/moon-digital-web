// Servidor de prueba de la calculadora y la presentación (26-oct-2026). Sin base real: la marca sale de aquí.
// /calculadora/<codigo> y /presentacion/<codigo> igual que en Vercel. Códigos de prueba: "taller" (logo claro), "amarillo" (color muy claro), "largo" (nombres largos).
const http = require('http'), fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '../..'), PUERTO = +process.env.PUERTO || 8781;
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'logo-prueba.png')).toString('base64');
const MARCAS = {
  taller: { negocio: 'Plomería Hernández', responsable: 'Don Jorge', logo, color: '#c0392b', color2: '#1d2a44' },
  amarillo: { negocio: 'Electricidad Solar del Caribe', responsable: 'Mariana', logo: '', color: '#ffd400', color2: '' },
  largo: { negocio: 'Taller Mecánico y Refaccionaria El Güero de Cancún', responsable: 'Licenciada María Fernanda Contreras', logo, color: '#2f9e5a', color2: '' },
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/api/prueba') {
    let b = ''; q.on('data', c => b += c);
    q.on('end', () => { const d = JSON.parse(b || '{}'); const m = MARCAS[d.codigo]; r.setHeader('Content-Type', 'application/json');
      r.end(JSON.stringify(d.accion === 'datos' ? (m ? { ok: true, agente: 'agente-de-prueba', voz_id: 'x', demo: { negocio: m.negocio, giro: 'Negocio de prueba', asistente: 'Sofía', voz: 'mujer', puerta: 'dan' } } : { ok: false, error: 'no_existe' }) : m ? { ok: true, marca: Object.assign({ demo: 'https://moondigitalia.com/prueba/' + d.codigo }, m) } : { ok: false, error: 'no_existe' })); });
    return;
  }
  let f = u;
  if (/^\/(calculadora|presentacion)(\/[a-z0-9-]+)?\/?$/.test(u)) f = '/' + u.split('/')[1] + '/index.html';
  if (/^\/prueba\/(?!nueva)[a-z0-9-]+\/?$/.test(u)) f = '/prueba/index.html';
  const ruta = path.join(R, f);
  if (!ruta.startsWith(R) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { r.statusCode = 404; r.end('no'); return; }
  r.setHeader('Content-Type', TIPOS[path.extname(ruta)] || 'application/octet-stream');
  r.end(fs.readFileSync(ruta));
}).listen(PUERTO, () => console.log('material en http://localhost:' + PUERTO));
