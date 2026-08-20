/* ============================================================================
   INSTRUMENT — ACA parallel sessions
   ----------------------------------------------------------------------------
   PeopleSoft has no API, so every action is a browser doing what a person
   would do, only faster and without getting bored. The tool holds five
   sessions open at once — one per screen of the workflow — and works them in
   parallel on the same applicant: the evaluator reads the documents, types one
   number, and the five screens get carried together instead of one at a time.

   Screen descriptions are kept deliberately general.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* One lane per PeopleSoft screen. Each has its own short task list, and its
   own pace — PeopleSoft is not uniformly slow, it is unpredictably slow,
   which is the reason the sessions exist at all. */
const SCREENS = [
  { id: 1, role: 'records',         rate: 1.00,
    steps: ['Find the applicant', 'Open the transcript', 'Pull what the rest need'] },
  { id: 2, role: 'program & grade', rate: 0.82,
    steps: ['Open the application', 'Set the program', 'Enter the average'] },
  { id: 3, role: 'documents',       rate: 0.72,
    steps: ['Open the checklist', 'Sign off each item', 'Close it out'] },
  { id: 4, role: 'application',     rate: 1.15,
    steps: ['Where they applied from', 'Read the choice order', 'Note the rest'] },
  { id: 5, role: 'maintenance',     rate: 0.90,
    steps: ['Set the admit basis', 'Apply what changed', 'Save and verify'] },
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
        <span class="sessions-note">5 screens · no API · everything through the browser</span>
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

  const lanes = SCREENS.map((sc) => {
    const el = document.createElement('div');
    el.className = 'lane';
    el.innerHTML = `
      <div class="lane-head">
        <span class="lane-id">S${sc.id}</span>
        <span class="lane-curriculum">${sc.role}</span>
      </div>
      <ol class="lane-steps">
        ${sc.steps.map((s) => `<li><span class="lane-dot"></span><span class="lane-step">${s}</span></li>`).join('')}
      </ol>
      <div class="lane-state">idle</div>
    `;
    grid.appendChild(el);
    return {
      cfg: sc,
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
      // A random stall per lane, because that is what PeopleSoft actually
      // does: nothing for a second and a half, then fine again.
      l.stalls = new Map();
      l.stalls.set(1 + Math.floor(Math.random() * (l.cfg.steps.length - 1)),
                   0.6 + Math.random() * 1.4);
      l.stallLeft = 0;
      l.items.forEach((i) => i.classList.remove('is-done', 'is-active'));
      l.state.textContent = 'idle';
      l.el.classList.remove('is-done', 'is-stalled');
    });
  }

  function laneStateText(l) {
    // Only the program & grade screen carries the typed number; the others
    // are doing their own part of the same applicant.
    return l.cfg.id === 2 ? `average ${scoreInput.value || '—'}` : 'working';
  }

  function start() {
    if (running) return;
    reset();
    running = true;
    goBtn.disabled = true;
    goBtn.textContent = 'Running';
    lanes.forEach((l) => { l.state.textContent = laneStateText(l); });
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
        const nSteps = l.cfg.steps.length;

        // Stalled: hold position, show it, count it down.
        if (l.stallLeft > 0) {
          l.stallLeft -= dt;
          if (l.stallLeft <= 0) {
            l.el.classList.remove('is-stalled');
            l.state.textContent = laneStateText(l);
          }
        } else {
          const before = Math.floor(l.progress);
          l.progress += dt * l.cfg.rate * 0.9;
          const nowStep = Math.floor(l.progress);
          if (nowStep !== before && l.stalls.has(nowStep)) {
            l.stallLeft = l.stalls.get(nowStep);
            l.stalls.delete(nowStep);
            l.el.classList.add('is-stalled');
            l.state.textContent = 'waiting on PeopleSoft…';
          }
        }

        const idx = Math.min(Math.floor(l.progress), nSteps);
        l.items.forEach((item, i) => {
          item.classList.toggle('is-done', i < idx);
          item.classList.toggle('is-active', i === idx);
        });

        if (idx >= nSteps) {
          l.done = true;
          l.el.classList.add('is-done');
          l.state.textContent = 'complete';
          if (gsap && !reduced()) {
            gsap.fromTo(l.el,
              { y: -6 },
              { y: 0, duration: 0.8, ease: dampedEase(DAMPING.card, 1.4) }
            );
          }
        }
      });

      // One applicant is processed when every screen is done, so the counter
      // moves once per applicant rather than once per screen.
      if (allDone) {
        running = false;
        processed++;
        countEl.textContent = `${processed} processed`;
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

  // Waits for the evaluator. The number field is the invitation.

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      container.innerHTML = '';
    },
  };
}
