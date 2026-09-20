/**
 * TimeSystem.js — Time-of-Day Phase Manager
 *
 * Determines the current time-of-day phase (morning, afternoon, evening, night)
 * based on the visitor's local clock. Emits events when the phase transitions.
 *
 * Responsibilities:
 *   - Read the local hour and map it to a named phase.
 *   - Compute progress (0–1) within the current phase for smooth transitions.
 *   - Emit 'phasechange' events for subscribers (sky color, lighting, etc.).
 *   - Poll at a low frequency (~1/min) to avoid wasting cycles.
 *
 * Design notes:
 *   - This module does NOT modify any visuals. It produces data.
 *     The EnvironmentEngine reads .phase and .progress to drive sky gradients.
 *   - Phase boundaries come from Config.time.phases, making them tunable.
 *   - Extensible: future weather, season, or mood systems can subscribe
 *     to phase changes or override the phase entirely.
 */

import { Config } from './Config.js';

class TimeSystem {
  constructor() {
    /** @type {string} Current phase name */
    this.phase = 'afternoon';

    /** @type {number} Progress within current phase (0–1) */
    this.progress = 0.5;

    /** @type {boolean} Whether the current phase is dark (evening/night) */
    this.isDark = false;

    /** @type {Map<string, Array<function>>} */
    this._listeners = new Map();

    /** @type {number|null} */
    this._pollTimer = null;

    /** @type {string|null} Manual override phase */
    this._override = null;

    // Initial computation
    this._compute();

    // Start polling
    this._pollTimer = setInterval(() => this._compute(), Config.time.pollIntervalMs);
  }

  /**
   * Subscribe to an event.
   *
   * @param {string} event — event name (e.g., 'phasechange').
   * @param {function} callback
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  /**
   * Remove a subscription.
   *
   * @param {string} event
   * @param {function} callback
   */
  off(event, callback) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * Override the time phase manually (useful for testing or demos).
   * Pass null to restore automatic detection.
   *
   * @param {string|null} phase — 'morning', 'afternoon', 'evening', 'night', or null.
   */
  setOverride(phase) {
    this._override = phase;
    this._compute();
  }

  /**
   * Force a re-computation of the current phase.
   * Normally called internally by the poll timer.
   */
  refresh() {
    this._compute();
  }

  /**
   * Clean up timers and listeners.
   */
  destroy() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._listeners.clear();
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Compute the current phase and progress from the local clock.
   */
  _compute() {
    if (this._override) {
      const oldPhase = this.phase;
      this.phase = this._override;
      this.progress = 0.5;
      this.isDark = this.phase === 'night' || this.phase === 'evening';
      if (oldPhase !== this.phase) {
        this._emit('phasechange', { phase: this.phase, previous: oldPhase });
      }
      return;
    }

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const phases = Config.time.phases;

    // Find the latest phase whose start hour is <= current hour
    let matchedPhase = phases[0];
    let nextPhaseStart = 24;

    for (let i = 0; i < phases.length; i++) {
      if (hour >= phases[i].start) {
        matchedPhase = phases[i];
        // Next phase start (or 24 if this is the last one)
        nextPhaseStart = (i + 1 < phases.length) ? phases[i + 1].start : 24;
      }
    }

    const phaseDuration = nextPhaseStart - matchedPhase.start;
    const elapsed = hour - matchedPhase.start;
    const progress = phaseDuration > 0 ? elapsed / phaseDuration : 0;

    const oldPhase = this.phase;
    this.phase = matchedPhase.name;
    this.progress = Math.max(0, Math.min(1, progress));
    this.isDark = this.phase === 'night' || this.phase === 'evening';

    if (oldPhase !== this.phase) {
      this._emit('phasechange', { phase: this.phase, previous: oldPhase });
    }
  }

  /**
   * Emit an event to all registered listeners.
   *
   * @param {string} event
   * @param {*} data
   */
  _emit(event, data) {
    const list = this._listeners.get(event);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      list[i](data);
    }
  }
}

export { TimeSystem };
