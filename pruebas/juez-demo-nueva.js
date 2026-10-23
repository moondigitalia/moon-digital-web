// Juez: /prueba/nueva cabe en una pantalla (sin scroll) en cada tamaño, sola y dentro del Centro, en cada vista y hoja.
const { chromium } = require('/opt/npm-tools/node_modules/playwright') // uso: node pruebas/juez-demo-nueva.js <raiz-del-repo> <carpeta-fotos>;
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = process.argv[2], salida = process.argv[3];
const demos = Array.from({ length: 23 }, (_, i) => ({ codigo: 'x' + i, negocio: i % 3 ? 'Negocio de prueba número ' + i : 'Taller Mecánico El Güero y Refaccionaria del Centro ' + i, creado: new Date().toISOString(), usos: i % 4 }));
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/api/prueba')) { let b = ''; q.on('data', c => b += c); q.on('end', () => { const d = JSON.parse(b || '{}'); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify(d.accion === 'crear' ? { ok: true, codigo: 'clinica-dental-sonrisa-k7q2', link: 'https://moondigitalia.com/prueba/clinica-dental-sonrisa-k7q2' } : { ok: true, demos, hoy: 7, tope: 30 })); }); return; }
  r.setHeader('Content-Type', 'text/html'); r.end(fs.readFileSync(path.join(raiz, 'prueba/nueva/index.html')));
}).listen(8790);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fallas = [];
  const tam = [[320, 568, ''], [375, 667, ''], [390, 844, ''], [1280, 800, ''], [320, 460, '?dentro=1'], [375, 560, '?dentro=1'], [390, 740, '?dentro=1'], [600, 640, '?dentro=1']];
  for (const esquema of ['light', 'dark']) for (const [w, h, q] of tam) {
    const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: esquema });
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.addInitScript(() => { try { localStorage.setItem('centro.moon.sesion', 'a'.repeat(64)); } catch (e) {} });
    await p.goto('http://localhost:8790/' + q); await p.waitForTimeout(700);
    const nom = `${esquema} ${w}x${h}${q ? ' dentro' : ''}`;
    const revisa = async (vista) => {
      const r = await p.evaluate(() => {
        const out = [];
        const de = document.scrollingElement; if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) out.push('página se mueve ' + de.scrollHeight + '>' + innerHeight);
        document.querySelectorAll('main *, .hoja, .hoja *').forEach(e => { const cs = getComputedStyle(e); if (e.offsetParent === null && cs.position !== 'fixed') return; if (e.scrollHeight > e.clientHeight + 1 && e.tagName !== 'TEXTAREA' && !e.classList.contains('lista') && !['A','BUTTON','SPAN','B','SMALL','LABEL','P','H1','H2','INPUT'].includes(e.tagName)) out.push('cortado: ' + (e.id || e.className || e.tagName) + ' ' + e.scrollHeight + '>' + e.clientHeight); const rc = e.getBoundingClientRect(); if (rc.width && !e.closest('.lista') && (rc.bottom > innerHeight + 1 || rc.right > innerWidth + 1)) out.push('se sale: ' + (e.id || e.className || e.tagName)); });
        return [...new Set(out)].slice(0, 5);
      });
      r.forEach(x => fallas.push(`${nom} ${vista}: ${x}`));
      if (esquema === 'light' && (w === 375 || w === 320)) await p.screenshot({ path: `${salida}/nueva-${w}x${h}${q ? '-dentro' : ''}-${vista}.png` });
    };
    await revisa('forma');
    await p.click('#pServicios'); await p.waitForTimeout(450); await p.fill('#hServicios', 'Limpieza $600'); await revisa('hoja-servicios'); await p.click('#hojaListo'); await p.waitForTimeout(450);
    await p.click('#pHorario'); await p.waitForTimeout(450); await revisa('hoja-horario'); await p.fill('#hHorario', 'L a S 9 a 7'); await p.click('#hojaListo'); await p.waitForTimeout(450);
    const past = await p.evaluate(() => [...document.querySelectorAll('.pastilla span')].map(s => s.textContent).join('|')); if (past !== 'Listo ✓|Horario ✓') fallas.push(nom + ' pastillas: ' + past);
    await p.click('#mis'); await p.waitForTimeout(450); await revisa('hoja-mis'); await p.click('#hojaListo'); await p.waitForTimeout(450);
    await p.fill('input[name=negocio]', 'Clínica Dental Sonrisa'); await p.fill('input[name=giro]', 'Clínica dental'); await p.click('#crear'); await p.waitForTimeout(500);
    await revisa('resultado');
    await p.close();
  }
  await b.close(); srv.close();
  console.log(fallas.length ? fallas.join('\n') : 'SIN FALLAS');
})();
