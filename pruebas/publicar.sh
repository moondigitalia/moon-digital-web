#!/bin/sh
# Publica SOLO si pasan los jueces. Uso: sh pruebas/publicar.sh "mensaje"   (con el servidor de prueba en :8765)
# Trabajo inteligente (Kid, 23-oct-2026): solo corren los jueces de lo que SÍ cambió, y todos a la vez.
#   - tablero (centro/, api/centro.js, api/_visor.js, api/_base.js) -> juez, parpadeo, fotogramas y documentos
#   - recepcionista (prueba/, api/prueba.js)                          -> juez de demos (+ juez del tablero, porque vive adentro)
#   - página web (index.html, img/)                                    -> juez de la página web
#   - lo demás (links, textos sueltos, configuración)                  -> solo el candado
#   - si en el tablero o el recepcionista solo cambiaron PALABRAS       -> revisión rápida (~1 min)
cd "$(dirname "$0")/.." || exit 1
RAIZ=$(pwd)
git fetch -q origin main 2>/dev/null
CAMBIOS=$( (git diff --name-only origin/main; git diff --name-only; git ls-files --others --exclude-standard) | sort -u )
echo "Cambió:"; echo "$CAMBIOS" | sed 's/^/  /'
tiene() { echo "$CAMBIOS" | grep -Eq "$1"; }
TABLERO=0; DEMOS=0; WEB=0; MATERIAL=0; EJEMPLOS=0
tiene '^(centro/|api/(centro|_visor|_base)\.js|pruebas/centro/)' && TABLERO=1
tiene '^(prueba/|api/prueba\.js|pruebas/juez-demo)' && { DEMOS=1; TABLERO=1; }
tiene '^(index\.html|img/|pruebas/juez-web)' && WEB=1
# (26-oct) los ejemplos de los campos van completos ("Ejemplo:", nunca "Ej.") y nunca cortados
tiene '^(centro/|prueba/nueva/|index\.html|examen/|pruebas/juez-ejemplos)' && EJEMPLOS=1
# (26-oct) calculadora y presentación con la marca del cliente, en los 21 idiomas
tiene '^(calculadora/|presentacion/|material/|idiomas/|fuentes/material/|pruebas/material/|api/prueba\.js)' && MATERIAL=1

node pruebas/candado-publicar.js || exit 1
# Si solo cambiaron palabras (no diseño ni código), la revisión es rápida: teléfono chico y computadora, ~1 minuto.
RAPIDO=0; [ $TABLERO = 1 ] && [ "$(node pruebas/solo-texto.js $(echo "$CAMBIOS" | grep -E '^(centro/|prueba/|index\.html)'))" = "si" ] && { RAPIDO=1; DEMOS=0; echo "Solo cambiaron palabras: revisión rápida."; }
export RAPIDO
T=$(mktemp -d)
cd pruebas/centro
# El servidor de prueba se prende solo si hace falta (ya no depende de acordarse).
if [ $TABLERO = 1 ] && ! curl -s -o /dev/null localhost:8765/; then (node servidor.js > /dev/null 2>&1 &); sleep 1; fi
[ $TABLERO = 1 ] && { (node juez.js 2>&1 | tail -1 > $T/juez) & [ $RAPIDO = 0 ] && { (node parpadeo.js 2>&1 | tail -1 > $T/parpadeo) & (node fotogramas.js 2>&1 | tail -1 > $T/fotogramas) &
  [ -n "$DOCS" ] && (node juez-docs.js "$DOCS" "$LLAVE" 2>&1 | tail -1 > $T/documentos) & }; }
[ $WEB = 1 ] && (node ../juez-web.js 2>&1 | tail -1 > $T/web) &
[ $EJEMPLOS = 1 ] && (cd "$RAIZ" && node pruebas/juez-ejemplos.js prueba/nueva/index.html centro/index.html index.html examen/*/index.html 2>&1 | tail -1 > $T/ejemplos) &
[ $MATERIAL = 1 ] && (node ../material/juez.js 2>&1 | tail -1 > $T/material) &
[ $DEMOS = 1 ] && { mkdir -p /tmp/fotos-demo; (node ../juez-demo-nueva.js "$RAIZ" /tmp/fotos-demo 2>&1 | tail -1 > $T/demos) & }
wait
MAL=0
revisa() { [ -f $T/$1 ] || return 0; r=$(cat $T/$1); echo "$1: $r"; [ "$r" = "$2" ] || MAL=1; }
revisa juez "SIN FALLAS"; revisa parpadeo "SIN REPINTADAS DE MAS"; revisa fotogramas "SIN PARPADEO"
revisa documentos "TODOS LOS DOCUMENTOS SE VEN"; revisa web "SIN FALLAS"; revisa demos "SIN FALLAS"; revisa material "SIN FALLAS"; revisa ejemplos "SIN FALLAS"
rm -rf $T
[ $MAL = 0 ] || { echo "NO SE PUBLICÓ: un juez encontró algo."; exit 1; }
cd "$RAIZ" && git add -A && git commit -qm "$1" && git pull -q --rebase origin main && git push -q origin main && git log --oneline -1
