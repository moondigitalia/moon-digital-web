// Juez de tamaños de MOON Digital.
// Abre una página y la revisa en TODOS los anchos (320 a 2560) y altos (480 a 1440),
// como cuando Kid hace la ventana más chica o más grande. Si algo no cabe, lo dice.
// Uso:  node juez-tamanos.js <url> [carpeta-capturas]
const { chromium } = require('playwright');
const url = process.argv[2]; const dir = process.argv[3] || '.';
if (!url) { console.log('Uso: node juez-tamanos.js <url> [carpeta]'); process.exit(1); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const fallas = new Map();
  for (let w = 320; w <= 2560; w += 20) for (const h of [480, 560, 640, 720, 800, 900, 1080, 1440]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(25);
    const r = await p.evaluate(() => {
      const out = [];
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (!(r.width > 0 && r.height > 0 && cs.visibility !== 'hidden') || e.closest('[hidden],[aria-hidden=true]')) return false; for (let q = e; q; q = q.parentElement) if (parseFloat(getComputedStyle(q).opacity) < 0.05) return false; return true; };
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('la página se sale de lado');
      const textos = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,li,button,a,label,span,b,strong,small,em,dd,dt,input,.msg')].filter((e) => vis(e) && (e.value || e.textContent).trim());
      const hojas = [];
      for (const e of textos) {
        const t = (e.value || e.textContent).trim().replace(/\s+/g, ' '), cs = getComputedStyle(e), r = e.getBoundingClientRect();
        const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs * 1.3;
        let lines = 1; if (e.tagName !== 'INPUT') { const tops = new Set(); const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; let abs = false; for (let q = n.parentElement; q && q !== e.parentElement; q = q.parentElement) if (/absolute|fixed/.test(getComputedStyle(q).position) && q !== e) abs = true; if (abs || n.parentElement.closest('svg')) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 1) tops.add(Math.round(q.top / (lh * 0.6))); } lines = Math.max(1, tops.size); }
        const words = t.split(' ').length;
        if (fs < 13) out.push('letra chica (' + fs + 'px) "' + t.slice(0, 24) + '"');
        if (/^(H\d|P|LI)$/.test(e.tagName) && lines >= 3 && words / lines < 2.6 && r.width < Math.min(innerWidth * 0.6, 340)) out.push('columna apretada "' + t.slice(0, 24) + '"');
        if ((e.tagName === 'BUTTON' || e.tagName === 'A') && t.length <= 40 && lines >= 3) out.push('botón partido en ' + lines + ' renglones "' + t.slice(0, 24) + '"');
        if (e.tagName !== 'INPUT' && e.scrollWidth > e.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') out.push('texto cortado "' + t.slice(0, 24) + '"');
        // ¿se sale de su caja con recorte?
        let a = e.parentElement;
        while (a && a !== document.body) { const ac = getComputedStyle(a); if (ac.overflow !== 'visible' || ac.overflowX !== 'visible' || ac.overflowY !== 'visible') break; a = a.parentElement; }
        if (a && a !== document.body) { const ar = a.getBoundingClientRect(); const scroll = /(auto|scroll)/.test(getComputedStyle(a).overflowY);
          if (r.right > ar.right + 1 || r.left < ar.left - 1 || (!scroll && (r.bottom > ar.bottom + 1 || r.top < ar.top - 1))) out.push('se sale o queda cortado "' + t.slice(0, 24) + '"'); }
        let vr = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) { const qc = getComputedStyle(q); if (qc.overflow !== 'visible') { const qr = q.getBoundingClientRect(); vr = { left: Math.max(vr.left, qr.left), right: Math.min(vr.right, qr.right), top: Math.max(vr.top, qr.top), bottom: Math.min(vr.bottom, qr.bottom) }; } }
        let vistos = 0; // ¿se ve aunque sea un pedazo? Si está totalmente debajo de otra capa (pantalla de inicio, ventana encima), no cuenta
        for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.5, 0.8]) { const px = vr.left + (vr.right - vr.left) * fx, py = vr.top + (vr.bottom - vr.top) * fy; if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue; const h = document.elementFromPoint(px, py); if (h && (e.contains(h) || h.contains(e))) vistos++; }
        const tapado = vistos === 0;
        if (!tapado && vr.right - vr.left > 2 && vr.bottom - vr.top > 2 && !e.querySelector('h1,h2,h3,h4,h5,p,li,button,a,span,b,strong,small,em')) hojas.push([e, vr, t]);
      }
      for (let i = 0; i < hojas.length; i++) for (let j = i + 1; j < hojas.length; j++) {
        const [x, a, ta] = hojas[i], [y, c, tc] = hojas[j];
        if (x.contains(y) || y.contains(x)) continue;
        if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) out.push('encimado "' + ta.slice(0, 18) + '" con "' + tc.slice(0, 18) + '"');
      }
      return [...new Set(out)];
    });
    for (const f of r) { if (!fallas.has(f)) fallas.set(f, []); fallas.get(f).push(w + 'x' + h); }
  }
  for (const [w, h] of [[390, 844], [945, 900], [1280, 600], [1920, 1080]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150); await p.screenshot({ path: dir + '/juez-' + w + 'x' + h + '.png' }); }
  await b.close();
  if (!fallas.size) { console.log('SIN PROBLEMAS en ' + ((2560 - 320) / 20 + 1) * 8 + ' tamaños'); return; }
  console.log('FALLAS (' + fallas.size + '):');
  for (const [f, s] of fallas) console.log('- ' + f + '  → en ' + s.length + ' tamaños, ej. ' + s.slice(0, 4).join(', '));
  process.exitCode = 1;
})();
