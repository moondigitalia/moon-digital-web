// Juez del teclado (26-oct-2026): en CUALQUIER pantalla con campos, al tocar cada campo y abrirse el teclado
// (la pantalla se hace de la mitad), el campo tiene que verse completo y la página no se mueve ni queda gris.
module.exports = async function teclado(p, w, h, nombre, fallas) {
  if (w >= 800) return;
  const n = await p.evaluate(() => [...document.querySelectorAll('#app input:not([type=file]):not([type=range]):not([hidden]),#app textarea,#app select')].filter(e => e.getBoundingClientRect().height > 0).length);
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => { const e = [...document.querySelectorAll('#app input:not([type=file]):not([type=range]):not([hidden]),#app textarea,#app select')].filter(e => e.getBoundingClientRect().height > 0)[i]; e.focus(); }, i);
    await p.setViewportSize({ width: w, height: Math.round(h * 0.5) });
    await p.waitForTimeout(350);
    const r = await p.evaluate(() => {
      const e = document.activeElement, b = e && e.getBoundingClientRect(), o = [];
      if (!e || !/INPUT|TEXTAREA|SELECT/.test(e.tagName)) return ['se perdió el campo al abrir el teclado'];
      if (b.top < -1 || b.bottom > innerHeight + 1) o.push(`el campo ${e.id || e.name || e.placeholder} no se ve (${Math.round(b.top)}..${Math.round(b.bottom)} de ${innerHeight})`);
      if (b.height < 20) o.push('el campo quedó aplastado');
      if (document.documentElement.scrollHeight > innerHeight + 1 || scrollY) o.push('la página se mueve con el teclado');
      const ap = document.getElementById('app'); if (ap && ap.getBoundingClientRect().height < 100) o.push('pantalla gris (el tablero se encogió a nada)');
      return o;
    });
    if (r.length) fallas.push(`teclado ${w}x${h} ${nombre}: ${r.join(' | ')}`);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(250);
  }
};
