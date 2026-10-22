const http=require('http'),fs=require('fs');
const html=()=>fs.readFileSync(''+require('path').resolve(__dirname,'../..')+'/centro/index.html');
const ahora=new Date().toISOString();
const personas=[];const et=['pendiente','en proceso','cerrado','en órbita','portafolio','archivo'];
for(let i=0;i<23;i++)personas.push({tel:'99'+String(i).padStart(8,'0'),telefono:'998'+i,nombre:'Persona '+i,negocio:i%2?'Refaccionaria y Autopartes del Sureste Hermanos Contreras número '+i:'',temperatura:['caliente','tibio','frio',''][i%4],etapa:et[i%6],servicio:'agente de llamadas',ultimo_contacto:ahora,contactos:2,es_prueba:i==22?1:0,encargados:i%3?'kid,dan':'daniel',proxima_cita:i==1?'lunes 26 a la 1 pm':'',notas_equipo:i==1?'Quiere el agente para su clínica; llamar después de las 4.':i==7?'Nota larga. '.repeat(60):''});
const proyectos=[];for(let i=1;i<=9;i++)proyectos.push({id:i,tel:personas[i].tel,nombre:'Proyecto '+i+(i==1?' agente de llamadas con agenda completa para la clínica':''),fase:['por arrancar','información','diseño','construcción','pruebas','entregado'][i%6],encargados:'kid',nota:'Nota corta',actualizado:ahora,uso_mes:i*3});
const tareas=[];for(let i=1;i<=17;i++)tareas.push({id:i,proyecto:i%9,titulo:'Tarea número '+i+' con un título algo largo para probar',detalle:'Detalle largo. '.repeat(i==15?300:3),para:['kid','dan','daniel'][i%3],de:i%4?'daniel':'sistema',estado:['nueva','vista','hecha'][i%3],vence:i==5?'2026-10-01':'',creado:ahora,visto:'',hecho:''});
http.createServer((q,r)=>{
 if(q.url.startsWith('/api/centro')){let b='';q.on('data',c=>b+=c);q.on('end',()=>{const d=JSON.parse(b||'{}');let o={ok:true};
  if(d.accion==='quienes')o.usuarios=[{id:'daniel',nombre:'Daniel',correo:'ta•••@gmail.com',tieneClave:true},{id:'dan',nombre:'Dan',tieneClave:false,correo:'da•••@hotmail.com'},{id:'kid',nombre:'Kid',tieneClave:true,correo:'ca•••@gmail.com'}];
  else if(d.accion==='entrar'||d.accion==='crear_clave')o.sesion='x'.repeat(43);
  else if(d.accion==='uso'){const hoy=new Date();o.cifras={hoy:3,semana:17,mes:58,personas:41,total:58};o.porDia=Array.from({length:28},(_,i)=>({d:new Date(Date.now()-5*36e5-i*864e5).toISOString().slice(0,10),n:(i*7)%9}));o.ultimos=Array.from({length:40},(_,i)=>({id:i+1,fecha:ahora,quien:i%3?'99'+String(i).padStart(8,'0'):'anon-'+i,canal:['llamada','chat','voz'][i%3],resumen:'Preguntó por los horarios de inscripción y el costo de la colegiatura '+i,datos:JSON.stringify({nombre:'Persona '+i,interes:'Licenciatura'})}));o.conectado=true;}
  else if(d.accion==='fotos'){const f='data:image/jpeg;base64,'+fs.readFileSync(require('path').join(__dirname,'prueba.jpg')).toString('base64');o.fotos={kid:f,dan:f,daniel:f};}
  else if(d.accion==='pedir_codigo')o.correo='da•••@hotmail.com';
  else if(d.accion==='inicio')Object.assign(o,{yo:{id:'kid',nombre:'Kid'},usuarios:[{id:'kid',rol:'Construye y diseña',lema:'Hecho con intención, todo cuenta.',creado:ahora},{id:'dan',rol:'Ventas y llamadas',lema:'',creado:ahora},{id:'daniel',rol:'Ideas y dirección',lema:'',creado:ahora}],personas,proyectos,tareas,actividad:[{id:1,fecha:ahora,quien:'daniel',texto:'movió a Grupo Beta a en proceso'}],listas:{fases:['por arrancar','información','diseño','construcción','pruebas','entregado']}});
  else if(d.accion==='ficha')Object.assign(o,{persona:personas.find(p=>p.tel===d.tel),contactos:Array.from({length:9},(_,i)=>({tipo:'llamada',canal:'llamada',fecha:ahora,resumen:'Llamó para preguntar algo '+i}))});
  r.setHeader('Content-Type','application/json');r.end(JSON.stringify(o));});return;}
 if(q.url.startsWith('/logo.svg')){r.setHeader('Content-Type','image/svg+xml');r.end(fs.readFileSync(''+require('path').resolve(__dirname,'../..')+'/centro/logo.svg'));return;}
 r.setHeader('Content-Type','text/html');r.end(html());
}).listen(8765);
