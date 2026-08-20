/* ============================================================================
   INSTRUMENT — CAST body map
   ----------------------------------------------------------------------------
   The real system: the instructor sets a scenario and every tagged position
   resolves to the sound that belongs there under it. Cardiac and pulmonary
   scenarios are set independently - the real dashboard has a dropdown for
   each - so this does too: pick a heart condition and a lung condition, and
   the chest simulates the combination.

   Quiz mode deals a case the same way the real ones get interesting: a
   heart-only case over clear lungs, a lung-only case over a normal heart, or
   both at once. Probe the chest, set both pickers, commit.

   No audio files: waveforms are synthesised from what each sound is, shaped
   after the real morphologies - S1 low and long, S2 high and short, a
   holosystolic murmur as a turbulence band filling systole, S3 as a low
   rounded third sound, wheeze as a musical expiratory tone, coarse crackles
   as early-inspiratory pops, fine crackles as the end-inspiratory velcro.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* Twelve positions in the manikin's viewBox coordinates, supine, head right.
   Six auscultation sites for the heart, six lung fields. */
const POSITIONS = [
  { id: 1,  x: 118, y: 50, kind: 'heart', site: 'Aortic',        loc: 'Right 2nd intercostal space, sternal border' },
  { id: 2,  x: 118, y: 70, kind: 'heart', site: 'Pulmonic',      loc: 'Left 2nd intercostal space, sternal border' },
  { id: 3,  x: 108, y: 62, kind: 'heart', site: "Erb's point",   loc: 'Left 3rd intercostal space, sternal border' },
  { id: 4,  x: 98,  y: 66, kind: 'heart', site: 'Tricuspid',     loc: 'Left 4th intercostal space, lower sternal border' },
  { id: 5,  x: 88,  y: 76, kind: 'heart', site: 'Mitral / apex', loc: 'Left 5th intercostal space, midclavicular line' },
  { id: 6,  x: 84,  y: 88, kind: 'heart', site: 'Axillary',      loc: 'Left mid-axillary line, level of the 5th space' },

  { id: 7,  x: 126, y: 36, kind: 'lung', site: 'R upper lobe',  loc: 'Right 2nd intercostal space, midclavicular line' },
  { id: 8,  x: 128, y: 84, kind: 'lung', site: 'L upper lobe',  loc: 'Left 2nd intercostal space, midclavicular line' },
  { id: 9,  x: 100, y: 34, kind: 'lung', site: 'R middle lobe', loc: 'Right 4th intercostal space, midclavicular line' },
  { id: 10, x: 102, y: 88, kind: 'lung', site: 'L lingula',     loc: 'Left 4th intercostal space, midclavicular line' },
  { id: 11, x: 66,  y: 40, kind: 'lung', site: 'R lower lobe',  loc: 'Right base, 6th space at the mid-axillary line' },
  { id: 12, x: 66,  y: 86, kind: 'lung', site: 'L lower lobe',  loc: 'Left base, 6th space at the mid-axillary line' },
];

/* ---------------------------------------------------------------------------
   Conditions, one list per organ. find(p) returns the finding at a position:
   a label plus the synthesiser's parameters.
   ------------------------------------------------------------------------- */

const HEART = [
  {
    id: 'h-normal', label: 'Normal',
    find() { return { label: 'Normal S1 S2', rate: 72 }; },
  },
  {
    id: 'h-murmur', label: 'Mitral murmur',
    find(p) {
      if (p.site === 'Mitral / apex') return { label: 'Holosystolic murmur', rate: 78, murmur: 1.0, s1: 0.6 };
      if (p.site === 'Axillary')      return { label: 'Murmur, radiating', rate: 78, murmur: 0.55 };
      if (p.site === "Erb's point")   return { label: 'Faint murmur', rate: 78, murmur: 0.3 };
      return { label: 'Normal S1 S2', rate: 78 };
    },
  },
  {
    id: 'h-gallop', label: 'S3 gallop',
    find(p) {
      if (p.site === 'Mitral / apex' || p.site === "Erb's point") {
        return { label: 'S3 gallop', rate: 92, s3: true };
      }
      return { label: 'Normal, fast', rate: 92 };
    },
  },
];

const LUNG = [
  {
    id: 'l-clear', label: 'Clear',
    find() { return { label: 'Clear vesicular' }; },
  },
  {
    id: 'l-pna', label: 'Pneumonia, R base',
    find(p) {
      if (p.site === 'R lower lobe')  return { label: 'Coarse crackles', crackles: 'coarse' };
      if (p.site === 'R middle lobe') return { label: 'Crackles, diminished', crackles: 'coarse', diminished: true };
      return { label: 'Clear vesicular' };
    },
  },
  {
    id: 'l-broncho', label: 'Bronchospasm',
    find() { return { label: 'Expiratory wheeze', wheeze: true }; },
  },
  {
    id: 'l-edema', label: 'Fine crackles, bases',
    find(p) {
      if (p.site === 'R lower lobe' || p.site === 'L lower lobe') {
        return { label: 'Fine crackles', crackles: 'fine' };
      }
      return { label: 'Clear vesicular' };
    },
  },
];

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
  const rnd = noise(pos.id * 7919 + Math.floor(t * 997));
  // An LCG's first draw is nearly linear in its seed, which turned the murmur
  // band into a smooth ramp. Two warm-up draws decorrelate it.
  rnd(); rnd();

  if (pos.kind === 'heart') {
    const period = 60 / (f.rate || 72);
    const cycle = (t % period) / period;

    // A heart sound is a short burst at a characteristic pitch. S1 is longer
    // and lower (mitral/tricuspid closure), S2 shorter and higher (aortic/
    // pulmonic). That asymmetry is what makes a phonocardiogram readable.
    const burst = (phase, width, freq, amp) => {
      const d = cycle - phase;
      return Math.exp(-(d * d) / (width * width)) * Math.sin(d * freq * period * 60) * amp;
    };

    let v = burst(0.04, 0.035, 3.2, (f.s1 != null ? f.s1 : 1.0));
    v += burst(0.38, 0.020, 5.6, 0.8);

    // Holosystolic murmur: a plateau of turbulence FILLING systole, S1 to S2.
    if (f.murmur && cycle > 0.07 && cycle < 0.36) {
      v += rnd() * 0.6 * f.murmur;
    }

    // S3: brief, LOW-pitched, early diastole - the gallop's rounded third
    // sound just after S2.
    if (f.s3) v += burst(0.52, 0.05, 1.3, 0.65);

    if (f.split) v += burst(0.415, 0.014, 5.6, 0.42);
    return v;
  }

  // One respiration ~2s; inspiration is the louder, longer phase.
  const cycle = (t / 2) % 1;
  const insp = cycle < 0.55;
  const phase = insp ? cycle / 0.55 : (cycle - 0.55) / 0.45;
  const env = Math.sin(phase * Math.PI);

  let inspAmp = 0.8;
  let expAmp = 0.35;

  // Obstruction: breath sound falls, and expiration carries a musical tone -
  // a continuous oscillation, not noise.
  if (f.wheeze) { inspAmp = 0.45; expAmp = 0.12; }

  let v = rnd() * env * (insp ? inspAmp : expAmp);

  if (f.wheeze && !insp) {
    v += Math.sin(t * 55) * env * 1.15;
  }

  if (f.crackles === 'coarse') {
    // Sparse, big, early-inspiratory pops.
    if (insp && phase < 0.45) {
      const k = Math.floor(t * 20);
      const local = t * 20 - k;
      if (local < 0.18) v += Math.exp(-local * 26) * 1.25 * (k % 3 ? 1 : -1);
    }
  } else if (f.crackles === 'fine') {
    // A dense burst of tiny spikes at END-inspiration - the velcro.
    if (insp && phase > 0.6) {
      const k = Math.floor(t * 75);
      const local = t * 75 - k;
      if (local < 0.3) v += Math.exp(-local * 30) * 0.6 * (k % 2 ? 1 : -1);
    }
  }

  if (f.diminished) v *= 0.35;

  return v;
}

/* ------------------------------------------------------------------- mount */

export function mount(container, system) {
  const opts = (list) => list.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');

  container.innerHTML = `
    <div class="bodymap">
      <div class="bm-bar">
        <div class="bm-tabs" role="tablist" aria-label="Simulate or quiz">
          <button type="button" class="bm-tab is-on" data-tab="sim" role="tab" aria-selected="true">Simulate</button>
          <button type="button" class="bm-tab" data-tab="quiz" role="tab" aria-selected="false">Quiz</button>
        </div>
        <label class="bm-pick">
          <span>Heart</span>
          <select data-pick="heart" aria-label="Cardiac condition">${opts(HEART)}</select>
        </label>
        <label class="bm-pick">
          <span>Lungs</span>
          <select data-pick="lung" aria-label="Pulmonary condition">${opts(LUNG)}</select>
        </label>
        <button type="button" class="bm-commit" hidden>Commit</button>
      </div>

      <div class="bm-body">
        <div class="bodymap-figure">
          <svg viewBox="12 22 206 76" class="manikin" role="group"
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
          <div class="scope-banner">Auscultation module active &middot; <b class="scope-mode">Normal / Clear</b></div>
          <div class="scope-head">
            <span class="scope-head-main">
              <span class="scope-site">—</span>
              <span class="scope-loc">Probe a position on the manikin</span>
            </span>
            <span class="scope-tag">TAG —</span>
          </div>
          <canvas class="scope-canvas"></canvas>

          <div class="scope-log" role="log" aria-live="polite"></div>
          <div class="bm-quiz" hidden>
            <p class="bm-quiz-q" aria-live="polite"></p>
            <div class="bm-quiz-actions">
              <button type="button" class="bm-quiz-next" hidden>Next case</button>
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
  const locEl = container.querySelector('.scope-loc');
  const tagEl = container.querySelector('.scope-tag');
  const findingEl = container.querySelector('.scope-finding');
  const noteEl = container.querySelector('.scope-note');
  const modeEl = container.querySelector('.scope-mode');
  const logEl = container.querySelector('.scope-log');
  const quizEl = container.querySelector('.bm-quiz');
  const quizQ = container.querySelector('.bm-quiz-q');
  const quizNext = container.querySelector('.bm-quiz-next');
  const commitBtn = container.querySelector('.bm-commit');
  const heartSel = container.querySelector('[data-pick="heart"]');
  const lungSel = container.querySelector('[data-pick="lung"]');
  const ctx = canvas.getContext('2d');

  let heart = HEART[0];
  let lung = LUNG[0];
  let tab = 'sim';
  let active = POSITIONS[4];
  let raf = 0;
  let t0 = 0;
  let alive = true;
  let quiz = null;   // { heart, lung, answered }
  let score = 0, asked = 0;

  const byId = (list, id) => list.find((c) => c.id === id);
  const pairLabel = (h, l) => `${h.label} / ${l.label}`;
  const findingOf = (p, h = heart, l = lung) => (p.kind === 'heart' ? h.find(p) : l.find(p));

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
    `;
    const pick = () => setActive(p, g);
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
      p.el.setAttribute('aria-label', tab === 'quiz'
        ? `${p.site}. ${p.loc}.`
        : `${p.site}. ${p.loc}. ${f.label}.`);
    });
  }
  paintAria();

  function logLine(html) {
    const t = new Date().toLocaleTimeString('en-CA', { hour12: false });
    const row = document.createElement('div');
    row.className = 'scope-log-row';
    row.innerHTML = `<span>${t}</span> ${html}`;
    logEl.prepend(row);
    while (logEl.children.length > 4) logEl.lastElementChild.remove();
  }

  function setActive(p, btn, silent) {
    active = p;
    buttons.forEach((b) => b.classList.toggle('is-live', b === (btn || p.el)));

    const quizzing = tab === 'quiz';
    const f = findingOf(p);
    siteEl.textContent = p.site;
    locEl.textContent = p.loc;
    tagEl.textContent = `TAG ${String(p.id).padStart(2, '0')}`;
    findingEl.textContent = quizzing ? 'Listen…' : f.label;
    noteEl.textContent = p.kind === 'heart' ? 'Cardiac site' : 'Lung field';

    if (!silent && !quizzing) {
      logLine(`Tag ${String(p.id).padStart(2, '0')} read &middot; ${p.site} &middot; ${f.label}`);
    }

    if (gsap && !reduced()) {
      gsap.fromTo([siteEl, findingEl],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: dampedEase(DAMPING.data, 1.2), stagger: 0.04 }
      );
    }
  }

  /* ---- pickers ---- */
  function onPick() {
    if (tab === 'quiz') return;  // in quiz the pickers are the answer sheet
    heart = byId(HEART, heartSel.value);
    lung = byId(LUNG, lungSel.value);
    modeEl.textContent = pairLabel(heart, lung);
    paintAria();
    setActive(active, active.el, true);
    logLine(`Scenario set &middot; ${pairLabel(heart, lung)}`);
  }
  heartSel.addEventListener('change', onPick);
  lungSel.addEventListener('change', onPick);

  /* ---- quiz: identify the case ----
     A case is dealt in secret: a heart condition over clear lungs, a lung
     condition over a normal heart, or both at once. Probing plays the secret;
     the two pickers are the answer sheet, and Commit checks both. */
  function deal() {
    const kind = Math.floor(Math.random() * 3);
    const randNot = (list) => list[1 + Math.floor(Math.random() * (list.length - 1))];
    const h = kind === 1 ? HEART[0] : randNot(HEART);
    const l = kind === 0 ? LUNG[0] : randNot(LUNG);
    return { heart: h, lung: l, answered: false };
  }

  function newQuestion() {
    quiz = deal();
    heartSel.value = HEART[0].id;
    lungSel.value = LUNG[0].id;
    modeEl.textContent = '?';
    quizQ.textContent = 'A case is running. Probe the chest, set both pickers, then commit.';
    quizQ.className = 'bm-quiz-q';
    quizNext.hidden = true;
    commitBtn.hidden = false;
    commitBtn.disabled = false;
    paintAria();
    setActive(active, active.el, true);
  }

  function answer() {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    asked++;
    const right = heartSel.value === quiz.heart.id && lungSel.value === quiz.lung.id;
    if (right) score++;
    quizQ.innerHTML = right
      ? `Correct: ${pairLabel(quiz.heart, quiz.lung).toLowerCase()}. &middot; <b>${score}/${asked}</b>`
      : `Not this time. It was ${pairLabel(quiz.heart, quiz.lung).toLowerCase()}. &middot; <b>${score}/${asked}</b>`;
    quizQ.className = `bm-quiz-q ${right ? 'is-right' : 'is-wrong'}`;
    commitBtn.disabled = true;
    quizNext.hidden = false;
  }

  commitBtn.addEventListener('click', answer);
  quizNext.addEventListener('click', newQuestion);

  /* ---- tabs ---- */
  const tabBtns = Array.from(container.querySelectorAll('.bm-tab'));
  tabBtns.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    tabBtns.forEach((x) => {
      x.classList.toggle('is-on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    const quizzing = tab === 'quiz';
    quizEl.hidden = !quizzing;
    logEl.hidden = quizzing;
    if (quizzing) newQuestion();
    else {
      quiz = null;
      commitBtn.hidden = true;
      heartSel.value = heart.id;
      lungSel.value = lung.id;
      modeEl.textContent = pairLabel(heart, lung);
      paintAria();
      setActive(active, active.el, true);
    }
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

    // In the quiz the secret case plays at whichever position you probe.
    const f = quiz && tab === 'quiz'
      ? findingOf(active, quiz.heart, quiz.lung)
      : findingOf(active);

    const span = 2.2;
    const base = reduced() ? 0 : t;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.4, w / 900);
    ctx.beginPath();
    const N = Math.min(w, 1400);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const v = sample(active, f, base + u * span);
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
