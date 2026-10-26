// CANDADO antes de publicar: si algo de esto falla, no se sube. (Nació el 22-oct-2026: un comentario rompió la página.)
// 1) Cada <script> del Centro se puede leer (sin errores de escritura). 2) Cada archivo del servidor carga.
const fs = require('fs'), path = require('path'), raiz = path.join(__dirname, '..');
let mal = 0;
for (const pag of ['centro/index.html', 'prueba/index.html', 'prueba/nueva/index.html', 'calculadora/index.html', 'presentacion/index.html']) {
  const h = fs.readFileSync(path.join(raiz, pag), 'utf8');
  [...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].forEach((m, i) => { try { new Function(m[1]); } catch (e) { mal++; console.log(`${pag} script ${i + 1}: ${e.message}`); } });
}
for (const f of fs.readdirSync(path.join(raiz, 'api'))) if (f.endsWith('.js')) { try { require(path.join(raiz, 'api', f)); } catch (e) { mal++; console.log(`api/${f}: ${e.message}`); } }
// 3) (26-oct) Todos los idiomas tienen todo lo del español, con los mismos huecos (estándar Moon Digital).
try { require('child_process').execSync('python3 herramientas/idiomas/revisar.py', { cwd: raiz, stdio: 'pipe' }); } catch (e) { mal++; console.log('idiomas: ' + e.stdout.toString().split('\n').filter(x => x.includes('❌') || x.startsWith('    ')).slice(0, 8).join('\n')); }
if (mal) { console.log('NO SE PUBLICA'); process.exit(1); } else console.log('candado ok');
