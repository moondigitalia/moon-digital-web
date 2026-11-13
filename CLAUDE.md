# moondigitalia.com · reglas para trabajar aquí

Este repositorio es PÚBLICO: nada de llaves, conocimiento interno ni datos de clientes en el código.

## Reusar antes de construir (Kid, 11-nov-2026)
Pasó: la Oficina (`/oficina`) rehízo a mano un CRM que el Tablero (`/tablero`) ya tenía bien resuelto (orden, fotos,
botón de editar, documentos) y se perdieron horas en lo que ya funcionaba.
1. Antes de hacer cualquier pantalla, revisar si el Tablero ya la tiene. Si la tiene, se ABRE la del Tablero encima del
   mapa, en la misma página: `T.abrir({ tipo: '<capa>' })` desde `oficina/oficina.js`; al cerrarla se vuelve al mapa.
   Nunca se copia ni se rehace.
2. La Oficina solo agrega lo que no existe en otro lado: el mapa para mirar, sus alertas y la Librería.
3. Las reglas de pantalla que ya se aprendieron en el Tablero valen igual aquí (ver `pruebas/centro/LEEME.md`):
   nada aparece "desde transparente", letras de campos de 16 px, la página no se mueve con el teclado.

## Un solo link: la Oficina ES el inicio del Tablero (Kid, 13-nov-2026)
- `/tablero` abre el mapa con los monitos; `/oficina` redirige ahí. Ya no hay dos páginas que se brinquen.
- El mapa vive en su propia caja (sombra) dentro del Tablero: `oficina/oficina.js` (panel y toques) + `oficina/piel.js`
  (el dibujo, intacto). Sus estilos no tocan al Tablero ni el Tablero a ellos.
- Los embajadores nunca ven el mapa (enseña dinero): siguen con su propia pantalla.
- Mientras una pantalla del Tablero está abierta encima, los monitos se pausan (celulares lentos).

## Jueces antes de publicar
- Oficina: `bash pruebas/oficina/correr.sh` (las 6 reglas en 15 pantallas, reducir movimiento y procesador lento, y la
  piel 3D: monitos ≥ 12 px al ver todo, 160 px de cerca, nombres sin encimarse). La piel vive en `oficina/piel.js`:
  se enchufa encima.
- Tablero: `pruebas/centro/LEEME.md` (sus jueces abren las pantallas como lo hace el mapa: `abrir({ tipo })`).
- Si se toca la unión (`oficina/oficina.js` o el arranque del Tablero): los dos, Oficina y Tablero.
- Solo se corre el juez del área que tocó el cambio.
