/* Marca del cliente para la calculadora y la presentación (26-oct-2026).
   El link lleva el código del demo: /calculadora/<codigo> y /presentacion/<codigo>.
   Sin código (o si el código no existe) se ve la versión general, con la marca de MOON.
   Dan pone el logo, los colores y el nombre del responsable desde "Crea tu recepcionista" en el Tablero. */
(function () {
  'use strict';
  var MOON = { negocio: '', responsable: '', logo: '', color: '#0b4fd6', color2: '#141a3c', demo: 'https://moondigitalia.com/prueba/nueva', general: true };
  var CREMA = '#F8F7F2';

  function rgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function lum(c) { return c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contraste(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mezcla(a, b, k) { return a.map(function (v, i) { return v + (b[i] - v) * k; }); }
  /* el color oscurecido hasta que se lee bien sobre la crema (texto de títulos) */
  function tinta(c) { var cr = rgb(CREMA), x = c; for (var k = 0; k <= 1 && contraste(x, cr) < 4.6; k += 0.05) x = mezcla(c, [16, 16, 20], k); return x; }
  /* el texto que va encima del color: blanco o casi negro, el que se lea mejor */
  function sobre(c) { return contraste(c, [255, 255, 255]) >= contraste(c, [21, 21, 24]) ? '#ffffff' : '#151518'; }

  function aplicar(m) {
    var c = rgb(m.color) || rgb(MOON.color), c2 = rgb(m.color2) || mezcla(c, [16, 16, 20], 0.55);
    var r = document.documentElement.style;
    r.setProperty('--c', hex(c)); r.setProperty('--c-sobre', sobre(c));
    r.setProperty('--c2', hex(c2)); r.setProperty('--c2-sobre', sobre(c2));
    r.setProperty('--c-tinta', hex(tinta(c)));
    r.setProperty('--c-claro', hex(mezcla(c, rgb(CREMA), 0.86)));
    r.setProperty('--c-hondo', hex(mezcla(c, [12, 12, 16], 0.62)));
    r.setProperty('--crema', CREMA);
  }

  function codigo() { var m = /^\/(?:calculadora|presentacion)\/([a-z0-9-]{3,40})\/?$/.exec(location.pathname); return m ? m[1] : ''; }

  /* pide la marca y avisa cuando la tiene (o a los 4 segundos, con la de MOON: la página nunca se queda en blanco) */
  window.MOON_MARCA = function (pagina, listo) {
    var cod = codigo(), hecho = false;
    function fin(m) { if (hecho) return; hecho = true; aplicar(m); listo(m); }
    if (!cod) return fin(MOON);
    setTimeout(function () { fin(MOON); }, 4000);
    fetch('/api/prueba', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'marca', codigo: cod, pagina: pagina }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return fin(MOON);
        var m = j.marca || {};
        fin({ negocio: m.negocio || '', responsable: m.responsable || '', logo: /^data:image\/(png|webp|jpeg);base64,/.test(m.logo || '') ? m.logo : '',
          color: m.color || MOON.color, color2: m.color2 || '', demo: m.demo || MOON.demo, general: false });
      })
      .catch(function () { fin(MOON); });
  };

  /* "[parte resaltada]" de los títulos → <em>; los datos del cliente siempre van escapados */
  window.MOON_ESC = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.MOON_RESALTA = function (txt) { return MOON_ESC(txt).replace(/\[([^\]]+)\]/g, '<em>$1</em>'); };
})();
