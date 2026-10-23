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
    let i = 1, turno = 0;
    async function ver(n) {
      i = ((n - 1) % doc.numPages + doc.numPages) % doc.numPages + 1;
      const mio = ++turno, pg = await doc.getPage(i); if (mio !== turno) return;
      const v = pg.getViewport({ scale: 1 }), m = 8, W = Math.max(50, caja.clientWidth - m * 2), H = Math.max(50, caja.clientHeight - m * 2);
      const k = Math.min(W / v.width, H / v.height), dpr = Math.min(window.devicePixelRatio || 1, 2), vp = pg.getViewport({ scale: k * dpr });
      const tmp = document.createElement('canvas'); tmp.width = Math.floor(vp.width); tmp.height = Math.floor(vp.height);
      await pg.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise; if (mio !== turno) return;
      // Se dibuja aparte y se cambia de golpe: nunca se ve una hoja a medias.
      lienzo.width = tmp.width; lienzo.height = tmp.height; lienzo.getContext('2d').drawImage(tmp, 0, 0);
      lienzo.style.width = vp.width / dpr + 'px'; lienzo.style.height = vp.height / dpr + 'px';
      alCambiar && alCambiar(i, doc.numPages);
    }
    let x0 = null;
    caja.ontouchstart = e => { x0 = e.touches[0].clientX; };
    caja.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) ver(i + (dx < 0 ? 1 : -1)); };
    await ver(1);
    return { ver, get hoja() { return i; }, total: doc.numPages, redibuja: () => ver(i) };
  }
  window.VisorArchivo = { bajar, pdf, cargarPDFjs };
})();
