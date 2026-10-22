const { chromium } = require('playwright');
const tam=[[320,568],[375,667],[390,844],[430,932],[768,1024],[1280,800]];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(async()=>chromium.launch());
 const fallas=[];
 const corridas=[];for(const tema of ['light','dark'])for(const t of tam)corridas.push([tema,t,1]);for(const t of tam)corridas.push(['light',t,1.3]);for(const t of [[375,667],[1280,800]])corridas.push(['dark',t,1.15,'reduce']);
 for(const [tema,[w,h],z,rm] of corridas){console.log("CORRIDA",tema,w,h,z,rm||"");
  const c=await b.newContext({viewport:{width:w,height:h},colorScheme:tema,hasTouch:w<800,isMobile:w<800,reducedMotion:rm||'no-preference'});
  await c.addInitScript(z=>{try{localStorage.setItem('centro.moon.letra',String(z))}catch(e){}},z);
  await c.route(/^https?:\/\/(?!localhost)/,r=>r.abort());const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/');
  const quieto=()=>p.waitForFunction(()=>!document.documentElement.classList.contains('vt'),null,{timeout:5000}).catch(()=>{});
  const revisa=async(nombre)=>{await p.waitForTimeout(450);await p.waitForFunction(()=>!document.documentElement.classList.contains('vt'),null,{timeout:5000}).catch(()=>fallas.push('transicion atorada '+nombre));const r=await p.evaluate(()=>{const o=[];const W=innerWidth,H=innerHeight;
    scrollTo(0,400);if(scrollY||scrollX)o.push('la pagina se mueve '+scrollY);const ap=document.getElementById('app');if(ap&&ap.scrollHeight>ap.clientHeight+1)o.push('app desborda '+ap.scrollHeight+'>'+ap.clientHeight);
    if(document.documentElement.scrollHeight>H+1)o.push('scroll vertical '+document.documentElement.scrollHeight);
    document.querySelectorAll('body *').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.bottom>H+1)&&getComputedStyle(e).position!=='fixed'&&!e.closest('.recorte')&&!e.closest('.volteada .frente')&&!e.closest('.cred:not(.volteada) .atras'))o.push('se sale: '+e.tagName+'.'+e.className+' '+Math.round(b.right)+'x'+Math.round(b.bottom))});
    document.querySelectorAll('.cred').forEach(c=>{const vis=[...c.querySelectorAll('.cara')].filter(x=>getComputedStyle(x).display!=='none');if(vis.length!==1)o.push('credencial con '+vis.length+' caras visibles');if(!c.classList.contains('volteada')&&!vis[0].classList.contains('frente'))o.push('credencial de reversa')});
    document.querySelectorAll('.hoja,.t,.lista,.cuerpo').forEach(e=>{if(e.scrollHeight>e.clientHeight+2)o.push('cortado: '+e.className+' '+e.scrollHeight+'>'+e.clientHeight)});
    return o.slice(0,4)});
   if(r.length)fallas.push(`${tema} ${w}x${h} z${z} ${nombre}: ${r.join(' | ')}`);
   if((w===375||w===1280)) await p.screenshot({path:`${tema}-${w}-z${z}-${nombre}.png`});};
  await revisa('quien');
  await p.click('[data-u="kid"]'); await revisa('clave');
  if(w<800){await p.focus('#clave');await p.setViewportSize({width:w,height:Math.round(h*0.55)});await revisa('clave-teclado');const vis=await p.evaluate(()=>{const r=document.getElementById('clave').getBoundingClientRect();const b=document.querySelector('form .boton').getBoundingClientRect();return r.top>=0&&b.bottom<=innerHeight});if(!vis)fallas.push(`${tema} ${w}x${h} z${z} con teclado no se ve la contraseña o el boton`);await p.setViewportSize({width:w,height:h});}
  await p.fill('#clave','123456'); await p.click('form .boton'); await p.waitForSelector('.mosaico'); await revisa('inicio');
  for(const ir of ['tareas','crm','proyectos','equipo','moon']){await p.click(`[data-ir="${ir}"]`,{position:{x:12,y:12}});await revisa(ir);
    if(ir==='crm'){await revisa('crm-todos');await p.click('[data-g="en órbita"]');await revisa('crm-orbita');await p.click('[data-g="todos"]');await revisa('crm-todos2');await p.click('[data-p]');await revisa('ficha-estado');await p.click('#escribir');await revisa('nota');await p.click('#volver');for(const t of ['datos','proyectos','historial']){await p.click(`[data-tab="${t}"]`);await revisa('ficha-'+t);}await p.click('#volver');await p.click('#accion');await revisa('nuevo-cliente');await p.click('#volver');}
    if(ir==='proyectos'){await p.click('[data-y]');await revisa('proyecto-fase');await p.click('[data-tab="tareas"]');await revisa('proyecto-tareas');await p.click('[data-tab="uso"]');await revisa('proyecto-uso');await p.click('[data-u]');await revisa('uso-detalle');await p.click('#volver');await p.click('[data-tab="datos"]');await revisa('proyecto-datos');await p.click('#editar');await revisa('proyecto-editar');await p.click('#volver');await p.click('#volver');}
    if(ir==='tareas'){await p.click('[data-t="15"]');await revisa('tarea');if(await p.$('#leer')){await p.click('#leer');await revisa('lector');await p.click('#volver');}else fallas.push('sin boton leer '+w);await p.click('#volver');await p.click('#accion');await revisa('nueva-tarea');await p.click('#volver');}
    await p.click('#volver');}
  await p.click('#salir');await revisa('cuenta');await p.click('.cred');await revisa('cuenta-vuelta');
  await p.setInputFiles('#archivo','prueba.jpg');await p.waitForSelector('#rec');await revisa('foto');await p.click('#guardar');await p.waitForTimeout(400);await revisa('cuenta-despues');
  await p.click('#frase');await revisa('frase');await p.click('#volver');
  if(errs.length)fallas.push(`${tema} ${w}x${h} errores: ${errs.join(' | ')}`);
  await c.close();
 }
 console.log(fallas.length?fallas.join('\n'):'SIN FALLAS'); await b.close();
})();
