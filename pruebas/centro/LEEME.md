# Candado del Centro MOON

Antes de publicar cualquier cambio en `centro/` o `api/centro.js`:

1. `node pruebas/centro/servidor.js &` (datos de prueba, sin tocar la base real)
2. `node pruebas/centro/juez.js` → debe decir **SIN FALLAS**
   (celular chico y grande, computadora, claro/oscuro, letra grande, "reducir movimiento",
   teclado arriba, página que no se mueve, textos completos, credenciales nunca de reversa)
3. `node pruebas/centro/fotogramas.js` → debe decir **SIN PARPADEO**
   (capturas seguidas durante cada cambio de pantalla: ningún fotograma vacío ni fotos que aparezcan después)
4. `node pruebas/centro/parpadeo.js` → debe decir **SIN REPINTADAS DE MAS**
   (cada toque dibuja la pantalla una sola vez; ninguna credencial al revés durante la transición)

Reglas que nacieron de errores reales (22-oct-2026):
- Nada en 3D (rotateY, backface): las capturas de la transición lo muestran al revés.
- Ninguna pantalla aparece "desde cero" (fade desde transparente = parpadeo). El cambio es un fundido propio:
  la pantalla anterior queda encima y se desvanece sobre la nueva, ya completa. No se usan capturas del navegador.
- Las fotos se preparan una vez (decodificadas) para que nunca aparezcan después del resto.
- Los datos se piden ANTES de cambiar de pantalla; nunca se repinta "cuando llegan".
- Los campos de texto van en 16 px o más (si no, el iPhone hace zoom solo).
- La página es fija: el marco mide lo que de verdad se ve (teclado incluido).

Desde el 13-nov-2026 la pantalla de inicio es la Oficina (el mapa con los monitos, `oficina/oficina.js`):
- Los jueces abren cada pantalla como lo hace el mapa: `abrir({ tipo: 'crm' })` (ya no hay tarjetas de inicio).
- El servidor de prueba también sirve la Oficina (`/oficina/*` y `/api/oficina` con `pruebas/oficina/oficina.json`;
  con `DATOS=archivo.json` usa la API real sobre esa base falsa). `PUERTO=` cambia el puerto.
- Si se toca la unión (el arranque del Tablero o `oficina/oficina.js`), corre también `bash pruebas/oficina/correr.sh`.

