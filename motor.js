// Dragones Inestables — Motor de reglas y efectos
// Aplica automáticamente los efectos de todas las cartas (humanos y bots).
// Cuando un efecto requiere una decisión, se la pide al jugador (ventana de elección) o al bot.
module.exports = function crearMotor(K) {
  const { P, def, DRAGON, colocar, log, contarDragones, tieneTag, shuffle } = K;
  const T = c => def(c).tipo;
  const nom = c => `«${def(c).nombre}»`;
  const esDragon = c => DRAGON.has(T(c));
  const tiene = (p, id) => p.stable.some(c => c.id === id);
  const bendito = p => tiene(p, "rel_bendicion_titan");
  const maldOk = (p, id) => tiene(p, id) && !bendito(p);
  const ciego = p => maldOk(p, "mal_ceguera");
  const rivales = (r, p) => r.players.filter(o => o !== p);
  const esBot = p => !!(p && p.bot);
  let NP = 0;

  // ═════════════ ELECCIONES ═════════════
  // req: { tipo: "carta"|"jugador"|"si", titulo, opciones, min, max, opcional, proposito, botSi }
  async function pedir(r, p, req) {
    const ops = req.opciones || [];
    req.min ??= 1; req.max ??= req.min;
    if (req.tipo !== "si") {
      if (!ops.length) return [];
      if (!req.opcional && ops.length <= req.min) return ops.map((_, i) => i);
    }
    if (esBot(p) || !p.connected || !p.sid) return K.elegirBot(r, p, req);
    const id = ++NP;
    return new Promise(resolve => {
      const fin = sel => { if (!r.prompt || r.prompt.id !== id) return; clearTimeout(r.prompt.timer); r.prompt = null; resolve(sel); };
      r.prompt = { id, pid: p.pid, req, fin,
        timer: setTimeout(() => { log(r, `⌛ ${p.name} tardó en elegir; se eligió automáticamente.`); fin(K.elegirBot(r, p, req, true)); }, 75000) };
      K.emitir(r);
    });
  }
  function responder(r, pid, id, sel) {
    const pr = r.prompt; if (!pr || pr.pid !== pid || pr.id !== id) return false;
    const req = pr.req;
    if (req.tipo === "si") return pr.fin(!!sel), true;
    sel = [...new Set((Array.isArray(sel) ? sel : []).map(Number).filter(i => i >= 0 && i < req.opciones.length))];
    if (!(req.opcional && sel.length === 0) && (sel.length < Math.min(req.min, req.opciones.length) || sel.length > req.max)) return false;
    pr.fin(sel); return true;
  }
  const vistaPrompt = (r, pid) => {
    const pr = r.prompt; if (!pr) return null;
    if (pr.pid !== pid) return { esperando: P(r, pr.pid)?.name, titulo: pr.req.titulo };
    const q = pr.req;
    return { id: pr.id, tipo: q.tipo, titulo: q.titulo, min: q.min, max: q.max, opcional: !!q.opcional,
      opciones: (q.opciones || []).map(o => o.card ? { card: o.card, owner: o.owner ? P(r, o.owner)?.name : null, zona: o.zona } : o.pid ? { pid: o.pid, name: P(r, o.pid)?.name } : { texto: o.texto }) };
  };
  const opCartas = (lista) => lista.map(([card, owner, zona]) => ({ card, owner: owner?.pid || null, zona }));
  async function elegirCartas(r, p, lista, titulo, proposito, { n = 1, opcional = false, max } = {}) {
    const opciones = opCartas(lista);
    const sel = await pedir(r, p, { tipo: "carta", titulo, opciones, min: n, max: max ?? n, opcional, proposito });
    return sel.map(i => lista[i]);
  }
  async function elegirJugador(r, p, jugadores, titulo, proposito = "objetivo", opcional = false) {
    const sel = await pedir(r, p, { tipo: "jugador", titulo, opciones: jugadores.map(j => ({ pid: j.pid })), min: 1, max: 1, opcional, proposito });
    return sel.length ? jugadores[sel[0]] : null;
  }
  const si = (r, p, titulo, botSi) => pedir(r, p, { tipo: "si", titulo, botSi });

  // ═════════════ PROTECCIONES Y MOVIMIENTOS ═════════════
  function protegido(r, c, dueño, fuente, { porHechizo, fuenteTitan, saqueo } = {}) {
    if (c.id === "anc_perro") return true;
    if (esDragon(c)) {
      if (!saqueo && tiene(dueño, "rel_aura")) return true;
      if (tiene(dueño, "rel_proteccion_titan") && fuente && fuente !== dueño) return true;
      if (!saqueo && c.id === "anc_gatito" && porHechizo) return true;
      if (!saqueo && fuenteTitan && tiene(dueño, "anc_cazatitanes")) return true;
    }
    if (saqueo && tiene(dueño, "rel_escudo") && esDragon(c)) return true;
    return false;
  }
  async function alambre(r, p, c) { if (esDragon(c) && maldOk(p, "mal_alambre") && p.hand.length) { log(r, `🩸 El Alambre de Púas hiere a ${p.name}.`); await descartar(r, p, 1); } }
  // Toda carta que ENTRA en una guarida (jugada, saqueada, intercambiada, rescatada…) activa su efecto de entrada
  async function ponerGuarida(r, p, c, efecto = true) {
    p.stable.push(c); await alambre(r, p, c);
    if (efecto && esDragon(c) && ENTRADA[c.id] && !ciego(p) && p.stable.includes(c)) {
      r.profEntrada = (r.profEntrada || 0) + 1;
      try { if (r.profEntrada <= 6) await ENTRADA[c.id](r, p, c); } finally { r.profEntrada--; }
    }
  }
  async function quitarGuarida(r, p, c, motivo) {
    const i = p.stable.indexOf(c); if (i < 0) return false;
    p.stable.splice(i, 1);
    if (c.vinculo && motivo === "encoge") delete c.vinculo;
    if (c.vinculo) { // Seductor / Leviatán Encantador: devuelve lo robado
      const robado = p.stable.find(x => x.uid === c.vinculo.uid), de = P(r, c.vinculo.de);
      if (robado && de) { p.stable.splice(p.stable.indexOf(robado), 1); de.stable.push(robado); log(r, `↩️ ${nom(robado)} vuelve a la guarida de ${de.name}.`); }
      delete c.vinculo;
    }
    await alambre(r, p, c);
    if (c.id === "anc_titan" && !ciego(p) && motivo !== "mano" && motivo !== "encoge") { log(r, `💀 Al salir el Dragón Titán, ${p.name} CALCINA un dragón.`); await calcinar(r, p, esDragon, { fuenteTitan: true }); }
    return true;
  }
  // Saca una carta de una guarida hacia las Cenizas (calcina/sacrifica) aplicando todas las reglas
  async function retirar(r, dueño, c, modo, fuente) {
    if (!dueño.stable.includes(c)) return false;
    if (modo === "calcina" && esDragon(c) && c.id !== "anc_caballero" && tiene(dueño, "anc_caballero") && !ciego(dueño)) {
      if (await si(r, dueño, `¿Sacrificar tu Caballero Negro para salvar a ${nom(c)}?`, () => K.valor(c) >= 6)) {
        const cab = dueño.stable.find(x => x.id === "anc_caballero"); log(r, `🛡️ El Caballero Negro de ${dueño.name} se sacrifica para salvar a ${nom(c)}.`);
        c = cab; modo = "sacrifica";
      }
    }
    await quitarGuarida(r, dueño, c, modo);
    if (def(c).tags.includes("regresa") && !ciego(dueño)) { dueño.hand.push(c); log(r, `↩️ ${nom(c)} vuelve a la mano de ${dueño.name}.`); }
    else if (c.id === "anc_fenix" && !ciego(dueño) && (dueño.hand.some(esDragon) || vac(r)) &&
      await si(r, dueño, dueño.hand.some(esDragon) ? "¿Descartar una carta de Dragón para que tu Fénix renazca?" : "No tienes dragones en la mano: ¿tu Fénix renace sin pagar nada (vacuidad)?", () => true)) {
      if (!dueño.hand.some(esDragon)) avisoVac(r, dueño, "Dragón Fénix");
      else { const [[d]] = await elegirCartas(r, dueño, dueño.hand.filter(esDragon).map(x => [x, dueño, "mano"]), "Elige el dragón que descartas para salvar al Fénix", "descartar");
        dueño.hand.splice(dueño.hand.indexOf(d), 1); colocar(r, d, "cenizas"); log(r, `🗑️ ${dueño.name} DESCARTA ${nom(d)}.`); }
      dueño.stable.push(c);
      log(r, `🔥 ¡El Dragón Fénix de ${dueño.name} renace de sus cenizas!`);
    } else colocar(r, c, "cenizas");
    if (fuente && fuente !== dueño) K.ofender(r, fuente, dueño, esDragon(c) ? 2 : 1);
    return true;
  }

  // ═════════════ PRIMITIVAS ═════════════
  async function calcinar(r, src, filtro, opt = {}) {
    let hechas = 0;
    for (let k = 0; k < (opt.n || 1); k++) {
      const lista = []; for (const o of rivales(r, src)) for (const c of o.stable) if (filtro(c) && !protegido(r, c, o, src, opt)) lista.push([c, o, "guarida"]);
      const [e] = await elegirCartas(r, src, lista, opt.titulo || "Elige qué CALCINAR", "atacar", { opcional: opt.opcional });
      if (!e) break;
      log(r, `🔥 ${src.name} CALCINA ${nom(e[0])} de ${e[1].name}.`);
      await retirar(r, e[1], e[0], "calcina", src); hechas++;
    }
    return hechas;
  }
  // Regla de la casa «vacuidad»: si un costo no se puede pagar completo, se paga lo posible y el efecto ocurre igual.
  const vac = r => r.vacuidad !== false;
  const avisoVac = (r, p, carta) => log(r, `🫙 VACUIDAD: ${p.name} no puede pagar el costo completo de «${carta}», así que no paga nada y el efecto ocurre igual.`);
  async function sacrificar(r, p, filtro, opt = {}) {
    const lista = p.stable.filter(c => filtro(c) && c.id !== "anc_perro").map(c => [c, p, "guarida"]);
    const [e] = await elegirCartas(r, p, lista, opt.titulo || "Elige qué SACRIFICAR", "perder", { opcional: opt.opcional });
    if (!e) return false;
    log(r, `🩸 ${p.name} SACRIFICA ${nom(e[0])}.`);
    return retirar(r, p, e[0], "sacrifica", opt.fuente);
  }
  async function saquear(r, src, filtro, titulo = "Elige qué SAQUEAR") {
    const lista = []; for (const o of rivales(r, src)) for (const c of o.stable) if (filtro(c) && !protegido(r, c, o, src, { saqueo: true })) lista.push([c, o, "guarida"]);
    const [e] = await elegirCartas(r, src, lista, titulo, "atacar"); if (!e) return null;
    const [c, de] = e;
    await quitarGuarida(r, de, c, "saqueo"); K.ofender(r, src, de, 2);
    log(r, `🦅 ${src.name} SAQUEA ${nom(c)} de la guarida de ${de.name}.`);
    await ponerGuarida(r, src, c);
    return { c, de };
  }
  function robar(r, p, n = 1, motivo) {
    let k = 0; for (; k < n; k++) { if (!r.deck.length) { K.finPorMazo(r); break; } p.hand.push(r.deck.pop()); }
    if (k) log(r, `${p.name} roba ${k} carta${k > 1 ? "s" : ""}${motivo ? " (" + motivo + ")" : ""}.`);
  }
  async function descartar(r, p, n, opt = {}) {
    const lista = p.hand.filter(opt.filtro || (() => true)).map(c => [c, p, "mano"]);
    n = Math.min(n, lista.length); if (!n) return;
    const elegidas = await elegirCartas(r, p, lista, opt.titulo || `Elige ${n} carta${n > 1 ? "s" : ""} para DESCARTAR`, "descartar", { n });
    for (const [c] of elegidas) { p.hand.splice(p.hand.indexOf(c), 1); colocar(r, c, "cenizas"); log(r, `🗑️ ${p.name} DESCARTA ${nom(c)}.`); }
    if (opt.fuente && opt.fuente !== p) K.ofender(r, opt.fuente, p, .5);
  }
  async function buscarMazo(r, p, pred, txt) {
    const lista = r.deck.filter(pred).map(c => [c, null, "mazo"]);
    if (!lista.length) { log(r, `🔍 ${p.name} busca ${txt} en el mazo, pero no hay.`); return null; }
    const [e] = await elegirCartas(r, p, lista, `Elige ${txt} del mazo`, "ganar");
    r.deck.splice(r.deck.indexOf(e[0]), 1); p.hand.push(e[0]); shuffle(r.deck);
    log(r, `🔍 ${p.name} busca ${txt} en el mazo y la agrega a su mano.`); return e[0];
  }
  async function desdeCenizas(r, p, pred, aGuarida, txt, opcional = false) {
    const lista = r.discard.filter(pred).map(c => [c, null, "cenizas"]); if (!lista.length) return null;
    const [e] = await elegirCartas(r, p, lista, `Elige ${txt} de las Cenizas`, "ganar", { opcional }); if (!e) return null;
    r.discard.splice(r.discard.indexOf(e[0]), 1);
    log(r, `⚱️ ${p.name} rescata ${nom(e[0])} de las Cenizas ${aGuarida ? "y la trae a su guarida" : "a su mano"}.`);
    if (aGuarida) await ponerGuarida(r, p, e[0]); else p.hand.push(e[0]);
    return e[0];
  }
  async function invocarCria(r, p) { const c = r.nursery.pop(); if (!c) return; await ponerGuarida(r, p, c); log(r, `🥚 ${p.name} INVOCA ${nom(c)} desde el Criadero.`); }
  async function aManoDeSuDueño(r, src, filtro, titulo, propias = false) {
    const lista = []; for (const o of (propias ? r.players : rivales(r, src))) for (const c of o.stable) if (filtro(c) && c.id !== "anc_perro" && !(esDragon(c) && tiene(o, "rel_proteccion_titan") && o !== src)) lista.push([c, o, "guarida"]);
    const [e] = await elegirCartas(r, src, lista, titulo, "atacar"); if (!e) return null;
    await quitarGuarida(r, e[1], e[0], "mano"); const z = colocar(r, e[0], "mano", e[1].pid); K.ofender(r, src, e[1]);
    log(r, z === "criadero" ? `↩️ ${src.name} devuelve ${nom(e[0])} al Criadero.` : `↩️ ${src.name} devuelve ${nom(e[0])} a la mano de ${e[1].name}.`); return e[1];
  }
  const cenizasAlMazo = r => { r.deck.push(...r.discard); r.discard = []; shuffle(r.deck); log(r, "♻️ Las Cenizas se barajan dentro del mazo."); };
  const cadaJugador = async (r, desde, fn) => { const i0 = r.players.indexOf(desde); for (let k = 0; k < r.players.length; k++) await fn(r.players[(i0 + k) % r.players.length]); };
  const relMal = c => ["reliquia", "maldicion"].includes(T(c));

  // Reliquia ajena o Maldición propia (Motosierra, Ataque Preciso, Fuego de Titán)
  async function relicOMaldicion(r, p, opcional, puedeCalcinarMald) {
    const lista = [];
    for (const c of p.stable) if (T(c) === "maldicion") lista.push([c, p, "guarida"]);
    for (const o of rivales(r, p)) for (const c of o.stable) if (T(c) === "reliquia" || (puedeCalcinarMald && T(c) === "maldicion")) lista.push([c, o, "guarida"]);
    const [e] = await elegirCartas(r, p, lista, "Elige: SACRIFICA una Maldición tuya o CALCINA una Reliquia", "relmal", { opcional }); if (!e) return;
    if (e[1] === p) { log(r, `🩸 ${p.name} SACRIFICA ${nom(e[0])}.`); await retirar(r, p, e[0], "sacrifica"); }
    else { log(r, `🔥 ${p.name} CALCINA ${nom(e[0])} de ${e[1].name}.`); await retirar(r, e[1], e[0], "calcina", p); }
  }
  async function mirarYTomar(r, p) {
    const vs = rivales(r, p).filter(o => o.hand.length); if (!vs.length) return;
    const v = await elegirJugador(r, p, vs, "Elige la mano de qué jugador mirar", "objetivo");
    const [e] = await elegirCartas(r, p, v.hand.map(c => [c, v, "mano"]), `Mano de ${v.name}: elige una carta para quedártela`, "ganar");
    v.hand.splice(v.hand.indexOf(e[0]), 1); p.hand.push(e[0]); K.ofender(r, p, v);
    log(r, `👁️ ${p.name} mira la mano de ${v.name} y se lleva una carta.`);
  }
  async function moverRelMal(r, p, titulo) {
    const lista = []; for (const o of r.players) for (const c of o.stable) if (relMal(c)) lista.push([c, o, "guarida"]);
    const [e] = await elegirCartas(r, p, lista, titulo, "mover"); if (!e) return;
    const destinos = r.players.filter(o => o !== e[1]);
    const d = await elegirJugador(r, p, destinos, `¿A qué guarida mueves ${nom(e[0])}?`, T(e[0]) === "maldicion" ? "objetivo" : "aliado");
    if (!d) return;
    await quitarGuarida(r, e[1], e[0], "mover"); d.stable.push(e[0]);
    if (T(e[0]) === "maldicion") K.ofender(r, p, d);
    log(r, `↪️ ${p.name} mueve ${nom(e[0])} de ${e[1].name} a ${d.name}.`);
  }

  // ═════════════ EFECTOS DE LAS CARTAS ═════════════
  const ENTRADA = {
    anc_llamero: async (r, p) => { await cadaJugador(r, p, o => descartar(r, o, 1, { fuente: p })); cenizasAlMazo(r); },
    anc_veloz: (r, p) => desdeCenizas(r, p, c => T(c) === "instantanea", false, "un ¡GRRR!"),
    anc_molesto: async (r, p) => { const vs = rivales(r, p).filter(o => o.hand.length); if (!vs.length) return; const v = await elegirJugador(r, p, vs, "Elige qué jugador DESCARTA una carta"); await descartar(r, v, 1, { fuente: p }); },
    anc_codicioso: (r, p) => robar(r, p, 1),
    anc_majestuoso: (r, p) => desdeCenizas(r, p, esDragon, false, "un Dragón"),
    anc_gran_leviatan: (r, p) => buscarMazo(r, p, c => /Leviatán/.test(def(c).nombre), "un Leviatán"),
    anc_lev_elegante: (r, p) => buscarMazo(r, p, c => T(c) === "reliquia", "una Reliquia"),
    anc_lev_pirata: (r, p) => buscarMazo(r, p, c => T(c) === "maldicion", "una Maldición"),
    anc_lev_torpedo: async (r, p) => { for (const c of p.stable.filter(c => T(c) === "maldicion")) { log(r, `🩸 ${p.name} SACRIFICA ${nom(c)}.`); await retirar(r, p, c, "sacrifica"); } },
    anc_lev_sirena: async (r, p, self) => { const s = await saquear(r, p, c => T(c) === "reliquia", "Elige qué Reliquia SAQUEAR"); if (s) self.vinculo = { uid: s.c.uid, de: s.de.pid }; },
    anc_mazorca: async (r, p) => { robar(r, p, 2); await descartar(r, p, 1); },
    anc_tiburon: async (r, p, self) => {
      const hay = rivales(r, p).some(o => o.stable.some(c => esDragon(c) && !protegido(r, c, o, p)));
      if (hay && await si(r, p, "¿Sacrificar al Dragón Tiburón para CALCINAR un dragón?", () => rivales(r, p).some(o => o.stable.some(c => K.valor(c) >= 5)))) {
        log(r, `🦈 ${p.name} sacrifica su Dragón Tiburón.`); await retirar(r, p, self, "sacrifica"); await calcinar(r, p, esDragon);
      }
    },
    anc_sirena: (r, p) => aManoDeSuDueño(r, p, () => true, "Elige una carta de otra guarida para devolverla a la mano de su dueño"),
    anc_seductor: async (r, p, self) => { const s = await saquear(r, p, esDragon, "Elige qué dragón SAQUEAR"); if (s) self.vinculo = { uid: s.c.uid, de: s.de.pid }; },
    anc_destructor: (r, p) => cadaJugador(r, p, o => sacrificar(r, o, esDragon, { fuente: p, titulo: "Dragón Destructor: elige qué dragón SACRIFICAS" })),
    anc_motosierra: (r, p) => relicOMaldicion(r, p, true),
    anc_arcoiris: async (r, p) => { const l = p.hand.filter(c => T(c) === "comun").map(c => [c, p, "mano"]); const [e] = await elegirCartas(r, p, l, "Puedes traer un Dragón Común de tu mano a tu guarida", "ganar", { opcional: true }); if (e) { p.hand.splice(p.hand.indexOf(e[0]), 1); log(r, `🌈 ${p.name} trae ${nom(e[0])} directo a su guarida.`); await ponerGuarida(r, p, e[0]); } },
    anc_mariposa: (r, p) => desdeCenizas(r, p, c => T(c) === "comun", true, "un Dragón Común", true),
    anc_vigia: (r, p) => mirarYTomar(r, p),
    anc_domador: (r, p) => buscarMazo(r, p, c => /Titán/.test(def(c).nombre), "una carta de Titán"),
    anc_jinete: async (r, p) => { if ((p.stable.length > 1 || vac(r)) && await si(r, p, "¿SACRIFICAR una carta para mover una Reliquia o Maldición?", () => p.stable.some(c => T(c) === "maldicion"))) { if (p.stable.some(c => c.id !== "anc_jinete" && c.id !== "anc_perro") ? await sacrificar(r, p, c => c.id !== "anc_jinete") : (avisoVac(r, p, "Jinete de Titanes"), true)) await moverRelMal(r, p, "Elige la Reliquia o Maldición a mover"); } },
    anc_titan_furioso: (r, p) => cadaJugador(r, p, o => descartar(r, o, 1, { fuente: p })),
    anc_invocador: (r, p) => desdeCenizas(r, p, c => /Titán/.test(def(c).nombre), false, "una carta de Titán"),
    anc_tortuga: (r, p) => robar(r, p, 1),
    anc_titan_amigo: (r, p) => cadaJugador(r, p, o => robar(r, o, 1)),
    anc_mago: (r, p) => buscarMazo(r, p, c => T(c) === "hechizo", "un Hechizo"),
    anc_escamado: (r, p, self) => cadaJugador(r, p, o => sacrificar(r, o, c => c !== self, { fuente: p, titulo: "Dragón Escamado: elige qué carta SACRIFICAS" })),
  };
  const HECHIZO = {
    hec_veneno: (r, p) => calcinar(r, p, esDragon, { porHechizo: true, titulo: "Veneno: elige qué dragón CALCINAR" }),
    hec_aliento_titan: (r, p) => calcinar(r, p, esDragon, { porHechizo: true, fuenteTitan: true, titulo: "Aliento de Titán: elige qué dragón CALCINAR" }),
    hec_coz: async (r, p) => { const o = await aManoDeSuDueño(r, p, () => true, "Coletazo: elige la carta a devolver a la mano de su dueño"); if (o) await descartar(r, o, 1, { fuente: p }); },
    hec_suerte: async (r, p) => { robar(r, p, 2); await descartar(r, p, 3); r.extraTurn = true; log(r, `⏩ ${p.name} jugará un turno extra.`); },
    hec_tornado: (r, p) => cadaJugador(r, p, async o => { const l = o.stable.filter(c => c.id !== "anc_perro").map(c => [c, o, "guarida"]); const [e] = await elegirCartas(r, p, l, `Tornado: elige qué carta de ${o === p ? "TU guarida" : "la guarida de " + o.name} vuelve a la mano`, o === p ? "perder" : "atacar"); if (e) { await quitarGuarida(r, o, e[0], "mano"); const z = colocar(r, e[0], "mano", o.pid); log(r, z === "criadero" ? `🌪️ ${nom(e[0])} de ${o.name} vuelve al Criadero.` : `🌪️ ${nom(e[0])} vuelve a la mano de ${o.name}.`); } }),
    hec_cambio: async (r, p) => {
      const [m] = await elegirCartas(r, p, p.stable.filter(esDragon).map(c => [c, p, "guarida"]), "Elige qué dragón TUYO entregas", "perder");
      if (!m) { if (vac(r)) { avisoVac(r, p, "Intercambio de Nidos"); await saquear(r, p, esDragon, "No tienes dragón que entregar: elige qué dragón SAQUEAS"); } return; }
      const lista = []; for (const o of rivales(r, p)) for (const c of o.stable) if (esDragon(c) && !protegido(r, c, o, p, { saqueo: true })) lista.push([c, o, "guarida"]);
      const [e] = await elegirCartas(r, p, lista, "Elige qué dragón te llevas a cambio", "atacar"); if (!e) return;
      await quitarGuarida(r, p, m[0], "mover"); await quitarGuarida(r, e[1], e[0], "saqueo");
      K.ofender(r, p, e[1], 2); log(r, `🔁 ${p.name} cambia ${nom(m[0])} por ${nom(e[0])} de ${e[1].name}.`);
      await ponerGuarida(r, e[1], m[0]); await ponerGuarida(r, p, e[0]);
    },
    hec_redirigir: (r, p) => moverRelMal(r, p, "Elige la Reliquia o Maldición a mover"),
    hec_trato: async (r, p) => { const o = await elegirJugador(r, p, rivales(r, p), "¿Con quién intercambias tu mano?", "mano"); if (o) { [p.hand, o.hand] = [o.hand, p.hand]; K.ofender(r, p, o); log(r, `🤝 ${p.name} intercambia su mano con ${o.name}.`); } },
    hec_dosporuno: async (r, p) => { if (p.stable.some(c => c.id !== "anc_perro") ? await sacrificar(r, p, () => true, { titulo: "Dos por Uno: elige qué carta SACRIFICAS" }) : (vac(r) && (avisoVac(r, p, "Dos por Uno"), true))) await calcinar(r, p, () => true, { porHechizo: true, n: 2, titulo: "Dos por Uno: elige qué CALCINAR" }); },
    hec_encoger: async (r, p) => {
      // Como el original: no es CALCINAR, así que Aura/Gatuno no protegen, y no se activan efectos de los dragones encogidos.
      const encogibles = o => o.stable.filter(c => esDragon(c) && T(c) !== "cria" && c.id !== "anc_perro" && !(tiene(o, "rel_proteccion_titan") && o !== p));
      const vs = rivales(r, p).filter(o => { const n = encogibles(o).length; return n && n <= r.nursery.length; });
      if (!vs.length) return log(r, "🔫 El Rayo Encogedor no tiene objetivo válido.");
      const v = await elegirJugador(r, p, vs, "Rayo Encogedor: ¿a quién encoges?");
      const ds = encogibles(v);
      for (const c of ds) { await quitarGuarida(r, v, c, "encoge"); colocar(r, c, "cenizas"); v.stable.push(r.nursery.pop()); }
      K.ofender(r, p, v, 4); log(r, `🔫 ¡${p.name} encoge ${ds.length} dragones de ${v.name} y los convierte en crías!`);
    },
    hec_preciso: (r, p) => relicOMaldicion(r, p, false),
    hec_fuego_titan: (r, p) => relicOMaldicion(r, p, false, true),
    hec_vortice: async (r, p) => { await cadaJugador(r, p, o => descartar(r, o, 1, { fuente: p })); cenizasAlMazo(r); },
    hec_buen_trato: async (r, p) => { robar(r, p, 3); await descartar(r, p, 1); },
    hec_sacudon: (r, p) => { r.deck.push(...p.hand, ...r.discard); p.hand = []; r.discard = []; shuffle(r.deck); log(r, `🌋 ${p.name} baraja su mano y las Cenizas en el mazo.`); robar(r, p, 5); },
    hec_robo: (r, p) => mirarYTomar(r, p),
    hec_reinicio: async (r, p) => { for (const o of r.players) for (const c of o.stable.filter(relMal)) await retirar(r, o, c, "sacrifica"); log(r, "💥 Todas las Reliquias y Maldiciones arden."); cenizasAlMazo(r); },
    hec_guaridas_quemadas: async (r, p) => { for (const o of r.players) for (const c of o.stable.filter(relMal)) await retirar(r, o, c, "sacrifica"); log(r, "🔥 Todas las Reliquias y Maldiciones arden."); },
    hec_beso_titan: async (r, p) => { const c = await buscarMazo(r, p, x => T(x) === "hechizo" && x.id !== "hec_beso_titan", "un Hechizo"); if (c) { p.hand.splice(p.hand.indexOf(c), 1); colocar(r, c, "cenizas"); log(r, `💋 ${p.name} lanza ${nom(c)} de inmediato.`); if (HECHIZO[c.id]) await HECHIZO[c.id](r, p); } },
  };
  // Inicio de turno. Devuelve "fin" si el turno termina de inmediato.
  const INICIO = {
    anc_avaro: (r, p) => robar(r, p, 1, "Dragón Avaro"),
    rel_cola: async (r, p) => { if (await si(r, p, "Cola Extra: ¿robar una carta adicional?", () => true)) robar(r, p, 1, "Cola Extra"); },
    rel_melena: (r, p) => ENTRADA.anc_arcoiris(r, p),
    anc_fertil: async (r, p) => { if ((p.hand.length || vac(r)) && r.nursery.length && await si(r, p, "Dragona Ultrafértil: ¿DESCARTAR una carta para invocar una Cría?", () => p.hand.length > 3)) { if (p.hand.length) await descartar(r, p, 1); else avisoVac(r, p, "Dragona Ultrafértil"); await invocarCria(r, p); } },
    anc_rinoceronte: async (r, p) => {
      if (!rivales(r, p).some(o => o.stable.some(c => esDragon(c) && !protegido(r, c, o, p)))) return;
      if (await si(r, p, "Dragón Rinoceronte: ¿CALCINAR un dragón? (tu turno termina de inmediato)", () => rivales(r, p).some(o => K.amenaza(r, o) >= 5)) && await calcinar(r, p, esDragon)) return "fin";
    },
    anc_zombi: async (r, p) => {
      if (!r.discard.some(esDragon)) return log(r, `🧟 Dragón Zombi de ${p.name}: no hay dragones en las Cenizas, no se puede usar.`);
      if (!p.hand.some(esDragon) && !vac(r)) return;
      if (!await si(r, p, "Dragón Zombi: ¿DESCARTAR un dragón para traer otro de las Cenizas? (tu turno termina)", () => r.discard.some(c => K.valor(c) >= 7))) return;
      if (p.hand.some(esDragon)) await descartar(r, p, 1, { filtro: esDragon, titulo: "Elige qué dragón DESCARTAS" }); else avisoVac(r, p, "Dragón Zombi");
      await desdeCenizas(r, p, esDragon, true, "un Dragón"); return "fin";
    },
    anc_angel: async (r, p, self) => { if (!r.discard.some(esDragon)) return log(r, `😇 Dragón Ángel de ${p.name}: no hay dragones en las Cenizas, no se puede usar.`); if (r.discard.some(esDragon) && await si(r, p, "Dragón Ángel: ¿SACRIFICARLO para traer un dragón de las Cenizas a tu guarida?", () => r.discard.some(c => K.valor(c) >= 7))) { await retirar(r, p, self, "sacrifica"); await desdeCenizas(r, p, esDragon, true, "un Dragón"); } },
    rel_bomba: async (r, p) => { if (p.stable.length > 1 && await si(r, p, "Bomba de Azufre: ¿SACRIFICAR una carta para CALCINAR otra?", () => p.stable.some(c => T(c) === "maldicion"))) { if (await sacrificar(r, p, c => c.id !== "rel_bomba" || true)) await calcinar(r, p, () => true); } },
    rel_ritual: async (r, p) => { if (!r.discard.some(esDragon)) return log(r, `🕯️ Ritual de Invocación de ${p.name}: no hay dragones en las Cenizas, no se puede usar.`); if ((p.hand.filter(esDragon).length >= 2 || vac(r)) && r.discard.some(esDragon) && await si(r, p, "Ritual de Invocación: ¿DESCARTAR 2 dragones para traer uno de las Cenizas?", () => r.discard.some(c => K.valor(c) >= 7))) { if (p.hand.filter(esDragon).length >= 2) await descartar(r, p, 2, { filtro: esDragon, titulo: "Elige los 2 dragones que DESCARTAS" }); else avisoVac(r, p, "Ritual de Invocación"); await desdeCenizas(r, p, esDragon, true, "un Dragón"); } },
    rel_lazo: async (r, p) => { if (rivales(r, p).some(o => o.stable.some(esDragon)) && await si(r, p, "Cadena de Domador: ¿SAQUEAR un dragón hasta el final de tu turno?", () => true)) { const s = await saquear(r, p, esDragon); if (s) r.lazo = { pid: p.pid, uid: s.c.uid, de: s.de.pid }; } },
    rel_fortuna_titan: async (r, p, self) => { if (await si(r, p, "Fortuna del Titán: ¿SACRIFICARLA para jugar un turno extra?", () => Math.random() < .4)) { await retirar(r, p, self, "sacrifica"); r.extraTurn = true; log(r, `⏩ ${p.name} jugará un turno extra.`); } },
    mal_sadico: async (r, p) => { await sacrificar(r, p, esDragon, { titulo: "Ritual Sádico: elige qué dragón SACRIFICAS" }); robar(r, p, 1, "Ritual Sádico"); },
    mal_maldicion_titan: (r, p) => descartar(r, p, 1, { titulo: "Maldición del Titán: elige qué DESCARTAS" }),
    mal_desgracia_titan: async (r, p) => { const [e] = await elegirCartas(r, p, p.hand.map(c => [c, p, "mano"]), "Desgracia del Titán: elige qué carta barajas en el mazo", "descartar"); if (e) { p.hand.splice(p.hand.indexOf(e[0]), 1); r.deck.push(e[0]); shuffle(r.deck); log(r, `🃏 ${p.name} baraja una carta de su mano en el mazo.`); } },
    mal_cielos_titan: async (r, p) => { const [e] = await elegirCartas(r, p, p.stable.filter(esDragon).map(c => [c, p, "guarida"]), "Cielos de Titán: elige qué dragón vuelve al mazo", "perder"); if (e) { await quitarGuarida(r, p, e[0], "mazo"); colocar(r, e[0], "mazo_barajar"); log(r, `☁️ ${nom(e[0])} de ${p.name} vuelve al mazo.`); } robar(r, p, 1, "Cielos de Titán"); },
  };

  // ═════════════ PUNTOS DE ENTRADA DEL MOTOR ═════════════
  async function alResolver(r, p, card, destino) {
    const d = def(card);
    if (d.tipo === "hechizo") { if (HECHIZO[card.id]) await HECHIZO[card.id](r, p); return; }
    const dest = P(r, destino) || p;
    await ponerGuarida(r, dest, card);
  }
  // Inicio de turno: primero las VENTAJAS (tus dragones y reliquias) en el orden que elijas;
  // luego las MALDICIONES en el orden en que fueron colocadas. Devuelve "fin" si el turno termina de inmediato.
  async function inicioDeTurno(r, p) {
    const activa = c => INICIO[c.id] && p.stable.includes(c) && !(esDragon(c) && ciego(p)) && !(T(c) === "maldicion" && bendito(p));
    const correr = async c => { const f = await INICIO[c.id](r, p, c); return f === "fin" || r.winner; };
    const hechas = new Set();
    for (;;) {
      const v = p.stable.filter(c => T(c) !== "maldicion" && activa(c) && !hechas.has(c.uid));
      if (!v.length) break;
      let c = v[0];
      if (v.length > 1) { const [e] = await elegirCartas(r, p, v.map(x => [x, p, "guarida"]), "Inicio de turno: ¿qué efecto activas primero?", "ganar"); if (e) c = e[0]; }
      hechas.add(c.uid);
      if (await correr(c)) return "fin";
    }
    for (const c of [...p.stable]) if (T(c) === "maldicion" && activa(c) && !hechas.has(c.uid)) { hechas.add(c.uid); if (await correr(c)) return "fin"; }
    return null;
  }
  async function finDeTurno(r, p) {
    if (r.lazo && r.lazo.pid === p.pid) { // Cadena de Domador: el dragón vuelve a su dueño original esté donde esté
      const de = P(r, r.lazo.de), uid = r.lazo.uid; r.lazo = null;
      let c = null;
      for (const o of r.players) { const x = o.stable.find(y => y.uid === uid); if (x) { await quitarGuarida(r, o, x, "mover"); c = x; break; } }
      if (!c) for (const arr of [r.discard, ...r.players.map(o => o.hand)]) { const i = arr.findIndex(y => y.uid === uid); if (i >= 0) { c = arr.splice(i, 1)[0]; break; } }
      if (c && de) { de.stable.push(c); log(r, `⛓️ ${nom(c)} vuelve a la guarida de ${de.name} (Cadena de Domador).`); }
    }
    if (maldOk(p, "mal_pequena")) while (p.stable.filter(esDragon).length > 5) { if (!await sacrificar(r, p, esDragon, { titulo: "Guarida Diminuta: SACRIFICA hasta quedarte con 5 dragones" })) break; }
    if (p.hand.length > 7) await descartar(r, p, p.hand.length - 7, { titulo: `Límite de mano: DESCARTA ${p.hand.length - 7} carta${p.hand.length - 7 > 1 ? "s" : ""}` });
  }
  // Reglas de quién puede jugar qué
  function puedeJugar(r, p, card, destino) {
    const d = def(card), dst = P(r, destino) || p;
    if (d.tipo === "instantanea") return "Las cartas ¡GRRR! se juegan cuando otro jugador juega una carta.";
    if (d.tipo === "comun" && rivales(r, p).some(o => tiene(o, "anc_reina"))) return "La Dragona Reina Avispa de otro jugador impide jugar Dragones Comunes.";
    if (d.tipo === "reliquia" && dst === p && maldOk(p, "mal_rota")) return "Tu Guarida Derrumbada no te deja jugar Reliquias.";
    if (["rel_melena", "rel_cola"].includes(d.id) && !dst.stable.some(c => T(c) === "comun")) return "Esta Reliquia necesita un Dragón Común en esa guarida.";
    if (d.tipo === "hechizo" && d.id === "hec_encoger" && !rivales(r, p).some(o => o.stable.some(c => esDragon(c) && T(c) !== "cria"))) return "No hay dragones que encoger.";
    return null;
  }

  return { pedir, responder, vistaPrompt, alResolver, inicioDeTurno, finDeTurno, puedeJugar, robar, ENTRADA, HECHIZO, INICIO };
};
