// Servidor de prueba: sirve la página y contesta las APIs con datos de muestra (sin tocar nada real).
const http=require('http'),fs=require('fs');
const pag=fs.readFileSync('' + require('path').resolve(__dirname, '../..') + '/oficina/index.html');
const O=JSON.parse(fs.readFileSync(__dirname+'/oficina.json'));
const largo='Universidad Internacional de Estudios Superiores del Caribe Mexicano';
const per=[{tel:'5512345678',nombre:'Santi',negocio:'Taller',etapa:'pendiente',necesidad:'Contestar llamadas'},{tel:'9981112233',nombre:'Prueba equipo',etapa:'archivo',es_prueba:1},{tel:'5500000001',nombre:'Maximiliano Alejandro Hernández',negocio:largo,etapa:'en proceso'}];
for(let i=0;i<18;i++)per.push({tel:'55000001'+String(i).padStart(2,'0'),nombre:'Persona '+i,negocio:'Negocio '+i,etapa:['pendiente','cerrado','archivo','en proceso'][i%4]});
const C={ok:true,personas:per,
 llamadas:[{fecha:new Date().toISOString(),quien:'5512345678',resumen:'Santi preguntó por el asistente',datos:'{"nombre":"Santi","resultado":"Sin cita ni recado"}',prueba:0}],
 documentos:[{id:'d1',tel:'5512345678',titulo:'Propuesta',seccion:'propuesta'},{id:'d2',tel:'5512345678',titulo:'Contrato firmado',seccion:'contrato',formato:'link',url:'https://example.com/contrato'}],paneles:[],proyectos:[]};
http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
 if(q.url.startsWith('/api/')){const d=JSON.parse(b||'{}');let j={ok:false};
  if(d.accion==='quienes')j={ok:true,usuarios:[{id:'daniel'},{id:'dan'},{id:'kid'}]};
  if(d.accion==='entrar')j=d.clave==='bien'?{ok:true,sesion:'x'.repeat(43)}:{ok:false,error:'clave'};
  if(d.accion==='estado')j={ok:true,oficina:O};
  if(d.accion==='inicio')j=C;
  if(d.accion==='ficha')j={ok:true,persona:C.personas.find(p=>p.tel===d.tel),contactos:[{canal:'llamada',fecha:new Date().toISOString(),resumen:'Llamó'}]};
  if(d.accion==='documento')j={ok:true,doc:{compartir:'https://moondigitalia.com/ver/abc'}};
  if(d.accion==='libreria')j={ok:true,respuesta:'Respuesta de prueba a: '+d.pregunta};
  r.setHeader('content-type','application/json');return r.end(JSON.stringify(j));}
 if(q.url.startsWith('/oficina/monitos/')){const f=require('path').resolve(__dirname,'../..')+q.url.split('?')[0];if(!fs.existsSync(f)){r.statusCode=404;return r.end();}r.setHeader('content-type',f.endsWith('.json')?'application/json':'image/webp');return r.end(fs.readFileSync(f));}
 if(q.url.startsWith('/oficina/piel.js')){r.setHeader('content-type','text/javascript');return r.end(fs.readFileSync(require('path').resolve(__dirname,'../..')+'/oficina/piel.js'));}
 r.setHeader('content-type','text/html');r.end(q.url.startsWith('/prueba')?'<p>crea</p>':fs.readFileSync(require('path').resolve(__dirname,'../..')+'/oficina/index.html'));});}).listen(8811);
