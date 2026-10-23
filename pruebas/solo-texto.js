// ¿El cambio fue SOLO de palabras que se leen en pantalla? (no diseño, no código, no números)
// Por cada renglón cambiado se busca exactamente qué cambió; tiene que ser texto entre etiquetas o dentro de un texto
// (antes viene ">" o un espacio, y lo cambiado solo tiene letras, espacios y signos de escritura). Responde "si" o "no".
const { execSync } = require('child_process'), fs = require('fs');
const archivos = process.argv.slice(2);
const LETRA = /[\p{L}]/u, TEXTO = /^[\p{L}\s.,;¿?¡!…]*$/u;
function renglonSoloTexto(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  // se agranda a palabras completas
  while (i > 0 && LETRA.test(a[i - 1])) i--;
  while (j > 0 && LETRA.test(a[a.length - j])) j--;
  const va = a.slice(i, a.length - j), vb = b.slice(i, b.length - j);
  if (!TEXTO.test(va) || !TEXTO.test(vb)) return false;
  // Lo que encierra al cambio: tiene que ser una etiqueta (> … <) o unas comillas iguales ('…' "…" `…`).
  const DELIM = /[<>'"`{}();=:\[\]]/;
  let L = i - 1; while (L >= 0 && !DELIM.test(a[L])) L--;
  let R = a.length - j; while (R < a.length && !DELIM.test(a[R])) R++;
  const izq = a[L] || '', der = a[R] || '';
  if (izq === '>' && der === '<') return true;
  // Entre comillas solo cuenta si se lee como texto (tiene espacios o empieza con mayúscula); "sub" o 'ficha' son nombres de código.
  if (izq !== der || !/['"`]/.test(izq)) return false;
  const dentro = b.slice(L + 1, b.length - (a.length - R));
  return /\s/.test(dentro.trim()) || /^[\p{Lu}¿¡]/u.test(dentro.trim());
}
let solo = archivos.length > 0;
for (const f of archivos) {
  let viejo, nuevo;
  try { viejo = execSync(`git show origin/main:${f}`, { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n'); nuevo = fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { solo = false; break; }
  if (viejo.length !== nuevo.length) { solo = false; break; }   // renglones nuevos o quitados = no es solo cambiar palabras
  for (let k = 0; k < viejo.length && solo; k++) if (viejo[k] !== nuevo[k] && !renglonSoloTexto(viejo[k], nuevo[k])) solo = false;
  if (!solo) break;
}
console.log(solo ? 'si' : 'no');
