// DEMO PERSONALIZADO (22-oct-2026)
// Dos puertas para el mismo demo:
//   · Dan (desde el Centro MOON): llena los datos del prospecto y le manda el link.
//   · Puerta abierta (Facebook, correos): cualquiera deja su nombre y WhatsApp y arma su propio demo.
//     Entra solo al CRM. Un demo por WhatsApp. Usa su propio agente, con su propio tope diario.
// El prospecto abre https://moondigitalia.com/prueba/<codigo> y le habla a SU recepcionista.
// Al terminar elige: "Me gustó, quiero uno", "Quiero agendar una llamada" o "Ahorita no";
// eso se anota en el CRM y, si quiere algo, Dan recibe una tarea nueva en el Centro.
// El tablero (solo con sesión del Centro) junta: embudo de demos, gasto del día en pláticas y lo cobrado.
const { crypto, sql, t, clave10 } = require('./_base');

const AGENTES = { dan: 'agent_7801m5k7sesyektvzg9f2dz6hd48', abierta: 'agent_4501m5kc4jx0ezvssz3smwa4s2nf' };
const TOPES = { dan: 30, abierta: 20 };           // los mismos topes que tiene cada agente en ElevenLabs
const DEMOS_ABIERTA_DIA = 40;                      // cuántos demos nuevos puede armar el público al día (evita que llenen la base)
const VOCES = { hombre: 'hEKEQC93QpOYMa6WuwWp', mujer: '1u9q7vX1Lcx74yAcFPt7' }; // voz de Jason · voz de Luna
// Costo medido en una plática real (22-oct-2026): ~0.097 USD por minuto de voz. Se usa solo si no hay llave de ElevenLabs.
const USD_MIN = 0.097, MXN_USD = 18.5;
const huella = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ahora = () => new Date().toISOString();
// Inicio del día y del mes en Cancún (UTC-5, sin horario de verano), en hora universal.
const cancun = () => new Date(Date.now() - 5 * 36e5);
const inicioHoy = () => { const d = cancun(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5)).toISOString(); };
const inicioMes = () => { const d = cancun(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 5)).toISOString(); };

// Las tablas y columnas de los demos ya existen en la base (se crearon una sola vez el 23-oct-2026).
// Antes se revisaban en CADA arranque con 13 consultas seguidas y eso hacía que la página tardara segundos en abrir.

function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 300000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

async function quienEs(req) {
  const tok = String(req.headers['x-sesion'] || '');
  if (tok.length < 40) return null;
  const s = (await sql('SELECT s.usuario, u.nombre, u.tipo, u.activo, u.tope_demos FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ?', [huella(tok)]))[0];
  if (!s || Number(s.activo) === 0) return null;
  return { id: s.usuario, nombre: s.nombre, tipo: s.tipo === 'embajador' ? 'embajador' : 'socio', tope: Number(s.tope_demos) || 10 };
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
async function codigoLibre(negocio) {
  let c = nuevoCodigo(negocio);
  for (let i = 0; i < 3 && (await sql('SELECT codigo FROM demos WHERE codigo = ?', [c]))[0]; i++) c = nuevoCodigo(negocio);
  return c;
}

// Logo: imagen chica ya achicada en el celular de Dan (máx. ~180 KB). Colores: #rrggbb. Si algo no es válido, se queda vacío y se usa lo de MOON.
function marcaValida(d) {
  const logo = String(d.logo || '');
  const color = c => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : '';
  return { responsable: t(d.responsable, 60), logo: /^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(logo) && logo.length <= 250000 ? logo : '', color: color(d.color), color2: color(d.color2) };
}
const publico = d => ({ negocio: d.negocio, giro: d.giro, servicios: d.servicios, horario: d.horario, ubicacion: d.ubicacion, asistente: d.asistente, voz: d.voz, puerta: d.puerta || 'dan', conocido: !!d.whatsapp, respuesta: d.respuesta || '' });
const link = c => 'https://moondigitalia.com/prueba/' + c;

// Deja o actualiza a la persona en el CRM (una ficha por teléfono) y suma el contacto a su historial.
async function alCRM(tel10, telefono, nombre, negocio, giro, resumen, ref, embajador) {
  const f = ahora();
  const prev = (await sql('SELECT tel, etapa FROM personas WHERE tel = ?', [tel10]))[0];
  if (!prev) {
    await sql(`INSERT INTO personas (tel, telefono, nombre, negocio, giro, etapa, origen, necesidad, creado, actualizado, ultimo_contacto, contactos, es_prueba)
               VALUES (?,?,?,?,?,'pendiente','demo',?,?,?,?,0,0)`, [tel10, telefono, nombre, negocio, giro, resumen, f, f, f]);
  } else {
    await sql(`UPDATE personas SET nombre = CASE WHEN COALESCE(nombre,'') = '' THEN ? ELSE nombre END, negocio = CASE WHEN COALESCE(negocio,'') = '' THEN ? ELSE negocio END,
               giro = CASE WHEN COALESCE(giro,'') = '' THEN ? ELSE giro END, etapa = CASE WHEN etapa = 'archivo' THEN 'pendiente' ELSE etapa END,
               actualizado = ?, ultimo_contacto = ? WHERE tel = ?`, [nombre, negocio, giro, f, f, tel10]);
  }
  // El prospecto queda a nombre del embajador que le armó su recepcionista (el primero que lo trajo se lo queda).
  if (embajador) await sql("UPDATE personas SET embajador = ? WHERE tel = ? AND COALESCE(embajador, '') = ''", [embajador, tel10]).catch(() => {});
  await sql('INSERT OR REPLACE INTO contactos (id, tel, canal, tipo, fecha, resumen, datos) VALUES (?,?,?,?,?,?,?)', [ref, tel10, 'web', 'demo', f, resumen, '{}']).catch(() => {});
  await sql('UPDATE personas SET contactos = (SELECT COUNT(*) FROM contactos WHERE tel = ?) WHERE tel = ?', [tel10, tel10]).catch(() => {});
}

// ---------- Tablero ----------
// Gasto exacto si hay llave de ElevenLabs (ELEVENLABS_LECTURA); si no, aproximado con los segundos de cada plática de demo.
// Se lee UNA vez el mes completo (lo de hoy sale de la misma lista) y se guarda 10 minutos: el tablero abre al instante.
async function gastoElevenLabs(mesIso, hoyIso) {
  const llave = process.env.ELEVENLABS_LECTURA;
  if (!llave) return null;
  const clave = 'eleven:' + mesIso.slice(0, 10);
  const guardado = (await sql('SELECT valor, fecha FROM cache_gasto WHERE clave = ?', [clave]).catch(() => []))[0];
  if (guardado && Date.now() - guardado.fecha < 10 * 60 * 1000) { try { return JSON.parse(guardado.valor); } catch (e) {} }
  const desde = Math.floor(Date.parse(mesIso) / 1000), desdeHoy = Math.floor(Date.parse(hoyIso) / 1000);
  const suma = () => ({ todas: true, platicas: 0, usd: 0, porAgente: {} });
  const mes = suma(), hoy = suma();
  let cursor = '';
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const u = new URL('https://api.elevenlabs.io/v1/convai/conversations');
    u.searchParams.set('page_size', '100'); u.searchParams.set('call_start_after_unix', String(desde));
    if (cursor) u.searchParams.set('cursor', cursor);
    const r = await fetch(u, { headers: { 'xi-api-key': llave } });
    if (!r.ok) return guardado ? JSON.parse(guardado.valor) : null;
    const j = await r.json();
    for (const c of j.conversations || []) {
      // Sin el detalle de cada plática no viene el costo: se calcula por minutos con el costo medido.
      const usd = (c.call_duration_secs || 0) / 60 * USD_MIN, k = c.agent_name || c.agent_id;
      for (const g of (c.start_time_unix_secs || 0) >= desdeHoy ? [mes, hoy] : [mes]) { g.platicas++; g.usd += usd; g.porAgente[k] = (g.porAgente[k] || 0) + usd; }
    }
    if (!j.has_more || !j.next_cursor) break;
    cursor = j.next_cursor;
  }
  const fin = g => ({ todas: true, platicas: g.platicas, mxn: Math.round(g.usd * MXN_USD), porAgente: Object.entries(g.porAgente).map(([k, v]) => ({ nombre: k, mxn: Math.round(v * MXN_USD) })) });
  const valor = { hoy: fin(hoy), mes: fin(mes) };
  await sql('INSERT OR REPLACE INTO cache_gasto (clave, valor, fecha) VALUES (?,?,?)', [clave, JSON.stringify(valor), Date.now()]).catch(() => {});
  return valor;
}
async function gastoDemos(desdeIso) {
  const r = (await sql('SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN segundos > 0 THEN segundos ELSE 180 END), 0) s FROM demo_usos WHERE fecha >= ?', [desdeIso]))[0] || {};
  return { todas: false, platicas: r.n || 0, mxn: Math.round((r.s || 0) / 60 * USD_MIN * MXN_USD) };
}

async function tablero(emb) {
  const hoy = inicioHoy(), mes = inicioMes();
  // Un embajador solo ve sus propios recepcionistas; el gasto y lo cobrado los ven los socios.
  if (emb) {
    const [demos, cerrados] = await Promise.all([
      sql('SELECT codigo, negocio, asistente, puerta, contacto, creado, vistas, usos, ultimo_uso, respuesta, respuesta_fecha, responsable, vistas_calc, vistas_pres FROM demos WHERE creado_por = ? ORDER BY creado DESC LIMIT 500', [emb.id]),
      sql("SELECT d.codigo FROM demos d JOIN personas p ON p.tel = d.whatsapp WHERE d.creado_por = ? AND d.whatsapp <> '' AND p.etapa IN ('cerrado', 'en órbita')", [emb.id]),
    ]);
    const cerr = new Set(cerrados.map(x => x.codigo));
    demos.forEach(x => { x.cerrado = cerr.has(x.codigo); });
    return { ok: true, embajador: true, demos, cobros: [], hoy: { dan: 0, abierta: 0 }, topes: TOPES, gasto: null };
  }
  const [demos, usosHoy, cobros, cerrados] = await Promise.all([
    sql(`SELECT codigo, negocio, asistente, puerta, contacto, whatsapp, creado, vistas, usos, ultimo_uso, respuesta, respuesta_fecha, responsable, vistas_calc, vistas_pres FROM demos ORDER BY creado DESC LIMIT 500`),
    sql('SELECT puerta, COUNT(*) n FROM demo_usos WHERE fecha >= ? GROUP BY puerta', [hoy]),
    sql(`SELECT tel, nombre, negocio, etapa, cobro_total, cobro_mensual, cobro_fecha FROM personas WHERE (cobro_total > 0 OR cobro_mensual > 0) AND es_prueba = 0 ORDER BY cobro_fecha DESC`),
    sql(`SELECT d.codigo FROM demos d JOIN personas p ON p.tel = d.whatsapp WHERE d.whatsapp <> '' AND p.etapa IN ('cerrado', 'en órbita')`),
  ]);
  const cerr = new Set(cerrados.map(x => x.codigo));
  demos.forEach(x => { x.cerrado = cerr.has(x.codigo); });
  const g = await gastoElevenLabs(mes, hoy).catch(() => null), gHoy = g && g.hoy, gMes = g && g.mes;
  const pl = Object.fromEntries(usosHoy.map(x => [x.puerta || 'dan', x.n]));
  return {
    ok: true, demos, cobros,
    hoy: { dan: pl.dan || 0, abierta: pl.abierta || 0 }, topes: TOPES,
    gasto: { hoy: gHoy || await gastoDemos(hoy), mes: gMes || await gastoDemos(mes) },
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false, error: 'base' }); return; }
  const d = await leer(req);
  try {
    const codigo = String(d.codigo || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

    // ---- Público: lo que necesita la página del prospecto ----
    if (d.accion === 'datos') {
      const x = (await sql('SELECT * FROM demos WHERE codigo = ?', [codigo]))[0];
      if (!x) { res.status(200).json({ ok: false, error: 'no_existe' }); return; }
      await sql('UPDATE demos SET vistas = vistas + 1 WHERE codigo = ?', [codigo]);
      res.status(200).json({ ok: true, agente: AGENTES[x.puerta] || AGENTES.dan, voz_id: VOCES[x.voz] || VOCES.mujer, demo: publico(x) });
      return;
    }
    // Marca del cliente para la calculadora y la presentación (26-oct-2026): logo, colores, nombre del negocio y del responsable.
    if (d.accion === 'marca') {
      const x = (await sql('SELECT codigo, negocio, responsable, logo, color, color2 FROM demos WHERE codigo = ?', [codigo]))[0];
      if (!x) { res.status(200).json({ ok: false, error: 'no_existe' }); return; }
      const col = d.pagina === 'pres' ? 'vistas_pres' : d.pagina === 'calc' ? 'vistas_calc' : '';   // Dan revisando la marca no cuenta como vista
      if (col) await sql(`UPDATE demos SET ${col} = COALESCE(${col}, 0) + 1 WHERE codigo = ?`, [codigo]).catch(() => {});
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ok: true, marca: { negocio: x.negocio, responsable: x.responsable || '', logo: x.logo || '', color: x.color || '', color2: x.color2 || '', demo: link(codigo) } });
      return;
    }
    if (d.accion === 'uso') {
      const x = (await sql('SELECT puerta FROM demos WHERE codigo = ?', [codigo]))[0];
      if (!x) { res.status(200).json({ ok: false }); return; }
      await sql('UPDATE demos SET usos = usos + 1, ultimo_uso = ? WHERE codigo = ?', [ahora(), codigo]);
      const f = ahora();
      await sql('INSERT INTO demo_usos (codigo, fecha, puerta) VALUES (?,?,?)', [codigo, f, x.puerta || 'dan']);
      res.status(200).json({ ok: true, inicio: f });
      return;
    }
    if (d.accion === 'fin') {
      // Cuánto duró la plática (para el gasto del día). Máximo 5 minutos: es el tope del agente.
      const s = Math.max(1, Math.min(300, Math.round(Number(d.segundos) || 0)));
      await sql('UPDATE demo_usos SET segundos = ? WHERE codigo = ? AND fecha = ?', [s, codigo, t(d.inicio, 40)]);
      res.status(200).json({ ok: true });
      return;
    }
    if (d.accion === 'respuesta') {
      const x = (await sql('SELECT * FROM demos WHERE codigo = ?', [codigo]))[0];
      const opcion = ['quiero', 'llamada', 'no'].includes(d.opcion) ? d.opcion : '';
      if (!x || !opcion) { res.status(200).json({ ok: false }); return; }
      if (x.respuesta === opcion) { res.status(200).json({ ok: true }); return; } // ya lo había elegido: no se repite la tarea
      const tel10 = x.whatsapp || clave10(d.whatsapp);
      if (opcion !== 'no' && !tel10) { res.status(200).json({ ok: false, error: 'whatsapp' }); return; }
      const nombre = x.contacto || t(d.nombre, 80);
      await sql('UPDATE demos SET respuesta = ?, respuesta_fecha = ?, whatsapp = CASE WHEN whatsapp = \'\' THEN ? ELSE whatsapp END, contacto = CASE WHEN contacto = \'\' THEN ? ELSE contacto END WHERE codigo = ?',
        [opcion, ahora(), tel10 || '', nombre || '', codigo]);
      const texto = { quiero: 'Le gustó su demo y quiere su asistente', llamada: 'Quiere agendar una llamada', no: 'Probó su demo: ahorita no' }[opcion];
      const emb = (await sql("SELECT id, nombre FROM usuarios WHERE id = ? AND tipo = 'embajador'", [x.creado_por || '']))[0];
      if (tel10) await alCRM(tel10, t(d.whatsapp, 30) || tel10, nombre, x.negocio, x.giro, `${texto} (demo de ${x.asistente})`, 'demo:' + codigo, emb ? emb.id : '');
      if (opcion !== 'no') {
        const quien = nombre ? `${nombre} (${x.negocio})` : x.negocio;
        await sql('INSERT INTO tareas (proyecto, titulo, detalle, para, de, estado, vence, creado, cliente) VALUES (?,?,?,?,?,?,?,?,?)',
          [0, t(`${quien}: ${opcion === 'quiero' ? 'quiere su asistente' : 'quiere una llamada'}`, 160),
           t(`${texto}.\nWhatsApp: ${tel10}\nNegocio: ${x.negocio} (${x.giro})${emb ? `\nLo trajo: ${emb.nombre} (embajador)` : ''}\nSu demo: ${link(codigo)}`, 2000), 'dan', 'claude', 'nueva', '', ahora(), t(x.negocio, 120)]);
        // Si lo trajo un embajador, él también recibe la tarea para darle seguimiento.
        if (emb) await sql('INSERT INTO tareas (proyecto, titulo, detalle, para, de, estado, vence, creado, cliente) VALUES (?,?,?,?,?,?,?,?,?)',
          [0, t(`${quien}: ${opcion === 'quiero' ? 'quiere su asistente' : 'quiere una llamada'}`, 160),
           t(`${texto}.\nWhatsApp: ${tel10}\nNegocio: ${x.negocio}\nDan también lo ve.`, 2000), emb.id, 'claude', 'nueva', '', ahora(), t(x.negocio, 120)]);
      }
      await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), 'claude', t(`${x.negocio} probó su demo: ${texto.toLowerCase()}`, 200)]).catch(() => {});
      res.status(200).json({ ok: true });
      return;
    }
    if (d.accion === 'crear_abierta') {
      const nombre = t(d.contacto, 80), tel10 = clave10(d.whatsapp), negocio = t(d.negocio, 80), giro = t(d.giro, 200);
      if (!nombre || !tel10 || !negocio || !giro) { res.status(200).json({ ok: false, error: 'faltan' }); return; }
      // Un demo por WhatsApp: si ya tiene, se le regresa el suyo.
      const ya = (await sql('SELECT codigo FROM demos WHERE whatsapp = ? AND puerta = \'abierta\' ORDER BY creado DESC LIMIT 1', [tel10]))[0];
      if (ya) { res.status(200).json({ ok: true, codigo: ya.codigo, link: link(ya.codigo), ya: true }); return; }
      const hoyN = ((await sql('SELECT COUNT(*) n FROM demos WHERE puerta = \'abierta\' AND creado >= ?', [inicioHoy()]))[0] || {}).n || 0;
      if (hoyN >= DEMOS_ABIERTA_DIA) { res.status(200).json({ ok: false, error: 'lleno' }); return; }
      const voz = d.voz === 'hombre' ? 'hombre' : 'mujer';
      const asistente = t(d.asistente, 30) || (voz === 'hombre' ? 'Mateo' : 'Sofía');
      const nuevo = await codigoLibre(negocio);
      await sql('INSERT INTO demos (codigo, negocio, giro, servicios, horario, ubicacion, asistente, voz, creado, creado_por, puerta, contacto, whatsapp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [nuevo, negocio, giro, t(d.servicios, 1500), t(d.horario, 200), t(d.ubicacion, 200), asistente, voz, ahora(), 'abierta', 'abierta', nombre, tel10]);
      await alCRM(tel10, t(d.whatsapp, 30), nombre, negocio, giro, 'Armó su propio demo (puerta abierta)', 'demo:' + nuevo);
      await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), 'claude', t(`${nombre} armó su propio demo para ${negocio}`, 200)]).catch(() => {});
      res.status(200).json({ ok: true, codigo: nuevo, link: link(nuevo) });
      return;
    }

    // ---- Con sesión del Centro: crear, ver, tablero y cobros ----
    const yo = await quienEs(req);
    if (!yo) { res.status(401).json({ ok: false, error: 'sesion' }); return; }

    // Embajadores: solo lo suyo, con su propio tope diario (cada recepcionista gasta minutos de llamadas).
    const emb = yo.tipo === 'embajador';
    if (emb && ['buscar_persona', 'cobro'].includes(d.accion)) { res.status(200).json({ ok: false, error: 'permiso' }); return; }
    if (d.accion === 'crear' && emb) {
      const hoyN = ((await sql('SELECT COUNT(*) n FROM demos WHERE creado_por = ? AND creado >= ?', [yo.id, inicioHoy()]))[0] || {}).n || 0;
      if (hoyN >= yo.tope) { res.status(200).json({ ok: false, error: 'lleno' }); return; }
    }
    if (d.accion === 'crear') {
      const negocio = t(d.negocio, 80);
      const giro = t(d.giro, 200);
      if (!negocio || !giro) { res.status(200).json({ ok: false, error: 'faltan' }); return; }
      const voz = d.voz === 'hombre' ? 'hombre' : 'mujer';
      const asistente = t(d.asistente, 30) || (voz === 'hombre' ? 'Mateo' : 'Sofía');
      const nuevo = await codigoLibre(negocio);
      const m = marcaValida(d);
      await sql('INSERT INTO demos (codigo, negocio, giro, servicios, horario, ubicacion, asistente, voz, creado, creado_por, puerta, responsable, logo, color, color2) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [nuevo, negocio, giro, t(d.servicios, 1500), t(d.horario, 200), t(d.ubicacion, 200), asistente, voz, ahora(), yo.id, 'dan', m.responsable, m.logo, m.color, m.color2]);
      await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), yo.id, t(`armó un demo para ${negocio}`, 200)]).catch(() => {});
      res.status(200).json({ ok: true, codigo: nuevo, link: link(nuevo) });
      return;
    }

    if (d.accion === 'editar_marca') {
      const m = marcaValida(d);
      const x = (await sql('SELECT codigo, creado_por FROM demos WHERE codigo = ?', [codigo]))[0];
      if (!x || (emb && x.creado_por !== yo.id)) { res.status(200).json({ ok: false, error: 'no_existe' }); return; }
      await sql('UPDATE demos SET responsable = ?, logo = ?, color = ?, color2 = ? WHERE codigo = ?', [m.responsable, m.logo, m.color, m.color2, codigo]);
      res.status(200).json({ ok: true });
      return;
    }

    if (d.accion === 'mios') {
      const campos = "codigo, negocio, asistente, creado, creado_por, puerta, contacto, vistas, usos, ultimo_uso, respuesta, responsable, CASE WHEN COALESCE(logo, '') <> '' THEN 1 ELSE 0 END AS con_logo";
      const [lista, cuenta] = await Promise.all(emb ? [
        sql(`SELECT ${campos} FROM demos WHERE creado_por = ? ORDER BY creado DESC LIMIT 60`, [yo.id]),
        sql('SELECT COUNT(*) AS n FROM demos WHERE creado_por = ? AND creado >= ?', [yo.id, inicioHoy()])] : [
        sql(`SELECT ${campos} FROM demos ORDER BY creado DESC LIMIT 60`),
        sql("SELECT COUNT(*) AS n FROM demo_usos WHERE fecha >= ? AND COALESCE(puerta,'dan') = 'dan'", [inicioHoy()])]);
      const hoy = ((cuenta || [])[0] || {}).n || 0;
      res.status(200).json({ ok: true, yo, demos: lista, hoy, tope: emb ? yo.tope : TOPES.dan });
      return;
    }

    if (d.accion === 'tablero') { res.status(200).json(await tablero(emb ? yo : null)); return; }

    if (d.accion === 'buscar_persona') {
      const q = '%' + t(d.q, 60).toLowerCase() + '%';
      const lista = await sql(`SELECT tel, nombre, negocio, etapa, cobro_total, cobro_mensual FROM personas WHERE es_prueba = 0 AND (LOWER(nombre) LIKE ? OR LOWER(negocio) LIKE ? OR tel LIKE ?) ORDER BY ultimo_contacto DESC LIMIT 12`, [q, q, q]);
      res.status(200).json({ ok: true, lista });
      return;
    }

    if (d.accion === 'cobro') {
      // Dan anota un cierre: cuánto se cobró de una vez y cuánto al mes. La persona pasa a "cerrado" en el CRM.
      const tel = String(d.tel || '').slice(0, 70);
      const total = Math.max(0, Math.min(10000000, Number(d.total) || 0)), mensual = Math.max(0, Math.min(1000000, Number(d.mensual) || 0));
      const p = (await sql('SELECT tel, nombre, negocio, etapa FROM personas WHERE tel = ?', [tel]))[0];
      if (!p || (!total && !mensual)) { res.status(200).json({ ok: false, error: 'datos' }); return; }
      await sql("UPDATE personas SET cobro_total = ?, cobro_mensual = ?, cobro_fecha = ?, etapa = CASE WHEN etapa IN ('pendiente','en proceso','archivo','') THEN 'cerrado' ELSE etapa END, actualizado = ? WHERE tel = ?",
        [total, mensual, ahora(), ahora(), tel]);
      const pesos = n => '$' + Math.round(n).toLocaleString('es-MX');
      await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), yo.id, t(`cerró a ${p.negocio || p.nombre}: ${[total ? pesos(total) + ' de pago' : '', mensual ? pesos(mensual) + ' al mes' : ''].filter(Boolean).join(' y ')}`, 200)]).catch(() => {});
      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({ ok: false, error: 'accion' });
  } catch (err) {
    console.log('PRUEBA-ERROR', err.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
