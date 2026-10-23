// JUEZ DE DOCUMENTOS — abre CADA documento del Centro como lo ve la gente (celular y computadora) y revisa
// que de verdad se vea: la hoja/lámina dentro de la pantalla, con contenido (no un recuadro gris o en blanco),
// y que nada obligue a deslizar a los lados. Uso: node juez-docs.js <carpeta con .html/.md> [llave base64 para api/_docs]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const { preparar, leerCifrado, mdAHoja } = require('../../api/_visor');
const [carpeta, llave] = process.argv.slice(2); if (llave) process.env.CENTRO_LLAVE_DOCS = llave;
const docs = [];
if (carpeta) for (const f of fs.readdirSync(carpeta)) { if (/\.html$/.test(f)) docs.push([f.replace(/\.html$/, ''), fs.readFileSync(path.join(carpeta, f), 'utf8')]); if (/\.md$/.test(f)) docs.push([f.replace(/\.md$/, ''), mdAHoja(fs.readFileSync(path.join(carpeta, f), 'utf8'), f)]); }
const dir = path.join(__dirname, '../../api/_docs');
for (const f of fs.readdirSync(dir)) if (/\.bin$/.test(f)) { const r = leerCifrado(f.replace(/\.bin$/, '')); if (r && r.formato === 'md') docs.push([f.replace(/\.bin$/, ''), mdAHoja(r.contenido, f)]); else if (r && r.formato === 'html') docs.push([f.replace(/\.bin$/, ''), r.contenido]); else if (!r) docs.push([f, null]); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const fallas = [];
  for (const [id, html] of docs) {
    if (html == null) { fallas.push(id + ': no se pudo abrir'); continue; }
    for (const suelto of [false, true]) for (const [w, h] of [[375, 667], [1280, 800]]) {
      const pr = preparar(html, { suelto });
      const c = await b.newContext({ viewport: { width: w, height: h } }); await c.route(/^https?:/, r => r.abort()); await c.route(/cdn\.jsdelivr\.net\/npm\/marked@12\.0\.2\/marked\.min\.js/,r=>r.fulfill({path:require('path').join(__dirname,'../../node_modules/marked/marked.min.js'),contentType:'text/javascript'}));
      const p = await c.newPage(); await p.setContent(pr.contenido, { waitUntil: 'load' }); await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const o = { sw: document.documentElement.scrollWidth, n: 0 };
        const u = document.querySelector('.visor-u.actual');
        o.n = document.querySelectorAll('.visor-u').length;
        if (u) { const b = u.getBoundingClientRect(); o.caja = [b.left, b.top, b.right, b.bottom].map(Math.round); }
        return o;
      });
      const nombre = `${id} ${w} ${suelto ? 'link' : 'centro'} ${pr.modo}`;
      if (r.sw > w + 1) fallas.push(`${nombre}: hay que deslizar a los lados (${r.sw})`);
      let zona = { x: 0, y: 0, width: w, height: h };
      if (pr.modo !== 'ancho') {
        if (!r.n || !r.caja) { fallas.push(`${nombre}: no encontró las láminas/hojas`); await c.close(); continue; }
        const [l, t, rr, bb] = r.caja;
        if (l < -1 || t < -1 || rr > w + 1 || bb > h + 1) fallas.push(`${nombre}: la hoja se sale de la pantalla ${r.caja}`);
        if ((rr - l) * (bb - t) < w * h * (w < 600 ? .12 : .3)) fallas.push(`${nombre}: la hoja se ve muy chica ${r.caja}`);
        zona = { x: Math.max(0, l), y: Math.max(0, t), width: Math.max(1, Math.min(w, rr) - Math.max(0, l)), height: Math.max(1, Math.min(h, bb) - Math.max(0, t)) };
      }
      // ¿Tiene contenido o es un recuadro liso? Se mide qué tanto cambian los colores dentro de la hoja.
      const png = await p.screenshot({ clip: zona });
      const { PNG } = require('pngjs'); const im = PNG.sync.read(png); let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < im.data.length; i += 16) { const v = (im.data[i] + im.data[i + 1] + im.data[i + 2]) / 3; s += v; s2 += v * v; n++; }
      const de = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
      if (de < 6) fallas.push(`${nombre}: se ve vacío/liso (variación ${de.toFixed(1)})`);
      if (w === 375 && !suelto) fs.writeFileSync(path.join(__dirname, `doc-${id}.png`), png);
      await c.close();
    }
    console.log('revisado', id);
  }
  console.log(fallas.length ? 'FALLAS:\n' + fallas.join('\n') : 'TODOS LOS DOCUMENTOS SE VEN'); await b.close();
})();
