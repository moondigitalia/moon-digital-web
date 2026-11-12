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
    { id: 'recepcion', n: 'Recepción', x: 0, y: 0, w: 6, h: 5, piso: '#4d4a55' },
    { id: 'clientes', n: 'Clientes', x: 7, y: 0, w: 10, h: 8, piso: '#56504a' },
    { id: 'demos', n: 'Demos', x: 18, y: 0, w: 8, h: 6, piso: '#4b4d55' },
    { id: 'cubiculos', n: 'Equipo', x: 0, y: 6, w: 6, h: 7, piso: '#4a4852' },
    { id: 'robots', n: 'Robots', x: 18, y: 7, w: 8, h: 5, piso: '#474b52' },
    { id: 'crm', n: 'CRM', x: 7, y: 9, w: 5, h: 5, piso: '#4b4852', herramienta: 'crm' },
    { id: 'libreria', n: 'Librería', x: 12, y: 9, w: 5, h: 5, piso: '#4e4943', herramienta: 'libreria' },
    { id: 'crea', n: 'Crear', x: 0, y: 14, w: 6, h: 4, piso: '#4a4d52', herramienta: 'crea' },
    { id: 'gris', n: 'Cuarto gris', x: 7, y: 15, w: 10, h: 4, piso: '#3c3c40' },
    { id: 'cerrado', n: 'Archivo', x: 18, y: 13, w: 8, h: 6, piso: '#323236' },
  ];
  const LUZ = { mostaza: ['#e0a53c', 0.16], amarilla: ['#f4d56a', 0.12], morada: ['#6b4fd0', 0.22] };
  const COLOR = { verde: '#3ccf7a', amarillo: '#f2c230', rojo: '#ef4b4b', gris: '#7d7d86' };

  function luzDe(hora) { return hora >= 6 && hora < 12 ? 'mostaza' : hora >= 12 && hora < 18 ? 'amarilla' : 'morada'; }

  // ---------- piezas ----------
  function caja(x, y, w, h, alto, c) {   // un mueble: tapa y dos lados con su luz "horneada"
    const a = iso(x, y + h, 0), b = iso(x + w, y + h, 0), d = iso(x + w, y, 0);
    const at = iso(x, y + h, alto), bt = iso(x + w, y + h, alto), dt = iso(x + w, y, alto), ct = iso(x, y, alto);
    return `<polygon points="${P([a, b, bt, at])}" fill="${c[1]}"/><polygon points="${P([b, d, dt, bt])}" fill="${c[2]}"/><polygon points="${P([ct, dt, bt, at])}" fill="${c[0]}"/>`;
  }
  const MADERA = ['#8f7a60', '#6f5e49', '#5e4f3d'], GRIS = ['#8a8994', '#66656f', '#55545d'], NEGRO = ['#3a3a42', '#2b2b31', '#232328'];

  function luzEstado(cx, cy, estado) {
    const c = COLOR[estado] || COLOR.gris;
    return `<circle cx="${cx}" cy="${cy}" r="9" fill="${c}" opacity=".28" filter="url(#brillo)"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="${c}"/>`;
  }
  // Las etiquetas NO se dibujan donde se piden: se apuntan y al final se acomodan encima de todo, probando lugares
  // (abajo, arriba, a los lados) hasta que no choquen con otra etiqueta ni con un monito. Si no caben, no se ponen
  // (el nombre sigue en el panel al tocar).
  let ETQ = [], CUERPOS = [];
  function etiqueta(cx, cy, texto, extra, opciones) {
    ETQ.push({ cx, cy, texto: String(texto), clase: extra || '', opciones: opciones || [[0, 0]], propio: CUERPOS.length - 1 });
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
        svg += `<g class="nom${e.clase ? ' ' + e.clase : ''}"><rect x="${x - ancho / 2}" y="${y - alto / 2}" width="${ancho}" height="${alto}" rx="9" fill="#16161ad9"/><text x="${x}" y="${y + 4.2}" text-anchor="middle" font-size="12" font-weight="800" fill="#f3f2ee">${esc(e.texto)}</text></g>`;
        return;
      }
    });
    return svg;
  }
  // Monito (persona o asistente): sombra, cuerpo, cabeza, pelo; acostado con ojos de tache en el cuarto gris.
  function monito(x, y, o) {
    const [sx, sy] = iso(x, y, 0);
    const piel = o.piel || '#e8bf98', ropa = o.ropa || '#5b7bd6', pelo = o.pelo || '#2b2420';
    let cuerpo;
    if (o.acostado) {
      cuerpo = `<g transform="translate(${sx},${sy - 6}) scale(${ESC})"><ellipse cx="0" cy="8" rx="26" ry="7" fill="#0006"/>
        <rect x="-22" y="-8" width="30" height="16" rx="8" fill="${ropa}" opacity=".75"/>
        <circle cx="16" cy="-1" r="11" fill="${piel}" opacity=".85"/>
        <path d="M11,-5 l4,4 m0,-4 l-4,4 M18,-5 l4,4 m0,-4 l-4,4" stroke="#222" stroke-width="1.6"/></g>`;
    } else {
      const s = o.sentado ? -6 : 0;
      cuerpo = `<g transform="translate(${sx},${sy}) scale(${ESC})"><ellipse cx="0" cy="2" rx="13" ry="5" fill="#0006"/>
        <rect x="-10" y="${-26 - s}" width="20" height="${24 + s}" rx="9" fill="${ropa}"/>
        <circle cx="0" cy="${-35 - s}" r="11" fill="${piel}"/>
        <path d="M-11,${-37 - s} a11,11 0 0 1 22,0 q-11,-6 -22,0z" fill="${pelo}"/>
        <circle cx="-4" cy="${-34 - s}" r="1.5" fill="#1d1d1d"/><circle cx="4" cy="${-34 - s}" r="1.5" fill="#1d1d1d"/>
        ${o.diadema ? `<path d="M-12,${-38 - s} a12,12 0 0 1 24,0" fill="none" stroke="#222" stroke-width="2.5"/><circle cx="-12" cy="${-34 - s}" r="3" fill="#222"/>` : ''}</g>`;
    }
    const alto = (o.acostado ? 18 : 46 - (o.sentado ? 6 : 0)) * ESC;
    if (o.acostado) cuerpoRect(sx, sy, 56 * ESC, 22 * ESC); else cuerpoRect(sx, sy, 26 * ESC, alto + 18);
    if (o.nombre) etiqueta(sx, sy + 16, o.nombre, '', [[0, 0], [0, -alto - 40], [44, -alto / 2], [-44, -alto / 2], [0, 22]]);
    return `<g class="mono-3d" data-a="${esc(o.id || '')}"${o.cuarto ? ` data-c="${o.cuarto}"` : ''}>${cuerpo}
      ${o.estado ? luzEstado(sx, sy - alto - 10, o.estado) : ''}</g>`;
  }
  // Claude: robot chiquito todo naranja (no es la mascota de Claude Code).
  function robotNaranja(x, y, texto) {
    const [sx, sy] = iso(x, y, 0);
    cuerpoRect(sx, sy, 26 * ESC, 52 * ESC);
    if (texto) { const corto = texto.length > 46 ? texto.slice(0, 44).replace(/\s+\S*$/, '') + '…' : texto; etiqueta(sx, sy + 16, '🤖 ' + corto, 'nom-claude', [[0, 0], [0, -80], [0, 22]]); }
    return `<g class="claude-3d" data-a="claude"><g transform="translate(${sx},${sy}) scale(${ESC})"><ellipse cx="0" cy="2" rx="12" ry="4.5" fill="#0006"/>
      <rect x="-9" y="-20" width="18" height="18" rx="4" fill="#ff7a1a"/><rect x="-11" y="-38" width="22" height="17" rx="6" fill="#ff8c33"/>
      <rect x="-7" y="-33" width="14" height="7" rx="3.5" fill="#3a1d07"/><circle cx="-3" cy="-29.5" r="1.6" fill="#ffd2a8"/><circle cx="3" cy="-29.5" r="1.6" fill="#ffd2a8"/>
      <line x1="0" y1="-38" x2="0" y2="-45" stroke="#ff7a1a" stroke-width="2"/><circle cx="0" cy="-46" r="2.6" fill="#ffb26b"/></g>
      </g>`;
  }
  // Robot con ruedas (una tarea automática) en su estación.
  function robotRuedas(x, y, t, i) {
    const [sx, sy] = iso(x, y, 0), mal = t.resultado !== 'bien';
    return `<g class="mono-3d" data-c="robots"><g transform="translate(${sx},${sy}) scale(${ESC})"><ellipse cx="0" cy="2" rx="13" ry="5" fill="#0006"/>
      <circle cx="-7" cy="-2" r="4" fill="#222"/><circle cx="7" cy="-2" r="4" fill="#222"/>
      <rect x="-11" y="-22" width="22" height="18" rx="5" fill="#9b9aa5"/><path d="M-9,-22 a9,9 0 0 1 18,0z" fill="#b9b8c2"/>
      <rect x="-6" y="-17" width="12" height="5" rx="2.5" fill="#2b2b31"/></g>
      ${luzEstado(sx, sy - 38 * ESC, mal ? 'rojo' : 'verde')}${(cuerpoRect(sx, sy, 26 * ESC, 48 * ESC), etiqueta(sx, sy + 16, 'Robot ' + (i + 1), 'nom-robot', [[0, 0], [0, -72]]))}</g>`;
  }
  function telarana(x, y) {
    const [sx, sy] = iso(x, y, MURO - 4);
    return `<g stroke="#bdbdc6" stroke-width=".8" opacity=".55" fill="none"><path d="M${sx},${sy} l26,12 M${sx},${sy} l0,26 M${sx},${sy} l18,22"/>
      <path d="M${sx + 8},${sy + 4} q2,6 0,8 M${sx + 15},${sy + 7} q3,9 0,14 M${sx + 21},${sy + 10} q4,10 -1,16"/></g>`;
  }
  function arana(x, y) {
    const [sx, sy] = iso(x, y, 0);
    return `<g transform="translate(${sx},${sy})" fill="#111"><circle r="2.2"/><path d="M-5,-2 l10,4 M-5,2 l10,-4 M-5,0 h10" stroke="#111" stroke-width=".8"/></g>`;
  }

  // ---------- el dibujo completo ----------
  function dibuja(O, C, sel, hora) {
    const [lc, lo] = LUZ[luzDe(hora)];
    ETQ = []; CUERPOS = [];
    const as = (O.asistentes && O.asistentes.lista) || [];
    const R = id => CUARTOS.find(c => c.id === id);
    let fondo = '', cosas = [];   // cosas: [profundidad, svg]
    const pon = (x, y, svg) => cosas.push([x + y, svg]);

    // Pisos y muros (de atrás hacia adelante)
    CUARTOS.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(c => {
      const a = iso(c.x, c.y), b = iso(c.x + c.w, c.y), d = iso(c.x + c.w, c.y + c.h), e = iso(c.x, c.y + c.h);
      const at = iso(c.x, c.y, MURO), bt = iso(c.x + c.w, c.y, MURO), et = iso(c.x, c.y + c.h, MURO);
      const elegido = sel && sel.cuarto === c.id;
      fondo += `<g class="cuarto" data-c="${c.id}">
        <polygon points="${P([a, b, d, e])}" fill="${c.piso}"/>
        <polygon points="${P([a, b, d, e])}" fill="url(#piso)" opacity=".5"/>
        <polygon points="${P([a, b, bt, at])}" fill="#64626c"/><polygon points="${P([a, e, et, at])}" fill="#57555f"/>
        <polyline points="${P([et, at, bt])}" fill="none" stroke="#7d7b86" stroke-width="2"/>
        <polygon points="${P([a, b, d, e])}" fill="${lc}" opacity="${lo}"/><polygon points="${P([e, a, b, bt, at, et])}" fill="${lc}" opacity="${lo * 0.8}"/>
        ${elegido ? `<polygon points="${P([a, b, d, e])}" fill="none" stroke="#f3f2ee" stroke-width="3"/>` : ''}
        ${etiqueta(...iso(c.x + c.w / 2, c.y + c.h - 0.55), c.n, 'nom-cuarto', [[0, 0], [0, -26], [-40, -12], [40, -12]])}</g>`;
    });

    // Recepción: Jason detrás del escritorio con su teléfono (brilla si hubo llamada en la última hora)
    const ll = (C && C.llamadas) || [], reciente = ll.some(l => Date.now() - Date.parse(l.fecha) < 3600e3);
    const jason = as.find(a => a.id === 'jason');
    pon(2, 2.2, caja(1.2, 2.6, 3, 1, 22, MADERA));
    pon(2.6, 2.4, `<g>${(() => { const [px, py] = iso(3.6, 3, 22); return `<rect x="${px - 6}" y="${py - 10}" width="12" height="8" rx="2" fill="#222"/>${reciente ? `<circle cx="${px}" cy="${py - 6}" r="12" fill="#3ccf7a" opacity=".35" filter="url(#brillo)"/>` : ''}`; })()}</g>`);
    if (jason) pon(2.3, 1.6, monito(2.3, 1.6, { id: 'jason', cuarto: 'recepcion', nombre: 'Jason', estado: jason.estado, ropa: '#2f3b55', pelo: '#3a2a1f', diadema: true, sentado: true }));

    // Clientes que pagan: cada uno en su escritorio con pantalla; Claude, el robot naranja, va hacia lo último que tocó
    const clientes = as.filter(a => a.tipo === 'cliente');
    clientes.forEach((a, i) => {
      const x = 9 + i * 4, y = 2.6;
      pon(x, y - 0.8, caja(x - 1, y - 1.6, 2.4, 1, 22, MADERA) + caja(x - 0.3, y - 1.5, 1, 0.2, 40, NEGRO));
      pon(x, y, monito(x, y, { id: a.id, cuarto: 'clientes', nombre: a.nombre, estado: a.estado, ropa: ['#c45a7a', '#3f7d6a', '#7a5ac4'][i % 3], sentado: true }));
    });
    const ult = O.actividad && O.actividad.lineas && O.actividad.lineas[0];
    pon(11, 6, robotNaranja(11, 6, ult && ult.texto));

    // Demos
    as.filter(a => a.tipo === 'demo').forEach((a, i) => {
      const x = 19.6 + (i % 3) * 2.4, y = 2.2 + Math.floor(i / 3) * 2.6;
      pon(x, y, monito(x, y, { id: a.id, cuarto: 'demos', nombre: a.nombre, estado: a.estado, ropa: ['#5a7ac4', '#b0864a', '#4a9aa0'][i % 3] }));
    });

    // Equipo: tres cubículos; si están en su horario, sentados; si no, la silla vacía
    const ROPA = { kid: '#2c2c34', daniel: '#40506e', dan: '#6e4a40' };
    (O.cubiculos || []).forEach((u, i) => {
      const x = 2.4, y = 7.8 + i * 2;
      pon(x - 0.5, y - 0.5, caja(x - 1.6, y - 0.6, 2.6, 0.9, 22, MADERA));
      if (u.presente) pon(x + 1.2, y, monito(x + 1.2, y, { id: 'equipo-' + u.id, cuarto: 'cubiculos', nombre: ({ kid: 'Kid', daniel: 'Papá', dan: 'Dan' })[u.id], ropa: ROPA[u.id], sentado: true }));
      else pon(x + 1.2, y, `<g data-c="cubiculos">${caja(x + 0.9, y - 0.3, 0.6, 0.6, 14, NEGRO)}${etiqueta(...iso(x + 1.2, y, -16), ({ kid: 'Kid', daniel: 'Papá', dan: 'Dan' })[u.id] + ' · fuera')}</g>`);
    });

    // Robots: uno por tarea automática, en fila en su estación
    ((O.tareas && O.tareas.lista) || []).forEach((t, i) => { const x = 19.6 + (i % 3) * 2.4, y = 8.6 + Math.floor(i / 3) * 2; pon(x, y, robotRuedas(x, y, t, i)); });

    // CRM: archiveros; Librería: libreros y mesa de lectura
    pon(8, 10, caja(7.4, 9.4, 1.2, 0.8, 38, GRIS) + caja(8.8, 9.4, 1.2, 0.8, 38, GRIS));
    pon(10, 12, caja(8.8, 11.6, 2, 1.2, 20, MADERA));
    ['#7a5a3a', '#4a6a8a', '#8a4a4a', '#5a7a4a'].forEach((col, i) => pon(12.6 + i * 0.95, 9.4, caja(12.3 + i * 0.95, 9.3, 0.8, 0.6, 46, [col, '#3d3127', '#31281f'])));
    pon(14.5, 12, caja(13.6, 11.6, 2, 1.2, 20, MADERA));
    // Crear tu recepcionista: banco de trabajo con un "+"
    pon(3, 16, caja(1.6, 15.4, 3, 1.2, 22, MADERA) + (() => { const [px, py] = iso(3.1, 16, 26); return `<text x="${px}" y="${py}" text-anchor="middle" font-size="22" font-weight="900" fill="#f3f2ee" opacity=".85">+</text>`; })());

    // Cuarto gris: los que dijeron que no, en el piso con ojos de tache, telarañas y arañitas
    as.filter(a => a.tipo === 'dijo_no' || a.tipo === 'archivado' || a.id === 'donde').forEach((a, i) => {
      const x = 8.6 + i * 3, y = 17;
      pon(x, y, monito(x, y, { id: a.id, cuarto: 'gris', nombre: a.nombre, acostado: true, ropa: '#6b6b73', piel: '#a9a9b0' }));
    });
    fondo += telarana(7.05, 15.05) + telarana(16.4, 15.05);
    [[9.5, 15.8], [13.2, 18.3], [15.8, 16.4]].forEach(([x, y]) => pon(x, y, arana(x, y)));

    // Archivo (puerta cerrada): una puerta con candado
    const [qx, qy] = iso(22, 13, 0);
    fondo += `<g data-c="cerrado"><polygon points="${P([iso(21.2, 13, 0), iso(22.8, 13, 0), iso(22.8, 13, 38), iso(21.2, 13, 38)])}" fill="#2a2a2f" stroke="#77757f"/><circle cx="${qx + 6}" cy="${qy - 18}" r="3" fill="#c9a64a"/></g>`;
    const nPruebas = as.filter(a => ['prueba', 'base', 'copia'].includes(a.tipo) && a.id !== 'donde').length;
    pon(22, 16, etiqueta(...iso(22, 16), nPruebas + ' guardados'));

    cosas.sort((a, b) => a[0] - b[0]);
    return {
      ancho: W, alto: H, monito: MONO,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
        <defs><filter id="brillo" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter>
          <linearGradient id="piso" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
        ${fondo}${cosas.map(c => c[1]).join('')}${acomodar()}
      </svg>`,
    };
  }
  window.Piel = { dibuja, MONO, luzDe };
})();
