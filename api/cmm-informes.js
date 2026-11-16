// Colegio María Montessori · demo de MOON Digital (16-nov-2026)
// Una familia pide informes o agenda su visita (desde la página o platicando con Monty) y Jason
// le manda el aviso por WhatsApp a quien atiende admisiones. En el demo le llega a un número del equipo de MOON;
// cuando el colegio lo use, se cambia CMM_AVISAR_A (variable en Vercel) y nada más.
// La llave de Jason vive solo en Vercel (CMM_JASON_LLAVE); este código nunca la ve el navegador.

const NIVELES = ['Maternal', 'Kínder', 'Primaria', 'Secundaria'];
const ORIGENES = { boton: 'el botón «Agendar una visita» de la página', monty: 'su plática con Monty' };
const vistos = new Map(); // freno sencillo: máximo 4 avisos por conexión cada hora

function limpio(t, max) {
  return String(t == null ? '' : t).replace(/[<>{}*_~`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function tel10(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
function bonito(t) {
  return t.slice(0, 3) + ' ' + t.slice(3, 6) + ' ' + t.slice(6);
}
function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((ok) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 8000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

async function avisarConReintento(texto) {
  const llave = process.env.CMM_JASON_LLAVE;
  const para = process.env.CMM_AVISAR_A;
  const url = process.env.JASON_PUERTA_URL || 'https://jason.moondigitalia.workers.dev/api/puerta';
  if (!llave || !para) return { ok: false, motivo: 'faltan llave o destinatario en Vercel' };
  let ultimo = '';
  for (let intento = 0; intento < 2; intento++) {
    try {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), 7000);
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + llave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'mensaje', telefono: para, texto }),
        signal: control.signal,
      });
      clearTimeout(reloj);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return { ok: true };
      ultimo = (j && j.error) || ('estado ' + r.status);
      if (r.status >= 400 && r.status < 500) break; // un error nuestro no se arregla reintentando
    } catch (e) { ultimo = e.name === 'AbortError' ? 'tardó demasiado' : e.message; }
    await new Promise((s) => setTimeout(s, 600 * (intento + 1)));
  }
  console.error('[informes] Jason no pudo avisar:', ultimo);
  return { ok: false, motivo: ultimo };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const d = await leer(req);
  if (d.sitio) { res.status(200).json({ ok: true }); return; } // casilla trampa: solo la llenan los robots

  const nombre = limpio(d.nombre, 60);
  const tel = tel10(d.whatsapp);
  if (!nombre || !tel) { res.status(400).json({ ok: false, error: 'Faltan el nombre o el WhatsApp a 10 dígitos.' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';
  const ahora = Date.now();
  const lista = (vistos.get(ip) || []).filter((t) => ahora - t < 3600e3);
  if (lista.length >= 4) { res.status(429).json({ ok: false, error: 'Ya recibimos tus datos. Admisiones te escribe muy pronto.' }); return; }
  lista.push(ahora); vistos.set(ip, lista);

  const nivel = NIVELES.includes(d.nivel) ? d.nivel : '';
  const hijo = limpio(d.hijo, 60);
  const notas = limpio(d.notas, 240);
  const visita = d.visita !== 'no';
  const origen = ORIGENES[d.origen] || ORIGENES.boton;

  const renglones = [
    '🦉 Nueva familia interesada · Colegio María Montessori',
    '',
    'Nombre: ' + nombre,
    'WhatsApp: ' + bonito(tel),
    nivel ? 'Nivel: ' + nivel : null,
    hijo ? 'Su hijo o hija: ' + hijo : null,
    'Quiere: ' + (visita ? 'agendar una visita al colegio' : 'recibir informes'),
    notas ? (d.origen === 'monty' ? 'Lo que platicó con Monty: ' : 'Dudas: ') + notas : null,
    'Llegó por: ' + origen,
    '',
    'Para escribirle ahora: https://wa.me/52' + tel,
    '',
    '(Demo de MOON Digital: cuando el colegio lo use, este aviso le llega a admisiones.)',
  ].filter((r) => r !== null);

  const texto = renglones.join('\n');
  const r = await avisarConReintento(texto);
  if (!r.ok) console.error('[informes] aviso sin entregar, datos de la familia:\n' + texto);
  // A la familia nunca se le carga el problema: si Jason falla, igual queda guardado en el registro de Vercel.
  res.status(200).json({ ok: true, avisado: r.ok });
};
