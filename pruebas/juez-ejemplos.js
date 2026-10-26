// Juez de ejemplos: en cada campo, el ejemplo de adentro ("Ejemplo: …") cabe completo, sin cortarse, en el celular más angosto.
// Nada de abreviaturas ("Ej.", "Opc."): a prueba de tontos se escribe completo. Uso: node pruebas/juez-ejemplos.js <archivo.html> [...]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const fallas = [];
  for (const f of process.argv.slice(2)) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/(["'>])(Ej\.|Opc\.|Aprox\.|Núm\.)\s/g)) fallas.push(`${f}: abreviatura "${m[2]}"`);
    const p = await b.newPage({ viewport: { width: 320, height: 640 } });
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.setContent(html, { waitUntil: 'load' }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('[hidden]').forEach(e => e.hidden = false); dispatchEvent(new Event('resize')); });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const o = [], cv = document.createElement('canvas').getContext('2d');
      document.querySelectorAll('input[placeholder]').forEach(e => {
        const cs = getComputedStyle(e); if (!e.offsetWidth) return;
        cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const libre = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const w = cv.measureText(e.placeholder).width; if (w > libre + 1) o.push(`"${e.placeholder}" no cabe (${Math.round(w)} > ${Math.round(libre)})`);
      }); return o;
    });
    r.forEach(x => fallas.push(`${path.basename(path.dirname(f))}: ${x}`)); await p.close();
  }
  await b.close(); console.log(fallas.length ? fallas.join('\n') : 'SIN FALLAS');
})();
