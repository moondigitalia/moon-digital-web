// FRASES QUE PUEDE DECIR LA VOZ DE LOS CUESTIONARIOS (25-nov-2026).
// Solo las frases de esta lista se pueden convertir en voz: así nadie de fuera puede gastar créditos
// pidiendo frases inventadas. Cada cuestionario tiene su grupo; cada frase, su id.
//
// "mostrar" es lo que se lee en pantalla. Lo que se escucha sale de "mostrar" cambiando las palabras
// de PRONUNCIAR (por ejemplo, en pantalla dice "Dentxlife" y la voz dice "Dent for Life").
// "toma" sube de 1 en 1 cuando una grabación sale mal y se quiere otra: la vieja deja de usarse.

// Voz de Jason (MOON Digital): "Bryan Locutor", la misma de su agente en ElevenLabs.
const VOZ_JASON = 'hEKEQC93QpOYMa6WuwWp';

// Cómo debe decir la voz ciertas palabras (Kid las aprobó escuchándolas, 25-nov-2026).
const PRONUNCIAR = {
  'MOON Digital': 'Mun Díyital',
  'Dentxlife': 'Dent for Life',
};

const CATALOGO = {
  dentxlife: {
    voz: VOZ_JASON,
    frases: {
      '01': { toma: 1, mostrar: 'Hola, Doctora. Soy Jason, de MOON Digital. Gracias por tu confianza.' },
      '02': { toma: 1, mostrar: 'Con tus respuestas preparamos la recepcionista de Dentxlife. Si alguna no la sabes, no pasa nada.' },
      '13': { toma: 1, mostrar: 'Si un paciente pregunta precios, ¿qué quieres que diga tu recepcionista?' },
    },
  },
};

module.exports = { CATALOGO, PRONUNCIAR };
