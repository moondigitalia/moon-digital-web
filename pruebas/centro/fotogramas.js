// Juez de parpadeo por fotogramas: toma capturas seguidas durante cada cambio de pantalla.
// Un parpadeo = un fotograma con mucho más "fondo vacío" que la pantalla de antes y la de después.
const { chromium } = require('playwright');
const { PNG } = (()=>{try{return require('pngjs')}catch(e){return {}}})();
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const fallas=[];
for(const tema of ['light','dark']){
const c=await b.newContext({viewport:{width:390,height:844},colorScheme:tema,isMobile:true,hasTouch:true});await c.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
const p=await c.newPage();const cdp=await c.newCDPSession(p);
await p.goto('http://localhost:8765/');await p.click('[data-u="kid"]');await p.fill('#clave','x');await p.click('form .boton');await p.waitForSelector('.mosaico');await p.waitForTimeout(1200);
const fondo=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number));
const vacio=async()=>{const buf=await p.screenshot({type:'png'});const img=PNG.sync.read(buf);let n=0,t=0;for(let i=0;i<img.data.length;i+=16){t++;if(Math.abs(img.data[i]-fondo[0])<6&&Math.abs(img.data[i+1]-fondo[1])<6&&Math.abs(img.data[i+2]-fondo[2])<6)n++;}return n/t;};
// El cambio de pantalla a propósito pasa suave por el fondo (lo viejo se va, lo nuevo aparece). Es parpadeo si:
// la pantalla se vacía DOS veces (se va, regresa y se vuelve a ir), o si después de 450 ms sigue vacía.
const paso=async(nom,f)=>{const antes=await vacio();const t0=Date.now();await f();const fr=[];for(let i=0;i<10;i++){fr.push([Date.now()-t0,await vacio()]);await p.waitForTimeout(25);}await p.waitForTimeout(500);const despues=await vacio();
  const lim=Math.max(antes,despues)+0.06;let subidas=0,arriba=false;for(const [,v] of fr){if(v>lim&&!arriba){subidas++;arriba=true}else if(v<=lim)arriba=false;}
  const tarde=fr.filter(([t,v])=>t>450&&v>lim).length;const peor=Math.max(...fr.map(x=>x[1]));
  console.log(tema,nom,'antes',antes.toFixed(2),'peor',peor.toFixed(2),'despues',despues.toFixed(2),'vaciados',subidas,'tarde',tarde);if(subidas>1||tarde)fallas.push(tema+' '+nom);};
await paso('crm',()=>p.click('[data-ir="crm"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('lista',()=>p.click('[data-g="todos"]',{noWaitAfter:true}));await paso('ficha',()=>p.click('[data-p]',{noWaitAfter:true}));
await paso('volver',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver2',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver3',()=>p.click('#volver',{noWaitAfter:true}));
await paso('equipo',()=>p.click('[data-ir="equipo"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('tareas de Daniel',()=>p.click('[data-u="daniel"]',{noWaitAfter:true}));
await paso('volver3',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver4',()=>p.click('#volver',{noWaitAfter:true}));
await paso('cuenta',()=>p.click('#salir',{noWaitAfter:true}));
await paso('volver5',()=>p.click('#volver',{noWaitAfter:true}));
await paso('clientes',()=>p.click('[data-ir="clientes"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('cliente',()=>p.click('[data-c]',{noWaitAfter:true}));
await paso('documento',()=>p.click('.rect[data-s="material"]',{noWaitAfter:true}));
await paso('volver6',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver7',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver8',()=>p.click('#volver',{noWaitAfter:true}));
await paso('casa',()=>p.click('[data-ir="casa"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('bienvenida',()=>p.click('[data-j="bienvenida"]',{noWaitAfter:true}));
await paso('volver9',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver10',()=>p.click('#volver',{noWaitAfter:true}));
// Crea tu recepcionista: el marco de adentro nunca enseña una hoja blanca mientras carga (en oscuro se notaría como destello).
if(tema==='dark'){await p.route(/\/prueba\/nueva/,async r=>{await new Promise(x=>setTimeout(x,700));r.continue()});
 await p.click('[data-ir="demo"]',{position:{x:12,y:12},noWaitAfter:true});let peor=0;for(let i=0;i<14;i++){const img=PNG.sync.read(await p.screenshot({type:'png'}));let n=0,t=0;for(let k=0;k<img.data.length;k+=16){t++;if(img.data[k]>235&&img.data[k+1]>235&&img.data[k+2]>235)n++;}peor=Math.max(peor,n/t);await p.waitForTimeout(60);}
 console.log(tema,'recepcionista blanco',peor.toFixed(2));if(peor>0.15)fallas.push(tema+' recepcionista: destello blanco al abrir');}
await c.close();}
console.log(fallas.length?'PARPADEA: '+fallas.join(', '):'SIN PARPADEO');await b.close();})();
