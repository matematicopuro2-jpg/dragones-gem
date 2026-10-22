// Música de fondo generada en el navegador (sin archivos): ambiente épico-medieval tranquilo.
(function () {
  let ctx = null, master = null, sonando = false, timer = null, paso = 0;
  const pref = () => { try { return localStorage.getItem("di_musica") !== "0"; } catch { return true; } };
  const guardar = v => { try { localStorage.setItem("di_musica", v ? "1" : "0"); } catch {} };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // Re dórico: progresión Dm – C – Bb – C
  const ACORDES = [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [48, 55, 60, 67]];
  const MELO = [74, 72, 69, 72, 74, 77, 76, 74, 72, 69, 67, 69, 70, 69, 67, 65];
  function crear() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    // eco suave
    const eco = ctx.createDelay(); eco.delayTime.value = .38; const fb = ctx.createGain(); fb.gain.value = .28;
    eco.connect(fb); fb.connect(eco); eco.connect(master); master.eco = eco;
  }
  function nota(f, t, dur, tipo, vol, destEco) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fil = ctx.createBiquadFilter();
    o.type = tipo; o.frequency.value = f; fil.type = "lowpass"; fil.frequency.value = tipo === "sawtooth" ? 900 : 2400;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.6, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(fil); fil.connect(g); g.connect(master); if (destEco) g.connect(master.eco);
    o.start(t); o.stop(t + dur + .05);
  }
  function tambor(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .35);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .5); o.connect(g); g.connect(master); o.start(t); o.stop(t + .55);
  }
  const PULSO = .5; // segundos por tiempo
  function programar() {
    const t0 = ctx.currentTime + .1;
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * PULSO, i = paso + k, compas = Math.floor(i / 8) % 4, ac = ACORDES[compas];
      if (i % 8 === 0) { ac.forEach((m, j) => nota(hz(m), t, PULSO * 8.4, j ? "triangle" : "sawtooth", j ? .035 : .05)); nota(hz(ac[0] - 12), t, PULSO * 8, "sine", .09); }
      if (i % 4 === 0) tambor(t, .22); else if (i % 4 === 2) tambor(t, .08);
      if (Math.floor(i / 32) % 2 === 1 && i % 2 === 0) nota(hz(MELO[(i / 2) % 16]), t, PULSO * 1.8, "triangle", .045, true);
      else if (i % 2 === 1) nota(hz(ac[(i >> 1) % 4] + 12), t, PULSO * .9, "sine", .025, true);
    }
    paso += 8;
  }
  function iniciar() {
    if (sonando) return; if (!ctx) crear(); ctx.resume();
    sonando = true; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(.55, ctx.currentTime + 2);
    programar(); timer = setInterval(programar, PULSO * 8 * 1000); pintar();
  }
  function parar() {
    if (!sonando) return; sonando = false; clearInterval(timer);
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + .8); pintar();
  }
  function pintar() { document.querySelectorAll(".btn-musica").forEach(b => { b.textContent = sonando ? "🎵" : "🔇"; b.title = sonando ? "Silenciar música" : "Activar música"; }); }
  window.MUSICA = { alternar() { if (sonando) { parar(); guardar(false); } else { iniciar(); guardar(true); } } };
  // El navegador solo deja sonar audio tras un toque: arranca con la primera interacción si está activada.
  const primera = () => { if (pref()) iniciar(); else pintar(); document.removeEventListener("pointerdown", primera, true); };
  document.addEventListener("pointerdown", primera, true);
  document.addEventListener("DOMContentLoaded", pintar); setTimeout(pintar, 500);
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (sonando) ctx.resume(); });
})();
