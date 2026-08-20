/* ============================================================================
   INSTRUMENT — ACA parallel sessions
   ----------------------------------------------------------------------------
   PeopleSoft has no API, so every action is a browser doing what a person would
   do, only faster and without getting bored. The tool runs five independent
   sessions at once behind a single Start / Next / Skip workflow: the evaluator
   reads the documents and types one number, and five workers fan out to do the
   data entry, the sign-off, the curriculum change and the requirement update.

   The instrument is that fan-out. Type a score, watch five sessions carry it.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

const STEPS = [
  'Open applicant',
  'Write admit basis',
  'Set curriculum',
  'Enter score',
  'Sign off documents',
  'Update requirements',
  'Advance',
];

/* Each worker runs at its own pace — PeopleSoft is not uniformly slow, it is
   unpredictably slow, and the fan-out exists precisely because of that. */
const WORKERS = [
  { id: 1, rate: 1.00, curriculum: 'IB' },
  { id: 2, rate: 0.72, curriculum: 'GCSE / A-Level' },
  { id: 3, rate: 1.28, curriculum: 'CBSE' },
  { id: 4, rate: 0.88, curriculum: 'Ontario' },
  { id: 5, rate: 1.12, curriculum: 'CEGEP' },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="sessions">
      <div class="sessions-input">
        <label class="sessions-field">
          <span class="sessions-field-label">Evaluator types one number</span>
          <input class="sessions-score" type="number" min="0" max="100" value="87"
                 aria-label="Calculated admission average">
        </label>
        <button type="button" class="sessions-go">Next applicant</button>
      </div>

      <div class="sessions-grid"></div>

      <div class="sessions-foot">
        <span class="sessions-count">0 processed</span>
        <span class="sessions-note">5 sessions · no API · everything through the browser</span>
      </div>
    </div>
  `;

  const grid = container.querySelector('.sessions-grid');
  const scoreInput = container.querySelector('.sessions-score');
  const goBtn = container.querySelector('.sessions-go');
  const countEl = container.querySelector('.sessions-count');

  let processed = 0;
  let running = false;
  let raf = 0;
  let alive = true;
  let last = 0;

  const lanes = WORKERS.map((wk) => {
    const el = document.createElement('div');
    el.className = 'lane';
    el.innerHTML = `
      <div class="lane-head">
        <span class="lane-id">S${wk.id}</span>
        <span class="lane-curriculum">${wk.curriculum}</span>
      </div>
      <ol class="lane-steps">
        ${STEPS.map((s) => `<li><span class="lane-dot"></span><span class="lane-step">${s}</span></li>`).join('')}
      </ol>
      <div class="lane-state">idle</div>
    `;
    grid.appendChild(el);
    return {
      cfg: wk,
      el,
      items: Array.from(el.querySelectorAll('.lane-steps li')),
      state: el.querySelector('.lane-state'),
      progress: 0,
      done: false,
    };
  });

  function reset() {
    lanes.forEach((l) => {
      l.progress = 0;
      l.done = false;
      l.items.forEach((i) => i.classList.remove('is-done', 'is-active'));
      l.state.textContent = 'idle';
      l.el.classList.remove('is-done');
    });
  }

  function start() {
    if (running) return;
    reset();
    running = true;
    goBtn.disabled = true;
    goBtn.textContent = 'Running';
    const score = scoreInput.value || '—';
    lanes.forEach((l) => { l.state.textContent = `score ${score}`; });
  }

  goBtn.addEventListener('click', start);
  scoreInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); start(); }
  });

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (running) {
      let allDone = true;
      lanes.forEach((l) => {
        if (l.done) return;
        allDone = false;
        l.progress += dt * l.cfg.rate * 1.15;

        const idx = Math.min(Math.floor(l.progress), STEPS.length);
        l.items.forEach((item, i) => {
          item.classList.toggle('is-done', i < idx);
          item.classList.toggle('is-active', i === idx);
        });

        if (idx >= STEPS.length) {
          l.done = true;
          l.el.classList.add('is-done');
          l.state.textContent = 'complete';
          processed++;
          countEl.textContent = `${processed} processed`;
          if (gsap && !reduced()) {
            gsap.fromTo(l.el,
              { y: -6 },
              { y: 0, duration: 0.8, ease: dampedEase(DAMPING.card, 1.4) }
            );
          }
        }
      });

      if (allDone) {
        running = false;
        goBtn.disabled = false;
        goBtn.textContent = 'Next applicant';
      }
    }

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  if (gsap && !reduced()) {
    gsap.from(lanes.map((l) => l.el), {
      opacity: 0, y: 22, duration: 0.85, stagger: 0.06,
      ease: dampedEase(DAMPING.card, 1.2),
    });
  }

  // Run once on mount so it is alive when you arrive.
  setTimeout(start, reduced() ? 0 : 450);

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      container.innerHTML = '';
    },
  };
}
