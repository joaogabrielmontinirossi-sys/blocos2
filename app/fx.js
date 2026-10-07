'use strict';
/* Blocos 2 — efeitos: animações das peças, sons, vibração e confete. */

const FX = {
  q: [], ctx: null, novo: '',
  on: () => S.set.anim !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  // a tela é redesenhada inteira; as animações ficam na fila e entram depois do desenho
  mark(id, cls) { FX.q.push([id, cls]); },
  flush() {
    const q = FX.q; FX.q = []; FX.novo = '';
    if (!FX.on()) return;
    q.forEach(([id, cls]) => document.querySelectorAll(`#main [data-id="${id}"].bk, #main [data-fx="${id}"]`).forEach(el => FX.play(el, cls)));
  },
  play(el, cls) { if (!el || !FX.on()) return; el.classList.remove('fx-' + cls); void el.offsetWidth; el.classList.add('fx-' + cls); el.addEventListener('animationend', () => el.classList.remove('fx-' + cls), { once: true }); },
  tone(freqs, dur, type) {
    if (!S.set.som) return;
    try {
      const ctx = FX.ctx || (FX.ctx = new (window.AudioContext || window.webkitAudioContext)());
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * dur;
        o.type = type || 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) {}
  },
  vib(p) { if (S.set.vibra && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} },
  snap() { FX.tone([170, 540], 0.07, 'square'); FX.vib(18); },          // peça encaixando
  free() { FX.tone([660, 880], 0.09); },                               // tudo de dentro encaixado
  no() { FX.tone([140], 0.16, 'sawtooth'); FX.vib([30, 40, 30]); },    // não cabe
  pluck() { FX.tone([420], 0.05); },                                   // peça nova
  crack() { FX.tone([320, 240], 0.05, 'square'); },                    // desmontar
  win() { FX.tone([523, 659, 784, 1047], 0.13); FX.vib([40, 60, 40, 60, 120]); },
  confete() {
    if (!FX.on()) return;
    const box = document.createElement('div'), cores = S.cores.map(t => t.cor);
    box.className = 'confete';
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;width:${12 + Math.random() * 26}px;background:${cores[i % cores.length] || '#2D7DD2'};animation-delay:${Math.random() * 0.7}s;animation-duration:${1.6 + Math.random() * 1.4}s;--r:${(Math.random() * 720 - 360) | 0}deg`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3800);
  },
};
