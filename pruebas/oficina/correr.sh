#!/bin/bash
# Juez de la Oficina: la parte de atrás (api/oficina.js con base falsa) y las 6 reglas en todas las pantallas.
# Uso: bash pruebas/oficina/correr.sh        (SOLO=375x667,1280x800 para medir solo esas)
cd "$(dirname "$0")"
node api.test.js || exit 1
node servidor.js & S=$!; sleep 1
NODE_PATH=$(npm root -g) node juez.js; R=$?
kill $S
# La piel 3D: tamaño de los monitos, zoom y nombres sin encimarse en 12 pantallas
DATOS=crudo.json node servidor-piel.js & S=$!; sleep 1
NODE_PATH=$(npm root -g) node juez-piel.js || R=1
kill $S; exit $R
