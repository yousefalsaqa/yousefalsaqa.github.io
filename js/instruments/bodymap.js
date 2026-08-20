/* ============================================================================
   INSTRUMENT — CAST body map
   ----------------------------------------------------------------------------
   The real system: the instructor sets a scenario, and every tagged position
   resolves to the sound that belongs there under that scenario. A murmur case
   does not change one spot; it changes what the whole chest sounds like. The
   student dashboard also carries a quiz mode.

   So this instrument has both. Six heart points, six lung fields, five
   scenarios whose waveforms genuinely differ per position, and a quiz that
   plays a trace and asks whether the label fits.

   No audio files: waveforms are synthesised from what each sound is - S1/S2
   thumps for the heart, a breath envelope for the lungs, with the finding
   layered on top.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* Twelve positions in the manikin's own viewBox coordinates (0 0 220 120),
   supine, head to the right. Six auscultation sites for the heart, six lung
   fields. */
const POSITIONS = [
  { id: 1,  x: 118, y: 50, kind: 'heart', site: 'Aortic' },
  { id: 2,  x: 118, y: 70, kind: 'heart', site: 'Pulmonic' },
  { id: 3,  x: 108, y: 62, kind: 'heart', site: "Erb's point" },
  { id: 4,  x: 98,  y: 66, kind: 'heart', site: 'Tricuspid' },
  { id: 5,  x: 88,  y: 76, kind: 'heart', site: 'Mitral / apex' },
  { id: 6,  x: 74,  y: 82, kind: 'heart', site: 'Axillary' },

  { id: 7,  x: 126, y: 36, kind: 'lung', site: 'R upper lobe' },
  { id: 8,  x: 128, y: 84, kind: 'lung', site: 'L upper lobe' },
  { id: 9,  x: 100, y: 34, kind: 'lung', site: 'R middle lobe' },
  { id: 10, x: 102, y: 88, kind: 'lung', site: 'L lingula' },
  { id: 11, x: 66,  y: 40, kind: 'lung', site: 'R lower lobe' },
  { id: 12, x: 66,  y: 86, kind: 'lung', site: 'L lower lobe' },
];

/* ---------------------------------------------------------------------------
   Scenarios
   ---------------------------------------------------------------------------
   Each returns the finding for a position: label text plus the parameters the
   synthesiser reads. Heart params: rate (bpm), murmur, s3, split. Lung
   params: crackles ('fine'|'coarse'|null), wheeze, diminished.
   ------------------------------------------------------------------------- */

const MODES = [
  {
    id: 'normal', label: 'Normal',
    find(p) {
      return p.kind === 'heart'
        ? { label: 'Normal S1 S2', rate: 72 }
        : { label: 'Clear vesicular' };
    },
  },
  {
    id: 'murmur', label: 'Mitral murmur',
    find(p) {
      if (p.kind === 'heart') {
        if (p.site === 'Mitral / apex') return { label: 'Holosystolic murmur', rate: 78, murmur: 1.0 };
        if (p.site === 'Axillary')      return { label: 'Murmur, radiating', rate: 78, murmur: 0.55 };
        if (p.site === "Erb's point")   return { label: 'Faint murmur', rate: 78, murmur: 0.3 };
        return { label: 'Normal S1 S2', rate: 78 };
      }
      return { label: 'Clear vesicular' };
    },
  },
  {
    id: 'pneumonia', label: 'Pneumonia, R base',
    find(p) {
      if (p.kind === 'heart') return { label: 'Normal, mildly fast', rate: 96 };
      if (p.site === 'R lower lobe')  return { label: 'Coarse crackles', crackles: 'coarse' };
      if (p.site === 'R middle lobe') return { label: 'Crackles, diminished', crackles: 'coarse', diminished: true };
      return { label: 'Clear vesicular' };
    },
  },
  {
    id: 'asthma', label: 'Bronchospasm',
    find(p) {
      if (p.kind === 'heart') return { label: 'Normal, fast', rate: 104 };
      return { label: 'Expiratory wheeze', wheeze: true };
    },
  },
  {
    id: 'chf', label: 'Heart failure',
    find(p) {
      if (p.kind === 'heart') {
        if (p.site === 'Mitral / apex' || p.site === "Erb's point") {
          return { label: 'S3 gallop', rate: 92, s3: true };
        }
        return { label: 'Normal, fast', rate: 92 };
      }
      if (p.site === 'R lower lobe' || p.site === 'L lower lobe') {
        return { label: 'Fine crackles, both bases', crackles: 'fine' };
      }
      return { label: 'Clear vesicular' };
    },
  },
];

/* All labels the quiz can offer as claims, per kind. */
const HEART_LABELS = ['Normal S1 S2', 'Holosystolic murmur', 'S3 gallop', 'Normal, fast'];
const LUNG_LABELS = ['Clear vesicular', 'Coarse crackles', 'Fine crackles, both bases', 'Expiratory wheeze'];

/* ---------------------------------------------------------------------------
   Waveform synthesis
   ------------------------------------------------------------------------- */

function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 * 2 - 1;
  };
}

function sample(pos, f, t) {
  const rnd = noise(pos.id * 7919);
  if (pos.kind === 'heart') {
    const period = 60 / (f.rate || 72);
    const cycle = (t % period) / period;
    const thump = (phase, width, amp) => {
      const d = cycle - phase;
      return Math.exp(-(d * d) / (width * width)) * Math.sin(d * 240) * amp;
    };
    let v = thump(0.02, 0.028, 1.0) + thump(0.34, 0.020, 0.72);
    if (f.s3) v += thump(0.46, 0.030, 0.5);
    if (f.murmur && cycle > 0.05 && cycle < 0.33) v += rnd() * 0.34 * f.murmur;
    if (f.split) v += thump(0.375, 0.014, 0.42);
    return v;
  }

  // Lung: one respiration every ~2s, inspiration longer than expiration.
  const cycle = (t / 2) % 1;
  const insp = cycle < 0.55;
  const env = insp
    ? Math.sin((cycle / 0.55) * Math.PI) * 0.85
    : Math.sin(((cycle - 0.55) / 0.45) * Math.PI) * 0.5;

  let v = rnd() * env;

  if (f.crackles) {
    const coarse = f.crackles === 'coarse';
    const rate = coarse ? 26 : 60;
    const k = Math.floor(t * rate);
    const local = t * rate - k;
    if (insp && local < 0.12) {
      v += Math.exp(-local * 40) * (coarse ? 1.15 : 0.7) * (k % 3 ? 1 : -1);
    }
  }
  if (f.wheeze && !insp) v += Math.sin(t * 320) * env * 0.9;
  if (f.diminished) v *= 0.35;

  return v;
}

/* ------------------------------------------------------------------- mount */

export function mount(container, system) {
  container.innerHTML = `
    <div class="bodymap">
      <div class="bm-bar">
        <div class="bm-tabs" role="tablist" aria-label="Simulate or quiz">
          <button type="button" class="bm-tab is-on" data-tab="sim" role="tab" aria-selected="true">Simulate</button>
          <button type="button" class="bm-tab" data-tab="quiz" role="tab" aria-selected="false">Quiz</button>
        </div>
        <div class="bm-modes" role="group" aria-label="Scenario">
          ${MODES.map((m, i) => `<button type="button" class="bm-mode${i === 0 ? ' is-on' : ''}" data-mode="${m.id}">${m.label}</button>`).join('')}
        </div>
      </div>

      <div class="bm-body">
        <div class="bodymap-figure">
          <svg viewBox="0 0 220 120" class="manikin" role="group"
               aria-label="Twelve RFID auscultation positions on the manikin">
            <path class="mk-body" d="M16 26 H118 C132 26 140 34 146 46 H166 V74 H146
                                     C140 86 132 94 118 94 H16 Z"/>
            <circle class="mk-body" cx="190" cy="60" r="26"/>
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
          <div class="scope-banner">Auscultation module active &middot; scenario: <b class="scope-mode">Normal</b></div>
          <div class="scope-head">
            <span class="scope-site">—</span>
            <span class="scope-tag">TAG —</span>
          </div>
          <canvas class="scope-canvas"></canvas>

          <!-- Simulate: the read log. Quiz: the question. Same slot. -->
          <div class="scope-log" role="log" aria-live="polite"></div>
          <div class="bm-quiz" hidden>
            <p class="bm-quiz-q" aria-live="polite"></p>
            <div class="bm-quiz-actions">
              <button type="button" class="bm-quiz-btn" data-ans="yes">Yes</button>
              <button type="button" class="bm-quiz-btn" data-ans="no">No</button>
              <button type="button" class="bm-quiz-next" hidden>Next</button>
            </div>
          </div>

          <div class="scope-foot">
            <span class="scope-note">12 tags · 28 scenarios</span>
            <span class="scope-finding">Select a position</span>
          </div>
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
  const modeEl = container.querySelector('.scope-mode');
  const logEl = container.querySelector('.scope-log');
  const quizEl = container.querySelector('.bm-quiz');
  const quizQ = container.querySelector('.bm-quiz-q');
  const quizNext = container.querySelector('.bm-quiz-next');
  const quizBtns = Array.from(container.querySelectorAll('.bm-quiz-btn'));
  const ctx = canvas.getContext('2d');

  let mode = MODES[0];
  let tab = 'sim';
  let active = POSITIONS[4];   // apex: something with shape
  let raf = 0;
  let t0 = 0;
  let alive = true;
  let quiz = null;             // { pos, mode, claim, truth, answered }
  let score = 0, asked = 0;

  const findingOf = (p, m = mode) => m.find(p);

  /* ---- points ---- */
  POSITIONS.forEach((p) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `bp bp--${p.kind}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.innerHTML = `
      <circle class="bp-halo" cx="${p.x}" cy="${p.y}" r="7"/>
      <circle class="bp-dot"  cx="${p.x}" cy="${p.y}" r="3.1"/>
      <circle class="bp-hit"  cx="${p.x}" cy="${p.y}" r="9"/>
      <text class="bp-id" x="${p.x + 8}" y="${p.y - 5}">${p.id}</text>
    `;
    const pick = () => { if (tab === 'sim') setActive(p, g); };
    g.addEventListener('pointerenter', pick);
    g.addEventListener('focus', pick);
    g.addEventListener('click', pick);
    pointsHost.appendChild(g);
    p.el = g;
  });

  const buttons = POSITIONS.map((p) => p.el);

  function paintAria() {
    POSITIONS.forEach((p) => {
      const f = findingOf(p);
      p.el.setAttribute('aria-label', `${p.site}. ${f.label}.`);
    });
  }
  paintAria();

  function setActive(p, btn, silent) {
    active = p;
    buttons.forEach((b) => b.classList.toggle('is-live', b === (btn || p.el)));

    const f = findingOf(p);
    siteEl.textContent = p.site;
    tagEl.textContent = `TAG ${String(p.id).padStart(2, '0')}`;
    findingEl.textContent = tab === 'quiz' ? 'Listen, then answer' : f.label;
    noteEl.textContent = p.kind === 'heart' ? 'Cardiac site' : 'Lung field';

    if (!silent) {
      const t = new Date().toLocaleTimeString('en-CA', { hour12: false });
      const row = document.createElement('div');
      row.className = 'scope-log-row';
      row.innerHTML = `<span>${t}</span> Tag ${String(p.id).padStart(2, '0')} read &middot; ${p.site} &middot; ${f.label}`;
      logEl.prepend(row);
      while (logEl.children.length > 4) logEl.lastElementChild.remove();
    }

    if (gsap && !reduced()) {
      gsap.fromTo([siteEl, findingEl],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: dampedEase(DAMPING.data, 1.2), stagger: 0.04 }
      );
    }
  }

  /* ---- scenario picker ---- */
  const modeBtns = Array.from(container.querySelectorAll('.bm-mode'));
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    mode = MODES.find((m) => m.id === b.dataset.mode);
    modeBtns.forEach((x) => x.classList.toggle('is-on', x === b));
    modeEl.textContent = mode.label;
    paintAria();
    setActive(active, active.el, true);
    const t = new Date().toLocaleTimeString('en-CA', { hour12: false });
    const row = document.createElement('div');
    row.className = 'scope-log-row';
    row.innerHTML = `<span>${t}</span> Scenario set &middot; ${mode.label}`;
    logEl.prepend(row);
    while (logEl.children.length > 4) logEl.lastElementChild.remove();
  }));

  /* ---- quiz ---- */
  function newQuestion() {
    const qMode = MODES[Math.floor(Math.random() * MODES.length)];
    const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const truth = qMode.find(pos).label;
    const pool = (pos.kind === 'heart' ? HEART_LABELS : LUNG_LABELS).filter((l) => l !== truth);
    const honest = Math.random() < 0.5;
    const claim = honest ? truth : pool[Math.floor(Math.random() * pool.length)];
    quiz = { pos, mode: qMode, claim, truth, answered: false };

    setActive(pos, pos.el, true);
    quizQ.innerHTML = `You are listening at the <b>${pos.site}</b>. Is this <b>${claim.toLowerCase()}</b>?`;
    quizQ.className = 'bm-quiz-q';
    quizBtns.forEach((b) => { b.disabled = false; });
    quizNext.hidden = true;
  }

  function answer(ans) {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    asked++;
    const truthful = quiz.claim === quiz.truth;
    const right = (ans === 'yes') === truthful;
    if (right) score++;
    quizQ.innerHTML = right
      ? `Correct. ${truthful ? 'That is exactly it.' : `It is actually ${quiz.truth.toLowerCase()}.`} &middot; <b>${score}/${asked}</b>`
      : `Wrong. This is ${quiz.truth.toLowerCase()}. &middot; <b>${score}/${asked}</b>`;
    quizQ.className = `bm-quiz-q ${right ? 'is-right' : 'is-wrong'}`;
    quizBtns.forEach((b) => { b.disabled = true; });
    quizNext.hidden = false;
  }

  quizBtns.forEach((b) => b.addEventListener('click', () => answer(b.dataset.ans)));
  quizNext.addEventListener('click', newQuestion);

  /* ---- tabs ---- */
  const tabBtns = Array.from(container.querySelectorAll('.bm-tab'));
  const modesBar = container.querySelector('.bm-modes');
  tabBtns.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    tabBtns.forEach((x) => {
      x.classList.toggle('is-on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    const quizzing = tab === 'quiz';
    quizEl.hidden = !quizzing;
    logEl.hidden = quizzing;
    modesBar.classList.toggle('is-locked', quizzing);
    if (quizzing) newQuestion();
    else { setActive(active, active.el, true); }
  }));

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
    if (!w || !h) { raf = requestAnimationFrame(draw); return; }
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--stabilize').trim() || '#4DA6E8';
    const grid = css.getPropertyValue('--hairline').trim() || '#262A31';

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) { const x = (w / 8) * i; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let i = 1; i < 4; i++) { const y = (h / 4) * i; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // In quiz mode the truth's waveform plays; in simulate, the scenario's.
    const f = quiz && tab === 'quiz'
      ? quiz.mode.find(quiz.pos)
      : findingOf(active);
    const pos = quiz && tab === 'quiz' ? quiz.pos : active;

    const span = 2.2;
    const base = reduced() ? 0 : t;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.4, w / 900);
    ctx.beginPath();
    const N = Math.min(w, 1400);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const v = sample(pos, f, base + u * span);
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
  setActive(POSITIONS[4], buttons[4], true);
  raf = requestAnimationFrame(draw);

  if (gsap && !reduced()) {
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
