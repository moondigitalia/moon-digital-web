// Juez del recorrido de la primera vez (27-oct-2026): sale solo la primera vez, cada globo se ve completo dentro de la pantalla,
// el recuadro marca la sección correcta, un toque avanza, y al terminar no vuelve a salir (pero se puede volver a ver desde la cuenta).
const { chromium } = require('playwright');
const corridas = process.env.RAPIDO === '1' ? [[320, 568, 1], [1280, 800, 1]] : [[320, 568, 1], [375, 667, 1], [390, 844, 1.3], [768, 1024, 1], [1280, 800, 1]];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const fallas = [];
  for (const quien of ['socio', 'embajador']) for (const [w, h, z] of corridas) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
    await c.addInitScript(z => { try { localStorage.setItem('centro.moon.letra', String(z)); } catch (e) {} }, z);
    await c.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const n0 = `${quien} ${w}x${h} z${z}`;
    await p.goto('http://localhost:8765/');
    if (quien === 'socio') { await p.click('[data-u="kid"]'); await p.fill('#clave', '123456'); await p.click('form .boton'); }
    else { await p.click('#soyEmb'); await p.fill('#tel', '9981234567'); await p.fill('#clave', '123456'); await p.click('form .boton'); }
    const hay = await p.waitForSelector('#tour', { timeout: 4000 }).then(() => true).catch(() => false);
    if (!hay) { fallas.push(`${n0}: la primera vez no salió el recorrido`); await c.close(); continue; }
    for (let k = 0; k < 12; k++) {
      const r = await p.evaluate(() => {
        const o = [], g = document.querySelector('.tour-globo'), a = document.querySelector('.tour-aro'), W = innerWidth, H = innerHeight;
        const gb = g.getBoundingClientRect(), ab = a.getBoundingClientRect();
        if (gb.left < 0 || gb.top < 0 || gb.right > W + 1 || gb.bottom > H + 1) o.push('el globo se sale de la pantalla');
        if (g.scrollHeight > g.clientHeight + 1) o.push('texto cortado en el globo');
        g.querySelectorAll('.boton').forEach(x => { if (x.scrollHeight > x.clientHeight + 2 || x.scrollWidth > x.clientWidth + 2) o.push('botón con texto que no cabe: ' + x.textContent); });
        if (ab.width < 20 || ab.height < 20) o.push('el recuadro no marca nada');
        const cx = ab.left + ab.width / 2, cy = ab.top + ab.height / 2;
        const tapa = gb.left < cx && cx < gb.right && gb.top < cy && cy < gb.bottom;
        return { o, tapa, paso: document.getElementById('tourPaso').textContent, sig: document.getElementById('tourSig').textContent };
      });
      if (r.o.length) fallas.push(`${n0} paso ${r.paso}: ${r.o.join(' | ')}`);
      if (r.tapa) fallas.push(`${n0} paso ${r.paso}: el globo tapa la sección que explica`);
      if (w === 375) await p.screenshot({ path: `tour-${quien}-${k}.png` });
      const antes = r.paso; await p.click('#tourSig'); await p.waitForTimeout(150);
      if (r.sig === 'Listo') break;
      const despues = await p.textContent('#tourPaso').catch(() => '');
      if (despues === antes) fallas.push(`${n0}: un toque en Siguiente no avanzó`);
    }
    if (await p.$('#tour')) fallas.push(`${n0}: el recorrido no se cerró al terminar`);
    await p.reload(); await p.waitForSelector('.mosaico'); await p.waitForTimeout(900);
    if (await p.$('#tour')) fallas.push(`${n0}: el recorrido vuelve a salir aunque ya se vio`);
    await p.click('#salir'); await p.waitForTimeout(500); await p.click('#verTour'); await p.waitForTimeout(1200);
    if (!await p.$('#tour')) fallas.push(`${n0}: "Ver el recorrido otra vez" no lo abre`);
    else { await p.click('#tourSalir'); await p.waitForTimeout(200); if (await p.$('#tour')) fallas.push(`${n0}: "Ya entendí" no lo cierra`); }
    if (errs.length) fallas.push(`${n0} errores: ${errs.join(' | ')}`);
    await c.close();
  }
  console.log(fallas.length ? fallas.join('\n') : 'SIN FALLAS'); await b.close();
})();
