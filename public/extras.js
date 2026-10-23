// Catálogo de todas las cartas y reglamento completo.
(() => {
  const TIPOS = [["", "Todos los tipos"], ["cria", "🥚 Crías"], ["comun", "🐲 Dragones Comunes"], ["ancestral", "🐉 Dragones Ancestrales"], ["hechizo", "✨ Hechizos"], ["reliquia", "💎 Reliquias"], ["maldicion", "☠️ Maldiciones"], ["instantanea", "⚡ Instantáneas (¡GRRR!)"]];
  const F = { set: "", tipo: "", q: "" };
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  window.catalogo = function () {
    $("#modalTitulo").textContent = "📚 Todas las cartas";
    const b = $("#modalCuerpo"); b.innerHTML = "";
    const barra = el("div", "cat-barra", `<input id="catQ" placeholder="🔎 Buscar por nombre o texto…" value="${esc(F.q)}">
      <select id="catSet"><option value="">Todas las temporadas</option>${Object.entries(SETS || {}).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join("")}</select>
      <select id="catTipo">${TIPOS.map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`);
    const info = el("p", "sub"), grid = el("div", "cat-grid");
    b.append(barra, info, grid);
    barra.querySelector("#catSet").value = F.set; barra.querySelector("#catTipo").value = F.tipo;
    const pintar = () => {
      const lista = Object.values(DEF).filter(d => (!F.set || d.set === F.set) && (!F.tipo || d.tipo === F.tipo) && (!F.q || norm(d.nombre + " " + d.texto).includes(norm(F.q))));
      const copias = lista.reduce((a, d) => a + (d.cantidad || 1), 0);
      info.textContent = `${lista.length} cartas distintas · ${copias} copias en total. Pasa el dedo o el ratón sobre una carta para verla en grande.`;
      grid.innerHTML = "";
      for (const d of lista) {
        const w = el("div", "cat-item"); w.appendChild(cartaEl({ id: d.id }));
        w.appendChild(el("div", "cat-cant", (d.cantidad || 1) > 1 ? `×${d.cantidad} copias` : "×1 copia"));
        grid.appendChild(w);
      }
    };
    barra.querySelector("#catQ").oninput = e => { F.q = e.target.value; pintar(); };
    barra.querySelector("#catSet").onchange = e => { F.set = e.target.value; pintar(); };
    barra.querySelector("#catTipo").onchange = e => { F.tipo = e.target.value; pintar(); };
    pintar(); $("#modal").classList.remove("oculto");
  };

  window.reglamento = function () {
    $("#modalTitulo").textContent = "📖 Reglamento de Dragones Inestables";
    $("#modalCuerpo").innerHTML = `<div class="reglas">
<p class="sub">Toca un título para abrirlo. En el menú ⋯ de la partida también está la guía rápida.</p>
<details open><summary>🎯 Objetivo</summary>
<p>Sé el primero en reunir <b>7 dragones</b> en tu <b>Guarida</b> (6 si juegan 6 o más personas; el anfitrión puede cambiar la meta). Las <b>Crías</b> también cuentan como dragones. Si el mazo se acaba, gana quien tenga más dragones.</p></details>

<details><summary>🧩 Preparación</summary>
<ul><li>Cada jugador empieza con <b>1 Cría</b> en su Guarida y <b>5 cartas</b> en la mano.</li>
<li>Las demás Crías forman el <b>Criadero</b>. Nunca van al mazo ni a la mano.</li>
<li>El resto se baraja y forma el <b>mazo</b>. Las cartas descartadas van a las <b>Cenizas</b>.</li>
<li>Juego base: Temporada 1. Expansión opcional: Temporada 2 · Titanes (se juega junto con la base).</li></ul></details>

<details><summary>🔄 Tu turno, paso a paso</summary>
<ol><li><b>Inicio de turno.</b> Se activan los efectos ⏰ de tu Guarida: primero tus ventajas (en el orden que elijas) y luego las Maldiciones (en el orden en que se colocaron).</li>
<li><b>Robo.</b> Robas 1 carta del mazo.</li>
<li><b>Acción.</b> Haz <b>una</b> de estas dos cosas: <b>jugar 1 carta</b> de tu mano o <b>robar 1 carta</b> más.</li>
<li><b>Fin de turno.</b> Si tienes más de <b>7 cartas</b> en la mano, descarta hasta quedarte con 7.</li></ol></details>

<details><summary>🃏 Tipos de cartas</summary>
<ul><li><b>🥚 Cría de Dragón:</b> empieza en el Criadero. Si fuera a salir de una Guarida (sacrificada, calcinada o devuelta a la mano), regresa al Criadero.</li>
<li><b>🐲 Dragón Común:</b> un dragón sin efecto que se coloca en tu Guarida.</li>
<li><b>🐉 Dragón Ancestral:</b> dragón con un poder especial mientras está en tu Guarida.</li>
<li><b>✨ Hechizo:</b> efecto de un solo uso. Después de resolverse va a las Cenizas.</li>
<li><b>💎 Reliquia:</b> una ventaja que se queda en tu Guarida.</li>
<li><b>☠️ Maldición:</b> una desventaja que colocas en la Guarida de <b>otro</b> jugador (o en la tuya, si la carta lo permite).</li>
<li><b>⚡ Instantánea (¡GRRR!):</b> la única carta que se juega <b>fuera de tu turno</b>, como respuesta a otra carta.</li></ul></details>

<details><summary>⚡ ¡GRRR! y Rugido Supremo</summary>
<ul><li>Cuando alguien juega una carta, los demás tienen unos segundos para responder con un <b>¡GRRR!</b>. Esto <b>anula</b> la carta, que va a las Cenizas sin efecto.</li>
<li>Se puede responder a un ¡GRRR! con otro ¡GRRR!: se forma una cadena y gana el último que no fue anulado.</li>
<li>No puedes responderte a ti mismo.</li>
<li>Un <b>Rugido Supremo</b> no puede ser anulado por nada.</li>
<li>Algunas cartas impiden jugar ¡GRRR! a quien las tiene en su Guarida.</li></ul></details>

<details><summary>📘 Palabras clave</summary>
<ul><li><b>CALCINAR:</b> mover una carta de la Guarida de <b>otro</b> jugador a las Cenizas.</li>
<li><b>SACRIFICAR:</b> mover una carta de <b>tu</b> Guarida a las Cenizas.</li>
<li><b>DESCARTAR:</b> mover una carta de tu mano a las Cenizas.</li>
<li><b>SAQUEAR:</b> tomar una carta de otro jugador (de su Guarida o de su mano, según la carta) y quedártela.</li>
<li><b>DEVOLVER:</b> regresar una carta de una Guarida a la mano de su dueño.</li>
<li><b>«Puedes»:</b> el efecto es opcional; el juego te pregunta si quieres usarlo.</li>
<li><b>⏰ Al inicio de tu turno:</b> el efecto se activa en el paso 1 de cada uno de tus turnos.</li></ul></details>

<details><summary>👥 Variante oficial para 2 jugadores</summary>
<p>Si el anfitrión la activa, se retiran del mazo algunas cartas que no funcionan bien entre dos (por ejemplo, las que afectan a «todos los demás jugadores») y cada uno empieza con un <b>¡GRRR!</b> extra en la mano.</p></details>

<details><summary>🫙 Regla de la casa: Vacuidad</summary>
<p>Opción del anfitrión (activada por defecto). Si una carta te pide pagar un costo (por ejemplo, descartar o sacrificar algo) y <b>no puedes pagarlo completo</b>, no pagas nada y el efecto <b>ocurre igual</b>: es todo o nada. La mesa lo indica con el aviso 🫙 VACUIDAD. Desactívala para jugar con las reglas puras, donde sin pagar el costo no hay efecto.</p></details>

<details><summary>🏆 Torneos GEM</summary>
<ul><li>Para jugar torneos entras con tu correo y un código de 6 dígitos.</li>
<li>Se juegan rondas <b>suizas</b> en mesas de 3 o 4 personas. Desde la ronda 2, quienes van parejos en la tabla se enfrentan entre sí.</li>
<li><b>Puntos por mesa:</b> 1º 4 pts · 2º 2 · 3º 1 · 4º 0. En mesas de 3: 4 / 2 / 0.</li>
<li><b>Desempate:</b> victorias, luego dragones acumulados y luego la fuerza de los rivales.</li>
<li>Al final, los 4 mejores juegan la <b>Mesa Final</b>, y quien la gana es el 👑 campeón.</li></ul></details>

<details><summary>💡 Consejos</summary>
<ul><li>Guarda un ¡GRRR! para cuando alguien esté a punto de ganar.</li>
<li>Las Maldiciones frenan al líder; las Reliquias te dan ventaja a largo plazo.</li>
<li>Si algo quedó mal, el <b>modo manual</b> (menú ⋯) permite mover cualquier carta.</li></ul></details>
</div>`;
    $("#modal").classList.remove("oculto");
  };

  const fila = el("div", "fila extras-botones", `<button class="btn" id="btnCatalogo">📚 Ver todas las cartas</button><button class="btn" id="btnReglas">📖 Reglamento</button>`);
  const ent = document.querySelector("#portada .entrada"); if (ent) ent.after(fila);
  $("#btnCatalogo").onclick = catalogo; $("#btnReglas").onclick = reglamento;
})();
