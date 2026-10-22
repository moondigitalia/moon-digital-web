# Candado del Centro MOON

Antes de publicar cualquier cambio en `centro/` o `api/centro.js`:

1. `node pruebas/centro/servidor.js &` (datos de prueba, sin tocar la base real)
2. `node pruebas/centro/juez.js` → debe decir **SIN FALLAS**
   (celular chico y grande, computadora, claro/oscuro, letra grande, "reducir movimiento",
   teclado arriba, página que no se mueve, textos completos, credenciales nunca de reversa)
3. `node pruebas/centro/parpadeo.js` → debe decir **SIN REPINTADAS DE MAS**
   (cada toque dibuja la pantalla una sola vez; ninguna credencial al revés durante la transición)

Reglas que nacieron de errores reales (22-oct-2026):
- Nada en 3D (rotateY, backface): las capturas de la transición lo muestran al revés.
- Los datos se piden ANTES de cambiar de pantalla; nunca se repinta "cuando llegan".
- Los campos de texto van en 16 px o más (si no, el iPhone hace zoom solo).
- La página es fija: el marco mide lo que de verdad se ve (teclado incluido).
