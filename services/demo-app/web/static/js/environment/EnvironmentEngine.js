/**
 * EnvironmentEngine.js — Top-Level Orchestrator
 *
 * The single entry point for the Rune-os environment system.
 * Initializes all subsystems, wires them together, and manages lifecycle.
 *
 * Responsibilities:
 *   - Boot all subsystems: AnimationLoop, TimeSystem, Scene, ParticleSystem.
 *   - Register per-frame update callbacks on the AnimationLoop.
 *   - Respect prefers-reduced-motion (handled by AnimationLoop).
 *   - Provide a public API for external integration (OS bridge events).
 *   - Own the full lifecycle: init → running → destroy.
 *
 * Design notes:
 *   - EnvironmentEngine is the only module that imports everything.
 *     All other modules are self-contained with minimal imports.
 *   - The engine auto-initializes on DOMContentLoaded (like the old Wallpaper3D).
 *   - The Scene is mounted into #desktop-env, replacing the old <canvas>.
 */

import { AnimationLoop } from './AnimationLoop.js';
import { TimeSystem } from './TimeSystem.js';
import { Scene } from './Scene.js';
import { ParticleSystem } from './ParticleSystem.js';

class EnvironmentEngine {
  constructor() {
    /** @type {AnimationLoop} */
    this.loop = null;

    /** @type {TimeSystem} */
    this.time = null;

    /** @type {Scene} */
    this.scene = null;

    /** @type {ParticleSystem} */
    this.particles = null;

    /** @type {number} Elapsed time accumulator (seconds) */
    this._elapsed = 0;

    /** @type {boolean} */
    this._initialized = false;
  }

  /**
   * Initialize and start the environment engine.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Find the desktop environment container
    const desktop = document.getElementById('desktop-env');
    if (!desktop) {
      console.warn('[EnvironmentEngine] #desktop-env not found. Aborting init.');
      return;
    }

    // Initialize subsystems
    this.loop = new AnimationLoop();
    this.time = new TimeSystem();
    this.scene = new Scene();
    this.particles = new ParticleSystem();

    // Mount scene and particles into the desktop environment
    this.scene.mount(desktop);
    this.particles.mount(this.scene.el);

    // Wire the main update loop
    this._update = this._update.bind(this);
    this.loop.onUpdate(this._update);

    // Start animating
    this.loop.start();

    console.log('[EnvironmentEngine] Initialized — phase:', this.time.phase);
  }

  /**
   * Override the time-of-day phase (for testing or demos).
   *
   * @param {string|null} phase — 'morning', 'afternoon', 'evening', 'night', or null for auto.
   */
  setPhase(phase) {
    if (this.time) {
      this.time.setOverride(phase);
    }
  }

  /**
   * Tear down the entire environment engine and release all resources.
   */
  destroy() {
    if (!this._initialized) return;

    this.loop.destroy();
    this.time.destroy();
    this.particles.destroy();
    this.scene.destroy();

    this.loop = null;
    this.time = null;
    this.scene = null;
    this.particles = null;
    this._initialized = false;
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Main per-frame update callback.
   * Drives all subsystems with the current frame's delta time.
   *
   * @param {number} dt — delta time in seconds.
   */
  _update(dt) {
    this._elapsed += dt;

    const phase = this.time.phase;

    // Update the scene (camera + layers + sky)
    this.scene.update(dt, phase, this._elapsed);

    // Update particles (pass camera offset for depth parallax)
    this.particles.update(
      dt,
      this._elapsed,
      this.scene.camera.offsetX,
      this.scene.camera.offsetY
    );
  }
}

// ── Auto-Initialize ───────────────────────────────────────────

const engine = new EnvironmentEngine();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => engine.init());
} else {
  engine.init();
}

// Expose for console debugging and OS bridge integration
window.EnvironmentEngine = engine;

export { EnvironmentEngine };
