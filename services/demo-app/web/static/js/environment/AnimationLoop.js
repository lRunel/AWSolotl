/**
 * AnimationLoop.js — Frame Scheduler
 *
 * Wraps requestAnimationFrame into a clean start/stop/pause lifecycle.
 * Registered callbacks receive a clamped deltaTime (seconds) each frame.
 *
 * Responsibilities:
 *   - Drive the animation tick for all environment subsystems.
 *   - Auto-pause when the browser tab is hidden.
 *   - Respect prefers-reduced-motion by running a single update then stopping.
 *   - Clamp deltaTime to prevent spiral-of-death after long pauses.
 *
 * Usage:
 *   const loop = new AnimationLoop();
 *   loop.onUpdate((dt) => { ... });
 *   loop.start();
 */

import { Config } from './Config.js';

class AnimationLoop {
  constructor() {
    /** @type {Array<function(number): void>} */
    this._subscribers = [];

    /** @type {number|null} */
    this._rafId = null;

    /** @type {number} Last timestamp from performance.now() */
    this._lastTime = 0;

    /** @type {boolean} */
    this._running = false;

    /** @type {boolean} */
    this._paused = false;

    /** @type {boolean} */
    this._reducedMotion = false;

    // Bind methods for stable references (needed for removeEventListener)
    this._tick = this._tick.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);

    // Detect motion preference
    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotion = this._motionQuery.matches;

    // Listen for runtime changes to motion preference
    this._onMotionChange = this._onMotionChange.bind(this);
    this._motionQuery.addEventListener('change', this._onMotionChange);
  }

  /**
   * Register a callback to be called each frame.
   * @param {function(number): void} fn — receives deltaTime in seconds.
   * @returns {void}
   */
  onUpdate(fn) {
    if (typeof fn === 'function' && !this._subscribers.includes(fn)) {
      this._subscribers.push(fn);
    }
  }

  /**
   * Remove a previously registered callback.
   * @param {function(number): void} fn
   * @returns {void}
   */
  offUpdate(fn) {
    const index = this._subscribers.indexOf(fn);
    if (index !== -1) {
      this._subscribers.splice(index, 1);
    }
  }

  /**
   * Start the animation loop.
   *
   * If prefers-reduced-motion is active, fires a single update (dt=0)
   * so that all layers render at their initial state, then stops.
   */
  start() {
    if (this._running) return;
    this._running = true;

    document.addEventListener('visibilitychange', this._onVisibilityChange);

    if (this._reducedMotion) {
      // Single paint pass — environment appears but doesn't animate
      this._notifySubscribers(0);
      return;
    }

    this._lastTime = performance.now();
    this._scheduleFrame();
  }

  /**
   * Stop the loop entirely and cancel any pending frame.
   */
  stop() {
    this._running = false;
    this._cancelFrame();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  /**
   * Pause without tearing down. Resumes from where it left off.
   */
  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    this._cancelFrame();
  }

  /**
   * Resume after a pause.
   */
  resume() {
    if (!this._running || !this._paused) return;
    this._paused = false;

    if (this._reducedMotion) return;

    // Reset timestamp to avoid a huge delta spike
    this._lastTime = performance.now();
    this._scheduleFrame();
  }

  /**
   * Tear down the loop and release all references.
   */
  destroy() {
    this.stop();
    this._subscribers.length = 0;
    this._motionQuery.removeEventListener('change', this._onMotionChange);
  }

  /**
   * @returns {boolean} Whether the loop is currently running and not paused.
   */
  get active() {
    return this._running && !this._paused;
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Core frame callback.
   * @param {number} now — timestamp from requestAnimationFrame (ms).
   */
  _tick(now) {
    if (!this._running || this._paused) return;

    // Compute and clamp deltaTime
    let dtMs = now - this._lastTime;
    if (dtMs > Config.performance.maxDeltaMs) {
      dtMs = Config.performance.maxDeltaMs;
    }
    this._lastTime = now;

    // Convert to seconds for consumer convenience
    const dt = dtMs / 1000;

    this._notifySubscribers(dt);
    this._scheduleFrame();
  }

  /**
   * Call all registered subscribers with the given deltaTime.
   * @param {number} dt — delta time in seconds.
   */
  _notifySubscribers(dt) {
    for (let i = 0; i < this._subscribers.length; i++) {
      this._subscribers[i](dt);
    }
  }

  /** Schedule the next animation frame. */
  _scheduleFrame() {
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Cancel any pending animation frame. */
  _cancelFrame() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Auto-pause when tab is hidden, resume when visible.
   */
  _onVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * React to runtime changes in prefers-reduced-motion.
   * @param {MediaQueryListEvent} e
   */
  _onMotionChange(e) {
    this._reducedMotion = e.matches;

    if (this._reducedMotion && this._running) {
      // Stop animating, do one final paint
      this._cancelFrame();
      this._notifySubscribers(0);
    } else if (!this._reducedMotion && this._running && !this._paused) {
      // User turned off reduced motion — start animating
      this._lastTime = performance.now();
      this._scheduleFrame();
    }
  }
}

export { AnimationLoop };
