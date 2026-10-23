// Cuentas con correo + código de 6 dígitos.
// Envío de correos: BREVO_API_KEY (+ MAIL_FROM) o RESEND_API_KEY (+ MAIL_FROM).
// Sin servicio de correo y con DEV_CODIGOS=1, el código se devuelve en la respuesta (solo para pruebas).
const crypto = require("crypto");
const A = require("./almacen");
const h = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const codigos = new Map(); // email -> {hash, vence, intentos, ultimo}
const normal = e => String(e || "").trim().toLowerCase();
const valido = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
const admins = () => (process.env.ADMIN_EMAILS || "").split(",").map(normal).filter(Boolean);

async function enviarCorreo(para, codigo) {
  const asunto = `Tu código para Dragones Inestables: ${codigo}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:12px">
    <h2 style="color:#3a7fc8;margin:0 0 8px">🐉 Dragones Inestables · GEM</h2>
    <p>Tu código para entrar es:</p>
    <p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#e8782a;margin:10px 0">${codigo}</p>
    <p style="color:#666;font-size:13px">Vence en 10 minutos. Si no lo pediste, ignora este correo.</p></div>`;
  const from = process.env.MAIL_FROM;
  if (process.env.BREVO_API_KEY) {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: from, name: "Dragones Inestables GEM" }, to: [{ email: para }], subject: asunto, htmlContent: html }) });
    if (!r.ok) throw new Error("Brevo " + r.status + " " + (await r.text()).slice(0, 200));
    return "correo";
  }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + process.env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: from || "onboarding@resend.dev", to: [para], subject: asunto, html }) });
    if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()).slice(0, 200));
    return "correo";
  }
  if (process.env.DEV_CODIGOS === "1") return "prueba";
  throw new Error("El servidor aún no tiene configurado el envío de correos.");
}

async function pedirCodigo(email) {
  email = normal(email);
  if (!valido(email)) return { error: "Escribe un correo válido." };
  const prev = codigos.get(email);
  if (prev && Date.now() - prev.ultimo < 45e3) return { error: "Espera unos segundos antes de pedir otro código." };
  const codigo = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
  codigos.set(email, { hash: h(email + codigo), vence: Date.now() + 10 * 60e3, intentos: 0, ultimo: Date.now() });
  try {
    const via = await enviarCorreo(email, codigo);
    const nuevo = !A.get("usuarios", {})[email];
    return via === "prueba" ? { ok: true, nuevo, codigoPrueba: codigo } : { ok: true, nuevo };
  } catch (e) { console.error(e.message); codigos.delete(email); return { error: e.message.startsWith("El servidor") ? e.message : "No se pudo enviar el correo. Intenta de nuevo en un rato." }; }
}

function verificar(email, codigo, nombre) {
  email = normal(email); const c = codigos.get(email);
  if (!c || Date.now() > c.vence) return { error: "El código venció o no existe. Pide uno nuevo." };
  if (++c.intentos > 5) { codigos.delete(email); return { error: "Demasiados intentos. Pide un código nuevo." }; }
  if (h(email + String(codigo || "").trim()) !== c.hash) return { error: "Código incorrecto." };
  codigos.delete(email);
  const usuarios = A.get("usuarios", {});
  if (!usuarios[email]) {
    nombre = String(nombre || "").replace(/\s+/g, " ").trim().slice(0, 18);
    if (nombre.length < 2) return { error: "Escribe tu nombre de jugador (mínimo 2 letras).", pideNombre: true };
    const tomado = Object.values(usuarios).some(u => u.nombre.toLowerCase() === nombre.toLowerCase());
    if (tomado) return { error: "Ese nombre de jugador ya está en uso. Elige otro.", pideNombre: true };
    usuarios[email] = { nombre, creado: Date.now() }; A.set("usuarios", usuarios);
  }
  const token = crypto.randomBytes(24).toString("hex");
  const ses = A.get("sesiones", {}); ses[h(token)] = { email, t: Date.now() }; A.set("sesiones", ses);
  return { ok: true, token, usuario: publico(email) };
}
function deToken(token) {
  if (!token) return null; const s = A.get("sesiones", {})[h(token)];
  if (!s || Date.now() - s.t > 180 * 864e5) return null;
  return publico(s.email);
}
function cerrar(token) { const ses = A.get("sesiones", {}); delete ses[h(token)]; A.set("sesiones", ses); }
function publico(email) {
  const u = A.get("usuarios", {})[email]; if (!u) return null;
  return { email, nombre: u.nombre, pid: "u_" + h(email).slice(0, 16), admin: admins().includes(email) };
}
module.exports = { pedirCodigo, verificar, deToken, cerrar, publico, normal };
