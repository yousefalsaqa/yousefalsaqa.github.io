/* ============================================================================
   INSTRUMENT — Resonance, driver sweep against a real machine
   ----------------------------------------------------------------------------
   The parts are the Phase 1 part list off the monster turnaround sheet in
   Art/Reference: sensor head module, core housing, shoulder actuator, upper
   brace, forearm guard, hip joint, knee joint, ankle assembly. Every readable
   part on that sheet is a data-asset entry with its own modes and safe
   amplitude, and this is that list with numbers on it.

   Amplitude follows the magnification factor for a driven damped oscillator,

       M(r) = 1 / sqrt( (1 - r^2)^2 + (2*zeta*r)^2 ),     r = w / wn

   peaking at 1/(2*zeta). Hold a part near its peak and it accumulates fatigue
   until it fails. Move off and it recovers. Overload and Stabilize.

   Colour follows the canon in Art/Reference/README.md: Overload is orange,
   Stabilize is blue.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* x/y are percentages of the front-view sheet. wn is normalised driver units;
   light armour panels ring high and sharp, structural mass rings low and is
   better damped. */
const PARTS = [
  { id: 'head',     label: 'Sensor head module', x: 47.7, y: 8.7,  wn: 0.86, zeta: 0.030 },
  { id: 'shoulderL',label: 'Shoulder actuator L',x: 25.4, y: 16.9, wn: 0.42, zeta: 0.070 },
  { id: 'shoulderR',label: 'Shoulder actuator R',x: 73.1, y: 16.9, wn: 0.45, zeta: 0.070 },
  { id: 'core',     label: 'Core housing',       x: 48.3, y: 26.5, wn: 0.30, zeta: 0.090 },
  { id: 'brace',    label: 'Upper brace',        x: 20.4, y: 33.3, wn: 0.62, zeta: 0.040 },
  { id: 'forearm',  label: 'Forearm guard',      x: 83.6, y: 42.9, wn: 0.71, zeta: 0.055 },
  { id: 'hip',      label: 'Hip joint',          x: 41.5, y: 44.3, wn: 0.24, zeta: 0.085 },
  { id: 'knee',     label: 'Knee joint',         x: 32.2, y: 62.0, wn: 0.52, zeta: 0.045 },
  { id: 'ankle',    label: 'Ankle assembly',     x: 35.3, y: 84.6, wn: 0.36, zeta: 0.060 },
];

const magnification = (p, w) => {
  const r = w / p.wn;
  const a = 1 - r * r;
  const b = 2 * p.zeta * r;
  return 1 / Math.sqrt(a * a + b * b);
};
const peak = (p) => 1 / (2 * p.zeta * Math.sqrt(1 - p.zeta * p.zeta));

export function mount(container, system) {
  container.innerHTML = `
    <div class="rsn">
      <figure class="rsn-machine">
        <!-- The frame is locked to the image's aspect ratio so the overlay and
             the artwork share one coordinate space. Letting the image
             contain-fit inside a differently-shaped box puts every marker off
             the part it is supposed to be on. -->
        <div class="rsn-frame">
          <img src="assets/resonance/machine-front.webp"
               alt="Concept turnaround of the Phase 1 machine, a bipedal Cadence work unit, with its parts labelled."
               width="900" height="1631" decoding="async">
          <svg class="rsn-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        </div>
        <figcaption>Phase 1 machine · concept sheet, Art/Reference</figcaption>
      </figure>

      <div class="rsn-panel">
        <div class="rsn-readout">
          <span class="rsn-driver" data-driver>0.09</span>
          <span class="rsn-driver-label">driver</span>
        </div>

        <canvas class="rsn-curve"></canvas>

        <input class="rsn-slider" type="range" min="0" max="1000" value="90"
               aria-label="Driver frequency. Sweep to find each part's resonance.">

        <ul class="rsn-parts"></ul>

        <p class="rsn-hint" role="status" aria-live="polite">Sweep until a part rings. Hold it there.</p>
      </div>
    </div>
  `;

  const overlay = container.querySelector('.rsn-overlay');
  const partsList = container.querySelector('.rsn-parts');
  const slider = container.querySelector('.rsn-slider');
  const curve = container.querySelector('.rsn-curve');
  const cctx = curve.getContext('2d');
  const hint = container.querySelector('.rsn-hint');
  const driverOut = container.querySelector('[data-driver]');

  const state = PARTS.map((p) => ({ part: p, fatigue: 0, failed: false, amp: 0 }));

  /* ---- overlay markers, in the sheet's own coordinate space ---- */
  state.forEach((s) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'rp');
    g.dataset.id = s.part.id;
    g.innerHTML = `
      <circle class="rp-ring" cx="${s.part.x}" cy="${s.part.y}" r="2.4"/>
      <circle class="rp-dot"  cx="${s.part.x}" cy="${s.part.y}" r="0.7"/>
    `;
    overlay.appendChild(g);
    s.marker = g;
    s.ring = g.querySelector('.rp-ring');

    const li = document.createElement('li');
    li.className = 'rp-row';
    li.innerHTML = `
      <span class="rp-name">${s.part.label}</span>
      <span class="rp-meter"><i style="width:0%"></i></span>
      <span class="rp-val">—</span>
    `;
    partsList.appendChild(li);
    s.row = li;
    s.meter = li.querySelector('.rp-meter i');
    s.val = li.querySelector('.rp-val');
  });

  let w = 0.09;
  let raf = 0;
  let alive = true;
  let last = 0;
  let allDone = false;

  slider.addEventListener('input', () => {
    w = Number(slider.value) / 1000;
    driverOut.textContent = w.toFixed(3);
  });

  function sizeCurve() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    curve.width = Math.round(curve.clientWidth * dpr);
    curve.height = Math.round(curve.clientHeight * dpr);
  }

  function drawCurve() {
    const cw = curve.width, ch = curve.height;
    if (!cw || !ch) return;
    const css = getComputedStyle(document.documentElement);
    const stable = css.getPropertyValue('--stabilize').trim() || '#4DA6E8';
    const over = css.getPropertyValue('--overload').trim() || '#FF7A1F';
    const grid = css.getPropertyValue('--hairline').trim() || '#262A31';
    const muted = css.getPropertyValue('--muted').trim() || '#7C818A';

    cctx.clearRect(0, 0, cw, ch);
    cctx.strokeStyle = grid;
    cctx.lineWidth = 1;
    cctx.beginPath();
    for (let i = 1; i < 6; i++) { const x = (cw / 6) * i; cctx.moveTo(x, 0); cctx.lineTo(x, ch); }
    cctx.stroke();

    state.forEach((s) => {
      cctx.strokeStyle = s.failed ? muted : (s.amp > 0.55 ? over : stable);
      cctx.globalAlpha = s.failed ? 0.22 : (s.amp > 0.55 ? 0.95 : 0.5);
      cctx.lineWidth = Math.max(1.1, cw / 1100);
      cctx.beginPath();
      const pk = peak(s.part);
      for (let i = 0; i <= 240; i++) {
        const f = i / 240;
        const m = Math.min(magnification(s.part, Math.max(f, 0.001)) / pk, 1);
        const x = f * cw;
        const y = ch - m * ch * 0.86 - ch * 0.07;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
    });
    cctx.globalAlpha = 1;

    const dx = w * cw;
    cctx.strokeStyle = over;
    cctx.lineWidth = Math.max(1.4, cw / 900);
    cctx.beginPath();
    cctx.moveTo(dx, 0); cctx.lineTo(dx, ch);
    cctx.stroke();
  }

  function fail(s) {
    s.failed = true;
    s.marker.classList.add('is-failed');
    s.row.classList.add('is-failed');
    s.val.textContent = 'SHEARED';
    hint.textContent = `${s.part.label} sheared. Focus-fire on one part beats spreading the drive.`;

    if (!allDone && state.every((x) => x.failed)) {
      allDone = true;
      hint.textContent = 'Every part sheared. The machine comes apart by structure, not by HP.';
    }
  }

  function frame(now) {
    if (!alive) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    state.forEach((s) => {
      if (s.failed) { s.amp = 0; return; }
      const m = magnification(s.part, Math.max(w, 0.001)) / peak(s.part);
      s.amp = m;

      if (m > 0.55) s.fatigue = Math.min(s.fatigue + (m - 0.55) * dt * 1.35, 1);
      else s.fatigue = Math.max(s.fatigue - dt * 0.3, 0);

      s.meter.style.width = `${(s.fatigue * 100).toFixed(1)}%`;
      s.row.classList.toggle('is-hot', m > 0.55);
      s.marker.classList.toggle('is-hot', m > 0.55);
      s.marker.classList.toggle('is-near', m > 0.22 && m <= 0.55);
      s.val.textContent = s.fatigue > 0.02 ? `${Math.round(s.fatigue * 100)}%` : '—';

      // Ring radius tracks amplitude directly: the marker is an amplitude gauge.
      if (s.ring) s.ring.setAttribute('r', (2.4 + m * 3.2).toFixed(2));

      if (s.fatigue >= 1) fail(s);
    });

    drawCurve();
    raf = requestAnimationFrame(frame);
  }

  sizeCurve();
  const onResize = () => sizeCurve();
  window.addEventListener('resize', onResize, { passive: true });
  driverOut.textContent = w.toFixed(3);
  raf = requestAnimationFrame(frame);

  if (gsap && !reduced()) {
    gsap.from(state.map((s) => s.row), {
      opacity: 0, x: 14, duration: 0.6, stagger: 0.04,
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
