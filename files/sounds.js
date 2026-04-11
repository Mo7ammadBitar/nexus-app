/**
 * sounds.js — Web Audio API sound effects (no external files needed)
 * All sounds synthesized on-the-fly.
 */

const Sounds = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone({ freq = 440, type = "sine", vol = 0.3, dur = 0.15, attack = 0.005, decay = 0.1 }) {
    if (!enabled) return;
    try {
      const ac  = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ac.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + dur + 0.01);
    } catch (e) { /* silent fail */ }
  }

  function chord(freqs, opts = {}) {
    freqs.forEach(f => tone({ freq: f, ...opts }));
  }

  return {
    setEnabled(v) { enabled = v; },
    isEnabled()   { return enabled; },

    click() {
      tone({ freq: 600, type: "triangle", vol: 0.15, dur: 0.08 });
    },

    select() {
      tone({ freq: 880, type: "sine", vol: 0.2, dur: 0.1 });
      setTimeout(() => tone({ freq: 1100, type: "sine", vol: 0.15, dur: 0.08 }), 60);
    },

    win() {
      // Ascending fanfare
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => setTimeout(() => tone({ freq: f, vol: 0.25, dur: 0.2, type: "triangle" }), i * 80));
    },

    lose() {
      // Descending womp
      tone({ freq: 330, type: "sawtooth", vol: 0.2, dur: 0.15 });
      setTimeout(() => tone({ freq: 220, type: "sawtooth", vol: 0.2, dur: 0.2 }), 100);
      setTimeout(() => tone({ freq: 165, type: "sawtooth", vol: 0.15, dur: 0.3 }), 200);
    },

    draw() {
      tone({ freq: 440, type: "sine", vol: 0.18, dur: 0.25 });
      tone({ freq: 440, type: "square", vol: 0.05, dur: 0.25 });
    },

    achievement() {
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => setTimeout(() => tone({ freq: f, vol: 0.3, dur: 0.25, type: "triangle" }), i * 60));
    },

    navigate() {
      tone({ freq: 750, type: "sine", vol: 0.12, dur: 0.1 });
    },

    reset() {
      tone({ freq: 300, type: "triangle", vol: 0.2, dur: 0.2 });
      setTimeout(() => tone({ freq: 400, type: "triangle", vol: 0.2, dur: 0.15 }), 100);
    },
  };
})();
