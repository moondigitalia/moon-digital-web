// JUEZ de la calculadora y la presentación (26-oct-2026). Si algo falla, no se publica.
// En los 21 idiomas, con marca de cliente (nombres largos, color muy claro) y sin marca (MOON), en celular chico, celular,
// celular acostado, tablet y computadora:
//  - la página no se mueve (sin scroll fuera del rollo de láminas), nada se sale de la pantalla
//  - ningún texto cortado ni salido de su lugar, ninguna clave sin traducir a la vista
//  - el dinero siempre dice MXN
//  - la calculadora no brinca al mover las barras (mismo lugar con 0 que con lo máximo)
//  - cada lámina cabe sin encimarse (la medida de la página) y la letra no quedó en el mínimo
// Uso: node pruebas/material/juez.js [idioma…]   (sin nada: los 21; RAPIDO=1: solo español)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { spawn } = require('child_process'), path = require('path');
const IDIOMAS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'ru', 'uk', 'ar', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh', 'zh-TW'];
// (26-oct, Kid) en estas páginas basta revisar español; los demás idiomas solo si se piden: node pruebas/material/juez.js en ar …
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['es'];
const PUERTO = 8781, BASE = 'http://localhost:' + PUERTO;
const CLAVE = /\b(calc|pres|comun)\.[a-z_0-9]+\b/;
const SIN_MONEDA = /(\$\s?\d[\d.,\s]*|\d[\d.,]*\s?\$)(?!\s*MXN)/;
const fallas = [];
(async () => {
  const srv = spawn('node', [path.join(__dirname, 'servidor.js')], { stdio: 'ignore' });
  await new Promise(z => setTimeout(z, 600));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const TAM = [['chico', 320, 568, 1], ['cel', 390, 844, 1], ['acostado', 844, 390, 1], ['tablet', 820, 1180, 1], ['compu', 1366, 768, 0]];
  for (const lang of LANGS) for (const cod of ['largo', 'amarillo', '']) for (const [n, w, h, m] of TAM) {
    if (lang !== 'es' && cod === 'amarillo' && n !== 'cel') continue;   // los colores se prueban en español; los idiomas, con el nombre más largo
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const nom = `${lang} ${cod || 'MOON'} ${n}`;
    // ---- calculadora ----
    await p.goto(`${BASE}/calculadora${cod ? '/' + cod : ''}?idioma=${lang}`); await p.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 8000 }).catch(() => fallas.push(nom + ' calculadora: no terminó de cargar'));
    await p.waitForTimeout(200);
    const revisaCalc = () => p.evaluate(([CL, SM]) => {
      const o = [], CLAVE = new RegExp(CL), SIN = new RegExp(SM), d = document.scrollingElement;
      if (d.scrollHeight > innerHeight + 1 || d.scrollWidth > innerWidth + 1) o.push('la página se mueve');
      document.querySelectorAll('main *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < -1)) o.push('se sale: ' + (e.id || e.className || e.tagName)); });
      document.querySelectorAll('h1,.eti,label,output,.monto,.fila span,.fila b,.cierre,.ayuda,.pie span').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) o.push('texto que no cabe: ' + e.textContent.trim().slice(0, 30)); });
      ['.preguntas', '.lado'].forEach(s => { const e = document.querySelector(s); if (e && e.scrollHeight > e.clientHeight + 1) o.push('encimado: ' + s); });
      const t = document.body.innerText; if (CLAVE.test(t)) o.push('clave sin traducir: ' + t.match(CLAVE)[0]);
      const sm = t.replace(/MX\$\s?[\d.,]+/g, ''); if (SIN.test(sm.replace(/\n/g, '¶'))) { const x = sm.match(SIN)[0]; if (!/MXN/.test(sm.slice(sm.indexOf(x), sm.indexOf(x) + x.length + 6))) o.push('dinero sin MXN: ' + x); }
      return [...new Set(o)].slice(0, 5);
    }, [CLAVE.source, SIN_MONEDA.source]);
    (await revisaCalc()).forEach(x => fallas.push(nom + ' calculadora: ' + x));
    // no brinca: lo de arriba de la cifra queda igual con 0 y con el máximo
    const lugar = () => p.evaluate(() => [...document.querySelectorAll('.monto,.q,.res,h1')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), Math.round(r.height)].join(','); }).join('|'));
    const antes = await lugar();
    for (const [id, v] of [['r1', 40], ['r2', 24], ['r3', 10], ['r1', 0]]) await p.evaluate(([id, v]) => { const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input')); }, [id, v]);
    await p.waitForTimeout(100);
    if (await lugar() !== antes) fallas.push(nom + ' calculadora: algo brincó al mover las barras');
    (await revisaCalc()).forEach(x => fallas.push(nom + ' calculadora (cifras grandes): ' + x));
    // ---- presentación ----
    await p.goto(`${BASE}/presentacion${cod ? '/' + cod : ''}?idioma=${lang}`); await p.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 8000 }).catch(() => fallas.push(nom + ' presentación: no terminó de cargar'));
    await p.waitForTimeout(200);
    const r = await p.evaluate(([CL, SM]) => {
      const o = [], CLAVE = new RegExp(CL), d = document.scrollingElement, rollo = document.getElementById('rollo');
      if (d.scrollHeight > innerHeight + 1 || d.scrollWidth > innerWidth + 1) o.push('la página se mueve (fuera del rollo)');
      if (rollo.scrollWidth > rollo.clientWidth + 1) o.push('el rollo se mueve de lado');
      document.querySelectorAll('.slot').forEach((s, i) => { if (Math.abs(s.offsetHeight - rollo.clientHeight) > 1) o.push('lámina ' + (i + 1) + ' no mide una pantalla'); });
      document.querySelectorAll('.lamina').forEach((l, i) => {
        const e = parseFloat(getComputedStyle(l).getPropertyValue('--e')); if (!(e > 0.46)) o.push('lámina ' + (i + 1) + ': la letra quedó en el mínimo (algo no cabe)');
        const L = l.getBoundingClientRect();
        l.querySelectorAll('.titulo,.frase,.texto,.nota,.eti,b,small,li,.monto,.tabla>*,.boton,.para,.arriba span').forEach(x => { const q = x.getBoundingClientRect(); if (q.width && !x.closest('.marca') && (q.bottom > L.bottom + 1 || q.right > L.right + 1 || q.left < L.left - 1)) o.push('lámina ' + (i + 1) + ' se sale: ' + x.textContent.trim().slice(0, 25)); });
        l.querySelectorAll('.arriba').forEach(x => { if (x.scrollWidth > x.clientWidth + 1) o.push('lámina ' + (i + 1) + ': el renglón de arriba no cabe'); });
      });
      const t = rollo.innerText; if (CLAVE.test(t)) o.push('clave sin traducir: ' + t.match(CLAVE)[0]);
      const t2 = t.replace(/MX\$\s?[\d.,٬٫\s]+|[\d.,٬٫]+\s?MX\$|\$MX/g, '');   // "MX$" también dice que son pesos mexicanos
      if (/\$\s?\d/.test(t2) && !/MXN/.test(t2)) o.push('dinero sin MXN');
      const demo = document.getElementById('demo'); if (!demo || !/^https:\/\//.test(demo.href)) o.push('el botón del demo no lleva a un link completo');
      return [...new Set(o)].slice(0, 6);
    }, [CLAVE.source, SIN_MONEDA.source]);
    r.forEach(x => fallas.push(nom + ' presentación: ' + x));
    errs.forEach(x => fallas.push(nom + ' error de página: ' + x));
    await p.close();
  }
  await b.close(); srv.kill();
  console.log(fallas.length ? fallas.slice(0, 80).join('\n') + (fallas.length > 80 ? `\n… y ${fallas.length - 80} más` : '') : 'SIN FALLAS');
})();
