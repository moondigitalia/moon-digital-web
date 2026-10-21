// JASON · ¿QUIÉN LLAMA? (21-oct-2026)
// Cuando entra una llamada al número de Jason, ElevenLabs pregunta aquí ANTES de contestar.
// Con el número de quien llama buscamos en la agenda de MOON (Apps Script "Jason - Agenda y avisos")
// si ya nos conoce: nombre, negocio y su próxima cita. Así Jason puede decir "¿Hablo con Daniel?".
// Regla de oro: esto NUNCA puede tumbar una llamada. Si algo falla o tarda, respondemos al instante
// con "no lo conocemos" y Jason contesta como siempre.
// La clave interna llega en el encabezado x-clave (la pone ElevenLabs); aquí no se guarda ninguna llave.
const AGENDA = 'https://script.google.com/macros/s/AKfycbzmjh39HaP39rdzK3PJdKMULk43T9uvQNwcriSdpzbIRgLC3Xppu9MezL4byJTb4kgX/exec';
const JASON = 'agent_3301m5axkdjpe7wtaqd082bze9fc';
const ESPERA_MS = 3500;

function vacio() {
  return { cliente_conocido: 'no', cliente_nombre: '', cliente_negocio: '', cliente_necesidad: '', cliente_cita: '' };
}

function leer(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(ok => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 20000) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } });
    req.on('error', () => ok({}));
  });
}

function limpio(t, max) {
  return String(t || '').replace(/[{}<>]/g, '').trim().slice(0, max);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const vars = vacio();
  const contestar = (extra) => res.status(200).json(Object.assign({ type: 'conversation_initiation_client_data', dynamic_variables: vars }, extra || {}));
  if (req.method !== 'POST') { contestar(); return; }
  const d = await leer(req);
  const clave = req.headers['x-clave'];
  if (!clave || (d.agent_id && d.agent_id !== JASON) || !d.caller_id) { contestar(); return; }

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const r = await fetch(AGENDA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'llamante', clave, telefono: d.caller_id }),
      redirect: 'follow',
      signal: control.signal,
    });
    const x = await r.json();
    if (x && x.conocido === 'sí') {
      vars.cliente_conocido = 'sí';
      vars.cliente_nombre = limpio(x.nombre, 60);
      vars.cliente_negocio = limpio(x.negocio, 120);
      vars.cliente_necesidad = limpio(x.necesidad, 200);
      vars.cliente_cita = limpio(x.cita, 120);
    }
  } catch (e) {
    console.log('JASON-LLAMANTE sin respuesta de la agenda:', e.name);
  } finally {
    clearTimeout(reloj);
  }

  const nombre = vars.cliente_nombre.split(' ')[0];
  if (vars.cliente_conocido === 'sí' && nombre) {
    contestar({ conversation_config_override: { agent: { first_message: `MOON Digital, te atiende Jason. ¿Hablo con ${nombre}?` } } });
    return;
  }
  contestar();
};
