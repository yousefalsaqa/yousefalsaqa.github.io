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

const CHANNELS = [
  { id: 'lane',  label: 'Lane offset',   unit: 'm',  range: [-1.4, 1.4], accent: false },
  { id: 'steer', label: 'Steering angle', unit: '°',  range: [-28, 28],   accent: false },
  { id: 'speed', label: 'Velocity',      unit: 'm/s', range: [0, 14],     accent: false },
  { id: 'sync',  label: 'Node sync error', unit: 'ms', range: [0, 120],   accent: true },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="trace">
      <div class="trace-head">
        <span class="trace-title">CAN bus · 10 Hz</span>
        <button type="button" class="trace-drift">Induce node drift</button>
      </div>
      <div class="trace-body">
        <figure class="trace-cam">
          <video src="assets/LaneDetectionDemo.mp4" autoplay muted loop playsinline
                 preload="metadata" width="426" height="240"
                 aria-label="Onboard footage with the lane detection overlay tracking lane lines."></video>
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
  let drift = 0;          // 0..1, how far the nodes have fallen out of step
  let drifting = false;
  let raf = 0;
  let alive = true;
  let acc = 0;
  let last = 0;

  driftBtn.addEventListener('click', () => {
    drifting = !drifting;
    driftBtn.textContent = drifting ? 'Resynchronize' : 'Induce node drift';
    driftBtn.classList.toggle('is-on', drifting);
  });

  /* One 10 Hz sample of every channel. */
  function step() {
    t += 1 / HZ;

    drift = drifting
      ? Math.min(drift + 0.016, 1)
      : Math.max(drift - 0.045, 0);

    // A gentle lane weave, plus growing error as perception goes stale.
    const weave = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9) * 0.16;
    const stale = drift * Math.sin(t * 2.6) * 0.9;
    const lane = weave + stale;

    // Control chases the lane offset; with drift it chases an old value.
    const steer = -(lane * 16) + drift * Math.sin(t * 3.4) * 11;
    const speed = 9.4 + Math.sin(t * 0.42) * 1.6 - drift * 2.2;
    const sync = 4 + drift * 96 + Math.abs(Math.sin(t * 5.1)) * (2 + drift * 14);

    const vals = { lane, steer, speed, sync };
    chans.forEach((ch) => {
      ch.buf.push(vals[ch.cfg.id]);
      if (ch.buf.length > WINDOW) ch.buf.shift();
      const v = vals[ch.cfg.id];
      ch.val.textContent = `${v.toFixed(ch.cfg.id === 'sync' ? 0 : 2)} ${ch.cfg.unit}`;
    });

    clockEl.textContent = `t = ${t.toFixed(1)} s`;
    const bad = sync > 40;
    stateEl.textContent = bad ? 'stale perception' : 'nominal';
    stateEl.classList.toggle('is-bad', bad);
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
    const hot = cfg.id === 'sync' && buf[buf.length - 1] > 40;
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

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    acc += now - last;
    last = now;

    // Fixed 10 Hz sampling regardless of display refresh rate.
    const period = 1000 / HZ;
    while (acc >= period) { step(); acc -= period; }

    chans.forEach(paint);
    raf = requestAnimationFrame(frame);
  }

  chans.forEach(size);
  const onResize = () => chans.forEach(size);
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
