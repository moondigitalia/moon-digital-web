// Juez del embajador (26-oct-2026): entra con su link o con su WhatsApp, ve SOLO lo suyo, nada se corta ni se mueve,
// y con el teclado abierto cada campo se ve completo. Nunca puede abrir pantallas de los socios.
const { chromium } = require('playwright');
const teclado = require('./teclado');
const RAPIDO = process.env.RAPIDO === '1';
const corridas = RAPIDO ? [['light', 320, 568, 1], ['light', 1280, 800, 1]] : [['light', 320, 568, 1], ['light', 375, 667, 1], ['dark', 390, 844, 1], ['light', 430, 932, 1.3], ['dark', 768, 1024, 1], ['light', 1280, 800, 1]];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const fallas = [];
  for (const [tema, w, h, z] of corridas) {
    const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: tema, hasTouch: w < 800, isMobile: w < 800 });
    await c.addInitScript(z => { try { localStorage.setItem('centro.moon.letra', String(z)); } catch (e) {} }, z);
    await c.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const revisa = async nombre => {
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => {
        const o = [], W = innerWidth, H = innerHeight;
        scrollTo(0, 400); if (scrollY || scrollX) o.push('la página se mueve');
        const ap = document.getElementById('app'); if (ap && ap.scrollHeight > ap.clientHeight + 1) o.push('no cabe: ' + ap.scrollHeight + '>' + ap.clientHeight);
        document.querySelectorAll('#app *').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && (b.right > W + 1 || b.bottom > H + 1 || b.left < -1) && !e.closest('.desliza')) o.push('se sale: ' + e.tagName + '.' + e.className); });
        document.querySelectorAll('.hoja,.t,.cuerpo,.caja,.entrada').forEach(e => { if (e.scrollHeight > e.clientHeight + 2) o.push('cortado: ' + e.className + ' ' + e.scrollHeight + '>' + e.clientHeight); });
        document.querySelectorAll('.t>.eti,.t-fila .q b,.top h2,.boton,.fila .q b,.entrada h1').forEach(el => { const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const re = /\S+/g; let m; while ((m = re.exec(n.data))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); if ([...rg.getClientRects()].filter(x => x.width > 0).length > 1) o.push('palabra partida: ' + m[0]); } } if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') o.push('texto cortado: ' + el.textContent.slice(0, 30)); });
        if (/\bEj\./.test(document.body.innerText)) o.push('abreviatura "Ej."');
        return o.slice(0, 4);
      });
      if (r.length) fallas.push(`${tema} ${w}x${h} z${z} ${nombre}: ${r.join(' | ')}`);
      if (w === 375 || w === 1280) await p.screenshot({ path: `emb-${tema}-${w}-${nombre}.png` });
    };
    // 1) Entrar con WhatsApp y contraseña
    await p.goto('http://localhost:8765/');
    await p.waitForSelector('#soyEmb'); await p.click('#soyEmb'); await revisa('entrada');
    await teclado(p, w, h, 'entrada', fallas);
    await p.fill('#tel', '998 123 4567'); await p.fill('#clave', 'mala'); await p.click('form .boton'); await p.waitForTimeout(300);
    if (!/no coinciden/.test(await p.textContent('#aviso'))) fallas.push(`${w} contraseña mala sin aviso claro`);
    await p.fill('#clave', '123456'); await p.click('form .boton');
    await p.waitForSelector('.mosaico.emb', { timeout: 5000 }).catch(() => fallas.push(`${w} no entró el embajador`));
    await revisa('inicio');
    const ve = await p.evaluate(() => ({ socio: !!document.querySelector('.t-crm,.t-equipo,.t-proy,.t-moon'), txt: document.querySelector('.mosaico').innerText }));
    if (ve.socio) fallas.push(`${w} el embajador ve tarjetas de socios`);
    for (const t of ['Mis comisiones', 'Crea tu recepcionista', 'Mis prospectos', 'Mis tareas', 'Material de MOON']) if (!ve.txt.includes(t)) fallas.push(`${w} falta "${t}" en su inicio`);
    for (const ir of ['emComisiones', 'emProspectos', 'emMaterial', 'tareas', 'demo']) {
      await p.click(`[data-ir="${ir}"]`, { position: { x: 12, y: 12 } }); await p.waitForTimeout(ir === 'demo' ? 900 : 300); await revisa(ir);
      if (ir === 'tareas') { if (await p.$('#accion')) fallas.push(`${w} el embajador puede crear tareas`); await p.click('[data-t]'); await revisa('tarea'); await p.click('#volver'); await p.waitForTimeout(300); }
      await p.click('#volver'); await p.waitForTimeout(300);
    }
    // 2) Candado: aunque algo intente abrir una pantalla de socios, regresa a su inicio
    await p.evaluate(() => abrir({ tipo: 'crm' })); await p.waitForTimeout(400);
    if (!await p.$('.mosaico.emb')) fallas.push(`${w} el embajador pudo abrir el CRM`);
    await p.click('#salir'); await revisa('cuenta'); await p.click('#cerrar'); await p.waitForSelector('#soyEmb', { timeout: 4000 }).catch(() => fallas.push(`${w} cerrar sesión no regresó a la entrada`));
    // 3) Link personal: crea su contraseña (y su WhatsApp si falta) y queda adentro; el link no se queda en la barra
    await p.goto('http://localhost:8765/tablero?invita=' + 'T'.repeat(30)); await p.waitForSelector('#c1'); await revisa('invita');
    if (p.url().includes('invita')) fallas.push(`${w} el link de invitación se queda en la barra`);
    await teclado(p, w, h, 'invita', fallas);
    await p.fill('#tel', '9981234567'); await p.fill('#c1', 'abcdef'); await p.fill('#c2', 'abcdeg'); await p.click('form .boton'); await p.waitForTimeout(200);
    if (!/no son iguales/.test(await p.textContent('#aviso'))) fallas.push(`${w} contraseñas distintas sin aviso`);
    await p.fill('#c2', 'abcdef'); await p.click('form .boton');
    await p.waitForSelector('.mosaico.emb', { timeout: 5000 }).catch(() => fallas.push(`${w} el link no lo dejó adentro`));
    await p.evaluate(() => { localStorage.clear(); });
    await p.goto('http://localhost:8765/tablero?invita=vencido'); await p.waitForTimeout(600); await revisa('invita-vencida');
    if (!/ya no sirve/.test(await p.textContent('#app'))) fallas.push(`${w} link vencido sin explicación`);
    if (errs.length) fallas.push(`${tema} ${w} errores: ${errs.join(' | ')}`);
    await c.close();
  }
  console.log(fallas.length ? fallas.join('\n') : 'SIN FALLAS'); await b.close();
})();
