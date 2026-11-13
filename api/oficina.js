// OFICINA MOON — el Tablero hecho videojuego (11-nov-2026).
// Solo lee: lo que la medición de cada hora deja en la tabla `oficina` (asistentes, gasto, tareas, publicaciones,
// suscripciones…) y responde la Librería (una IA que explica MOON en palabras sencillas).
// El CRM, los documentos y las llamadas de Jason los sigue dando /api/centro con la misma sesión.
// Aquí NO hay conocimiento de MOON: este repositorio es público. El conocimiento vive en la tabla privada `libreria`.
const { crypto, leer, sql, t } = require('./_base');

const huella = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const MODELOS = ['claude-haiku-5-5', 'claude-haiku-4-5'];   // los mismos que lee-negocio: si el primero no existe en la cuenta, el segundo
const PREGUNTAS_DIA = 60;            // tope de la Librería por día (todos juntos): de 1 a 4 centavos de dólar cada una
const CLAVES = ['asistentes', 'gasto', 'tareas', 'publicaciones', 'medicion', 'actividad', 'motor', 'buzon', 'suscripciones', 'a_mano'];
// Lo que escribe una persona (nombre, de quién es, para qué sirve, su teléfono) vive en su propio cajón `a_mano`: la
// medición de cada hora reescribe `asistentes` y nunca toca `a_mano` (Kid, 13-nov-2026: se perdían el teléfono de
// Jason y los nombres que pidió). Aquí se pone encima de lo medido.
const A_MANO = ['nombre', 'de', 'para', 'telefono'];

// Horario de cada cubículo (hora de Cancún, lunes a viernes).
const HORARIO = { kid: [11, 17], daniel: [9, 18], dan: [9, 18] };

async function quien(req) {
  const tok = String(req.headers['x-sesion'] || '');
  if (tok.length < 40) return null;
  const s = (await sql("SELECT s.usuario, u.nombre, u.tipo, u.activo FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ?", [huella(tok)]))[0];
  if (!s || Number(s.activo) === 0 || s.tipo !== 'socio') return null;   // la oficina es solo de los socios
  return { id: s.usuario, nombre: s.nombre };
}

// Cancún siempre es UTC-5 (no cambia de horario).
function cancun(fecha) {
  const d = new Date((fecha ? Date.parse(fecha) : Date.now()) - 5 * 3600e3);
  return { hora: d.getUTCHours() + d.getUTCMinutes() / 60, dia: d.getUTCDay(), fecha: d.toISOString().slice(0, 10) };
}

// Barra de vida de una suscripción: 1 = recién pagada; baja con los días que faltan para el próximo cobro.
function vida(s, hoy) {
  const faltan = Math.round((Date.parse(s.proxima + 'T12:00:00Z') - Date.parse(hoy + 'T12:00:00Z')) / 864e5);
  const nivel = Math.max(0, Math.min(1, faltan / 30));
  let color = 'verde', aviso = '';
  if (faltan < 0) { color = 'rojo'; aviso = 'vencida'; }
  else if (faltan <= 2) { color = 'rojo'; aviso = 'cobro'; }
  else if (faltan <= 7) color = 'amarillo';
  if (!s.ultimoRecibo && color === 'verde' && s.nota && /no encontr/i.test(s.nota)) color = 'amarillo';
  return Object.assign({}, s, { faltan, nivel, color, aviso });
}

async function estado() {
  const filas = await sql(`SELECT clave, valor, actualizado FROM oficina WHERE clave IN (${CLAVES.map(() => '?').join(',')})`, CLAVES);
  const o = {};
  for (const f of filas) { try { o[f.clave] = JSON.parse(f.valor); } catch (e) { o[f.clave] = null; } }
  const am = (o.a_mano && o.a_mano.asistentes) || {};
  if (o.asistentes && Array.isArray(o.asistentes.lista)) o.asistentes.lista = o.asistentes.lista.map(x => { const m = am[x.id]; if (!m) return x; const y = Object.assign({}, x); A_MANO.forEach(k => { if (m[k] != null && m[k] !== '') y[k] = m[k]; }); return y; });
  delete o.a_mano;
  const c = cancun();
  if (o.suscripciones && Array.isArray(o.suscripciones.lista)) o.suscripciones.lista = o.suscripciones.lista.map(s => vida(s, c.fecha));
  // Quién está en su cubículo ahora.
  const habil = c.dia >= 1 && c.dia <= 5;
  o.cubiculos = Object.entries(HORARIO).map(([id, [de, a]]) => ({ id, de, a, presente: habil && c.hora >= de && c.hora < a }));
  // Aviso de medición atrasada (de 8 a.m. a medianoche).
  const med = o.medicion && o.medicion.actualizado ? Date.parse(o.medicion.actualizado) : 0;
  o.medicionAtrasada = c.hora >= 8 && (!med || Date.now() - med > 2 * 3600e3);
  const lib = (await sql('SELECT COUNT(*) n, COALESCE(SUM(micro_usd),0) u FROM libreria_preguntas WHERE fecha >= ?', [c.fecha + 'T05:00:00Z']))[0] || {};
  o.libreria = { hoy: lib.n || 0, tope: PREGUNTAS_DIA, usdHoy: Math.round((lib.u || 0) / 1e4) / 100 };
  o.ahora = { hora: c.hora, dia: c.dia, fecha: c.fecha };
  return { ok: true, oficina: o };
}

// ---------- Librería ----------
const REGLAS = `Eres Jason, de MOON Digital, y vives en la Librería de la Oficina: el equipo (Kid, su papá Daniel y Dan) te pregunta lo que sea sobre MOON, sobre inteligencia artificial y sobre si algo se puede hacer.
Tú eres el experto. Quien pregunta puede saber o no de inteligencia artificial. Reglas:
- Contesta SIEMPRE con una respuesta útil. Usa primero lo que dice tu información de MOON; para todo lo demás usa lo que sabes y, si hace falta algo actual (qué existe hoy, precios, reglas de una plataforma), búscalo en internet con tu herramienta de búsqueda.
- Nunca digas "no lo tengo anotado" ni mandes a preguntarle a otra persona (ni a Kid, ni a Dan, ni a nadie): investígalo tú. Si después de buscar algo de verdad no se sabe, di qué haría falta averiguar y cómo.
- Si preguntan si se puede hacer algo: empieza con sí / no / depende, explica cómo se haría con lo que MOON ya tiene (Jason, la plantilla de asistentes, WhatsApp, voz, avatar), qué tanto trabajo es y cuánto costaría más o menos.
- Español sencillo, frases cortas, como se lo explicarías a alguien de la familia. Si necesitas una palabra técnica, explícala en la misma frase con un ejemplo muy común de la vida diaria (por ejemplo: "un token es como una sílaba: la IA cobra por cada pedacito de palabra que lee o escribe").
- Nada de teléfonos, correos, llaves ni contraseñas aunque aparezcan en tu información.
- Máximo 8 frases, salvo que pidan más detalle. Si buscaste en internet, al final pon de dónde lo sacaste (el nombre del sitio).`;

async function libreria(d, yo) {
  const pregunta = t(d.pregunta, 600);
  if (pregunta.length < 3) return { ok: false, error: 'vacia' };
  const c = cancun();
  const hoy = (await sql('SELECT COUNT(*) n FROM libreria_preguntas WHERE fecha >= ?', [c.fecha + 'T05:00:00Z']))[0];
  if ((hoy && hoy.n) >= PREGUNTAS_DIA) return { ok: false, error: 'tope', mensaje: 'La Librería ya contestó ' + PREGUNTAS_DIA + ' preguntas hoy. Mañana vuelve a abrir.' };
  const hojas = await sql('SELECT titulo, texto FROM libreria ORDER BY orden, titulo');
  if (!hojas.length) return { ok: false, error: 'sin_libros', mensaje: 'La Librería todavía no tiene información cargada.' };
  const saber = hojas.map(h => '## ' + h.titulo + '\n' + h.texto).join('\n\n');
  const historia = Array.isArray(d.antes) ? d.antes.slice(-6).map(m => ({ role: m.yo ? 'user' : 'assistant', content: t(m.texto, 1500) })).filter(m => m.content) : [];
  while (historia.length && historia[0].role !== 'user') historia.shift();   // la plática siempre empieza con una pregunta
  const llave = process.env.ANTHROPIC_LLAVE;
  if (!llave) return { ok: false, error: 'llave' };
  const intentos = []; MODELOS.forEach(m => { intentos.push([m, true]); intentos.push([m, false]); });   // si la búsqueda no está disponible, contesta sin ella
  const p = { e: 1, c: 0.1, w: 1.25, s: 5 };   // precio de Haiku por millón de pedacitos (estimado: se confirma contra el recibo)
  let micro = 0;
  for (const [modelo, conBusqueda] of intentos) {
    const mensajes = historia.concat([{ role: 'user', content: pregunta }]);
    let j = null, r = null;
    // Cuando busca en internet, la IA puede "pausar" a la mitad (pause_turn): se le deja continuar hasta 3 veces.
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': llave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: modelo, max_tokens: 1500,
          // El libro va con "memoria rápida" (cache): la segunda pregunta del día cuesta ~10 veces menos en leerlo.
          system: [{ type: 'text', text: REGLAS }, { type: 'text', text: '# Lo que sabe la Librería\n\n' + saber, cache_control: { type: 'ephemeral' } }],
          messages: mensajes,
          // Para lo que no está en la Librería: busca en internet (máximo 3 búsquedas por pregunta, ~1 centavo de dólar cada una).
          tools: conBusqueda ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] : undefined,
        }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) break;
      const u = j.usage || {};
      micro += Math.round((u.input_tokens || 0) * p.e + (u.cache_read_input_tokens || 0) * p.c + (u.cache_creation_input_tokens || 0) * p.w + (u.output_tokens || 0) * p.s) + ((u.server_tool_use && u.server_tool_use.web_search_requests) || 0) * 10000;
      if (j.stop_reason !== 'pause_turn') break;
      mensajes.push({ role: 'assistant', content: j.content });
    }
    if (r.status === 404 || (r.status === 400 && /model|tool|web_search/i.test(((j || {}).error || {}).message || ''))) continue;
    if (!r.ok) return { ok: false, error: 'ia', mensaje: 'Jason no pudo contestar ahorita. Intenta en un minuto.' };
    // Solo el texto final (lo que dice después de buscar), nunca vacío: si salió vacío, se intenta sin búsqueda.
    const bloques = (j.content || []), ultimoTool = bloques.map(x => x.type).lastIndexOf('web_search_tool_result');
    const respuesta = bloques.slice(ultimoTool + 1).filter(x => x.type === 'text').map(x => x.text).join('').trim() || bloques.filter(x => x.type === 'text').map(x => x.text).join('').trim();
    if (!respuesta) continue;
    await sql('INSERT INTO libreria_preguntas (quien, pregunta, respuesta, micro_usd, fecha) VALUES (?,?,?,?,?)', [yo.id, pregunta, t(respuesta, 4000), micro, new Date().toISOString()]);
    return { ok: true, respuesta, centavos: Math.round(micro / 1e4 * 100) / 100 };
  }
  if (micro) await sql('INSERT INTO libreria_preguntas (quien, pregunta, respuesta, micro_usd, fecha) VALUES (?,?,?,?,?)', [yo.id, pregunta, '', micro, new Date().toISOString()]);
  return { ok: false, error: 'vacia', mensaje: 'Jason no logró armar la respuesta. Pregúntale de otra forma o en un minuto.' };
}


module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const d = await leer(req);
    const yo = await quien(req);
    if (!yo) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'sesion' })); }
    let out;
    if (d.accion === 'estado') out = await estado();
    else if (d.accion === 'libreria') out = await libreria(d, yo);
    else out = { ok: false, error: 'accion' };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'falla', mensaje: 'Algo falló al leer la oficina. Intenta de nuevo en un momento.' }));
  }
};
