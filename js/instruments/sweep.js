/* ============================================================================
   INSTRUMENT — Resonance frequency sweep
   ----------------------------------------------------------------------------
   The game's core verb, playable in a browser. Three parts of a machine, each
   with its own natural frequency and damping. Sweep the driver; when you land
   near a part's resonance its amplitude climbs by the real magnification
   factor for a driven damped oscillator,

       M(r) = 1 / sqrt( (1 - r^2)^2 + (2*zeta*r)^2 ),     r = w / wn

   which peaks at 1/(2*zeta). Hold it there and that part accumulates fatigue
   until it fails. Detune and it recovers. That is Overload and Stabilize.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* Machine parts. wn is in the same arbitrary units as the driver. */
const PARTS = [
  { id: 'strut',   label: 'Support strut',  wn: 0.24, zeta: 0.045, x: 22, y: 30, w: 14, h: 46 },
  { id: 'housing', label: 'Core housing',   wn: 0.52, zeta: 0.075, x: 42, y: 22, w: 30, h: 56 },
  { id: 'fin',     label: 'Dissipator fin', wn: 0.79, zeta: 0.035, x: 78, y: 34, w: 11, h: 38 },
];

/** Magnification factor at driver frequency w for a part. */
function magnification(part, w) {
  const r = w / part.wn;
  const a = 1 - r * r;
  const b = 2 * part.zeta * r;
  return 1 / Math.sqrt(a * a + b * b);
}

/** Peak magnification, used to normalise the display to 0..1. */
function peak(part) {
  return 1 / (2 * part.zeta * Math.sqrt(1 - part.zeta * part.zeta));
}

export function mount(container, system) {
  container.innerHTML = `
    <div class="sweep">
      <div class="sweep-stage">
        <svg class="sweep-machine" viewBox="0 0 100 100" aria-hidden="true">
          <g class="machine-frame">
            <path d="M10 82 H90" />
            <path d="M18 82 V70 M82 82 V70" />
          </g>
          <g class="machine-parts"></g>
        </svg>
        <div class="sweep-parts-status" role="status" aria-live="polite"></div>
      </div>

      <div class="sweep-controls">
        <canvas class="sweep-curve"></canvas>
        <label class="sweep-drive">
          <span class="sweep-drive-label">Driver frequency</span>
          <input class="sweep-slider" type="range" min="0" max="1000" value="90"
                 aria-label="Driver frequency. Sweep to find each part's resonance.">
        </label>
        <p class="sweep-hint">Sweep until a part starts to ring. Hold it there.</p>
      </div>
    </div>
  `;

  const partsG = container.querySelector('.machine-parts');
  const statusHost = container.querySelector('.sweep-parts-status');
  const slider = container.querySelector('.sweep-slider');
  const curve = container.querySelector('.sweep-curve');
  const cctx = curve.getContext('2d');
  const hint = container.querySelector('.sweep-hint');

  /* Per-part live state. */
  const state = PARTS.map((p) => ({ part: p, fatigue: 0, failed: false, amp: 0 }));

  /* ---- build the parts ---- */
  state.forEach((s) => {
    const p = s.part;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'mpart');
    g.dataset.id = p.id;
    g.innerHTML = `
      <rect class="mpart-body" x="${p.x - p.w / 2}" y="${p.y}" width="${p.w}" height="${p.h}" rx="1"/>
      <path class="mpart-crack" d="" fill="none"/>
    `;
    partsG.appendChild(g);
    s.g = g;
    s.body = g.querySelector('.mpart-body');
    s.crack = g.querySelector('.mpart-crack');

    const row = document.createElement('div');
    row.className = 'pstat';
    row.dataset.id = p.id;
    row.innerHTML = `
      <span class="pstat-name">${p.label}</span>
      <span class="pstat-bar"><i style="width:0%"></i></span>
      <span class="pstat-val">OK</span>
    `;
    statusHost.appendChild(row);
    s.row = row;
    s.bar = row.querySelector('.pstat-bar i');
    s.val = row.querySelector('.pstat-val');
  });

  let w = 0.09;
  let raf = 0;
  let alive = true;
  let last = 0;
  let announced = false;

  slider.addEventListener('input', () => {
    w = Number(slider.value) / 1000;
  });

  /* ---- response curve ---- */
  function sizeCurve() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    curve.width = Math.round(curve.clientWidth * dpr);
    curve.height = Math.round(curve.clientHeight * dpr);
  }

  function drawCurve() {
    const cw = curve.width;
    const ch = curve.height;
    const css = getComputedStyle(document.documentElement);
    const stable = css.getPropertyValue('--stabilize').trim() || '#4DD9E8';
    const over = css.getPropertyValue('--overload').trim() || '#FF3B5C';
    const grid = css.getPropertyValue('--hairline').trim() || '#262A31';
    const muted = css.getPropertyValue('--muted').trim() || '#7C818A';

    cctx.clearRect(0, 0, cw, ch);

    cctx.strokeStyle = grid;
    cctx.lineWidth = 1;
    cctx.beginPath();
    for (let i = 1; i < 6; i++) { const x = (cw / 6) * i; cctx.moveTo(x, 0); cctx.lineTo(x, ch); }
    cctx.stroke();

    // One response curve per surviving part, normalised to its own peak.
    state.forEach((s) => {
      cctx.strokeStyle = s.failed ? muted : stable;
      cctx.globalAlpha = s.failed ? 0.3 : 0.85;
      cctx.lineWidth = Math.max(1.2, cw / 1000);
      cctx.beginPath();
      const pk = peak(s.part);
      for (let i = 0; i <= 300; i++) {
        const f = (i / 300);
        const m = Math.min(magnification(s.part, Math.max(f, 0.001)) / pk, 1);
        const x = f * cw;
        const y = ch - m * ch * 0.88 - ch * 0.06;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
    });
    cctx.globalAlpha = 1;

    // Driver position
    const dx = w * cw;
    cctx.strokeStyle = over;
    cctx.lineWidth = Math.max(1.4, cw / 900);
    cctx.beginPath();
    cctx.moveTo(dx, 0);
    cctx.lineTo(dx, ch);
    cctx.stroke();
  }

  /* ---- fracture ---- */
  function fracture(s) {
    s.failed = true;
    s.g.classList.add('is-failed');
    const p = s.part;
    // A jagged crack across the body, seeded off the part geometry.
    const x0 = p.x - p.w / 2;
    const y = p.y + p.h * 0.42;
    let d = `M${x0} ${y}`;
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const px = x0 + (p.w * i) / steps;
      const py = y + (i % 2 ? -1 : 1) * (1.2 + (i % 3));
      d += ` L${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    s.crack.setAttribute('d', d);

    s.val.textContent = 'SHEARED';
    s.row.classList.add('is-failed');

    if (gsap && !reduced()) {
      gsap.fromTo(s.g,
        { x: 0 },
        { x: 0, duration: 0.9, ease: dampedEase(0.18, 3.0),
          onStart: () => gsap.set(s.body, { transformOrigin: '50% 50%' }) }
      );
      gsap.to(s.body, { opacity: 0.35, duration: 0.5 });
    }

    if (!announced && state.every((x) => x.failed)) {
      announced = true;
      hint.textContent = 'All three parts sheared. That is the whole fight.';
    }
  }

  /* ---- frame ---- */
  function frame(now) {
    if (!alive) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    state.forEach((s) => {
      if (s.failed) { s.amp = 0; return; }
      const m = magnification(s.part, Math.max(w, 0.001)) / peak(s.part);
      s.amp = m;

      // Fatigue accumulates only well into the resonance peak, and recovers
      // when the driver moves off it.
      if (m > 0.55) s.fatigue = Math.min(s.fatigue + (m - 0.55) * dt * 1.5, 1);
      else s.fatigue = Math.max(s.fatigue - dt * 0.28, 0);

      s.bar.style.width = `${(s.fatigue * 100).toFixed(1)}%`;
      s.row.classList.toggle('is-hot', m > 0.55);
      if (!s.failed) {
        s.val.textContent = s.fatigue > 0.02 ? `${Math.round(s.fatigue * 100)}%` : 'OK';
      }

      // Visible ringing, amplitude proportional to the magnification factor.
      const phase = now / 1000 * (12 + s.part.wn * 40);
      const disp = reduced() ? 0 : Math.sin(phase) * m * 3.4;
      s.g.setAttribute('transform', `translate(${disp.toFixed(2)} 0)`);
      s.g.classList.toggle('is-ringing', m > 0.35);

      if (s.fatigue >= 1) fracture(s);
    });

    drawCurve();
    raf = requestAnimationFrame(frame);
  }

  sizeCurve();
  const onResize = () => { sizeCurve(); };
  window.addEventListener('resize', onResize, { passive: true });
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      container.innerHTML = '';
    },
  };
}
