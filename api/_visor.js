// VISOR — cómo se ve cada documento, igual dentro del Centro y en el link que se le manda al cliente (22-oct-2026).
// Un solo lugar decide: presentaciones (láminas de 1920×1080) y hojas tipo PDF (A4) se ven UNA a la vez, completas,
// del tamaño de la pantalla; cualquier otro documento se ajusta al ancho para que nunca haya que deslizar a los lados.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

function leerCifrado(id) {
  try {
    if (!/^[a-z0-9-]+$/.test(id) || !process.env.CENTRO_LLAVE_DOCS) return null;
    const archivo = path.join(__dirname, '_docs', id + '.bin');
    if (!fs.existsSync(archivo)) return null;
    const b = fs.readFileSync(archivo), llave = Buffer.from(process.env.CENTRO_LLAVE_DOCS, 'base64');
    const dc = crypto.createDecipheriv('aes-256-gcm', llave, b.subarray(0, 12)); dc.setAuthTag(b.subarray(12, 28));
    return JSON.parse(zlib.gunzipSync(Buffer.concat([dc.update(b.subarray(28)), dc.final()])).toString());
  } catch (e) { console.log('DOC-CIFRADO', id, e.message); return null; }
}

// ¿Cómo está hecho? laminas = presentación 16:9 · hojas = páginas tamaño carta/A4 · ancho = página normal
function modoDe(html) {
  // Busca la regla de estilo que define una lámina (1920×1080) o una hoja de papel (A4/carta) y usa ESE selector.
  // Si la lámina viene "envuelta" (ej. <div class="lamina"><section>), el visor sube al envoltorio al abrir.
  const css = [...String(html).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim().split(',').pop().trim(), cuerpo: m[2] }));
  const lam = reglas.find(r => /width:\s*1920px/.test(r.cuerpo) && /height:\s*1080px/.test(r.cuerpo) && !/^(html|body|\*|:root)/.test(r.sel));
  if (lam) return { modo: 'laminas', sel: lam.sel, fondo: '#111' };
  const hoja = reglas.find(r => /width:\s*(210mm|8\.5in|816px|794px)/.test(r.cuerpo) && /height:\s*(297mm|11in|1056px|1123px)/.test(r.cuerpo) && !/^(html|body|\*|:root|@page)/.test(r.sel));
  if (hoja) return { modo: 'hojas', sel: hoja.sel, fondo: '#dfe2ea' };
  return { modo: 'ancho', sel: '', fondo: '#fff' };
}

// Lo que corre DENTRO del documento: una lámina/hoja a la vez, y ZOOM propio (pellizcar o doble toque) que solo
// agranda el documento, nunca la página del Centro. Con zoom, un dedo mueve la hoja; sin zoom, deslizar cambia de hoja.
function visorEnDoc(SEL, SUELTO) {
  var marco = parent !== window, L = [], i = 0, barra = null, txt = null, BAR = SUELTO && !marco ? 68 : 0;
  var Z = 1, PX = 0, PY = 0, base = 1, de = document.documentElement;
  function k() {
    if (!SEL) { de.style.zoom = ''; var w = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0); base = w > innerWidth + 2 ? innerWidth / w : 1; aplica(); return; }
    if (!L.length) return; var w2 = L[0].offsetWidth, h = L[0].offsetHeight, m = Math.min(innerWidth, innerHeight) < 600 ? 8 : 24;
    base = Math.min((innerWidth - m * 2) / w2, (innerHeight - BAR - m * 2) / h);
    de.style.setProperty('--k', base); de.style.setProperty('--cy', ((innerHeight - BAR) / 2) + 'px'); aplica();
  }
  function limita() {
    if (!SEL || !L[i]) return; var w = L[i].offsetWidth * base * Z, h = L[i].offsetHeight * base * Z;
    var mx = Math.max(0, (w - innerWidth) / 2 + 16), my = Math.max(0, (h - (innerHeight - BAR)) / 2 + 16);
    PX = Math.max(-mx, Math.min(mx, PX)); PY = Math.max(-my, Math.min(my, PY));
  }
  function aplica() {
    if (!SEL) { de.style.zoom = base * Z === 1 ? '' : String(base * Z); return; }
    var u = L[i]; if (!u) return; limita();
    u.style.setProperty('transform', 'translate(-50%,-50%) translate(' + PX + 'px,' + PY + 'px) scale(' + (base * Z) + ')', 'important');
  }
  function todos() { try { return [].slice.call(document.querySelectorAll(SEL)); } catch (e) { return []; } }
  function unidades() {
    var v = []; todos().forEach(function (e) { var u = e; while (u.parentElement && u.parentElement !== document.body && u.parentElement.offsetWidth === e.offsetWidth && u.parentElement.offsetHeight === e.offsetHeight) u = u.parentElement; if (v.indexOf(u) < 0) v.push(u); });
    v.forEach(function (u) { u.classList.add('visor-u'); }); return v;
  }
  function ver(n) {
    if (!SEL) return; if (!L.length) L = unidades(); if (!L.length) return;
    if (L[i]) L[i].style.removeProperty('transform');
    i = (n + L.length) % L.length; Z = 1; PX = 0; PY = 0;
    L.forEach(function (s, j) { s.classList.toggle('actual', j === i); }); k();
    if (marco) parent.postMessage({ lamina: i, total: L.length }, '*'); if (txt) txt.textContent = (i + 1) + ' de ' + L.length;
  }
  function hazBarra() {
    if (!BAR || barra || L.length < 2) return; barra = document.createElement('div'); barra.id = 'visor-barra';
    var fl = function (d) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };
    barra.innerHTML = '<button aria-label="Anterior">' + fl('M15 6l-6 6 6 6') + '</button><span></span><button aria-label="Siguiente">' + fl('M9 6l6 6-6 6') + '</button>';
    document.body.appendChild(barra); txt = barra.querySelector('span'); var b = barra.querySelectorAll('button');
    b[0].onclick = function () { ver(i - 1); }; b[1].onclick = function () { ver(i + 1); };
  }
  // Zoom con los dedos: se acerca hacia donde están los dedos y se puede mover la hoja.
  function zoomA(nz, x, y) {
    nz = Math.max(1, Math.min(4, nz));
    if (SEL) { var cx = innerWidth / 2 + PX, cy = (innerHeight - BAR) / 2 + PY, r = nz / Z; PX = x - innerWidth / 2 - (x - cx) * r; PY = y - (innerHeight - BAR) / 2 - (y - cy) * r; }
    else { var sx = (scrollX + x) / Z, sy = (scrollY + y) / Z; }
    Z = nz; if (Z === 1) { PX = 0; PY = 0; } aplica();
    if (!SEL) scrollTo(sx * Z - x, sy * Z - y);
  }
  var t2 = null, t1 = null, pellizco = false, ultimoToque = 0, ultimoX = 0, ultimoY = 0;
  var dist = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
  addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) { pellizco = true; t1 = null; t2 = { d: dist(e.touches), z: Z }; }
    else if (e.touches.length === 1) { pellizco = false; var t = e.touches[0]; t1 = { x: t.clientX, y: t.clientY, px: PX, py: PY }; }
  }, { passive: true });
  addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && t2) { e.preventDefault(); var t = e.touches; zoomA(t2.z * dist(t) / t2.d, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); }
    else if (e.touches.length === 1 && t1 && Z > 1 && SEL) { e.preventDefault(); PX = t1.px + e.touches[0].clientX - t1.x; PY = t1.py + e.touches[0].clientY - t1.y; aplica(); }
  }, { passive: false });
  addEventListener('touchend', function (e) {
    if (e.touches.length < 2) t2 = null;
    if (e.touches.length || !t1) return;
    var t = e.changedTouches[0], dx = t.clientX - t1.x, dy = t.clientY - t1.y; t1 = null;
    if (pellizco) return;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {   // doble toque: acerca o regresa
      var ahora = Date.now();
      if (ahora - ultimoToque < 320 && Math.abs(t.clientX - ultimoX) < 30 && Math.abs(t.clientY - ultimoY) < 30) { zoomA(Z > 1 ? 1 : 2.5, t.clientX, t.clientY); ultimoToque = 0; e.preventDefault(); return; }
      ultimoToque = ahora; ultimoX = t.clientX; ultimoY = t.clientY; return;
    }
    if (SEL && Z === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ver(i + (dx < 0 ? 1 : -1));
  });
  ['gesturestart', 'gesturechange'].forEach(function (n) { addEventListener(n, function (e) { e.preventDefault(); }); });
  // En computadora: doble clic acerca/aleja; pellizcar en el trackpad (o Ctrl + rueda) acerca poco a poco.
  addEventListener('dblclick', function (e) { zoomA(Z > 1 ? 1 : 2.5, e.clientX, e.clientY); });
  addEventListener('wheel', function (e) { if (e.ctrlKey) { e.preventDefault(); zoomA(Z * Math.exp(-e.deltaY / 120), e.clientX, e.clientY); } else if (SEL && Z > 1) { e.preventDefault(); PX -= e.deltaX; PY -= e.deltaY; aplica(); } }, { passive: false });
  addEventListener('message', function (e) { if (e.data && typeof e.data.lamina === 'number') ver(e.data.lamina); if (e.data && e.data.zoom === 0) zoomA(1, innerWidth / 2, innerHeight / 2); });
  addEventListener('resize', k); addEventListener('load', k);
  addEventListener('DOMContentLoaded', function () { if (SEL) { L = unidades(); hazBarra(); ver(0); } else { k(); if (marco) parent.postMessage({ total: 1, lamina: 0 }, '*'); } });
  addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') ver(i + 1); if (e.key === 'ArrowLeft') ver(i - 1); });
}

// suelto = se abre solo (el link del cliente): dibuja sus propias flechas. Dentro del Centro, las flechas son del Centro.
function guion(sel, fondo, suelto) {
  const css = sel ? `<style id="visor-moon">html,body{margin:0!important;height:100%!important;overflow:hidden!important;background:${fondo}!important}
.visor-u{position:absolute!important;left:50%!important;top:var(--cy,50%)!important;margin:0!important;transform:translate(-50%,-50%) scale(var(--k,.5))!important;opacity:0;pointer-events:none;transition:opacity .3s ease;box-shadow:0 10px 40px rgba(0,0,0,.18)}
.visor-u.actual{opacity:1;pointer-events:auto}
#visor-barra{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(20,22,30,.86);color:#fff;border-radius:99px;padding:6px;font:700 14px system-ui,-apple-system,sans-serif;z-index:2147483647}
#visor-barra button{all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14)}
#visor-barra span{min-width:64px;text-align:center}</style>` : '';
  const js = `<script>(${visorEnDoc.toString()})(${JSON.stringify(sel)}, ${suelto ? 1 : 0});<\/script>`;
  return css + js;
}

// Deja el documento listo para verse. extra = etiquetas que van en <head> (título y tarjeta de WhatsApp en el link del cliente).
function preparar(html, opciones) {
  const o = opciones || {}, m = modoDe(String(html || ''));
  let h = String(html || '');
  const cabeza = (o.extra || '') + (/<meta[^>]+name=["']viewport/i.test(h) ? '' : '<meta name="viewport" content="width=device-width,initial-scale=1">') + guion(m.sel, m.fondo, o.suelto);
  if (/<\/head>/i.test(h)) h = h.replace(/<\/head>/i, cabeza + '</head>');
  else if (/<body[^>]*>/i.test(h)) h = h.replace(/<body[^>]*>/i, x => '<head>' + cabeza + '</head>' + x);
  else h = '<!doctype html><html><head><meta charset="utf-8">' + cabeza + '</head><body>' + h + '</body></html>';
  return { contenido: h, modo: m.modo, fondo: m.fondo };
}

// Un documento de texto (Markdown) se vuelve un documento de verdad: hojas tamaño carta/A4 con su encabezado,
// que el visor enseña una a la vez como un PDF. Las tablas largas se parten entre hojas (repitiendo su encabezado).
// Marked va dentro del documento (no depende de internet ni de otra página para verse).
let MARKED_ = null; const marcado = () => MARKED_ || (MARKED_ = fs.readFileSync(path.join(__dirname, '_lib', 'marked.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script'));
const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function paginarDoc(TIT) {
  var t = document.createElement('textarea'); t.innerHTML = document.getElementById('fuente').textContent;
  var tmp = document.createElement('div'); tmp.innerHTML = window.marked ? window.marked.parse(t.value) : '<pre style="white-space:pre-wrap">' + t.innerHTML + '</pre>';
  tmp.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
  var hojas = [], c = null;
  function nueva() { var p = document.createElement('div'); p.className = 'page'; p.innerHTML = '<div class="cab"><span>MOON DIGITAL</span><span></span></div><div class="cont"></div><div class="num"></div>'; p.querySelector('.cab span:last-child').textContent = TIT; document.body.appendChild(p); hojas.push(p); c = p.querySelector('.cont'); }
  function cabe() { return c.scrollHeight <= c.clientHeight + 1; }
  function parte(b) {   // tabla o lista que no cabe ni en una hoja nueva: se reparte por renglones
    var esTabla = b.tagName === 'TABLE', filas = esTabla ? [].slice.call(b.tBodies[0] ? b.tBodies[0].rows : []) : [].slice.call(b.children);
    if (!filas.length) return;
    var vacia = function () { var n = b.cloneNode(false); if (esTabla) { if (b.tHead) n.appendChild(b.tHead.cloneNode(true)); n.appendChild(document.createElement('tbody')); } return n; };
    var dest = vacia(); c.appendChild(dest); var cuerpo = esTabla ? dest.tBodies[0] : dest;
    filas.forEach(function (f) { cuerpo.appendChild(f); if (!cabe() && cuerpo.children.length > 1) { cuerpo.removeChild(f); nueva(); dest = vacia(); c.appendChild(dest); cuerpo = esTabla ? dest.tBodies[0] : dest; cuerpo.appendChild(f); } });
  }
  nueva();
  [].slice.call(tmp.children).forEach(function (b) {
    c.appendChild(b); if (cabe()) return;
    if (c.children.length > 1) { c.removeChild(b); nueva(); c.appendChild(b); if (cabe()) return; }
    if (b.tagName === 'TABLE' || b.tagName === 'UL' || b.tagName === 'OL') { c.removeChild(b); parte(b); }
  });
  hojas.forEach(function (p, n) { p.querySelector('.num').textContent = (n + 1) + ' de ' + hojas.length; });
}
function mdAHoja(md, titulo) {
  const MARKED = marcado();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(titulo)}</title>
<script>${MARKED}<\/script>
<style>html,body{margin:0;background:#dfe2ea}
.page{width:210mm;height:297mm;background:#fff;box-sizing:border-box;padding:22mm 18mm 18mm;position:relative;overflow:hidden;margin:0 auto 10px;font:400 10.5pt/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d22}
.page::before{content:"";position:absolute;left:0;right:0;top:0;height:3mm;background:#13235B}
.cab{position:absolute;left:18mm;right:18mm;top:9mm;display:flex;justify-content:space-between;gap:10mm;font-size:7.5pt;letter-spacing:.18em;color:#7a7f95;font-weight:700;text-transform:uppercase}
.cab span:last-child{letter-spacing:.04em;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:clip}
.num{position:absolute;right:18mm;bottom:8mm;font-size:8pt;color:#9a9eb0}
.cont{height:100%;overflow:hidden}.cont>:first-child{margin-top:0}
h1{font-size:21pt;line-height:1.15;color:#13235B;margin:0 0 5mm;letter-spacing:-.01em}
h2{font-size:13.5pt;color:#13235B;margin:6mm 0 2.5mm}h3{font-size:11.5pt;margin:5mm 0 2mm}
p,ul,ol{margin:0 0 3.2mm}ul,ol{padding-left:6mm}li{margin:0 0 1mm}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:0 0 4mm}th{background:#f1f3f8;text-align:left;font-weight:700}
td,th{border-bottom:1px solid #e3e6ee;padding:2mm 2.5mm;vertical-align:top}
img{max-width:100%;border-radius:3mm}a{color:#0b4fd6;font-weight:600}hr{border:0;border-top:1px solid #e3e6ee;margin:5mm 0}
blockquote{margin:0 0 4mm;padding:2mm 4mm;border-left:1mm solid #13235B;background:#f6f7fb}</style></head><body>
<script type="text/plain" id="fuente">${escH(md)}<\/script>
<script>(${paginarDoc.toString()})(${JSON.stringify(String(titulo || ''))});<\/script></body></html>`;
}

// Solo estos se pueden mandar fuera: lo del cliente y la presentación/página de MOON. Lo interno del equipo, no.
const enviable = d => !!d && (d.formato === 'html' || d.formato === 'md' || d.formato === 'archivo' || (d.formato === 'link' && /^https:\/\//.test(d.url || ''))) && !(d.tel === 'moon' && ['bienvenida', 'jason'].includes(d.seccion));

module.exports = { leerCifrado, preparar, modoDe, enviable, mdAHoja };
