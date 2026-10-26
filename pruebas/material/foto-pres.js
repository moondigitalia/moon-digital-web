// Foto de cada lámina de la presentación. Uso: node pruebas/material/foto-pres.js <codigo|-> <prefijo> <ancho> <alto> [idioma]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const [cod, salida, w, h, idioma] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', c => { if (c.type() === 'error') errs.push(c.text()); });
  await p.goto('http://localhost:8781/presentacion' + (cod === '-' ? '' : '/' + cod) + (idioma ? '?idioma=' + idioma : '')); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelectorAll('.slot').length);
  const es = await p.evaluate(() => [].map.call(document.querySelectorAll('.lamina'), l => getComputedStyle(l).getPropertyValue('--e')).join(' '));
  for (let i = 0; i < n; i++) { await p.evaluate(i => { const r = document.getElementById('rollo'); r.scrollTop = i * r.clientHeight; }, i); await p.waitForTimeout(150); await p.screenshot({ path: `${salida}-${i + 1}.png` }); }
  console.log(n, 'láminas · letra', es, '·', errs.join(' | ') || 'sin errores');
  await b.close();
})();
