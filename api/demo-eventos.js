// Fotos del equipo y logo para la demo de Tablero de Eventos (28-oct-2026).
// Viven cifradas en api/_docs (el código es público; las fotos de personas nunca van en claro).
const { leerCifrado } = require('./_visor');
module.exports = (req, res) => {
  const d = leerCifrado('qualitas-eventos');
  if (!d) { res.status(404).json({ ok: false }); return; }
  const fotos = {}; for (const k in d) fotos[k] = `data:${d[k][0]};base64,${d[k][1]}`;
  res.setHeader('Cache-Control', 'no-store');   // nunca una versión vieja guardada (por eso un día no salió el logo)
  res.status(200).json({ ok: true, fotos });
};
