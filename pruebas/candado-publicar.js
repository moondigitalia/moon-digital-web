// CANDADO antes de publicar: si algo de esto falla, no se sube. (Nació el 22-oct-2026: un comentario rompió la página.)
// 1) Cada <script> del Centro se puede leer (sin errores de escritura). 2) Cada archivo del servidor carga.
const fs = require('fs'), path = require('path'), raiz = path.join(__dirname, '..');
let mal = 0;
for (const pag of ['centro/index.html']) {
  const h = fs.readFileSync(path.join(raiz, pag), 'utf8');
  [...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((m, i) => { try { new Function(m[1]); } catch (e) { mal++; console.log(`${pag} script ${i + 1}: ${e.message}`); } });
}
for (const f of fs.readdirSync(path.join(raiz, 'api'))) if (f.endsWith('.js')) { try { require(path.join(raiz, 'api', f)); } catch (e) { mal++; console.log(`api/${f}: ${e.message}`); } }
if (mal) { console.log('NO SE PUBLICA'); process.exit(1); } else console.log('candado ok');
