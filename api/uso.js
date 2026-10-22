// USO — la puerta por donde cada cosa que construimos le avisa al Centro MOON que alguien la usó (22-oct-2026).
// Cada proyecto tiene SU propia llave (se genera en el Centro y aquí solo se guarda su huella). Con esa llave
// solo se puede anotar uso en ESE proyecto: no se lee nada ni se toca a otro cliente.
// Lo manda el proyecto así:  POST /api/uso  { llave, quien, canal, resumen, datos, ref }
//   quien  = un identificador de la persona (teléfono, correo o un número anónimo del navegador)
//   ref    = identificador de esa conversación; si llega dos veces, se actualiza en vez de duplicarse
const { crypto, leer, sql, t } = require('./_base');
const huella = s => crypto.createHash('sha256').update(String(s)).digest('hex');

module.exports = async (req, res) => {
  // Los proyectos viven en otras direcciones (la página del cliente), por eso se permite llamar desde cualquiera.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false }); return; }
  const d = await leer(req);
  const llave = String(d.llave || '');
  if (llave.length < 30 || llave.length > 100) { res.status(401).json({ ok: false }); return; }
  try {
    const p = (await sql('SELECT id FROM proyectos WHERE llave_uso = ?', [huella(llave)]))[0];
    if (!p) { res.status(401).json({ ok: false }); return; }
    const datos = d.datos && typeof d.datos === 'object' ? JSON.stringify(d.datos).slice(0, 6000) : t(d.datos, 6000);
    const ref = t(d.ref, 120) ? `${p.id}:${t(d.ref, 120)}` : `${p.id}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
    await sql(`INSERT INTO uso (proyecto, fecha, quien, canal, resumen, datos, ref) VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(ref) DO UPDATE SET resumen = CASE WHEN excluded.resumen != '' THEN excluded.resumen ELSE resumen END,
                                              datos = CASE WHEN excluded.datos != '' THEN excluded.datos ELSE datos END`,
      [p.id, new Date().toISOString(), t(d.quien, 120), t(d.canal, 30), t(d.resumen, 400), datos, ref]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.log('USO-ERROR', e.message);
    res.status(502).json({ ok: false });
  }
};
