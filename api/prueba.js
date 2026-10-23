// DEMO PERSONALIZADO (22-oct-2026)
// Dan (o Daniel o Kid) llena 5 datos del negocio de un prospecto y recibe un link:
//   https://moondigitalia.com/prueba/<codigo>
// El prospecto abre el link en su celular y le habla a SU recepcionista (agente "Demo personalizado" en ElevenLabs),
// que contesta con el nombre, giro, servicios, horario y ubicación de su negocio.
// Crear un demo pide la sesión del Centro MOON. Ver un demo es público (solo con el código).
const { crypto, sql, t } = require('./_base');

const AGENTE = 'agent_7801m5k7sesyektvzg9f2dz6hd48';
const VOCES = { hombre: 'hEKEQC93QpOYMa6WuwWp', mujer: '1u9q7vX1Lcx74yAcFPt7' }; // voz de Jason · voz de Luna
const huella = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ahora = () => new Date().toISOString();
const TOPE_DIA = 60; // el mismo tope que tiene el agente en ElevenLabs
// Inicio del día en Cancún (UTC-5, sin horario de verano), en hora universal.
const inicioHoy = () => { const d = new Date(Date.now() - 5 * 36e5); d.setUTCHours(5, 0, 0, 0); if (d.getTime() > Date.now()) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString(); };

let tablaLista = false;
async function tabla() {
  if (tablaLista) return;
  await sql(`CREATE TABLE IF NOT EXISTS demos (
    codigo TEXT PRIMARY KEY, negocio TEXT, giro TEXT, servicios TEXT, horario TEXT, ubicacion TEXT,
    asistente TEXT, voz TEXT, creado TEXT, creado_por TEXT, vistas INTEGER DEFAULT 0, usos INTEGER DEFAULT 0, ultimo_uso TEXT DEFAULT '')`);
  await sql('CREATE TABLE IF NOT EXISTS demo_usos (codigo TEXT, fecha TEXT)'); // una fila por plática: así sabemos cuántas van hoy de las 60
  tablaLista = true;
}

function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 40000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

async function quienEs(req) {
  const tok = String(req.headers['x-sesion'] || '');
  if (tok.length < 40) return null;
  const s = (await sql('SELECT s.usuario, u.nombre FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ?', [huella(tok)]))[0];
  return s ? { id: s.usuario, nombre: s.nombre } : null;
}

// Código corto y fácil de dictar: parte del nombre + 4 letras/números sin confusiones (sin 0/O, 1/l).
function nuevoCodigo(negocio) {
  const base = String(negocio || 'demo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24).replace(/-$/, '') || 'demo';
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let r = '';
  for (let i = 0; i < 4; i++) r += abc[crypto.randomInt(0, abc.length)];
  return base + '-' + r;
}

const publico = d => ({ negocio: d.negocio, giro: d.giro, servicios: d.servicios, horario: d.horario, ubicacion: d.ubicacion, asistente: d.asistente, voz: d.voz });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false, error: 'base' }); return; }
  const d = await leer(req);
  try {
    await tabla();
    const codigo = String(d.codigo || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

    // ---- Público: lo que necesita la página del prospecto ----
    if (d.accion === 'datos') {
      const x = (await sql('SELECT * FROM demos WHERE codigo = ?', [codigo]))[0];
      if (!x) { res.status(200).json({ ok: false, error: 'no_existe' }); return; }
      await sql('UPDATE demos SET vistas = vistas + 1 WHERE codigo = ?', [codigo]);
      res.status(200).json({ ok: true, agente: AGENTE, voz_id: VOCES[x.voz] || VOCES.mujer, demo: publico(x) });
      return;
    }
    if (d.accion === 'uso') {
      await sql('UPDATE demos SET usos = usos + 1, ultimo_uso = ? WHERE codigo = ?', [ahora(), codigo]);
      await sql('INSERT INTO demo_usos (codigo, fecha) VALUES (?,?)', [codigo, ahora()]);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- Con sesión del Centro: crear y ver los demos ----
    const yo = await quienEs(req);
    if (!yo) { res.status(401).json({ ok: false, error: 'sesion' }); return; }

    if (d.accion === 'crear') {
      const negocio = t(d.negocio, 80);
      const giro = t(d.giro, 200);
      if (!negocio || !giro) { res.status(200).json({ ok: false, error: 'faltan' }); return; }
      const voz = d.voz === 'hombre' ? 'hombre' : 'mujer';
      const asistente = t(d.asistente, 30) || (voz === 'hombre' ? 'Mateo' : 'Sofía');
      let nuevo = nuevoCodigo(negocio);
      for (let i = 0; i < 3 && (await sql('SELECT codigo FROM demos WHERE codigo = ?', [nuevo]))[0]; i++) nuevo = nuevoCodigo(negocio);
      await sql('INSERT INTO demos (codigo, negocio, giro, servicios, horario, ubicacion, asistente, voz, creado, creado_por) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [nuevo, negocio, giro, t(d.servicios, 1500), t(d.horario, 200), t(d.ubicacion, 200), asistente, voz, ahora(), yo.id]);
      await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), yo.id, t(`armó un demo para ${negocio}`, 200)]).catch(() => {});
      res.status(200).json({ ok: true, codigo: nuevo, link: 'https://moondigitalia.com/prueba/' + nuevo });
      return;
    }

    if (d.accion === 'mios') {
      const lista = await sql('SELECT codigo, negocio, asistente, creado, creado_por, vistas, usos, ultimo_uso FROM demos ORDER BY creado DESC LIMIT 30');
      const hoy = ((await sql('SELECT COUNT(*) AS n FROM demo_usos WHERE fecha >= ?', [inicioHoy()]))[0] || {}).n || 0;
      res.status(200).json({ ok: true, yo, demos: lista, hoy, tope: TOPE_DIA });
      return;
    }

    res.status(200).json({ ok: false, error: 'accion' });
  } catch (err) {
    console.log('PRUEBA-ERROR', err.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
