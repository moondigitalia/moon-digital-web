# moondigitalia.com · reglas para trabajar aquí

Este repositorio es PÚBLICO: nada de llaves, conocimiento interno ni datos de clientes en el código.

## Reusar antes de construir (Kid, 11-nov-2026)
Pasó: la Oficina (`/oficina`) rehízo a mano un CRM que el Tablero (`/tablero`) ya tenía bien resuelto (orden, fotos,
botón de editar, documentos) y se perdieron horas en lo que ya funcionaba.
1. Antes de hacer cualquier pantalla, revisar si el Tablero ya la tiene. Si la tiene, se ABRE la del Tablero:
   `/tablero?abrir=<capa>&volver=/oficina` (capas permitidas en `ABRIR_OK` de `centro/index.html`); al cerrarla regresa
   a la Oficina. Nunca se copia ni se rehace.
2. La Oficina solo agrega lo que no existe en otro lado: el mapa para mirar, sus alertas y la Librería.
3. Las reglas de pantalla que ya se aprendieron en el Tablero valen igual aquí (ver `pruebas/centro/LEEME.md`):
   nada aparece "desde transparente", letras de campos de 16 px, la página no se mueve con el teclado.

## Jueces antes de publicar
- Oficina: `bash pruebas/oficina/correr.sh` (las 6 reglas en 15 pantallas, reducir movimiento y procesador lento).
- Tablero: `pruebas/centro/LEEME.md`, y `node pruebas/centro/juez-link-oficina.js` si se toca el link desde la Oficina.
- Solo se corre el juez del área que tocó el cambio.
