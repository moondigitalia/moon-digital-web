// Juez de /prueba/nueva (Demos): todo cabe en una pantalla, sin scroll de página, en cada tamaño, claro/oscuro,
// sola y dentro del Centro; para Dan (formulario, resultado, tablero y sus hojas) y para la puerta abierta.
// Las listas dentro de una hoja sí se deslizan (regla de Kid). Uso: node pruebas/juez-demo-nueva.js <raiz-repo> <carpeta-fotos>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = process.argv[2], salida = process.argv[3];
const ahora = new Date().toISOString();
const demos = Array.from({ length: 23 }, (_, i) => ({ codigo: 'x' + i, negocio: i % 3 ? 'Negocio de prueba número ' + i : 'Taller Mecánico El Güero y Refaccionaria del Centro ' + i, contacto: i % 2 ? 'Laura Martínez' : '', puerta: i % 2 ? 'abierta' : 'dan', creado: ahora, vistas: i % 5, usos: i % 4, respuesta: ['', 'quiero', 'llamada', 'no'][i % 4], cerrado: i === 1 }));
const tablero = { ok: true, demos, cobros: [{ tel: '1', nombre: 'Laura', negocio: 'Clínica Dental Sonrisa', cobro_total: 12000, cobro_mensual: 1500, cobro_fecha: ahora }], hoy: { dan: 7, abierta: 3 }, topes: { dan: 30, abierta: 20 }, gasto: { hoy: { todas: true, platicas: 14, mxn: 87, porAgente: [{ nombre: 'Jason', mxn: 40 }, { nombre: 'Demo personalizado — Recepcionista MOON (plantilla)', mxn: 47 }] }, mes: { todas: true, platicas: 120, mxn: 912 } } };
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/api/prueba')) { let b = ''; q.on('data', c => b += c); q.on('end', () => { const d = JSON.parse(b || '{}'); const ses = String(q.headers['x-sesion'] || '').length > 40; r.setHeader('Content-Type', 'application/json');
    const o = d.accion === 'crear' ? { ok: true, codigo: 'clinica-dental-sonrisa-k7q2', link: 'https://moondigitalia.com/prueba/clinica-dental-sonrisa-k7q2' }
      : d.accion === 'tablero' ? tablero : d.accion === 'buscar_persona' ? { ok: true, lista: demos.slice(0, 9).map((x, i) => ({ tel: String(i), nombre: 'Persona ' + i, negocio: x.negocio, etapa: 'pendiente' })) }
      : d.accion === 'mios' ? (ses ? { ok: true, demos, hoy: 7, tope: 30 } : { ok: false, error: 'sesion' }) : { ok: true };
    // Internet lento a propósito: la página tiene que verse completa sin esperar la respuesta (Kid: 'tarda una eternidad').
    setTimeout(() => r.end(JSON.stringify(o)), d.accion === 'mios' || d.accion === 'tablero' ? 1500 : 0); }); return; }
  r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(path.join(raiz, 'prueba/nueva/index.html')));
}).listen(8790);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fallas = [];
  const tam = [[320, 568, ''], [375, 667, ''], [390, 844, ''], [1280, 800, ''], [320, 460, '?dentro=1'], [375, 560, '?dentro=1'], [390, 740, '?dentro=1'], [600, 640, '?dentro=1']];
  for (const esquema of ['light', 'dark']) for (const [w, h, q] of tam) for (const quien of q ? ['dan'] : ['dan', 'abierta']) {
    const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: esquema });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    if (quien === 'dan') await p.addInitScript(() => { try { localStorage.setItem('centro.moon.sesion', 'a'.repeat(64)); } catch (e) {} });
    await p.goto('http://localhost:8790/' + q); await p.waitForTimeout(600);
    const nom = `${esquema} ${w}x${h}${q ? ' dentro' : ''} ${quien}`;
    const revisa = async (vista) => {
      await p.waitForTimeout(420);
      const r = await p.evaluate(() => {
        const out = [];
        const de = document.scrollingElement; if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) out.push('página se mueve ' + de.scrollHeight + '>' + innerHeight);
        document.querySelectorAll('main *, .hoja, .hoja *').forEach(e => {
          const cs = getComputedStyle(e); if (e.offsetParent === null && cs.position !== 'fixed') return; if (e.closest('[hidden]')) return;
          if (e.scrollHeight > e.clientHeight + 1 && cs.overflow !== 'visible' && e.tagName !== 'TEXTAREA' && !e.classList.contains('lista') && !['A', 'BUTTON', 'SPAN', 'B', 'SMALL', 'LABEL', 'P', 'H1', 'H2', 'INPUT', 'I'].includes(e.tagName)) out.push('cortado: ' + (e.id || e.className || e.tagName) + ' ' + e.scrollHeight + '>' + e.clientHeight);
          const rc = e.getBoundingClientRect(); if (rc.width && !e.closest('.lista') && (rc.bottom > innerHeight + 1 || rc.right > innerWidth + 1)) out.push('se sale: ' + (e.id || e.className || e.tagName));
          // Ninguna palabra partida: un texto de una sola palabra no debe ocupar dos renglones.
          // Renglón extra: una sola palabra suelta en el último renglón de un título o texto.
          if (['P', 'H1', 'H2'].includes(e.tagName) && e.children.length === 0) { const n = e.firstChild; if (n && n.nodeType === 3) { const ws = [...n.textContent.matchAll(/\S+/g)]; if (ws.length > 3) { const top = m => { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const r = rg.getClientRects(); return r.length ? Math.round(r[r.length - 1].top) : 0; }; const a1 = top(ws[ws.length - 1]), a2 = top(ws[ws.length - 2]); if (a1 > a2 + 2) out.push('palabra sola en su renglón: ' + ws[ws.length - 1][0] + ' (' + (e.id || e.className || e.tagName) + ')'); } } }
          for (const n of e.childNodes) if (n.nodeType === 3) for (const m of n.textContent.matchAll(/\S{4,}/g)) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const tops = new Set([...rg.getClientRects()].map(x => Math.round(x.top))); if (tops.size > 1) out.push('palabra partida: ' + m[0]); }
        });
        return [...new Set(out)].slice(0, 6);
      });
      r.forEach(x => fallas.push(`${nom} ${vista}: ${x}`));
      if (esquema === 'light' && (w === 375 || w === 320)) await p.screenshot({ path: `${salida}/n-${quien}-${w}x${h}${q ? '-dentro' : ''}-${vista}.png` });
    };
    // Teclado: la pantalla se achica casi a la mitad; el campo que se llena se ve completo y no queda nada gris ni tapado.
    const teclado = async (sel) => {
      if (w > 800) return;
      await p.focus(sel); await p.setViewportSize({ width: w, height: Math.round(h * 0.46) }); await p.waitForTimeout(350);
      const r = await p.evaluate(s => { const e = document.querySelector(s), c = e.getBoundingClientRect(); const o = [];
        if (!e.offsetParent || c.height < 10) o.push('campo escondido'); if (c.top < 0 || c.bottom > innerHeight + 1) o.push('campo fuera de la vista ' + Math.round(c.top) + '/' + Math.round(c.bottom) + '>' + innerHeight);
        const de = document.scrollingElement; if (de.scrollHeight > innerHeight + 1) o.push('página se mueve con teclado');
        return o; }, sel);
      r.forEach(x => fallas.push(`${nom} teclado ${sel}: ${x}`));
      if (esquema === 'light' && w === 375) await p.screenshot({ path: `${salida}/n-${quien}-${w}${q ? '-dentro' : ''}-teclado-${sel.replace(/\W/g, '')}.png` });
      await p.evaluate(() => document.activeElement.blur()); await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(300);
      const vuelve = await p.evaluate(() => document.documentElement.classList.contains('tecleando'));
      if (vuelve) fallas.push(`${nom} teclado ${sel}: no regresa a la vista completa`);
    };
    if (quien === 'abierta') {
      await revisa('bienvenida'); await p.click('#empezar');
      await revisa('paso1'); await teclado('input[name=whatsapp]');
      await p.fill('input[name=contacto]', 'Laura'); await p.fill('input[name=whatsapp]', '9981234567'); await p.click('#paso1 .boton');
      await revisa('forma-abierta');
    } else {
      await revisa('forma');
      for (const x of ['input[name=negocio]', 'input[name=giro]', 'input[name=asistente]']) await teclado(x);
      await p.click('#pServicios'); await revisa('hoja-servicios'); await p.click('#hojaListo'); await p.waitForTimeout(400);
      await p.click('#pHorario'); await revisa('hoja-horario'); await p.click('#hojaListo'); await p.waitForTimeout(400);
      await p.fill('input[name=negocio]', 'Clínica Dental Sonrisa'); await p.fill('input[name=giro]', 'Clínica dental'); await p.click('#crear'); await p.waitForTimeout(400);
      await revisa('resultado');
      await p.click('.pestana[data-v=tablero]'); await revisa('tablero');
      await p.click('[data-paso=quieren]'); await revisa('hoja-quieren'); await p.click('#velo', { position: { x: 5, y: 5 } }); await p.waitForTimeout(400);
      await p.click('#tGasto'); await revisa('hoja-gasto'); await p.click('#velo', { position: { x: 5, y: 5 } }); await p.waitForTimeout(400);
      await p.click('#anotar'); await p.waitForTimeout(500); await revisa('hoja-cierre');
      await p.click('#resultados [data-i="0"]'); await revisa('hoja-cierre-montos');
    }
    errs.forEach(x => fallas.push(nom + ' error de página: ' + x));
    await p.close();
  }
  await b.close(); srv.close();
  console.log(fallas.length ? fallas.join('\n') : 'SIN FALLAS');
})();
