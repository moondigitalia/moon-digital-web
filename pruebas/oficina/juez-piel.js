// JUEZ DE LA PIEL 3D: mide en todas las pantallas el tamaño de los monitos, el rango del zoom,
// que ninguna etiqueta se encime con otra ni con un monito, y que dibujar no sea lento (procesador 4× lento).
const { chromium } = require('playwright');
// La Oficina es la pantalla de inicio del Tablero y vive en su propia caja (sombra): se mide adentro de ella.
const PRELUDIO = () => { window.ofiR = () => document.getElementById('ofi').shadowRoot; Object.defineProperty(window, 'vista', { get: () => window.__ofi.vista, configurable: true }); Object.defineProperty(window, 'MUNDO', { get: () => window.__ofi.MUNDO, configurable: true }); for (const f of ['zoomEn', 'dibujarMundo', 'ajustarVista', 'abrirHerramienta']) window[f] = (...a) => window.__ofi[f](...a); try { localStorage.setItem('centro.moon.recorrido', 'todos'); } catch (e) {} };

const PANT = [[320, 568], [360, 640], [375, 667], [390, 844], [414, 896], [667, 375], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];
const URL = process.env.URL || 'http://localhost:8822/tablero';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  let mal = 0; const filas = [];
  for (const [w, h] of PANT) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
    await c.addInitScript(() => { localStorage.setItem('centro.moon.sesion', 'T'.repeat(43)); }); await c.addInitScript(PRELUDIO);
    const p = await c.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto(URL); await p.waitForSelector('#mundo svg'); await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const r = ofiR().getElementById('oficina').getBoundingClientRect();
      const fit = vista.z, monoFit = vista.z * MUNDO.mono;
      zoomEn(r.width / 2, r.height / 2, 99); const max = vista.z, monoMax = vista.z * MUNDO.mono, leer = ofiR().getElementById('mundo').classList.contains('leer');
      // encimados (en el dibujo; las etiquetas crecen con el zoom igual que todo, así que basta medir una vez)
      const cajas = [...ofiR().querySelectorAll('#mundo svg .nom rect')].map(e => e.getBBox()), monos = [...ofiR().querySelectorAll('#mundo svg .mono-3d, #mundo svg .claude-3d')].map(e => e.getBBox());
      const ch = (a, b) => a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;
      let ee = 0; for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) if (ch(cajas[i], cajas[j])) ee++;
      zoomEn(r.width / 2, r.height / 2, 0.0001); const min = vista.z;
      const cabe = MUNDO.w * min <= r.width + 1 && MUNDO.h * min <= r.height + 1;
      return { fit, monoFit, max, monoMax, leer, etiquetas: cajas.length, encimadas: ee, min, cabe };
    });
    const ok = m.monoFit >= 11.5 && m.monoMax >= 150 && m.leer && m.encimadas === 0 && m.cabe && !err.length;
    if (!ok) mal++;
    filas.push(`${ok ? '✔' : '✘'} ${w}x${h}: monito ${m.monoFit.toFixed(0)} px al ver todo → ${m.monoMax.toFixed(0)} px de cerca · ${m.etiquetas} nombres, ${m.encimadas} encimados · lo más lejos = oficina completa ${m.cabe ? 'sí' : 'NO'}${err.length ? ' · ERRORES ' + err.join('|') : ''}`);
    await c.close();
  }
  // Dibujar con el procesador 4 veces más lento
  const c = await b.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  await c.addInitScript(() => { localStorage.setItem('centro.moon.sesion', 'T'.repeat(43)); }); await c.addInitScript(PRELUDIO);
  const p = await c.newPage(); await p.goto(URL); await p.waitForSelector('#mundo svg');
  const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ms = await p.evaluate(() => { const t = performance.now(); for (let i = 0; i < 5; i++) dibujarMundo(); return (performance.now() - t) / 5; });
  await p.evaluate(() => { window.__c = []; let u = performance.now(); const f = t => { __c.push(t - u); u = t; if (__c.length < 200) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const of = await p.$eval('#oficina', e => e.getBoundingClientRect().toJSON());
  await p.mouse.move(of.x + 60, of.y + 60); await p.mouse.down(); for (let i = 0; i < 50; i++) { await p.mouse.move(of.x + 60 + i * 3, of.y + 60 + i); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(150);
  const cu = await p.evaluate(() => __c.slice(2)); const lentos = cu.filter(x => x > 50).length / cu.length;
  const okv = ms < 120 && lentos <= 0.05; if (!okv) mal++;
  filas.push(`${okv ? '✔' : '✘'} procesador 4× lento: dibujar la oficina ${ms.toFixed(0)} ms · arrastrar ${Math.round(lentos * 100)}% cuadros lentos`);
  await b.close();
  console.log(filas.join('\n')); console.log(mal ? mal + ' MAL' : 'PIEL SIN FALLAS'); process.exit(mal ? 1 : 0);
})();
