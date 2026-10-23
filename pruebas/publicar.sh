#!/bin/sh
# Publica SOLO si pasan todos los jueces. Uso: sh pruebas/publicar.sh "mensaje"   (con el servidor de prueba en :8765)
cd "$(dirname "$0")/centro" || exit 1
node ../candado-publicar.js || exit 1
r1=$(node juez.js 2>&1 | tail -1); echo "juez: $r1"; [ "$r1" = "SIN FALLAS" ] || exit 1
r2=$(node parpadeo.js 2>&1 | tail -1); echo "parpadeo: $r2"; [ "$r2" = "SIN REPINTADAS DE MAS" ] || exit 1
r3=$(node fotogramas.js 2>&1 | tail -1); echo "fotogramas: $r3"; [ "$r3" = "SIN PARPADEO" ] || exit 1
r5=$(node ../juez-web.js 2>&1 | tail -1); echo "pagina web: $r5"; [ "$r5" = "SIN FALLAS" ] || exit 1
mkdir -p /tmp/fotos-demo; r6=$(node ../juez-demo-nueva.js ../.. /tmp/fotos-demo 2>&1 | tail -1); echo "demos: $r6"; [ "$r6" = "SIN FALLAS" ] || exit 1
if [ -n "$DOCS" ]; then r4=$(node juez-docs.js "$DOCS" "$LLAVE" 2>&1 | tail -1); echo "documentos: $r4"; [ "$r4" = "TODOS LOS DOCUMENTOS SE VEN" ] || exit 1; fi
cd ../.. && git add -A && git commit -qm "$1" && git push -q origin main && git log --oneline -1
