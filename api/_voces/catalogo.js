// FRASES QUE PUEDE DECIR LA VOZ DE LOS CUESTIONARIOS (25-nov-2026).
// Solo las frases de esta lista se pueden convertir en voz: así nadie de fuera puede gastar créditos
// pidiendo frases inventadas. Cada cuestionario tiene su grupo; cada frase, su id.
//
// "mostrar" es lo que se lee en pantalla. Lo que se escucha sale de "mostrar" cambiando las palabras
// de PRONUNCIAR (en pantalla dice "Dentxlife" y la voz dice "Dent for Life") y, si la frase trae
// "decir", también esos cambios solo para esa frase (por ejemplo horas: "7:30" se dice "siete y media").
// "toma" sube de 1 en 1 cuando una grabación sale mal y se quiere otra: la vieja deja de usarse.
// Regla de Kid: ninguna frase pasa de 4 renglones en un celular chico (unas 100 letras).

// Voz de Jason (MOON Digital): "Bryan Locutor", la misma de su agente en ElevenLabs.
const VOZ_JASON = 'hEKEQC93QpOYMa6WuwWp';

// Cómo debe decir la voz ciertas palabras (Kid las aprobó escuchándolas, 25-nov-2026).
const PRONUNCIAR = {
  'MOON Digital': 'Mun Díyital',
  'Dentxlife': 'Dent for Life',
};

const f = (mostrar, extra) => Object.assign({ toma: 1, mostrar }, extra || {});

const CATALOGO = {
  dentxlife: {
    voz: VOZ_JASON,
    frases: {
      '01': f('Hola, Doctora. Soy Jason, de MOON Digital. Gracias por tu confianza.', { toma: 2 }),
      '02': f('Con tus respuestas preparamos la recepcionista de Dentxlife. Si alguna no la sabes, no pasa nada.'),
      '03': f('¿Cuál es la dirección? Agrega referencias y si hay estacionamiento.'),
      '04': f('¿Tienes página web, Instagram o Facebook? Pega los links aquí.'),
      '05': f('¿Quiénes atienden en tu consultorio? Escribe nombre y especialidad de cada uno.'),
      '06': f('¿Qué días abres?'),
      '07': f('Nos dijiste que atiendes de 11 a 1 y de 4 a 7:30. ¿Es igual esos días?',
        { decir: { 'de 11 a 1 y de 4 a 7:30': 'de once a una y de cuatro a siete y media' } }),
      '08': f('¿Cuál es tu nombre completo o el nombre fiscal del consultorio? Es para tu aviso de privacidad.'),
      '09': f('¿Qué tratamientos haces? Puedes marcar varios.'),
      '10': f('¿Cuánto dura la primera cita, la de valoración?'),
      '11': f('¿Y cuánto dura una cita de seguimiento?'),
      '12': f('¿La valoración tiene costo?'),
      '13': f('Si un paciente pregunta precios, ¿qué quieres que diga tu recepcionista?'),
      '14': f('¿Qué formas de pago aceptas?'),
      '15': f('¿Das factura?'),
      '16': f('¿Aceptas seguros dentales?'),
      '17': f('Hoy, ¿dónde anotas tus citas? Las pasamos a tu agenda nueva.'),
      '18': f('¿Tu recepcionista agenda sola, o aparta la cita y tú la confirmas?'),
      '19': f('Si alguien quiere cambiar o cancelar su cita, ¿qué hace tu recepcionista?'),
      '20': f('¿Alguien te cubre las urgencias cuando no estás? Escribe su nombre y teléfono.'),
      '21': f('Si llama alguien con dolor fuerte, hinchazón o sangrado, ¿qué hace tu recepcionista?'),
      '21b': f('¿A qué número te la pasamos? De preferencia, tu celular personal.'),
      '22': f('Tu recepcionista nunca da diagnósticos. ¿Hay algo más que nunca deba decir?'),
      '23': f('¿Qué es lo que más te preguntan tus pacientes, y cómo lo contestas?'),
      '24': f('¿Desde qué día y hasta qué día cierra el consultorio por vacaciones?'),
      '25': f('Mientras no estás, ¿tu recepcionista agenda para tu regreso o solo toma recados?'),
      '26': f('¿Te gustó la voz de Sofía, la que escuchaste?'),
      '26b': f('¿Cómo quieres que se llame tu recepcionista?'),
      '27': f('¿Cómo trata a tus pacientes: de usted o de tú?'),
      '28': f('¿Cómo quieres que suene?'),
      '29': f('¿Qué idiomas habla?'),
      '30': f('¿A qué número llaman tus pacientes?'),
      '31': f('¿De qué compañía es ese número?'),
      '32': f('En ese número, ¿usas WhatsApp Business o WhatsApp normal?'),
      '33': f('Hoy, ¿quién contesta las llamadas?'),
      '34': f('¿A qué WhatsApp te mandamos los avisos de citas?'),
      '35': f('¿Cuándo te avisamos? Todo queda guardado también en tu panel.'),
      '35b': f('¿A qué hora te mandamos el resumen del día?'),
      '36': f('¿Cuál es tu correo? Con él entras a tu panel.'),
      '37': f('¿Alguien más ve tu panel?'),
      '38': f('¿Hay algo que no te preguntamos, o algo que quieras preguntarnos?'),
      '39': f('Listo, Doctora. Gracias por tu tiempo. Ya nos llegaron tus respuestas.'),
      'otro': f('Escribe cuál es el otro, por favor.'),
    },
  },
};

module.exports = { CATALOGO, PRONUNCIAR };
