// LEER EL NEGOCIO (23-oct-2026)
// Quien arma su recepcionista puede pegar el link de su página web o subir una foto o PDF de su menú/lista de precios.
// Aquí se lee eso y Claude devuelve los datos para llenar el formulario: a qué se dedica, servicios y precios, horario y dirección.
// La persona revisa lo que se llenó antes de crear el demo (el asistente nunca debe decir un precio equivocado).
// Facebook e Instagram no se pueden leer (piden iniciar sesión): se le pide una foto o PDF.
// Llave: ANTHROPIC_LLAVE en Vercel. Tope: LECTURAS_DIA por día para que nadie dispare el gasto.
const { sql, t } = require('./_base');
const { leerConNavegador } = require('./_navegador');

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

// (24-nov-2026) Páginas hechas con React/Vite/Lovable: el HTML llega vacío y TODO el texto vive dentro del archivo de código.
// En vez de pedir foto o PDF, se abre ese archivo y se sacan solo las frases humanas (no el código ni los nombres de estilos).
// Recorre el código letra por letra (como lo leería el navegador) y junta cada texto entre comillas.
// Buscar comillas "a lo bruto" se desfasa con un apóstrofo suelto y se pierden frases (pasó con "Lunes a Domingo").
function textosDelCodigo(js) {
  const out = []; const n = Math.min(js.length, 4000000); let i = 0, previo = '';
  const puedeSerRegex = () => /[(,=:[!&|?{};+\-*%<>~^]$|^$/.test(previo) || /\b(return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/.test(previo);
  const leerCadena = (q) => { let t = ''; i++; while (i < n) { const c = js[i]; if (c === '\\') { t += js.slice(i, i + 2); i += 2; continue; } if (c === q || (c === '\n' && q !== '`')) { i++; break; } t += c; i++; } return t; };
  const pila = [];   // llaves abiertas dentro de ${ } de un texto con comillas invertidas
  // Lee el cuerpo de un texto con comillas invertidas desde la posición actual, hasta su cierre o hasta un ${.
  const leerPlantilla = () => { let t = ''; while (i < n) { const c = js[i]; if (c === '\\') { t += js.slice(i, i + 2); i += 2; continue; } if (c === '`') { i++; break; } if (c === '$' && js[i + 1] === '{') { i += 2; pila.push(0); break; } t += c; i++; } out.push(t); };
  while (i < n) {
    const c = js[i];
    if (c === '"' || c === "'") { out.push(leerCadena(c)); previo = 'x'; continue; }
    if (c === '`') { i++; leerPlantilla(); previo = 'x'; continue; }
    if (pila.length && c === '{') { pila[pila.length - 1]++; i++; previo = '{'; continue; }
    if (pila.length && c === '}') { if (pila[pila.length - 1] === 0) { pila.pop(); i++; leerPlantilla(); previo = 'x'; continue; } pila[pila.length - 1]--; i++; previo = '}'; continue; }
    if (c === '/' && js[i + 1] === '/') { while (i < n && js[i] !== '\n') i++; continue; }
    if (c === '/' && js[i + 1] === '*') { const k = js.indexOf('*/', i + 2); i = k < 0 ? n : k + 2; continue; }
    if (c === '/' && puedeSerRegex()) { i++; let clase = false; while (i < n) { const d = js[i]; if (d === '\\') { i += 2; continue; } if (d === '[') clase = true; else if (d === ']') clase = false; else if (d === '/' && !clase) { i++; break; } else if (d === '\n') break; i++; } while (/[a-z]/i.test(js[i] || '')) i++; previo = 'x'; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (/[\w$]/.test(c)) { let k = i; while (k < n && /[\w$]/.test(js[k])) k++; previo = js.slice(i, k); i = k; continue; }
    previo = c; i++;
  }
  return out;
}
function frasesDelCodigo(js) {
  const out = new Set();
  for (const crudo of textosDelCodigo(js)) {
    if (crudo.length < 3 || crudo.length > 1500) continue;
    const x = crudo.replace(/\\n/g, ' ').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').trim();
    if (x.length < 3 || out.has(x)) continue;
    if (/[{};=<>|]|=>|&&|\bfunction\b|\breturn\b|\bconst\b|\bnull\b|\bundefined\b|^https?:|^\/|\.(js|css|png|jpe?g|svg|webp)\b|^[a-z]+[A-Z]\w*$/.test(x)) continue;
    const palabras = x.split(' ');
    const tecnicas = palabras.map(w => w.replace(/[.,:;!?)"']+$/, '')).filter(w => /[-:\/\[\]#_.@]/.test(w) && !/^\$?[\d.,]+$/.test(w)).length;
    if (tecnicas / palabras.length > 0.3) continue;                                    // nombres de estilos ("flex items-center")
    const conLetras = palabras.filter(w => /^[¡¿("'$]?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ$\d][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\d.,!?¡¿:;%'")·$-]*$/.test(w)).length;
    if (conLetras / palabras.length < 0.8) continue;
    const precio = /\$\s?\d/.test(x);
    if (palabras.length < 2 && !precio && !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}$/.test(x)) continue;  // palabras sueltas solo si son nombre o precio
    out.add(x);
  }
  return [...out].join('\n');
}
async function textoDelCodigo(html, base) {
  const host = new URL(base).host;
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => { try { return new URL(m[1], base); } catch (e) { return null; } })
    .filter(u => u && u.host === host && /\.m?js(\?|$)/.test(u.pathname)).slice(0, 3);
  const leidos = new Set(), partes = [];
  const bajar = async u => {
    if (leidos.has(u.href) || leidos.size >= 10) return null; leidos.add(u.href);
    const c = new AbortController(); const reloj = setTimeout(() => c.abort(), 6000);
    try { const r = await fetch(u.href, { signal: c.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOON-Digital-lector/1.0)' } }); return r.ok ? (await r.text()).slice(0, 4000000) : null; }
    catch (e) { return null; } finally { clearTimeout(reloj); }
  };
  // Todo a la vez (no uno tras otro) para no pasarnos del tiempo: a lo mucho ~12 s extra.
  await Promise.all(srcs.map(async u => {
    const js = await bajar(u); if (!js) return;
    partes.push(frasesDelCodigo(js));
    // Las secciones que se cargan aparte (otras páginas del sitio) vienen en archivos vecinos.
    const vecinos = [...js.matchAll(/["'`](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["'`]/g)].map(m => { try { return new URL(m[1], u); } catch (e) { return null; } })
      .filter(v => v && v.host === host && !leidos.has(v.href)).slice(0, 7);
    const mas = await Promise.all(vecinos.map(bajar));
    mas.forEach(x => x && partes.push(frasesDelCodigo(x)));
  }));
  return partes.join('\n');
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
  // Página hecha con código (React, Vite, Lovable…): llega casi vacía.
  // 1) Se abre con un navegador de verdad y se lee lo que ve un visitante (incluye listas que cargan aparte).
  // 2) Si el navegador no pudo, se saca el texto del archivo de código. Las dos cosas corren al mismo tiempo.
  if (texto.replace(/\s/g, '').length < 800) {
    const [vista, delCodigo] = await Promise.all([leerConNavegador(p.final, 25000).catch(() => null), textoDelCodigo(p.html, p.final).catch(() => '')]);
    const visto = vista && vista.texto.replace(/\s+\n/g, '\n').trim();
    if (visto && visto.replace(/\s/g, '').length >= 300) {
      texto = ('Página: ' + vista.final + '\n' + [vista.titulo && 'Título: ' + vista.titulo, vista.desc && 'Descripción: ' + vista.desc].filter(Boolean).join('\n') + '\n' + visto).slice(0, MAX_TEXTO);
    } else if (delCodigo) {
      texto = (texto + '\n\nTexto de la página (sacado de su código; puede traer textos del sistema, como avisos o meses en inglés: usa solo lo que sea del negocio):\n' + delCodigo).slice(0, MAX_TEXTO);
    }
  }
  // Si aun así casi no hay texto, se pide foto o PDF.
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
  'Escribe en español, claro y corto: "giro" en máximo 8 palabras (ej. "Repostería artesanal en Mérida") y "ubicacion" en máximo 15 palabras. Copia los precios exactamente como aparecen (con su moneda). Ignora menús de navegación, avisos legales y textos de cookies.';

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
    // Por si la IA se alarga: se corta en la última coma o punto y coma que quepa (nunca a media palabra).
    const corto = (v, max) => { v = t(v, 2000); if (v.length <= max) return v; const c = v.slice(0, max); const i = Math.max(c.lastIndexOf(','), c.lastIndexOf(';'), c.lastIndexOf('.')); return (i > max * 0.4 ? c.slice(0, i) : c.slice(0, c.lastIndexOf(' '))).trim(); };
    return { datos: { negocio: t(x.negocio, 80), giro: corto(x.giro, 70), servicios: corto(x.servicios, 1400), horario: corto(x.horario, 160), ubicacion: corto(x.ubicacion, 120) }, modelo };
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
