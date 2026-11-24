// LEER UNA PÁGINA CON UN NAVEGADOR DE VERDAD (24-nov-2026)
// Algunas páginas (React, Vite, Lovable…) llegan vacías y arman su contenido después, con listas que cargan aparte
// (ej. los servicios de una clínica). Aquí se abre la página como la vería cualquier visitante, se espera a que
// termine de cargar, se recorre hasta abajo y se lee lo que se ve en pantalla.
// Solo se usa cuando la lectura normal sale casi vacía. Si algo falla, regresa null y el lector sigue con lo que ya tenía.
// En pruebas locales: CHROME_RUTA apunta a un Chromium normal.

async function leerConNavegador(url, ms) {
  const limite = ms || 22000, inicio = Date.now();
  let navegador = null;
  try {
    const puppeteer = require('puppeteer-core');
    let ruta = process.env.CHROME_RUTA, args = ['--no-sandbox', '--disable-dev-shm-usage'];
    if (!ruta) {
      const m = require('@sparticuz/chromium'); const chromium = m.default || m;
      ruta = await chromium.executablePath();
      args = chromium.args;
    }
    navegador = await puppeteer.launch({ executablePath: ruta, args, headless: 'shell', defaultViewport: { width: 1280, height: 900 } });
    const pagina = await navegador.newPage();
    await pagina.setUserAgent('Mozilla/5.0 (compatible; MOON-Digital-lector/1.0)');
    await pagina.setExtraHTTPHeaders({ 'Accept-Language': 'es-MX,es;q=0.9' });
    // Fotos, videos y letras no hacen falta para leer: no se bajan (más rápido y menos memoria).
    await pagina.setRequestInterception(true);
    pagina.on('request', r => (['image', 'media', 'font'].includes(r.resourceType()) ? r.abort() : r.continue()).catch(() => {}));
    const resta = () => Math.max(1000, limite - (Date.now() - inicio));
    await pagina.goto(url, { waitUntil: 'networkidle2', timeout: resta() }).catch(() => {});
    // Recorrer hasta abajo despierta lo que carga al hacer scroll.
    await pagina.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight && y < 30000; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    }).catch(() => {});
    await pagina.waitForNetworkIdle({ idleTime: 600, timeout: Math.min(5000, resta()) }).catch(() => {});
    const r = await pagina.evaluate(() => ({
      titulo: document.title || '',
      desc: (document.querySelector('meta[name="description"]') || {}).content || '',
      texto: (document.body && document.body.innerText) || '',
      final: location.href,
    }));
    return r;
  } catch (e) {
    console.log('NAVEGADOR-ERROR', e && e.message);
    return null;
  } finally {
    if (navegador) await navegador.close().catch(() => {});
  }
}

module.exports = { leerConNavegador };
