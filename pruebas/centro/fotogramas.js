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
const paso=async(nom,f)=>{const antes=await vacio();await f();const fr=[];for(let i=0;i<10;i++){fr.push(await vacio());await p.waitForTimeout(25);}await p.waitForTimeout(500);const despues=await vacio();
  const peor=Math.max(...fr);const lim=Math.max(antes,despues)+0.06;console.log(tema,nom,'antes',antes.toFixed(2),'peor',peor.toFixed(2),'despues',despues.toFixed(2));if(peor>lim)fallas.push(tema+' '+nom);};
await paso('crm',()=>p.click('[data-ir="crm"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('ficha',()=>p.click('[data-p]',{noWaitAfter:true}));
await paso('volver',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver2',()=>p.click('#volver',{noWaitAfter:true}));
await paso('equipo',()=>p.click('[data-ir="equipo"]',{position:{x:12,y:12},noWaitAfter:true}));
await paso('tareas de Daniel',()=>p.click('[data-u="daniel"]',{noWaitAfter:true}));
await paso('volver3',()=>p.click('#volver',{noWaitAfter:true}));await paso('volver4',()=>p.click('#volver',{noWaitAfter:true}));
await paso('cuenta',()=>p.click('#salir',{noWaitAfter:true}));
await c.close();}
console.log(fallas.length?'PARPADEA: '+fallas.join(', '):'SIN PARPADEO');await b.close();})();
