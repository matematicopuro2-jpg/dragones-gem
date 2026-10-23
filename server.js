// Dragones Inestables — servidor de juego
// Uso: node server.js   (puerto 3000 por defecto, o PORT=xxxx)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const DATA = JSON.parse(fs.readFileSync(path.join(PUB, "cartas.json"), "utf8"));
const DEF = Object.fromEntries(DATA.cartas.map(c => [c.id, c]));
const DRAGON = new Set(["cria", "comun", "ancestral"]);
const VENTANA_MS = 7000; // tiempo para responder con ¡GRRR!

// ───────────── servidor de archivos estáticos ─────────────
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp3": "audio/mpeg" };
const EDIT = path.join(__dirname, "EDITAR_ARTE");   // aquí van las imágenes *_edit.jpg hechas a mano
const A = require("./almacen"), CUENTAS = require("./cuentas");
function json(res, code, obj) { res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function cuerpo(req) { return new Promise(ok => { let b = ""; req.on("data", d => { b += d; if (b.length > 1e4) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); }); }
const httpServer = http.createServer(async (req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url.startsWith("/api/auth/") && req.method === "POST") {
    const b = await cuerpo(req);
    if (url === "/api/auth/codigo") return json(res, 200, await CUENTAS.pedirCodigo(b.email));
    if (url === "/api/auth/verificar") return json(res, 200, CUENTAS.verificar(b.email, b.codigo, b.nombre));
    if (url === "/api/auth/salir") { CUENTAS.cerrar(b.token); return json(res, 200, { ok: true }); }
  }
  if (url === "/api/yo") return json(res, 200, { usuario: CUENTAS.deToken(req.headers["x-token"]), persistente: A.persistente() });
  if (url === "/api/enlace") {
    res.writeHead(200, { "Content-Type": MIME[".json"] });
    return res.end(JSON.stringify({ url: ENLACE }));
  }
  if (url === "/api/arte") {
    let files = [];
    for (const d of [path.join(PUB, "art"), EDIT]) try { files.push(...fs.readdirSync(d).filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f))); } catch {}
    for (const sub of ["d", "b"]) try { files.push(...fs.readdirSync(path.join(PUB, "art", sub)).filter(f => /\.(jpe?g|svg)$/i.test(f)).map(f => sub + "/" + f)); } catch {}
    res.writeHead(200, { "Content-Type": MIME[".json"] });
    return res.end(JSON.stringify(files));
  }
  if (url === "/") url = "/index.html";
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  const edit = /^\/art\/[^\/]+_edit\.(png|jpe?g|webp)$/i.test(url) ? path.join(EDIT, path.basename(url)) : null;
  fs.readFile(edit && fs.existsSync(edit) ? edit : file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
});
const io = new Server(httpServer);

// ───────────── ranking de victorias (servidor propio) ─────────────
const RANK_FILE = path.join(__dirname, "data", "ranking.json");
let RANKING = []; try { RANKING = JSON.parse(fs.readFileSync(RANK_FILE, "utf8")); } catch {}
function guardarRanking() { RANKING = RANKING.slice(-5000); A.set("ranking", RANKING); }
function anotarVictoria(r) {
  if (!r.winner || r.rankAnotado) return; r.rankAnotado = true;
  const humanos = r.players.filter(p => !p.bot).length, modo = humanos >= 2 ? "humanos" : "bots";
  for (const n of r.winner.names) { const p = r.players.find(x => x.name === n); if (p && !p.bot) RANKING.push({ nombre: p.name, modo, t: Date.now() }); }
  guardarRanking(); if (typeof io !== "undefined" && io.emit) io.emit("ranking", RANKING);
}

// ───────────── torneos ─────────────
const TORNEOS = require("./torneos")({
  crearMesa(t, ronda, idx) {
    const m = ronda.mesas[idx];
    if (m.codigo && rooms.has(m.codigo)) { const v = rooms.get(m.codigo); clearTimeout(v.timer); rooms.delete(m.codigo); }
    const r = crearSala("torneo"); r.sets = t.sets && t.sets.length ? t.sets : ["t1"];
    r.torneo = { tid: t.id, ronda: ronda.n, mesa: idx, nombre: t.nombre + (ronda.final ? " · Mesa Final" : ` · Ronda ${ronda.n} · Mesa ${idx + 1}`) };
    r.esperados = m.jugadores.map(j => ({ pid: j.pid, nombre: j.nombre, email: j.email }));
    log(r, `🏆 ${r.torneo.nombre}. La partida empieza sola cuando lleguen todos.`);
    return r.code;
  },
  avisar() { if (typeof io !== "undefined") for (const s of io.sockets.sockets.values()) s.emit("torneos", TORNEOS.lista(s.usuario)); },
});
function cerrarMesaTorneo(r) {
  if (!r.torneo || r.torneoAnotado) return; r.torneoAnotado = true;
  const email = pid => (r.esperados.find(e => e.pid === pid) || {}).email;
  const win = new Set(r.winner ? r.winner.names : []);
  const orden = [...r.players].filter(p => email(p.pid)).sort((a, b) => (win.has(b.name) - win.has(a.name)) || contarDragones(b) - contarDragones(a));
  for (const e of r.esperados) if (!orden.some(p => p.pid === e.pid)) orden.push({ pid: e.pid, stable: [] });
  const dr = {}; for (const p of orden) dr[email(p.pid)] = p.hand ? contarDragones(p) : 0;
  TORNEOS.resultado(r.torneo.tid, r.torneo.ronda, r.torneo.mesa, orden.map(p => email(p.pid)), dr);
}

// ───────────── utilidades ─────────────
let UID = 1;
const rooms = new Map();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nuevoCodigo = () => { let c; do { c = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join(""); } while (rooms.has(c)); return c; };
const inst = id => ({ uid: UID++, id });
const def = card => DEF[card.id];
const nombre = card => def(card).nombre;

function crearSala(hostPid) {
  const r = { code: nuevoCodigo(), host: hostPid, players: [], started: false, sets: ["t1"], winCount: null, dosJug: true, vacuidad: true,
    deck: [], discard: [], nursery: [], turn: 0, phase: "inicio", jugadas: 0, robos: 0, pending: null, log: [], winner: null, extraTurn: false };
  rooms.set(r.code, r);
  return r;
}
const P = (r, pid) => r.players.find(p => p.pid === pid);
function log(r, txt) { r.log.push({ t: Date.now(), txt }); if (r.log.length > 120) r.log.shift(); }
const metaVictoria = r => r.winCount || (r.players.length >= 6 ? 6 : 7);

function tieneTag(p, tag) {
  const bendito = p.stable.some(c => c.id === "rel_bendicion_titan");
  return p.stable.some(c => def(c).tags.includes(tag) && !(bendito && def(c).tipo === "maldicion"));
}
function contarDragones(p) {
  if (tieneTag(p, "nocuenta")) return 0;
  return p.stable.reduce((n, c) => n + (DRAGON.has(def(c).tipo) ? (def(c).tags.includes("doble") ? 2 : 1) : 0), 0);
}

// Busca una carta por uid en cualquier zona. Devuelve {arr, idx, zona, owner}
function ubicar(r, uid) {
  for (const p of r.players) {
    let i = p.hand.findIndex(c => c.uid === uid); if (i >= 0) return { arr: p.hand, idx: i, zona: "mano", owner: p };
    i = p.stable.findIndex(c => c.uid === uid); if (i >= 0) return { arr: p.stable, idx: i, zona: "guarida", owner: p };
  }
  for (const [zona, arr] of [["cenizas", r.discard], ["mazo", r.deck], ["criadero", r.nursery]]) {
    const i = arr.findIndex(c => c.uid === uid); if (i >= 0) return { arr, idx: i, zona, owner: null };
  }
  return null;
}
// Coloca una carta en un destino respetando la regla de las crías.
function colocar(r, card, zona, pid) {
  const esCria = def(card).tipo === "cria";
  if (esCria && ["mano", "cenizas", "mazo_arriba", "mazo_barajar"].includes(zona)) zona = "criadero";
  if (zona === "mano") P(r, pid).hand.push(card);
  else if (zona === "guarida") P(r, pid).stable.push(card);
  else if (zona === "cenizas") r.discard.push(card);
  else if (zona === "criadero") r.nursery.push(card);
  else if (zona === "mazo_arriba") r.deck.push(card);
  else if (zona === "mazo_barajar") { r.deck.push(card); shuffle(r.deck); }
  return zona;
}

// Variante oficial para 2 jugadores: estas cartas no se usan.
const FUERA_2J = new Set(["rel_cola", "anc_reina", "rel_melena", "anc_arcoiris", "anc_fertil", "mal_camara", "mal_sadico", "mal_lentitud", "rel_bomba", "rel_rugido"]);
function construirMazo(r) {
  r.deck = []; r.nursery = []; r.discard = [];
  const dos = r.players.length === 2 && r.dosJug;
  for (const c of DATA.cartas) {
    if (!r.sets.includes(c.set)) continue;
    if (dos && (c.tipo === "comun" || FUERA_2J.has(c.id))) continue;
    for (let i = 0; i < c.cantidad; i++) (c.tipo === "cria" ? r.nursery : r.deck).push(inst(c.id));
  }
  shuffle(r.deck); shuffle(r.nursery);
}

function iniciar(r) {
  construirMazo(r);
  r.players.forEach(p => { p.hand = []; p.stable = []; });
  shuffle(r.players);
  for (const p of r.players) {
    const cria = r.nursery.pop(); if (cria) p.stable.push(cria);
    if (r.players.length === 2 && r.dosJug) {
      const i = r.deck.findIndex(c => c.id === "grrr");
      if (i >= 0) p.hand.push(r.deck.splice(i, 1)[0]);
    }
    for (let k = 0; k < 5; k++) if (r.deck.length) p.hand.push(r.deck.pop());
  }
  Object.assign(r, { partida: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), started: true, turn: 0, phase: "inicio", jugadas: 0, robos: 0, pending: null, winner: null, log: [], extraTurn: false, prompt: null, lazo: null, rencor: {}, terminando: false });
  log(r, `🐉 ¡Comienza la partida! Temporadas: ${r.sets.map(s => DATA.sets[s].nombre).join(" + ")}. Meta: ${metaVictoria(r)} dragones.`);
  inicioTurno(r);
}

function inicioTurno(r) {
  const p = r.players[r.turn];
  r.phase = "inicio"; r.jugadas = 0; r.robos = 0; r.turnoN = (r.turnoN || 0) + 1;
  // Perrodragón: se muda a la guarida del jugador que empieza su turno
  for (const o of r.players) {
    if (o === p) continue;
    const i = o.stable.findIndex(c => c.id === "anc_perro");
    if (i >= 0) { p.stable.push(o.stable.splice(i, 1)[0]); log(r, `🐶 El Perrodragón se muda a la guarida de ${p.name}.`); }
  }
  log(r, `── Turno de ${p.name} ──`);
  r.jugadasMax = p.stable.some(c => c.id === "rel_doble") ? 2 : 1;
  run(r, async () => {
    const fin = await MOTOR.inicioDeTurno(r, p);
    if (r.winner || r.players[r.turn] !== p) return;
    if (fin === "fin") { log(r, `⏹️ El turno de ${p.name} termina de inmediato.`); r.phase = "fin"; await finalizarTurno(r, p); return; }
    MOTOR.robar(r, p, 1, "fase de robo");
    r.phase = "accion";
  });
}
// Cola de efectos: se ejecutan de uno en uno; mientras corre, nadie puede actuar
function run(r, fn) {
  r.ocupado = (r.ocupado || 0) + 1; emitir(r);
  r.cola = (r.cola || Promise.resolve()).then(fn).catch(e => console.error("efecto", e))
    .finally(() => { r.ocupado--; revisarVictoria(r); if (process.env.DEBUG_INV) invariante(r); emitir(r); });
}
async function finalizarTurno(r, p) {
  revisarVictoria(r); if (r.winner) return;
  await MOTOR.finDeTurno(r, p);
  revisarVictoria(r); if (r.winner) return;
  pasarTurno(r);
}
function invariante(r) {
  const uids = [...r.deck, ...r.discard, ...r.nursery, ...r.players.flatMap(p => [...p.hand, ...p.stable])].map(c => c.uid);
  if (r.pending) uids.push(r.pending.card.uid, ...r.pending.chain.map(g => g.card.uid));
  const set = new Set(uids);
  r.totalCartas ??= uids.length;
  if (set.size !== uids.length || uids.length !== r.totalCartas) console.error(`INVARIANTE ROTA: ${uids.length} cartas (${set.size} únicas), esperado ${r.totalCartas}. Último log: ${r.log.slice(-3).map(l => l.txt).join(" | ")}`);
}
function terminarTurno(r, p) {
  if (r.players[r.turn] !== p || r.terminando) return;
  r.terminando = true;
  run(r, async () => { try { await finalizarTurno(r, p); } finally { r.terminando = false; } });
}
function jugarCarta(r, p, card, destino) {
  const i = p.hand.indexOf(card); if (i < 0) return "Esa carta no está en tu mano.";
  const d = def(card);
  if (DRAGON.has(d.tipo) || (d.tipo === "reliquia" && !destino)) destino = p.pid;
  if (d.tipo === "maldicion" && !destino) return "Elige en qué guarida pones la Maldición.";
  const e = MOTOR.puedeJugar(r, p, card, destino); if (e) return e;
  p.hand.splice(i, 1); r.jugadas++;
  const dn = d.tipo === "hechizo" ? "" : ` en la guarida de ${P(r, destino).name}`;
  log(r, `🃏 ${p.name} juega «${d.nombre}»${dn}…`);
  abrirVentana(r, p, card, d.tipo === "hechizo" ? null : destino);
  return null;
}
function robarAccion(r, p) {
  MOTOR.robar(r, p, 1, "en vez de jugar");
  r.phase = "fin";
}

function robar(r, p, motivo) {
  if (!r.deck.length) { finPorMazo(r); return false; }
  p.hand.push(r.deck.pop());
  log(r, `${p.name} roba una carta${motivo ? " (" + motivo + ")" : ""}.`);
  return true;
}
function finPorMazo(r) {
  if (r.winner) return;
  const max = Math.max(...r.players.map(contarDragones));
  const ganadores = r.players.filter(p => contarDragones(p) === max);
  r.winner = { names: ganadores.map(p => p.name), motivo: "Se acabó el mazo" };
  log(r, `📦 Se acabó el mazo. Gana: ${r.winner.names.join(" y ")}.`);
}
function revisarVictoria(r) {
  if (r.winner || r.pending || !r.started) return;
  const meta = metaVictoria(r);
  const g = r.players.find(p => contarDragones(p) >= meta);
  if (g) { r.winner = { names: [g.name], motivo: `Reunió ${contarDragones(g)} dragones` }; log(r, `👑 ¡${g.name} completó su Horda y gana la partida!`); }
}

// ───────────── ventana de ¡GRRR! ─────────────
function abrirVentana(r, p, card, destino) {
  const sinGrrr = tieneTag(p, "sinGrrr");
  r.pending = { card, by: p.pid, destino, chain: [], deadline: Date.now() + (sinGrrr ? 0 : VENTANA_MS), sinGrrr };
  if (sinGrrr) return resolver(r);
  programar(r);
}
function programar(r) {
  clearTimeout(r.timer);
  r.timer = setTimeout(() => { resolver(r); emitir(r); }, Math.max(0, r.pending.deadline - Date.now()));
}
function resolver(r) {
  const pe = r.pending; if (!pe) return;
  clearTimeout(r.timer); r.pending = null;
  const by = P(r, pe.by);
  const cancelada = pe.chain.length % 2 === 1;
  for (const g of pe.chain) r.discard.push(g.card);
  const d = def(pe.card);
  if (cancelada) {
    colocar(r, pe.card, "cenizas");
    log(r, `❌ «${d.nombre}» de ${by.name} fue detenida por un ¡GRRR!.`);
  } else if (d.tipo === "hechizo") {
    r.discard.push(pe.card);
    log(r, `✨ ${by.name} lanza «${d.nombre}».`);
  } else {
    const dest = P(r, pe.destino) || by;
    log(r, `✅ «${d.nombre}» entra en la guarida de ${dest.name}.`);
  }
  if (cancelada && pe.chain.length) BOTS.ofender(r, P(r, pe.chain[pe.chain.length - 1].pid), by);
  const finJugada = () => { if (r.players[r.turn] === by && r.phase === "accion" && r.jugadas >= (r.jugadasMax || 1)) r.phase = "fin"; };
  if (!cancelada) run(r, async () => { await MOTOR.alResolver(r, by, pe.card, pe.destino); finJugada(); });
  else finJugada();
  revisarVictoria(r);
}
function registrarGrrr(r, p, card) {
  const pe = r.pending, d = def(card);
  pe.chain.push({ pid: p.pid, card });
  log(r, `🔥 ¡${p.name} responde con «${d.nombre}»!`);
  pe.deadline = Date.now() + (d.tags.includes("supremo") ? 1500 : VENTANA_MS);
  programar(r);
}
function pasarTurno(r) {
  const p = r.players[r.turn];
  if (r.extraTurn) { r.extraTurn = false; log(r, `⏩ ${p.name} juega un turno extra.`); }
  else {
    let n = r.players.length, t = r.turn;
    do { t = (t + 1) % n; } while (!r.players[t].connected && t !== r.turn);
    r.turn = t;
  }
  inicioTurno(r);
}
const K = { P, def, DRAGON, colocar, log, contarDragones, tieneTag, metaVictoria, shuffle, finPorMazo, abrirVentana,
  emitir: r => emitir(r), revisarVictoria, registrarGrrr, resolverYa: r => resolver(r), pasarTurno,
  jugarCarta: (...a) => jugarCarta(...a), robarAccion: (...a) => robarAccion(...a), terminarTurno: (...a) => terminarTurno(...a) };
const BOTS = require("./bots")(K);
Object.assign(K, { elegirBot: BOTS.elegirBot, ofender: BOTS.ofender, valor: BOTS.valor, amenaza: BOTS.amenaza });
const MOTOR = require("./motor")(K);
K.puedeJugar = MOTOR.puedeJugar;
setInterval(() => { for (const r of rooms.values()) { try { BOTS.tick(r); } catch (e) { console.error("bot", e); } } }, process.env.BOT_VEL ? 20 : 350);

// ───────────── vista personalizada ─────────────
function vista(r, pid) {
  const me = P(r, pid);
  return {
    version: 3, code: r.code, me: pid, host: r.host, started: r.started, sets: r.sets, setsDisp: DATA.sets, winCount: metaVictoria(r),
    winCustom: r.winCount, dosJug: r.dosJug, partida: r.partida || null, humanos: r.players.filter(p => !p.bot).length, vacuidad: r.vacuidad !== false,
    turnPid: r.started ? r.players[r.turn]?.pid : null, phase: r.phase, jugadas: r.jugadas, robos: r.robos,
    deckCount: r.deck.length, discard: r.discard, nursery: r.nursery,
    players: r.players.map(p => ({ pid: p.pid, name: p.name, connected: p.connected, bot: p.bot ? p.bot.nivel : null, stable: p.stable, handCount: p.hand.length,
      hand: (p.pid === pid || tieneTag(p, "manoVisible")) ? p.hand : null, dragones: contarDragones(p) })),
    pending: r.pending && { card: r.pending.card, by: r.pending.by, destino: r.pending.destino,
      chain: r.pending.chain.map(g => ({ pid: g.pid, card: g.card })), msLeft: Math.max(0, r.pending.deadline - Date.now()), total: VENTANA_MS },
    log: r.log.slice(-150), winner: r.winner, ultimoHechizo: r.ultimoHechizo || null,
    puedoGrrr: me ? (me.stable.some(c => c.id === "rel_bendicion_titan") || !(tieneTag(me, "noInstant") || me.stable.some(c => c.id === "anc_colosal"))) : false,
    prompt: MOTOR.vistaPrompt(r, pid), ocupado: !!r.ocupado, jugadasMax: r.jugadasMax || 1,
  };
}
function emitir(r) {
  if (r.winner && !r.rankAnotado && typeof anotarVictoria === "function" && !(typeof window !== "undefined")) anotarVictoria(r);
  if (r.winner && r.torneo) cerrarMesaTorneo(r);
  for (const p of r.players) if (p.sid) io.to(p.sid).emit("estado", vista(r, p.pid));
}

// ───────────── eventos ─────────────
io.on("connection", sock => {
  if (typeof window === "undefined") sock.emit("ranking", RANKING);
  let sala = null, yo = null;
  const err = m => sock.emit("aviso", m);
  const ok = () => { revisarVictoria(sala); emitir(sala); };

  function entrar(r, pid, name) {
    name = String(name || "Jugador").slice(0, 18).trim() || "Jugador";
    if (r.torneo) {
      const u = sock.usuario, e = u && r.esperados.find(x => x.pid === u.pid);
      if (!e) return err("Esta es una mesa de torneo: solo pueden entrar sus jugadores (con su cuenta).");
      pid = u.pid; name = e.nombre;
    }
    let p = P(r, pid);
    if (!p) {
      if (r.started) return err("La partida ya empezó. Pide al anfitrión que la reinicie.");
      if (r.players.length >= 8) return err("La sala está llena (máximo 8).");
      p = { pid, name, hand: [], stable: [] }; r.players.push(p);
      log(r, `👋 ${name} entró a la sala.`);
    }
    p.sid = sock.id; p.connected = true; p.name = name;
    sala = r; yo = pid; sock.join(r.code);
    if (r.torneo && !r.started && r.esperados.every(e => { const q = P(r, e.pid); return q && q.connected; })) { log(r, "🏆 ¡Llegaron todos! Empieza la partida del torneo."); iniciar(r); }
    emitir(r);
  }
  const usar = token => { if (token) sock.usuario = CUENTAS.deToken(token) || sock.usuario; };
  sock.on("sesion", ({ token } = {}) => { sock.usuario = CUENTAS.deToken(token); sock.emit("torneos", TORNEOS.lista(sock.usuario)); });
  const tRes = e => { if (e) err(e); };
  sock.on("tInscribir", ({ id, si }) => tRes(TORNEOS.inscribir(sock.usuario, id, si !== false)));
  sock.on("tCrear", d => tRes(TORNEOS.crear(sock.usuario, d || {})));
  sock.on("tSiguiente", ({ id }) => tRes(TORNEOS.siguiente(sock.usuario, id)));
  sock.on("tRehacer", ({ id, mesa }) => tRes(TORNEOS.rehacerMesa(sock.usuario, id, +mesa)));
  sock.on("tEliminar", ({ id }) => tRes(TORNEOS.eliminar(sock.usuario, id)));
  sock.on("tCerrarMesa", ({ id, mesa }) => { // el organizador da por terminada una mesa (gana quien tenga más dragones)
    const u = sock.usuario; if (!u || !u.admin) return err("Solo los organizadores pueden hacer eso.");
    const t = TORNEOS.buscar(id); const ro = t && t.rondas[t.rondas.length - 1]; const m = ro && ro.mesas[+mesa]; if (!m || m.resultado) return;
    const r = rooms.get(m.codigo);
    if (r && r.torneo) { if (!r.winner) { const pts = r.players.map(contarDragones), mx = Math.max(...pts, 0); r.winner = { names: r.players.filter((p, i) => pts[i] === mx && r.started).map(p => p.name), motivo: "El organizador cerró la mesa" }; } cerrarMesaTorneo(r); emitir(r); }
    else TORNEOS.resultado(id, ro.n, +mesa, m.jugadores.map(j => j.email), {});
  });
  sock.on("tMesa", ({ id, token }) => {
    usar(token); const u = sock.usuario; if (!u) return err("Entra con tu correo primero.");
    const t = TORNEOS.buscar(id); const ro = t && t.rondas[t.rondas.length - 1];
    const m = ro && ro.mesas.find(m => !m.resultado && m.jugadores.some(j => j.email === u.email));
    if (!m) return err("No tienes una mesa pendiente en este torneo.");
    const r = rooms.get(m.codigo); if (!r) return err("La mesa no está activa. Avisa al organizador para que la rehaga.");
    entrar(r, u.pid, u.nombre);
  });

  sock.on("crear", ({ name, pid }) => { if (!pid) return; const r = crearSala(pid); entrar(r, pid, name); });
  sock.on("unirse", ({ code, name, pid, token }) => {
    usar(token);
    const r = rooms.get(String(code || "").toUpperCase().trim());
    if (!r) return err("No existe una sala con ese código.");
    if (!pid) return; entrar(r, pid, name);
  });

  const conSala = fn => (...a) => { if (!sala || !P(sala, yo)) return; try { fn(P(sala, yo), ...a); } catch (e) { console.error(e); err("Error: " + e.message); } };
  const esHost = () => sala.host === yo;
  const miTurno = () => sala.started && sala.players[sala.turn]?.pid === yo;

  sock.on("config", conSala((p, { sets, winCount, dosJug, vacuidad }) => {
    if (!esHost() || sala.started) return;
    if (Array.isArray(sets)) {
      let s = sets.filter(x => DATA.sets[x]);
      if (s.includes("t2") && !s.includes("t1")) s.unshift("t1");
      sala.sets = s.length ? s : ["t1"];
    }
    sala.winCount = winCount ? Math.max(3, Math.min(12, +winCount)) : null;
    if (typeof dosJug === "boolean") sala.dosJug = dosJug;
    if (typeof vacuidad === "boolean") sala.vacuidad = vacuidad;
    ok();
  }));
  sock.on("agregarBot", conSala((p, { nivel }) => {
    if (!esHost() || sala.started) return;
    if (sala.players.length >= 8) return err("La sala está llena (máximo 8).");
    const b = BOTS.nuevoBot(sala, nivel); sala.players.push(b);
    log(sala, `🤖 ${b.name} (${BOTS.NIVELES[b.bot.nivel].nombre}) se une a la sala.`); ok();
  }));
  sock.on("quitarBot", conSala((p, { pid }) => {
    if (!esHost() || sala.started) return;
    sala.players = sala.players.filter(x => !(x.pid === pid && x.bot)); ok();
  }));
  sock.on("crearSolo", ({ name, pid, nivel, n }) => {
    if (!pid) return; const r = crearSala(pid); r.solo = true;
    entrar(r, pid, name);
    for (let i = 0; i < Math.max(1, Math.min(7, +n || 3)); i++) r.players.push(BOTS.nuevoBot(r, nivel));
    emitir(r);
  });
  sock.on("iniciar", conSala(() => {
    if (!esHost()) return err("Solo el anfitrión puede iniciar.");
    if (sala.players.length < 2) return err("Se necesitan al menos 2 jugadores.");
    iniciar(sala); ok();
  }));
  sock.on("lobby", conSala(() => {
    if (!esHost()) return; clearTimeout(sala.timer);
    if (sala.prompt) { clearTimeout(sala.prompt.timer); sala.prompt = null; }
    Object.assign(sala, { started: false, pending: null, winner: null });
    sala.players = sala.players.filter(p => p.connected);
    log(sala, "🔁 El anfitrión volvió a la sala de espera."); ok();
  }));

  const listo = () => {
    if (!sala.started || sala.winner) return "La partida no está en curso.";
    if (!miTurno()) return "No es tu turno.";
    if (sala.pending) return "Espera a que se resuelva la carta en juego.";
    if (sala.ocupado || sala.prompt) return "Espera a que se resuelvan los efectos.";
    return null;
  };
  sock.on("robar", conSala(p => {
    const e = listo(); if (e) return err(e);
    if (sala.phase !== "accion" || sala.jugadas > 0) return err("Solo puedes robar en tu fase de acción, en vez de jugar una carta.");
    robarAccion(sala, p); ok();
  }));
  sock.on("jugar", conSala((p, { uid, destino }) => {
    const e = listo(); if (e) return err(e);
    if (sala.phase !== "accion") return err(sala.phase === "fin" ? "Ya usaste tu acción este turno. Termina tu turno." : "Espera tu fase de acción.");
    const card = p.hand.find(c => c.uid === uid); if (!card) return;
    const e2 = jugarCarta(sala, p, card, destino); if (e2) return err(e2);
    ok();
  }));
  sock.on("elegir", conSala((p, { id, sel }) => { if (!sala.prompt) return; if (!MOTOR.responder(sala, p.pid, id, sel)) return err("Elección no válida."); ok(); }));

  sock.on("grrr", conSala((p, { uid }) => {
    const pe = sala.pending; if (!pe) return err("No hay ninguna carta a la que responder.");
    const i = p.hand.findIndex(c => c.uid === uid); if (i < 0) return;
    const d = def(p.hand[i]); if (!d.tags.includes("grrr")) return;
    const ultimo = pe.chain.length ? pe.chain[pe.chain.length - 1] : null;
    if (ultimo && def(ultimo.card).tags.includes("supremo")) return err("Un Rugido Supremo no se puede detener.");
    if ((ultimo ? ultimo.pid : pe.by) === p.pid) return err("No puedes responderte a ti mismo.");
    const bendito = p.stable.some(c => c.id === "rel_bendicion_titan");
    if (!bendito && (tieneTag(p, "noInstant") || p.stable.some(c => c.id === "anc_colosal"))) return err("Algo en tu guarida te impide jugar ¡GRRR!.");
    const card = p.hand.splice(i, 1)[0];
    BOTS.ofender(sala, p, P(sala, ultimo ? ultimo.pid : pe.by));
    registrarGrrr(sala, p, card); ok();
  }));
  sock.on("pasar", conSala(p => { // el que jugó puede acelerar si nadie responde
    const pe = sala.pending; if (!pe) return;
    pe.pasan = pe.pasan || new Map(); pe.pasan.set(p.pid, pe.chain.length);
    const ultimo = pe.chain.length ? pe.chain[pe.chain.length - 1].pid : pe.by;
    if (!sala.players.some(BOTS.esBot)) {
      const faltan = sala.players.filter(o => o.connected && o.pid !== ultimo && pe.pasan.get(o.pid) !== pe.chain.length);
      if (!faltan.length) resolver(sala);
    }
    ok();
  }));

  // Movimiento manual para aplicar efectos: CALCINAR, SAQUEAR, SACRIFICAR, DESCARTAR, etc.
  sock.on("mover", conSala((p, { uid, zona, pid, verbo }) => {
    if (!sala.started) return;
    if (sala.pending && sala.pending.card.uid === uid) return;
    const u = ubicar(sala, uid); if (!u) return;
    const zonasOk = ["mano", "guarida", "cenizas", "criadero", "mazo_arriba", "mazo_barajar"];
    if (!zonasOk.includes(zona)) return;
    if ((zona === "mano" || zona === "guarida") && !P(sala, pid || p.pid)) return;
    const card = u.arr.splice(u.idx, 1)[0];
    const real = colocar(sala, card, zona, pid || p.pid);
    const desde = u.owner ? `${u.zona === "mano" ? "la mano" : "la guarida"} de ${u.owner.name}` : { cenizas: "las Cenizas", mazo: "el mazo", criadero: "el Criadero" }[u.zona];
    const hacia = { mano: `la mano de ${P(sala, pid || p.pid)?.name}`, guarida: `la guarida de ${P(sala, pid || p.pid)?.name}`, cenizas: "las Cenizas",
      criadero: "el Criadero", mazo_arriba: "encima del mazo", mazo_barajar: "el mazo (barajado)" }[real];
    const oculto = u.zona === "mano" && real !== "guarida" && real !== "cenizas" || u.zona === "mazo" && real === "mano";
    const n = oculto ? "una carta" : `«${nombre(card)}»`;
    const de = desde.startsWith("el ") ? "del " + desde.slice(3) : "de " + desde;
    const a = hacia.startsWith("el ") ? "al " + hacia.slice(3) : "a " + hacia;
    log(sala, `${verbo ? "⚔️ " + p.name + " · " + verbo + ": " : p.name + " mueve "}${n} ${de} ${a}.`);
    ok();
  }));
  sock.on("alAzar", conSala((p, { pid }) => {
    const o = P(sala, pid); if (!o || o === p || !o.hand.length) return;
    const c = o.hand.splice(Math.floor(Math.random() * o.hand.length), 1)[0]; p.hand.push(c);
    log(sala, `🎲 ${p.name} toma una carta al azar de la mano de ${o.name}.`); ok();
  }));
  sock.on("intercambiarManos", conSala((p, { pid }) => {
    const o = P(sala, pid); if (!o || o === p) return;
    [p.hand, o.hand] = [o.hand, p.hand];
    log(sala, `🔄 ${p.name} intercambia su mano con ${o.name}.`); ok();
  }));
  sock.on("verMano", conSala((p, { pid }) => {
    const o = P(sala, pid); if (!o || o === p) return;
    log(sala, `👁️ ${p.name} mira la mano de ${o.name}.`);
    sock.emit("verLista", { titulo: `Mano de ${o.name}`, zona: "mano", owner: o.pid, cartas: o.hand }); ok();
  }));
  sock.on("verMazo", conSala(p => {
    log(sala, `🔍 ${p.name} busca en el mazo.`);
    sock.emit("verLista", { titulo: "Mazo (de arriba hacia abajo)", zona: "mazo", cartas: [...sala.deck].reverse() }); ok();
  }));
  sock.on("verTope", conSala((p, { n }) => {
    n = Math.max(1, Math.min(10, +n || 3));
    log(sala, `👀 ${p.name} mira las ${n} cartas de arriba del mazo.`);
    sock.emit("verLista", { titulo: `Las ${n} cartas de arriba del mazo`, zona: "mazo", cartas: sala.deck.slice(-n).reverse() }); ok();
  }));
  sock.on("barajar", conSala((p, { cenizas }) => {
    if (cenizas) { sala.deck.push(...sala.discard); sala.discard = []; log(sala, `♻️ ${p.name} baraja las Cenizas dentro del mazo.`); }
    else log(sala, `🔀 ${p.name} baraja el mazo.`);
    shuffle(sala.deck); ok();
  }));


  // Solo para pruebas automáticas (DEBUG_INV): arma un escenario de mesa.
  if (process.env.DEBUG_INV) sock.on("debugEscenario", conSala((p, spec) => {
    const tomar = id => { for (const arr of [sala.deck, sala.discard, sala.nursery, ...sala.players.flatMap(o => [o.hand, o.stable])]) { const i = arr.findIndex(c => c.id === id); if (i >= 0) return arr.splice(i, 1)[0]; } return inst(id); };
    for (const o of sala.players) for (const c of o.hand.filter(c => def(c).tags.includes("grrr"))) { o.hand.splice(o.hand.indexOf(c), 1); sala.deck.unshift(c); }
    for (const c of sala.deck.filter(c => def(c).tags.includes("grrr"))) { sala.deck.splice(sala.deck.indexOf(c), 1); sala.deck.unshift(c); }
    const quien = k => k === "yo" ? p : sala.players.filter(o => o !== p)[+k];
    if (spec.vaciar) { sala.nursery.push(...p.stable.filter(c => def(c).tipo === "cria")); sala.discard.push(...p.stable.filter(c => def(c).tipo !== "cria")); p.stable = []; }
    for (const [k, ids] of Object.entries(spec.guarida || {})) for (const id of ids) quien(k).stable.push(tomar(id));
    for (const [k, ids] of Object.entries(spec.mano || {})) for (const id of ids) quien(k).hand.push(tomar(id));
    for (const id of spec.cenizas || []) sala.discard.push(tomar(id));
    sala.totalCartas = undefined; ok();
  }));
  sock.on("terminarTurno", conSala(p => {
    const e = listo(); if (e) return err(e);
    if (sala.phase === "accion") return err("Primero juega una carta o roba una carta.");
    terminarTurno(sala, p); ok();
  }));

  sock.on("salir", () => {
    if (!sala) return; const r = sala, p = P(r, yo); sala = null;
    if (!p) return;
    if (r.prompt && r.prompt.pid === p.pid) r.prompt.fin(BOTS.elegirBot(r, p, r.prompt.req, true));
    const otrosHumanos = r.players.some(x => x !== p && !x.bot && x.connected);
    if (!otrosHumanos && !r.torneo) { clearTimeout(r.timer); rooms.delete(r.code); return; }
    if (!r.started) { r.players = r.players.filter(x => x !== p); if (r.host === p.pid && r.players[0]) r.host = (r.players.find(x => !x.bot) || r.players[0]).pid; }
    else { p.connected = false; p.sid = null; if (r.host === p.pid) { const h = r.players.find(x => !x.bot && x.connected); if (h) r.host = h.pid; } }
    if (r.started && !r.winner && r.players[r.turn] === p && !r.ocupado) { r.pending = null; clearTimeout(r.timer); pasarTurno(r); }
    log(r, `🚪 ${p.name} salió de la sala.`); emitir(r);
  });
  sock.on("disconnect", () => {
    if (!sala) return; const p = P(sala, yo); if (!p || p.sid !== sock.id) return;
    p.connected = false; p.sid = null;
    if (sala.prompt && sala.prompt.pid === p.pid) sala.prompt.fin(BOTS.elegirBot(sala, p, sala.prompt.req, true));
    if (!sala.started) { sala.players = sala.players.filter(x => x !== p); if (sala.host === yo && sala.players[0]) sala.host = sala.players[0].pid; }
    log(sala, `🔌 ${p.name} se desconectó.`);
    const humanos = r => r.players.some(x => x.connected && !x.bot);
    if (!humanos(sala) && !sala.torneo) { const c = sala.code; setTimeout(() => { const r = rooms.get(c); if (r && !humanos(r)) { clearTimeout(r.timer); rooms.delete(c); } }, 30 * 60e3); }
    emitir(sala);
  });
});

// ───────────── enlace público (Cloudflare Tunnel) ─────────────
let ENLACE = null;
function abrirTunel() {
  const exe = path.join(__dirname, "tools", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  if (!fs.existsSync(exe) || process.env.SIN_TUNEL) return console.log("  (Sin túnel: solo se puede jugar en esta red)\n");
  const { spawn } = require("child_process");
  const t = spawn(exe, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { windowsHide: true });
  const leer = d => {
    const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !ENLACE) {
      ENLACE = m[0];
      console.log("  ════════════════════════════════════════════════════");
      console.log("   ENLACE PARA TUS AMIGOS (pégalo en Discord):");
      console.log("   " + ENLACE);
      console.log("  ════════════════════════════════════════════════════\n");
    }
  };
  t.stdout.on("data", leer); t.stderr.on("data", leer);
  t.on("exit", () => { ENLACE = null; console.log("  El túnel se cerró. Reinicia 1_JUGAR.bat para obtener un enlace nuevo."); });
  process.on("exit", () => t.kill());
  process.on("SIGINT", () => { t.kill(); process.exit(); });
}

A.iniciar().catch(e => { console.error("No se pudo conectar a la base de datos:", e.message); }).then(() => {
  RANKING = A.get("ranking", RANKING);
  httpServer.listen(PORT, () => {
  console.log("\n  🐉  DRAGONES INESTABLES  🐉");
  console.log(`  Servidor listo en  http://localhost:${PORT}`);
  console.log("  Creando el enlace público para tus amigos... (unos segundos)\n");
  abrirTunel();
});
});
