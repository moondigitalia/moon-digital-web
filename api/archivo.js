// ARCHIVOS DE MOON DIGITAL (13-oct-2026). Sirve audios (por ejemplo el resumen de la junta) guardados en la base
// moon-cuestionarios (Cloudflare D1), tabla "archivos", partidos en pedazos. Solo lectura: GET /api/archivo?id=<id>.
// Soporta "Range" porque el iPhone lo necesita para reproducir audio.
// Usa las variables propias de MOON: CF_ACCOUNT_ID y CF_D1_TOKEN.
const BASE = '815fc6e5-71ed-4f8c-b7e2-4e66615e8688'; // moon-cuestionarios
const NOMBRE = /^[a-z0-9-]{1,60}$/;
const TIPOS = { mp3: 'audio/mpeg' };
const cache = new Map();

async function leer(id) {
  if (cache.has(id)) return cache.get(id);
  const { CF_ACCOUNT_ID, CF_D1_TOKEN } = process.env;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${BASE}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_D1_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: 'SELECT parte, total, datos FROM archivos WHERE id = ? ORDER BY parte', params: [id] }),
  });
  if (!r.ok) throw new Error('cloudflare ' + r.status);
  const filas = ((await r.json()).result || [])[0]?.results || [];
  if (!filas.length || filas.length !== filas[0].total) return null;
  const buf = Buffer.concat(filas.map(f => Buffer.from(f.datos, 'base64')));
  cache.set(id, buf);
  return buf;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).end(); return; }
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id') || '';
  if (!NOMBRE.test(id)) { res.status(400).end(); return; }
  let buf;
  try { buf = await leer(id); } catch (e) { res.status(502).end(); return; }
  if (!buf) { res.status(404).end(); return; }
  const tipo = TIPOS[id.split('-').pop()] || 'application/octet-stream';
  res.setHeader('Content-Type', tipo);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (rango) {
    let ini = rango[1] === '' ? buf.length - Number(rango[2]) : Number(rango[1]);
    let fin = rango[1] !== '' && rango[2] !== '' ? Number(rango[2]) : buf.length - 1;
    if (ini < 0) ini = 0;
    if (fin >= buf.length) fin = buf.length - 1;
    if (ini > fin) { res.setHeader('Content-Range', `bytes */${buf.length}`); res.status(416).end(); return; }
    res.setHeader('Content-Range', `bytes ${ini}-${fin}/${buf.length}`);
    res.setHeader('Content-Length', fin - ini + 1);
    res.status(206);
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(buf.subarray(ini, fin + 1));
    return;
  }
  res.setHeader('Content-Length', buf.length);
  res.status(200);
  if (req.method === 'HEAD') { res.end(); return; }
  res.end(buf);
};
