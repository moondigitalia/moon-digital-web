const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = process.argv[2], salida = process.argv[3];
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/api/prueba')) { let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ const d=JSON.parse(b||'{}'); r.setHeader('Content-Type','application/json'); r.end(JSON.stringify(d.accion==='datos'?{ok:true,agente:'a',voz_id:'v',demo:{negocio:'Taller Mecánico El Güero y Refaccionaria',giro:'x',asistente:'Sofía',conocido:false}}:d.accion==='respuesta'&&!d.whatsapp&&d.opcion!=='no'?{ok:false,error:'whatsapp'}:{ok:true})); }); return; }
  if (q.url.includes('elevenlabs')) { r.end(''); return; }
  r.setHeader('Content-Type','text/html'); r.end(fs.readFileSync(path.join(raiz,'prueba/index.html')));
}).listen(8791);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const fallas=[];
  for (const esquema of ['light','dark']) for (const [w,h] of [[320,568],[375,667],[390,844],[1280,800]]) {
    const p=await b.newPage({viewport:{width:w,height:h},colorScheme:esquema}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
    await p.goto('http://localhost:8791/prueba/taller-x'); await p.waitForTimeout(500);
    const revisa=async v=>{ await p.waitForTimeout(400); const r=await p.evaluate(()=>{const o=[];const de=document.scrollingElement;if(de.scrollHeight>innerHeight+1||de.scrollWidth>innerWidth+1)o.push('se mueve');document.querySelectorAll('main *, .hoja *').forEach(e=>{if(e.offsetParent===null||e.closest('[hidden]'))return;const rc=e.getBoundingClientRect();if(rc.width&&(rc.bottom>innerHeight+1||rc.right>innerWidth+1||rc.top<-1))o.push('se sale '+(e.id||e.className||e.tagName));});return [...new Set(o)];}); r.forEach(x=>fallas.push(`${esquema} ${w}x${h} ${v}: ${x}`)); if(esquema==='light'&&w===320) await p.screenshot({path:`${salida}/p-${w}-${v}.png`}); };
    await revisa('listo');
    await p.evaluate(()=>{ conecto=true; pintar('termino'); });
    await revisa('termino');
    await p.click('[data-op=quiero]'); await revisa('hoja');
    await p.fill('#hoja input[name=nombre]','Laura'); await p.fill('#hoja input[name=whatsapp]','9981234567'); await p.click('#hojaListo'); await p.waitForTimeout(500);
    await revisa('gracias');
    errs.forEach(x=>fallas.push(`${w}x${h} error: ${x}`)); await p.close();
  }
  await b.close(); srv.close(); console.log(fallas.length?fallas.join('\n'):'SIN FALLAS');
})();
