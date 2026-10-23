// Visor de archivos subidos (PDF, imágenes, otros) — lo usan el Centro y el link que se le manda al cliente (22-oct-2026).
// El archivo llega en partes; aquí se arma y se muestra: un PDF hoja por hoja, del tamaño de la pantalla (igual que las presentaciones).
(function () {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let cargando = null;
  function cargarPDFjs() {
    if (window.pdfjsLib) return Promise.resolve();
    return cargando || (cargando = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(); };
      s.onerror = () => { cargando = null; mal(new Error('pdfjs')); };
      document.head.appendChild(s);
    }));
  }
  async function bajar(partes, traer, progreso) {
    const trozos = []; let total = 0;
    for (let n = 0; n < partes; n++) {
      let b64 = null;
      for (let intento = 0; intento < 3 && b64 == null; intento++) b64 = await traer(n).catch(() => null);
      if (b64 == null) throw new Error('parte ' + n);
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      trozos.push(u); total += u.length; progreso && progreso(n + 1, partes);
    }
    const todo = new Uint8Array(total); let o = 0; trozos.forEach(u => { todo.set(u, o); o += u.length; });
    return todo;
  }
  // Dibuja el PDF dentro de "caja": una hoja a la vez, completa. alCambiar(hoja, total) avisa para las flechas.
  async function pdf(caja, bytes, alCambiar) {
    await cargarPDFjs();
    const doc = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const lienzo = document.createElement('canvas'); lienzo.style.cssText = 'display:block;margin:auto;box-shadow:0 10px 40px rgba(0,0,0,.18);background:#fff';
    caja.innerHTML = ''; caja.style.display = 'grid'; caja.style.placeItems = 'center'; caja.appendChild(lienzo);
    let i = 1, turno = 0, Z = 1, ancho0 = 0, alto0 = 0;
    // Zoom propio del documento (pellizcar o doble toque): solo crece la hoja, nunca la página; con zoom se mueve con un dedo.
    function tamano() {
      lienzo.style.width = ancho0 * Z + 'px'; lienzo.style.height = alto0 * Z + 'px';
      caja.style.overflow = Z > 1 ? 'auto' : 'hidden'; caja.style.display = Z > 1 ? 'block' : 'grid';
      lienzo.style.margin = Z > 1 ? '0' : 'auto';
      caja.classList.toggle('con-zoom', Z > 1);   // con zoom la hoja se desliza a propósito
    }
    async function ver(n, mismo) {
      if (!mismo) { i = ((n - 1) % doc.numPages + doc.numPages) % doc.numPages + 1; Z = 1; }
      const mio = ++turno, pg = await doc.getPage(i); if (mio !== turno) return;
      const v = pg.getViewport({ scale: 1 }), m = 8, W = Math.max(50, (Z > 1 ? caja.clientWidth : caja.clientWidth) - m * 2), H = Math.max(50, caja.clientHeight - m * 2);
      const k = Math.min(W / v.width, H / v.height), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const esc = Math.min(k * dpr * Z, 4096 / v.width, 4096 / v.height), vp = pg.getViewport({ scale: esc });
      const tmp = document.createElement('canvas'); tmp.width = Math.floor(vp.width); tmp.height = Math.floor(vp.height);
      await pg.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise; if (mio !== turno) return;
      // Se dibuja aparte y se cambia de golpe: nunca se ve una hoja a medias.
      lienzo.width = tmp.width; lienzo.height = tmp.height; lienzo.getContext('2d').drawImage(tmp, 0, 0);
      ancho0 = v.width * k; alto0 = v.height * k; tamano();
      alCambiar && alCambiar(i, doc.numPages);
    }
    let espera = null;
    function zoomA(nz, x, y) {
      nz = Math.max(1, Math.min(4, nz)); const r = caja.getBoundingClientRect();
      const fx = (caja.scrollLeft + x - r.left) / Z, fy = (caja.scrollTop + y - r.top) / Z;
      Z = nz; tamano(); caja.scrollLeft = fx * Z - (x - r.left); caja.scrollTop = fy * Z - (y - r.top);
      clearTimeout(espera); espera = setTimeout(() => ver(i, true).then(() => { caja.scrollLeft = fx * Z - (x - r.left); caja.scrollTop = fy * Z - (y - r.top); }), 220);
    }
    let x0 = null, y0 = null, t2 = null, pellizco = false, ultimo = 0, ux = 0, uy = 0;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    caja.addEventListener('touchstart', e => { if (e.touches.length === 2) { pellizco = true; t2 = { d: dist(e.touches), z: Z }; } else if (e.touches.length === 1) { pellizco = false; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    caja.addEventListener('touchmove', e => { if (e.touches.length === 2 && t2) { e.preventDefault(); const t = e.touches; zoomA(t2.z * dist(t) / t2.d, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); } }, { passive: false });
    caja.addEventListener('touchend', e => {
      if (e.touches.length < 2) t2 = null; if (e.touches.length || x0 == null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null; if (pellizco) return;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { const ahora = Date.now(); if (ahora - ultimo < 320 && Math.abs(t.clientX - ux) < 30 && Math.abs(t.clientY - uy) < 30) { zoomA(Z > 1 ? 1 : 2.5, t.clientX, t.clientY); ultimo = 0; e.preventDefault(); } else { ultimo = ahora; ux = t.clientX; uy = t.clientY; } return; }
      if (Z === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ver(i + (dx < 0 ? 1 : -1));
    });
    caja.addEventListener('dblclick', e => zoomA(Z > 1 ? 1 : 2.5, e.clientX, e.clientY));
    caja.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); zoomA(Z * Math.exp(-e.deltaY / 120), e.clientX, e.clientY); } }, { passive: false });
    await ver(1);
    return { ver, get hoja() { return i; }, total: doc.numPages, redibuja: () => ver(i, true) };
  }
  window.VisorArchivo = { bajar, pdf, cargarPDFjs };
})();
