/* MOON Digital — el idioma de quien visita (copiado del estándar de Kidviniflo, 17-oct-2026).
   - Cada texto visible vive en UN diccionario por idioma: web/idiomas/<idioma>.js (interfaz) y <idioma>-largo.js (reglas y correos).
   - La página habla el idioma del teléfono, sin botones. Si no lo tenemos, inglés.
   - Árabe: la página entera se voltea (dir="rtl").
   - Pruebas: ?idioma=xx fuerza un idioma. Los robots de prueba (navigator.webdriver) ven español, que es lo aprobado.
   Se carga en el <head> ANTES de todo, sin esperar: así nunca se ve un idioma y luego otro. */
(function () {
  'use strict';
  var IDIOMAS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'ru', 'uk', 'ar', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh', 'zh-TW'];
  var DERECHA_A_IZQUIERDA = { ar: 1 };
  /* el formato de fechas, números y dinero lo pone el navegador (Intl); aquí solo su "región" de referencia */
  var REGION = { es: 'es-MX', en: 'en-US', pt: 'pt-BR', zh: 'zh-CN', 'zh-TW': 'zh-TW' };

  function elegir(lista) {
    for (var i = 0; i < lista.length; i++) {
      var l = String(lista[i] || '').toLowerCase();
      if (!l) continue;
      if (/^zh-(tw|hk|mo|hant)/.test(l)) return 'zh-TW';
      var base = l.split('-')[0];
      if (base === 'nb' || base === 'nn' || base === 'no') base = 'no';
      if (base === 'in') base = 'id';
      if (IDIOMAS.indexOf(base) >= 0) return base;
    }
    return 'en';
  }
  function escogido() {
    var m = /[?&]idioma=([a-zA-Z-]{2,7})/.exec(location.search);
    if (m) { var f = m[1]; f = f.toLowerCase() === 'zh-tw' ? 'zh-TW' : f.toLowerCase(); if (IDIOMAS.indexOf(f) >= 0) return f; }
    if (navigator.webdriver) return 'es';
    return elegir(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
  }

  var LANG = escogido(), DIR = DERECHA_A_IZQUIERDA[LANG] ? 'rtl' : 'ltr';
  var raiz = document.documentElement;
  raiz.setAttribute('lang', LANG === 'zh' ? 'zh-Hans' : LANG === 'zh-TW' ? 'zh-Hant' : LANG);
  raiz.setAttribute('dir', DIR);

  var DICS = window.KVI_DICS = window.KVI_DICS || {};
  var reglas = null;
  function plural(n) { try { return (reglas = reglas || new Intl.PluralRules(REGION[LANG] || LANG)).select(n); } catch (e) { return n === 1 ? 'one' : 'other'; } }

  /* busca "kd.t.nombre" dentro del diccionario; si a un idioma le falta algo, sale en inglés (el candado no deja que falte) */
  function buscar(dic, clave) { var o = dic; if (!o) return undefined; var p = clave.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
  function t(clave, vars) {
    var v = buscar(DICS[LANG], clave);
    if (v === undefined) v = buscar(DICS.en, clave);
    if (v === undefined) v = buscar(DICS.es, clave);
    if (v === undefined) return clave;
    if (v && typeof v === 'object' && vars && typeof vars.n === 'number') v = v[plural(vars.n)] || v.other;
    if (typeof v !== 'string') return clave;
    if (vars) v = v.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return v;
  }
  /* pone los textos en el HTML: data-t (texto), data-th (con <b>…), data-ta="aria-label:clave;placeholder:clave" */
  /* cada elemento se traduce UNA vez: si después la página le pone otro texto (p. ej. el nombre del artista), se respeta */
  function aplicar(r) {
    r = r || document;
    var a = r.querySelectorAll('[data-t]'), i;
    for (i = 0; i < a.length; i++) if (!a[i].__kvi) { a[i].__kvi = 1; a[i].textContent = t(a[i].getAttribute('data-t')); }
    a = r.querySelectorAll('[data-th]'); for (i = 0; i < a.length; i++) if (!a[i].__kvi) { a[i].__kvi = 1; a[i].innerHTML = t(a[i].getAttribute('data-th')); }
    a = r.querySelectorAll('[data-ta]'); for (i = 0; i < a.length; i++) if (!a[i].__kvia) { a[i].__kvia = 1; a[i].getAttribute('data-ta').split(';').forEach(function (par) {
      var k = par.split(':'); if (k[1]) a[i].setAttribute(k[0].trim(), t(k[1].trim()));
    }); }
    var tt = r.querySelector && r.querySelector('title[data-t]'); if (tt) document.title = t(tt.getAttribute('data-t'));
  }
  /* (17-oct, Kid) el dinero SIEMPRE dice su moneda: "$200" solo confunde (un estadounidense piensa en dólares).
     Se escribe a la manera de cada idioma y termina en MXN: "$200 MXN", "200 $ MXN", "200 MXN"… Misma regla en los correos (kd_servidor/correo.js). */
  function precio(mxn) { return precioMXN(REGION[LANG] || LANG, mxn); }
  function precioMXN(region, mxn) {
    try { const t = new Intl.NumberFormat(region, { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(mxn); return /MX/.test(t) ? t : t + ' MXN'; }
    catch (e) { return '$' + mxn + ' MXN'; }
  }

  window.KVI = { lang: LANG, dir: DIR, idiomas: IDIOMAS, region: REGION[LANG] || LANG, t: t, aplicar: aplicar, precio: precio, elegir: elegir };

  /* el diccionario se pide aquí mismo, antes de que la página siga (así está listo cuando la página lo usa) */
  var yo = document.currentScript, base = yo ? yo.src.replace(/idioma\.js(\?.*)?$/, '') : '/idiomas/';
  var largo = yo && yo.getAttribute('data-largo') === '1';
  /* (si a un idioma le faltara un texto saldría en inglés, pero el candado de idiomas no deja publicar si falta algo) */
  var pedir = function (n) { document.write('<script src="' + base + n + '.js"><\/script>'); };
  pedir(LANG); if (largo) pedir(LANG + '-largo');
  /* cuando el documento termina, los textos del HTML que nadie tradujo antes se ponen solos (las páginas pueden llamar KVI.aplicar() antes) */
  document.addEventListener('DOMContentLoaded', function () { aplicar(document); });
})();
