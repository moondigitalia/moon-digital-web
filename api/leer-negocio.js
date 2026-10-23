// LEER EL NEGOCIO (23-oct-2026)
// Quien arma su recepcionista puede pegar el link de su página web o subir una foto o PDF de su menú/lista de precios.
// Aquí se lee eso y Claude devuelve los datos para llenar el formulario: a qué se dedica, servicios y precios, horario y dirección.
// La persona revisa lo que se llenó antes de crear el demo (el asistente nunca debe decir un precio equivocado).
// Facebook e Instagram no se pueden leer (piden iniciar sesión): se le pide una foto o PDF.
// Llave: ANTHROPIC_LLAVE en Vercel. Tope: LECTURAS_DIA por día para que nadie dispare el gasto.
const { sql, t } = require('./_base');

const MODELOS = ['claude-haiku-5-5', 'claude-haiku-4-5'];   // si el primero no existe en la cuenta, se usa el segundo
const LECTURAS_DIA = 150;
const MAX_TEXTO = 60000;
const RED_SOCIAL = /(^|\.)(facebook|fb|instagram|tiktok|wa|whatsapp|linktr)\.(com|me|ee)$/i;
const PAGINAS_UTILES = /(men[uú]|carta|precio|servicio|tratamiento|producto|tarifa|paquete|contacto|horario|ubicaci|sucursal|nosotros|about)/i;
const ahora = () => new Date().toISOString();
const inicioHoy = () => { const d = new Date(Date.now() - 5 * 36e5); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5)).toISOString(); };

function leerCuerpo(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 4400000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

async function traer(url, ms) {
  const c = new AbortController(); const reloj = setTimeout(() => c.abort(), ms || 9000);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOON-Digital-lector/1.0)', 'Accept-Language': 'es-MX,es;q=0.9' } });
    if (!r.ok || !/html|text/i.test(r.headers.get('content-type') || '')) return null;
    const html = (await r.text()).slice(0, 1500000);
    return { html, final: r.url || url };
  } catch (e) { return null; } finally { clearTimeout(reloj); }
}

const entidades = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&[a-z]+;/gi, ' ');
function aTexto(html) {
  const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || '';
  // Los datos estructurados suelen traer horario, dirección y teléfono exactos.
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim()).join('\n').slice(0, 8000);
  const cuerpo = html.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|p|div|li|h\d|tr|section|article)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  const texto = entidades(cuerpo).replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return [titulo && 'Título: ' + entidades(titulo), desc && 'Descripción: ' + entidades(desc), ld && 'Datos estructurados: ' + ld, texto].filter(Boolean).join('\n');
}
function enlacesUtiles(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.host !== new URL(base).host || !/^https?:$/.test(u.protocol)) continue;
      if (PAGINAS_UTILES.test(u.pathname) || PAGINAS_UTILES.test(m[2].replace(/<[^>]+>/g, ''))) out.add(u.href.split('#')[0]);
    } catch (e) {}
    if (out.size >= 3) break;
  }
  return [...out];
}

async function leerSitio(entrada) {
  let url = String(entrada || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return { error: 'link' }; }
  if (RED_SOCIAL.test(host)) return { error: 'red_social' };
  const p = await traer(url, 7000);
  if (!p) return { error: 'no_abre' };
  let texto = 'Página: ' + p.final + '\n' + aTexto(p.html);
  const extra = await Promise.all(enlacesUtiles(p.html, p.final).map(u => traer(u, 5000).then(x => x ? '\n\nPágina: ' + x.final + '\n' + aTexto(x.html) : '')));
  texto = (texto + extra.join('')).slice(0, MAX_TEXTO);
  // Páginas hechas solo con código (sin texto real) no se pueden leer sin un navegador: se pide foto o PDF.
  if (texto.replace(/\s/g, '').length < 300) return { error: 'poco_texto' };
  return { texto };
}

const HERRAMIENTA = {
  name: 'datos_del_negocio',
  description: 'Entrega los datos del negocio que se encontraron, para que su recepcionista virtual sepa qué contestar.',
  input_schema: {
    type: 'object',
    properties: {
      negocio: { type: 'string', description: 'Nombre comercial del negocio. Vacío si no aparece.' },
      giro: { type: 'string', description: 'A qué se dedica, en máximo 8 palabras, con la ciudad principal si aparece. Ej. "Clínica dental en Cancún" o "Repostería artesanal en Mérida".' },
      servicios: { type: 'string', description: 'Servicios o productos con su precio tal como aparecen, separados por coma. Ej. "Limpieza dental $600, Blanqueamiento $2,500". Máximo 1200 caracteres; si hay muchos, los más importantes o representativos. Sin precio si no aparece. Vacío si no hay.' },
      horario: { type: 'string', description: 'Horario de atención tal como aparece, en una línea. Vacío si no aparece.' },
      ubicacion: { type: 'string', description: 'Dirección o ciudad, en una línea corta (si hay muchas sucursales, las principales). Vacío si no aparece.' },
    },
    required: ['negocio', 'giro', 'servicios', 'horario', 'ubicacion'],
  },
};
const INSTRUCCIONES = 'Lees la información de un negocio (su página web, un menú, una lista de precios o un folleto) para llenar los datos de su recepcionista virtual. ' +
  'Usa SOLO lo que aparece; nunca inventes precios, horarios, servicios ni direcciones. Si algo no aparece, déjalo vacío. ' +
  'Escribe en español, claro y corto. Copia los precios exactamente como aparecen (con su moneda). Ignora menús de navegación, avisos legales y textos de cookies.';

async function preguntarAClaude(contenido) {
  const llave = process.env.ANTHROPIC_LLAVE;
  if (!llave) return { error: 'sin_llave' };
  for (const modelo of MODELOS) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': llave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: 1500, system: INSTRUCCIONES, tools: [HERRAMIENTA], tool_choice: { type: 'tool', name: HERRAMIENTA.name }, messages: [{ role: 'user', content: contenido }] }),
    }).catch(() => null);
    if (!r) return { error: 'ia' };
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || (j.error && /model/i.test(j.error.message || '') && r.status === 400)) continue;   // ese modelo no está: se prueba el siguiente
    if (!r.ok) { console.log('LEER-IA', r.status, JSON.stringify(j.error || '').slice(0, 300)); return { error: r.status === 400 && /credit|balance/i.test(JSON.stringify(j)) ? 'sin_saldo' : 'ia' }; }
    const uso = (j.content || []).find(c => c.type === 'tool_use');
    if (!uso) return { error: 'ia' };
    const x = uso.input || {};
    return { datos: { negocio: t(x.negocio, 80), giro: t(x.giro, 200), servicios: t(x.servicios, 1500), horario: t(x.horario, 200), ubicacion: t(x.ubicacion, 200) }, modelo };
  }
  return { error: 'ia' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const d = await leerCuerpo(req);
  try {
    await sql('CREATE TABLE IF NOT EXISTS demo_lecturas (fecha TEXT, tipo TEXT, ok INTEGER, detalle TEXT)');
    const hoy = ((await sql('SELECT COUNT(*) n FROM demo_lecturas WHERE fecha >= ?', [inicioHoy()]))[0] || {}).n || 0;
    if (hoy >= LECTURAS_DIA) { res.status(200).json({ ok: false, error: 'lleno' }); return; }

    let contenido, tipo;
    if (d.url) {
      tipo = 'pagina';
      const s = await leerSitio(d.url);
      if (s.error) { await sql('INSERT INTO demo_lecturas VALUES (?,?,0,?)', [ahora(), tipo, s.error + ' ' + t(d.url, 150)]); res.status(200).json({ ok: false, error: s.error }); return; }
      contenido = [{ type: 'text', text: s.texto }];
    } else if (d.archivo && d.tipo) {
      const media = String(d.tipo);
      const datos = String(d.archivo).replace(/^data:[^,]*,/, '');
      if (datos.length > 4300000) { res.status(200).json({ ok: false, error: 'grande' }); return; }
      if (media === 'application/pdf') { tipo = 'pdf'; contenido = [{ type: 'document', source: { type: 'base64', media_type: media, data: datos } }]; }
      else if (/^image\/(jpeg|png|webp|gif)$/.test(media)) { tipo = 'foto'; contenido = [{ type: 'image', source: { type: 'base64', media_type: media, data: datos } }]; }
      else { res.status(200).json({ ok: false, error: 'formato' }); return; }
      contenido.push({ type: 'text', text: 'Este es el menú, lista de precios o folleto del negocio.' });
    } else { res.status(200).json({ ok: false, error: 'nada' }); return; }

    const r = await preguntarAClaude(contenido);
    await sql('INSERT INTO demo_lecturas VALUES (?,?,?,?)', [ahora(), tipo, r.datos ? 1 : 0, r.error || r.modelo || '']);
    if (!r.datos) { res.status(200).json({ ok: false, error: r.error }); return; }
    const algo = Object.values(r.datos).some(v => v);
    res.status(200).json(algo ? { ok: true, datos: r.datos } : { ok: false, error: 'nada_encontrado' });
  } catch (err) {
    console.log('LEER-ERROR', err.message);
    res.status(502).json({ ok: false, error: 'base' });
  }
};
