// Juez del teclado (26-oct-2026, rehecho): imita el teclado de un CELULAR REAL.
// En un celular el teclado NO hace la página más chica: la página sigue del mismo tamaño y solo se ve la parte de arriba
// (el "visualViewport"). Además, si algo le quita el foco al campo, el teclado se cierra y la pantalla cambia de golpe.
// Por cada campo revisa: que se vea completo arriba del teclado, que la pantalla no se pueda arrastrar con un dedo,
// y que si hay más preguntas abajo, el botón diga "Siguiente pregunta" (nunca guardar sin verlas).
const SEL = '#app input:not([type=file]):not([type=range]):not([type=checkbox]):not([type=radio]):not([hidden]),#app textarea,#app select';

// Teclado "de verdad": achica solo lo que se ve; si el campo pierde el foco, el teclado se cierra (como en el celular).
async function abrir(p, alto) {
  await p.evaluate(alto => {
    const real = window.__vvReal || window.visualViewport; window.__vvReal = real;
    const falso = { get height() { return alto; }, get width() { return innerWidth; }, offsetTop: 0, offsetLeft: 0, scale: 1, addEventListener() {}, removeEventListener() {} };
    window.__vvFalso = falso;
    if (!window.__vvListo) {
      window.__vvListo = true;
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => window.__vvFalso || window.__vvReal });
      document.addEventListener('focusout', () => setTimeout(() => {
        const a = document.activeElement;
        if (window.__vvFalso && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { window.__vvFalso = null; dispatchEvent(new Event('resize')); window.__tecladoSeCerro = (window.__tecladoSeCerro || 0) + 1; }
      }, 0));
    }
    dispatchEvent(new Event('resize'));
  }, alto);
  await p.waitForTimeout(250);
}
async function cerrar(p) { await p.evaluate(() => { window.__vvFalso = null; dispatchEvent(new Event('resize')); }); await p.waitForTimeout(200); }

async function teclado(p, w, h, nombre, fallas) {
  if (w >= 800) return;
  const n = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().height > 0).length, SEL);
  for (let i = 0; i < n; i++) {
    const ok = await p.evaluate(([sel, i]) => { const e = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().height > 0)[i]; if (!e) return false; e.focus(); return true; }, [SEL, i]);
    if (!ok) continue;
    await abrir(p, Math.round(h * 0.5));
    const r = await p.evaluate(alto => {
      const e = document.activeElement, o = [];
      if (!e || !/INPUT|TEXTAREA|SELECT/.test(e.tagName)) return ['se perdió el campo al abrir el teclado'];
      const b = e.getBoundingClientRect();
      if (b.top < -1 || b.bottom > alto + 1) o.push(`el campo ${e.id || e.name || e.placeholder} queda tapado por el teclado (${Math.round(b.top)}..${Math.round(b.bottom)}, se ve hasta ${alto})`);
      if (b.height < 20) o.push('el campo quedó aplastado');
      if (!document.documentElement.classList.contains('teclado')) o.push('el tablero no se dio cuenta del teclado');
      // Arrastrar con un dedo sobre la pantalla (no sobre una lista): no debe moverse nada.
      const zona = e.closest('form,.hoja,.cuerpo') || document.getElementById('app');
      const t = new Touch({ identifier: 1, target: zona, clientX: 20, clientY: 40 });
      const ev = new TouchEvent('touchmove', { cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] });
      zona.dispatchEvent(ev);
      if (!ev.defaultPrevented && !(e.tagName === 'TEXTAREA' && e.scrollHeight > e.clientHeight + 1)) o.push('con el teclado abierto la pantalla se puede arrastrar');
      // Si hay más preguntas abajo, el botón que se ve debe llevar a la siguiente (no guardar).
      const f = e.closest('form');
      if (f) {
        const campos = [...f.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=date]),textarea')];
        const vis = x => x.getBoundingClientRect().height > 0 && getComputedStyle(x).visibility !== 'hidden';
        const botones = [...f.querySelectorAll('button')].filter(vis);
        if (campos.indexOf(e) > -1 && campos.indexOf(e) < campos.length - 1) {
          if (botones.some(x => x.type !== 'button')) o.push('con preguntas pendientes abajo se puede guardar sin verlas');
          if (!botones.some(x => x.classList.contains('sig-campo'))) o.push('no hay botón "Siguiente pregunta"');
        }
        const vb = botones.filter(x => x.classList.contains('boton'));
        if (!vb.length) o.push('con el teclado abierto no se ve ningún botón para seguir');
        vb.forEach(x => { const r = x.getBoundingClientRect(); if (r.bottom > alto + 1) o.push(`el botón "${x.textContent.trim()}" queda tapado por el teclado`); });
      }
      return o;
    }, Math.round(h * 0.5));
    if (r.length) fallas.push(`teclado ${w}x${h} ${nombre}: ${r.join(' | ')}`);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await cerrar(p);
  }
}
// Un solo toque con el teclado abierto: el botón debe hacer lo suyo al primer toque (no solo cerrar el teclado).
teclado.unToque = async function (p, w, h, nombre, sel, cambio, fallas) {
  if (w >= 800) return p.click(sel);
  await abrir(p, Math.round(h * 0.5));
  const antes = await p.evaluate(cambio);
  // En el celular, si el toque le quita el foco al campo ANTES de que el botón reaccione, el teclado se cierra,
  // la pantalla brinca y el toque se pierde (el error de "hay que picarle dos veces").
  await p.evaluate(() => {
    window.__seCerroAntes = false; window.__yaClick = false;
    const fo = e => { if (!window.__yaClick && e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) window.__seCerroAntes = true; };
    const ck = () => { window.__yaClick = true; };
    document.addEventListener('focusout', fo, true); document.addEventListener('click', ck, true);
    setTimeout(() => { document.removeEventListener('focusout', fo, true); document.removeEventListener('click', ck, true); }, 1500);
  });
  await p.click(sel);
  await p.waitForTimeout(350);
  const despues = await p.evaluate(cambio), antesDeTiempo = await p.evaluate(() => window.__seCerroAntes);
  if (antes === despues) fallas.push(`teclado ${w}x${h} ${nombre}: un toque en "${sel}" no avanzó (hubo que tocar otra vez)`);
  if (antesDeTiempo) fallas.push(`teclado ${w}x${h} ${nombre}: el primer toque en "${sel}" cierra el teclado antes de avanzar`);
  await cerrar(p);
};
teclado.abrir = abrir; teclado.cerrar = cerrar;
module.exports = teclado;
