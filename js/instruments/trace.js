/* ============================================================================
   INSTRUMENT — AutoDrive CAN trace
   ----------------------------------------------------------------------------
   Perception, planning and control run as separate ROS2 nodes and have to agree
   on time. They are synchronized at 10 Hz over CAN. The interesting failure is
   not a crash — it is drift: nothing errors, the nodes just stop agreeing, and
   the car begins acting on stale perception.

   So the instrument is the bus. Four channels ticking at 10 Hz, and a drift
   you can induce to watch the sync error open up.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;
const HZ = 10;
const WINDOW = 120;   // samples held on screen = 12 s at 10 Hz

/* The last channel is the one that matters: how old the newest perception
   message is by the time the planner consumes it. At 10 Hz anything past
   ~100 ms means the controller is steering toward a road that has moved. */
const CHANNELS = [
  { id: 'lane',  label: 'Lateral offset',  unit: 'm',   range: [-1.4, 1.4], accent: false },
  { id: 'steer', label: 'Steering angle',  unit: '°',   range: [-28, 28],   accent: false },
  { id: 'speed', label: 'Speed',           unit: 'm/s', range: [0, 14],     accent: false },
  { id: 'age',   label: 'Perception msg age', unit: 'ms', range: [0, 400],  accent: true },
];

const AGE_LIMIT = 100;

export function mount(container, system) {
  container.innerHTML = `
    <div class="trace">
      <div class="trace-head">
        <span class="trace-title">CAN bus · 10 Hz</span>
        <button type="button" class="trace-drift">Drop perception frames</button>
      </div>
      <div class="trace-body">
        <figure class="trace-cam">
          <video src="assets/LaneDetectionDemo.mp4" autoplay muted loop playsinline
                 preload="metadata" width="426" height="240"
                 aria-label="Onboard footage with the lane detection overlay tracking lane lines."></video>
          <canvas class="trace-ghost" aria-hidden="true"></canvas>
          <span class="trace-stale-flag" aria-hidden="true">PERCEPTION STALE</span>
          <figcaption>Perception · onboard, the lane model's own output</figcaption>
        </figure>
        <div class="trace-channels"></div>
      </div>
      <div class="trace-foot">
        <span class="trace-clock">t = 0.0 s</span>
        <span class="trace-state">nominal</span>
      </div>
    </div>
  `;

  const host = container.querySelector('.trace-channels');
  const clockEl = container.querySelector('.trace-clock');
  const stateEl = container.querySelector('.trace-state');
  const driftBtn = container.querySelector('.trace-drift');
  const ghost = container.querySelector('.trace-ghost');
  const gctx = ghost.getContext('2d');
  const staleFlag = container.querySelector('.trace-stale-flag');

  const chans = CHANNELS.map((c) => {
    const row = document.createElement('div');
    row.className = `tchan${c.accent ? ' tchan--accent' : ''}`;
    row.innerHTML = `
      <div class="tchan-meta">
        <span class="tchan-label">${c.label}</span>
        <span class="tchan-val">—</span>
      </div>
      <canvas class="tchan-canvas"></canvas>
    `;
    host.appendChild(row);
    const canvas = row.querySelector('.tchan-canvas');
    return {
      cfg: c,
      row,
      canvas,
      ctx: canvas.getContext('2d'),
      val: row.querySelector('.tchan-val'),
      buf: new Array(WINDOW).fill(0),
    };
  });

  let t = 0;
  let staleErr = 0;       // metres the lane estimate lags the road
  let lastAge = 16;
  let wasBad = false;
  let drift = 0;          // 0..1, how far the nodes have fallen out of step
  let drifting = false;
  let raf = 0;
  let alive = true;
  let acc = 0;
  let last = 0;

  driftBtn.addEventListener('click', () => {
    drifting = !drifting;
    driftBtn.textContent = drifting ? 'Restore frame rate' : 'Drop perception frames';
    driftBtn.classList.toggle('is-on', drifting);
  });

  /* One 10 Hz sample of every channel. */
  function step() {
    t += 1 / HZ;

    drift = drifting
      ? Math.min(drift + 0.016, 1)
      : Math.max(drift - 0.045, 0);

    // A gentle lane weave, plus the error that stale perception adds: the
    // planner is steering toward where the lane WAS, so in any curvature the
    // estimate and the road pull apart.
    const weave = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9) * 0.16;
    const stale = drift * Math.sin(t * 2.6) * 1.3;
    const lane = weave + stale;
    // What the ghost draws: on this left-curving road the stale estimate is
    // the road continuing straighter than it does, so the target path hangs
    // persistently to the OUTSIDE of the curve. It wanders but never swings
    // back through perfect alignment while frames are still being dropped.
    staleErr = drift * (0.7 + 0.3 * Math.sin(t * 2.1)) * 1.2;

    // Control chases the lane estimate; with a stale estimate the steering
    // hunts hard while the actual road barely moved.
    const steer = -(lane * 16) + drift * Math.sin(t * 3.4) * 18;
    const speed = 9.4 + Math.sin(t * 0.42) * 1.6 - drift * 3.4;

    // Message age: nominal is transport latency plus jitter. Dropping frames
    // sends it climbing toward several consumed cycles.
    const age = 16 + Math.abs(Math.sin(t * 5.1)) * 10 + drift * (290 + Math.sin(t * 1.3) * 30);
    lastAge = age;

    const vals = { lane, steer, speed, age };
    chans.forEach((ch) => {
      ch.buf.push(vals[ch.cfg.id]);
      if (ch.buf.length > WINDOW) ch.buf.shift();
      const v = vals[ch.cfg.id];
      ch.val.textContent = `${v.toFixed(ch.cfg.id === 'age' ? 0 : 2)} ${ch.cfg.unit}`;
    });

    clockEl.textContent = `t = ${t.toFixed(1)} s`;
    // Hysteresis so the banner cannot chatter at the threshold, and the
    // flag's visibility is owned by the hidden attribute rather than a CSS
    // opacity dance - on real phones the transition/animation combination
    // was leaving the flag fully visible at 25 ms.
    if (age > AGE_LIMIT) wasBad = true;
    else if (age < AGE_LIMIT * 0.8) wasBad = false;
    const bad = wasBad;
    stateEl.textContent = bad
      ? `stale perception · acting on ${Math.round(age)} ms old road`
      : 'nominal';
    stateEl.classList.toggle('is-bad', bad);
    staleFlag.hidden = !bad;
    if (bad) staleFlag.textContent = `PERCEPTION STALE · ${Math.round(age)} ms`;
    // The footage itself goes stale: flagged and washed out, because the
    // frame you are watching is no longer the frame the planner is using.
    container.querySelector('.trace')?.classList.toggle('is-stale', bad);
  }

  function size(ch) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ch.canvas.width = Math.round(ch.canvas.clientWidth * dpr);
    ch.canvas.height = Math.round(ch.canvas.clientHeight * dpr);
  }

  function paint(ch) {
    const { ctx, canvas, cfg, buf } = ch;
    const w = canvas.width;
    const h = canvas.height;
    const css = getComputedStyle(document.documentElement);
    const stable = css.getPropertyValue('--stabilize').trim() || '#4DD9E8';
    const over = css.getPropertyValue('--overload').trim() || '#FF3B5C';
    const grid = css.getPropertyValue('--hairline').trim() || '#262A31';

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    const [lo, hi] = cfg.range;
    const norm = (v) => 1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo);

    // The sync channel turns red once it is out of tolerance, because that is
    // the channel that actually matters.
    const hot = cfg.id === 'age' && buf[buf.length - 1] > AGE_LIMIT;
    ctx.strokeStyle = hot ? over : stable;
    ctx.lineWidth = Math.max(1.3, w / 900);
    ctx.beginPath();
    buf.forEach((v, i) => {
      const x = (i / (WINDOW - 1)) * w;
      const y = norm(v) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Leading sample marker — this is a live bus, not a static plot.
    const lx = w;
    const ly = norm(buf[buf.length - 1]) * h;
    ctx.fillStyle = hot ? over : stable;
    ctx.beginPath();
    ctx.arc(lx - 2, ly, Math.max(2, w / 400), 0, Math.PI * 2);
    ctx.fill();
  }

  function sizeGhost() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ghost.width = Math.round(ghost.clientWidth * dpr);
    ghost.height = Math.round(ghost.clientHeight * dpr);
  }

  /* The planner's target path, drawn in perspective over the footage. Nominal
     it hugs the lane centre; with stale perception it is the road as it was
     hundreds of milliseconds ago, so it visibly peels away from where the
     lane actually is - which is exactly the failure on a real test drive. */
  function paintGhost() {
    const w = ghost.width, h = ghost.height;
    if (!w || !h) return;
    const css = getComputedStyle(document.documentElement);
    const stable = css.getPropertyValue('--stabilize').trim() || '#4DA6E8';
    const over = css.getPropertyValue('--overload').trim() || '#FF7A1F';

    gctx.clearRect(0, 0, w, h);

    const bad = lastAge > AGE_LIMIT;
    const err = staleErr;                 // metres of lag
    const vpx = w * 0.5, vpy = h * 0.42;  // vanishing point
    const baseHalf = w * 0.16;            // path half-width at the bumper

    gctx.strokeStyle = bad ? over : stable;
    gctx.globalAlpha = bad ? 0.95 : 0.55;
    gctx.lineWidth = Math.max(2, w / 240);
    gctx.setLineDash(bad ? [] : [w / 60, w / 90]);

    // Chevrons marching up the road. The lateral error scales with distance:
    // near the bumper the estimate still matches; toward the horizon it is
    // the old road.
    for (let i = 0; i < 6; i++) {
      const k = i / 6;                    // 0 near, 1 far
      const y = h * 0.96 - (h * 0.96 - vpy) * k;
      const half = baseHalf * (1 - k * 0.82);
      const cx = vpx + err * (w * 0.22) * k * (bad ? 1 : 0.15);
      gctx.beginPath();
      gctx.moveTo(cx - half, y);
      gctx.lineTo(cx, y - h * 0.03 * (1 - k * 0.6));
      gctx.lineTo(cx + half, y);
      gctx.stroke();
    }
    gctx.setLineDash([]);
    gctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    acc += now - last;
    last = now;

    // Fixed 10 Hz sampling regardless of display refresh rate.
    const period = 1000 / HZ;
    while (acc >= period) { step(); acc -= period; }

    chans.forEach(paint);
    paintGhost();
    raf = requestAnimationFrame(frame);
  }

  chans.forEach(size);
  sizeGhost();
  const onResize = () => { chans.forEach(size); sizeGhost(); };
  window.addEventListener('resize', onResize, { passive: true });

  // Prime the buffers so it opens mid-run rather than from a flat line.
  for (let i = 0; i < WINDOW; i++) step();
  t = 0;

  raf = requestAnimationFrame(frame);

  if (gsap && !reduced()) {
    gsap.from(chans.map((c) => c.row), {
      opacity: 0, x: 20, duration: 0.75, stagger: 0.06,
      ease: dampedEase(DAMPING.data, 1.1),
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
