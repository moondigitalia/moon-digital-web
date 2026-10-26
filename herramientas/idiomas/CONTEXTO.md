# Cómo traducir (estándar Moon Digital)

El diccionario original está en español: `idiomas/es.js`. Cada idioma tiene `idiomas/<idioma>.js` con **exactamente las mismas claves**.
Se leen y escriben con `herramientas/idiomas/dic.py` (`dic.leer(lang)`, `dic.escribir(lang, datos)`), nunca a mano.

## Reglas (no negociables)
1. **Mismas claves, mismos huecos.** Todo `{variable}` se queda igual (no se traduce lo de adentro).
2. **`[corchetes]` en títulos** marcan la parte resaltada (se pinta de otro color): van alrededor de la parte equivalente en el título traducido. Deben quedar los mismos corchetes.
3. **Corto.** Los títulos y etiquetas viven en cajas de tamaño fijo. Igual de largo que el español o más corto.
4. **Directo y cálido, tono de amigo, informal** (alemán "du", francés "tu", italiano "tu", neerlandés "je", portugués "você"; japonés y coreano amable-casual). Nada de frases de robot ni corporativas.
5. **Plurales**: un objeto `{"one": "...", "other": "..."}` se traduce con las categorías CLDR de ese idioma: ruso/ucraniano/polaco `one, few, many, other`; árabe `zero, one, two, few, many, other`; francés/portugués/italiano/español `one, many, other`; japonés, coreano, chino, tailandés, vietnamita, indonesio solo `other`; inglés, alemán, neerlandés, turco, hindi, bengalí `one, other`. Siempre incluye `other`.
6. **No se traduce:** MOON Digital, WhatsApp, nombres de personas y negocios.
7. `_idioma` = el nombre del idioma escrito en ese idioma.
8. Árabe: solo traduce; el volteo de derecha a izquierda lo hace la página.

## Glosario
- **Calculadora (`calc.*`)**: el dueño de un negocio (muchas veces de oficio: plomero, electricista, taller) mueve tres barras: cuántas llamadas no contesta al día, lo menos que cobra por un trabajo, y de cada 10 que le llaman cuántos lo contratan. Ve cuánto dinero se le va al mes. "Contratar" = que el cliente lo contrata para un trabajo (no "reservar").
- **Presentación (`pres.*`)**: láminas que un vendedor de MOON enseña al dueño: quiénes somos, el problema de no contestar fuera de horario, preguntas para el dueño, ejemplos de cuánto pesa, comparación entre una persona recepcionista y un recepcionista con inteligencia artificial, y al final un demo para probarlo.
- **Recepcionista con IA**: asistente con inteligencia artificial que contesta las llamadas del negocio.
- **Respeto**: el dueño es el experto en su negocio. Nada debe sonar a regaño ni a que no sabe.
