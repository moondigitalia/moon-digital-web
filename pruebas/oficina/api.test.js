// Prueba la API real (api/oficina.js) con una base falsa: sesión, estado, vidas, tope y Librería.
const path='' + require('path').resolve(__dirname, '../..') + '/api/_base.js'; const real=require(path);
const crudo=require('./crudo.json'); let preguntas=0, guardadas=[];
require.cache[require.resolve(path)].exports=Object.assign({},real,{sql:async(q,p)=>{
  if(q.includes('FROM sesiones'))return p[0]===real.crypto.createHash('sha256').update('T'.repeat(43)).digest('hex')?[{usuario:'kid',nombre:'Kid',tipo:'socio',activo:1}]:[];
  if(q.includes('FROM oficina'))return Object.entries(crudo).map(([clave,v])=>({clave,valor:JSON.stringify(v)})).concat([{clave:'a_mano',valor:JSON.stringify({asistentes:{a0:{telefono:'+520000000000',para:'Contesta el teléfono de MOON.'}}})}]);
  if(q.includes('COUNT(*) n, COALESCE'))return [{n:preguntas,u:12000}];
  if(q.includes('COUNT(*) n FROM libreria_preguntas'))return [{n:preguntas}];
  if(q.includes('FROM libreria'))return [{titulo:'Jason',texto:'Jason contesta el teléfono.'}];
  if(q.startsWith('INSERT INTO libreria_preguntas')){guardadas.push(p);return [];}
  throw new Error('sql inesperado '+q);}});
const h=require('' + require('path').resolve(__dirname, '../..') + '/api/oficina.js');
global.fetch=async(u,o)=>{const b=JSON.parse(o.body);return {ok:true,status:200,json:async()=>({content:[{type:'text',text:'Respuesta con '+b.model}],usage:{input_tokens:100,cache_read_input_tokens:3000,output_tokens:200}})};};
process.env.ANTHROPIC_LLAVE='x';
const llama=(accion,tok,extra)=>new Promise(ok=>{const res={statusCode:200,setHeader(){},end(s){ok({st:this.statusCode,j:JSON.parse(s||'{}')});}};h({method:'POST',headers:{'x-sesion':tok},body:Object.assign({accion},extra)},res);});
let mal=0; const ver=(c,n)=>{console.log((c?'✔ ':'✘ ')+n); if(!c)mal++;};
(async()=>{
  let r=await llama('estado','malo'.repeat(11)); ver(r.st===401,'sin sesión válida: no entra');
  r=await llama('estado','T'.repeat(43)); ver(r.j.ok,'con sesión: estado ok');
  const s=Object.fromEntries(r.j.oficina.suscripciones.lista.map(x=>[x.id,x]));
  ver(s.wispr.color==='verde','Wispr con recibo: verde'); ver(s.claude.color==='amarillo','Claude sin recibo: amarillo');
  ver(s.vencida.color==='rojo'&&s.vencida.aviso==='vencida','fecha pasada sin recibo: roja con emergencia');
  {const j=r.j.oficina.asistentes.lista.find(x=>x.id==='a0'),j0=crudo.asistentes.lista.find(x=>x.id==='a0');ver(j.telefono==='+520000000000'&&j.para&&j.platicas7d===j0.platicas7d&&!r.j.oficina.a_mano,'lo escrito a mano (teléfono, para) va encima de lo medido y no se pierde');}
  ver(r.j.oficina.cubiculos.length===3,'tres cubículos'); ver(typeof r.j.oficina.medicionAtrasada==='boolean','aviso de medición');
  require('fs').writeFileSync(__dirname+'/oficina.json',JSON.stringify(r.j.oficina));
  r=await llama('libreria','T'.repeat(43),{pregunta:'¿Qué hace Jason?'}); ver(r.j.ok&&/claude-haiku-5-5/.test(r.j.respuesta),'Librería contesta con el modelo barato');
  ver(guardadas.length===1&&guardadas[0][3]===100*1+3000*0.1+200*5,'Librería anota su costo ('+guardadas[0][3]+' millonésimas)');
  let pidio=[]; const f0=global.fetch; global.fetch=async(u,o)=>{const b=JSON.parse(o.body);pidio.push(!!b.tools);if(b.tools)return {ok:false,status:400,json:async()=>({error:{message:'web_search tool not available'}})};return f0(u,o);};
  r=await llama('libreria','T'.repeat(43),{pregunta:'¿Se puede en Instagram?'}); ver(r.j.ok&&pidio[0]===true&&pidio[1]===false,'si la búsqueda no está, contesta sin ella');
  global.fetch=f0;
  let vueltas=0; global.fetch=async(u,o)=>{vueltas++;const b=JSON.parse(o.body);if(vueltas===1)return {ok:true,status:200,json:async()=>({stop_reason:'pause_turn',content:[{type:'server_tool_use'},{type:'web_search_tool_result'}],usage:{input_tokens:10,server_tool_use:{web_search_requests:1}}})};return {ok:true,status:200,json:async()=>({stop_reason:'end_turn',content:[{type:'web_search_tool_result'},{type:'text',text:'Sí se puede en Instagram'}],usage:{input_tokens:10,output_tokens:5}})};};
  r=await llama('libreria','T'.repeat(43),{pregunta:'¿Instagram?'}); ver(r.j.ok&&r.j.respuesta==='Sí se puede en Instagram'&&vueltas===2,'si la búsqueda pausa, Jason sigue y contesta');
  global.fetch=async()=>({ok:true,status:200,json:async()=>({stop_reason:'end_turn',content:[{type:'web_search_tool_result'}],usage:{}})});
  r=await llama('libreria','T'.repeat(43),{pregunta:'algo'}); ver(!r.j.ok&&r.j.mensaje,'respuesta vacía nunca se muestra en blanco: avisa');
  global.fetch=f0;
  preguntas=60; r=await llama('libreria','T'.repeat(43),{pregunta:'otra'}); ver(!r.j.ok&&r.j.error==='tope','tope diario funciona');
  r=await llama('libreria','T'.repeat(43),{pregunta:''}); ver(!r.j.ok,'pregunta vacía no gasta');
  console.log(mal?mal+' MAL':'todo bien'); process.exit(mal?1:0);
})();
