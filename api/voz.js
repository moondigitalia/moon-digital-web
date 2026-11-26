// VOZ DE LOS CUESTIONARIOS (25-nov-2026).
// La página pide una frase (por ejemplo /api/voz?c=dentxlife&f=13) y recibe su audio con el tiempo exacto
// de cada palabra, para iluminarlas como karaoke.
// Cada frase se le pide a ElevenLabs UNA sola vez: se guarda en la base moon-cuestionarios (tabla voces)
// y de ahí se sirve siempre. Si el texto cambia o se sube la "toma", se graba de nuevo sola.
// Solo existen las frases de api/_voces/catalogo.js: nadie puede pedir frases inventadas.
// Llaves (todas de MOON, en Vercel): ELEVENLABS_VOZ (solo texto a voz, tope de créditos al mes),
// CF_ACCOUNT_ID y CF_D1_TOKEN (las mismas del buzón de cuestionarios).
const crypto = require('crypto');
const { CATALOGO, PRONUNCIAR } = require('./_voces/catalogo.js');

const BASE = '815fc6e5-71ed-4f8c-b7e2-4e66615e8688'; // moon-cuestionarios
const MODELO = 'eleven_multilingual_v2';
// Los mismos ajustes con los que Kid aprobó cómo suena Jason (25-nov-2026).
const AJUSTES = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

async function d1(sql, params) {
  const { CF_ACCOUNT_ID, CF_D1_TOKEN } = process.env;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${BASE}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_D1_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error('d1 ' + r.status + ' ' + JSON.stringify(j.errors || ''));
  return (j.result && j.result[0] && j.result[0].results) || [];
}

let tablaLista = false;
async function asegurarTabla() {
  if (tablaLista) return;
  await d1(`CREATE TABLE IF NOT EXISTS voces (
    clave TEXT PRIMARY KEY, grupo TEXT, frase TEXT, toma INTEGER, texto TEXT,
    audio TEXT, palabras TEXT, creado TEXT DEFAULT CURRENT_TIMESTAMP)`);
  tablaLista = true;
}

// Parte el texto de pantalla en pedazos: los normales se dicen igual; los de PRONUNCIAR se dicen distinto.
function pedazos(mostrar) {
  const llaves = Object.keys(PRONUNCIAR).sort((a, b) => b.length - a.length);
  const re = new RegExp('(' + llaves.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  return mostrar.split(re).filter(Boolean).map(p => ({ mostrar: p, decir: PRONUNCIAR[p] || p }));
}

// Para cada letra de pantalla: qué letras de lo que se dice le tocan (para saber su tiempo).
function mapaDeLetras(partes) {
  const mapa = []; let i = 0;
  for (const p of partes) {
    const m = p.mostrar.length, d = p.decir.length;
    for (let k = 0; k < m; k++) {
      if (p.mostrar === p.decir) mapa.push([i + k, i + k]);
      else mapa.push([i + Math.floor(k * d / m), i + Math.max(Math.floor((k + 1) * d / m) - 1, Math.floor(k * d / m))]);
    }
    i += d;
  }
  return mapa;
}

// Palabras de pantalla con el segundo en que empiezan y terminan de decirse.
function palabrasConTiempo(mostrar, decir, al) {
  const ini = al.character_start_times_seconds, fin = al.character_end_times_seconds;
  const n = ini.length, mapa = mapaDeLetras(pedazos(mostrar));
  // Si ElevenLabs devolvió un número distinto de letras, se reparte en proporción (nunca falla).
  const aIndice = j => (n === decir.length ? j : Math.min(n - 1, Math.round(j * (n - 1) / Math.max(1, decir.length - 1))));
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(mostrar))) {
    const a = mapa[m.index][0], b = mapa[m.index + m[0].length - 1][1];
    out.push({ t: m[0], ini: +ini[aIndice(a)].toFixed(3), fin: +fin[aIndice(b)].toFixed(3) });
  }
  return out;
}

module.exports = async (req, res) => {
  const c = String(req.query.c || ''), f = String(req.query.f || '');
  const grupo = CATALOGO[c], frase = grupo && grupo.frases[f];
  if (!frase) { res.status(404).json({ ok: false }); return; }
  if (!process.env.ELEVENLABS_VOZ || !process.env.CF_D1_TOKEN) { res.status(503).json({ ok: false, falta: 'llaves' }); return; }

  const decir = pedazos(frase.mostrar).map(p => p.decir).join('');
  const clave = `${c}:${f}:${frase.toma}:` + crypto.createHash('sha1').update(grupo.voz + '|' + decir).digest('hex').slice(0, 12);
  try {
    await asegurarTabla();
    let fila = (await d1('SELECT audio, palabras FROM voces WHERE clave = ?', [clave]))[0];
    if (!fila) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${grupo.voz}/with-timestamps?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_VOZ, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: decir, model_id: MODELO, voice_settings: AJUSTES, language_code: 'es' }),
      });
      if (!r.ok) {
        console.log('VOZ-ELEVENLABS', r.status, (await r.text()).slice(0, 300));
        res.status(502).json({ ok: false }); return;
      }
      const j = await r.json();
      const palabras = palabrasConTiempo(frase.mostrar, decir, j.alignment);
      fila = { audio: j.audio_base64, palabras: JSON.stringify(palabras) };
      await d1('INSERT OR IGNORE INTO voces (clave, grupo, frase, toma, texto, audio, palabras) VALUES (?,?,?,?,?,?,?)',
        [clave, c, f, frase.toma, frase.mostrar, fila.audio, fila.palabras]);
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
    res.status(200).json({ ok: true, texto: frase.mostrar, audio: fila.audio, palabras: JSON.parse(fila.palabras) });
  } catch (e) {
    console.log('VOZ-ERROR', String(e).slice(0, 300));
    res.status(502).json({ ok: false });
  }
};
