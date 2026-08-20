/* ============================================================================
   INSTRUMENT — CAST body map
   ----------------------------------------------------------------------------
   The real system: a digital stethoscope is placed on the manikin, an RFID tag
   under the skin identifies the position, and the scenario logic plays the
   sound that belongs at that spot.

   So the instrument is the manikin. Probe a position and you get that
   position's trace, synthesised from what the sound actually is — S1/S2 for a
   heart point, a breath envelope for a lung field, with the abnormality layered
   on top. No audio files: the waveform is generated from the description.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* Twelve auscultation positions. x/y are percentages of the torso box. */
const POSITIONS = [
  { id: 1,  x: 38, y: 24, kind: 'heart', site: 'Aortic',        note: 'R 2nd intercostal',  finding: 'Normal S1 S2' },
  { id: 2,  x: 62, y: 24, kind: 'heart', site: 'Pulmonic',      note: 'L 2nd intercostal',  finding: 'Split S2 on inspiration' },
  { id: 3,  x: 56, y: 38, kind: 'heart', site: 'Tricuspid',     note: 'L 4th, sternal border', finding: 'Normal S1 S2' },
  { id: 4,  x: 64, y: 46, kind: 'heart', site: 'Mitral / apex', note: 'L 5th, midclavicular', finding: 'Systolic murmur' },

  { id: 5,  x: 30, y: 18, kind: 'lung',  site: 'R upper lobe',  note: 'Anterior',           finding: 'Clear vesicular' },
  { id: 6,  x: 70, y: 18, kind: 'lung',  site: 'L upper lobe',  note: 'Anterior',           finding: 'Clear vesicular' },
  { id: 7,  x: 27, y: 34, kind: 'lung',  site: 'R middle lobe', note: 'Anterior',           finding: 'Coarse crackles' },
  { id: 8,  x: 73, y: 34, kind: 'lung',  site: 'L lingula',     note: 'Anterior',           finding: 'Clear vesicular' },
  { id: 9,  x: 25, y: 52, kind: 'lung',  site: 'R lower lobe',  note: 'Anterior base',      finding: 'Fine crackles' },
  { id: 10, x: 75, y: 52, kind: 'lung',  site: 'L lower lobe',  note: 'Anterior base',      finding: 'Expiratory wheeze' },
  { id: 11, x: 20, y: 42, kind: 'lung',  site: 'R lateral',     note: 'Mid-axillary',       finding: 'Diminished' },
  { id: 12, x: 80, y: 42, kind: 'lung',  site: 'L lateral',     note: 'Mid-axillary',       finding: 'Clear vesicular' },
];

/* ---------------------------------------------------------------------------
   Waveform synthesis
   ---------------------------------------------------------------------------
   Each finding produces a different shape. These are drawn, not played, but
   they are built from the actual structure of the sound: a heart cycle is two
   short thumps with a gap; a breath is a long noisy envelope; crackles are
   discrete impulses on the inspiratory limb.
   ------------------------------------------------------------------------- */

function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 * 2 - 1;
  };
}

function sample(pos, t) {
  const rnd = noise(pos.id * 7919);
  if (pos.kind === 'heart') {
    // ~72 bpm: S1 at phase 0, S2 at ~0.34 of the cycle.
    const cycle = t % 1;
    const thump = (phase, width, amp) => {
      const d = cycle - phase;
      return Math.exp(-(d * d) / (width * width)) * Math.sin(d * 240) * amp;
    };
    let v = thump(0.02, 0.028, 1.0) + thump(0.34, 0.020, 0.72);
    if (pos.finding.includes('murmur')) {
      // Murmur fills the gap between S1 and S2 with turbulence.
      if (cycle > 0.05 && cycle < 0.33) v += rnd() * 0.30;
    }
    if (pos.finding.includes('Split')) v += thump(0.375, 0.014, 0.42);
    return v;
  }

  // Lung: one respiration every ~2 units, inspiration longer than expiration.
  const cycle = (t / 2) % 1;
  const insp = cycle < 0.55;
  const env = insp
    ? Math.sin((cycle / 0.55) * Math.PI) * 0.85
    : Math.sin(((cycle - 0.55) / 0.45) * Math.PI) * 0.5;

  let v = rnd() * env;

  if (pos.finding.includes('crackles')) {
    const coarse = pos.finding.includes('Coarse');
    const rate = coarse ? 26 : 60;
    const k = Math.floor(t * rate);
    const local = t * rate - k;
    if (insp && local < 0.12) {
      v += Math.exp(-local * 40) * (coarse ? 1.15 : 0.7) * (k % 3 ? 1 : -1);
    }
  }
  if (pos.finding.includes('wheeze') && !insp) {
    v += Math.sin(t * 320) * env * 0.9;
  }
  if (pos.finding.includes('Diminished')) v *= 0.35;

  return v;
}

/* ------------------------------------------------------------------- mount */

export function mount(container, system) {
  container.innerHTML = `
    <div class="bodymap">
      <div class="bodymap-figure">
        <svg viewBox="0 0 200 260" class="torso" aria-hidden="true">
          <path class="torso-outline" d="
            M100 10 c-13 0-22 8-24 20 l-2 12 c-16 4-30 12-34 22 l-8 46 c-1 8 3 12 9 13
            l8 1 -5 96 c-1 9 4 14 13 14 h86 c9 0 14-5 13-14 l-5-96 8-1 c6-1 10-5 9-13
            l-8-46 c-4-10-18-18-34-22 l-2-12 c-2-12-11-20-24-20 z"/>
          <path class="torso-sternum" d="M100 52 V150"/>
          <path class="torso-ribs" d="M64 74 q36 14 72 0 M60 96 q40 16 80 0 M62 118 q38 14 76 0"/>
        </svg>
        <div class="bodymap-points" role="group" aria-label="Twelve RFID auscultation positions"></div>
        <p class="bodymap-hint">Probe a position</p>
      </div>

      <div class="bodymap-scope">
        <div class="scope-head">
          <span class="scope-site">—</span>
          <span class="scope-tag">TAG —</span>
        </div>
        <canvas class="scope-canvas"></canvas>
        <div class="scope-foot">
          <span class="scope-note">12 tags · 28 scenarios</span>
          <span class="scope-finding">Select a position</span>
        </div>
      </div>
    </div>
  `;

  const pointsHost = container.querySelector('.bodymap-points');
  const canvas = container.querySelector('.scope-canvas');
  const siteEl = container.querySelector('.scope-site');
  const tagEl = container.querySelector('.scope-tag');
  const findingEl = container.querySelector('.scope-finding');
  const noteEl = container.querySelector('.scope-note');
  const ctx = canvas.getContext('2d');

  let active = POSITIONS[3];   // apex, so the trace opens on something with shape
  let raf = 0;
  let t0 = 0;
  let alive = true;

  /* ---- points ---- */
  POSITIONS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `bp bp--${p.kind}`;
    b.style.left = `${p.x}%`;
    b.style.top = `${p.y}%`;
    b.dataset.id = String(p.id);
    b.setAttribute('aria-label', `${p.site}, ${p.note}. ${p.finding}.`);
    b.innerHTML = `<span class="bp-dot"></span><span class="bp-id">${p.id}</span>`;

    const pick = () => setActive(p, b);
    b.addEventListener('pointerenter', pick);
    b.addEventListener('focus', pick);
    b.addEventListener('click', pick);
    pointsHost.appendChild(b);
  });

  const buttons = Array.from(pointsHost.children);

  function setActive(p, btn) {
    if (active === p) return;
    active = p;
    buttons.forEach((b) => b.classList.toggle('is-live', b === btn));

    siteEl.textContent = p.site;
    tagEl.textContent = `TAG ${String(p.id).padStart(2, '0')}`;
    findingEl.textContent = p.finding;
    noteEl.textContent = p.note;

    if (gsap && !reduced()) {
      // The readout is a physical gauge: it rings when it moves.
      gsap.fromTo([siteEl, findingEl],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: dampedEase(DAMPING.data, 1.2), stagger: 0.04 }
      );
    }
  }

  /* ---- scope ---- */
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  function draw(now) {
    if (!alive) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;

    const w = canvas.width;
    const h = canvas.height;
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--stabilize').trim() || '#4DD9E8';
    const grid = css.getPropertyValue('--hairline').trim() || '#262A31';

    ctx.clearRect(0, 0, w, h);

    // Graticule
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) { const x = (w / 8) * i; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let i = 1; i < 4; i++) { const y = (h / 4) * i; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Trace. Frozen under reduced motion so it is still legible without moving.
    const span = 2.2;
    const base = reduced() ? 0 : t;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.4, w / 900);
    ctx.beginPath();
    const N = Math.min(w, 1400);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const v = sample(active, base + u * span);
      const x = u * w;
      const y = h / 2 - v * h * 0.36;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    raf = requestAnimationFrame(draw);
  }

  size();
  const onResize = () => size();
  window.addEventListener('resize', onResize, { passive: true });
  setActive(POSITIONS[3], buttons[3]);
  raf = requestAnimationFrame(draw);

  if (gsap && !reduced()) {
    gsap.from(buttons, {
      scale: 0,
      opacity: 0,
      duration: 0.8,
      stagger: { each: 0.035, from: 'random' },
      ease: dampedEase(DAMPING.reactive, 1.0),
    });
  }

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      container.innerHTML = '';
    },
  };
}
