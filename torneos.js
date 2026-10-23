// Modo torneo: sistema suizo por mesas (3–4 jugadores) + Mesa Final.
// Puntos por puesto en la mesa: 4 jugadores → 4/2/1/0 · 3 jugadores → 4/2/0 · 5 jugadores → 5/3/2/1/0.
// Desempate: 1) puntos  2) victorias  3) dragones acumulados  4) fuerza de rivales (suma de puntos de los rivales).
const A = require("./almacen");
const PUNTOS = { 2: [4, 0], 3: [4, 2, 0], 4: [4, 2, 1, 0], 5: [5, 3, 2, 1, 0] };
const todos = () => A.get("torneos", []);
const guardar = ts => A.set("torneos", ts);
const buscar = id => todos().find(t => t.id === id);

function tabla(t) {
  const st = {};
  for (const j of t.jugadores) st[j.email] = { email: j.email, nombre: j.nombre, pts: 0, victorias: 0, dragones: 0, partidas: 0, rivales: [] };
  for (const r of t.rondas) for (const m of r.mesas) if (m.resultado) {
    const pos = m.resultado.posiciones, tab = PUNTOS[pos.length] || PUNTOS[4];
    pos.forEach((e, i) => { const s = st[e]; if (!s) return; s.pts += tab[i] || 0; s.partidas++; if (i === 0) s.victorias++; s.dragones += (m.resultado.dragones || {})[e] || 0; s.rivales.push(...pos.filter(x => x !== e)); });
  }
  for (const s of Object.values(st)) s.fuerza = s.rivales.reduce((a, e) => a + (st[e] ? st[e].pts : 0), 0);
  return Object.values(st).sort((a, b) => b.pts - a.pts || b.victorias - a.victorias || b.dragones - a.dragones || b.fuerza - a.fuerza || a.nombre.localeCompare(b.nombre))
    .map(({ rivales, ...s }) => s);
}
function tamaños(n) {           // reparte n jugadores en mesas de 4 (y de 3 cuando no cuadra)
  if (n <= 5) return [n];
  const tres = (4 - n % 4) % 4; const cuatro = (n - 3 * tres) / 4;
  return [...Array(cuatro).fill(4), ...Array(tres).fill(3)];
}
function vista(t, usuario) {
  const ronda = t.rondas[t.rondas.length - 1] || null;
  const miMesa = usuario && ronda ? ronda.mesas.findIndex(m => !m.resultado && m.jugadores.some(j => j.email === usuario.email)) : -1;
  return { id: t.id, nombre: t.nombre, estado: t.estado, rondasTotal: t.rondasTotal, sets: t.sets, creado: t.creado, fecha: t.fecha || "",
    inscritos: t.jugadores.map(j => j.nombre), yoInscrito: !!(usuario && t.jugadores.some(j => j.email === usuario.email)),
    tabla: tabla(t).map(s => ({ nombre: s.nombre, pts: s.pts, victorias: s.victorias, dragones: s.dragones, partidas: s.partidas, fuerza: s.fuerza })),
    rondas: t.rondas.map(r => ({ n: r.n, final: !!r.final, mesas: r.mesas.map(m => ({ jugadores: m.jugadores.map(j => j.nombre), codigo: m.codigo, terminada: !!m.resultado, posiciones: m.resultado ? m.resultado.posiciones.map(e => (t.jugadores.find(j => j.email === e) || {}).nombre || "?") : null })) })),
    miMesa, campeon: t.campeon || null };
}

module.exports = function crearTorneos(ctx) { // ctx: { crearMesa(t, ronda, idx) -> codigo, avisar() }
  function crear(u, { nombre, rondas, sets, fecha }) {
    if (!u || !u.admin) return "Solo los organizadores pueden crear torneos.";
    nombre = String(nombre || "").trim().slice(0, 60); if (nombre.length < 3) return "Ponle un nombre al torneo.";
    const ts = todos();
    ts.unshift({ id: Date.now().toString(36), nombre, rondasTotal: Math.max(1, Math.min(6, +rondas || 3)), sets: (Array.isArray(sets) && sets.length ? sets : ["t1"]).filter(s => ["t1", "t2"].includes(s)),
      fecha: String(fecha || "").slice(0, 40), creado: Date.now(), creador: u.email, estado: "inscripcion", jugadores: [], rondas: [] });
    guardar(ts); ctx.avisar(); return null;
  }
  function inscribir(u, id, si = true) {
    if (!u) return "Primero entra con tu correo.";
    const ts = todos(), t = ts.find(x => x.id === id); if (!t) return "Ese torneo no existe.";
    if (t.estado !== "inscripcion") return "Las inscripciones de este torneo ya cerraron.";
    const ya = t.jugadores.some(j => j.email === u.email);
    if (si && !ya) t.jugadores.push({ email: u.email, nombre: u.nombre, pid: u.pid });
    if (!si) t.jugadores = t.jugadores.filter(j => j.email !== u.email);
    guardar(ts); ctx.avisar(); return null;
  }
  function siguiente(u, id) { // inicia la próxima ronda o la Mesa Final
    if (!u || !u.admin) return "Solo los organizadores pueden avanzar el torneo.";
    const ts = todos(), t = ts.find(x => x.id === id); if (!t) return "Ese torneo no existe.";
    const ult = t.rondas[t.rondas.length - 1];
    if (ult && ult.mesas.some(m => !m.resultado)) return "Aún hay mesas sin terminar en esta ronda.";
    if (t.estado === "terminado") return "El torneo ya terminó.";
    if (t.jugadores.length < 3) return "Se necesitan al menos 3 inscritos.";
    const jugadas = t.rondas.filter(r => !r.final).length;
    let grupos;
    if (ult && ult.final) {          // la final ya se jugó: proclamar campeón
      const m = ult.mesas[0]; t.campeon = (t.jugadores.find(j => j.email === m.resultado.posiciones[0]) || {}).nombre || "?"; t.estado = "terminado";
      guardar(ts); ctx.avisar(); return null;
    }
    const orden = t.rondas.length ? tabla(t).map(s => t.jugadores.find(j => j.email === s.email)) : [...t.jugadores].sort(() => Math.random() - .5);
    if (jugadas >= t.rondasTotal) {   // Mesa Final con los 4 mejores
      grupos = [orden.slice(0, Math.min(4, orden.length))];
      t.rondas.push({ n: t.rondas.length + 1, final: true, mesas: [] }); t.estado = "final";
    } else {
      grupos = []; let i = 0; for (const k of tamaños(orden.length)) { grupos.push(orden.slice(i, i + k)); i += k; }
      t.rondas.push({ n: t.rondas.length + 1, final: false, mesas: [] }); t.estado = "ronda";
    }
    const r = t.rondas[t.rondas.length - 1];
    r.mesas = grupos.map(g => ({ jugadores: g.map(j => ({ email: j.email, nombre: j.nombre, pid: j.pid })), codigo: null, resultado: null }));
    r.mesas.forEach((m, idx) => m.codigo = ctx.crearMesa(t, r, idx));
    guardar(ts); ctx.avisar(); return null;
  }
  function resultado(id, ronda, idx, posiciones, dragones) {
    const ts = todos(), t = ts.find(x => x.id === id); if (!t) return;
    const r = t.rondas.find(x => x.n === ronda); const m = r && r.mesas[idx]; if (!m || m.resultado) return;
    m.resultado = { posiciones, dragones, t: Date.now() };
    if (r.final) { t.campeon = (t.jugadores.find(j => j.email === posiciones[0]) || {}).nombre || "?"; t.estado = "terminado"; }
    guardar(ts); ctx.avisar();
  }
  function rehacerMesa(u, id, idx) {
    if (!u || !u.admin) return "Solo los organizadores pueden hacer eso.";
    const ts = todos(), t = ts.find(x => x.id === id); if (!t) return "Ese torneo no existe.";
    const r = t.rondas[t.rondas.length - 1], m = r && r.mesas[idx]; if (!m || m.resultado) return "Esa mesa ya terminó.";
    m.codigo = ctx.crearMesa(t, r, idx); guardar(ts); ctx.avisar(); return null;
  }
  function eliminar(u, id) {
    if (!u || !u.admin) return "Solo los organizadores pueden eliminar torneos.";
    guardar(todos().filter(t => t.id !== id)); ctx.avisar(); return null;
  }
  return { crear, inscribir, siguiente, resultado, rehacerMesa, eliminar, lista: u => todos().slice(0, 30).map(t => vista(t, u)), buscar, PUNTOS };
};
