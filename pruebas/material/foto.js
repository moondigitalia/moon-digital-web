// Fotos rápidas para revisar a ojo. Uso: node pruebas/material/foto.js <ruta> <salida-prefijo> [?idioma=xx]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const [ruta, salida, q] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [n, w, h, m] of [['cel', 390, 844, 1], ['chico', 320, 568, 1], ['acostado', 844, 390, 1], ['compu', 1366, 768, 0]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', c => { if (c.type() === 'error') errs.push(c.text()); });
    await p.goto('http://localhost:8781' + ruta + (q || '')); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${salida}-${n}.png` });
    console.log(n, errs.join(' | ') || 'sin errores');
    await p.close();
  }
  await b.close();
})();
