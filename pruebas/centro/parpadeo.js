const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await c.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
const p=await c.newPage();const fallas=[];
await p.goto('http://localhost:8765/');await p.click('[data-u="kid"]');await p.fill('#clave','x');await p.click('form .boton');await p.waitForSelector('.mosaico');await p.waitForTimeout(1500);
await p.evaluate(()=>{window.__rep=0;new MutationObserver(m=>{if(m.some(x=>x.type==='childList'&&x.target.id==='app'))window.__rep++}).observe(document.getElementById('app'),{childList:true});});
const paso=async(nom,f)=>{await p.evaluate(()=>window.__rep=0);await f();await p.waitForTimeout(1800);const n=await p.evaluate(()=>window.__rep);console.log(nom,'repintadas:',n);if(n>1)fallas.push(nom+' '+n);};
await paso('crm',()=>p.click('[data-ir="crm"]',{position:{x:12,y:12}}));
await paso('ficha',()=>p.click('[data-p]'));
await paso('tab datos',()=>p.click('[data-tab="datos"]'));
await paso('volver',()=>p.click('#volver'));await paso('volver2',()=>p.click('#volver'));
await paso('proyectos',()=>p.click('[data-ir="proyectos"]',{position:{x:12,y:12}}));
await paso('proyecto',()=>p.click('[data-y]'));
await paso('tab uso',()=>p.click('[data-tab="uso"]'));
await p.click('#volver');await p.waitForTimeout(600);await p.click('#volver');await p.waitForTimeout(600);
await paso('equipo',()=>p.click('[data-ir="equipo"]',{position:{x:12,y:12}}));
await p.click('#volver');await p.waitForTimeout(600);
await paso('cuenta',()=>p.click('#salir'));
// Capturas DURANTE la transición a Equipo: ninguna debe mostrar una credencial al revés
await p.click('#volver');await p.waitForTimeout(600);
await p.click('[data-ir="equipo"]',{position:{x:12,y:12}});
for(let i=0;i<8;i++){const r=await p.evaluate(()=>[...document.querySelectorAll('.cred .cara')].filter(x=>getComputedStyle(x).display!=='none'&&x.classList.contains('atras')).length);if(r)fallas.push('reversa visible en transicion');await p.screenshot({path:'tr'+i+'.png'});await p.waitForTimeout(50);}
console.log(fallas.length?'FALLAS '+fallas.join(', '):'SIN REPINTADAS DE MAS');await b.close();})();
