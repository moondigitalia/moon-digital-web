// JUEZ DE LA OFICINA — mide las 6 reglas en todas las pantallas (sin importar el aparato: solo medidas).
const { chromium } = require('playwright');
const PANTALLAS0 = [[320, 480], [320, 568], [360, 640], [375, 667], [390, 844], [414, 896], [568, 320], [667, 375], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];
const PANTALLAS = process.env.SOLO ? PANTALLAS0.filter(x => process.env.SOLO.split(',').includes(x.join('x'))) : PANTALLAS0;
const URL = 'http://localhost:8811/oficina';
let mal = 0, bien = 0; const fallas = [];
const ver = (c, n) => { if (c) bien++; else { mal++; fallas.push(n); } };

// Regla 2: textos dentro de su contenedor y sin encimarse.
const revisaTextos = () => {
  const out = [];
  const r = el => el.getBoundingClientRect();
  const ch = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  // Mapa: cada texto dentro de su cuarto; ninguno encima de otro.
  document.querySelectorAll('#mapa:not([hidden]) .cuarto').forEach(c => {
    const rc = r(c), ts = [...c.querySelectorAll('h3, .mono, .claude, p')].map(e => [e, r(e)]);
    ts.forEach(([e, b]) => { if (b.left < rc.left - 0.5 || b.right > rc.right + 0.5 || b.top < rc.top - 0.5 || b.bottom > rc.bottom + 0.5) out.push('se sale de su cuarto: ' + e.textContent.slice(0, 30)); });
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) if (!ts[i][0].contains(ts[j][0]) && !ts[j][0].contains(ts[i][0]) && ch(ts[i][1], ts[j][1])) out.push('se enciman: ' + ts[i][0].textContent.slice(0, 20) + ' / ' + ts[j][0].textContent.slice(0, 20));
  });
  // Panel y pantalla completa: nada se sale a lo ancho, letra de 14 o más.
  document.querySelectorAll('#info, #herramienta:not([hidden])').forEach(p => {
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
const posiciones = () => [...document.querySelectorAll('.cab, #escribe, #texto, .cara, #oficina, #info, #hud')].filter(e => !e.closest('[hidden]')).map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 10), Math.round(b.top * 10), Math.round(b.width * 10), Math.round(b.height * 10)].join(','); }).join('|');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  for (const movimiento of ['no-preference', 'reduce']) for (const [w, h] of (movimiento === 'reduce' ? [[360, 640], [1280, 800]] : PANTALLAS)) {
    const tactil = Math.min(w, h) < 700;
    const n = `${w}x${h}${movimiento === 'reduce' ? ' (reducir movimiento)' : ''}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: tactil, isMobile: tactil, reducedMotion: movimiento });
    await ctx.route(/moondigitalia\.com\/ver\/|example\.com/, r => r.fulfill({ contentType: 'text/html', body: '<p>documento</p>' }));
    const p = await ctx.newPage(); const errores = []; p.on('pageerror', e => errores.push(e.message));
    try {
    await p.goto(URL);
    await p.click('#personajes button[data-id=kid]'); await p.fill('#pass', 'bien'); await p.click('#clave button');
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
    for (const c of ['recepcion', 'clientes', 'robots', 'cubiculos', 'gris', 'cerrado']) {
      const rc = await p.$eval(`.cuarto[data-c=${c}]`, e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width * 0.85, y: b.top + b.height * 0.85 }; });
      if (tactil) await p.touchscreen.tap(rc.x, rc.y); else await p.mouse.click(rc.x, rc.y);
      await p.waitForTimeout(60);
      const ok = await p.evaluate(() => !document.getElementById('mapa').hidden && document.getElementById('infoT').textContent !== 'Cómo va MOON');
      ver(ok, n + ': tocar ' + c + ' muestra su información');
      t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos de ' + c + ' → ' + t.slice(0, 3).join(' · '));
    }
    // Regla 4: el CRM usa la pantalla completa; las alertas no salen ahí; regresar vuelve al mapa
    await p.evaluate(() => ajustarVista());
    const crm = await p.$eval('.cuarto[data-c=crm]', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.8 }; });
    if (tactil) await p.touchscreen.tap(crm.x, crm.y); else await p.mouse.click(crm.x, crm.y);
    await p.waitForTimeout(250);
    ver(await p.evaluate(() => document.getElementById('mapa').hidden && !document.getElementById('herramienta').hidden), n + ': CRM en pantalla completa');
    ver(await p.evaluate(() => !document.querySelector('#herramienta .alerta')), n + ': sin alertas fuera del mapa');
    t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos del CRM → ' + t.slice(0, 3).join(' · '));
    // Regla 1: el teclado no mueve nada (se abre: la ventana visible se achica; se cierra: vuelve)
    await p.focus('#texto'); const antes = await p.evaluate(posiciones);
    await p.setViewportSize({ width: w, height: Math.round(h * 0.55) }); await p.waitForTimeout(80);
    const con = await p.evaluate(posiciones);
    await p.keyboard.type('Max'); await p.waitForTimeout(50);
    await p.setViewportSize({ width: w, height: h }); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(80);
    await p.fill('#texto', ''); await p.dispatchEvent('#texto', 'input');
    const despues = await p.evaluate(posiciones);
    ver(antes === con && antes === despues, n + ': el teclado no mueve nada (0 píxeles)');
    // Buscar en el mismo cuadro
    await p.fill('#texto', 'maximiliano'); await p.dispatchEvent('#texto', 'input');
    ver(await p.$$eval('.cara', x => x.length) === 1, n + ': buscar encuentra a la persona');
    t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos de búsqueda con nombre largo → ' + t.slice(0, 3).join(' · '));
    await p.fill('#texto', ''); await p.dispatchEvent('#texto', 'input');
    // Ficha y documentos de un toque (Regla 5)
    await p.click('.cara[data-tel="5512345678"]', { timeout: 5000 }); await p.waitForTimeout(150);
    t = await p.evaluate(revisaTextos); ver(!t.length, n + ': textos de la ficha → ' + t.slice(0, 3).join(' · '));
    for (const doc of ['d1', 'd2']) {
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), p.click(`[data-doc=${doc}]`, { timeout: 5000 })]);
      if (pop) await pop.waitForURL(/ver\/abc|example\.com/, { timeout: 3000 }).catch(() => {});
      ver(pop && /moondigitalia\.com\/ver\/abc|example\.com\/contrato/.test(pop.url()), n + ': un toque abre el documento ' + doc + (pop ? ' (' + pop.url() + ')' : ''));
      if (pop) await pop.close();
    }
    // Regresar: ficha → CRM → mapa
    await p.click('#volver'); await p.waitForTimeout(150);
    ver(await p.evaluate(() => !document.getElementById('herramienta').hidden && document.getElementById('herrT').textContent === 'CRM'), n + ': regresar de la ficha al CRM');
    await p.click('#volver'); await p.waitForTimeout(250);
    ver(await p.evaluate(() => !document.getElementById('mapa').hidden), n + ': regresar al mapa');
    // Librería: la respuesta nueva queda arriba, pegada al cuadro
    await p.evaluate(() => abrirHerramienta('libreria')); await p.waitForTimeout(200);
    await p.fill('#texto', '¿Qué hace Jason?'); await p.press('#texto', 'Enter'); await p.waitForTimeout(200);
    const resp = await p.evaluate(() => { const m = document.querySelectorAll('#herrC .msj')[1]; const e = document.getElementById('escribe').getBoundingClientRect(); return m && m.textContent.includes('Respuesta de prueba') && m.getBoundingClientRect().top - e.bottom < 120; });
    ver(resp, n + ': la Librería contesta justo debajo del cuadro');
    // Regla 6: cada vista entra con fundido (nada de golpe) y sin fondo blanco
    ver(await p.evaluate(() => getComputedStyle(document.getElementById('herramienta')).transitionDuration !== '0s' && getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'), n + ': entra con fundido, sin blanco');
    ver(!errores.length, n + ': sin errores ' + errores.join(' | '));
    } catch (e) { await p.screenshot({ path: __dirname + '/fallo-' + w + 'x' + h + '.png' }).catch(() => {}); console.log(await p.evaluate(() => [location.href, document.getElementById('herramienta').hidden, document.getElementById('mapa').hidden, document.getElementById('escribe').hidden, history.length]).catch(e => e.message)); ver(false, n + ': se trabó → ' + e.message.split('\n')[0] + ' @ ' + (e.stack.match(/juez\.js:(\d+)/) || [])[1]); }
    await ctx.close();
  }
  // Fluidez con procesador 4 veces más lento: arrastrar el mapa, máximo 5% de cuadros lentos
  for (const [w, h] of [[360, 640], [1280, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 700, isMobile: w < 700 });
    const p = await ctx.newPage(); await p.goto(URL);
    await p.click('#personajes button[data-id=kid]'); await p.fill('#pass', 'bien'); await p.click('#clave button'); await p.waitForSelector('#mapa:not([hidden]) .cuarto');
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
