// Piezas compartidas del CRM y del Centro MOON (no es una dirección pública: Vercel ignora archivos que empiezan con "_").
const crypto = require('crypto');
const BASE = '3badeaa5-4933-42e1-89fd-7f06dd087b5b'; // moon-crm (Cloudflare D1 de MOON)

// Camino de cada cliente en el CRM de MOON.
const ETAPAS = ['pendiente', 'en proceso', 'cerrado', 'en órbita', 'portafolio', 'archivo'];
const TEMPERATURAS = ['caliente', 'tibio', 'frio'];
const SERVICIOS = ['agente de llamadas', 'página web', 'redes y campañas', 'administración', 'otro'];
const ORIGENES = ['llamada', 'whatsapp', 'cuestionario', 'demo', 'referido', 'otro'];
const FASES = ['por arrancar', 'información', 'diseño', 'construcción', 'pruebas', 'entregado'];

function igual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1500000) req.destroy(); });
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
// Clientes sin teléfono (ej. Grupo Beta) usan una llave "c-<nombre>".
function llave(v) {
  const s = String(v || '');
  if (/^c-[a-z0-9-]{1,60}$/.test(s)) return s;
  return clave10(s);
}
function sinAcentos(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function normal(v, lista) {
  const s = sinAcentos(t(v, 40));
  // Nombres viejos de etapas, por si algo los sigue mandando.
  const viejos = { nuevo: 'pendiente', agendado: 'pendiente', 'en propuesta': 'en proceso', cliente: 'cerrado', perdido: 'archivo', mantenimiento: 'en órbita', 'en orbita': 'en órbita' };
  if (lista === ETAPAS && viejos[s]) return viejos[s];
  return lista.find(x => sinAcentos(x) === s) || '';
}

module.exports = { crypto, ETAPAS, TEMPERATURAS, SERVICIOS, ORIGENES, FASES, igual, leer, sql, t, clave10, llave, normal, sinAcentos };
