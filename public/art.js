// Arte procedural de las cartas: cada id genera siempre la misma ilustración.
// Si existe public/art/<id>.png (o .jpg/.webp) se usa esa imagen en su lugar.
(function () {
  function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hsl = (h, s, l) => `hsl(${h | 0} ${s}% ${l}%)`;

  const ESCENAS = {
    noche:     { top: "#070b26", bot: "#2a3580", mont: "#0d1240", astro: "#f4f6ff", estrellas: true },
    atardecer: { top: "#3d1240", bot: "#f39c4a", mont: "#2a1430", astro: "#ffe08a" },
    volcan:    { top: "#140606", bot: "#b8321f", mont: "#2c0b0b", astro: "#ffb347", brasas: true },
    hielo:     { top: "#163f63", bot: "#cfe6f7", mont: "#eaf3fa", astro: "#ffffff", estrellas: true, nieve: true },
    bosque:    { top: "#082e18", bot: "#6dc595", mont: "#0f4a28", astro: "#f9f3c4" },
    tormenta:  { top: "#10161d", bot: "#4f5f70", mont: "#1b2732", astro: "#dfe7ef", rayos: true },
    abismo:    { top: "#02141c", bot: "#0f6b80", mont: "#063341", astro: "#bdf6ff", burbujas: true },
  };

  function fondo(R, esc, W, H, id) {
    const e = ESCENAS[esc];
    let s = `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.top}"/><stop offset="1" stop-color="${e.bot}"/></linearGradient>
      <radialGradient id="h${id}"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g${id})"/>`;
    if (e.estrellas) for (let i = 0; i < 30; i++) s += `<circle cx="${R() * W}" cy="${R() * H * .55}" r="${R() * .7 + .2}" fill="#fff" opacity="${.4 + R() * .6}"/>`;
    const ax = W * (.12 + R() * .25), ay = H * (.18 + R() * .15);
    s += `<circle cx="${ax}" cy="${ay}" r="${H * .2}" fill="url(#h${id})"/><circle cx="${ax}" cy="${ay}" r="${H * .085}" fill="${e.astro}"/>`;
    for (let capa = 0; capa < 2; capa++) {
      let d = `M0 ${H} `, x = 0;
      const base = capa ? .78 : .62;
      while (x < W) { const x2 = x + W * (.12 + R() * .2); d += `L${(x + x2) / 2} ${H * (base - .12 - R() * .18)} L${x2} ${H * (base + R() * .06)} `; x = x2; }
      d += `L${W} ${H} Z`;
      s += `<path d="${d}" fill="${e.mont}" opacity="${capa ? 1 : .55}"/>`;
    }
    if (e.nieve) for (let i = 0; i < 25; i++) s += `<circle cx="${R() * W}" cy="${R() * H}" r="${R() * .9 + .3}" fill="#fff" opacity=".8"/>`;
    if (e.brasas) for (let i = 0; i < 18; i++) s += `<circle cx="${R() * W}" cy="${H * .45 + R() * H * .55}" r="${R() * 1.1 + .3}" fill="#ffb03b"/>`;
    if (e.burbujas) for (let i = 0; i < 14; i++) s += `<circle cx="${R() * W}" cy="${R() * H}" r="${R() * 2 + .6}" fill="none" stroke="#bdf6ff" stroke-width=".5" opacity=".7"/>`;
    if (e.rayos) { const x0 = W * (.55 + R() * .35); s += `<path d="M${x0} 0 L${x0 - 6} ${H * .25} L${x0 + 2} ${H * .25} L${x0 - 7} ${H * .55}" stroke="#fff6a8" stroke-width="1.6" fill="none"/>`; }
    return s;
  }

  // Dragón adulto (mirando a la derecha). cx,cy centro; k escala.
  function dragon(R, cx, cy, k, col, osc, opts = {}) {
    const g = (x, y) => `${(cx + x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}`;
    const alaAlta = R() < .5;
    const wy = alaAlta ? -26 : -20;
    let s = `<g stroke="${osc}" stroke-width="${.9}" stroke-linejoin="round">`;
    // ala trasera
    s += `<path d="M${g(-2, -4)} L${g(-14, wy - 6)} L${g(-20, wy + 4)} L${g(-26, wy - 1)} L${g(-28, wy + 10)} L${g(-34, wy + 8)} L${g(-18, 2)} Z" fill="${osc}" opacity=".85"/>`;
    // cola
    s += `<path d="M${g(-10, 6)} C${g(-24, 10)} ${g(-30, 0)} ${g(-38, 6)} L${g(-44, 2)} L${g(-41, 10)} C${g(-32, 14)} ${g(-24, 18)} ${g(-8, 12)} Z" fill="${col}"/>`;
    // cuerpo
    s += `<ellipse cx="${cx}" cy="${cy + 6 * k}" rx="${15 * k}" ry="${9 * k}" fill="${col}"/>`;
    // vientre
    s += `<ellipse cx="${cx + 2 * k}" cy="${cy + 9 * k}" rx="${10 * k}" ry="${4.5 * k}" fill="#fff" opacity=".25" stroke="none"/>`;
    // patas
    s += `<path d="M${g(-8, 12)} L${g(-9, 22)} L${g(-4, 22)} L${g(-3, 13)} Z" fill="${col}"/><path d="M${g(6, 12)} L${g(6, 22)} L${g(11, 22)} L${g(10, 12)} Z" fill="${col}"/>`;
    // cuello y cabeza
    s += `<path d="M${g(8, 2)} C${g(14, -4)} ${g(14, -12)} ${g(18, -16)} L${g(24, -12)} C${g(20, -6)} ${g(18, 2)} ${g(14, 8)} Z" fill="${col}"/>`;
    s += `<path d="M${g(15, -20)} C${g(22, -24)} ${g(30, -20)} ${g(34, -15)} L${g(33, -11)} C${g(28, -10)} ${g(22, -9)} ${g(17, -11)} Z" fill="${col}"/>`;
    // cuernos
    s += `<path d="M${g(18, -20)} L${g(13, -29)} L${g(21, -21)} Z" fill="#f5e6c8"/><path d="M${g(22, -21)} L${g(20, -31)} L${g(25, -21)} Z" fill="#f5e6c8"/>`;
    // púas del lomo
    for (let i = 0; i < 4; i++) s += `<path d="M${g(-8 + i * 5, -2 + i * .2)} L${g(-6 + i * 5, -7)} L${g(-4 + i * 5, -2)} Z" fill="${osc}"/>`;
    // ala delantera
    s += `<path d="M${g(2, -2)} L${g(-6, wy - 10)} L${g(-10, wy)} L${g(-16, wy - 4)} L${g(-17, wy + 7)} L${g(-24, wy + 6)} L${g(-6, 4)} Z" fill="${col}" />`;
    s += `<path d="M${g(-6, wy - 10)} L${g(-3, 1)} M${g(-16, wy - 4)} L${g(-4, 2)}" stroke="${osc}" stroke-width=".7" fill="none"/>`;
    s += `</g>`;
    // ojo
    s += `<circle cx="${cx + 27 * k}" cy="${cy - 16 * k}" r="${1.6 * k}" fill="${opts.ojo || "#ffe066"}"/><circle cx="${cx + 27.5 * k}" cy="${cy - 16 * k}" r="${.7 * k}" fill="#111"/>`;
    if (opts.fuego) {
      const fx = cx + 34 * k, fy = cy - 13 * k;
      s += `<path d="M${fx} ${fy} C${fx + 8 * k} ${fy - 6 * k} ${fx + 14 * k} ${fy - 2 * k} ${fx + 22 * k} ${fy - 7 * k} C${fx + 18 * k} ${fy + 2 * k} ${fx + 14 * k} ${fy + 6 * k} ${fx} ${fy + 2 * k} Z" fill="#ffb02e" opacity=".95"/>`;
      s += `<path d="M${fx} ${fy} C${fx + 6 * k} ${fy - 3 * k} ${fx + 10 * k} ${fy - 1 * k} ${fx + 15 * k} ${fy - 3 * k} C${fx + 11 * k} ${fy + 2 * k} ${fx + 7 * k} ${fy + 3 * k} ${fx} ${fy + 1 * k} Z" fill="#fff4b0"/>`;
    }
    if (opts.corona) s += `<path d="M${g(15, -23)} L${g(16, -29)} L${g(19, -25)} L${g(21, -30)} L${g(23, -25)} L${g(26, -29)} L${g(26, -22)} Z" fill="#ffd34d" stroke="#a8730f" stroke-width=".6"/>`;
    return s;
  }

  function cria(R, cx, cy, k, col, osc) {
    let s = `<g stroke="${osc}" stroke-width=".9">`;
    s += `<path d="M${cx - 12 * k} ${cy + 8 * k} C${cx - 26 * k} ${cy + 10 * k} ${cx - 26 * k} ${cy} ${cx - 30 * k} ${cy + 4 * k} C${cx - 26 * k} ${cy + 14 * k} ${cx - 16 * k} ${cy + 16 * k} ${cx - 8 * k} ${cy + 14 * k} Z" fill="${col}"/>`;
    s += `<path d="M${cx - 6 * k} ${cy - 2 * k} L${cx - 20 * k} ${cy - 16 * k} L${cx - 18 * k} ${cy - 4 * k} L${cx - 24 * k} ${cy - 6 * k} L${cx - 12 * k} ${cy + 6 * k} Z" fill="${osc}" opacity=".8"/>`;
    s += `<ellipse cx="${cx}" cy="${cy + 8 * k}" rx="${14 * k}" ry="${11 * k}" fill="${col}"/>`;
    s += `<ellipse cx="${cx}" cy="${cy + 12 * k}" rx="${8 * k}" ry="${6 * k}" fill="#fff" opacity=".3" stroke="none"/>`;
    s += `<circle cx="${cx + 6 * k}" cy="${cy - 9 * k}" r="${12 * k}" fill="${col}"/>`;
    s += `<path d="M${cx} ${cy - 19 * k} L${cx - 3 * k} ${cy - 27 * k} L${cx + 4 * k} ${cy - 20 * k} Z M${cx + 10 * k} ${cy - 20 * k} L${cx + 12 * k} ${cy - 28 * k} L${cx + 15 * k} ${cy - 18 * k} Z" fill="#f5e6c8"/>`;
    s += `</g>`;
    s += `<circle cx="${cx + 3 * k}" cy="${cy - 10 * k}" r="${3.2 * k}" fill="#fff"/><circle cx="${cx + 12 * k}" cy="${cy - 10 * k}" r="${3.2 * k}" fill="#fff"/>`;
    s += `<circle cx="${cx + 3.8 * k}" cy="${cy - 9.6 * k}" r="${1.8 * k}" fill="#1a1a1a"/><circle cx="${cx + 12.8 * k}" cy="${cy - 9.6 * k}" r="${1.8 * k}" fill="#1a1a1a"/>`;
    s += `<path d="M${cx + 5 * k} ${cy - 3 * k} Q${cx + 8 * k} ${cy - 1 * k} ${cx + 11 * k} ${cy - 3 * k}" stroke="#1a1a1a" stroke-width="${.8 * k}" fill="none"/>`;
    s += `<circle cx="${cx} " cy="${cy - 5 * k}" r="${1.8 * k}" fill="#ff8fa3" opacity=".7"/><circle cx="${cx + 15 * k}" cy="${cy - 5 * k}" r="${1.8 * k}" fill="#ff8fa3" opacity=".7"/>`;
    return s;
  }

  function leviatan(R, cx, cy, k, col, osc) {
    let s = `<g stroke="${osc}" stroke-width=".9">`;
    s += `<path d="M${cx - 40 * k} ${cy + 10 * k} C${cx - 30 * k} ${cy - 10 * k} ${cx - 18 * k} ${cy - 10 * k} ${cx - 10 * k} ${cy + 8 * k} C${cx - 4 * k} ${cy + 20 * k} ${cx + 6 * k} ${cy + 20 * k} ${cx + 10 * k} ${cy} C${cx + 12 * k} ${cy - 12 * k} ${cx + 18 * k} ${cy - 20 * k} ${cx + 26 * k} ${cy - 18 * k}
      L${cx + 36 * k} ${cy - 14 * k} L${cx + 26 * k} ${cy - 10 * k} C${cx + 20 * k} ${cy - 10 * k} ${cx + 18 * k} ${cy} ${cx + 16 * k} ${cy + 6 * k} C${cx + 10 * k} ${cy + 28 * k} ${cx - 10 * k} ${cy + 28 * k} ${cx - 16 * k} ${cy + 10 * k} C${cx - 22 * k} ${cy - 2 * k} ${cx - 30 * k} ${cy} ${cx - 34 * k} ${cy + 12 * k} Z" fill="${col}"/>`;
    s += `<path d="M${cx + 22 * k} ${cy - 18 * k} L${cx + 30 * k} ${cy - 34 * k} L${cx + 26 * k} ${cy - 17 * k} Z" fill="#f5e6c8"/></g>`;
    s += `<circle cx="${cx + 27 * k}" cy="${cy - 15 * k}" r="${1.4 * k}" fill="#ffe066"/>`;
    s += `<path d="M0 ${cy + 16 * k} Q12 ${cy + 12 * k} 24 ${cy + 16 * k} T48 ${cy + 16 * k} T72 ${cy + 16 * k} T96 ${cy + 16 * k} T120 ${cy + 16 * k} V200 H0 Z" fill="#0b5f7a" opacity=".75"/>`;
    return s;
  }

  function simbolo(tipo, R, W, H, id) {
    const cx = W / 2, cy = H / 2 + 2;
    if (tipo === "hechizo") {
      const hue = 20 + R() * 300;
      let s = `<circle cx="${cx}" cy="${cy}" r="${H * .36}" fill="${hsl(hue, 90, 60)}" opacity=".25"/>`;
      for (let i = 0; i < 3; i++) s += `<circle cx="${cx}" cy="${cy}" r="${H * (.18 + i * .07)}" fill="none" stroke="${hsl(hue + i * 25, 95, 70)}" stroke-width="1.2" stroke-dasharray="${3 + i * 2} ${2 + i}" opacity=".9"/>`;
      s += `<path d="M${cx} ${cy + 16} C${cx + 13} ${cy + 15} ${cx + 12} ${cy} ${cx + 4} ${cy - 5} C${cx + 6} ${cy - 12} ${cx + 1} ${cy - 16} ${cx} ${cy - 20} C${cx - 3} ${cy - 11} ${cx - 12} ${cy - 6} ${cx - 10} ${cy + 4} C${cx - 9} ${cy + 12} ${cx - 5} ${cy + 16} ${cx} ${cy + 16} Z" fill="${hsl(hue, 95, 58)}"/>`;
      s += `<path d="M${cx} ${cy + 13} C${cx + 6} ${cy + 12} ${cx + 6} ${cy + 4} ${cx + 1} ${cy} C${cx} ${cy + 4} ${cx - 6} ${cy + 5} ${cx - 4} ${cy + 10} Z" fill="#fff6c8"/>`;
      for (let i = 0; i < 10; i++) s += `<path d="M${R() * W} ${R() * H} l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 Z" fill="#fff" opacity="${.4 + R() * .6}"/>`;
      return s;
    }
    if (tipo === "reliquia") {
      const v = Math.floor(R() * 3), hue = 35 + R() * 200;
      let s = `<circle cx="${cx}" cy="${cy}" r="${H * .38}" fill="#ffe9a8" opacity=".25"/>`;
      if (v === 0) s += `<path d="M${cx - 18} ${cy - 4} L${cx - 10} ${cy - 14} L${cx + 10} ${cy - 14} L${cx + 18} ${cy - 4} L${cx} ${cy + 20} Z" fill="${hsl(hue, 80, 55)}" stroke="#fff" stroke-width="1"/><path d="M${cx - 18} ${cy - 4} H${cx + 18} M${cx - 6} ${cy - 4} L${cx} ${cy + 20} L${cx + 6} ${cy - 4} M${cx - 10} ${cy - 14} L${cx - 6} ${cy - 4} M${cx + 10} ${cy - 14} L${cx + 6} ${cy - 4}" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/>`;
      if (v === 1) s += `<path d="M${cx - 22} ${cy + 10} L${cx - 22} ${cy - 10} L${cx - 11} ${cy} L${cx} ${cy - 16} L${cx + 11} ${cy} L${cx + 22} ${cy - 10} L${cx + 22} ${cy + 10} Z" fill="#ffcf3f" stroke="#a6720b" stroke-width="1.2"/><circle cx="${cx}" cy="${cy + 3}" r="4" fill="${hsl(hue, 85, 50)}"/><circle cx="${cx - 12}" cy="${cy + 5}" r="2.5" fill="${hsl(hue + 120, 85, 50)}"/><circle cx="${cx + 12}" cy="${cy + 5}" r="2.5" fill="${hsl(hue + 120, 85, 50)}"/>`;
      if (v === 2) s += `<path d="M${cx} ${cy - 20} L${cx + 18} ${cy - 13} L${cx + 15} ${cy + 6} C${cx + 12} ${cy + 14} ${cx + 6} ${cy + 18} ${cx} ${cy + 21} C${cx - 6} ${cy + 18} ${cx - 12} ${cy + 14} ${cx - 15} ${cy + 6} L${cx - 18} ${cy - 13} Z" fill="${hsl(hue, 60, 45)}" stroke="#ffd96b" stroke-width="2"/><path d="M${cx} ${cy - 12} L${cx} ${cy + 14} M${cx - 10} ${cy - 2} H${cx + 10}" stroke="#ffd96b" stroke-width="2"/>`;
      for (let i = 0; i < 8; i++) s += `<circle cx="${R() * W}" cy="${R() * H}" r="${R() * 1.2 + .4}" fill="#fff6c8"/>`;
      return s;
    }
    if (tipo === "maldicion") {
      const v = Math.floor(R() * 3);
      let s = `<circle cx="${cx}" cy="${cy}" r="${H * .38}" fill="#b04cff" opacity=".22"/>`;
      if (v === 0) s += `<circle cx="${cx}" cy="${cy - 3}" r="15" fill="#eee"/><rect x="${cx - 8}" y="${cy + 7}" width="16" height="9" rx="2" fill="#eee"/><circle cx="${cx - 6}" cy="${cy - 3}" r="4.5" fill="#2a0f3a"/><circle cx="${cx + 6}" cy="${cy - 3}" r="4.5" fill="#2a0f3a"/><circle cx="${cx - 6}" cy="${cy - 3}" r="1.5" fill="#d27bff"/><circle cx="${cx + 6}" cy="${cy - 3}" r="1.5" fill="#d27bff"/><path d="M${cx - 4} ${cy + 9} V${cy + 15} M${cx} ${cy + 9} V${cy + 15} M${cx + 4} ${cy + 9} V${cy + 15}" stroke="#2a0f3a" stroke-width="1"/>`;
      if (v === 1) s += `<path d="M${cx - 24} ${cy} Q${cx} ${cy - 22} ${cx + 24} ${cy} Q${cx} ${cy + 22} ${cx - 24} ${cy} Z" fill="#f1e6ff"/><circle cx="${cx}" cy="${cy}" r="9" fill="#7b1fa2"/><ellipse cx="${cx}" cy="${cy}" rx="2.5" ry="7" fill="#0d0010"/>`;
      if (v === 2) { for (let i = -2; i <= 2; i++) s += `<ellipse cx="${cx + i * 9}" cy="${cy + (i % 2) * 3}" rx="6" ry="4" fill="none" stroke="#9aa3ad" stroke-width="2.2"/>`; s += `<rect x="${cx - 8}" y="${cy + 6}" width="16" height="13" rx="2" fill="#6d4c41"/><circle cx="${cx}" cy="${cy + 12}" r="2" fill="#222"/>`; }
      for (let i = 0; i < 6; i++) s += `<path d="M${R() * W} ${H} q${3 - R() * 6} ${-10 - R() * 10} ${R() * 6 - 3} ${-20 - R() * 20}" stroke="#b04cff" stroke-width="1" fill="none" opacity=".5"/>`;
      return s;
    }
    if (tipo === "instantanea") {
      const sup = id.includes("supremo");
      let pts = ""; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = (i % 2 ? .22 : .42) * H; pts += `${cx + Math.cos(a) * r * 1.3},${cy + Math.sin(a) * r} `; }
      return `<polygon points="${pts}" fill="${sup ? "#ffd54a" : "#ff5a36"}" stroke="#fff" stroke-width="1.5"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${sup ? 13 : 16}" fill="#fff" stroke="#5a0d00" stroke-width="1.6" paint-order="stroke">${sup ? "¡¡GRRRR!!" : "¡GRRR!"}</text>`;
    }
    return "";
  }

  window.cardArt = function (d) {
    const W = 120, H = 80, R = rng(hash(d.id)), uid = (hash(d.id) % 1e6).toString(36);
    const titan = /tit[aá]n/i.test(d.nombre) || d.set === "t2";
    const lev = /leviat/i.test(d.nombre);
    const escenas = Object.keys(ESCENAS).filter(e => lev ? e === "abismo" : e !== "abismo");
    let esc = escenas[Math.floor(R() * escenas.length)];
    if (d.tipo === "maldicion") esc = R() < .5 ? "tormenta" : "noche";
    if (d.tipo === "instantanea") esc = "volcan";
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">` + fondo(R, esc, W, H, uid);
    const hue = R() * 360, col = hsl(hue, 70, 52), osc = hsl(hue, 60, 24);
    if (d.tipo === "cria") s += cria(R, 58, 44, 1.15, col, osc);
    else if (lev) s += leviatan(R, 60, 40, 1.05, col, osc);
    else if (d.tipo === "comun" || d.tipo === "ancestral") {
      s += `<ellipse cx="60" cy="72" rx="34" ry="4" fill="#000" opacity=".3"/>`;
      s += dragon(R, 54, 46, titan ? 1.12 : 1, col, osc, { fuego: d.tipo === "ancestral" && R() < .55, corona: /reina|rey|majest/i.test(d.nombre), ojo: d.tipo === "ancestral" ? "#7dffb0" : "#ffe066" });
    } else s += simbolo(d.tipo, R, W, H, d.id);
    return s + `</svg>`;
  };
})();
