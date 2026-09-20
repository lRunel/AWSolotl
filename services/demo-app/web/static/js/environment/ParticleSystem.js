/**
 * ParticleSystem.js — Subtle Floating Particles
 *
 * Manages a small pool of lightweight DOM elements that drift slowly
 * across the environment. Designed to be discovered, not noticed.
 *
 * Responsibilities:
 *   - Create a fixed pool of <div> particle elements.
 *   - Animate each particle with slow, organic drift via transform3d.
 *   - Apply parallax depth to particles (they respond to camera movement).
 *   - Wrap particles around viewport edges for seamless looping.
 *   - Occasional opacity pulse ("sparkle") for visual life.
 *
 * Design notes:
 *   - Particles are DOM divs, not canvas/WebGL — consistent with the
 *     CSS-only rendering philosophy.
 *   - Each particle has its own random depth within Config.particles.depthRange,
 *     so they respond to camera movement at different rates.
 *   - Movement is physics-free: simple sinusoidal drift with per-particle
 *     phase offsets. This feels organic without computational cost.
 *   - The pool size is small (default 20) — the system aims for
 *     "barely perceptible" presence, not a blizzard.
 */

import { Config } from './Config.js';

class ParticleSystem {
  constructor() {
    /** @type {HTMLElement} Container element */
    this.el = document.createElement('div');
    this.el.className = 'env-particles';
    this.el.style.position = 'absolute';
    this.el.style.inset = '0';
    this.el.style.zIndex = '5';
    this.el.style.pointerEvents = 'none';
    this.el.style.overflow = 'hidden';

    /** @type {Array<Object>} Particle state objects */
    this._particles = [];

    this._build();
  }

  /**
   * Per-frame update. Moves all particles and applies parallax.
   *
   * @param {number} dt      — delta time in seconds.
   * @param {number} time    — total elapsed time in seconds.
   * @param {number} offsetX — camera horizontal offset in pixels.
   * @param {number} offsetY — camera vertical offset in pixels.
   */
  update(dt, time, offsetX, offsetY) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];

      // Slow horizontal drift + sinusoidal vertical bob
      p.x += p.speedX * dt;
      p.y += Math.sin(time * p.bobFreq + p.phase) * p.bobAmp * dt;

      // Wrap around edges
      if (p.x > vw + 20) p.x = -20;
      if (p.x < -20) p.x = vw + 20;
      if (p.y > vh + 20) p.y = -20;
      if (p.y < -20) p.y = vh + 20;

      // Parallax offset based on particle's depth
      const px = p.x + offsetX * p.depth;
      const py = p.y + offsetY * p.depth;

      // Occasional sparkle — slow opacity pulse
      const sparkle = 0.5 + 0.5 * Math.sin(time * p.sparkleFreq + p.phase);
      const opacity = p.baseOpacity * (0.6 + 0.4 * sparkle);

      // Apply transform (GPU-composited)
      p.el.style.transform = `translate3d(${px.toFixed(0)}px, ${py.toFixed(0)}px, 0)`;
      p.el.style.opacity = opacity.toFixed(2);
    }
  }

  /**
   * Mount the particle container into a parent element.
   *
   * @param {HTMLElement} parent
   */
  mount(parent) {
    parent.appendChild(this.el);
  }

  /**
   * Clean up all particle elements.
   */
  destroy() {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this._particles.length = 0;
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Create the particle pool.
   */
  _build() {
    const cfg = Config.particles;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < cfg.count; i++) {
      // Random size within range
      const size = cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize);

      // Random depth within configured range
      const depth = cfg.depthRange[0] + Math.random() * (cfg.depthRange[1] - cfg.depthRange[0]);

      // Create element
      const el = document.createElement('div');
      el.className = 'env-particle';
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = cfg.color.replace('VAR_OPACITY', String(cfg.opacity));
      el.style.willChange = 'transform, opacity';
      el.style.pointerEvents = 'none';

      this.el.appendChild(el);

      // State for this particle
      this._particles.push({
        el,
        x: Math.random() * vw,
        y: Math.random() * vh,
        depth,
        speedX: (cfg.speed + Math.random() * cfg.speed) * (Math.random() > 0.5 ? 1 : -0.3),
        bobFreq: 0.3 + Math.random() * 0.5,
        bobAmp: 8 + Math.random() * 15,
        phase: Math.random() * Math.PI * 2,
        sparkleFreq: 0.4 + Math.random() * 0.8,
        baseOpacity: cfg.opacity * (0.5 + Math.random() * 0.5),
      });
    }
  }
}

export { ParticleSystem };
