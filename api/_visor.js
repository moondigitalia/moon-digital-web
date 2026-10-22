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
  const css = (String(html).match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim().split(',').pop().trim(), cuerpo: m[2] }));
  const lam = reglas.find(r => /width:\s*1920px/.test(r.cuerpo) && /height:\s*1080px/.test(r.cuerpo) && !/^(html|body|\*|:root)/.test(r.sel));
  if (lam) return { modo: 'laminas', sel: lam.sel, fondo: '#111' };
  const hoja = reglas.find(r => /width:\s*(210mm|8\.5in|816px|794px)/.test(r.cuerpo) && /height:\s*(297mm|11in|1056px|1123px)/.test(r.cuerpo) && !/^(html|body|\*|:root|@page)/.test(r.sel));
  if (hoja) return { modo: 'hojas', sel: hoja.sel, fondo: '#dfe2ea' };
  return { modo: 'ancho', sel: '', fondo: '#fff' };
}

// suelto = se abre solo (el link del cliente): dibuja sus propias flechas. Dentro del Centro, las flechas son del Centro.
function guion(sel, fondo, suelto) {
  const css = sel ? `<style id="visor-moon">html,body{margin:0!important;height:100%!important;overflow:hidden!important;background:${fondo}!important}
.visor-u{position:absolute!important;left:50%!important;top:var(--cy,50%)!important;margin:0!important;transform:translate(-50%,-50%) scale(var(--k,.5))!important;opacity:0;pointer-events:none;transition:opacity .3s ease;box-shadow:0 10px 40px rgba(0,0,0,.18)}
.visor-u.actual{opacity:1;pointer-events:auto}
#visor-barra{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(20,22,30,.86);color:#fff;border-radius:99px;padding:6px;font:700 14px system-ui,-apple-system,sans-serif;z-index:2147483647}
#visor-barra button{all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14)}
#visor-barra span{min-width:64px;text-align:center}</style>` : '';
  const js = `<script>(function(){var SEL=${JSON.stringify(sel)},SUELTO=${suelto ? 1 : 0},marco=parent!==window;
if(!SEL){var aj=function(){var d=document.documentElement;d.style.zoom='';var w=Math.max(d.scrollWidth,document.body?document.body.scrollWidth:0);if(w>innerWidth+2)d.style.zoom=innerWidth/w};
addEventListener('DOMContentLoaded',aj);addEventListener('load',aj);addEventListener('resize',aj);if(marco)addEventListener('load',function(){parent.postMessage({total:1,lamina:0},'*')});return}
var L=[],i=0,barra=null,txt=null,BAR=SUELTO&&!marco?68:0;
function k(){if(!L.length)return;var w=L[0].offsetWidth,h=L[0].offsetHeight,m=Math.min(innerWidth,innerHeight)<600?8:24;
var s=Math.min((innerWidth-m*2)/w,(innerHeight-BAR-m*2)/h);document.documentElement.style.setProperty('--k',s);document.documentElement.style.setProperty('--cy',((innerHeight-BAR)/2)+'px')}
function unidades(){var v=[];[].slice.call(document.querySelectorAll(SEL)).forEach(function(e){var u=e;while(u.parentElement&&u.parentElement!==document.body&&u.parentElement.offsetWidth===e.offsetWidth&&u.parentElement.offsetHeight===e.offsetHeight)u=u.parentElement;if(v.indexOf(u)<0)v.push(u)});v.forEach(function(u){u.classList.add('visor-u')});return v}
function ver(n){if(!L.length)L=unidades();if(!L.length)return;i=(n+L.length)%L.length;L.forEach(function(s,j){s.classList.toggle('actual',j===i)});k();
if(marco)parent.postMessage({lamina:i,total:L.length},'*');if(txt)txt.textContent=(i+1)+' de '+L.length}
function hazBarra(){if(!BAR||barra||L.length<2)return;barra=document.createElement('div');barra.id='visor-barra';
barra.innerHTML='<button aria-label="Anterior"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button><span></span><button aria-label="Siguiente"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>';
document.body.appendChild(barra);txt=barra.querySelector('span');var b=barra.querySelectorAll('button');b[0].onclick=function(){ver(i-1)};b[1].onclick=function(){ver(i+1)}}
addEventListener('message',function(e){if(e.data&&typeof e.data.lamina==='number')ver(e.data.lamina)});
addEventListener('resize',k);addEventListener('DOMContentLoaded',function(){L=unidades();hazBarra();ver(0)});addEventListener('load',k);
var x0=null;addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)ver(i+(dx<0?1:-1))});
addEventListener('keydown',function(e){if(e.key==='ArrowRight')ver(i+1);if(e.key==='ArrowLeft')ver(i-1)});})();<\/script>`;
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

// Solo estos se pueden mandar fuera: lo del cliente y la presentación/página de MOON. Lo interno del equipo, no.
const enviable = d => !!d && (d.formato === 'html' || d.formato === 'md' || (d.formato === 'link' && /^https:\/\//.test(d.url || ''))) && !(d.tel === 'moon' && ['bienvenida', 'jason'].includes(d.seccion));

module.exports = { leerCifrado, preparar, modoDe, enviable };
