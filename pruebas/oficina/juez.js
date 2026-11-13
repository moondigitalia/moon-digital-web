// JUEZ DE LA OFICINA — mide las 6 reglas en todas las pantallas (sin importar el aparato: solo medidas).
const { chromium } = require('playwright');
// La Oficina es la pantalla de inicio del Tablero y vive en su propia caja (sombra): se mide adentro de ella.
const PRELUDIO = () => { window.ofiR = () => document.getElementById('ofi').shadowRoot; Object.defineProperty(window, 'vista', { get: () => window.__ofi.vista, configurable: true }); Object.defineProperty(window, 'MUNDO', { get: () => window.__ofi.MUNDO, configurable: true }); for (const f of ['zoomEn', 'dibujarMundo', 'ajustarVista', 'abrirHerramienta']) window[f] = (...a) => window.__ofi[f](...a); try { localStorage.setItem('centro.moon.recorrido', 'todos'); } catch (e) {} };

const PANTALLAS0 = [[320, 480], [320, 568], [360, 640], [375, 667], [390, 844], [414, 896], [568, 320], [667, 375], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];
const PANTALLAS = process.env.SOLO ? PANTALLAS0.filter(x => process.env.SOLO.split(',').includes(x.join('x'))) : PANTALLAS0;
const URL = 'http://localhost:8811/tablero';
let mal = 0, bien = 0; const fallas = [];
const ver = (c, n) => { if (c) bien++; else { mal++; fallas.push(n); } };

// Regla 2: textos dentro de su contenedor y sin encimarse.
const revisaTextos = () => {
  const out = [];
  const r = el => el.getBoundingClientRect();
  const ch = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  // Mapa: cada texto dentro de su cuarto; ninguno encima de otro.
  ofiR().querySelectorAll('#mapa:not([hidden]) .cuarto').forEach(c => {
    const rc = r(c), ts = [...c.querySelectorAll('h3, .mono, .claude, p')].map(e => [e, r(e)]);
    ts.forEach(([e, b]) => { if (b.left < rc.left - 0.5 || b.right > rc.right + 0.5 || b.top < rc.top - 0.5 || b.bottom > rc.bottom + 0.5) out.push('se sale de su cuarto: ' + e.textContent.slice(0, 30)); });
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) if (!ts[i][0].contains(ts[j][0]) && !ts[j][0].contains(ts[i][0]) && ch(ts[i][1], ts[j][1])) out.push('se enciman: ' + ts[i][0].textContent.slice(0, 20) + ' / ' + ts[j][0].textContent.slice(0, 20));
  });
  // Panel y pantalla completa: nada se sale a lo ancho, letra de 14 o más.
  ofiR().querySelectorAll('#info, #herramienta:not([hidden])').forEach(p => {
    if (p.closest('[hidden]')) return;
    const rp = r(p);
    p.querySelectorAll('*').forEach(e => {
      if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const b = r(e); if (!b.width) return;
      if (b.right > rp.right + 1 || b.left < rp.left - 1) out.push('se sale a lo ancho: ' + e.textContent.slice(0, 30));
      if (parseFloat(getComputedStyle(e).fontSize) < 14) out.push('letra chica: ' + e.textContent.slice(0, 20));
    });
  });
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('la página se desliza a lo ancho');
  return out;
};
const posiciones = () => [...ofiR().querySelectorAll('.cab, #escribe, #texto, .cara, #oficina, #info, #hud')].filter(e => !e.closest('[hidden]')).map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 10), Math.round(b.top * 10), Math.round(b.width * 10), Math.round(b.height * 10)].join(','); }).join('|');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  for (const movimiento of ['no-preference', 'reduce']) for (const [w, h] of (movimiento === 'reduce' ? [[360, 640], [1280, 800]] : PANTALLAS)) {
    const tactil = Math.min(w, h) < 700;
    const n = `${w}x${h}${movimiento === 'reduce' ? ' (reducir movimiento)' : ''}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: tactil, isMobile: tactil, reducedMotion: movimiento });
    await ctx.route(/moondigitalia\.com\/ver\/|example\.com/, r => r.fulfill({ contentType: 'text/html', body: '<p>documento</p>' }));
    const p = await ctx.newPage(); const errores = []; p.on('pageerror', e => errores.push(e.message));
    try {
    await ctx.addInitScript(() => { localStorage.setItem('centro.moon.sesion', 'x'.repeat(43)); }); await ctx.addInitScript(PRELUDIO);
    await p.goto(URL);
    await p.waitForSelector('#mapa:not([hidden]) .cuarto'); await p.waitForTimeout(250);
    // Regla 2 en el mapa (vista completa) y en el resumen
    let t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos al entrar → ' + t.slice(0, 3).join(' · '));
    // Regla 3: se acerca y, al soltar, queda nítido (sin el dibujo estirado)
    const of = await p.$eval('#oficina', e => e.getBoundingClientRect().toJSON());
    if (tactil) {
      const cdp = await ctx.newCDPSession(p), cx = of.x + of.width / 2, cy = of.y + of.height / 2, tp = d => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(20) });
      for (let d = 25; d <= 120; d += 5) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(d) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await p.mouse.move(of.x + of.width / 2, of.y + of.height / 2); await p.mouse.wheel(0, -500); }
    await p.waitForTimeout(300);
    const z = await p.$eval('#mundo', e => [parseFloat(e.style.transform.split('scale(')[1]), e.classList.contains('mueve')]);
    ver(!z[1], n + ': nítido al soltar el zoom');
    t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos con zoom → ' + t.slice(0, 3).join(' · '));
    // Tocar cuartos de mirar: la información cambia, el mapa sigue a la vista
    await p.evaluate(() => { ajustarVista(); });
    for (const c of ['recepcion', 'clientes', 'demos', 'robots', 'cubiculos', 'gris', 'cerrado']) {
      const rc = await p.evaluate(c => { const e = ofiR().querySelector(`.cuarto[data-c=${c}]`), pol = e.querySelector('polygon'); const b = (pol || e).getBoundingClientRect(); return pol ? { x: b.left + b.width * 0.5, y: b.top + b.height * 0.62 } : { x: b.left + b.width * 0.85, y: b.top + b.height * 0.85 }; }, c);
      if (tactil) await p.touchscreen.tap(rc.x, rc.y); else await p.mouse.click(rc.x, rc.y);
      await p.waitForTimeout(60);
      const ok = await p.evaluate(() => !ofiR().getElementById('mapa').hidden && ofiR().getElementById('infoT').textContent !== 'Cómo va MOON');
      ver(ok, n + ': tocar ' + c + ' muestra su información');
      t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos de ' + c + ' → ' + t.slice(0, 3).join(' · '));
    }
    // Regla 4: el CRM es el del Tablero (con su orden, fotos y botón de editar): se abre encima del mapa, en la misma
    // página, y al cerrarlo se vuelve al mapa.
    await p.evaluate(() => ajustarVista());
    for (const [cuarto, capa] of [['crm', 'crm'], ['crea', 'demo']]) {
      const rc = await p.evaluate(c => { const e = ofiR().querySelector(`.cuarto[data-c=${c}]`), pol = e.querySelector('polygon'); const b = (pol || e).getBoundingClientRect(); return pol ? { x: b.left + b.width * 0.5, y: b.top + b.height * 0.62 } : { x: b.left + b.width / 2, y: b.top + b.height * 0.8 }; }, cuarto);
      if (tactil) await p.touchscreen.tap(rc.x, rc.y); else await p.mouse.click(rc.x, rc.y);
      await p.waitForSelector('#app .top h2', { timeout: 3000 }).catch(() => {});
      const abierto = await p.evaluate(() => ({ t: (document.querySelector('#app .top h2') || {}).textContent || '', mapa: !document.getElementById('ofi').hidden, url: location.pathname }));
      ver(abierto.t === (capa === 'crm' ? 'CRM de MOON' : 'Crea tu recepcionista') && !abierto.mapa && abierto.url === '/tablero', n + ': ' + cuarto + ' abre la pantalla del Tablero en la misma página (' + JSON.stringify(abierto) + ')');
      await p.click('#app #volver'); await p.waitForSelector('#mapa:not([hidden]) .cuarto'); await p.waitForTimeout(200); await p.evaluate(() => ajustarVista());
      ver(await p.evaluate(() => !document.getElementById('ofi').hidden && !document.querySelector('#app .top')), n + ': al cerrar ' + cuarto + ' vuelve al mapa');
    }
    // Librería en pantalla completa; las alertas no salen ahí
    await p.evaluate(() => abrirHerramienta('libreria')); await p.waitForTimeout(250);
    ver(await p.evaluate(() => ofiR().getElementById('mapa').hidden && !ofiR().getElementById('herramienta').hidden), n + ': Librería en pantalla completa');
    ver(await p.evaluate(() => !ofiR().querySelector('#herramienta .alerta')), n + ': sin alertas fuera del mapa');
    // Regla 1: el teclado no mueve nada (se abre: la ventana visible se achica; se cierra: vuelve)
    await p.focus('#texto'); const antes = await p.evaluate(posiciones);
    await p.setViewportSize({ width: w, height: Math.round(h * 0.55) }); await p.waitForTimeout(80);
    const con = await p.evaluate(posiciones);
    await p.setViewportSize({ width: w, height: h }); await p.evaluate(() => (ofiR().activeElement || document.activeElement).blur()); await p.waitForTimeout(80);
    const despues = await p.evaluate(posiciones);
    ver(antes === con && antes === despues, n + ': el teclado no mueve nada (0 píxeles)');
    // La respuesta nueva queda arriba, pegada al cuadro
    await p.fill('#texto', '¿Qué hace Jason?'); await p.press('#texto', 'Enter'); await p.waitForTimeout(200);
    const resp = await p.evaluate(() => { const m = ofiR().querySelectorAll('#herrC .msj')[1]; const e = ofiR().getElementById('escribe').getBoundingClientRect(); return m && m.textContent.includes('Respuesta de prueba') && m.getBoundingClientRect().top - e.bottom < 120; });
    ver(resp, n + ': la Librería contesta justo debajo del cuadro');
    t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos de la Librería → ' + t.slice(0, 3).join(' · '));
    await p.click('#herramienta #volver'); await p.waitForTimeout(250);
    ver(await p.evaluate(() => !ofiR().getElementById('mapa').hidden && ofiR().getElementById('herramienta').hidden), n + ': regresar al mapa');
    // Regla 6: cada vista entra con fundido (nada de golpe) y sin fondo blanco
    ver(await p.evaluate(() => getComputedStyle(ofiR().getElementById('herramienta')).transitionDuration !== '0s' && getComputedStyle(ofiR().getElementById('herramienta')).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'), n + ': cambia con fundido sobre fondo lleno (sin parpadeo ni blanco)');
    ver(!errores.length, n + ': sin errores ' + errores.join(' | '));
    } catch (e) { await p.screenshot({ path: __dirname + '/fallo-' + w + 'x' + h + '.png' }).catch(() => {}); console.log(await p.evaluate(() => [location.href, ofiR().getElementById('herramienta').hidden, ofiR().getElementById('mapa').hidden, ofiR().getElementById('escribe').hidden, history.length]).catch(e => e.message)); ver(false, n + ': se trabó → ' + e.message.split('\n')[0] + ' @ ' + (e.stack.match(/juez\.js:(\d+)/) || [])[1]); }
    await ctx.close();
  }
  // Fluidez con procesador 4 veces más lento: arrastrar el mapa, máximo 5% de cuadros lentos
  for (const [w, h] of [[360, 640], [1280, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 700, isMobile: w < 700 });
    await ctx.addInitScript(() => { localStorage.setItem('centro.moon.sesion', 'x'.repeat(43)); }); await ctx.addInitScript(PRELUDIO);
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForSelector('#mapa:not([hidden]) .cuarto');
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.evaluate(() => { window.__c = []; let u = performance.now(); const f = t => { __c.push(t - u); u = t; if (__c.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const of = await p.$eval('#oficina', e => e.getBoundingClientRect().toJSON());
    await p.mouse.move(of.x + 50, of.y + 50); await p.mouse.down();
    for (let i = 0; i < 60; i++) { await p.mouse.move(of.x + 50 + i * 3, of.y + 50 + i); await p.waitForTimeout(16); }
    await p.mouse.up(); await p.waitForTimeout(200);
    const c = await p.evaluate(() => __c.slice(2)); const lentos = c.filter(x => x > 50).length / c.length;
    ver(lentos <= 0.05, `${w}x${h}: fluidez con procesador 4× lento (${Math.round(lentos * 100)}% cuadros lentos)`);
    await ctx.close();
  }
  await b.close();
  console.log(`JUEZ DE LA OFICINA: ${bien} de ${bien + mal} medidas bien en ${PANTALLAS.length} pantallas + reducir movimiento + procesador lento`);
  if (mal) console.log(fallas.slice(0, 40).join('\n'));
  process.exit(mal ? 1 : 0);
})();
