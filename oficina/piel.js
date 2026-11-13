// PIEL 3D FALSA DE LA OFICINA (12-nov-2026)
// Se enchufa encima de los sistemas: recibe los mismos datos (O, C, sel) y regresa el dibujo. Cambiar esta carpeta
// no mueve nada más (la Oficina sin piel sigue funcionando con sus cuartos planos).
// Vista isométrica (de arriba, en ángulo), luz según la hora de Cancún (mostaza, amarilla, morada) y monitos encima.
// REGLAS DE LA PIEL (las mide el juez de la oficina):
//  - Un monito mide MONO de alto; al ver la oficina completa en el celular más chico se distingue (≥ 12 px).
//  - Los nombres aparecen solo cuando ya se pueden leer (≥ 11 px en pantalla); antes, solo la luz de estado.
//  - Nada se encima: cada cosa tiene su lugar fijo en la rejilla del cuarto.
(function () {
  const TW = 64, TH = 32, MURO = 46, ESC = 1.22, MONO = Math.round(46 * ESC);   // ESC: monitos un poco más grandes que el mueble, para que se distingan desde lejos
  const ANCHO = 26, LARGO = 19, MARGEN = 12;
  const OX = LARGO * TW / 2 + MARGEN, OY = MURO + MARGEN + 20;
  const W = (ANCHO + LARGO) * TW / 2 + MARGEN * 2, H = (ANCHO + LARGO) * TH / 2 + OY + MARGEN;
  const iso = (x, y, z) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - (z || 0)];
  const P = pts => pts.map(p => p.map(n => Math.round(n * 10) / 10).join(',')).join(' ');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Los cuartos en la rejilla (x, y, ancho, largo). Los nombres son cortos a propósito.
  const CUARTOS = [
    { id: 'recepcion', n: 'Recepción · Jason', x: 0, y: 0, w: 6, h: 5, piso: '#47767a' },
    { id: 'clientes', n: 'Clientes que pagan', x: 7, y: 0, w: 10, h: 8, piso: '#3f6d70' },
    { id: 'demos', n: 'Demos', x: 18, y: 0, w: 8, h: 6, piso: '#4a7468' },
    { id: 'cubiculos', n: 'Equipo', x: 0, y: 6, w: 6, h: 7, piso: '#45706f' },
    { id: 'robots', n: 'Robots · tareas solas', x: 18, y: 7, w: 8, h: 5, piso: '#5d6a6c' },
    { id: 'crm', n: 'CRM · tus clientes', x: 7, y: 9, w: 5, h: 5, piso: '#46707a', herramienta: 'crm' },
    { id: 'libreria', n: 'Librería · pregúntale a Jason', x: 12, y: 9, w: 5, h: 5, piso: '#7a6a55', herramienta: 'libreria' },
    { id: 'crea', n: 'Crea tu recepcionista', x: 0, y: 14, w: 6, h: 4, piso: '#4d7a72', herramienta: 'crea' },
    { id: 'gris', n: 'Cuarto gris · dijeron que no', x: 7, y: 15, w: 10, h: 4, piso: '#6b4e36' },
    { id: 'oracion', n: 'Oración', x: 18, y: 13, w: 4, h: 6, piso: '#8a7860' },
    { id: 'cerrado', n: 'Archivo · pruebas', x: 22, y: 13, w: 4, h: 6, piso: '#8b8478' },
  ];
  const LUZ = { mostaza: ['#e0a53c', 0.16], amarilla: ['#f4d56a', 0.12], morada: ['#6b4fd0', 0.22] };
  const COLOR = { verde: '#3ccf7a', amarillo: '#f2c230', rojo: '#ef4b4b', gris: '#7d7d86' };

  function luzDe(hora) { return hora >= 6 && hora < 12 ? 'mostaza' : hora >= 12 && hora < 18 ? 'amarilla' : 'morada'; }

  // ---------- piezas ----------
  function caja(x, y, w, h, alto, c, z0) {   // un mueble: tapa y dos lados con su luz "horneada" (z0: desde qué altura)
    z0 = z0 || 0; const zt = z0 + alto;
    const a = iso(x, y + h, z0), b = iso(x + w, y + h, z0), d = iso(x + w, y, z0);
    const at = iso(x, y + h, zt), bt = iso(x + w, y + h, zt), dt = iso(x + w, y, zt), ct = iso(x, y, zt);
    return `<polygon points="${P([a, b, bt, at])}" fill="${c[1]}"/><polygon points="${P([b, d, dt, bt])}" fill="${c[2]}"/><polygon points="${P([ct, dt, bt, at])}" fill="${c[0]}"/>`;
  }
  // MUEBLES CON SAZÓN: cada mueble es reconocible (patas, cubierta, cajones, lomos de libros, pantalla con su base)
  const ROBLE = ['#c49a68', '#a07a4f', '#8a6841'], ROBLE_O = ['#8a6841', '#6f5233', '#5e452b'], METAL = ['#9aa3a0', '#7b8481', '#6a7370'];
  // una cara plana encima del mueble (a la altura z): papeles, teclado, tapete de escritorio
  const plano = (x, y, w, h, z, col, extra) => `<polygon points="${P([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)])}" fill="${col}"${extra || ''}/>`;
  // dibujo sobre la cara de enfrente (+y) de un mueble: de x0 a x1, de z0 a z1
  const caraY = (x0, x1, y, z0, z1, col) => `<polygon points="${P([iso(x0, y, z0), iso(x1, y, z0), iso(x1, y, z1), iso(x0, y, z1)])}" fill="${col}"/>`;
  const caraX = (y0, y1, x, z0, z1, col) => `<polygon points="${P([iso(x, y0, z0), iso(x, y1, z0), iso(x, y1, z1), iso(x, y0, z1)])}" fill="${col}"/>`;
  function mesa(x, y, w, h, o) {   // cuatro patas, cubierta con canto, y si se pide, cajonera
    o = o || {}; const alto = o.alto || 22, pata = 0.09; let s = '';
    if (o.cajonera) s += caja(x + w - 0.75, y + 0.06, 0.68, h - 0.12, alto - 3, ROBLE_O) + [0.3, 0.55, 0.8].map(f => caraX(y + 0.2, y + h - 0.2, x + w - 0.07, (alto - 3) * f - 1, (alto - 3) * f, '#4a3726')).join('');
    [[x + 0.06, y + 0.06], [x + w - pata - 0.06, y + 0.06], [x + 0.06, y + h - pata - 0.06], [x + w - pata - 0.06, y + h - pata - 0.06]].forEach(([a, b]) => { s += caja(a, b, pata, pata, alto - 3, ROBLE_O); });
    return s + caja(x, y, w, h, 3, o.color || ROBLE, alto - 3);
  }
  function compu(x, y, z) {   // pantalla de espaldas a la vista (le da la cara a quien está sentado), base, teclado y ratón
    return plano(x - 0.05, y + 0.42, 0.55, 0.18, z + 0.3, '#2b2b31') + `<circle cx="${iso(x + 0.62, y + 0.5, z)[0]}" cy="${iso(x + 0.62, y + 0.5, z)[1] - 1}" r="2" fill="#2b2b31"/>`
      + caja(x + 0.2, y + 0.82, 0.12, 0.12, 6, NEGRO, z) + caja(x - 0.12, y + 0.85, 0.7, 0.07, 19, NEGRO, z + 5)
      + `<circle cx="${iso(x + 0.23, y + 0.92, z + 15)[0]}" cy="${iso(x + 0.23, y + 0.92, z + 15)[1]}" r="1.6" fill="#7d7b86"/>`
      + `<ellipse cx="${iso(x + 0.23, y + 0.8, z + 22)[0]}" cy="${iso(x + 0.23, y + 0.8, z + 22)[1]}" rx="7" ry="2.5" fill="#7fc3ff" opacity=".3"/>`;
  }
  const papeles = (x, y, z) => plano(x, y, 0.35, 0.25, z + 0.2, '#f4f2ea') + plano(x + 0.05, y + 0.04, 0.35, 0.25, z + 0.4, '#ffffff') + plano(x + 0.1, y + 0.1, 0.22, 0.03, z + 0.5, '#9aa6b8');
  const taza = (x, y, z) => caja(x, y, 0.1, 0.1, 5, ['#f3f2ee', '#d8d6cf', '#c4c2bb'], z);
  function lampara(x, y, z) { const [bx, by] = iso(x, y, z), [cx, cy] = iso(x, y, z + 16);
    return `<ellipse cx="${bx}" cy="${by}" rx="5" ry="2.5" fill="#2b2b31"/><path d="M${bx},${by} L${bx + 3},${cy + 4}" stroke="#2b2b31" stroke-width="2"/><path d="M${cx - 6},${cy + 6} L${cx},${cy - 3} L${cx + 8},${cy + 4} Z" fill="#2f7d5a"/><ellipse cx="${cx + 1}" cy="${cy + 9}" rx="8" ry="3" fill="#ffe7a3" opacity=".3"/>`; }
  function librero(x, y, w, h, alto, lomos) {   // marco de madera y repisas con lomos de libros de colores
    let s = caja(x, y, w, h, alto, ROBLE_O); const col = ['#c4573f', '#3f6fb0', '#e0b13c', '#4f9a5a', '#8a5ab0', '#f3f2ee', '#d07a3a'], trazos = col.map(() => '');
    const q = (x0, x1, z0, z1) => 'M' + P([iso(x0, y + h, z0), iso(x1, y + h, z0), iso(x1, y + h, z1), iso(x0, y + h, z1)]).replace(/ /g, 'L') + 'Z';
    for (let r = 0; r < 3; r++) { const z0 = 4 + r * (alto - 6) / 3, z1 = z0 + (alto - 6) / 3 - 3;
      s += caraY(x + 0.05, x + w - 0.05, y + h, z0 - 1, z1 + 1, '#3d2c1e');
      for (let k = 0, xx = x + 0.08; xx < x + w - 0.12; k++) { const ancho = 0.07 + ((k * 7 + r * 3 + lomos) % 4) * 0.025, alt = z1 - ((k + r + lomos) % 3) * 2;
        trazos[(k + r * 2 + lomos) % col.length] += q(xx, Math.min(xx + ancho, x + w - 0.08), z0, alt); xx += ancho + 0.012; } }
    return s + trazos.map((d, i) => d ? `<path d="${d}" fill="${col[i]}"/>` : '').join('');   // un trazo por color: más ligero
  }
  function archiveroAlto(x, y, w, h, alto) { let s = caja(x, y, w, h, alto, METAL);
    for (let k = 0; k < 4; k++) { const z = 3 + k * (alto - 4) / 4; s += caraY(x + 0.04, x + w - 0.04, y + h, z, z + 1, '#5a625f') + caraY(x + w / 2 - 0.08, x + w / 2 + 0.08, y + h, z + (alto - 4) / 8, z + (alto - 4) / 8 + 1.6, '#3a403c'); }
    return s; }
  const MADERA = ['#8f7a60', '#6f5e49', '#5e4f3d'], GRIS = ['#8a8994', '#66656f', '#55545d'], NEGRO = ['#3a3a42', '#2b2b31', '#232328'];

  function luzEstado(cx, cy, estado) {
    const c = COLOR[estado] || COLOR.gris;
    return `<circle cx="${cx}" cy="${cy}" r="9" fill="${c}" opacity=".28" filter="url(#brillo)"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="${c}"/>`;
  }
  // Las etiquetas NO se dibujan donde se piden: se apuntan y al final se acomodan encima de todo, probando lugares
  // (abajo, arriba, a los lados) hasta que no choquen con otra etiqueta ni con un monito. Si no caben, no se ponen
  // (el nombre sigue en el panel al tocar).
  let ETQ = [], CUERPOS = [];
  let DUENO = '';   // de quién es la siguiente etiqueta (un monito que camina esconde la suya)
  function etiqueta(cx, cy, texto, extra, opciones) {
    ETQ.push({ cx, cy, texto: String(texto), clase: extra || '', opciones: opciones || [[0, 0]], propio: CUERPOS.length - 1, de: DUENO });
    return '';
  }
  function cuerpoRect(sx, sy, ancho, alto) { CUERPOS.push({ l: sx - ancho / 2, r: sx + ancho / 2, t: sy - alto, b: sy + 4 }); }
  function acomodar() {
    const puestas = [], choca = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    let svg = '';
    // Primero los nombres de los monitos, luego Claude, luego los robots y al final los nombres de los cuartos.
    const PRIO = { '': 0, 'nom-claude': 1, 'nom-robot': 2, 'nom-cuarto': 3 };
    ETQ.slice().sort((a, b) => (PRIO[a.clase] || 0) - (PRIO[b.clase] || 0)).forEach(e => {
      const ancho = Math.max(24, e.texto.length * 6.8 + 14), alto = 18;
      for (const [dx, dy] of e.opciones) {
        const x = e.cx + dx, y = e.cy + dy, caja = { l: x - ancho / 2 - 2, r: x + ancho / 2 + 2, t: y - alto / 2 - 2, b: y + alto / 2 + 2 };
        if (x - ancho / 2 < 4 || x + ancho / 2 > W - 4) continue;
        if (puestas.some(p => choca(p, caja)) || CUERPOS.some((p, i) => i !== e.propio && choca(p, caja))) continue;   // su propio cuerpo no le estorba
        puestas.push(caja);
        svg += `<g class="nom${e.clase ? ' ' + e.clase : ''}"${e.de ? ` data-de="${esc(e.de)}"` : ''}><rect x="${x - ancho / 2}" y="${y - alto / 2}" width="${ancho}" height="${alto}" rx="9" fill="#16161ad9"/><text x="${x}" y="${y + 4.2}" text-anchor="middle" font-size="12" font-weight="800" fill="#f3f2ee">${esc(e.texto)}</text></g>`;
        return;
      }
    });
    return svg;
  }
  // MONITOS 3D: los mismos monitos de Animación Kidviniflo (Blender), sacados desde el ángulo de la oficina en sus
  // poses (parado, sentado, caminando en dos pasos y acostado). Mientras llegan, se dibujan los monitos sencillos.
  const RUTA = '/oficina/monitos/', ALTO_MONO = 64;   // alto en el mundo de un monito parado
  let MET = null;
  // Al llegar la lista se piden de una vez todas las poses: así, al empezar a caminar, el paso ya está y no parpadea.
  const GUARDADAS = [];
  function cargar() {
    return fetch(RUTA + 'monitos.json').then(r => r.json()).then(j => {
      // La lista llega en un instante y con ella ya se dibujan los monitos 3D; las poses se piden de fondo
      // (así el primer paso de cada uno ya está y no parpadea).
      MET = j; api.cargado = true;
      // Las poses con las que aparecen (parado, sentado, acostado) se esperan ya listas para que ningún monito aparezca
      // después del resto (máximo 2.5 s: con internet muy lento, la oficina sale y los monitos llegan solos).
      const primeras = [];
      Object.entries(j).forEach(([n, m]) => m.poses.concat(m.acostado ? ['acostado'] : []).forEach(p => {
        const i = new Image(); i.src = `${RUTA}${n}_${p}.webp`; GUARDADAS.push(i);
        if (/^(reposo|sentado|acostado)$/.test(p)) primeras.push((i.decode ? i.decode() : Promise.resolve()).catch(() => {}));
      }));
      return Promise.race([Promise.all(primeras), new Promise(ok => setTimeout(ok, 2500))]);
    }).catch(() => { api.cargado = false; });   // si falla, se vuelve a pedir en el siguiente dibujo
  }
  // Quién usa qué monito: el equipo y Jason fijos; los demás asistentes toman colores en orden (sin el naranja de Claude)
  const FIJO = { kid: 'kid', 'equipo-kid': 'kid', 'equipo-daniel': 'papa', 'equipo-dan': 'dan', jason: 'jason', claude: 'claude', jesus: 'jesus' };
  const COLORES = ['verde', 'coral', 'mostaza', 'lila'];
  let ORDEN = {};
  function pielDe(id) { if (FIJO[id]) return FIJO[id]; if (!(id in ORDEN)) ORDEN[id] = COLORES[Object.keys(ORDEN).length % COLORES.length]; return ORDEN[id]; }
  function imgMono(sk, pose, sx, sy) {   // la imagen del monito con los pies en (sx, sy)
    const m = MET[sk], k = ALTO_MONO / 200;
    if (pose === 'acostado') { const [w, h] = m.acostado; return `<image class="m-img" href="${RUTA}${sk}_acostado.webp" x="${sx - w * k / 2}" y="${sy - h * k * 0.8}" width="${w * k}" height="${h * k}"/>`; }
    return `<image class="m-img" data-sk="${sk}" data-pose="${pose}" data-px="${m.px * k}" data-sx="${sx}" href="${RUTA}${sk}_${pose}.webp" x="${sx - m.px * k}" y="${sy - m.py * k}" width="${m.w * k}" height="${m.h * k}"/>`;
  }
  // Monito (persona o asistente): sombra, cuerpo, cabeza, pelo; acostado con ojos de tache en el cuarto gris.
  function monito(x, y, o) {
    const sk = MET && pielDe(o.piel3d || o.id);
    if (sk && MET[sk]) return monito3d(x, y, o, sk);
    return '';   // los monitos dibujados a mano ya no se usan (Kid, 13-nov-2026: se veían un instante al refrescar)
  }
  function monito3d(x, y, o, sk) {
    const [sx, sy] = iso(x, y, 0), pose = o.acostado ? 'acostado' : o.sentado && MET[sk].poses.includes('sentado') ? 'sentado' : 'reposo';
    const alto = o.acostado ? 22 : ALTO_MONO * (pose === 'sentado' ? 0.85 : 1);
    DUENO = o.actor ? o.id : '';
    if (o.acostado) cuerpoRect(sx, sy, 60, 24); else cuerpoRect(sx, sy, 34, alto + 18);
    if (o.nombre) etiqueta(sx, sy - alto - 16, o.nombre, o.clase || '', o.opciones || [[0, 0], [0, -20], [46, 10], [-46, 10], [0, alto + 46]]);
    DUENO = '';
    const zz = o.dormido ? `<text class="zz" x="${sx + 14}" y="${sy - alto - 6}" font-size="13" font-weight="900" fill="#b9b8c2">z</text>` : '';
    return `<g class="mono-3d${o.actor ? ' actor' : ''}" data-a="${esc(o.id || '')}"${o.cuarto ? ` data-c="${o.cuarto}"` : ''}${o.actor ? ` data-actor="${esc(o.id)}" data-tx="${x}" data-ty="${y}" data-alto="${Math.round(alto)}"${o.lado ? ` data-lado="${o.lado.join(',')}"` : ''}${o.dormido ? ' data-dormido="1"' : ''}${o.estado === 'rojo' ? ' data-falla="1"' : ''}` : ''}><ellipse cx="${sx}" cy="${sy}" rx="14" ry="5" fill="#0006"/>${imgMono(sk, pose, sx, sy)}${zz}
      ${o.estado ? luzEstado(sx, sy - alto - 10, o.estado) : ''}</g>`;
  }
  // Claude: el monito todo naranja. Sin la lista de los monitos 3D no se dibuja nada (nunca el robot viejo).
  function robotNaranja(x, y) {
    if (!MET || !MET.claude) return '';
    return monito3d(x, y, { id: 'claude', actor: true, nombre: 'Claude', clase: 'nom-claude' }, 'claude');
  }
  // Robot con ruedas (una tarea automática) en su estación.
  function robotRuedas(x, y, t, i) {
    const [sx, sy] = iso(x, y, 0), mal = t.resultado !== 'bien';
    DUENO = 'robot-' + i;
    return `<g class="mono-3d actor" data-c="robots" data-a="robot-${i}" data-actor="robot-${i}" data-tx="${x}" data-ty="${y}" data-alto="${Math.round(40 * ESC)}" data-robot="${esc(t.nombre)}"><g transform="translate(${sx},${sy}) scale(${ESC})"><ellipse cx="0" cy="2" rx="13" ry="5" fill="#0006"/>
      <circle cx="-7" cy="-2" r="4" fill="#222"/><circle cx="7" cy="-2" r="4" fill="#222"/>
      <rect x="-11" y="-22" width="22" height="18" rx="5" fill="#9b9aa5"/><path d="M-9,-22 a9,9 0 0 1 18,0z" fill="#b9b8c2"/>
      <rect x="-6" y="-17" width="12" height="5" rx="2.5" fill="#2b2b31"/></g>
      ${luzEstado(sx, sy - 38 * ESC, mal ? 'rojo' : 'verde')}${(cuerpoRect(sx, sy, 26 * ESC, 48 * ESC), etiqueta(sx, sy - 66, corto(t.nombre), 'nom-robot', [[0, 0], [0, -20], [0, 82]]), DUENO = '', '')}</g>`;
  }
  // EL NOMBRE DEL CUARTO VA PINTADO EN EL PISO (como en los juegos de oficinas y hospitales): letras grandes y suaves,
  // acostadas en la perspectiva del piso, sin globo. Así no parece un personaje más. Título grande y, abajo, qué es.
  function letrero(c) {
    const [titulo, sub] = c.n.split(' · '), k = 64, max = c.w * k - 36;
    let fs1 = Math.min(36, max / (titulo.length * 0.68)), fs2 = sub ? Math.min(22, max / (sub.length * 0.56)) : 0;
    // dónde queda libre el piso de cada cuarto (medido contra sus muebles); 'y' = las letras corren a lo largo del otro lado
    const LUGAR = { recepcion: [3, 4.35, 'x', 5], clientes: [12, 5.2], demos: [22, 5.3], cubiculos: [0.75, 8.6, 'y', 3.4, 'logo'], robots: [22, 11.3], crm: [9.6, 13.35], libreria: [14.5, 10.75], crea: [3, 17.45], gris: [12, 18.5], oracion: [18.75, 16.0, 'y', 2.4], cerrado: [24, 18.4] };
    const L = LUGAR[c.id] || [c.x + c.w / 2, c.y + c.h * 0.62], [ox, oy] = iso(L[0], L[1]);
    const largo = (L[3] || (L[2] === 'y' ? c.h : c.w)) * k - 36; if (L[2] === 'y' || L[3]) { fs1 = Math.min(36, largo / (titulo.length * 0.68)); fs2 = sub ? Math.min(22, largo / (sub.length * 0.56)) : 0; }
    const m = L[2] === 'y' ? `matrix(${TW / 2 / k},${-TH / 2 / k},${TW / 2 / k},${TH / 2 / k},${ox},${oy})` : `matrix(${TW / 2 / k},${TH / 2 / k},${-TW / 2 / k},${TH / 2 / k},${ox},${oy})`;
    return `<g class="letrero" transform="${m}" fill="#fbfaf6" font-weight="900" text-anchor="middle" stroke="#1d2a2b" stroke-width="5" stroke-linejoin="round" paint-order="stroke" stroke-opacity=".55" style="pointer-events:none"><text x="0" y="${sub ? -fs2 - 8 : 0}" font-size="${fs1.toFixed(1)}" opacity=".92" letter-spacing="1">${esc(titulo.toUpperCase())}</text>${sub ? `<text x="0" y="0" font-size="${fs2.toFixed(1)}" opacity=".85">${esc(sub)}</text>` : ''}${L[4] === 'logo' ? `<image href="/oficina/logo-moon.webp" x="${-largo * 0.42}" y="12" width="${largo * 0.84}" height="${largo * 0.84 * 124 / 480}" opacity=".9"/>` : ''}</g>`;   // el logo de MOON abajo de "Equipo"
  }
  // nombre corto de una tarea: sin lo de entre paréntesis y a lo más ~16 letras sin cortar palabras
  function corto(n) { n = String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (n.length <= 16) return n; const w = n.split(' '); let r = ''; for (const p of w) { if ((r + ' ' + p).trim().length > 16) break; r = (r + ' ' + p).trim(); } return r || n.slice(0, 16); }
  function telarana(x, y) {
    const [sx, sy] = iso(x, y, MURO - 4);
    return `<g stroke="#bdbdc6" stroke-width=".8" opacity=".55" fill="none"><path d="M${sx},${sy} l26,12 M${sx},${sy} l0,26 M${sx},${sy} l18,22"/>
      <path d="M${sx + 8},${sy + 4} q2,6 0,8 M${sx + 15},${sy + 7} q3,9 0,14 M${sx + 21},${sy + 10} q4,10 -1,16"/></g>`;
  }
  function arana(x, y) {
    const [sx, sy] = iso(x, y, 0);
    return `<g transform="translate(${sx},${sy})" fill="#111"><circle r="2.2"/><path d="M-5,-2 l10,4 M-5,2 l10,-4 M-5,0 h10" stroke="#111" stroke-width=".8"/></g>`;
  }

  // ---------- Pasillos, puertas y caminos ----------
  // Pasillos (rectángulos en la rejilla) y líneas por donde se camina.
  const PASILLOS = [[6, 0, 7, LARGO], [17, 0, 18, LARGO], [7, 8, 17, 9], [7, 14, 17, 15], [18, 6, ANCHO, 7], [18, 12, ANCHO, 13]];
  const LINEAS = [{ x: 6.5 }, { x: 17.5 }, { y: 8.5, de: 6.5, a: 17.5 }, { y: 14.5, de: 6.5, a: 17.5 }, { y: 6.5, de: 17.5, a: ANCHO - 0.5 }, { y: 12.5, de: 17.5, a: ANCHO - 0.5 }];
  const AGUA = [7.6, 7.3];   // el garrafón: en la esquina de Clientes, a la vista (en el pasillo lo tapaban las paredes)
  // Por dónde se entra a cada cuarto: [adentro, puerta en el pasillo]
  const PUERTAS = {
    recepcion: [[5.4, 2.5], [6.5, 2.5]], cubiculos: [[5.4, 9.6], [6.5, 9.6]], crea: [[5.4, 16], [6.5, 16]],
    clientes: [[12, 7.4], [12, 8.5]], crm: [[9.5, 13.4], [9.5, 14.5]], libreria: [[14.5, 13.4], [14.5, 14.5]],
    gris: [[16.4, 17], [17.5, 17]], demos: [[21, 5.4], [21, 6.5]], robots: [[21, 11.4], [21, 12.5]], oracion: [[20, 13.6], [20, 12.5]],
  };
  // Camino entre dos puertas siguiendo los pasillos (búsqueda del camino más corto en la red de pasillos).
  function camino(desde, hasta) {
    const nodos = [desde, hasta, [6.5, 8.5], [6.5, 14.5], [17.5, 8.5], [17.5, 14.5], [17.5, 6.5], [17.5, 12.5]];
    Object.values(PUERTAS).forEach(p => nodos.push(p[1]));
    const en = (n, l) => l.x !== undefined ? Math.abs(n[0] - l.x) < 0.01 : Math.abs(n[1] - l.y) < 0.01 && n[0] >= l.de - 0.01 && n[0] <= l.a + 0.01;
    const vec = nodos.map(() => []);
    LINEAS.forEach(l => {
      const ids = nodos.map((n, i) => i).filter(i => en(nodos[i], l)).sort((a, b) => l.x !== undefined ? nodos[a][1] - nodos[b][1] : nodos[a][0] - nodos[b][0]);
      for (let k = 1; k < ids.length; k++) { vec[ids[k - 1]].push(ids[k]); vec[ids[k]].push(ids[k - 1]); }
    });
    const dist = nodos.map(() => Infinity), prev = nodos.map(() => -1), hecho = nodos.map(() => false); dist[0] = 0;
    for (;;) {
      let u = -1; dist.forEach((d, i) => { if (!hecho[i] && d < Infinity && (u < 0 || d < dist[u])) u = i; });
      if (u < 0 || u === 1) break; hecho[u] = true;
      vec[u].forEach(v => { const d = dist[u] + Math.hypot(nodos[u][0] - nodos[v][0], nodos[u][1] - nodos[v][1]); if (d < dist[v]) { dist[v] = d; prev[v] = u; } });
    }
    if (dist[1] === Infinity) return [hasta];
    const r = []; for (let v = 1; v >= 0; v = prev[v]) { r.unshift(nodos[v]); if (v === 0) break; }
    return r;
  }
  function cuartoDe(x, y) { return CUARTOS.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); }
  function ruta(de, a) {   // de un punto (dentro de un cuarto o en un pasillo) a otro, pasando por puertas y pasillos
    const cd = cuartoDe(de[0], de[1]), ca = cuartoDe(a[0], a[1]);
    if (cd && ca && cd.id === ca.id) return [a];
    const pd = cd && PUERTAS[cd.id], pa = ca && PUERTAS[ca.id];
    const ini = pd ? pd[1] : de, fin = pa ? pa[1] : a;
    return (pd ? [pd[0]] : []).concat(camino(ini, fin)).concat(pa ? [pa[0], a] : (fin === a ? [] : [a]));
  }

  // ---------- La vida: los monitos se mueven solos ----------
  // Una sola tabla de tiempos (en segundos).
  const TIEMPO = { pasito: 0.5, paso: 0.6, idaMin: 18, idaMax: 70, quedarse: [3, 6], platica: 5, mas: 4, burbuja: 4 };
  let VIDA = null;
  function vida(raiz, O, C) {
    if (!VIDA) VIDA = { actores: {}, previo: {}, reloj: 0, ultimo: performance.now() };
    const V = VIDA, capa = raiz.querySelector('.capa-vida') || (() => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'capa-vida'); raiz.querySelector('svg').appendChild(g); return g; })();
    V.raiz = raiz; V.capa = capa;
    const as = (O.asistentes && O.asistentes.lista) || [];
    // "+N pláticas" cuando llegan pláticas nuevas
    as.forEach(a => { const ant = V.previo[a.id]; if (ant !== undefined && a.platicas7d > ant) burbujaDe(a.id, '+' + (a.platicas7d - ant), '#3ccf7a', TIEMPO.mas); V.previo[a.id] = a.platicas7d; });
    // A dónde va Claude: el cuarto de lo último que se anotó
    const ult = ((O.actividad && O.actividad.lineas) || [])[0], txt = ult ? ult.texto.toLowerCase() : '';
    const destinoClaude = /crm|ficha|cliente nuevo/.test(txt) ? 'crm' : /librer|jason/.test(txt) ? 'libreria' : /robot|tarea|medici/.test(txt) ? 'robots' : /demo/.test(txt) ? 'demos' : 'clientes';
    raiz.querySelectorAll('[data-actor]').forEach(g => {
      const id = g.dataset.actor, casa = [Number(g.dataset.tx), Number(g.dataset.ty)];
      let a = V.actores[id];
      if (!a) a = V.actores[id] = { id, casa, pos: casa.slice(), camino: [], espera: 0, prox: (6 + Math.random() * TIEMPO.idaMax) * (id === 'jason' ? 3 : 1), modo: 'casa', burbuja: null };
      a.casa = casa; a.g = g; a.alto = Number(g.dataset.alto) || 50;
      a.lado = g.dataset.lado ? g.dataset.lado.split(',').map(Number) : null;   // por dónde se sale del escritorio
      a.quieto = !!g.dataset.dormido || !!g.dataset.falla;
      a.marcador = a.marcador && a.marcador.isConnected ? a.marcador : null;
      if (id === 'claude' && PUERTAS[destinoClaude] && a.destino !== destinoClaude) { a.destino = destinoClaude; const d = PUERTAS[destinoClaude][0]; a.camino = ruta(a.pos, destinoClaude === 'clientes' ? casa : adentro(destinoClaude)); a.modo = 'fuera'; a.claudeFijo = true; }
      if (id === 'jason') a.quieto = a.quieto || ((C && C.llamadas) || []).some(l => Date.now() - Date.parse(l.fecha) < 600e3);
      colocar(a);
    });
    const total = as.reduce((t, a) => t + (a.platicas7d || 0), 0);
    V.cupo = 1 + (total > 100 ? 1 : 0) + (total > 1000 ? 1 : 0);
    if (!V.corriendo) { V.corriendo = true; requestAnimationFrame(t => paso(t)); }
  }
  // un punto un poco adentro de la puerta de un cuarto (para que Claude entre y se ponga a trabajar ahí)
  function adentro(id) { const [[ix, iy], [px, py]] = PUERTAS[id], dx = ix - px, dy = iy - py, n = Math.hypot(dx, dy) || 1; return [ix + dx / n * 1.1 - dy / n * 0.6, iy + dy / n * 1.1 + dx / n * 0.6]; }
  function burbujaDe(id, texto, color, seg) { const a = VIDA && VIDA.actores[id]; if (a) { a.burbuja = { texto, color, hasta: VIDA.reloj + seg }; colocar(a); } }
  // DÓNDE VA EL QUE CAMINA ENTRE LO DIBUJADO (de atrás hacia adelante). Las paredes son delgadas: con un solo número
  // de profundidad, la pared de junto podía quedar debajo y la cabeza "atravesaba" la pared. Regla de raíz: una
  // pared que toca su figura en pantalla va ENCIMA si la pared queda entre él y la vista (él está del otro lado de
  // su línea), y DEBAJO si él está del lado de la vista. Para lo demás manda la profundidad.
  function acomodo(caja_, a, prof, fuera) {
    const esc_ = caja_.parentNode, hijos = [...esc_.children].filter(h => h !== caja_);
    let p = hijos.findIndex(h => Number(h.dataset.d) > prof); if (p < 0) p = hijos.length;
    if (fuera) {
      const [x, y] = iso(a.pos[0], a.pos[1]), l = x - 18, r = x + 18, t = y - a.alto - 10, b = y + 4;
      let lo = 0, hi = hijos.length;
      hijos.forEach((h, i) => { const m = h._m || (h._m = h.dataset.m ? h.dataset.m.split(',').map((v, k) => k ? Number(v) : v) : 0); if (!m) return;
        const [eje, linea, ml, mt, mr, mb] = m; if (mr <= l || ml >= r || mb <= t || mt >= b) return;
        const detras = eje === 'y' ? a.pos[1] < linea : a.pos[0] < linea;   // la pared queda entre él y la vista
        if (detras) hi = Math.min(hi, i); else lo = Math.max(lo, i + 1); });
      p = lo <= hi ? Math.min(Math.max(p, lo), hi) : hi;
    }
    const sig = hijos[p] || null; if (sig !== caja_.nextSibling) esc_.insertBefore(caja_, sig);
  }
  function colocar(a) {
    if (!a.g || !a.g.isConnected) return;
    const [x0, y0] = iso(a.casa[0], a.casa[1]), [x1, y1] = iso(a.pos[0], a.pos[1]);
    const camina = a.camino.length > 0, bote = camina ? Math.abs(Math.sin(VIDA.reloj * 9)) * -3 : 0;
    a.g.setAttribute('transform', `translate(${(x1 - x0).toFixed(1)},${(y1 - y0 + bote).toFixed(1)})`);
    const im = a.g.querySelector('.m-img');
    if (im) {
      if (camina) { const [nx, ny] = a.camino[0], dx = (nx - a.pos[0]) - (ny - a.pos[1]); if (Math.abs(dx) > 0.01) a.mira = dx > 0 ? 1 : -1; }
      const pose = camina ? (Math.floor(VIDA.reloj / TIEMPO.pasito) % 2 ? 'camina_b' : 'camina') : (a.fuera ? 'reposo' : im.dataset.pose);
      const sk = im.dataset.sk, m = MET && MET[sk];
      if (m && m.poses.includes(pose)) { const h = `${RUTA}${sk}_${pose}.webp`; if (im.getAttribute('href') !== h) im.setAttribute('href', h); }
      const voltea = camina && a.mira > 0, sxp = Number(im.dataset.sx);   // las imágenes miran a la izquierda; si va a la derecha, al espejo
      im.setAttribute('transform', voltea ? `translate(${2 * sxp},0) scale(-1,1)` : '');
    }
    // Fuera de su lugar: se acomoda en la profundidad donde va (las paredes y muebles de adelante lo tapan) y su nombre se esconde
    const fuera = a.fuera = Math.hypot(a.pos[0] - a.casa[0], a.pos[1] - a.casa[1]) > 0.05;
    const caja_ = a.g.closest('g.d');
    if (caja_) { if (!caja_.dataset.d0) caja_.dataset.d0 = caja_.dataset.d;   // en su lugar conserva su profundidad original (va encima de su silla)
      const prof = fuera ? a.pos[0] + a.pos[1] : Number(caja_.dataset.d0);
      const llave = fuera ? a.pos.map(v => Math.round(v * 8)).join(',') : 'casa';
      if (caja_.dataset.k !== llave) { caja_.dataset.k = llave; acomodo(caja_, a, prof, fuera); } }
    const etq = VIDA.raiz && VIDA.raiz.querySelector(`[data-de="${a.id}"]`); if (etq) etq.style.visibility = fuera ? 'hidden' : '';
    let b = a.g.querySelector('.burbuja');
    if (a.burbuja && VIDA.reloj < a.burbuja.hasta) {
      if (!b) { b = document.createElementNS('http://www.w3.org/2000/svg', 'g'); b.setAttribute('class', 'burbuja'); a.g.appendChild(b); }
      const [sx, sy] = iso(a.casa[0], a.casa[1]), w = Math.max(26, a.burbuja.texto.length * 8 + 14);
      b.innerHTML = `<rect x="${sx - w / 2}" y="${sy - a.alto - 44}" width="${w}" height="20" rx="10" fill="${a.burbuja.color}"/><text x="${sx}" y="${sy - a.alto - 29.5}" text-anchor="middle" font-size="13" font-weight="900" fill="#141414">${esc(a.burbuja.texto)}</text>`;
    } else if (b) b.remove();
  }
  function paso(t) {
    const V = VIDA;
    if (t < (V.pausaHasta || 0)) { V.ultimo = t; requestAnimationFrame(paso); return; }   // mientras el dedo mueve el mapa, la oficina se queda quieta (arrastrar fluido en celulares lentos)
    const dt = Math.max(0, Math.min(0.1, (t - V.ultimo) / 1000));   // nunca negativo (el reloj del cuadro puede venir un poquito antes): con 0 de distancia daba 0/0 y Claude se quedaba caminando en su lugar V.ultimo = t; V.reloj += dt;
    const lista = Object.values(V.actores).filter(a => a.g && a.g.isConnected);
    lista.forEach(a => {
      if (a.camino.length) {
        const [tx, ty] = a.camino[0], dx = tx - a.pos[0], dy = ty - a.pos[1], d = Math.hypot(dx, dy), avance = TIEMPO.paso * dt;
        if (d <= avance || d < 1e-6) { a.pos = [tx, ty]; a.camino.shift(); if (!a.camino.length) llegar(a, lista); } else { a.pos = [a.pos[0] + dx / d * avance, a.pos[1] + dy / d * avance]; }
        colocar(a);
      } else if (a.espera > 0) { a.espera -= dt; if (a.espera <= 0 && a.claudeFijo) { const op = ['crm', 'libreria', 'robots', 'demos', 'recepcion', 'cubiculos', 'clientes'].filter(r => r !== a.destino); a.destino = op[Math.floor(Math.random() * op.length)]; a.burbuja = null; a.camino = ruta(a.pos, adentro(a.destino)); }
        else if (a.espera <= 0 && a.modo === 'fuera' && !a.claudeFijo) { a.camino = a.lado ? ruta(a.pos, salida(a)).concat([a.casa]) : ruta(a.pos, a.casa); a.modo = 'regreso'; } colocar(a); }
      else if (a.modo === 'casa' && !a.quieto && !a.claudeFijo) {
        a.prox -= dt;
        if (a.prox <= 0) {
          const fueraYa = lista.filter(b => b.modo !== 'casa' && !b.claudeFijo).length, robotsFuera = lista.filter(b => /^robot-/.test(b.id) && b.modo !== 'casa').length;
          const lento = a.id === 'jason' ? 3 : /^robot-/.test(a.id) ? 2.5 : 1;   // Jason casi no deja su teléfono; los robots salen poco
          if (fueraYa < (V.cupo || 1) && !(/^robot-/.test(a.id) && robotsFuera)) salir(a, lista);
          a.prox = (TIEMPO.idaMin + Math.random() * (TIEMPO.idaMax - TIEMPO.idaMin)) * lento;
        }
      } else if (a.burbuja && V.reloj >= a.burbuja.hasta) { a.burbuja = null; colocar(a); }
    });
    requestAnimationFrame(paso);
  }
  const salida = a => [a.casa[0] + a.lado[0], a.casa[1] + a.lado[1]];
  const rutaDesde = (a, X) => a.lado ? [salida(a)].concat(ruta(salida(a), X)) : ruta(a.pos, X);   // primero se levanta y sale por un lado del escritorio
  function salir(a, lista) {
    if (/^robot-/.test(a.id)) {   // los robots no van por agua: ruedan a trabajar a un cuarto y regresan
      const quali = /quali/i.test(a.g.dataset.robot || ''), ids = ['clientes', 'demos', 'crm', 'libreria', 'recepcion'];
      a.camino = rutaDesde(a, PUERTAS[quali ? 'clientes' : ids[Math.floor(Math.random() * ids.length)]][0]); a.objetivo = 'visita'; a.modo = 'fuera'; return;
    }
    const r = Math.random(), libres = lista.filter(b => b !== a && b.modo === 'casa' && !b.quieto && !b.claudeFijo && !b.camino.length);
    if (r < 0.4) { a.camino = rutaDesde(a, [AGUA[0] + 0.75, AGUA[1] + 0.05]); a.objetivo = 'agua'; }
    else if (r < 0.75 && libres.length) { const b = libres[Math.floor(Math.random() * libres.length)]; a.camino = rutaDesde(a, (b.lado ? [b.casa[0] + b.lado[0], b.casa[1] + 0.35] : [b.casa[0] + 0.9, b.casa[1] + 0.6])); a.objetivo = 'platica'; a.con = b; }
    else { const ids = Object.keys(PUERTAS); const c = PUERTAS[ids[Math.floor(Math.random() * ids.length)]]; a.camino = rutaDesde(a, c[0]); a.objetivo = 'visita'; }
    a.modo = 'fuera';
  }
  function llegar(a, lista) {
    if (a.modo === 'regreso') { a.modo = 'casa'; a.pos = a.casa.slice(); return; }
    if (a.claudeFijo) { const q = 25 + Math.random() * 20; a.burbuja = { texto: '🔧', color: '#ff7a1a', hasta: VIDA.reloj + q }; a.espera = q; return; }   // trabaja un rato ahí y luego se va a otro cuarto
    const q = TIEMPO.quedarse[0] + Math.random() * (TIEMPO.quedarse[1] - TIEMPO.quedarse[0]);
    if (a.objetivo === 'agua') { a.burbuja = { texto: '💧', color: '#7fb6e6', hasta: VIDA.reloj + q }; a.espera = q; }
    else if (a.objetivo === 'platica' && a.con) { a.burbuja = { texto: '…', color: '#f3f2ee', hasta: VIDA.reloj + TIEMPO.platica }; a.con.burbuja = { texto: '…', color: '#f3f2ee', hasta: VIDA.reloj + TIEMPO.platica }; a.espera = TIEMPO.platica; }
    else a.espera = q;
  }

  // ---------- el dibujo completo ----------
  function dibuja(O, C, sel, hora) {
    const [lc, lo] = LUZ[luzDe(hora)];
    ETQ = []; CUERPOS = [];
    const as = (O.asistentes && O.asistentes.lista) || [];
    const R = id => CUARTOS.find(c => c.id === id);
    let fondo = '', cosas = [], LETREROS = '';   // cosas: [profundidad, svg]
    const pon = (x, y, svg) => cosas.push([x + y, svg]);

    // Pasillos: por aquí caminan los monitos de un cuarto a otro
    PASILLOS.forEach(([x0, y0, x1, y1]) => { fondo += `<polygon points="${P([iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)])}" fill="#5b6b68"/>`; });
    // Pisos y muros (de atrás hacia adelante)
    CUARTOS.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(c => {
      const a = iso(c.x, c.y), b = iso(c.x + c.w, c.y), d = iso(c.x + c.w, c.y + c.h), e = iso(c.x, c.y + c.h);
      const at = iso(c.x, c.y, MURO), bt = iso(c.x + c.w, c.y, MURO), et = iso(c.x, c.y + c.h, MURO);
      const elegido = sel && sel.cuarto === c.id;
      fondo += `<g class="cuarto" data-c="${c.id}">
        <polygon points="${P([a, b, d, e])}" fill="${c.piso}"/>
        <polygon points="${P([a, b, d, e])}" fill="url(#piso)" opacity=".5"/>
        <polygon points="${P([a, b, d, e])}" fill="${lc}" opacity="${lo}"/>
        ${elegido ? `<polygon points="${P([a, b, d, e])}" fill="none" stroke="#f3f2ee" stroke-width="3"/>` : ''}
</g>`;
      LETREROS += letrero(c);
    });

    // la luz de la hora ya mezclada en el color (un solo dibujo por tramo: más ligero en celulares lentos)
    const mezcla = (a, b, t) => { const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b);
      return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
    // ADORNOS DE PARED: qué lleva cada tramo (por cuarto, por lado y por número de tramo). Se dibujan sobre la pared.
    const ADORNOS = {
      recepcion: { atras: { 1: 'ventana', 4: 'reloj' }, izquierda: { 2: 'corcho' } },
      clientes: { atras: { 1: 'ventana', 3: 'ventana', 6: 'ventana', 8: 'rejilla' }, izquierda: { 5: 'pizarron' } },
      demos: { atras: { 1: 'ventana', 4: 'ventana', 6: 'rejilla' }, izquierda: { 2: 'corcho' } },
      cubiculos: { atras: { 3: 'rejilla' }, izquierda: { 1: 'ventana', 3: 'corcho', 5: 'ventana' } },
      robots: { atras: { 2: 'rejilla', 5: 'pizarron' } },
      crm: { atras: { 3: 'corcho', 4: 'pizarron' }, izquierda: { 2: 'ventana' } },   // los tramos 0 a 2 los tapan los archiveros
      libreria: { atras: { 4: 'ventana' } },
      crea: { atras: { 2: 'pizarron' }, izquierda: { 1: 'ventana' } },
      oracion: { atras: { 3: 'ventana' }, izquierda: { 3: 'cruz' } },
      cerrado: { izquierda: { 3: 'rejilla' } },
    };
    function adorno(c, lado, i, pt) {
      const que = ((ADORNOS[c.id] || {})[lado] || {})[i - (lado === 'atras' ? c.x : c.y)]; if (!que) return '';
      const d = 0.03, q = (a, b, z0, z1) => { const [ax, ay] = pt(a), [bx, by] = pt(b), off = lado === 'atras' ? [0, d] : [d, 0];
        return P([iso(ax + off[0], ay + off[1], z0), iso(bx + off[0], by + off[1], z0), iso(bx + off[0], by + off[1], z1), iso(ax + off[0], ay + off[1], z1)]); };
      if (que === 'ventana') return `<polygon points="${q(i + 0.12, i + 0.88, 14, 40)}" fill="#7a5230"/><polygon points="${q(i + 0.17, i + 0.83, 16, 38)}" fill="#cfe6ea"/><polygon points="${q(i + 0.17, i + 0.5, 16, 38)}" fill="#e8f4f5" opacity=".7"/><polygon points="${q(i + 0.48, i + 0.52, 16, 38)}" fill="#7a5230"/>`;
      if (que === 'pizarron') return `<polygon points="${q(i + 0.08, i + 0.92, 16, 38)}" fill="#8f8f96"/><polygon points="${q(i + 0.11, i + 0.89, 18, 36)}" fill="#f4f4f0"/><polygon points="${q(i + 0.2, i + 0.6, 30, 31.5)}" fill="#4a7fd6"/><polygon points="${q(i + 0.2, i + 0.45, 25, 26.5)}" fill="#d65a4a"/>`;
      if (que === 'corcho') return `<polygon points="${q(i + 0.2, i + 0.8, 18, 36)}" fill="#7a5230"/><polygon points="${q(i + 0.23, i + 0.77, 20, 34)}" fill="#c99a63"/><polygon points="${q(i + 0.3, i + 0.45, 26, 32)}" fill="#f3f2ee"/><polygon points="${q(i + 0.52, i + 0.68, 22, 29)}" fill="#f2c230"/>`;
      if (que === 'rejilla') return `<polygon points="${q(i + 0.35, i + 0.65, 34, 41)}" fill="#6f7a70"/><polygon points="${q(i + 0.37, i + 0.63, 36.5, 37.5)}" fill="#4d564e"/><polygon points="${q(i + 0.37, i + 0.63, 38.5, 39.5)}" fill="#4d564e"/>`;
      if (que === 'reloj') { const [ax, ay] = pt(i + 0.5), [cx, cy] = iso(ax + (lado === 'atras' ? 0 : d), ay + (lado === 'atras' ? d : 0), 32); return `<circle cx="${cx}" cy="${cy}" r="6" fill="#f4f4f0" stroke="#3a3a42" stroke-width="1.5"/><path d="M${cx},${cy} v-4 M${cx},${cy} h3" stroke="#3a3a42" stroke-width="1.2"/>`; }
      if (que === 'cruz') return `<polygon points="${q(i + 0.46, i + 0.54, 18, 42)}" fill="#7a5230"/><polygon points="${q(i + 0.34, i + 0.66, 33, 36)}" fill="#7a5230"/>`;
      return '';
    }
    // OBJETOS DEL PISO: plantas, archiveros, sillón, tapete (para que se sienta oficina viva, no cárcel)
    const planta = (x, y) => pon(x, y, caja(x - 0.18, y - 0.18, 0.36, 0.36, 12, ['#b8734a', '#9a5f3c', '#874f31']) + (() => { const [px, py] = iso(x, y, 12);
      return `<g fill="#4f9a5a"><ellipse cx="${px - 6}" cy="${py - 8}" rx="6" ry="11" transform="rotate(-25 ${px - 6} ${py - 8})"/><ellipse cx="${px + 6}" cy="${py - 9}" rx="6" ry="11" transform="rotate(25 ${px + 6} ${py - 9})"/><ellipse cx="${px}" cy="${py - 14}" rx="5" ry="12" fill="#5cb068"/></g>`; })());
    const archivero = (x, y) => pon(x + 0.6, y + 0.5, caja(x, y, 0.6, 0.5, 30, ['#7d8580', '#5f6762', '#525955']) + (() => { const [ax, ay] = iso(x + 0.6, y + 0.25, 0); return `<path d="M${ax - 6},${ay - 22} h8 M${ax - 6},${ay - 12} h8" stroke="#3a403c" stroke-width="2"/>`; })());
    const sillon = (x, y, w) => pon(x + w / 2, y + 0.4, caja(x, y, w, 0.8, 10, ['#c46a4a', '#a3563b', '#8e4a33']) + caja(x, y, w, 0.22, 24, ['#c46a4a', '#a3563b', '#8e4a33']));
    const tapete = (x, y, w, h, col) => { fondo += `<polygon points="${P([iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)])}" fill="${col}" opacity=".55"/>`; };

    // PAREDES CON ALTURA Y PUERTAS: cada pared va en tramos de un cuadro, ordenada por profundidad junto con los muebles
    // y los monitos (así una pared tapa al que camina detrás de ella). Atrás e izquierda: paredes altas; adelante y
    // derecha: bardas bajas para ver adentro. Cada cuarto tiene su puerta (un hueco con marco) y solo por ahí se pasa.
    CUARTOS.forEach(c => {
      const pu = PUERTAS[c.id], hueco = { lado: null, de: 0, a: 0 };
      if (pu) { const [, [px, py]] = pu;
        if (py > c.y + c.h) Object.assign(hueco, { lado: 'frente', de: px - 0.5, a: px + 0.5 });
        else if (px > c.x + c.w) Object.assign(hueco, { lado: 'derecha', de: py - 0.5, a: py + 0.5 });
        else if (py < c.y) Object.assign(hueco, { lado: 'atras', de: px - 0.5, a: px + 0.5 });
        else if (px < c.x) Object.assign(hueco, { lado: 'izquierda', de: py - 0.5, a: py + 0.5 }); }
      // un tramo de pared entre (x0,y0) y (x1,y1), de alto 'h' (desde 'z0')
      const tramo = (x0, y0, x1, y1, h, col, z0, gx, gy) => { z0 = z0 || 0; const A = iso(x0, y0, z0), B = iso(x1, y1, z0), Bt = iso(x1, y1, z0 + h), At = iso(x0, y0, z0 + h);
        // la tapa de arriba: la pared tiene grosor (gx, gy hacia afuera del cuarto)
        const tapa = gx || gy ? `<polygon points="${P([At, Bt, iso(x1 + gx, y1 + gy, z0 + h), iso(x0 + gx, y0 + gy, z0 + h)])}" fill="#dfe3d8"/>` : '';
        return `<polygon points="${P([A, B, Bt, At])}" fill="${mezcla(col, lc, lo * 0.7)}"/>${tapa}`; };
      const lado = (nombre, fijo, desde, hasta, eje, alto, col, gx, gy) => {
        for (let i = desde; i < hasta; i++) {
          const k0 = i, k1 = i + 1, enHueco = hueco.lado === nombre && k1 > hueco.de + 0.01 && k0 < hueco.a - 0.01;
          const pt = (v) => eje === 'x' ? [v, fijo] : [fijo, v];
          const prof = (eje === 'x' ? i + 0.5 + fijo : fijo + i + 0.5) - (alto > 20 ? 0.05 : -0.05);
          let svg = '';
          if (!enHueco) { svg = tramo(...pt(k0), ...pt(k1), alto, col, 0, gx, gy); if (alto > 20) svg += adorno(c, nombre, i, pt); }
          else {   // la puerta: hueco de un cuadro con su marco (y dintel en las paredes altas)
            const [ha, hb] = [Math.max(k0, hueco.de), Math.min(k1, hueco.a)];
            if (ha > k0) svg += tramo(...pt(k0), ...pt(ha), alto, col, 0, gx, gy);
            if (hb < k1) svg += tramo(...pt(hb), ...pt(k1), alto, col, 0, gx, gy);
            const marco = Math.max(alto, 34);
            svg += tramo(...pt(ha - 0.06), ...pt(ha + 0.06), marco, '#7a5230') + tramo(...pt(hb - 0.06), ...pt(hb + 0.06), marco, '#7a5230');
            if (alto > 20) svg += tramo(...pt(ha), ...pt(hb), MURO - 34, col, 34, gx, gy); else svg += tramo(...pt(ha - 0.06), ...pt(hb + 0.06), 4, '#7a5230', 32);
          }
          const ps = [iso(...pt(k0)), iso(...pt(k1)), iso(...pt(k1), Math.max(alto, 34)), iso(...pt(k0), Math.max(alto, 34))];
          const caj = [Math.min(...ps.map(q => q[0])), Math.min(...ps.map(q => q[1])), Math.max(...ps.map(q => q[0])), Math.max(...ps.map(q => q[1]))].map(v => v.toFixed(1)).join(',');
          cosas.push([prof, `<g data-c="${c.id}">${svg}</g>`, ` data-m="${eje === 'x' ? 'y' : 'x'},${fijo},${caj}"`]);

        }
      };
      const gris = c.id === 'gris' || c.id === 'cerrado';
      lado('atras', c.y, c.x, c.x + c.w, 'x', MURO, gris ? '#8d8f8c' : '#a9bba9', 0, -0.16);
      lado('izquierda', c.x, c.y, c.y + c.h, 'y', MURO, gris ? '#7b7d7a' : '#93a894', -0.16, 0);
      lado('frente', c.y + c.h, c.x, c.x + c.w, 'x', 12, gris ? '#9a9c99' : '#b7c6b4', 0, 0.16);
      lado('derecha', c.x + c.w, c.y, c.y + c.h, 'y', 12, gris ? '#868885' : '#a2b4a1', 0.16, 0);
    });
    // vida: plantas en las esquinas, archiveros, sillón de espera en recepción, tapetes
    [[0.4, 4.5], [16.5, 0.5], [25.5, 0.5], [5.6, 6.4], [16.5, 18.5], [25.5, 11.5], [21.5, 18.5], [0.4, 17.5]].forEach(([x, y]) => planta(x, y));
    archivero(4.6, 0.15); archivero(0.15, 6.2); archivero(7.2, 12.2); archivero(22.2, 13.3); archivero(23, 13.3); archivero(24.6, 16);
    pon(5.5, 2.6, caja(4.7, 0.6, 0.8, 2, 10, ['#c46a4a', '#a3563b', '#8e4a33']) + caja(5.28, 0.6, 0.22, 2, 24, ['#c46a4a', '#a3563b', '#8e4a33']));   // sillón de espera a un lado (el frente queda libre para leer el nombre)
    tapete(8, 3.6, 8, 3.2, '#2f5658'); tapete(19.9, 14.2, 1.9, 3.0, '#a3563b'); tapete(12.8, 11.2, 3.4, 2, '#5a4a3a');

    // Sillón individual (demos): asiento acolchonado, respaldo y brazos
    const TELA = ['#5a8fb0', '#477592', '#3d6680'];
    const sillonChico = (x, y) => pon(x - 0.03, y - 0.03, caja(x - 0.4, y - 0.42, 0.8, 0.22, 34, TELA) + caja(x - 0.42, y - 0.32, 0.18, 0.7, 20, TELA) + caja(x + 0.24, y - 0.32, 0.18, 0.7, 20, TELA) + caja(x - 0.26, y - 0.3, 0.52, 0.66, 13, ['#6aa3c6', '#5a8fb0', '#4d7d9b']));
    // Sillas: donde alguien se sienta hay silla (se queda aunque el monito se levante a caminar)
    const silla = (x, y) => pon(x - 0.02, y - 0.02, caja(x - 0.28, y - 0.28, 0.56, 0.56, 13, NEGRO) + caja(x - 0.3, y - 0.36, 0.6, 0.1, 34, NEGRO));

    // Recepción: Jason detrás del escritorio con su teléfono (brilla si hubo llamada en la última hora)
    const ll = (C && C.llamadas) || [], reciente = ll.some(l => Date.now() - Date.parse(l.fecha) < 3600e3);
    const jason = as.find(a => a.id === 'jason');
    pon(2.6, 3.0, caja(1.6, 2.6, 2, 0.8, 24, ROBLE_O) + caraY(1.65, 3.55, 3.4, 4, 20, '#a07a4f') + caja(1.55, 2.55, 2.1, 0.9, 3, ROBLE, 24) + papeles(1.8, 2.75, 27) + lampara(2.0, 3.15, 27));
    pon(2.6, 2.4, `<g>${(() => { const [px, py] = iso(3.25, 2.95, 27); return `<g class="${reciente ? 'suena' : ''}" style="transform-origin:${px}px ${py - 6}px"><rect x="${px - 6}" y="${py - 10}" width="12" height="8" rx="2" fill="#222"/></g>${reciente ? `<circle cx="${px}" cy="${py - 6}" r="12" fill="#3ccf7a" opacity=".35" filter="url(#brillo)"/>` : ''}`; })()}</g>`);
    silla(2.3, 1.6);
    if (jason) pon(2.3, 1.6, monito(2.3, 1.6, { id: 'jason', actor: true, cuarto: 'recepcion', nombre: 'Jason', estado: jason.estado, ropa: '#2f3b55', pelo: '#3a2a1f', diadema: true, sentado: true }));

    // Clientes que pagan: cada uno en su escritorio con pantalla; Claude, el robot naranja, va hacia lo último que tocó
    const clientes = as.filter(a => a.tipo === 'cliente');
    clientes.forEach((a, i) => {
      const x = 9 + i * 4, y = 2.6;
      pon(x + 0.1, y + 1, mesa(x - 1, y + 0.45, 2.4, 1, { cajonera: true }) + compu(x - 0.2, y + 0.45, 22) + papeles(x + 0.5, y + 0.6, 22) + taza(x - 0.8, y + 0.9, 22) + lampara(x + 1.1, y + 1.1, 22));
      silla(x, y);
      pon(x, y, monito(x, y, { id: a.id, lado: [1.6, 0], actor: true, dormido: !a.platicas7d, cuarto: 'clientes', nombre: a.nombre, estado: a.estado, ropa: ['#c45a7a', '#3f7d6a', '#7a5ac4'][i % 3], sentado: true }));
    });
    const ult = O.actividad && O.actividad.lineas && O.actividad.lineas[0];
    pon(11, 6, robotNaranja(11, 6, ult && ult.texto));

    // Demos
    as.filter(a => a.tipo === 'demo').forEach((a, i) => {
      const x = 19.6 + (i % 3) * 2.4, y = 2.2 + Math.floor(i / 3) * 2.6;
      sillonChico(x, y);
      pon(x, y, monito(x, y, { id: a.id, sentado: true, lado: [0, 0.9], actor: true, dormido: !a.platicas7d, cuarto: 'demos', nombre: a.nombre, estado: a.estado, ropa: ['#5a7ac4', '#b0864a', '#4a9aa0'][i % 3] }));
    });

    // Equipo: tres cubículos; si están en su horario, sentados; si no, la silla vacía
    const ROPA = { kid: '#2c2c34', daniel: '#40506e', dan: '#6e4a40' };
    (O.cubiculos || []).forEach((u, i) => {
      const x = 3.2, y = 7.8 + i * 2;   // cubículos un poco a la derecha: deja libre el piso del nombre y el logo
      pon(x + 1.2, y + 0.9, mesa(x + 0.2, y + 0.45, 2, 0.85, { cajonera: true }) + compu(x + 0.95, y + 0.4, 22) + papeles(x + 0.3, y + 0.55, 22) + (i === 0 ? lampara(x + 2, y + 1.1, 22) : taza(x + 1.9, y + 0.9, 22)));
      silla(x + 1.2, y);
      if (u.presente) pon(x + 1.2, y, monito(x + 1.2, y, { id: 'equipo-' + u.id, lado: [1.15, 0], actor: true, cuarto: 'cubiculos', nombre: ({ kid: 'Kid', daniel: 'Papá', dan: 'Dan' })[u.id], ropa: ROPA[u.id], sentado: true }));
      else pon(x + 1.2, y, `<g data-c="cubiculos">${etiqueta(...iso(x + 1.2, y, -16), ({ kid: 'Kid', daniel: 'Papá', dan: 'Dan' })[u.id] + ' · fuera')}</g>`);
    });

    // Robots: uno por tarea automática, en fila en su estación
    ((O.tareas && O.tareas.lista) || []).forEach((t, i) => { const x = 19.6 + (i % 3) * 2.4, y = 8.6 + Math.floor(i / 3) * 2; pon(x, y, robotRuedas(x, y, t, i)); });

    // CRM: archiveros; Librería: libreros y mesa de lectura
    pon(9.75, 9.75, archiveroAlto(7.3, 9.15, 0.75, 0.6, 30) + archiveroAlto(8.15, 9.15, 0.75, 0.6, 30) + archiveroAlto(9.0, 9.15, 0.75, 0.6, 30));   // archiveros pegados a la pared, más bajos que ella
    pon(10, 11.5, mesa(8.8, 10.8, 2, 1.1) + papeles(9.1, 11.1, 22) + papeles(9.8, 11.4, 22) + compu(9.4, 10.7, 22));
    [0, 1, 2, 3].forEach(i => pon(13.1 + i * 0.95, 9.9, librero(12.3 + i * 0.95, 9.3, 0.8, 0.6, 46, i)));
    pon(14.6, 12.2, mesa(13.6, 11.6, 2, 1.2) + lampara(15.3, 11.9, 22) + (() => { const [bx, by] = iso(14.4, 12.2, 22.5); return `<path d="M${bx - 14},${by} l14,-5 l14,5 l-14,6 z" fill="#f4f2ea" stroke="#c9c4b5"/><path d="M${bx},${by - 5} v11" stroke="#c9c4b5"/>`; })());
    // Crear tu recepcionista: banco de trabajo con un "+"
    pon(3.2, 16.2, mesa(1.6, 15.4, 3, 1.2, { color: ['#b6b9b2', '#94978f', '#82857e'] }) + caja(1.9, 15.6, 0.7, 0.4, 6, ['#d65a4a', '#b8463a', '#a33d32'], 22) + compu(3.2, 15.4, 22) + papeles(2.1, 16.1, 22)
      + (() => { const [px, py] = iso(4.1, 16.3, 24); return `<circle cx="${px}" cy="${py - 4}" r="9" fill="#3ccf7a"/><text x="${px}" y="${py + 1}" text-anchor="middle" font-size="15" font-weight="900" fill="#141414">+</text>`; })());

    // Cuarto gris: los que dijeron que no, en el piso con ojos de tache, telarañas y arañitas
    as.filter(a => a.tipo === 'dijo_no' || a.tipo === 'archivado' || a.id === 'donde').forEach((a, i) => {
      const x = 8.6 + i * 3, y = 17;
      pon(x, y, monito(x, y, { id: a.id, cuarto: 'gris', nombre: a.nombre, acostado: true, ropa: '#6b6b73', piel: '#a9a9b0' }));
    });
    fondo += telarana(7.05, 15.05) + telarana(16.4, 15.05);
    [[9.5, 15.8], [13.2, 18.3], [15.8, 16.4]].forEach(([x, y]) => pon(x, y, arana(x, y)));

    // Garrafón de agua en el cruce de pasillos (a donde van por agua)
    pon(AGUA[0], AGUA[1], caja(AGUA[0] - 0.24, AGUA[1] - 0.24, 0.48, 0.48, 28, ['#f1f1ec', '#d6d6cf', '#bdbdb5']) + caraY(AGUA[0] - 0.1, AGUA[0] + 0.1, AGUA[1] + 0.24, 16, 20, '#3a6fb0')
      + (() => { const [gx, gy] = iso(AGUA[0], AGUA[1], 28); return `<path d="M${gx - 11},${gy - 1} v-20 q0,-6 11,-7 q11,1 11,7 v20 q-11,6 -22,0 z" fill="#5aa6e6" opacity=".9"/><path d="M${gx - 11},${gy - 21} q11,6 22,0" stroke="#3a86c6" fill="none"/><rect x="${gx - 4}" y="${gy - 31}" width="8" height="5" rx="2" fill="#3a86c6"/><path d="M${gx - 6},${gy - 16} v10" stroke="#ffffffaa" stroke-width="3" stroke-linecap="round"/>`; })());
    // Archivo (puerta cerrada): una puerta con candado
    const [qx, qy] = iso(24, 13, 0);
    fondo += `<g data-c="cerrado"><polygon points="${P([iso(23.2, 13, 0), iso(24.8, 13, 0), iso(24.8, 13, 38), iso(23.2, 13, 38)])}" fill="#2a2a2f" stroke="#77757f"/><circle cx="${qx + 6}" cy="${qy - 18}" r="3" fill="#c9a64a"/></g>`;
    const nPruebas = as.filter(a => ['prueba', 'base', 'copia'].includes(a.tipo) && a.id !== 'donde').length;
    pon(24, 16.5, etiqueta(...iso(24, 16.5), nPruebas + ' guardados'));
    // Cuarto de oración: solo Jesús, con dos velitas
    [[19.7, 17.7], [21.4, 17.5]].forEach(([x, y]) => pon(x, y, caja(x - 0.15, y - 0.15, 0.3, 0.3, 10, ['#efe6d2', '#cfc4ad', '#b9ae98']) + (() => { const [vx, vy] = iso(x, y, 16); return `<circle cx="${vx}" cy="${vy}" r="10" fill="#ffcf6b" opacity=".35" filter="url(#brillo)"/><ellipse cx="${vx}" cy="${vy}" rx="2.2" ry="4" fill="#ffd97a"/>`; })()));
    pon(20.2, 15.5, monito(20.2, 15.5, { id: 'jesus', piel3d: 'jesus', cuarto: 'oracion', nombre: 'Jesús', ropa: '#efe6d2', pelo: '#4a2c18' }));

    cosas.sort((a, b) => a[0] - b[0]);
    return {
      ancho: W, alto: H, monito: MET ? ALTO_MONO : MONO,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
        <defs><filter id="brillo" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter>
          <linearGradient id="piso" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
${fondo}${LETREROS}<g class="escena">${cosas.map(c => `<g class="d" data-d="${c[0].toFixed(3)}"${c[2] || ''}>${c[1]}</g>`).join('')}</g>${acomodar()}
      </svg>`,
    };
  }
  // De un punto del dibujo al cuarto que está debajo (para tocar muebles, pasillos o el piso).
  function cuartoEn(wx, wy) { const a = (wx - OX) / (TW / 2), b = (wy - OY) / (TH / 2); const x = (a + b) / 2, y = (b - a) / 2; const c = cuartoDe(x, y); return c ? c.id : null; }
  // La pausa se vence sola (nunca se queda todo congelado); 'fija' solo mientras la oficina está tapada por otra pantalla
  // del Tablero (así un CRM encima no va a saltos en celulares lentos) y se suelta al volver al mapa.
  function pausa(si) { if (VIDA) VIDA.pausaHasta = si === 'fija' ? Infinity : si ? performance.now() + 350 : 0; }
  const api = { pausa, dibuja, MONO, luzDe, vida, ruta, cuartoEn, cargar, cargado: false };
  window.Piel = api;
})();
