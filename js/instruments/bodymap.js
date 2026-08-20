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

/* Twelve auscultation positions, in the manikin's own viewBox coordinates
   (0 0 220 120). The manikin is supine with the head to the right, matching
   the base-unit drawing from the capstone: higher x is toward the head, and
   the patient's right side is the upper half of the figure.

   These live inside the SVG rather than as an HTML overlay, so they cannot
   drift out of register when the figure is scaled or letterboxed. */
const POSITIONS = [
  { id: 1,  x: 118, y: 50, kind: 'heart', site: 'Aortic',        note: 'R 2nd intercostal',     finding: 'Normal S1 S2' },
  { id: 2,  x: 118, y: 70, kind: 'heart', site: 'Pulmonic',      note: 'L 2nd intercostal',     finding: 'Split S2 on inspiration' },
  { id: 3,  x: 100, y: 66, kind: 'heart', site: 'Tricuspid',     note: 'L 4th, sternal border', finding: 'Normal S1 S2' },
  { id: 4,  x: 88,  y: 78, kind: 'heart', site: 'Mitral / apex', note: 'L 5th, midclavicular',  finding: 'Systolic murmur' },

  { id: 5,  x: 126, y: 38, kind: 'lung',  site: 'R upper lobe',  note: 'Anterior',       finding: 'Clear vesicular' },
  { id: 6,  x: 126, y: 82, kind: 'lung',  site: 'L upper lobe',  note: 'Anterior',       finding: 'Clear vesicular' },
  { id: 7,  x: 102, y: 34, kind: 'lung',  site: 'R middle lobe', note: 'Anterior',       finding: 'Coarse crackles' },
  { id: 8,  x: 102, y: 86, kind: 'lung',  site: 'L lingula',     note: 'Anterior',       finding: 'Clear vesicular' },
  { id: 9,  x: 70,  y: 42, kind: 'lung',  site: 'R lower lobe',  note: 'Anterior base',  finding: 'Fine crackles' },
  { id: 10, x: 70,  y: 78, kind: 'lung',  site: 'L lower lobe',  note: 'Anterior base',  finding: 'Expiratory wheeze' },
  { id: 11, x: 46,  y: 36, kind: 'lung',  site: 'R lateral',     note: 'Mid-axillary',   finding: 'Diminished' },
  { id: 12, x: 46,  y: 84, kind: 'lung',  site: 'L lateral',     note: 'Mid-axillary',   finding: 'Clear vesicular' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

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
        <svg viewBox="0 0 220 120" class="manikin" role="group"
             aria-label="Twelve RFID auscultation positions on the manikin">
          <!-- Base unit: supine, head to the right, per the capstone drawing -->
          <path class="mk-body" d="M16 26 H118 C132 26 140 34 146 46 H166 V74 H146
                                   C140 86 132 94 118 94 H16 Z"/>
          <circle class="mk-body" cx="190" cy="60" r="26"/>
          <!-- Auscultation module footprint: the region the tags sit under -->
          <rect class="mk-module" x="40" y="30" width="98" height="60" rx="2"/>
          <path class="mk-midline" d="M40 60 H138"/>
          <g class="mk-points"></g>
        </svg>
        <p class="bodymap-hint">Probe a position</p>
        <figure class="bm-hw">
          <img src="assets/cast-probe.webp" width="560" height="760" loading="lazy" decoding="async"
               alt="The actual probe: an RC522 RFID reader in a 3D-printed handheld housing.">
          <figcaption>The probe. RC522 in a printed housing.</figcaption>
        </figure>
      </div>

      <div class="bodymap-scope">
        <!-- Status line in the shape the real Flask interface uses: a module
             banner, then timestamped events as tags are read. -->
        <div class="scope-banner">Auscultation module active &middot; ready for examination</div>
        <div class="scope-head">
          <span class="scope-site">—</span>
          <span class="scope-tag">TAG —</span>
        </div>
        <canvas class="scope-canvas"></canvas>
        <div class="scope-log" role="log" aria-live="polite"></div>
        <div class="scope-foot">
          <span class="scope-note">12 tags · 28 scenarios</span>
          <span class="scope-finding">Select a position</span>
        </div>
      </div>
    </div>
  `;

  const pointsHost = container.querySelector('.mk-points');
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

  /* ---- points ----
     Built as SVG nodes in the manikin's own coordinate space, so a tag always
     lands exactly where it sits on the module regardless of how the figure is
     scaled. The hit target is a transparent circle larger than the visible
     dot, because a 3px dot is not a pointer target. */
  POSITIONS.forEach((p) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `bp bp--${p.kind}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${p.site}, ${p.note}. ${p.finding}.`);
    g.innerHTML = `
      <circle class="bp-halo" cx="${p.x}" cy="${p.y}" r="7"/>
      <circle class="bp-dot"  cx="${p.x}" cy="${p.y}" r="3.1"/>
      <circle class="bp-hit"  cx="${p.x}" cy="${p.y}" r="9"/>
      <text class="bp-id" x="${p.x + 8}" y="${p.y - 5}">${p.id}</text>
    `;

    const pick = () => setActive(p, g);
    g.addEventListener('pointerenter', pick);
    g.addEventListener('focus', pick);
    g.addEventListener('click', pick);
    pointsHost.appendChild(g);
  });

  const buttons = Array.from(pointsHost.children);

  const logEl = container.querySelector('.scope-log');

  function setActive(p, btn) {
    if (active === p) return;
    active = p;
    buttons.forEach((b) => b.classList.toggle('is-live', b === btn));

    siteEl.textContent = p.site;
    tagEl.textContent = `TAG ${String(p.id).padStart(2, '0')}`;
    findingEl.textContent = p.finding;
    noteEl.textContent = p.note;

    // The real interface logs each read with a wall-clock time. Same here.
    const t = new Date().toLocaleTimeString('en-CA', { hour12: false });
    const row = document.createElement('div');
    row.className = 'scope-log-row';
    row.innerHTML = `<span>${t}</span> Tag ${String(p.id).padStart(2, '0')} read &middot; ${p.site} &middot; ${p.finding}`;
    logEl.prepend(row);
    while (logEl.children.length > 4) logEl.lastElementChild.remove();

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
    // Opacity only. Scaling an SVG <g> from zero needs a transform box the
    // group does not have, and lands the dots off their coordinates.
    gsap.from(buttons, {
      opacity: 0,
      duration: 0.7,
      stagger: { each: 0.035, from: 'random' },
      ease: dampedEase(DAMPING.data, 1.0),
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
