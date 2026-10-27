// CENTRO MOON — la página interna de MOON Digital (22-oct-2026).
// Tres usuarios fijos (Kid, Dan, Daniel). La primera vez cada quien recibe un código en SU correo y crea su contraseña;
// después el aparato queda recordado con una sesión larga (solo se guarda su huella, nunca la sesión en sí).
// Jason y, después, el Claude de cada quien pueden escribir aquí con la clave interna (JASON_CLAVE).
const { crypto, ETAPAS, TEMPERATURAS, SERVICIOS, ORIGENES, FASES, igual, leer, sql, t, llave, normal, clave10 } = require('./_base');

const AGENDA = 'https://script.google.com/macros/s/AKfycbzmjh39HaP39rdzK3PJdKMULk43T9uvQNwcriSdpzbIRgLC3Xppu9MezL4byJTb4kgX/exec';
const USUARIOS = ['kid', 'dan', 'daniel'];
const { leerCifrado, preparar, enviable, mdAHoja } = require('./_visor');
// Foto o logo: una imagen chica ya reducida en el celular (data:image/…), nunca un archivo cualquiera.
const fotoValida = f => { if (f === '' || f == null) return ''; f = String(f); return /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length < 160000 ? f : null; };
const SECCIONES_CLIENTE = ['propuesta', 'contrato', 'material', 'avance'];
const SECCIONES_MOON = ['presentacion', 'pagina', 'bienvenida'];   // lo de MOON: también se sube, se cambia y se quita
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
  if (igual(req.headers['x-clave'], process.env.JASON_CLAVE)) return { id: 'sistema', nombre: d.como ? t(d.como, 20) : 'Claude', tipo: 'socio' };
  const tok = String(req.headers['x-sesion'] || '');
  if (tok.length < 40) return null;
  const s = (await sql('SELECT s.usuario, s.visto, u.nombre, u.tipo, u.activo FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ?', [huella(tok)]))[0];
  if (!s || Number(s.activo) === 0) return null;   // si se le quitó el acceso, su sesión deja de servir al instante
  // Se actualiza "visto" a lo mucho una vez por hora, para no escribir en cada vuelta.
  if (!s.visto || Date.now() - Date.parse(s.visto) > 3600e3) await sql('UPDATE sesiones SET visto = ? WHERE token = ?', [ahora(), huella(tok)]);
  return { id: s.usuario, nombre: s.nombre, tipo: s.tipo === 'embajador' ? 'embajador' : 'socio' };
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
    const us = await sql('SELECT id, nombre, correo, hash FROM usuarios WHERE tipo = \'socio\' ORDER BY CASE id WHEN \'daniel\' THEN 1 WHEN \'dan\' THEN 2 ELSE 3 END');
    return { ok: true, usuarios: us.map(u => ({ id: u.id, nombre: u.nombre, correo: ocultar(u.correo), tieneClave: !!u.hash })) };
  }
  // ---- Embajadores: entran con el link personal que les mandan los socios, y después con su WhatsApp y contraseña ----
  if (d.accion === 'invitacion' || d.accion === 'crear_clave_invita') {
    const tok = String(d.token || '');
    const u = tok.length >= 30 ? (await sql("SELECT * FROM usuarios WHERE tipo = 'embajador' AND activo = 1 AND invita = ? AND invita_vence > ?", [huella(tok), ahora()]))[0] : null;
    if (!u) return { ok: false, error: 'vencido' };
    if (d.accion === 'invitacion') return { ok: true, nombre: u.nombre, tieneClave: !!u.hash, pideTel: !u.tel };
    const clave = String(d.clave || '');
    if (clave.length < 6 || clave.length > 200) return { ok: false, error: 'corta' };
    // Si los socios todavía no anotaron su WhatsApp, lo pone él aquí (es con lo que entrará después desde cualquier aparato).
    let tel = u.tel;
    if (!tel) {
      tel = clave10(d.tel);
      if (!tel) return { ok: false, error: 'tel' };
      if ((await sql("SELECT id FROM usuarios WHERE tel = ? AND id <> ?", [tel, u.id]))[0]) return { ok: false, error: 'tel_usado' };
    }
    const sal = crypto.randomBytes(16).toString('hex');
    await sql("UPDATE usuarios SET hash = ?, sal = ?, tel = ?, invita = '', invita_vence = '' WHERE id = ?", [await scrypt(clave, sal), sal, tel, u.id]);
    await anotar(u.id, 'entró por primera vez al tablero');
    return { ok: true, sesion: await nuevaSesion(u.id, req) };
  }
  if (d.accion === 'entrar_embajador') {
    const tel = clave10(d.tel);
    const u = tel ? (await sql("SELECT * FROM usuarios WHERE tipo = 'embajador' AND activo = 1 AND tel = ?", [tel]))[0] : null;
    if (!u || !u.hash) return { ok: false, error: 'clave' };
    const c = (await sql('SELECT * FROM codigos WHERE usuario = ?', [u.id]))[0];
    if (c && c.intentos >= 8 && Date.now() - Date.parse(c.ventana || 0) < 15 * 60e3) return { ok: false, error: 'pausa' };
    if (!igual(u.hash, await scrypt(d.clave || '', u.sal))) {
      await sql(`INSERT INTO codigos (usuario, hash, vence, intentos, enviados, ventana) VALUES (?, '', '', 1, 0, ?)
                 ON CONFLICT(usuario) DO UPDATE SET intentos = intentos + 1, ventana = excluded.ventana`, [u.id, ahora()]);
      return { ok: false, error: 'clave' };
    }
    await sql("DELETE FROM codigos WHERE usuario = ? AND hash = ''", [u.id]);
    return { ok: true, sesion: await nuevaSesion(u.id, req) };
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
  const [usuarios, personas, proyectos, tareas, actividad, usoMes, paneles, documentos, embajadores] = await Promise.all([
    sql("SELECT id, nombre, color, rol, lema, creado FROM usuarios WHERE tipo = 'socio'"),
    sql('SELECT tel, telefono, correo, foto, nombre, negocio, giro, temperatura, etapa, servicio, origen, necesidad, proxima_cita, encargados, notas_equipo, ultimo_contacto, contactos, es_prueba FROM personas WHERE COALESCE(borrado, \'\') = \'\' ORDER BY ultimo_contacto DESC LIMIT 1000'),
    sql("SELECT id, tel, nombre, fase, enlace, encargados, nota, creado, actualizado, (clave != '' OR llave_uso != '') AS conectado FROM proyectos ORDER BY actualizado DESC"),
    sql("SELECT * FROM tareas WHERE estado != 'hecha' OR hecho > ? ORDER BY id DESC", [new Date(Date.now() - 14 * 864e5).toISOString()]),
    sql('SELECT * FROM actividad ORDER BY id DESC LIMIT 12'),
    sql('SELECT proyecto, COUNT(*) n FROM uso WHERE fecha >= ? AND quien NOT IN (SELECT tel FROM personas WHERE es_prueba = 1) GROUP BY proyecto', [new Date(Date.now() - 30 * 864e5).toISOString()]),
    sql('SELECT tel, orden, demo, color, imagen, icono FROM paneles ORDER BY orden'),
    sql("SELECT id, tel, seccion, orden, titulo, frase, url, formato FROM documentos WHERE seccion != 'oculto' AND COALESCE(borrado, '') = '' AND NOT (formato = 'archivo' AND fuente NOT LIKE '%\"listo\":1%') ORDER BY tel, seccion, orden"),
    sql("SELECT id, nombre, color FROM usuarios WHERE tipo = 'embajador' AND activo = 1 ORDER BY creado"),
  ]);
  const usos = Object.fromEntries(usoMes.map(x => [x.proyecto, x.n]));
  proyectos.forEach(p => { p.uso_mes = usos[p.id] || 0; });
  return { ok: true, yo, rol: 'socio', usuarios, embajadores, personas, proyectos, tareas, actividad, paneles, documentos, listas: { etapas: ETAPAS, temperaturas: TEMPERATURAS, servicios: SERVICIOS, origenes: ORIGENES, fases: FASES } };
}

const listaUsuarios = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(x => USUARIOS.includes(x)).join(',');

// ---------- Embajadores: solo ven y hacen lo suyo (esto lo decide el servidor, no la pantalla) ----------
const DOCS_EMBAJADOR = "tel = 'moon' AND seccion IN ('presentacion', 'pagina') AND COALESCE(borrado, '') = ''";
async function inicioEmbajador(yo) {
  const [yoBD, personas, demos, tareas, documentos, ajuste] = await Promise.all([
    sql('SELECT id, nombre, color, rol, lema, creado, tope_demos FROM usuarios WHERE id = ?', [yo.id]),
    sql(`SELECT tel, nombre, negocio, giro, etapa, ultimo_contacto, cobro_total, cobro_mensual, cobro_fecha FROM personas
         WHERE COALESCE(borrado, '') = '' AND es_prueba = 0 AND (embajador = ? OR tel IN (SELECT whatsapp FROM demos WHERE creado_por = ? AND whatsapp <> ''))
         ORDER BY ultimo_contacto DESC LIMIT 500`, [yo.id, yo.id]),
    sql('SELECT codigo, negocio, asistente, creado, vistas, usos, respuesta, contacto FROM demos WHERE creado_por = ? ORDER BY creado DESC LIMIT 200', [yo.id]),
    sql("SELECT * FROM tareas WHERE para = ? AND (estado != 'hecha' OR hecho > ?) ORDER BY id DESC", [yo.id, new Date(Date.now() - 14 * 864e5).toISOString()]),
    sql(`SELECT id, tel, seccion, orden, titulo, frase, url, formato FROM documentos WHERE ${DOCS_EMBAJADOR} ORDER BY seccion, orden`),
    sql("SELECT valor FROM ajustes WHERE clave = 'comision'"),
  ]);
  return { ok: true, rol: 'embajador', yo, yoDatos: yoBD[0] || {}, usuarios: [], personas, demos, proyectos: [], tareas, actividad: [], paneles: [], documentos,
    comision: (ajuste[0] || {}).valor || '', listas: { etapas: ETAPAS, temperaturas: TEMPERATURAS, servicios: SERVICIOS, origenes: ORIGENES, fases: FASES } };
}
async function conEmbajador(d, yo) {
  if (d.accion === 'inicio') return inicioEmbajador(yo);
  if (d.accion === 'salir') return { ok: true };
  if (d.accion === 'documento' || d.accion === 'archivo_parte') {
    const id = String(d.id || d.doc || '');
    const ok = (await sql(`SELECT id FROM documentos WHERE id = ? AND ${DOCS_EMBAJADOR}`, [id]))[0];
    if (!ok) return { ok: false, error: 'permiso' };
    return conSocio(d, yo);
  }
  if (d.accion === 'tarea_vista' || d.accion === 'tarea_hecha') {
    const x = (await sql('SELECT para FROM tareas WHERE id = ?', [Number(d.id)]))[0];
    if (!x || x.para !== yo.id) return { ok: false, error: 'permiso' };
    return conSocio(d, yo);
  }
  return { ok: false, error: 'permiso' };
}

const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
async function conSesion(d, yo) {
  if (yo.tipo === 'embajador') return conEmbajador(d, yo);
  return conSocio(d, yo);
}
async function conSocio(d, yo) {
  // ---- Equipo: embajadores, sus números, su acceso y la comisión (solo socios) ----
  if (yo.tipo === 'socio' && d.accion === 'equipo') {
    const [emb, demos, cierres, ajuste] = await Promise.all([
      sql("SELECT id, nombre, tel, color, activo, tope_demos, creado, (hash <> '') AS con_clave FROM usuarios WHERE tipo = 'embajador' ORDER BY creado"),
      sql("SELECT creado_por AS id, COUNT(*) n FROM demos GROUP BY creado_por"),
      sql(`SELECT u.id, COUNT(DISTINCT p.tel) n, COALESCE(SUM(p.cobro_total), 0) total, COALESCE(SUM(p.cobro_mensual), 0) mensual FROM usuarios u
           JOIN personas p ON (p.embajador = u.id OR p.tel IN (SELECT whatsapp FROM demos WHERE creado_por = u.id AND whatsapp <> ''))
           WHERE u.tipo = 'embajador' AND p.etapa IN ('cerrado', 'en órbita') AND COALESCE(p.borrado, '') = '' GROUP BY u.id`),
      sql("SELECT valor FROM ajustes WHERE clave = 'comision'"),
    ]);
    const nd = Object.fromEntries(demos.map(x => [x.id, x.n])), nc = Object.fromEntries(cierres.map(x => [x.id, x]));
    return { ok: true, comision: (ajuste[0] || {}).valor || '', embajadores: emb.map(e => Object.assign(e, { demos: nd[e.id] || 0, cierres: (nc[e.id] || {}).n || 0, cobrado: (nc[e.id] || {}).total || 0, mensual: (nc[e.id] || {}).mensual || 0 })) };
  }
  if (yo.tipo === 'socio' && d.accion === 'embajador_guardar') {
    const nombre = t(d.nombre, 60), tel = d.tel ? clave10(d.tel) : '';
    if (d.tel && !tel) return { ok: false, error: 'tel' };
    const tope = Math.max(0, Math.min(100, Number(d.tope) || 10));
    if (d.id) {
      const e = (await sql("SELECT * FROM usuarios WHERE id = ? AND tipo = 'embajador'", [String(d.id)]))[0];
      if (!e) return { ok: false };
      if (tel && (await sql("SELECT id FROM usuarios WHERE tel = ? AND id <> ?", [tel, e.id]))[0]) return { ok: false, error: 'tel_usado' };
      const activo = d.activo === undefined ? e.activo : (d.activo ? 1 : 0);
      await sql('UPDATE usuarios SET nombre = ?, tel = ?, tope_demos = ?, activo = ? WHERE id = ?', [nombre || e.nombre, d.tel !== undefined ? tel : e.tel, d.tope !== undefined ? tope : e.tope_demos, activo, e.id]);
      if (activo === 0) await sql('DELETE FROM sesiones WHERE usuario = ?', [e.id]);
      await anotar(yo.id, activo === 0 && e.activo ? `le quitó el acceso a ${e.nombre}` : activo && !e.activo ? `le regresó el acceso a ${e.nombre}` : `cambió los datos de ${nombre || e.nombre}`);
      return { ok: true, id: e.id };
    }
    if (!nombre) return { ok: false, error: 'nombre' };
    if (tel && (await sql("SELECT id FROM usuarios WHERE tel = ?", [tel]))[0]) return { ok: false, error: 'tel_usado' };
    let id = slug(nombre) || 'embajador';
    if ((await sql('SELECT id FROM usuarios WHERE id = ?', [id]))[0]) id += '-' + crypto.randomBytes(2).toString('hex');
    await sql("INSERT INTO usuarios (id, nombre, correo, color, creado, rol, tipo, tel, activo, tope_demos) VALUES (?,?,'','#e8892f',?,'Embajador','embajador',?,1,?)", [id, nombre, ahora(), tel, tope]);
    await anotar(yo.id, `agregó a ${nombre} como embajador`);
    return { ok: true, id };
  }
  if (yo.tipo === 'socio' && d.accion === 'embajador_invitar') {
    const e = (await sql("SELECT * FROM usuarios WHERE id = ? AND tipo = 'embajador' AND activo = 1", [String(d.id)]))[0];
    if (!e) return { ok: false };
    const tok = crypto.randomBytes(24).toString('base64url');
    await sql('UPDATE usuarios SET invita = ?, invita_vence = ? WHERE id = ?', [huella(tok), new Date(Date.now() + 7 * 864e5).toISOString(), e.id]);
    await anotar(yo.id, `le generó a ${e.nombre} su link de entrada`);
    return { ok: true, link: 'https://moondigitalia.com/tablero?invita=' + tok };
  }
  if (yo.tipo === 'socio' && d.accion === 'comision_guardar') {
    await sql("INSERT INTO ajustes (clave, valor) VALUES ('comision', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor", [t(d.valor, 200)]);
    await anotar(yo.id, `cambió la comisión de los embajadores: ${t(d.valor, 120) || 'por definir'}`);
    return { ok: true };
  }
  if (yo.tipo === 'socio' && d.accion === 'bitacora') {
    const antes = Number(d.antes) || 1e12;
    return { ok: true, lista: await sql('SELECT * FROM actividad WHERE id < ? ORDER BY id DESC LIMIT 100', [antes]) };
  }
  // ---- Papelera: nada se borra de golpe; se quita y se puede recuperar ----
  if (yo.tipo === 'socio' && (d.accion === 'quitar_persona' || d.accion === 'recuperar_persona')) {
    const p = (await sql('SELECT tel, nombre, negocio FROM personas WHERE tel = ?', [String(d.tel || '')]))[0];
    if (!p) return { ok: false };
    const quitar = d.accion === 'quitar_persona';
    await sql('UPDATE personas SET borrado = ? WHERE tel = ?', [quitar ? ahora() : '', p.tel]);
    await anotar(yo.id, `${quitar ? 'mandó a la papelera' : 'recuperó de la papelera'} a ${p.negocio || p.nombre || p.tel}`);
    return { ok: true };
  }
  if (yo.tipo === 'socio' && d.accion === 'papelera') {
    const [per, docs] = await Promise.all([
      sql("SELECT tel, nombre, negocio, borrado FROM personas WHERE COALESCE(borrado, '') <> '' ORDER BY borrado DESC LIMIT 200"),
      sql("SELECT id, tel, titulo, borrado FROM documentos WHERE COALESCE(borrado, '') <> '' ORDER BY borrado DESC LIMIT 200"),
    ]);
    return { ok: true, lista: per, docs };
  }
  // ---- Archivos: solo los socios cambian el nombre o los mandan a la papelera (nunca se borran de golpe) ----
  if (yo.tipo === 'socio' && ['doc_renombrar', 'doc_quitar', 'doc_recuperar'].includes(d.accion)) {
    const doc = (await sql('SELECT id, tel, titulo FROM documentos WHERE id = ?', [t(d.id, 80)]))[0];
    if (!doc) return { ok: false };
    if (d.accion === 'doc_renombrar') {
      const titulo = t(d.titulo, 120); if (!titulo) return { ok: false, error: 'titulo' };
      await sql('UPDATE documentos SET titulo = ? WHERE id = ?', [titulo, doc.id]);
      await anotar(yo.id, `le cambió el nombre a "${doc.titulo}": ahora es "${titulo}"`);
    } else {
      const quitar = d.accion === 'doc_quitar';
      await sql('UPDATE documentos SET borrado = ? WHERE id = ?', [quitar ? ahora() : '', doc.id]);
      await anotar(yo.id, `${quitar ? 'mandó a la papelera' : 'recuperó de la papelera'} el archivo "${doc.titulo}"`);
    }
    return { ok: true };
  }
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
  // Subir un archivo (presentación, contrato, fotos…) a la sección de un cliente. Va en partes para que pase
  // por cualquier internet; hasta que llega la última parte no aparece en el panel.
  if (d.accion === 'subir_inicio') {
    const moon = d.tel === 'moon', tel = moon ? 'moon' : llave(d.tel), seccion = String(d.seccion || '');
    if (!tel || !(moon ? SECCIONES_MOON : SECCIONES_CLIENTE).includes(seccion)) return { ok: false };
    if (!moon && !(await sql('SELECT tel FROM personas WHERE tel = ?', [tel]))[0]) return { ok: false };
    const tamano = Number(d.tamano) || 0; if (tamano <= 0 || tamano > 25e6) return { ok: false, error: 'tamano' };
    const id = 'a-' + crypto.randomBytes(6).toString('hex');
    const orden = (((await sql('SELECT MAX(orden) m FROM documentos WHERE tel = ? AND seccion = ?', [tel, seccion]))[0] || {}).m || 0) + 1;
    const fuente = JSON.stringify({ nombre: t(d.nombre, 160), mime: t(d.mime, 80) || 'application/octet-stream', tamano, listo: 0, subio: yo.id });
    await sql('INSERT INTO documentos (id, tel, seccion, orden, titulo, frase, url, formato, contenido, fuente, creado) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, tel, seccion, orden, t(d.titulo, 120) || t(d.nombre, 120) || 'Archivo', t(d.frase, 160), '', 'archivo', '', fuente, ahora()]);
    return { ok: true, id };
  }
  if (d.accion === 'subir_parte') {
    const id = String(d.id || ''), n = Number(d.n), datos = String(d.datos || '');
    if (!/^a-[0-9a-f]{12}$/.test(id) || !Number.isInteger(n) || n < 0 || n > 2000 || !/^[A-Za-z0-9+/=]+$/.test(datos) || datos.length > 1200000) return { ok: false };
    try { await sql('INSERT OR REPLACE INTO partes (doc, n, datos) VALUES (?,?,?)', [id, n, datos]); }
    catch (e) { return { ok: false, error: 'grande' }; }   // la parte no cupo: el celular la manda en pedazos más chicos
    return { ok: true };
  }
  if (d.accion === 'subir_fin') {
    const id = String(d.id || ''); if (!/^a-[0-9a-f]{12}$/.test(id)) return { ok: false };
    const doc = (await sql('SELECT tel, seccion, orden, titulo, fuente FROM documentos WHERE id = ?', [id]))[0]; if (!doc) return { ok: false };
    const n = ((await sql('SELECT COUNT(*) n FROM partes WHERE doc = ?', [id]))[0] || {}).n;
    if (n !== Number(d.partes)) return { ok: false, error: 'faltan' };
    const f = JSON.parse(doc.fuente || '{}'); f.listo = 1; f.partes = n;
    await sql('UPDATE documentos SET fuente = ? WHERE id = ?', [JSON.stringify(f), id]);
    const p = doc.tel === 'moon' ? { nombre: 'MOON' } : (await sql('SELECT nombre, negocio FROM personas WHERE tel = ?', [doc.tel]))[0] || {};
    // "Cambiar por otro archivo": el nuevo toma el lugar del anterior y el anterior se va a la papelera (se puede recuperar).
    const viejo = d.reemplaza ? (await sql("SELECT id, titulo, orden FROM documentos WHERE id = ? AND tel = ? AND seccion = ? AND COALESCE(borrado, '') = ''", [String(d.reemplaza), doc.tel, doc.seccion]))[0] : null;
    if (viejo) {
      await sql('UPDATE documentos SET borrado = ? WHERE id = ?', [ahora(), viejo.id]);
      await sql('UPDATE documentos SET orden = ? WHERE id = ?', [viejo.orden, id]);
      await anotar(yo.id, `cambió "${viejo.titulo}" por "${doc.titulo}" en ${p.negocio || p.nombre || 'un cliente'}`);
    } else await anotar(yo.id, `subió "${doc.titulo}" a ${p.negocio || p.nombre || 'un cliente'}`);
    return { ok: true };
  }
  if (d.accion === 'archivo_parte') {
    const id = String(d.id || ''), n = Number(d.n); if (!/^a-[0-9a-f]{12}$/.test(id)) return { ok: false };
    const r = (await sql('SELECT datos FROM partes WHERE doc = ? AND n = ?', [id, n]))[0];
    return r ? { ok: true, datos: r.datos } : { ok: false };
  }

  if (d.accion === 'documento') {
    const doc = (await sql('SELECT id, tel, seccion, titulo, frase, formato, contenido, url, enlace, fuente FROM documentos WHERE id = ?', [t(d.id, 80)]))[0];
    if (!doc) return { ok: false, error: 'no existe' };
    // Los documentos con imágenes viven cifrados dentro del proyecto (api/_docs); solo esta llave los abre.
    const cifrado = leerCifrado(doc.id);
    if (cifrado) Object.assign(doc, cifrado);
    if (doc.formato === 'md') { doc.contenido = mdAHoja(doc.contenido, doc.titulo); doc.formato = 'html'; }   // texto → documento con hojas
    if (doc.formato === 'html') Object.assign(doc, preparar(doc.contenido));
    if (doc.formato === 'archivo') { const f = JSON.parse(doc.fuente || '{}'); Object.assign(doc, { mime: f.mime, nombre: f.nombre, tamano: f.tamano, partes: f.partes || 0 }); }
    delete doc.fuente;
    // El link para mandárselo al cliente: el mismo documento, sin contraseña, en una dirección imposible de adivinar.
    if (enviable(doc) && doc.formato !== 'link') {
      if (!doc.enlace) { doc.enlace = crypto.randomBytes(16).toString('base64url'); await sql('UPDATE documentos SET enlace = ? WHERE id = ? AND enlace IS NULL', [doc.enlace, doc.id]); doc.enlace = ((await sql('SELECT enlace FROM documentos WHERE id = ?', [doc.id]))[0] || {}).enlace; }
      doc.compartir = 'https://moondigitalia.com/ver/' + doc.enlace;
    } else if (enviable(doc)) doc.compartir = doc.url;
    delete doc.enlace;
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
    for (const k of ['nombre', 'negocio', 'notas_equipo', 'telefono', 'correo', 'giro']) if (d[k] !== undefined) { set.push(k + ' = ?'); params.push(t(d[k], k === 'notas_equipo' ? 4000 : 120)); }
    if (d.foto !== undefined) { const f = fotoValida(d.foto); if (f === null) return { ok: false, error: 'foto' }; set.push('foto = ?'); params.push(f); }
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
    await sql(`INSERT INTO personas (tel, telefono, correo, foto, nombre, negocio, etapa, servicio, origen, encargados, creado, actualizado, ultimo_contacto, contactos, es_prueba)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)`,
      [tel, t(d.telefono, 30), t(d.correo, 120), fotoValida(d.foto) || '', nombre, negocio, normal(d.etapa, ETAPAS) || 'pendiente', normal(d.servicio, SERVICIOS), normal(d.origen, ORIGENES) || 'otro', listaUsuarios(d.encargados), f, f, f]);
    await anotar(yo.id, `agregó a ${negocio || nombre} al CRM`);
    return { ok: true, tel };
  }

  if (d.accion === 'proyecto') {
    const nombre = t(d.nombre, 100);
    // Un proyecto puede ir en varias fases a la vez (ej. "construcción,pruebas"); siempre en el orden de FASES.
    const pedidas = d.fase === undefined ? [] : String(d.fase).split(',').map(x => normal(x, FASES)).filter(Boolean);
    const fase = FASES.filter(x => pedidas.includes(x)).join(',');
    const enlace = d.enlace === undefined ? undefined : /^https:\/\/[^\s<>"']{3,400}$/.test(String(d.enlace).trim()) ? String(d.enlace).trim() : '';
    if (d.enlace !== undefined && String(d.enlace).trim() && !enlace) return { ok: false, error: 'enlace' };
    const f = ahora();
    if (d.id) {
      const p = (await sql('SELECT * FROM proyectos WHERE id = ?', [Number(d.id)]))[0];
      if (!p) return { ok: false };
      await sql('UPDATE proyectos SET nombre = ?, fase = ?, enlace = ?, encargados = ?, nota = ?, tel = ?, actualizado = ? WHERE id = ?',
        [nombre || p.nombre, fase || p.fase, enlace !== undefined ? enlace : (p.enlace || ''), d.encargados !== undefined ? listaUsuarios(d.encargados) : p.encargados,
         d.nota !== undefined ? t(d.nota, 2000) : p.nota, d.tel !== undefined ? llave(d.tel) : p.tel, f, p.id]);
      if (fase && fase !== p.fase) await anotar(yo.id, `puso ${p.nombre} en ${fase.split(',').join(' y ')}`);
      return { ok: true, id: p.id };
    }
    if (!nombre) return { ok: false, error: 'nombre' };
    await sql('INSERT INTO proyectos (tel, nombre, fase, enlace, encargados, nota, creado, actualizado) VALUES (?,?,?,?,?,?,?,?)',
      [llave(d.tel), nombre, fase || 'por arrancar', enlace || '', listaUsuarios(d.encargados), t(d.nota, 2000), f, f]);
    const id = (await sql('SELECT MAX(id) AS id FROM proyectos'))[0].id;
    await anotar(yo.id, `abrió el proyecto ${nombre}`);
    return { ok: true, id };
  }

  if (d.accion === 'tarea') {
    const titulo = t(d.titulo, 160);
    const emb = !USUARIOS.includes(d.para) && d.para ? (await sql("SELECT nombre FROM usuarios WHERE id = ? AND tipo = 'embajador' AND activo = 1", [String(d.para)]))[0] : null;
    const para = USUARIOS.includes(d.para) || emb ? String(d.para) : '';
    if (!titulo || !para) return { ok: false, error: 'datos' };
    const enlace = /^https?:\/\/\S+$/i.test(String(d.enlace || '').trim()) ? t(String(d.enlace).trim(), 500) : '';
    const vence = /^\d{4}-\d{2}-\d{2}$/.test(String(d.vence || '')) ? String(d.vence) : '';
    await sql('INSERT INTO tareas (proyecto, titulo, detalle, para, de, estado, vence, creado, cliente, listo, necesita, enlace) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [Number(d.proyecto) || 0, titulo, t(d.detalle, 2000), para, yo.id, 'nueva', vence, ahora(), t(d.cliente, 120), t(d.listo, 600), t(d.necesita, 600), enlace]);
    await anotar(yo.id, `le dejó una tarea a ${emb ? emb.nombre : para === 'daniel' ? 'Daniel' : para === 'dan' ? 'Dan' : 'Kid'}: ${titulo}`);
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
