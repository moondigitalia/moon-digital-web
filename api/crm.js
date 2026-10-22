// LIBRETA CENTRAL DE MOON DIGITAL (CRM propio) — 22-oct-2026
// Una sola ficha por persona, identificada por su teléfono (últimos 10 dígitos).
// Cada contacto (llamada, cita, recado y después WhatsApp o cuestionario) se suma a su historial:
// nadie aparece como "cliente nuevo" dos veces aunque cambie de canal.
// Vive en la base moon-crm (Cloudflare D1) de MOON. Variables propias de MOON en Vercel:
//   CF_ACCOUNT_ID, CF_D1_TOKEN  → acceso a la base (las mismas del buzón de cuestionarios)
//   JASON_CLAVE                 → la clave interna con la que Jason y su agenda escriben aquí
//   CRM_CLAVE                   → la clave con la que Kid, Dan y papá abren la página /crm
const BASE = '3badeaa5-4933-42e1-89fd-7f06dd087b5b'; // moon-crm
const crypto = require('crypto');

const ETAPAS = ['nuevo', 'agendado', 'en propuesta', 'cliente', 'perdido'];
const TEMPERATURAS = ['caliente', 'tibio', 'frio'];
const SERVICIOS = ['agente de llamadas', 'página web', 'redes y campañas', 'administración', 'otro'];
const ORIGENES = ['llamada', 'whatsapp', 'cuestionario', 'referido', 'otro'];

function igual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function quien(req) {
  const c = req.headers['x-clave'];
  if (igual(c, process.env.JASON_CLAVE)) return 'sistema';
  if (igual(c, process.env.CRM_CLAVE)) return 'equipo';
  return null;
}

function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 200000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

async function sql(q, params) {
  const { CF_ACCOUNT_ID, CF_D1_TOKEN } = process.env;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${BASE}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_D1_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: q, params: params || [] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error('base ' + r.status + ' ' + JSON.stringify(j.errors || '').slice(0, 200));
  return (j.result && j.result[0] && j.result[0].results) || [];
}

const t = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 500);
function clave10(tel) { const d = String(tel || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function normal(v, lista) {
  const s = t(v, 40).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return lista.find(x => x.normalize('NFD').replace(/[̀-ͯ]/g, '') === s) || '';
}

// --- Registrar un contacto (lo usa la agenda de Jason; después WhatsApp y cuestionarios) ---
async function registrar(d) {
  const tel = clave10(d.tel);
  if (!tel) return { ok: false, error: 'sin teléfono' };
  const x = d.datos || {};
  const ahora = new Date().toISOString();
  const fecha = t(d.fecha, 40) || ahora;
  const canal = normal(d.canal, ORIGENES) || 'otro';
  const tipo = t(d.tipo, 30) || 'contacto';
  const id = t(d.id, 120) || (tel + '-' + fecha);

  const prev = (await sql('SELECT * FROM personas WHERE tel = ?', [tel]))[0];
  const val = (k, max) => t(x[k], max);
  const temperatura = normal(x.temperatura || x.etiqueta, TEMPERATURAS);
  const servicio = normal(x.servicio, SERVICIOS);
  let etapa = prev ? prev.etapa : 'nuevo';
  if (tipo === 'cita' && (etapa === 'nuevo' || etapa === 'perdido' || !etapa)) etapa = 'agendado';

  if (!prev) {
    await sql(`INSERT INTO personas (tel, telefono, nombre, negocio, giro, correo, temperatura, etapa, servicio, origen, necesidad, volumen, urgencia, decide, proxima_cita, creado, actualizado, ultimo_contacto, contactos, es_prueba)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
      [tel, t(d.tel, 30), val('nombre', 80), val('negocio', 120), val('giro', 120), val('correo', 120), temperatura, etapa, servicio, canal,
       val('necesidad', 400), val('volumen', 80), val('urgencia', 80), val('decide', 120), val('cita', 120), fecha, ahora, fecha, d.es_prueba ? 1 : 0]);
  } else {
    // Lo nuevo solo reemplaza si trae algo; nunca borra lo que ya sabíamos.
    const campos = { nombre: 80, negocio: 120, giro: 120, correo: 120, necesidad: 400, volumen: 80, urgencia: 80, decide: 120 };
    const set = [], params = [];
    for (const k in campos) { const v = val(k, campos[k]); if (v) { set.push(k + ' = ?'); params.push(v); } }
    if (temperatura) { set.push('temperatura = ?'); params.push(temperatura); }
    if (servicio) { set.push('servicio = ?'); params.push(servicio); }
    if (x.cita) { set.push('proxima_cita = ?'); params.push(val('cita', 120)); }
    set.push('etapa = ?', 'actualizado = ?', "ultimo_contacto = MAX(COALESCE(ultimo_contacto, ''), ?)");
    params.push(etapa, ahora, fecha);
    if (!prev.telefono && d.tel) { set.push('telefono = ?'); params.push(t(d.tel, 30)); }
    params.push(tel);
    await sql('UPDATE personas SET ' + set.join(', ') + ' WHERE tel = ?', params);
  }

  // Un contacto por conversación: si ya existe (por ejemplo, la cita y luego la bitácora de la misma llamada), se completa.
  const viejo = (await sql('SELECT datos, tipo, resumen FROM contactos WHERE id = ?', [id]))[0];
  let datos = {};
  try { datos = viejo ? JSON.parse(viejo.datos || '{}') : {}; } catch (e) {}
  for (const k in x) if (x[k] !== '' && x[k] != null) datos[k] = t(x[k], 600);
  const pesos = { cita: 3, recado: 2 };
  const tipoFinal = viejo && (pesos[viejo.tipo] || 0) > (pesos[tipo] || 0) ? viejo.tipo : tipo;
  const resumen = t(d.resumen || x.resumen || x.necesidad || '', 400);
  await sql('INSERT OR REPLACE INTO contactos (id, tel, canal, tipo, fecha, resumen, datos) VALUES (?,?,?,?,?,?,?)',
    [id, tel, canal, tipoFinal, fecha, resumen || (viejo ? viejo.resumen || '' : ''), JSON.stringify(datos).slice(0, 8000)]);
  await sql('UPDATE personas SET contactos = (SELECT COUNT(*) FROM contactos WHERE tel = ?), creado = MIN(COALESCE(creado, ?), ?) WHERE tel = ?', [tel, fecha, fecha, tel]);
  return { ok: true, tel, nueva: !prev, etapa };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const rol = quien(req);
  if (!rol) { res.status(401).json({ ok: false, error: 'clave' }); return; }
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false, error: 'base sin conectar' }); return; }
  const d = await leer(req);
  try {
    if (d.accion === 'registrar' && rol === 'sistema') { res.status(200).json(await registrar(d)); return; }

    // La agenda manda cada 5 minutos las citas que vienen (por si el equipo movió o canceló alguna a mano).
    if (d.accion === 'citas' && rol === 'sistema') {
      const lista = Array.isArray(d.citas) ? d.citas.slice(0, 500) : [];
      const ahora = new Date().toISOString();
      const vistas = new Set();
      for (const c of lista) {
        const tel = clave10(c.tel); if (!tel || vistas.has(tel)) continue; vistas.add(tel);
        const cita = t(c.cita, 120);
        const hay = (await sql('SELECT tel FROM personas WHERE tel = ?', [tel]))[0];
        if (hay) await sql("UPDATE personas SET proxima_cita = ?, etapa = CASE WHEN etapa IN ('nuevo','perdido','') THEN 'agendado' ELSE etapa END WHERE tel = ?", [cita, tel]);
        else await sql("INSERT INTO personas (tel, telefono, nombre, etapa, origen, proxima_cita, creado, actualizado, ultimo_contacto, es_prueba) VALUES (?,?,?,'agendado','llamada',?,?,?,?,?)",
          [tel, t(c.tel, 30), t(c.nombre, 80), cita, ahora, ahora, ahora, /prueba/i.test(c.nombre || '') ? 1 : 0]);
      }
      const marcas = [...vistas];
      await sql("UPDATE personas SET proxima_cita = '' WHERE proxima_cita != ''" + (marcas.length ? ' AND tel NOT IN (' + marcas.map(() => '?').join(',') + ')' : ''), marcas);
      res.status(200).json({ ok: true, citas: marcas.length });
      return;
    }

    if (d.accion === 'buscar') {
      const tel = clave10(d.tel);
      const p = tel ? (await sql('SELECT * FROM personas WHERE tel = ?', [tel]))[0] : null;
      res.status(200).json({ ok: true, persona: p || null });
      return;
    }

    if (d.accion === 'lista') {
      const personas = await sql('SELECT * FROM personas ORDER BY ultimo_contacto DESC LIMIT 1000');
      res.status(200).json({ ok: true, personas, etapas: ETAPAS, temperaturas: TEMPERATURAS, servicios: SERVICIOS, origenes: ORIGENES });
      return;
    }

    if (d.accion === 'ficha') {
      const tel = clave10(d.tel);
      const p = (await sql('SELECT * FROM personas WHERE tel = ?', [tel]))[0];
      const contactos = await sql('SELECT * FROM contactos WHERE tel = ? ORDER BY fecha DESC LIMIT 200', [tel]);
      res.status(200).json({ ok: true, persona: p || null, contactos });
      return;
    }

    if (d.accion === 'editar') {
      const tel = clave10(d.tel);
      if (!tel) { res.status(400).json({ ok: false }); return; }
      const set = [], params = [];
      const listas = { etapa: ETAPAS, temperatura: TEMPERATURAS, servicio: SERVICIOS, origen: ORIGENES };
      for (const k in listas) if (d[k] !== undefined) { const v = d[k] === '' ? '' : normal(d[k], listas[k]); if (v || d[k] === '') { set.push(k + ' = ?'); params.push(v); } }
      for (const k of ['nombre', 'negocio', 'notas_equipo']) if (d[k] !== undefined) { set.push(k + ' = ?'); params.push(t(d[k], k === 'notas_equipo' ? 4000 : 120)); }
      if (d.es_prueba !== undefined) { set.push('es_prueba = ?'); params.push(d.es_prueba ? 1 : 0); }
      if (!set.length) { res.status(400).json({ ok: false }); return; }
      set.push('actualizado = ?'); params.push(new Date().toISOString(), tel);
      await sql('UPDATE personas SET ' + set.join(', ') + ' WHERE tel = ?', params);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: 'acción' });
  } catch (e) {
    console.log('CRM-ERROR', e.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
