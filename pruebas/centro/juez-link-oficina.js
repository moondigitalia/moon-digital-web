const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  let mal = 0;
  for (const [w, h] of [[360, 640], [1280, 800]]) for (const capa of ['crm', 'demo', 'llamadas']) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
    await c.addInitScript(() => { try { localStorage.setItem('centro.moon.recorrido', 'todos'); localStorage.setItem('centro.moon.sesion', 'x'.repeat(50)); } catch (e) {} });
    await c.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const p = await c.newPage();
    await p.goto(`http://localhost:8765/?abrir=${capa}&volver=/oficina`); await p.waitForTimeout(1200);
    const t = await p.evaluate(() => (document.querySelector('.top h2') || {}).textContent || document.body.innerText.slice(0, 40));
    await p.click('#volver'); await p.waitForTimeout(800);
    const ok = /\/oficina$/.test(p.url());
    console.log(`${w}x${h} ${capa}: abre "${t}" · regresar → ${p.url()} ${ok ? '✔' : '✘'}`); if (!ok) mal++;
    // sin los datos del link, el Tablero se comporta igual que siempre (inicio)
    await c.close();
  }
  const c = await b.newContext({ viewport: { width: 360, height: 640 } }); await c.addInitScript(() => { localStorage.setItem('centro.moon.recorrido', 'todos'); localStorage.setItem('centro.moon.sesion', 'x'.repeat(50)); });
  const p = await c.newPage(); await p.goto('http://localhost:8765/'); await p.waitForTimeout(1200);
  const inicio = await p.evaluate(() => !document.getElementById('volver')); console.log('sin link: inicio normal del Tablero ' + (inicio ? '✔' : '✘')); if (!inicio) mal++;
  await b.close(); process.exit(mal ? 1 : 0);
})();
