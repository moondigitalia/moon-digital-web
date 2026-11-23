// ARCHIVERO PARA CLAUDE (Kid, 23-nov-2026): Claude baja a su máquina los archivos que el equipo subió al Archivero
// (fotos, audios, PDF, Word, Excel…) para leerlos y explicar qué son, sin pasarlos por la conversación.
// Solo lectura, y solo con la llave de Claude (vive en la base, tabla claves_claude: nunca en este código público).
//   GET /api/archivero?id=a-xxxxxxxxxxxx        → { nombre, mime, tamano, partes }
//   GET /api/archivero?id=a-xxxxxxxxxxxx&n=0    → los bytes de esa parte (cada parte < 1 MB: cabe en una respuesta)
// Cabecera: x-llave: <llave de Claude>
const { igual, sql } = require('./_base');

let llaveVista = null, llaveHora = 0;
async function llaveDeClaude() {
  if (llaveVista && Date.now() - llaveHora < 6e5) return llaveVista;
  const r = (await sql("SELECT llave FROM claves_claude WHERE nombre = 'archivero'"))[0];
  llaveVista = r ? r.llave : ''; llaveHora = Date.now();
  return llaveVista;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const url = new URL(req.url, 'http://x'), id = url.searchParams.get('id') || '', n = url.searchParams.get('n');
  res.setHeader('Cache-Control', 'no-store');
  let llave;
  try { llave = await llaveDeClaude(); } catch (e) { res.status(502).json({ ok: false }); return; }
  if (!llave || !igual(req.headers['x-llave'], llave)) { res.status(401).json({ ok: false }); return; }
  if (!/^a-[0-9a-f]{12}$/.test(id)) { res.status(400).json({ ok: false }); return; }
  try {
    if (n == null) {
      const d = (await sql("SELECT titulo, tel, fuente FROM documentos WHERE id = ? AND formato = 'archivo'", [id]))[0];
      if (!d) { res.status(404).json({ ok: false }); return; }
      const f = JSON.parse(d.fuente || '{}');
      res.json({ ok: true, titulo: d.titulo, tel: d.tel, nombre: f.nombre, mime: f.mime, tamano: f.tamano, partes: f.partes || 0 });
      return;
    }
    if (!/^\d{1,4}$/.test(n)) { res.status(400).json({ ok: false }); return; }
    const p = (await sql('SELECT datos FROM partes WHERE doc = ? AND n = ?', [id, Number(n)]))[0];
    if (!p) { res.status(404).json({ ok: false }); return; }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(Buffer.from(p.datos, 'base64'));
  } catch (e) { res.status(502).json({ ok: false }); }
};
