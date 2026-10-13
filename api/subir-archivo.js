// TEMPORAL (13-oct-2026): recibe un archivo en pedazos desde el navegador de la app y lo guarda en la tabla "archivos".
// Solo acepta pedazos de un id que todavía no está completo. Se borra en cuanto el audio de la junta queda subido.
const BASE = '815fc6e5-71ed-4f8c-b7e2-4e66615e8688';
const PERMITIDOS = /^https:\/\/moon-digital-web(-[a-z0-9-]+)?\.vercel\.app$/;
const PERMITIDO_ID = 'junta-luisfer-resumen-mp3';

async function d1(sql, params) {
  const { CF_ACCOUNT_ID, CF_D1_TOKEN } = process.env;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${BASE}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_D1_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  if (!r.ok) throw new Error('cloudflare ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return ((await r.json()).result || [])[0]?.results || [];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!PERMITIDOS.test(req.headers.origin || '')) { res.status(403).end(); return; }
  const d = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  if (d.id !== PERMITIDO_ID || !Number.isInteger(d.parte) || !Number.isInteger(d.total) || typeof d.datos !== 'string' || d.datos.length > 120000) { res.status(400).end(); return; }
  try {
    const ya = await d1('SELECT COUNT(*) AS n FROM archivos WHERE id = ?', [d.id]);
    if (ya[0] && ya[0].n >= d.total) { res.status(409).json({ ok: false, completo: true }); return; }
    await d1('INSERT OR REPLACE INTO archivos (id, parte, total, datos) VALUES (?,?,?,?)', [d.id, d.parte, d.total, d.datos]);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(502).json({ ok: false, error: String(e.message).slice(0, 200) }); }
};
