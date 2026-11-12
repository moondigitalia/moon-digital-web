// Prueba la API real (api/oficina.js) con una base falsa: sesión, estado, vidas, tope y Librería.
const path='' + require('path').resolve(__dirname, '../..') + '/api/_base.js'; const real=require(path);
const crudo=require('./crudo.json'); let preguntas=0, guardadas=[];
require.cache[require.resolve(path)].exports=Object.assign({},real,{sql:async(q,p)=>{
  if(q.includes('FROM sesiones'))return p[0]===real.crypto.createHash('sha256').update('T'.repeat(43)).digest('hex')?[{usuario:'kid',nombre:'Kid',tipo:'socio',activo:1}]:[];
  if(q.includes('FROM oficina'))return Object.entries(crudo).map(([clave,v])=>({clave,valor:JSON.stringify(v)}));
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
  ver(r.j.oficina.cubiculos.length===3,'tres cubículos'); ver(typeof r.j.oficina.medicionAtrasada==='boolean','aviso de medición');
  require('fs').writeFileSync(__dirname+'/oficina.json',JSON.stringify(r.j.oficina));
  r=await llama('libreria','T'.repeat(43),{pregunta:'¿Qué hace Jason?'}); ver(r.j.ok&&/claude-haiku-5-5/.test(r.j.respuesta),'Librería contesta con el modelo barato');
  ver(guardadas.length===1&&guardadas[0][3]===100*1+3000*0.1+200*5,'Librería anota su costo ('+guardadas[0][3]+' millonésimas)');
  preguntas=60; r=await llama('libreria','T'.repeat(43),{pregunta:'otra'}); ver(!r.j.ok&&r.j.error==='tope','tope diario funciona');
  r=await llama('libreria','T'.repeat(43),{pregunta:''}); ver(!r.j.ok,'pregunta vacía no gasta');
  console.log(mal?mal+' MAL':'todo bien'); process.exit(mal?1:0);
})();
