// CRM DE MOON — entrada del sistema (Jason y su agenda). 22-oct-2026
// Una sola ficha por persona, identificada por su teléfono (últimos 10 dígitos).
// Cada contacto (llamada, cita, recado y después WhatsApp o cuestionario) se suma a su historial:
// nadie aparece como "cliente nuevo" dos veces aunque cambie de canal.
// El equipo ya no entra por aquí: entra al Centro MOON (api/centro.js) con su usuario.
// Variables de MOON en Vercel: CF_ACCOUNT_ID, CF_D1_TOKEN (base) y JASON_CLAVE (clave interna de Jason).
const { ETAPAS, TEMPERATURAS, SERVICIOS, ORIGENES, igual, leer, sql, t, clave10, normal } = require('./_base');

function quien(req) {
  return igual(req.headers['x-clave'], process.env.JASON_CLAVE) ? 'sistema' : null;
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
  // Quien vuelve a llamar después de archivado regresa a pendientes; los demás conservan su etapa.
  let etapa = prev ? (normal(prev.etapa, ETAPAS) || 'pendiente') : 'pendiente';
  if (etapa === 'archivo') etapa = 'pendiente';

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
  // Cada contacto con Jason también es "uso" del proyecto de Jason (pestaña Uso del Centro).
  await sql(`INSERT INTO uso (proyecto, fecha, quien, canal, resumen, datos, ref)
             SELECT id, ?, ?, ?, ?, ?, ? FROM proyectos WHERE clave = 'jason' LIMIT 1
             ON CONFLICT(ref) DO UPDATE SET resumen = excluded.resumen, datos = excluded.datos`,
    [fecha, tel, canal, resumen || (viejo ? viejo.resumen || '' : ''), JSON.stringify(datos).slice(0, 6000), 'contacto:' + id]).catch(e => console.log('USO-JASON', e.message));
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
        if (hay) await sql("UPDATE personas SET proxima_cita = ?, etapa = CASE WHEN etapa IN ('archivo','') THEN 'pendiente' ELSE etapa END WHERE tel = ?", [cita, tel]);
        else await sql("INSERT INTO personas (tel, telefono, nombre, etapa, origen, proxima_cita, creado, actualizado, ultimo_contacto, es_prueba) VALUES (?,?,?,'pendiente','llamada',?,?,?,?,?)",
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

    res.status(400).json({ ok: false, error: 'acción' });
  } catch (e) {
    console.log('CRM-ERROR', e.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
