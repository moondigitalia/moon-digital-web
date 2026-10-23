// VER — el link que se le manda al cliente: https://moondigitalia.com/ver/<código> (22-oct-2026).
// Abre UN documento, sin contraseña ni cuenta. El código es largo y al azar (imposible de adivinar) y solo existe
// para lo que se puede enseñar al cliente. No da acceso a nada más del Centro.
const { sql } = require('./_base');
const { leerCifrado, preparar, enviable, mdAHoja } = require('./_visor');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NO_ESTA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MOON Digital</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font:600 17px system-ui,-apple-system,sans-serif;background:#f4f1ec;color:#1d1d22;text-align:center;padding:24px">
<div><p style="letter-spacing:4px;font-size:12px">MOON DIGITAL</p><p>Este documento ya no está disponible.<br>Pídenos el link nuevo y te lo mandamos.</p></div></body></html>`;

// Un archivo subido (PDF, foto u otro): hoja por hoja como en el Centro, con botón para descargarlo.
function paginaArchivo(d, f, codigo, tarjeta) {
  const datos = JSON.stringify({ codigo, partes: f.partes, mime: f.mime || '', nombre: f.nombre || 'archivo' }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${tarjeta}
<style>html,body{margin:0;height:100%;background:#dfe2ea;font:600 15px system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d22}
#caja{position:fixed;left:0;right:0;top:0;bottom:72px}#caja img{width:100%;height:100%;object-fit:contain}
#barra{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(20,22,30,.88);color:#fff;border-radius:99px;padding:6px;white-space:nowrap}
#barra button,#barra a{all:unset;cursor:pointer;height:40px;min-width:40px;border-radius:99px;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#fff;font-weight:800;padding:0 4px}
#barra a{padding:0 16px}#barra span{min-width:60px;text-align:center}#barra .no{display:none}
.msg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px}</style></head>
<body><div id="caja"><div class="msg">Abriendo…</div></div>
<div id="barra"><button id="ant" class="no" aria-label="Anterior">‹</button><span id="pag" class="no"></span><button id="sig" class="no" aria-label="Siguiente">›</button><a id="bajar" download>Descargar</a></div>
<script src="/centro/visor-archivo.js"></script>
<script>(async function(){var D=${datos},caja=document.getElementById('caja'),msg=caja.firstChild;
try{var bytes=await VisorArchivo.bajar(D.partes,function(n){return fetch('/api/ver?t='+D.codigo+'&parte='+n).then(function(r){return r.ok?r.json():Promise.reject()}).then(function(j){return j.datos})},function(k,n){if(n>1)msg.textContent='Abriendo… '+Math.round(k/n*100)+'%'});
var url=URL.createObjectURL(new Blob([bytes],{type:D.mime||'application/octet-stream'})),a=document.getElementById('bajar');a.href=url;a.download=D.nombre;
if(/^image\\//.test(D.mime)){caja.innerHTML='<img alt="" src="'+url+'">';return}
if(/pdf/i.test(D.mime)||/\\.pdf$/i.test(D.nombre)){var v=await VisorArchivo.pdf(caja,bytes,function(i,n){if(n<2)return;['ant','pag','sig'].forEach(function(x){document.getElementById(x).classList.remove('no')});document.getElementById('pag').textContent=i+' de '+n});
document.getElementById('ant').onclick=function(){v.ver(v.hoja-1)};document.getElementById('sig').onclick=function(){v.ver(v.hoja+1)};addEventListener('resize',function(){v.redibuja()});return}
msg.textContent='Este archivo no se puede ver aquí. Usa “Descargar”.';}catch(e){msg.textContent='No se pudo abrir. Revisa tu internet y vuelve a intentar.'}})();</script></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const codigo = String((req.query && req.query.t) || '');
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(codigo)) { res.status(404).send(NO_ESTA); return; }
  try {
    const d = (await sql('SELECT id, tel, seccion, titulo, frase, formato, contenido, url, fuente FROM documentos WHERE enlace = ?', [codigo]))[0];
    if (!d || d.seccion === 'oculto' || !enviable(d)) { res.status(404).send(NO_ESTA); return; }
    const cifrado = leerCifrado(d.id); if (cifrado) Object.assign(d, cifrado);
    const url = 'https://moondigitalia.com/ver/' + codigo;
    // La tarjeta que enseña WhatsApp al pegar el link.
    const tarjeta = `<title>${esc(d.titulo)}</title><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:site_name" content="MOON Digital"><meta property="og:title" content="${esc(d.titulo)}"><meta property="og:description" content="${esc(d.frase || 'De MOON Digital')}">`;
    if (d.formato === 'archivo') {
      const f = JSON.parse(d.fuente || '{}');
      if (!f.listo) { res.status(404).send(NO_ESTA); return; }
      // Las partes del archivo (el visor las pide una por una y lo arma en el celular del cliente).
      if (req.query.parte !== undefined) {
        const r = (await sql('SELECT datos FROM partes WHERE doc = ? AND n = ?', [d.id, Number(req.query.parte) || 0]))[0];
        res.setHeader('Content-Type', 'application/json'); res.status(r ? 200 : 404).send(JSON.stringify(r ? { datos: r.datos } : {})); return;
      }
      res.status(200).send(paginaArchivo(d, f, codigo, tarjeta)); return;
    }
    if (d.formato === 'md') { d.contenido = mdAHoja(d.contenido, d.titulo); d.formato = 'html'; }
    if (d.formato === 'html') {
      const h = String(d.contenido).replace(/<title>[\s\S]*?<\/title>/i, '');
      res.status(200).send(preparar(h, { suelto: true, extra: tarjeta }).contenido); return;
    }
    // Markdown: una hoja limpia, cómoda en celular.
    res.status(200).send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${tarjeta}
<style>body{margin:0;background:#f4f1ec;color:#1d1d22;font:500 16.5px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 20px 60px}.marca{letter-spacing:4px;font-size:12px;font-weight:700;color:#55555c;margin-bottom:18px}
article{background:#fff;border-radius:24px;padding:24px 22px;box-shadow:0 10px 30px -18px rgba(0,0,0,.25);overflow-wrap:anywhere}
h1{font-size:26px;line-height:1.2}h2{font-size:20px}h3{font-size:17px}table{border-collapse:collapse;width:100%;font-size:14.5px;display:block;overflow-x:auto}
td,th{border-bottom:1px solid #e3e0da;padding:7px 8px;text-align:start}img{max-width:100%;border-radius:12px}a{color:#0b4fd6;font-weight:700}</style></head>
<body><main><div class="marca">MOON DIGITAL</div><article id="doc"></article></main>
<script id="fuente" type="text/plain">${esc(d.contenido)}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script>var t=document.createElement('textarea');t.innerHTML=document.getElementById('fuente').textContent;document.getElementById('doc').innerHTML=window.marked?marked.parse(t.value):'<pre style="white-space:pre-wrap">'+document.getElementById('fuente').textContent+'</pre>';document.querySelectorAll('#doc a').forEach(function(a){a.target='_blank';a.rel='noopener'})</script>
</body></html>`);
  } catch (e) {
    console.log('VER-ERROR', e.message);
    res.status(502).send(NO_ESTA);
  }
};
