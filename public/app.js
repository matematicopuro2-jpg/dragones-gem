// Dragones Inestables — cliente
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

let PID = store.get("di_pid");
if (!PID) { PID = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set("di_pid", PID); }

const socket = io();
let DEF = {}, SETS = {}, ARTE = new Set(), S = null, tick = null;
const TIPO_TXT = { cria: "CRÍA DE DRAGÓN", comun: "DRAGÓN COMÚN", ancestral: "DRAGÓN ANCESTRAL", hechizo: "HECHIZO", reliquia: "RELIQUIA", maldicion: "MALDICIÓN", instantanea: "INSTANTÁNEA" };
const DRAGON = new Set(["cria", "comun", "ancestral"]);

const ARTEV = Date.now();
Promise.all([fetch("cartas.json").then(r => r.json()), fetch("/api/arte").then(r => r.json()).catch(() => [])]).then(([d, arte]) => {
  d.cartas.forEach(c => DEF[c.id] = c); SETS = d.sets;
  arte.forEach(f => { ARTE.add(f); if (f.startsWith("b/")) BESTIARIO.add(f.slice(2, -4)); });
  $("#logoArt").innerHTML = `<img src="art/d/anc_majestuoso.svg" alt="" style="width:100%;height:100%;object-fit:cover">`;
  const q = new URLSearchParams(location.search).get("sala");
  if (q) $("#inCodigo").value = q.toUpperCase();
  $("#inNombre").value = store.get("di_nombre") || "";
  const ult = store.get("di_sala");
  if (ult && (!q || q === ult.toUpperCase())) socket.emit("unirse", { code: ult, name: store.get("di_nombre") || "Jugador", pid: PID, token: store.get("di_token"), silencioso: true });
});

// ───────── brasas de fondo ─────────
for (let i = 0; i < 28; i++) {
  const b = el("i"); b.style.left = Math.random() * 100 + "vw"; b.style.animationDuration = 6 + Math.random() * 10 + "s";
  b.style.animationDelay = -Math.random() * 14 + "s"; b.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
  b.style.transform = `scale(${.5 + Math.random()})`; const gc = ["#5aa0f0", "#f6c32a", "#f08a2a"][i % 3]; b.style.background = gc; b.style.boxShadow = `0 0 8px 2px ${gc}`; $("#embers").appendChild(b);
}

// ───────── utilidades ─────────
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3500); }
const yo = () => S && S.players.find(p => p.pid === S.me);
const jug = pid => S.players.find(p => p.pid === pid);
const miTurno = () => S && S.turnPid === S.me;
function textoCarta(d) {
  return esc(d.texto).replace(/\b([A-ZÁÉÍÓÚÑ]{4,}[A-ZÁÉÍÓÚÑ!¡]*)\b/g, "<b>$1</b>");
}
// Estilo de ilustraciones: "dibujo" (dibujos propios, por defecto), "ia" (ilustraciones realistas) o "bestiario" (arte clásico, T1)
const ESTILOS = ["dibujo", "ia", "bestiario"], NOMBRE_ESTILO = { dibujo: "🖍️ Dibujos", ia: "🖼️ Ilustrado realista", bestiario: "📜 Bestiario antiguo" };
let ESTILO = ESTILOS.includes(store.get("di_estilo2")) ? store.get("di_estilo2") : "dibujo";
const BESTIARIO = new Set(window.BESTIARIO_LISTA || []);
function cambiarEstilo() { ESTILO = ESTILOS[(ESTILOS.indexOf(ESTILO) + 1) % ESTILOS.length]; store.set("di_estilo2", ESTILO); toast("🎨 Estilo: " + NOMBRE_ESTILO[ESTILO]); if (S) { S.started ? renderMesa() : renderSala(); } }
function arteDe(d) {
  if (ESTILO === "bestiario" && BESTIARIO.has(d.id)) return `<img src="art/b/${d.id}.jpg" alt="" decoding="async">`;
  if (ESTILO === "dibujo" && ARTE.has(`d/${d.id}.svg`)) return `<img src="art/d/${d.id}.svg" alt="" decoding="async">`;
  for (const ext of ["png", "jpg", "jpeg", "webp"]) if (ARTE.has(`${d.id}_edit.${ext}`)) return `<img src="art/${d.id}_edit.${ext}?v=${ARTEV}" alt="" decoding="async">`;
  for (const ext of ["png", "jpg", "jpeg", "webp", "svg"]) if (ARTE.has(`${d.id}.${ext}`)) return `<img src="art/${d.id}.${ext}" alt="" decoding="async">`;
  return cardArt(d);
}
function cartaEl(card, { mini = false, oculta = false, onClick } = {}) {
  const c = el("div", "carta" + (mini ? " mini" : "") + (oculta ? " oculta" : ""));
  if (oculta) { c.innerHTML = `<div class="in">🐉</div>`; return c; }
  const d = DEF[card.id]; if (!d) return c;
  c.dataset.tipo = d.tipo; c.dataset.uid = card.uid;
  if (!mini && card.uid != null && !VISTAS.has(card.uid)) { VISTAS.add(card.uid); if (S && S.started) c.classList.add("entra"); }
  if (d.tags.includes("inicio")) c.classList.add("inicio");
  c.innerHTML = `<div class="in"><div class="nom">${esc(d.nombre)}</div><div class="arte">${arteDe(d)}</div>
    <div class="tipo">${TIPO_TXT[d.tipo]}</div><div class="txt ${d.tipo === "comun" ? "sabor" : ""}">${textoCarta(d)}</div>
    <div class="set">${d.set === "t2" ? "T2" : ""}</div></div>`;
  c.addEventListener("mouseenter", e => mostrarVista(d, e));
  c.addEventListener("mousemove", e => moverVista(e));
  c.addEventListener("mouseleave", ocultarVista);
  if (onClick) c.addEventListener("click", e => { e.stopPropagation(); ocultarVista(); onClick(e, card, d); });
  return c;
}
function mostrarVista(d, e) {
  if (matchMedia("(hover: none)").matches) return;
  const v = $("#vista"); v.innerHTML = ""; v.appendChild(cartaEl({ id: d.id, uid: 0 })); v.classList.remove("oculto"); moverVista(e);
}
function moverVista(e) {
  const v = $("#vista"); if (v.classList.contains("oculto")) return;
  const w = 260, h = 360; let x = e.clientX + 24, y = e.clientY - h / 2;
  if (x + w > innerWidth) x = e.clientX - w - 24;
  y = Math.max(8, Math.min(innerHeight - h - 8, y));
  v.style.left = x + "px"; v.style.top = y + "px";
}
function ocultarVista() { $("#vista").classList.add("oculto"); }

// ───────── menú contextual ─────────
// Confirmación propia (dentro de Claude el navegador bloquea confirm/alert)
function confirmar(e, texto, fn) { setTimeout(() => menu(e, texto, [{ t: "✅ Sí", f: fn }, { t: "✖ Cancelar", f: () => {} }]), 30); }
function salirAlInicio() {
  socket.emit("salir"); S = null; store.set("di_sala", "");
  try { history.replaceState(null, "", location.pathname); } catch {}
  ["#mesa", "#sala", "#victoria", "#ventana", "#eleccion"].forEach(s => $(s) && $(s).classList.add("oculto"));
  $("#portada").classList.remove("oculto"); $("#inCodigo").value = "";
}
function menu(e, titulo, items) {
  const m = $("#menu"); m.innerHTML = `<div class="tit">${esc(titulo)}</div>`;
  for (const it of items) {
    if (it === "-") { m.appendChild(el("div", "sep")); continue; }
    if (it.grupo) { m.appendChild(el("div", "grupo", esc(it.grupo))); continue; }
    const b = el("button", "", it.t); b.onclick = () => { cerrarMenu(); it.f(); }; m.appendChild(b);
  }
  m.classList.remove("oculto");
  const r = m.getBoundingClientRect();
  let x = e.clientX, y = e.clientY;
  if (x + r.width > innerWidth - 8) x = innerWidth - r.width - 8;
  if (y + r.height > innerHeight - 8) y = Math.max(8, innerHeight - r.height - 8);
  m.style.left = x + "px"; m.style.top = y + "px";
}
function cerrarMenu() { $("#menu").classList.add("oculto"); }
document.addEventListener("click", cerrarMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarMenu(); cerrarModal(); } });

const mover = (uid, zona, pid, verbo) => socket.emit("mover", { uid, zona, pid, verbo });
let MANUAL = false;

// ───────── ventana de elección (efectos) ─────────
let eleccionId = null, seleccion = new Set();
function renderEleccion() {
  const pr = S && S.prompt, box = $("#eleccion"), aviso = $("#esperando");
  aviso.classList.toggle("oculto", !(pr && pr.esperando));
  if (pr && pr.esperando) aviso.innerHTML = `⏳ ${esc(pr.esperando)} está eligiendo: <i>${esc(pr.titulo)}</i>`;
  if (!pr || !pr.id) { box.classList.add("oculto"); eleccionId = null; return; }
  if (eleccionId === pr.id) return;
  eleccionId = pr.id; seleccion = new Set(); ocultarVista(); cerrarMenu();
  $("#elTitulo").textContent = pr.titulo;
  const cuerpo = $("#elCuerpo"); cuerpo.innerHTML = "";
  const enviar = sel => socket.emit("elegir", { id: pr.id, sel });
  const pie = $("#elPie"); pie.innerHTML = "";
  if (pr.tipo === "si") {
    const si = el("button", "btn fuego grande", "Sí"), no = el("button", "btn grande", "No");
    si.onclick = () => enviar(true); no.onclick = () => enviar(false);
    pie.append(no, si);
  } else if (pr.tipo === "jugador") {
    pr.opciones.forEach((o, i) => { const b = el("button", "btn grande", "🐉 " + esc(o.name)); b.onclick = () => enviar([i]); cuerpo.appendChild(b); });
  } else {
    const info = el("span", "sub");
    const ok = el("button", "btn fuego", "Confirmar");
    const act = () => { info.textContent = pr.max > 1 ? `Seleccionadas ${seleccion.size} de ${pr.min === pr.max ? pr.max : pr.min + "–" + pr.max}` : ""; ok.disabled = seleccion.size < Math.min(pr.min, pr.opciones.length) || seleccion.size > pr.max; };
    pr.opciones.forEach((o, i) => {
      const w = el("div", "op-carta");
      const c = cartaEl(o.card, { onClick: () => {
        if (pr.max === 1) return enviar([i]);
        if (seleccion.has(i)) seleccion.delete(i); else if (seleccion.size < pr.max) seleccion.add(i);
        w.classList.toggle("sel", seleccion.has(i)); act();
      } });
      w.appendChild(c);
      w.appendChild(el("div", "op-dueno", o.owner ? (o.zona === "mano" ? "Mano de " : "Guarida de ") + esc(o.owner) : { mazo: "Del mazo", cenizas: "De las Cenizas" }[o.zona] || ""));
      cuerpo.appendChild(w);
    });
    if (pr.max > 1) { ok.onclick = () => enviar([...seleccion]); pie.append(info, ok); act(); }
  }
  if (pr.opcional) { const om = el("button", "btn chico", "Omitir / no usar"); om.onclick = () => enviar([]); pie.prepend(om); }
  box.classList.remove("oculto");
}

function opcionesMovimientoGenerico(card, d, desde) {
  const otros = S.players.filter(p => p.pid !== S.me);
  const it = [];
  it.push({ grupo: "Aplicar efectos" });
  it.push({ t: "🔥 A las Cenizas", f: () => mover(card.uid, "cenizas", null, desde === "miGuarida" ? "SACRIFICA" : desde === "guarida" ? "CALCINA" : desde === "miMano" ? "DESCARTA" : null) });
  if (desde !== "miGuarida") it.push({ t: "🏠 A mi guarida", f: () => mover(card.uid, "guarida", S.me, desde === "guarida" ? "SAQUEA" : "INVOCA") });
  if (desde !== "miMano") it.push({ t: "✋ A mi mano", f: () => mover(card.uid, "mano", S.me, "toma") });
  for (const o of otros) {
    if (desde !== "guarida" || card._owner !== o.pid) it.push({ t: `➡️ A la guarida de ${esc(o.name)}`, f: () => mover(card.uid, "guarida", o.pid, "mueve") });
  }
  if (desde === "guarida" && card._owner) it.push({ t: `↩️ Devolver a la mano de ${esc(jug(card._owner).name)}`, f: () => mover(card.uid, "mano", card._owner, "devuelve") });
  if (desde === "miMano") for (const o of otros) it.push({ t: `🎁 Dar a la mano de ${esc(o.name)}`, f: () => mover(card.uid, "mano", o.pid, "entrega") });
  it.push({ t: "🔀 Barajar en el mazo", f: () => mover(card.uid, "mazo_barajar", null, "baraja en el mazo") });
  it.push({ t: "⬆️ Encima del mazo", f: () => mover(card.uid, "mazo_arriba", null, "pone encima del mazo") });
  if (d.tipo === "cria") it.push({ t: "🥚 Regresar al Criadero", f: () => mover(card.uid, "criadero", null, "regresa al Criadero") });
  return it;
}

function clickMano(e, card, d) {
  const items = [];
  const otros = S.players.filter(p => p.pid !== S.me);
  if (S.pending && d.tags.includes("grrr")) items.push({ t: `🔥 ¡Responder con ${esc(d.nombre)}!`, f: () => socket.emit("grrr", { uid: card.uid }) });
  if (miTurno() && !S.pending && !S.ocupado && S.phase === "accion" && d.tipo !== "instantanea") {
    items.push({ grupo: "Jugar (abre ventana de ¡GRRR!)" });
    if (DRAGON.has(d.tipo)) items.push({ t: "🐉 Jugar en mi guarida", f: () => socket.emit("jugar", { uid: card.uid }) });
    if (d.tipo === "hechizo") items.push({ t: "✨ Lanzar hechizo", f: () => socket.emit("jugar", { uid: card.uid }) });
    if (d.tipo === "reliquia") items.push({ t: "💎 Jugar en mi guarida", f: () => socket.emit("jugar", { uid: card.uid, destino: S.me }) });
    if (d.tipo === "reliquia" || d.tipo === "maldicion") for (const o of otros) items.push({ t: `${d.tipo === "maldicion" ? "💀" : "💎"} Jugar en la guarida de ${esc(o.name)}`, f: () => socket.emit("jugar", { uid: card.uid, destino: o.pid }) });
    if (d.tipo === "maldicion") items.push({ t: "💀 Jugar en mi propia guarida", f: () => socket.emit("jugar", { uid: card.uid, destino: S.me }) });
  }
  if (MANUAL) items.push(...opcionesMovimientoGenerico(card, d, "miMano"));
  if (!items.length) return toast(miTurno() ? (S.phase === "accion" ? "Esta carta no se puede jugar ahora." : S.phase === "fin" ? "Ya usaste tu acción: termina tu turno." : "Espera tu fase de acción.") : "Solo puedes jugar cartas en tu turno.");
  menu(e, d.nombre, items);
}
function clickGuarida(owner) {
  return (e, card, d) => {
    card._owner = owner;
    if (!MANUAL) return;
    const mia = owner === S.me;
    menu(e, `${d.nombre} · guarida de ${jug(owner).name}`, opcionesMovimientoGenerico(card, d, mia ? "miGuarida" : "guarida"));
  };
}
function clickLista(zona, owner) {
  return (e, card, d) => {
    const it = [{ grupo: "Mover" },
      { t: "✋ A mi mano", f: () => mover(card.uid, "mano", S.me, zona === "mano" ? "toma de la mano" : zona === "cenizas" ? "rescata de las Cenizas" : "toma") },
      { t: "🏠 Directo a mi guarida", f: () => mover(card.uid, "guarida", S.me, "INVOCA") }];
    if (zona !== "cenizas") it.push({ t: "🔥 A las Cenizas", f: () => mover(card.uid, "cenizas", null, zona === "mano" ? "obliga a DESCARTAR" : "envía a Cenizas") });
    if (zona !== "mazo") it.push({ t: "🔀 Barajar en el mazo", f: () => mover(card.uid, "mazo_barajar", null, "baraja en el mazo") });
    if (zona === "mazo") it.push({ t: "⬆️ Dejar encima del mazo", f: () => mover(card.uid, "mazo_arriba", null, "reordena el mazo") });
    for (const o of S.players.filter(p => p.pid !== S.me)) it.push({ t: `➡️ A la guarida de ${esc(o.name)}`, f: () => mover(card.uid, "guarida", o.pid, "mueve") });
    menu(e, d.nombre, it);
    setTimeout(cerrarModal, 0);
  };
}

// ───────── modal ─────────
let modalActual = null;
function abrirModal(titulo, cartas, onClick, nota) {
  modalActual = { titulo, onClick, nota };
  $("#modalTitulo").textContent = titulo;
  const b = $("#modalCuerpo"); b.innerHTML = "";
  if (nota) b.appendChild(el("p", "sub", nota));
  if (!cartas.length) b.appendChild(el("p", "sub", "No hay cartas aquí."));
  cartas.forEach(c => b.appendChild(cartaEl(c, { onClick })));
  $("#modal").classList.remove("oculto");
}
function cerrarModal() { $("#modal").classList.add("oculto"); modalActual = null; }
$("#modalCerrar").onclick = cerrarModal;
$("#modal").onclick = e => { if (e.target.id === "modal") cerrarModal(); };
socket.on("verLista", ({ titulo, zona, owner, cartas }) => abrirModal(titulo, cartas, clickLista(zona, owner), "Haz clic en una carta para moverla."));

// ───────── portada y sala ─────────
function nombre() { const n = $("#inNombre").value.trim(); if (!n) { toast("Escribe tu nombre primero"); $("#inNombre").focus(); return null; } store.set("di_nombre", n); return n; }
$("#btnCrear").onclick = () => { const n = nombre(); if (n) socket.emit("crear", { name: n, pid: PID }); };
$("#btnUnirse").onclick = () => { const n = nombre(); const c = $("#inCodigo").value.trim(); if (!c) return toast("Escribe el código de la sala"); if (n) socket.emit("unirse", { code: c, name: n, pid: PID, token: store.get("di_token") }); };
$("#inCodigo").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnUnirse").click(); });
let ENLACE_PUBLICO = null;
function cargarEnlace() { fetch("/api/enlace").then(r => r.json()).then(d => { ENLACE_PUBLICO = d.url; if (S && !S.started) renderSala(); }).catch(() => {}); }
cargarEnlace(); setInterval(() => { if (!ENLACE_PUBLICO) cargarEnlace(); }, 3000);
$("#btnCopiar").onclick = () => {
  const local = /^(localhost|127\.)/.test(location.hostname);
  if (local && !ENLACE_PUBLICO) return toast("El enlace público aún se está creando, espera unos segundos…");
  const url = `${local ? ENLACE_PUBLICO : location.origin}/?sala=${S.code}`;
  (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast("¡Enlace copiado! Pégalo en Discord."), () => toast("Copia este enlace: " + url));
};
$("#btnIniciar").onclick = () => socket.emit("iniciar");
$("#btnSolo").onclick = () => { const n = nombre(); if (n) socket.emit("crearSolo", { name: n, pid: PID, nivel: $("#selNivel").value, n: +$("#selBots").value }); };
$("#btnBot").onclick = () => socket.emit("agregarBot", { nivel: $("#nivelBot").value });
const NIV = { facil: "Fácil", normal: "Normal", dificil: "Difícil" };
const chipBot = p => p.bot ? `<span class="chip-bot ${p.bot}">🤖 ${NIV[p.bot]}</span>` : "";
function enviarConfig() {
  const sets = [...document.querySelectorAll("#sets input:checked")].map(i => i.value);
  socket.emit("config", { sets, winCount: $("#selMeta").value || null, dosJug: $("#chkDos").checked, vacuidad: $("#chkVac").checked });
}
$("#selMeta").onchange = enviarConfig; $("#chkDos").onchange = enviarConfig; $("#chkVac").onchange = enviarConfig;

socket.on("aviso", m => { if (/No existe una sala/.test(m) && !S) { store.set("di_sala", ""); if (!$("#inCodigo").value) return; } toast(m); });
const VERSION_CLIENTE = 3;
socket.on("estado", st => {
  if ((st.version || 0) !== VERSION_CLIENTE && !window._avisoVersion) { window._avisoVersion = 1; toast("El servidor del juego es de una versión anterior. Cierra 1_JUGAR.bat y vuelve a abrirlo."); }
  S = st; store.set("di_sala", st.code);
  history.replaceState(null, "", `?sala=${st.code}`);
  $("#portada").classList.add("oculto");
  $("#sala").classList.toggle("oculto", st.started);
  $("#mesa").classList.toggle("oculto", !st.started);
  // Motor de render: agrupa varias actualizaciones en un solo cuadro de animación
  if (st.winner) registrarVictoria(st);
  if (!pintar.pend) { pintar.pend = true; requestAnimationFrame(pintar); }
});
const VISTAS = new Set();
function pintar() { pintar.pend = false; if (!S) return; if (!S.started) renderSala(); else renderMesa(); }

function renderSala() {
  $("#salaCodigo").textContent = S.code;
  const local = /^(localhost|127\.)/.test(location.hostname);
  const link = `${local ? (ENLACE_PUBLICO || "") : location.origin}/?sala=${S.code}`;
  $("#enlaceSala").textContent = (local && !ENLACE_PUBLICO) ? "creando enlace público…" : link;
  const host = S.host === S.me;
  $("#numJug").textContent = `(${S.players.length}/8)`;
  $("#listaJug").innerHTML = S.players.map(p => `<li><span>${p.pid === S.host ? "👑 " : p.bot ? "" : "🐉 "}${esc(p.name)}${p.pid === S.me ? " (tú)" : ""}${chipBot(p)}</span>${p.bot ? (host ? `<button class="quitar" data-bot="${p.pid}" title="Quitar bot">✕</button>` : "") : `<small>${p.connected ? "conectado" : "desconectado"}</small>`}</li>`).join("");
  document.querySelectorAll("[data-bot]").forEach(b => b.onclick = () => socket.emit("quitarBot", { pid: b.dataset.bot }));
  $("#panelBots").classList.toggle("oculto", !host);
  const box = $("#sets"); box.innerHTML = "";
  for (const [k, v] of Object.entries(S.setsDisp)) {
    const on = S.sets.includes(k);
    const lab = el("label", "set-card" + (on ? " on" : ""), `<input type="checkbox" value="${k}" ${on ? "checked" : ""} ${host ? "" : "disabled"}><div><b>${esc(v.nombre)}</b><small>${esc(v.desc)}</small></div>`);
    lab.querySelector("input").onchange = enviarConfig;
    box.appendChild(lab);
  }
  $("#selMeta").value = S.winCustom || ""; $("#selMeta").disabled = !host;
  $("#chkDos").checked = S.dosJug; $("#chkDos").disabled = !host;
  $("#chkVac").checked = S.vacuidad; $("#chkVac").disabled = !host;
  let n = 0, cr = 0; for (const c of Object.values(DEF)) if (S.sets.includes(c.set)) { if (c.tipo === "cria") cr += c.cantidad; else n += c.cantidad; }
  $("#infoMazo").textContent = `Mazo: ${n} cartas + ${cr} crías en el Criadero.`;
  $("#btnIniciar").classList.toggle("oculto", !host);
  $("#btnIniciar").disabled = S.players.length < 2;
  $("#btnIniciar").textContent = S.players.length < 2 ? "Esperando jugadores…" : "¡A jugar!";
  $("#esperaHost").classList.toggle("oculto", host);
}

// ───────── mesa ─────────
const FASES = [["inicio", "Inicio"], ["accion", "Acción"], ["fin", "Fin"]];
function renderMesa() {
  const me = yo(); if (!me) return;
  $("#mesaCodigo").textContent = S.code;
  const tj = jug(S.turnPid);
  $("#turnoInfo").innerHTML = (miTurno() ? "🔥 <b>¡Es tu turno!</b>" : `Turno de <b>${esc(tj?.name || "?")}</b>`) +
    `<span class="fase">${FASES.map(([k, t]) => `<span class="${S.phase === k ? "act" : ""}">${t}</span>`).join("")}</span>` +
    ` <small style="color:var(--suave)">· Meta: ${S.winCount} 🐉</small>`;
  const libre = miTurno() && !S.pending && !S.ocupado && !S.winner;
  $("#btnRobar").disabled = !(libre && S.phase === "accion" && S.jugadas === 0);
  $("#btnRobar").textContent = "Robar (en vez de jugar)";
  $("#btnFin").disabled = !(libre && S.phase === "fin");
  $("#btnFin").classList.toggle("fuego", libre && S.phase === "fin");
  const ayuda = !miTurno() ? "" : S.ocupado ? "⚙️ Resolviendo efectos…" : S.phase === "inicio" ? "Inicio de turno…" : S.phase === "accion" ? (S.jugadas ? "Puedes jugar otra carta (Doble Garra)" : "👉 Juega 1 carta o roba 1") : "👉 Termina tu turno";
  $("#turnoInfo").innerHTML += ayuda ? ` <small style="color:var(--fuego2)">${ayuda}</small>` : "";
  renderEleccion();

  // rivales
  const riv = $("#rivales"); riv.innerHTML = "";
  for (const p of S.players) {
    if (p.pid === S.me) continue;
    const box = el("div", "rival" + (p.pid === S.turnPid ? " turno" : "") + (p.connected ? "" : " off"));
    const cerca = p.dragones >= S.winCount - 1;
    const cab = el("div", "rival-cab", `<b>${p.pid === S.turnPid ? "🔥 " : ""}${esc(p.name)}${chipBot(p)}</b><span class="meta"><span class="cuenta ${cerca ? "cerca" : ""}">🐉 ${p.dragones}/${S.winCount}</span> ✋ ${p.handCount}</span>`);
    cab.style.cursor = "pointer";
    cab.onclick = e => { e.stopPropagation(); if (!MANUAL) return; menu(e, p.name, [
      { t: "👁️ Ver su mano", f: () => socket.emit("verMano", { pid: p.pid }) },
      { t: "🎲 Tomar una carta al azar de su mano", f: () => socket.emit("alAzar", { pid: p.pid }) },
      { t: "🔄 Intercambiar manos con este jugador", f: () => confirmar(e, `¿Intercambiar tu mano con la de ${p.name}?`, () => socket.emit("intercambiarManos", { pid: p.pid })) }]); };
    box.appendChild(cab);
    const g = el("div", "guarida");
    p.stable.forEach(c => g.appendChild(cartaEl(c, { mini: true, onClick: clickGuarida(p.pid) })));
    if (!p.stable.length) g.appendChild(el("small", "sub", "Guarida vacía"));
    box.appendChild(g);
    if (p.hand) { // mano visible (Ojo Espía)
      box.appendChild(el("div", "sub", "👁️ Mano visible:"));
      const h = el("div", "guarida"); p.hand.forEach(c => h.appendChild(cartaEl(c, { mini: true, onClick: clickLista("mano", p.pid) }))); box.appendChild(h);
    }
    riv.appendChild(box);
  }

  // centro
  $("#numMazo").textContent = S.deckCount;
  $("#numCenizas").textContent = S.discard.length;
  $("#numCriadero").textContent = S.nursery.length;
  const tope = S.discard[S.discard.length - 1], tc = $("#topeCenizas");
  tc.className = tope ? "" : "vacia"; tc.innerHTML = tope ? "" : "Cenizas";
  if (tope) { const c = cartaEl(tope, { mini: true }); c.style.setProperty("--cw", "54px"); c.style.height = "76px"; c.style.pointerEvents = "none"; tc.appendChild(c); }
  const fmt = l => esc(l.txt).replace(/«(.+?)»/g, "<b>«$1»</b>");
  const ultimos = S.log.slice(-4), feed = $("#feed"), clave = ultimos.map(l => l.t + l.txt).join("|");
  if (feed.dataset.k !== clave) {
    feed.dataset.k = clave;
    feed.innerHTML = ultimos.map((l, i) => `<div class="${l.txt.startsWith("──") ? "turno " : ""}${i === ultimos.length - 1 ? "nuevo" : ""}">${fmt(l)}</div>`).join("");
  }

  // mi zona
  $("#miCuenta").textContent = `🐉 ${me.dragones}/${S.winCount}`;
  $("#miCuenta").classList.toggle("cerca", me.dragones >= S.winCount - 1);
  const mg = $("#miGuarida"); mg.innerHTML = "";
  me.stable.forEach(c => mg.appendChild(cartaEl(c, { onClick: clickGuarida(S.me) })));
  const ini = me.stable.filter(c => DEF[c.id]?.tags.includes("inicio"));
  $("#miAviso").textContent = miTurno() && S.phase === "inicio" && ini.length ? `⏰ Recuerda: ${ini.map(c => DEF[c.id].nombre).join(", ")} actúa${ini.length > 1 ? "n" : ""} al inicio de tu turno.` : "";
  $("#miManoN").textContent = `(${me.hand.length}${me.hand.length > 7 ? " — ¡máximo 7 al terminar!" : ""})`;
  const mm = $("#miMano"); mm.innerHTML = "";
  me.hand.forEach(c => {
    const d = DEF[c.id], e = cartaEl(c, { onClick: clickMano });
    if (S.pending && d.tags.includes("grrr") && puedoResponder()) e.classList.add("grrrable");
    else if (miTurno() && !S.pending && !S.ocupado && S.phase === "accion" && d.tipo !== "instantanea" &&
      !(d.tipo === "comun" && S.players.some(o => o.pid !== S.me && o.stable.some(x => x.id === "anc_reina")))) e.classList.add("jugable");
    mm.appendChild(e);
  });

  renderVentana();
  renderVictoria();
}

function puedoResponder() {
  const pe = S.pending; if (!pe || !S.puedoGrrr) return false;
  const ult = pe.chain[pe.chain.length - 1];
  if (ult && DEF[ult.card.id].tags.includes("supremo")) return false;
  return (ult ? ult.pid : pe.by) !== S.me;
}

let PASADO = null;
function renderVentana() {
  const v = $("#ventana"); clearInterval(tick);
  const pe = S.pending; if (!pe) { v.classList.add("oculto"); return; }
  v.classList.remove("oculto"); v.innerHTML = "";
  const d = DEF[pe.card.id], by = jug(pe.by), dest = pe.destino ? jug(pe.destino) : null;
  v.appendChild(cartaEl(pe.card));
  const cancel = pe.chain.length % 2 === 1;
  const info = el("div", "info", `<h3>${esc(by.name)} juega «${esc(d.nombre)}»</h3>
    <div class="sub">${d.tipo === "hechizo" ? "Hechizo" : "Destino: guarida de " + esc(dest?.name || by.name)}</div>
    <div class="cadena">${pe.chain.map(g => `<span>${esc(jug(g.pid).name)}: ${esc(DEF[g.card.id].nombre)}</span>`).join("")}</div>
    <div class="estado-carta ${cancel ? "no" : "si"}">${cancel ? "❌ Ahora mismo: DETENIDA" : "✅ Ahora mismo: entra en juego"}</div>
    <div class="barra-tiempo"><i id="tBar"></i></div>`);
  const mios = yo().hand.filter(c => DEF[c.id].tags.includes("grrr"));
  const bot = el("div", "fila");
  if (puedoResponder() && mios.length) {
    const vistos = new Set();
    for (const c of mios) { if (vistos.has(c.id)) continue; vistos.add(c.id);
      const b = el("button", "btn grrr", `¡${esc(DEF[c.id].nombre.replace(/[¡!]/g, ""))}!`); b.onclick = () => socket.emit("grrr", { uid: c.uid }); bot.appendChild(b); }
  }
  const clave = pe.card.uid + ":" + pe.chain.length;
  const pasa = el("button", "btn chico", "Dejar pasar"); pasa.onclick = () => { socket.emit("pasar"); PASADO = clave; renderVentana(); };
  if (PASADO === clave) { pasa.disabled = true; pasa.textContent = "Esperando a los demás…"; }
  bot.appendChild(pasa);
  info.appendChild(bot); v.appendChild(info);
  const fin = Date.now() + pe.msLeft;
  const upd = () => { const r = Math.max(0, fin - Date.now()); const bar = $("#tBar"); if (bar) bar.style.width = (r / pe.total * 100) + "%"; };
  upd(); tick = setInterval(upd, 100);
}

function renderVictoria() {
  const v = $("#victoria");
  if (!S.winner) { v.classList.add("oculto"); return; }
  v.classList.remove("oculto");
  const host = S.host === S.me;
  v.innerHTML = `<div><div class="corona">👑🐉</div><h2>${esc(S.winner.names.join(" y "))}</h2>
    <p style="font-size:20px">${esc(S.winner.motivo)}. ¡Señor${S.winner.names.length > 1 ? "es" : ""} supremo${S.winner.names.length > 1 ? "s" : ""} de todos los dragones!</p>
    ${host ? `<button class="btn fuego grande" id="btnOtra">Volver a la sala</button>` : `<p class="sub">El anfitrión puede iniciar otra partida.</p>`}
    <button class="btn chico" id="btnVerMesa" style="margin-top:12px">Ver la mesa</button> <button class="btn chico" id="btnSalirFin" style="margin-top:12px">🚪 Salir al inicio</button></div>`;
  $("#btnSalirFin").onclick = salirAlInicio;
  if (host) $("#btnOtra").onclick = () => socket.emit("lobby");
  $("#btnVerMesa").onclick = () => v.classList.add("oculto");
}

// ───────── botones de la mesa ─────────
$("#btnRobar").onclick = () => socket.emit("robar");
$("#btnFin").onclick = () => socket.emit("terminarTurno");
$("#pilaMazo").onclick = e => { e.stopPropagation(); if (!MANUAL) return toast(`Quedan ${S.deckCount} cartas en el mazo.`); menu(e, "Mazo", [
  { t: "🃏 Robar una carta", f: () => socket.emit("robar") },
  { t: "👀 Mirar las 3 de arriba", f: () => socket.emit("verTope", { n: 3 }) },
  { t: "🔍 Buscar en el mazo", f: () => socket.emit("verMazo") },
  { t: "🔀 Barajar el mazo", f: () => socket.emit("barajar", {}) }]); };
$("#pilaCenizas").onclick = () => abrirModal(`Cenizas (${S.discard.length})`, [...S.discard].reverse(), MANUAL ? clickLista("cenizas") : null, "Las cartas de arriba son las más recientes.");
$("#pilaCriadero").onclick = () => abrirModal(`Criadero (${S.nursery.length})`, S.nursery, MANUAL ? clickLista("criadero") : null, "Crías disponibles en el Criadero.");
$("#btnMas").onclick = e => { e.stopPropagation(); const host = S.host === S.me; menu(e, "Más acciones", [
  { t: "📖 Guía rápida", f: guia },
  { t: "📜 Reglamento completo", f: () => reglamento() },
  { t: "📚 Ver todas las cartas", f: () => catalogo() },
  { t: "📜 Historial de la partida", f: () => { $("#modalTitulo").textContent = "Historial de la partida"; $("#modalCuerpo").innerHTML = `<div class="bitacora" style="max-height:none;width:100%">${S.log.map(l => `<div class="${l.txt.startsWith("──") ? "turno" : ""}">${esc(l.txt).replace(/«(.+?)»/g, "<b>«$1»</b>")}</div>`).join("")}</div>`; $("#modal").classList.remove("oculto"); } },
  { t: MANUAL ? "🛠️ Desactivar modo manual" : "🛠️ Modo manual (corregir errores)", f: () => { MANUAL = !MANUAL; toast(MANUAL ? "Modo manual activo: puedes mover cualquier carta haciendo clic." : "Modo manual desactivado."); renderMesa(); } },
  ...(MANUAL ? [{ t: "♻️ Barajar las Cenizas dentro del mazo", f: () => socket.emit("barajar", { cenizas: true }) }, { t: "🔍 Buscar en el mazo", f: () => socket.emit("verMazo") }] : []),
  "-",
  ...(host ? [{ t: "🔁 Terminar partida y volver a la sala", f: () => confirmar(e, "¿Terminar la partida para todos?", () => socket.emit("lobby")) }] : []),
  { t: "🚪 Salir al inicio", f: () => confirmar(e, S.solo || !S.players.some(p => !p.bot && p.pid !== S.me) ? "¿Salir? La partida se cerrará." : "¿Salir de la sala? Los demás seguirán jugando.", salirAlInicio) }]); };

function guia() {
  $("#modalTitulo").textContent = "Guía rápida";
  $("#modalCuerpo").innerHTML = `<div style="line-height:1.6">
  <p><b>Tu turno:</b> ① Se aplican tus efectos de inicio de turno (⏰) y robas 1 carta automáticamente → ② <b>Juega 1 carta</b> o pulsa <b>Robar</b> (una sola acción) → ③ <b>Terminar turno</b>. Si tienes más de 7 cartas, el juego te pide cuáles descartar.</p>
  <p><b>Jugar una carta:</b> haz clic en una carta brillante de tu mano. Los demás tienen unos segundos para responder con <b>¡GRRR!</b>; si nadie lo hace, entra en juego.</p>
  <p><b>Efectos automáticos:</b> todos los efectos se aplican solos. Cuando una carta te pide decidir (qué calcinar, qué descartar, «¿quieres usar este efecto?»), aparece una ventana para elegir.</p>
  <p><b>Modo manual:</b> en el menú ⋯ puedes activarlo para mover cartas a mano si algo quedó mal.</p>
  <p><b>Gana</b> quien reúna ${S.winCount} dragones en su guarida (las crías cuentan). El contador 🐉 se actualiza solo.</p></div>`;
  $("#modal").classList.remove("oculto");
}

// ───────── pantalla completa / modo compacto ─────────
// Dentro de Claude el navegador no permite pantalla completa: el botón activa un modo compacto
// (y además intenta pantalla completa donde sí se puede).
function pantallaCompleta() {
  const d = document, e = d.documentElement;
  const on = !document.body.classList.contains("compacto");
  document.body.classList.toggle("compacto", on); store.set("di_compacto", on ? "1" : "");
  toast(on ? "Modo compacto activado (pulsa ⛶ otra vez para volver)." : "Modo normal.");
  if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch {} return; }
  const pedir = e.requestFullscreen || e.webkitRequestFullscreen;
  if (on && pedir && (d.fullscreenEnabled || d.webkitFullscreenEnabled)) { try { const p = pedir.call(e); if (p && p.catch) p.catch(() => {}); } catch {} }
}
if (store.get("di_compacto")) document.body.classList.add("compacto");
$("#btnSalirSala").onclick = salirAlInicio;
document.querySelectorAll(".btn-estilo").forEach(b => b.onclick = cambiarEstilo);
["#btnPantalla", "#btnPantalla2"].forEach(s => { const b = $(s); if (b) b.onclick = pantallaCompleta; });

// ───────── Identidad GEM ─────────
function pintarGEM() {
  const G = window.GEM || {}; if (!$("#gemBloque")) return;
  $("#gemTitulo").textContent = G.nombreLargo || "GEM"; $("#gemLema").innerHTML = esc(G.lema || "") + (G.institucion ? `<div class="gem-inst">${esc(G.institucion)}</div>` : ""); $("#gemDesc").textContent = G.descripcion || "";
  const R = [["facebook", "fb", "Facebook"], ["instagram", "ig", "Instagram"], ["tiktok", "tt", "TikTok"], ["youtube", "yt", "YouTube"], ["whatsapp", "wa", "WhatsApp"], ["web", "", "Página web"], ["publicaciones", "pub", "📰 Últimas publicaciones"]];
  $("#gemRedes").innerHTML = R.filter(([k]) => /^https?:\/\//.test(G[k] || "")).map(([k, c, t]) => `<a class="${c}" href="${esc(G[k])}" target="_blank" rel="noopener">${t}</a>`).join("");
}
pintarGEM();

// ───────── Entorno matemático: fórmulas flotando y frase ─────────
(function () {
  const F = ["e^(iπ) + 1 = 0", "φ = (1+√5)/2", "∑ 1/n² = π²/6", "∫ e^(−x²) dx = √π", "a² + b² = c²", "∇·E = ρ/ε₀", "lim (1+1/n)ⁿ = e", "F(n+1) = F(n) + F(n−1)", "ζ(s) = ∑ n⁻ˢ", "∀ε>0 ∃δ>0", "x = (−b ± √Δ)/2a", "∮ f(z)dz = 2πi ∑Res", "det(A − λI) = 0", "ℵ₀ < 𝔠", "n! ≈ √(2πn)(n/e)ⁿ", "max cᵀx  s.a. Ax ≤ b"];
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches, cont = document.getElementById("mathfondo");
  if (cont && !reducir) for (let i = 0; i < 14; i++) {
    const s = document.createElement("span"); s.textContent = F[i % F.length];
    s.style.left = (Math.random() * 92) + "vw"; s.style.top = (100 + Math.random() * 30) + "vh";
    s.style.fontSize = (13 + Math.random() * 14) + "px"; s.style.opacity = (.08 + Math.random() * .12).toFixed(2);
    s.style.setProperty("--r", (Math.random() * 16 - 8).toFixed(1) + "deg");
    s.style.animationDuration = (40 + Math.random() * 40) + "s"; s.style.animationDelay = (-Math.random() * 70) + "s"; cont.appendChild(s);
  }
  const FR = [["Los hombres nunca son tan ingeniosos como cuando inventan juegos.", "Gottfried W. Leibniz"],
    ["La esencia de la matemática reside en su libertad.", "Georg Cantor"],
    ["Un matemático que no es también algo de poeta nunca será un matemático completo.", "Karl Weierstrass"]];
  const f = FR[Math.floor(Math.random() * FR.length)], q = document.getElementById("frase");
  if (q) q.innerHTML = `“${esc(f[0])}”<cite>— ${esc(f[1])} · Juega, descansa la mente y vuelve con nuevas ideas.</cite>`;
})();

// ───────── Ranking de victorias (compartido por el grupo si es posible; si no, en este dispositivo) ─────────
const RK = { modo: "humanos", datos: [], db: null, compartido: false };
socket.on("ranking", lista => { RK.datos = lista; RK.compartido = true; RK.servidor = true; rkPintar(); });
function rkLocal() { try { return JSON.parse(store.get("di_victorias") || "[]"); } catch { return []; } }
function rkPintar() {
  const lista = RK.compartido ? RK.datos : rkLocal();
  const cuenta = {}; for (const v of lista) if (v.modo === RK.modo) { const k = String(v.nombre).trim().toLowerCase(); (cuenta[k] = cuenta[k] || { n: v.nombre, w: 0 }).w++; }
  const top = Object.values(cuenta).sort((a, b) => b.w - a.w).slice(0, 10);
  $("#rkLista").innerHTML = top.length ? top.map(x => `<li><span>${esc(x.n)}</span><b>${x.w} ${x.w === 1 ? "victoria" : "victorias"}</b></li>`).join("") : `<li><span>Aún no hay victorias en esta categoría. ¡Sé el primero!</span></li>`;
  $("#rkNota").textContent = RK.compartido ? "Ranking compartido por todos los que juegan desde este enlace." : "Ranking guardado en este dispositivo (para compartirlo con el grupo, entra con tu cuenta de Claude invitada al juego).";
}
document.querySelectorAll(".rk-tabs button").forEach(b => b.onclick = () => { RK.modo = b.dataset.modo; document.querySelectorAll(".rk-tabs button").forEach(x => x.classList.toggle("on", x === b)); rkPintar(); });
rkPintar();
if (window.claude && claude.use) claude.use("db").then(db => {
  if (!db) return; RK.db = db;
  db.collection("victorias").orderBy("t", "desc").limit(1000).onSnapshot(snap => { RK.datos = snap.docs.map(d => d.data()); RK.compartido = true; rkPintar(); }, () => { RK.compartido = false; rkPintar(); });
}).catch(() => {});
function registrarVictoria(st) {
  const yo = st.players.find(p => p.pid === st.me); if (!yo || !st.winner || !st.winner.names.includes(yo.name)) return;
  const modo = (st.humanos || 1) >= 2 ? "humanos" : "bots", id = `${st.partida || st.code}-${yo.pid}`.replace(/[^A-Za-z0-9_-]/g, "");
  if (RK.hechas && RK.hechas.has(id)) return; (RK.hechas = RK.hechas || new Set()).add(id);
  const v = { nombre: yo.name, modo, t: Date.now(), id };
  const loc = rkLocal(); if (!loc.some(x => x.id === id)) { loc.push(v); store.set("di_victorias", JSON.stringify(loc.slice(-500))); }
  if (RK.servidor) { rkPintar(); return; }
  if (RK.db) RK.db.collection("victorias").doc(id).set(v).catch(() => {});
  rkPintar();
}
