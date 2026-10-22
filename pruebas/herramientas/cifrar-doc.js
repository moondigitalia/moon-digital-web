// Guarda un documento de cliente CIFRADO dentro del proyecto (el repositorio es público: solo se ve basura).
// Uso: node pruebas/herramientas/cifrar-doc.js <carpeta con index.html|index.md + archivos> <id> <llave base64>
// - Mete las imágenes y scripts locales dentro del documento (data:), para que abra sin depender de nadie.
// - Comprime (gzip) y cifra (AES-256-GCM). Solo el Centro, con la llave guardada en Vercel, puede leerlo.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const [carpeta, id, llaveB64] = process.argv.slice(2);
if (!carpeta || !/^[a-z0-9-]+$/.test(id || '') || !llaveB64) { console.error('uso: carpeta id llave'); process.exit(1); }
const llave = Buffer.from(llaveB64, 'base64'); if (llave.length !== 32) { console.error('llave inválida'); process.exit(1); }
const esMd = fs.existsSync(path.join(carpeta, 'index.md'));
let contenido = fs.readFileSync(path.join(carpeta, esMd ? 'index.md' : 'index.html'), 'utf8');
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
let incrustados = 0;
contenido = contenido.replace(/(src|href|url\()(=?)(["']?)((?!https?:|data:|#|mailto:|tel:)[^"')\s>]+)\3/g, (todo, attr, igual, comilla, ruta) => {
  const f = path.join(carpeta, decodeURI(ruta.split(/[?#]/)[0]));
  if (!f.startsWith(path.resolve(carpeta)) && !path.resolve(f).startsWith(path.resolve(carpeta))) return todo;
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return todo;
  const mime = MIME[path.extname(f).toLowerCase()]; if (!mime) return todo;
  incrustados++;
  return `${attr}${igual}${comilla}data:${mime};base64,${fs.readFileSync(f).toString('base64')}${comilla}`;
});
const datos = zlib.gzipSync(Buffer.from(JSON.stringify({ formato: esMd ? 'md' : 'html', contenido })));
const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', llave, iv);
const cifrado = Buffer.concat([c.update(datos), c.final()]);
const salida = path.join(__dirname, '../../api/_docs', id + '.bin');
fs.writeFileSync(salida, Buffer.concat([iv, c.getAuthTag(), cifrado]));
console.log(id, 'formato', esMd ? 'md' : 'html', 'archivos incrustados', incrustados, 'tamaño sin cifrar', Buffer.byteLength(contenido), 'cifrado', fs.statSync(salida).size);
