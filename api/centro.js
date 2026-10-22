// CENTRO MOON — la página interna de MOON Digital (22-oct-2026).
// Tres usuarios fijos (Kid, Dan, Daniel). La primera vez cada quien recibe un código en SU correo y crea su contraseña;
// después el aparato queda recordado con una sesión larga (solo se guarda su huella, nunca la sesión en sí).
// Jason y, después, el Claude de cada quien pueden escribir aquí con la clave interna (JASON_CLAVE).
const { crypto, ETAPAS, TEMPERATURAS, SERVICIOS, ORIGENES, FASES, igual, leer, sql, t, llave, normal } = require('./_base');

const AGENDA = 'https://script.google.com/macros/s/AKfycbzmjh39HaP39rdzK3PJdKMULk43T9uvQNwcriSdpzbIRgLC3Xppu9MezL4byJTb4kgX/exec';
const USUARIOS = ['kid', 'dan', 'daniel'];
function leerCifrado(id) {
  try {
    if (!/^[a-z0-9-]+$/.test(id) || !process.env.CENTRO_LLAVE_DOCS) return null;
    const archivo = require('path').join(__dirname, '_docs', id + '.bin');
    if (!require('fs').existsSync(archivo)) return null;
    const b = require('fs').readFileSync(archivo), llave = Buffer.from(process.env.CENTRO_LLAVE_DOCS, 'base64');
    const dc = crypto.createDecipheriv('aes-256-gcm', llave, b.subarray(0, 12)); dc.setAuthTag(b.subarray(12, 28));
    return JSON.parse(require('zlib').gunzipSync(Buffer.concat([dc.update(b.subarray(28)), dc.final()])).toString());
  } catch (e) { console.log('DOC-CIFRADO', id, e.message); return null; }
}
const huella = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ahora = () => new Date().toISOString();
const ocultar = c => { const [u, d] = String(c).split('@'); return u.slice(0, 2) + '•••@' + d; };

function scrypt(clave, sal) {
  return new Promise((ok, mal) => crypto.scrypt(String(clave), sal, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? mal(e) : ok(k.toString('hex'))));
}

async function anotar(quien, texto) {
  await sql('INSERT INTO actividad (fecha, quien, texto) VALUES (?,?,?)', [ahora(), quien, t(texto, 200)]);
}

async function sesion(req, d) {
  if (igual(req.headers['x-clave'], process.env.JASON_CLAVE)) return { id: 'sistema', nombre: d.como ? t(d.como, 20) : 'Claude' };
  const tok = String(req.headers['x-sesion'] || '');
  if (tok.length < 40) return null;
  const s = (await sql('SELECT s.usuario, s.visto, u.nombre FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ?', [huella(tok)]))[0];
  if (!s) return null;
  // Se actualiza "visto" a lo mucho una vez por hora, para no escribir en cada vuelta.
  if (!s.visto || Date.now() - Date.parse(s.visto) > 3600e3) await sql('UPDATE sesiones SET visto = ? WHERE token = ?', [ahora(), huella(tok)]);
  return { id: s.usuario, nombre: s.nombre };
}

async function nuevaSesion(usuario, req) {
  const tok = crypto.randomBytes(32).toString('base64url');
  await sql('INSERT INTO sesiones (token, usuario, creado, visto, aparato) VALUES (?,?,?,?,?)',
    [huella(tok), usuario, ahora(), ahora(), t(req.headers['user-agent'], 160)]);
  return tok;
}

// ---------- Entrada (sin sesión) ----------
async function entrada(d, req) {
  if (d.accion === 'quienes') {
    const us = await sql('SELECT id, nombre, correo, hash FROM usuarios ORDER BY CASE id WHEN \'daniel\' THEN 1 WHEN \'dan\' THEN 2 ELSE 3 END');
    return { ok: true, usuarios: us.map(u => ({ id: u.id, nombre: u.nombre, correo: ocultar(u.correo), tieneClave: !!u.hash })) };
  }
  if (!['pedir_codigo', 'revisar_codigo', 'crear_clave', 'entrar'].includes(d.accion)) return null;
  const id = USUARIOS.includes(d.usuario) ? d.usuario : '';
  if (!id) return { ok: false, error: 'usuario' };
  const u = (await sql('SELECT * FROM usuarios WHERE id = ?', [id]))[0];
  if (!u) return { ok: false, error: 'usuario' };

  if (d.accion === 'pedir_codigo') {
    const c = (await sql('SELECT * FROM codigos WHERE usuario = ?', [id]))[0];
    const enHora = c && c.ventana && Date.now() - Date.parse(c.ventana) < 3600e3;
    if (enHora && c.enviados >= 5) return { ok: false, error: 'muchos' };
    const codigo = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    const r = await fetch(AGENDA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ clave: process.env.JASON_CLAVE, accion: 'centro_codigo', correo: u.correo, codigo, nombre: u.nombre }) })
      .then(x => x.json()).catch(() => ({}));
    if (!r.ok) return { ok: false, error: 'correo' };
    await sql('INSERT OR REPLACE INTO codigos (usuario, hash, vence, intentos, enviados, ventana) VALUES (?,?,?,0,?,?)',
      [id, huella(id + ':' + codigo), new Date(Date.now() + 10 * 60e3).toISOString(), enHora ? c.enviados + 1 : 1, enHora ? c.ventana : ahora()]);
    return { ok: true, correo: ocultar(u.correo) };
  }

  if (d.accion === 'revisar_codigo' || d.accion === 'crear_clave') {
    const c = (await sql('SELECT * FROM codigos WHERE usuario = ?', [id]))[0];
    if (!c || !c.hash || Date.now() > Date.parse(c.vence)) return { ok: false, error: 'vencido' };
    if (c.intentos >= 5) return { ok: false, error: 'vencido' };
    if (!igual(c.hash, huella(id + ':' + String(d.codigo || '').replace(/\D/g, '')))) {
      await sql('UPDATE codigos SET intentos = intentos + 1 WHERE usuario = ?', [id]);
      return { ok: false, error: 'codigo', quedan: Math.max(0, 4 - c.intentos) };
    }
    if (d.accion === 'revisar_codigo') return { ok: true };
    const clave = String(d.clave || '');
    if (clave.length < 6 || clave.length > 200) return { ok: false, error: 'corta' };
    const sal = crypto.randomBytes(16).toString('hex');
    await sql('UPDATE usuarios SET hash = ?, sal = ? WHERE id = ?', [await scrypt(clave, sal), sal, id]);
    await sql('DELETE FROM codigos WHERE usuario = ?', [id]);
    return { ok: true, sesion: await nuevaSesion(id, req) };
  }

  if (d.accion === 'entrar') {
    if (!u.hash) return { ok: false, error: 'sin_clave' };
    const c = (await sql('SELECT * FROM codigos WHERE usuario = ?', [id]))[0];
    // Freno contra adivinar: 8 intentos fallidos seguidos pausan 15 minutos.
    if (c && c.intentos >= 8 && Date.now() - Date.parse(c.ventana || 0) < 15 * 60e3) return { ok: false, error: 'pausa' };
    if (!igual(u.hash, await scrypt(d.clave || '', u.sal))) {
      await sql(`INSERT INTO codigos (usuario, hash, vence, intentos, enviados, ventana) VALUES (?, '', '', 1, 0, ?)
                 ON CONFLICT(usuario) DO UPDATE SET intentos = intentos + 1, ventana = excluded.ventana`, [id, ahora()]);
      return { ok: false, error: 'clave' };
    }
    await sql("DELETE FROM codigos WHERE usuario = ? AND hash = ''", [id]);
    return { ok: true, sesion: await nuevaSesion(id, req) };
  }
  return null;
}

// ---------- Con sesión ----------
async function inicio(yo) {
  const [usuarios, personas, proyectos, tareas, actividad, usoMes, paneles, documentos] = await Promise.all([
    sql('SELECT id, nombre, color, rol, lema, creado FROM usuarios'),
    sql('SELECT tel, telefono, nombre, negocio, giro, temperatura, etapa, servicio, origen, necesidad, proxima_cita, encargados, notas_equipo, ultimo_contacto, contactos, es_prueba FROM personas ORDER BY ultimo_contacto DESC LIMIT 1000'),
    sql("SELECT id, tel, nombre, fase, encargados, nota, creado, actualizado, (clave != '' OR llave_uso != '') AS conectado FROM proyectos ORDER BY actualizado DESC"),
    sql("SELECT * FROM tareas WHERE estado != 'hecha' OR hecho > ? ORDER BY id DESC", [new Date(Date.now() - 14 * 864e5).toISOString()]),
    sql('SELECT * FROM actividad ORDER BY id DESC LIMIT 12'),
    sql('SELECT proyecto, COUNT(*) n FROM uso WHERE fecha >= ? AND quien NOT IN (SELECT tel FROM personas WHERE es_prueba = 1) GROUP BY proyecto', [new Date(Date.now() - 30 * 864e5).toISOString()]),
    sql('SELECT tel, orden, demo, color, imagen, icono FROM paneles ORDER BY orden'),
    sql('SELECT id, tel, seccion, orden, titulo, frase, url, formato FROM documentos ORDER BY tel, seccion, orden'),
  ]);
  const usos = Object.fromEntries(usoMes.map(x => [x.proyecto, x.n]));
  proyectos.forEach(p => { p.uso_mes = usos[p.id] || 0; });
  return { ok: true, yo, usuarios, personas, proyectos, tareas, actividad, paneles, documentos, listas: { etapas: ETAPAS, temperaturas: TEMPERATURAS, servicios: SERVICIOS, origenes: ORIGENES, fases: FASES } };
}

const listaUsuarios = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(x => USUARIOS.includes(x)).join(',');

async function conSesion(d, yo) {
  if (d.accion === 'inicio') return inicio(yo);
  if (d.accion === 'fotos') {
    // Foto que cada quien subió; si no ha subido, la de su credencial.
    // Las fotos viven solo en la base privada (nunca en el código).
    const fotos = {};
    for (const u of await sql("SELECT id, foto FROM usuarios WHERE foto != ''")) fotos[u.id] = u.foto;
    return { ok: true, fotos };
  }

  // Cada quien solo cambia SU credencial: foto, frase y lo que hace.
  if (d.accion === 'mi_perfil') {
    if (!USUARIOS.includes(yo.id)) return { ok: false, error: 'permiso' };
    const set = [], params = [];
    if (d.foto !== undefined) {
      const f = String(d.foto || '');
      if (f && (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(f) || f.length > 400000)) return { ok: false, error: 'foto' };
      set.push('foto = ?'); params.push(f);
    }
    if (d.lema !== undefined) { set.push('lema = ?'); params.push(t(d.lema, 90)); }
    if (d.rol !== undefined) { set.push('rol = ?'); params.push(t(d.rol, 40)); }
    if (!set.length) return { ok: false };
    params.push(yo.id);
    await sql('UPDATE usuarios SET ' + set.join(', ') + ' WHERE id = ?', params);
    if (d.foto !== undefined) await anotar(yo.id, 'cambió su foto de credencial');
    return { ok: true };
  }

  // Un documento guardado (copia de lo que se le enseña al cliente). Solo con sesión.
  if (d.accion === 'documento') {
    const doc = (await sql('SELECT id, titulo, formato, contenido, url FROM documentos WHERE id = ?', [t(d.id, 80)]))[0];
    if (!doc) return { ok: false, error: 'no existe' };
    // Los documentos con imágenes viven cifrados dentro del proyecto (api/_docs); solo esta llave los abre.
    const cifrado = leerCifrado(doc.id);
    if (cifrado) Object.assign(doc, cifrado);
    return { ok: true, doc };
  }

  if (d.accion === 'uso') {
    const id = Number(d.id) || 0;
    // Las llamadas de prueba de la familia no cuentan como uso real.
    const real = "proyecto = ? AND quien NOT IN (SELECT tel FROM personas WHERE es_prueba = 1)";
    const dia = n => new Date(Date.now() - n * 864e5).toISOString();
    // Cancún vive en UTC-5 todo el año (sin horario de verano): el día empieza a las 05:00 UTC.
    const inicioHoy = new Date(Math.floor((Date.now() - 5 * 36e5) / 864e5) * 864e5 + 5 * 36e5).toISOString();
    const [cifras, porDia, ultimos, conectado] = await Promise.all([
      sql(`SELECT SUM(fecha >= ?) hoy, SUM(fecha >= ?) semana, SUM(fecha >= ?) mes, COUNT(DISTINCT CASE WHEN fecha >= ? THEN quien END) personas, COUNT(*) total FROM uso WHERE ${real}`, [inicioHoy, dia(7), dia(30), dia(30), id]),
      sql(`SELECT substr(datetime(fecha, '-5 hours'), 1, 10) d, COUNT(*) n FROM uso WHERE ${real} AND fecha >= ? GROUP BY d`, [id, dia(28)]),
      sql(`SELECT id, fecha, quien, canal, resumen, datos FROM uso WHERE ${real} ORDER BY fecha DESC LIMIT 300`, [id]),
      sql('SELECT clave, llave_uso FROM proyectos WHERE id = ?', [id]),
    ]);
    const c = conectado[0] || {};
    return { ok: true, cifras: cifras[0] || {}, porDia, ultimos, conectado: !!(c.clave || c.llave_uso) };
  }

  // Solo Claude (clave interna) genera la llave de un proyecto, para conectarlo. Se muestra una sola vez.
  if (d.accion === 'llave_uso') {
    if (yo.id !== 'sistema') return { ok: false, error: 'permiso' };
    const llave = 'uso_' + crypto.randomBytes(24).toString('base64url');
    await sql('UPDATE proyectos SET llave_uso = ? WHERE id = ?', [huella(llave), Number(d.id) || 0]);
    return { ok: true, llave };
  }

  if (d.accion === 'ficha') {
    const tel = llave(d.tel);
    const p = (await sql('SELECT * FROM personas WHERE tel = ?', [tel]))[0];
    const contactos = await sql('SELECT * FROM contactos WHERE tel = ? ORDER BY fecha DESC LIMIT 100', [tel]);
    return { ok: true, persona: p || null, contactos };
  }

  if (d.accion === 'editar_persona') {
    const tel = llave(d.tel);
    if (!tel) return { ok: false };
    const set = [], params = [];
    const listas = { etapa: ETAPAS, temperatura: TEMPERATURAS, servicio: SERVICIOS, origen: ORIGENES };
    for (const k in listas) if (d[k] !== undefined) { const v = normal(d[k], listas[k]); if (v || d[k] === '') { set.push(k + ' = ?'); params.push(v); } }
    for (const k of ['nombre', 'negocio', 'notas_equipo']) if (d[k] !== undefined) { set.push(k + ' = ?'); params.push(t(d[k], k === 'notas_equipo' ? 4000 : 120)); }
    if (d.encargados !== undefined) { set.push('encargados = ?'); params.push(listaUsuarios(d.encargados)); }
    if (d.es_prueba !== undefined) { set.push('es_prueba = ?'); params.push(d.es_prueba ? 1 : 0); }
    if (!set.length) return { ok: false };
    set.push('actualizado = ?'); params.push(ahora(), tel);
    await sql('UPDATE personas SET ' + set.join(', ') + ' WHERE tel = ?', params);
    if (d.etapa !== undefined) {
      const p = (await sql('SELECT nombre, negocio FROM personas WHERE tel = ?', [tel]))[0] || {};
      await anotar(yo.id, `movió a ${p.negocio || p.nombre || 'un cliente'} a ${normal(d.etapa, ETAPAS)}`);
    }
    return { ok: true };
  }

  if (d.accion === 'nuevo_cliente') {
    const nombre = t(d.nombre, 80), negocio = t(d.negocio, 120);
    if (!nombre && !negocio) return { ok: false, error: 'nombre' };
    let tel = llave(d.telefono);
    if (!tel) tel = 'c-' + (negocio || nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    const ya = (await sql('SELECT tel FROM personas WHERE tel = ?', [tel]))[0];
    if (ya) return { ok: true, tel, existia: true };
    const f = ahora();
    await sql(`INSERT INTO personas (tel, telefono, nombre, negocio, etapa, servicio, origen, encargados, creado, actualizado, ultimo_contacto, contactos, es_prueba)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0)`,
      [tel, t(d.telefono, 30), nombre, negocio, normal(d.etapa, ETAPAS) || 'pendiente', normal(d.servicio, SERVICIOS), normal(d.origen, ORIGENES) || 'otro', listaUsuarios(d.encargados), f, f, f]);
    await anotar(yo.id, `agregó a ${negocio || nombre} al CRM`);
    return { ok: true, tel };
  }

  if (d.accion === 'proyecto') {
    const nombre = t(d.nombre, 100);
    const fase = normal(d.fase, FASES);
    const f = ahora();
    if (d.id) {
      const p = (await sql('SELECT * FROM proyectos WHERE id = ?', [Number(d.id)]))[0];
      if (!p) return { ok: false };
      await sql('UPDATE proyectos SET nombre = ?, fase = ?, encargados = ?, nota = ?, tel = ?, actualizado = ? WHERE id = ?',
        [nombre || p.nombre, fase || p.fase, d.encargados !== undefined ? listaUsuarios(d.encargados) : p.encargados,
         d.nota !== undefined ? t(d.nota, 2000) : p.nota, d.tel !== undefined ? llave(d.tel) : p.tel, f, p.id]);
      if (fase && fase !== p.fase) await anotar(yo.id, `pasó ${p.nombre} a ${fase}`);
      return { ok: true, id: p.id };
    }
    if (!nombre) return { ok: false, error: 'nombre' };
    await sql('INSERT INTO proyectos (tel, nombre, fase, encargados, nota, creado, actualizado) VALUES (?,?,?,?,?,?,?)',
      [llave(d.tel), nombre, fase || 'por arrancar', listaUsuarios(d.encargados), t(d.nota, 2000), f, f]);
    const id = (await sql('SELECT MAX(id) AS id FROM proyectos'))[0].id;
    await anotar(yo.id, `abrió el proyecto ${nombre}`);
    return { ok: true, id };
  }

  if (d.accion === 'tarea') {
    const titulo = t(d.titulo, 160);
    const para = USUARIOS.includes(d.para) ? d.para : '';
    if (!titulo || !para) return { ok: false, error: 'datos' };
    await sql('INSERT INTO tareas (proyecto, titulo, detalle, para, de, estado, vence, creado) VALUES (?,?,?,?,?,?,?,?)',
      [Number(d.proyecto) || 0, titulo, t(d.detalle, 2000), para, yo.id, 'nueva', t(d.vence, 10), ahora()]);
    await anotar(yo.id, `le dejó una tarea a ${para === 'daniel' ? 'Daniel' : para === 'dan' ? 'Dan' : 'Kid'}: ${titulo}`);
    return { ok: true };
  }

  if (d.accion === 'tarea_vista' || d.accion === 'tarea_hecha') {
    const x = (await sql('SELECT * FROM tareas WHERE id = ?', [Number(d.id)]))[0];
    if (!x) return { ok: false };
    if (d.accion === 'tarea_vista') {
      // Solo cuenta como "vista" cuando la abre la persona a quien le toca.
      if (x.para === yo.id && !x.visto) await sql("UPDATE tareas SET visto = ?, estado = CASE WHEN estado = 'nueva' THEN 'vista' ELSE estado END WHERE id = ?", [ahora(), x.id]);
      return { ok: true };
    }
    const hecha = !!d.hecha;
    await sql('UPDATE tareas SET estado = ?, hecho = ?, visto = CASE WHEN visto = \'\' THEN ? ELSE visto END WHERE id = ?',
      [hecha ? 'hecha' : 'vista', hecha ? ahora() : '', ahora(), x.id]);
    if (hecha) await anotar(yo.id, `terminó: ${x.titulo}`);
    return { ok: true };
  }

  if (d.accion === 'salir') return { ok: true };
  return { ok: false, error: 'acción' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false, error: 'base' }); return; }
  const d = await leer(req);
  try {
    const e = await entrada(d, req);
    if (e) { res.status(200).json(e); return; }
    const yo = await sesion(req, d);
    if (!yo) { res.status(401).json({ ok: false, error: 'sesion' }); return; }
    if (d.accion === 'salir' && req.headers['x-sesion']) await sql('DELETE FROM sesiones WHERE token = ?', [huella(req.headers['x-sesion'])]);
    res.status(200).json(await conSesion(d, yo));
  } catch (err) {
    console.log('CENTRO-ERROR', err.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
module.exports._leerCifrado = leerCifrado;   // para la prueba local
