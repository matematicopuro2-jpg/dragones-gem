// Torneos GEM: cuenta con correo + código, inscripción, tabla suiza y acceso a la mesa asignada.
(() => {
  const caja = document.getElementById("torneos"); if (!caja) return;
  if (!window.io || location.protocol === "file:") { caja.remove(); return; }
  const T = { token: store.get("di_token"), yo: null, lista: [], abierto: {}, paso: "correo", email: "", nuevo: false };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const post = (u, b) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
  const ESTADO = { inscripcion: "Inscripciones abiertas", ronda: "En juego", final: "Mesa Final", terminado: "Terminado" };

  function sesion() { socket.emit("sesion", { token: T.token }); }
  socket.on("connect", sesion);
  if (socket.connected) sesion();
  fetch("/api/yo", { headers: { "x-token": T.token || "" } }).then(r => r.json()).then(d => {
    T.yo = d.usuario; if (!T.yo && T.token) { T.token = null; store.set("di_token", ""); } pintar();
  }).catch(() => caja.remove());
  socket.on("torneos", l => { T.lista = l; pintar(); });

  function pintarLogin() {
    const L = document.getElementById("tLogin"), C = document.getElementById("tCuenta");
    if (T.yo) {
      C.innerHTML = `<span style="font-size:13px">👤 <b style="color:var(--texto);font-size:13px">${esc(T.yo.nombre)}</b>${T.yo.admin ? " · organizador" : ""} <button class="btn chico" id="tSalir">Salir</button></span>`;
      document.getElementById("tSalir").onclick = () => { post("/api/auth/salir", { token: T.token }); T.token = null; T.yo = null; store.set("di_token", ""); sesion(); pintar(); };
      L.innerHTML = ""; return;
    }
    C.innerHTML = "";
    if (T.paso === "correo") {
      L.innerHTML = `<p class="t-nota">Para jugar torneos entra con tu correo: te enviamos un código de 6 dígitos (sin contraseñas).</p>
        <div class="t-form"><input id="tEmail" type="email" placeholder="tucorreo@uni.pe" value="${esc(T.email)}"><button class="btn fuego" id="tPedir">Enviar código</button></div>`;
      document.getElementById("tPedir").onclick = async () => {
        T.email = document.getElementById("tEmail").value.trim(); if (!T.email) return toast("Escribe tu correo");
        const d = await post("/api/auth/codigo", { email: T.email }).catch(() => ({ error: "Sin conexión." }));
        if (d.error) return toast(d.error);
        T.nuevo = d.nuevo; T.paso = "codigo"; T.prueba = d.codigoPrueba || ""; pintar();
      };
    } else {
      L.innerHTML = `<p class="t-nota">Revisa <b>${esc(T.email)}</b> (también en Spam/Promociones) y escribe el código.${T.prueba ? ` <i>(modo prueba: ${T.prueba})</i>` : ""}</p>
        <div class="t-form"><input id="tCodigo" inputmode="numeric" maxlength="6" placeholder="123456" value="${esc(T.prueba || "")}">
        ${T.nuevo ? `<input id="tNombre" maxlength="18" placeholder="Tu nombre de jugador" value="${esc(store.get("di_nombre") || "")}">` : ""}
        <button class="btn fuego" id="tVerificar">Entrar</button><button class="btn chico" id="tVolver">Cambiar correo</button></div>`;
      document.getElementById("tVolver").onclick = () => { T.paso = "correo"; pintar(); };
      document.getElementById("tVerificar").onclick = async () => {
        const nombre = (document.getElementById("tNombre") || {}).value;
        const d = await post("/api/auth/verificar", { email: T.email, codigo: document.getElementById("tCodigo").value, nombre }).catch(() => ({ error: "Sin conexión." }));
        if (d.pideNombre) { T.nuevo = true; pintar(); }
        if (d.error) return toast(d.error);
        T.token = d.token; T.yo = d.usuario; T.paso = "correo"; store.set("di_token", d.token);
        if (!store.get("di_nombre")) store.set("di_nombre", d.usuario.nombre);
        toast(`¡Bienvenido, ${d.usuario.nombre}!`); sesion(); pintar();
      };
    }
  }

  function pintarTorneo(t) {
    const yo = T.yo, adm = yo && yo.admin, ab = T.abierto[t.id] ?? (t.estado !== "terminado");
    const ult = t.rondas[t.rondas.length - 1];
    let h = `<div class="t-item"><h4>${esc(t.nombre)} <span class="t-estado">${ESTADO[t.estado] || t.estado}${ult && t.estado !== "terminado" ? ` · ${ult.final ? "Final" : "Ronda " + ult.n + "/" + t.rondasTotal}` : ""}</span></h4>
      <div class="t-nota">${t.fecha ? "📅 " + esc(t.fecha) + " · " : ""}${t.rondasTotal} rondas suizas + Mesa Final · ${t.inscritos.length} inscritos${t.sets.includes("t2") ? " · con expansión" : ""}</div>`;
    if (t.campeon) h += `<div class="t-campeon">👑 Campeón: <b>${esc(t.campeon)}</b></div>`;
    h += `<div class="t-acc">`;
    if (t.estado === "inscripcion") h += !yo ? `<span class="t-nota">Entra con tu correo para inscribirte.</span>`
      : t.yoInscrito ? `<button class="btn chico" data-t="baja">Darme de baja</button><span class="t-nota">✅ Estás inscrito</span>` : `<button class="btn fuego chico" data-t="alta">Inscribirme</button>`;
    if (t.miMesa >= 0) h += `<button class="btn fuego" data-t="mesa">▶ Ir a mi mesa</button>`;
    h += `<button class="btn chico" data-t="ver">${ab ? "Ocultar detalles" : "Ver tabla y mesas"}</button></div>`;
    if (ab) {
      if (t.estado === "inscripcion") h += `<div class="t-nota">Inscritos: ${t.inscritos.map(esc).join(", ") || "nadie aún"}</div>`;
      if (t.rondas.length) {
        h += `<table class="t-tabla"><tr><th>#</th><th>Jugador</th><th class="n">Pts</th><th class="n">🏆</th><th class="n">🐉</th><th class="n">Fuerza</th></tr>` +
          t.tabla.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.nombre)}</td><td class="n"><b>${s.pts}</b></td><td class="n">${s.victorias}</td><td class="n">${s.dragones}</td><td class="n">${s.fuerza}</td></tr>`).join("") + `</table>`;
        h += `<div class="t-mesas"><b>${ult.final ? "Mesa Final" : "Ronda " + ult.n}</b>` + ult.mesas.map((m, i) =>
          `<div>Mesa ${i + 1}: ${m.terminada ? m.posiciones.map((n, k) => (k === 0 ? "🥇" : k + 1 + "º ") + esc(n)).join(" · ") : m.jugadores.map(esc).join(", ") + " <i>— jugando</i>"}
          ${adm && !m.terminada ? ` <button class="btn chico" data-t="cerrar" data-m="${i}" title="Termina la mesa: gana quien tenga más dragones">Cerrar</button> <button class="btn chico" data-t="rehacer" data-m="${i}" title="Crea de nuevo la sala de esta mesa">Rehacer</button>` : ""}</div>`).join("") + `</div>`;
        h += `<p class="t-nota">Puntos por mesa: 1º 4 · 2º 2 · 3º 1 · 4º 0 (en mesas de 3: 4/2/0). Desempate: victorias, dragones, fuerza de rivales.</p>`;
      }
      if (adm && t.estado !== "terminado") h += `<div class="t-acc"><button class="btn chico" data-t="sig">${t.estado === "inscripcion" ? "Cerrar inscripciones e iniciar Ronda 1" : (t.rondas.filter(r => !r.final).length >= t.rondasTotal ? "Iniciar Mesa Final (top 4)" : "Iniciar siguiente ronda")}</button><button class="btn chico" data-t="borrar">Eliminar torneo</button></div>`;
    }
    const d = el("div", null, h + "</div>");
    d.querySelectorAll("[data-t]").forEach(b => b.onclick = ev => {
      const k = b.dataset.t, m = +b.dataset.m;
      if (k === "alta" || k === "baja") socket.emit("tInscribir", { id: t.id, si: k === "alta" });
      if (k === "mesa") socket.emit("tMesa", { id: t.id, token: T.token });
      if (k === "ver") { T.abierto[t.id] = !ab; pintar(); }
      if (k === "sig") socket.emit("tSiguiente", { id: t.id });
      if (k === "rehacer") socket.emit("tRehacer", { id: t.id, mesa: m });
      if (k === "cerrar") confirmar(ev, "¿Cerrar esta mesa? Gana quien tenga más dragones ahora.", () => socket.emit("tCerrarMesa", { id: t.id, mesa: m }));
      if (k === "borrar") confirmar(ev, `¿Eliminar «${t.nombre}» para siempre?`, () => socket.emit("tEliminar", { id: t.id }));
    });
    return d;
  }

  function pintar() {
    pintarLogin();
    const Lst = document.getElementById("tLista"); Lst.innerHTML = "";
    if (!T.lista.length) Lst.innerHTML = `<p class="t-nota">Aún no hay torneos. ${T.yo && T.yo.admin ? "Crea el primero abajo." : "¡Pronto anunciaremos el primero!"}</p>`;
    T.lista.forEach(t => Lst.appendChild(pintarTorneo(t)));
    const Ad = document.getElementById("tAdmin");
    if (!(T.yo && T.yo.admin)) { Ad.innerHTML = ""; return; }
    if (Ad.dataset.listo) return; Ad.dataset.listo = 1;
    Ad.innerHTML = `<div class="t-item"><h4>➕ Nuevo torneo</h4><div class="t-form">
      <input id="tnNombre" maxlength="60" placeholder="Nombre (ej. Copa GEM de Primavera)"><input id="tnFecha" maxlength="40" placeholder="Fecha y hora (opcional)">
      <select id="tnRondas"><option value="2">2 rondas</option><option value="3" selected>3 rondas</option><option value="4">4 rondas</option><option value="5">5 rondas</option></select>
      <select id="tnSets"><option value="t1">Juego base</option><option value="t1,t2">Base + expansión</option></select>
      <button class="btn fuego" id="tnCrear">Crear</button></div></div>`;
    document.getElementById("tnCrear").onclick = () => {
      socket.emit("tCrear", { nombre: document.getElementById("tnNombre").value, fecha: document.getElementById("tnFecha").value, rondas: +document.getElementById("tnRondas").value, sets: document.getElementById("tnSets").value.split(",") });
      document.getElementById("tnNombre").value = "";
    };
  }
  pintar();
})();
