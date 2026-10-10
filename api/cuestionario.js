// BUZÓN DE CUESTIONARIOS DE MOON DIGITAL (10-oct-2026).
// Cualquier cuestionario que un cliente llena en esta página (por ejemplo /examen/luisfer) manda aquí sus
// respuestas, y esto las guarda en la base moon-cuestionarios (Cloudflare D1), que Claude lee directo.
// El cliente no necesita cuenta de nada ni hace pasos extra: si el buzón falla, la página reintenta sola y
// aquí se deja una copia en el registro de Vercel (respaldo) para que nada se pierda.
// Necesita dos variables PROPIAS de MOON en este proyecto de Vercel: CF_ACCOUNT_ID y CF_D1_TOKEN (llave "moon-cuestionarios",
// permiso "D1 Edit"). Nunca se usan llaves de un proyecto de cliente.
const BASE = '815fc6e5-71ed-4f8c-b7e2-4e66615e8688'; // moon-cuestionarios
const PERMITIDOS = /^https:\/\/moon-digital-web(-[a-z0-9-]+)?\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const NOMBRE = /^[a-z0-9-]{1,40}$/;

// Números largos (tarjetas, cuentas) se tapan antes de guardarse: nunca deben vivir en el buzón.
function taparDatos(texto) {
  return String(texto).replace(/\b(?:\d[ -]?){13,19}\b/g, '[número tapado]');
}

function leerCrudo(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  return new Promise((ok, mal) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 100000) { mal(new Error('grande')); req.destroy(); } });
    req.on('end', () => ok(s));
    req.on('error', mal);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'solo POST' }); return; }
  const origen = req.headers.origin || '';
  if (origen && !PERMITIDOS.test(origen)) { res.status(403).json({ ok: false }); return; }
  const { CF_ACCOUNT_ID, CF_D1_TOKEN } = process.env;
  let d;
  try {
    const crudo = await leerCrudo(req);
    if (crudo.length > 80000) { res.status(413).json({ ok: false }); return; }
    d = JSON.parse(crudo);
  } catch (e) { res.status(400).json({ ok: false }); return; }

  // Trampa para robots: un campo invisible que una persona nunca llena.
  if (d.sitio) { res.status(200).json({ ok: true }); return; }
  if (!NOMBRE.test(d.cliente || '') || !NOMBRE.test(d.cuestionario || '')) { res.status(400).json({ ok: false }); return; }
  if (!d.respuestas || typeof d.respuestas !== 'object') { res.status(400).json({ ok: false }); return; }

  const respuestas = taparDatos(JSON.stringify(d.respuestas)).slice(0, 60000);
  const navegador = String(req.headers['user-agent'] || '').slice(0, 300);
  const respaldo = motivo => console.log('RESPALDO-CUESTIONARIO', JSON.stringify({ motivo, cliente: d.cliente, cuestionario: d.cuestionario, respuestas }));
  if (!CF_ACCOUNT_ID || !CF_D1_TOKEN) { respaldo('buzón sin conectar'); res.status(503).json({ ok: false, falta: 'buzón sin conectar' }); return; }
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${BASE}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_D1_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: 'INSERT INTO respuestas (cliente, cuestionario, respuestas, navegador) VALUES (?,?,?,?)',
        params: [d.cliente, d.cuestionario, respuestas, navegador],
      }),
    });
    if (!r.ok) { respaldo('cloudflare ' + r.status); res.status(502).json({ ok: false, cloudflare: r.status }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    respaldo('sin conexión');
    res.status(502).json({ ok: false });
  }
};
