/* ============================================================================
   INSTRUMENT — Resonance
   ----------------------------------------------------------------------------
   The loop, in the order it happens:

     1. Probe a part. That tells you what its dampener is applying to it.
     2. Tune the driver to match that frequency.
     3. Overload it, or stabilize it.

   Overload is the simple route: hold the match and drive the part past what it
   can take. Stabilize is the skilled one: the part's frequency wanders as it
   destabilizes and you have to keep matching it, tracking the movement until
   it settles.

   Parts are the Phase 1 list off the monster turnaround sheet in
   Art/Reference. Colour follows the canon in that folder's README: Stabilize
   is blue, Overload is orange.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* x/y are percentages of the front-view sheet. `damp` is the frequency the
   dampener holds the part at — the thing you match. */
const PARTS = [
  { id: 'head',      label: 'Sensor head module',  x: 47.7, y: 8.7,  damp: 0.82, band: 0.030 },
  { id: 'shoulderL', label: 'Shoulder actuator L', x: 25.4, y: 16.9, damp: 0.41, band: 0.038 },
  { id: 'shoulderR', label: 'Shoulder actuator R', x: 73.1, y: 16.9, damp: 0.46, band: 0.038 },
  { id: 'core',      label: 'Core housing',        x: 48.3, y: 26.5, damp: 0.29, band: 0.046 },
  { id: 'brace',     label: 'Upper brace',         x: 20.4, y: 33.3, damp: 0.61, band: 0.032 },
  { id: 'forearm',   label: 'Forearm guard',       x: 83.6, y: 42.9, damp: 0.70, band: 0.034 },
  { id: 'hip',       label: 'Hip joint',           x: 41.5, y: 44.3, damp: 0.23, band: 0.044 },
  { id: 'knee',      label: 'Knee joint',          x: 32.2, y: 62.0, damp: 0.53, band: 0.036 },
  { id: 'ankle',     label: 'Ankle assembly',      x: 35.3, y: 84.6, damp: 0.35, band: 0.040 },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="rsn">
      <figure class="rsn-machine">
        <div class="rsn-frame">
          <img src="assets/resonance/machine-front.webp"
               alt="Concept turnaround of the Phase 1 machine, a bipedal Cadence work unit, with its parts labelled."
               width="900" height="1631" decoding="async">
          <svg class="rsn-overlay" viewBox="0 0 100 100" preserveAspectRatio="none"
               role="group" aria-label="Machine parts. Probe one to begin."></svg>
        </div>
        <figcaption>Phase 1 machine · concept sheet, Art/Reference</figcaption>
      </figure>

      <div class="rsn-panel">
        <ol class="rsn-steps">
          <li data-step="probe"><b>1</b> Probe a part</li>
          <li data-step="match"><b>2</b> Match the dampener</li>
          <li data-step="act"><b>3</b> Overload or stabilize</li>
        </ol>

        <div class="rsn-target">
          <span class="rsn-part-name">—</span>
          <span class="rsn-lock">no lock</span>
        </div>

        <canvas class="rsn-curve"></canvas>

        <input class="rsn-slider" type="range" min="0" max="1000" value="90" disabled
               aria-label="Driver frequency. Match it to the probed part's dampener.">

        <div class="rsn-verbs">
          <button type="button" class="rsn-verb rsn-verb--over" disabled>Overload</button>
          <button type="button" class="rsn-verb rsn-verb--stab" disabled>Stabilize</button>
        </div>

        <p class="rsn-hint" role="status" aria-live="polite">Probe a part on the machine.</p>
      </div>
    </div>
  `;

  const overlay = container.querySelector('.rsn-overlay');
  const slider = container.querySelector('.rsn-slider');
  const curve = container.querySelector('.rsn-curve');
  const cctx = curve.getContext('2d');
  const hint = container.querySelector('.rsn-hint');
  const nameOut = container.querySelector('.rsn-part-name');
  const lockOut = container.querySelector('.rsn-lock');
  const btnOver = container.querySelector('.rsn-verb--over');
  const btnStab = container.querySelector('.rsn-verb--stab');
  const steps = Array.from(container.querySelectorAll('.rsn-steps li'));

  const state = PARTS.map((p) => ({ part: p, status: 'intact' }));

  let w = 0.09;              // driver
  let probed = null;         // the part being worked
  let mode = null;           // null | 'overload' | 'stabilize'
  let load = 0;              // overload fatigue, 0..1
  let calm = 0;              // stabilize progress, 0..1
  let wander = 0;            // stabilize: the part's drifting frequency offset
  let raf = 0, last = 0, alive = true;

  const setStep = (n) => steps.forEach((li, i) => li.classList.toggle('is-on', i === n));

  /* ---- markers ---- */
  state.forEach((s) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'rp');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Probe ${s.part.label}`);
    g.innerHTML = `
      <circle class="rp-ring" cx="${s.part.x}" cy="${s.part.y}" r="2.4"/>
      <circle class="rp-dot"  cx="${s.part.x}" cy="${s.part.y}" r="0.8"/>
      <circle class="rp-hit"  cx="${s.part.x}" cy="${s.part.y}" r="4"/>
    `;
    const probe = () => probePart(s);
    g.addEventListener('click', probe);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); probe(); } });
    overlay.appendChild(g);
    s.marker = g;
    s.ring = g.querySelector('.rp-ring');
  });

  function probePart(s) {
    if (s.status !== 'intact') {
      hint.textContent = `${s.part.label} is already ${s.status}.`;
      return;
    }
    probed = s;
    mode = null; load = 0; calm = 0; wander = 0;
    state.forEach((x) => x.marker.classList.toggle('is-probed', x === s));

    nameOut.textContent = s.part.label;
    slider.disabled = false;
    btnOver.disabled = true;
    btnStab.disabled = true;
    setStep(1);
    hint.textContent = `Probed. Its dampener is holding it near ${s.part.damp.toFixed(2)}. Match that.`;
  }

  /** How close the driver is to the part's current target, 0..1. */
  function lock() {
    if (!probed) return 0;
    const target = probed.part.damp + wander;
    const d = Math.abs(w - target);
    return Math.max(0, 1 - d / probed.part.band);
  }

  slider.addEventListener('input', () => { w = Number(slider.value) / 1000; });

  btnOver.addEventListener('click', () => {
    if (!probed) return;
    mode = 'overload'; setStep(2);
    hint.textContent = 'Hold the match. It will not hold together long.';
  });
  btnStab.addEventListener('click', () => {
    if (!probed) return;
    mode = 'stabilize'; setStep(2);
    hint.textContent = 'It is destabilizing. Follow it down.';
  });

  /* ---- curve ---- */
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
    cctx.strokeStyle = grid; cctx.lineWidth = 1;
    cctx.beginPath();
    for (let i = 1; i < 6; i++) { const x = (cw / 6) * i; cctx.moveTo(x, 0); cctx.lineTo(x, ch); }
    cctx.stroke();

    if (probed) {
      // The dampener band: the window you have to sit inside.
      const target = probed.part.damp + wander;
      const bw = (probed.part.band / 1) * cw;
      const tx = target * cw;
      cctx.fillStyle = mode === 'overload' ? over : stable;
      cctx.globalAlpha = 0.16;
      cctx.fillRect(tx - bw, 0, bw * 2, ch);
      cctx.globalAlpha = 1;

      cctx.strokeStyle = mode === 'overload' ? over : stable;
      cctx.lineWidth = Math.max(1.2, cw / 1100);
      cctx.beginPath(); cctx.moveTo(tx, 0); cctx.lineTo(tx, ch); cctx.stroke();
    } else {
      cctx.fillStyle = muted;
      cctx.globalAlpha = 0.5;
      cctx.font = `${Math.round(ch * 0.22)}px monospace`;
      cctx.fillText('probe a part', 8, ch / 2);
      cctx.globalAlpha = 1;
    }

    // The driver itself.
    const dx = w * cw;
    cctx.strokeStyle = probed && lock() > 0.001 ? (mode === 'overload' ? over : stable) : muted;
    cctx.lineWidth = Math.max(1.6, cw / 800);
    cctx.beginPath(); cctx.moveTo(dx, 0); cctx.lineTo(dx, ch); cctx.stroke();
  }

  function finish(status, text) {
    probed.status = status;
    probed.marker.classList.remove('is-probed');
    probed.marker.classList.add(status === 'sheared' ? 'is-failed' : 'is-stable');
    hint.textContent = text;
    probed = null; mode = null;
    slider.disabled = true;
    btnOver.disabled = true; btnStab.disabled = true;
    lockOut.textContent = 'no lock';
    lockOut.className = 'rsn-lock';
    nameOut.textContent = '—';
    setStep(0);

    const done = state.filter((s) => s.status !== 'intact').length;
    if (done === state.length) {
      hint.textContent = 'Every part resolved. Overload is quicker. Stabilize is the one that takes hands.';
    }
  }

  function frame(now) {
    if (!alive) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    if (probed) {
      const L = lock();
      lockOut.textContent = L > 0.999 ? 'locked' : L > 0.02 ? `${Math.round(L * 100)}%` : 'no lock';
      lockOut.className = 'rsn-lock' + (L > 0.6 ? ' is-lock' : '');

      // Once you have found it, the two verbs open up.
      if (!mode && L > 0.6) {
        btnOver.disabled = false;
        btnStab.disabled = false;
        setStep(2);
        hint.textContent = 'Matched. Overload it, or stabilize it.';
      }

      if (mode === 'overload') {
        // Simple: stay in the band, it comes apart.
        load = L > 0.5 ? Math.min(load + dt * 0.55 * L, 1) : Math.max(load - dt * 0.35, 0);
        probed.ring.setAttribute('r', (2.4 + load * 4.5).toFixed(2));
        probed.marker.classList.toggle('is-hot', L > 0.5);
        if (load >= 1) finish('sheared', `${probed.part.label} sheared.`);
      }

      if (mode === 'stabilize') {
        // Skilled: the part wanders and you have to keep matching it. Wander
        // shrinks as it calms, so it gets easier the closer you are to done.
        const t = now / 1000;
        const amp = 0.055 * (1 - calm * 0.8);
        wander = Math.sin(t * 1.7) * amp + Math.sin(t * 0.63) * amp * 0.5;
        calm = L > 0.45 ? Math.min(calm + dt * 0.28 * L, 1) : Math.max(calm - dt * 0.42, 0);
        probed.ring.setAttribute('r', (2.4 + (1 - calm) * 3.2).toFixed(2));
        probed.marker.classList.toggle('is-near', true);
        if (calm >= 1) finish('stable', `${probed.part.label} settled. That one takes hands.`);
      }
    }

    drawCurve();
    raf = requestAnimationFrame(frame);
  }

  sizeCurve();
  const onResize = () => sizeCurve();
  window.addEventListener('resize', onResize, { passive: true });
  setStep(0);
  raf = requestAnimationFrame(frame);

  if (gsap && !reduced()) {
    gsap.from(state.map((s) => s.marker), {
      opacity: 0, duration: 0.7, stagger: { each: 0.04, from: 'random' },
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
