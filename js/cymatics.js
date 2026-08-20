/* ============================================================================
   CYMATICS — WebGL2 Chladni plate
   ----------------------------------------------------------------------------
   A square plate driven at a resonant frequency forms standing waves. Sand
   sprinkled on it migrates away from the antinodes and collects along the
   nodal lines, where the plate is not moving. Those patterns are Chladni
   figures, and for an ideal square plate with free edges they are the zero set
   of

       s(x, y) = cos(n*pi*x)*cos(m*pi*y) - cos(m*pi*x)*cos(n*pi*y)

   for integer mode pair (n, m). This renders |s| -> 0 as accumulated sand,
   morphing between mode pairs so the figure continuously re-forms.

   Raw WebGL2 rather than three.js: this is one full-screen quad, and three.js
   would be ~600KB to draw it. No dependency, no CDN, ~1KB of shader.
   ========================================================================== */

import { dampedEase, reduced } from './secondorder.js';

/* Mode pairs to cycle through. Chosen for visual distinctness — pairs that are
   too close produce a barely perceptible morph. */
const MODES = [
  [1, 2], [2, 3], [1, 4], [3, 4], [2, 5],
  [4, 5], [1, 6], [3, 6], [2, 7], [5, 6],
];

const SECONDS_PER_MODE = 5.0;
const MORPH_SECONDS = 1.8;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMode;      // interpolated (n, m)
uniform vec2  uPointer;   // 0..1, plate-space
uniform float uPointerAmt;// 0..1 pointer influence
uniform float uExcite;    // 0..1 drive level -> colour shift
uniform vec3  uInk;       // sand colour
uniform vec3  uGround;    // plate colour
uniform vec3  uStable;    // accent: settled
uniform vec3  uOver;      // accent: overdriven

out vec4 outColor;

const float PI = 3.141592653589793;

// Chladni displacement field for a square plate.
float chladni(vec2 p, float n, float m) {
  return cos(n * PI * p.x) * cos(m * PI * p.y)
       - cos(m * PI * p.x) * cos(n * PI * p.y);
}

// Cheap hash for sand grain.
float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

void main() {
  // Square aspect so the plate is not stretched: cover the viewport, crop the
  // long axis rather than distorting the figure.
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  if (aspect > 1.0) { uv.x = (uv.x - 0.5) * aspect + 0.5; }
  else              { uv.y = (uv.y - 0.5) / aspect + 0.5; }

  // The pointer acts as a local driver, warping the plate slightly toward it.
  vec2 d = uv - uPointer;
  float pull = exp(-dot(d, d) * 9.0) * uPointerAmt;
  vec2 p = uv + d * pull * 0.22;

  float s = chladni(p, uMode.x, uMode.y);

  // Distance-to-nodal-line, normalised by the local gradient so line weight is
  // even across the plate instead of thinning where the field is steep.
  float grad = fwidth(s);
  float dist = abs(s) / max(grad, 1e-5);

  // Sand accumulation: dense on the line, falling off fast.
  float sand = 1.0 - smoothstep(0.0, 2.2, dist);
  sand = pow(sand, 1.35);

  // Grain. Sand is granular, not a vector stroke — without this it reads as
  // a plotted contour and loses the physicality entirely.
  float g = hash(floor(gl_FragCoord.xy * 0.85) + floor(uTime * 3.0) * 0.017);
  sand *= 0.72 + 0.28 * g;

  // A faint standing-wave sheen on the plate itself, so the untouched area is
  // not dead flat and you can read where the antinodes are.
  float sheen = (1.0 - smoothstep(0.0, 14.0, dist)) * 0.045;

  vec3 accent = mix(uStable, uOver, uExcite);
  vec3 col = uGround + sheen * accent;
  col = mix(col, mix(uInk, accent, 0.28 + 0.45 * uExcite), sand);

  // Vignette, keeps the edges from competing with the type over the top.
  vec2 v = (gl_FragCoord.xy / uRes - 0.5) * 2.0;
  col *= 1.0 - 0.34 * dot(v, v);

  outColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Read a CSS custom property off :root and return it as an RGB triple. */
function tokenRgb(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  try { return hexToRgb(raw || fallback); }
  catch { return hexToRgb(fallback); }
}

export class CymaticPlate {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.raf = 0;
    this.running = false;
    this.startTime = 0;
    this.excite = 0;
    this.pointer = [0.5, 0.5];
    this.pointerAmt = 0;
    this.morph = dampedEase(0.55, 1.0);
    // Mode state. `driven` flips true once a tuner takes control; until then
    // the plate drifts through MODES on its own.
    this.driven = false;
    this.modeFrom = null;
    this.modeTo = null;
    this.modeAt = null;
    this.morphStart = null;
    this._onResize = this._resize.bind(this);
    this._onPointer = this._pointerMove.bind(this);
    this._onLeave = () => { this.pointerAmt = 0; };
  }

  /** @returns {boolean} true if WebGL2 came up and the plate is live. */
  init() {
    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) return false;

    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('link failed: ' + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.gl = gl;
      this.prog = prog;
      this.u = {
        res:        gl.getUniformLocation(prog, 'uRes'),
        time:       gl.getUniformLocation(prog, 'uTime'),
        mode:       gl.getUniformLocation(prog, 'uMode'),
        pointer:    gl.getUniformLocation(prog, 'uPointer'),
        pointerAmt: gl.getUniformLocation(prog, 'uPointerAmt'),
        excite:     gl.getUniformLocation(prog, 'uExcite'),
        ink:        gl.getUniformLocation(prog, 'uInk'),
        ground:     gl.getUniformLocation(prog, 'uGround'),
        stable:     gl.getUniformLocation(prog, 'uStable'),
        over:       gl.getUniformLocation(prog, 'uOver'),
      };
    } catch (err) {
      console.warn('[cymatics]', err.message);
      return false;
    }

    this.readTokens();
    this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    this.canvas.addEventListener('pointermove', this._onPointer, { passive: true });
    this.canvas.addEventListener('pointerleave', this._onLeave, { passive: true });

    this.canvas.dataset.live = 'true';
    return true;
  }

  /** Re-read palette tokens. Called on init and whenever the theme flips. */
  readTokens() {
    this.ink    = tokenRgb('--sand',      '#C8CCD4');
    this.ground = tokenRgb('--ground',    '#08090B');
    this.stable = tokenRgb('--stabilize', '#4DD9E8');
    this.over   = tokenRgb('--overload',  '#FF3B5C');
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.gl) this.gl.viewport(0, 0, w, h);
  }

  _pointerMove(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    this.pointerAmt = 1;
  }

  /** Drive level, 0..1 — wired to scroll velocity by the caller. */
  setExcitation(v) {
    this.excite = Math.min(Math.max(v, 0), 1);
  }

  /**
   * Drive the plate to a mode pair. Called by the tuner when the visitor
   * sweeps to a different system; the plate rings into the new figure rather
   * than cutting to it.
   *
   * @param {number} n
   * @param {number} m
   * @param {boolean} [immediate] Skip the morph (first paint, or reduced motion).
   */
  setMode(n, m, immediate = false) {
    this.driven = true;
    this.modeTo = [n, m];
    if (immediate || reduced()) {
      this.modeFrom = [n, m];
      this.modeAt = [n, m];
      this.morphStart = null;
      return;
    }
    // Morph from wherever the plate currently is, so an interrupted sweep
    // continues from its real position instead of snapping back.
    this.modeFrom = this.modeAt ? this.modeAt.slice() : [n, m];
    this.morphStart = null;   // stamped on the next frame
  }

  /** Interpolated mode pair at time t. */
  _modeAt(t) {
    if (this.driven) {
      if (!this.modeTo) return MODES[0];
      if (!this.modeFrom) return this.modeTo;
      if (this.morphStart === null) this.morphStart = t;
      const k = Math.min((t - this.morphStart) / MORPH_SECONDS, 1);
      if (k >= 1) {
        this.modeAt = this.modeTo.slice();
        return this.modeAt;
      }
      const e = this.morph(k);
      this.modeAt = [
        this.modeFrom[0] + (this.modeTo[0] - this.modeFrom[0]) * e,
        this.modeFrom[1] + (this.modeTo[1] - this.modeFrom[1]) * e,
      ];
      return this.modeAt;
    }

    // Undriven: drift through the mode table on its own.
    if (reduced()) return MODES[2];
    const idx = Math.floor(t / SECONDS_PER_MODE);
    const into = t - idx * SECONDS_PER_MODE;
    const a = MODES[idx % MODES.length];
    const b = MODES[(idx + 1) % MODES.length];
    if (into > MORPH_SECONDS) return a;
    const k = this.morph(into / MORPH_SECONDS);
    this.modeAt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    return this.modeAt;
  }

  _frame(now) {
    if (!this.running) return;
    if (!this.startTime) this.startTime = now;
    const t = (now - this.startTime) / 1000;

    const gl = this.gl;
    const [n, m] = this._modeAt(t);

    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.time, t);
    gl.uniform2f(this.u.mode, n, m);
    gl.uniform2f(this.u.pointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.u.pointerAmt, this.pointerAmt);
    gl.uniform1f(this.u.excite, this.excite);
    gl.uniform3fv(this.u.ink, this.ink);
    gl.uniform3fv(this.u.ground, this.ground);
    gl.uniform3fv(this.u.stable, this.stable);
    gl.uniform3fv(this.u.over, this.over);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pointer influence decays, so the warp relaxes when the cursor stops.
    this.pointerAmt *= 0.96;
    // Excitation bleeds off; scroll re-drives it.
    this.excite *= 0.94;

    this.raf = requestAnimationFrame(this._frame.bind(this));
  }

  start() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.raf = requestAnimationFrame(this._frame.bind(this));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    // Re-baseline so the figure does not jump after a long pause.
    this.startTime = 0;
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('pointermove', this._onPointer);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
    const gl = this.gl;
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
    delete this.canvas.dataset.live;
  }
}

/**
 * Mount the plate on a canvas, wiring visibility so it never burns frames
 * off-screen or in a background tab.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {CymaticPlate|null} null when WebGL2 is unavailable — the caller
 *   should leave the static SVG poster in place.
 */
export function mountPlate(canvas) {
  if (!canvas) return null;
  const plate = new CymaticPlate(canvas);
  if (!plate.init()) return null;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !document.hidden) plate.start();
      else plate.stop();
    }, { threshold: 0.01 });
    io.observe(canvas);
    plate._io = io;
  } else {
    plate.start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) plate.stop();
    else if (canvas.isConnected) plate.start();
  });

  return plate;
}
