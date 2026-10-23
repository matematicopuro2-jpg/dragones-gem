// Almacenamiento persistente sencillo (clave → JSON).
// Si existe DATABASE_URL (p. ej. Supabase/Postgres) guarda ahí; si no, en data/almacen.json (solo para pruebas locales).
const fs = require("fs"), path = require("path");
const ARCH = path.join(__dirname, "data", "almacen.json");
let pool = null, cache = {}, listo = false, pendientes = new Set(), timer = null;

async function iniciar() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
    await pool.query("create table if not exists kv (clave text primary key, valor jsonb not null, actualizado timestamptz default now())");
    const r = await pool.query("select clave, valor from kv");
    for (const f of r.rows) cache[f.clave] = f.valor;
    console.log(`  Base de datos conectada (${r.rows.length} registros).`);
  } else {
    try { cache = JSON.parse(fs.readFileSync(ARCH, "utf8")); } catch { cache = {}; }
    console.log("  Sin DATABASE_URL: datos guardados en data/almacen.json (se pierden si el servidor se reinicia en la nube).");
  }
  listo = true;
}
const get = (k, def) => (k in cache ? cache[k] : def);
function set(k, v) { cache[k] = v; pendientes.add(k); clearTimeout(timer); timer = setTimeout(volcar, 400); }
async function volcar() {
  const ks = [...pendientes]; pendientes.clear();
  if (pool) {
    for (const k of ks) {
      try { await pool.query("insert into kv (clave, valor, actualizado) values ($1, $2, now()) on conflict (clave) do update set valor = excluded.valor, actualizado = now()", [k, JSON.stringify(cache[k])]); }
      catch (e) { console.error("almacen", e.message); pendientes.add(k); }
    }
  } else {
    try { fs.mkdirSync(path.dirname(ARCH), { recursive: true }); fs.writeFileSync(ARCH, JSON.stringify(cache)); } catch (e) { console.error("almacen", e.message); }
  }
}
module.exports = { iniciar, get, set, volcar, persistente: () => !!pool, listo: () => listo };
