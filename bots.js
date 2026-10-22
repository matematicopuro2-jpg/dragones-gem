// Dragones Inestables — Bots (modo solitario)
// Los bots deciden qué jugar, cuándo usar ¡GRRR! y responden a las elecciones del motor de efectos,
// según quién va ganando, quién los atacó (rencor), y algo de azar según la dificultad.
module.exports = function crearBots(K) {
  const { P, def, DRAGON, colocar, log, contarDragones, tieneTag, metaVictoria, shuffle } = K;
  const NIVELES = {
    facil:   { nombre: "Fácil",   ruido: 7,   azarRobar: .25, grrr: .3, foco: .3, ahorro: false },
    normal:  { nombre: "Normal",  ruido: 2.5, azarRobar: .06, grrr: .75, foco: 1, ahorro: false },
    dificil: { nombre: "Difícil", ruido: .8,  azarRobar: 0,   grrr: 1.1, foco: 1.8, ahorro: true },
  };
  const NOMBRES = ["Morgrath", "Sylvara", "Kaedrin", "Velkar", "Nyxara", "Thornak", "Ignivar", "Zerath", "Ashveil", "Draxos", "Umbrys", "Calyxa"];
  const R = () => Math.random();
  const VEL = +process.env.BOT_VEL || 1;   // >1 acelera (solo para pruebas)
  const esBot = p => !!(p && p.bot);
  const T = c => def(c).tipo;
  const esDragon = c => DRAGON.has(T(c));
  const tiene = (p, id) => p.stable.some(c => c.id === id);
  const bendito = p => tiene(p, "rel_bendicion_titan");
  const maldOk = (p, id) => tiene(p, id) && !bendito(p);            // maldición activa
  const rivales = (r, b) => r.players.filter(p => p !== b);
  const nombre = c => def(c).nombre;

  // ───────── valoraciones ─────────
  const VALOR_ANC = { anc_colosal: 9, anc_fenix: 8, anc_caballero: 7, anc_reina: 7, anc_perro: 2, anc_avaro: 7, anc_rinoceronte: 7, anc_fertil: 7 };
  function valor(c) { // cuánto vale una carta que está en una guarida (para su dueño)
    const t = T(c);
    if (t === "cria") return 3; if (t === "comun") return 4;
    if (t === "ancestral") return VALOR_ANC[c.id] || 6;
    if (t === "reliquia") return 4; if (t === "maldicion") return -5; return 1;
  }
  function valorMano(c) { const t = T(c); return { instantanea: 8, ancestral: 7, comun: 5, hechizo: 5, reliquia: 4, maldicion: 4, cria: 3 }[t] || 3; }
  function amenaza(r, p) { // 0..10: qué tan cerca está de ganar
    const m = metaVictoria(r), d = contarDragones(p);
    return Math.max(0, 10 - (m - d) * 2.2) + p.stable.filter(c => T(c) === "reliquia").length * .5;
  }
  function lider(r, excluir) { return rivales(r, excluir).reduce((a, p) => contarDragones(p) > contarDragones(a) ? p : a, rivales(r, excluir)[0]); }

  // ───────── rencor (memoria de ataques) ─────────
  function ofender(r, atacante, victima, n = 1) {
    if (!atacante || !victima || atacante === victima) return;
    r.rencor ??= {}; const k = victima.pid + ">" + atacante.pid; r.rencor[k] = (r.rencor[k] || 0) + n;
  }
  const rencor = (r, b, p) => (r.rencor || {})[b.pid + ">" + p.pid] || 0;

  // Elige a quién apuntar entre candidatos [{p, cards[]}] de forma orgánica
  function elegirVictima(r, b, cands) {
    cands = cands.filter(x => x.cards.length); if (!cands.length) return null;
    const N = NIVELES[b.bot.nivel];
    let mejor = null, ms = -1e9;
    for (const x of cands) {
      const s = 2 + amenaza(r, x.p) * N.foco + rencor(r, b, x.p) * 1.6 + R() * (N.ruido * 3 + 2) + (x.extra || 0);
      if (s > ms) { ms = s; mejor = x; }
    }
    return mejor;
  }
  function mejorCarta(b, cards) { // atacante elige qué carta atacar
    const N = NIVELES[b.bot.nivel];
    return [...cards].sort((x, y) => (valor(y) + R() * N.ruido) - (valor(x) + R() * N.ruido))[0];
  }
  function peorPropia(p, cards) { return [...cards].sort((x, y) => valor(x) - valor(y))[0]; }

  // ───────── responder elecciones del motor ─────────
  // req.tipo: carta | jugador | si ; req.proposito: atacar | perder | ganar | descartar | relmal | mover | objetivo | aliado | mano
  function elegirBot(r, p, req, porTiempo) {
    const nivel = (p.bot && p.bot.nivel) || "normal", N = NIVELES[nivel], ruido = () => R() * N.ruido;
    const bb = p.bot ? p : { ...p, bot: { nivel } };
    if (req.tipo === "si") return req.botSi ? !!req.botSi() : true;
    const ops = req.opciones, n = Math.min(ops.length, Math.max(req.min || 1, 1));
    if (req.opcional && porTiempo) return [];
    if (req.tipo === "jugador") {
      const jug = ops.map(o => P(r, o.pid));
      let sc;
      if (req.proposito === "aliado") sc = j => (j === p ? 100 : -amenaza(r, j) * N.foco) + ruido();
      else if (req.proposito === "mano") sc = j => j.hand.length * 2 + ruido();
      else sc = j => 2 + amenaza(r, j) * N.foco + rencor(r, bb, j) * 1.6 + R() * (N.ruido * 3 + 2);
      let mi = 0; jug.forEach((j, i) => { if (sc(j) > sc(jug[mi])) mi = i; });
      return [mi];
    }
    const puntaje = (o) => {
      const c = o.card, dueño = o.owner ? P(r, o.owner) : null;
      switch (req.proposito) {
        case "atacar": return valor(c) + (dueño ? amenaza(r, dueño) * N.foco * .6 + rencor(r, bb, dueño) : 0) + ruido();
        case "perder": return -valor(c) - (T(c) === "maldicion" ? 20 : 0) + R() * .3;
        case "descartar": return -valorMano(c) + R() * .3;
        case "ganar": return valor(c) + valorMano(c) + ruido() * .5;
        case "relmal": return dueño === p ? 15 : 4 + (dueño ? amenaza(r, dueño) : 0) + ruido();
        case "mover": return (T(c) === "maldicion" && dueño === p) ? 20 : (T(c) === "reliquia" && dueño !== p) ? 8 + ruido() : -5;
        default: return ruido();
      }
    };
    const orden = ops.map((o, i) => [puntaje(o), i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    if (req.opcional && req.proposito === "ganar" && puntaje(ops[orden[0]]) < 3) return [];
    return orden.slice(0, n);
  }

  // ───────── decidir qué jugar ─────────
  function utilHechizo(r, b, id) {
    const riv = rivales(r, b), l = lider(r, b), am = l ? amenaza(r, l) : 0;
    const dragonesAtacables = riv.some(p => p.stable.some(c => esDragon(c) && c.id !== "anc_perro" && !tiene(p, "rel_aura")));
    const mald = b.stable.some(c => T(c) === "maldicion"), relRiv = riv.some(p => p.stable.some(c => T(c) === "reliquia"));
    switch (id) {
      case "hec_veneno": case "hec_aliento_titan": return dragonesAtacables ? 5 + am * .5 : 0;
      case "hec_coz": return riv.some(p => p.stable.length > 1) ? 4 + am * .2 : 0;
      case "hec_suerte": return 5; case "hec_buen_trato": return 5; case "hec_beso_titan": return 4;
      case "hec_tornado": return mald ? 5 : 2.5;
      case "hec_cambio": return b.stable.some(esDragon) && riv.some(p => p.stable.some(c => valor(c) >= 6)) ? 5 : 0;
      case "hec_redirigir": return mald ? 7 : relRiv ? 4 : 0;
      case "hec_trato": return riv.some(p => p.hand.length > b.hand.length + 1) ? 4 : 0;
      case "hec_dosporuno": return (mald || b.stable.some(c => T(c) === "cria")) && riv.reduce((n, p) => n + p.stable.length, 0) >= 3 ? 6 : 0;
      case "hec_encoger": return riv.some(p => p.stable.filter(c => T(c) === "ancestral" || T(c) === "comun").length >= 3) && r.nursery.length >= 3 ? 7 : 0;
      case "hec_preciso": case "hec_fuego_titan": return mald ? 7 : relRiv ? 4 : 0;
      case "hec_vortice": return 2; case "hec_sacudon": return b.hand.length <= 2 ? 4 : 1;
      case "hec_robo": return riv.some(p => p.hand.length) ? 4 : 0;
      case "hec_reinicio": case "hec_guaridas_quemadas": { const mias = b.stable.filter(c => T(c) === "maldicion").length - b.stable.filter(c => T(c) === "reliquia").length; return mias > 0 ? 6 : relRiv && riv.filter(p => p.stable.some(c => T(c) === "reliquia")).length >= 2 ? 3 : 0; }
    }
    return 2;
  }
  function elegirJugada(r, b) {
    const N = NIVELES[b.bot.nivel], meta = metaVictoria(r), mios = contarDragones(b);
    if (R() < N.azarRobar) return null;
    let mejor = null;
    for (const c of b.hand) {
      const t = T(c); let v = -99, destino = b.pid;
      if (t === "instantanea" || K.puedeJugar(r, b, c, b.pid) && t !== "maldicion") continue;
      if (t === "cria" || t === "comun" || t === "ancestral") {
        const suma = def(c).tags.includes("doble") ? 2 : 1;
        v = (t === "ancestral" ? 6.5 : 5) + (mios + suma >= meta && !maldOk(b, "mal_gallinas") ? 100 : 0);
        if (c.id === "anc_tiburon") v -= 1;
      } else if (t === "hechizo") v = utilHechizo(r, b, c.id);
      else if (t === "reliquia") {
        v = 4.5 + (c.id === "rel_aura" || c.id === "rel_rugido" ? 1 : 0);
      } else if (t === "maldicion") {
        const vic = elegirVictima(r, b, rivales(r, b).map(p => ({ p, cards: [1], extra: c.id === "mal_gallinas" ? contarDragones(p) * 1.5 : 0 })));
        if (!vic) continue; destino = vic.p.pid; v = 3 + amenaza(r, vic.p) * .5;
      }
      v += (R() - .5) * 2 * N.ruido;
      if (!mejor || v > mejor.v) mejor = { c, v, destino };
    }
    return mejor && mejor.v >= 2.5 ? mejor : null;
  }

  // ───────── decidir ¡GRRR! ─────────
  function quiereGrrr(r, b, pe) {
    const N = NIVELES[b.bot.nivel], meta = metaVictoria(r);
    const c = pe.card, d = def(c), A = P(r, pe.by), dest = pe.destino ? P(r, pe.destino) : A;
    const cancelada = pe.chain.length % 2 === 1;
    let amen = 0;
    if (pe.by === b.pid) return cancelada ? (N.ahorro ? 1 : .7) : 0;          // defender mi propia carta
    if (cancelada) return 0;                                               // ya está detenida, no gasto
    if (DRAGON.has(d.tipo)) { const s = contarDragones(A) + (d.tags.includes("doble") ? 2 : 1); amen = s >= meta ? 10 : amenaza(r, A) * .5 + (d.tipo === "ancestral" ? 1.5 : 0); }
    else if (d.tipo === "maldicion") amen = dest === b ? 6 : 0.5;
    else if (d.tipo === "reliquia") amen = amenaza(r, A) > 6 ? 3 : 1;
    else if (d.tipo === "hechizo") { const ataque = ["hec_veneno", "hec_aliento_titan", "hec_encoger", "hec_cambio", "hec_robo", "hec_dosporuno", "hec_coz"].includes(d.id); amen = ataque ? 3 + (rencor(r, A, b) > 0 ? 1 : 0) + (contarDragones(b) >= contarDragones(lider(r, A) || b) ? 2 : 0) : 1.5; }
    const grrrs = b.hand.filter(x => def(x).tags.includes("grrr")).length;
    const fase = .35 + .65 * Math.min(1, Math.max(...r.players.map(contarDragones)) / meta);   // al inicio de la partida se guardan los GRRR
    if (amen < 10) amen *= fase;
    if (N.ahorro && grrrs <= 1 && amen < 5) amen *= .4;
    return Math.min(1, amen / 10 * N.grrr);
  }

  // ───────── bucle de los bots ─────────
  function tick(r) {
    if (!r.started || r.winner || !r.players.some(esBot)) return;
    if (r.ocupado || r.prompt) return;
    const ahora = Date.now();
    const pe = r.pending;
    if (pe) {
      const key = pe.chain.length, ultimo = key ? pe.chain[key - 1].pid : pe.by;
      if (key && def(pe.chain[key - 1].card).tags.includes("supremo")) return;
      pe.dec ??= {}; pe.decT ??= {};
      for (const b of r.players.filter(esBot)) {
        if (b.pid === ultimo || pe.dec[b.pid] === key) continue;
        const kk = b.pid + ":" + key;
        if (!pe.decT[kk]) { pe.decT[kk] = ahora + (700 + R() * 1800) / VEL; continue; }
        if (ahora < pe.decT[kk]) continue;
        pe.dec[b.pid] = key;
        const puede = !(tieneTag(b, "noInstant") || tiene(b, "anc_colosal")) || bendito(b);
        const carta = b.hand.find(x => def(x).tags.includes("grrr") && !def(x).tags.includes("supremo")) || b.hand.find(x => def(x).tags.includes("grrr"));
        if (puede && carta && R() < quiereGrrr(r, b, pe)) {
          b.hand.splice(b.hand.indexOf(carta), 1);
          ofender(r, b, P(r, ultimo));
          K.registrarGrrr(r, b, carta);
          return K.emitir(r);
        }
      }
      const pendientes = r.players.filter(p => p.pid !== ultimo && (esBot(p) ? pe.dec[p.pid] !== key : p.connected && !(pe.pasan && pe.pasan.get(p.pid) === key)));
      if (!pendientes.length) { K.resolverYa(r); K.emitir(r); }
      return;
    }
    const b = r.players[r.turn];
    if (!esBot(b)) return;
    if (!r.bt || r.bt.turno !== r.turnoN || r.bt.fase !== r.phase) r.bt = { turno: r.turnoN, fase: r.phase, t: ahora + 1100 / VEL };
    if (ahora < r.bt.t) return;
    r.bt.t = ahora + 1100 / VEL;
    if (r.phase === "accion") {
      const j = elegirJugada(r, b);
      if (j) {
        const d = def(j.c);
        if (d.tipo === "maldicion") ofender(r, b, P(r, j.destino));
        K.jugarCarta(r, b, j.c, d.tipo === "hechizo" ? null : j.destino);
      } else K.robarAccion(r, b);
      K.emitir(r);
    } else if (r.phase === "fin") { K.terminarTurno(r, b); }
  }

  function nuevoBot(r, nivel) {
    const usados = new Set(r.players.map(p => p.name));
    const n = NOMBRES.filter(x => !usados.has(x)); const name = n[Math.floor(R() * n.length)] || "Bot" + r.players.length;
    return { pid: "bot_" + Math.random().toString(36).slice(2, 9), name, hand: [], stable: [], connected: true, bot: { nivel: NIVELES[nivel] ? nivel : "normal" } };
  }

  return { tick, elegirBot, nuevoBot, esBot, NIVELES, ofender, valor, amenaza };
};
