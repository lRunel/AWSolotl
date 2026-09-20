/**
 * CameraController.js — Virtual Camera
 *
 * Converts mouse position (desktop) or device orientation (mobile)
 * into a smooth, damped camera offset used by the layer system.
 *
 * Responsibilities:
 *   - Listen to mousemove and deviceorientation events.
 *   - Normalize input to a [-1, 1] range.
 *   - Apply exponential easing toward the target (smooth follow).
 *   - Apply damping when no input is detected (gentle return to center).
 *   - Output pixel offsets clamped to Config.camera.maxOffset values.
 *
 * Design notes:
 *   - The camera does NOT modify any DOM elements. It produces numbers.
 *     The Scene passes these numbers to the LayerManager.
 *   - Easing factor is per-frame interpolation: current += (target - current) * easing.
 *     At 60 FPS with easing=0.04, a full mouse sweep takes ~2 seconds to settle.
 *   - Movement maxes out at ±12px horizontal and ±6px vertical — less than 1 degree
 *     of perceived rotation on a typical monitor. Premium and subtle.
 *   - All event listeners use { passive: true } for scroll performance.
 */

import { Config } from './Config.js';

class CameraController {
  constructor() {
    // Target: where the mouse/gyro says to look (normalized -1 to 1)
    this._targetX = 0;
    this._targetY = 0;

    // Current: smoothed value that chases the target
    this._currentX = 0;
    this._currentY = 0;

    // Final output: pixel offset for layers
    this.offsetX = 0;
    this.offsetY = 0;

    // Track whether we're receiving input (for damping)
    this._hasInput = false;
    this._inputTimeout = null;

    // Bind handlers for stable references
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onDeviceOrientation = this._onDeviceOrientation.bind(this);

    this._bindEvents();
  }

  /**
   * Update the camera offset. Called once per frame by the animation loop.
   *
   * @param {number} _dt — delta time in seconds (unused; easing is frame-rate-dependent
   *                       by design for the smoothest feel at 60 FPS).
   */
  update(_dt) {
    const { easing, damping, maxOffsetX, maxOffsetY } = Config.camera;

    // When no input, gently decay target toward center
    if (!this._hasInput) {
      this._targetX *= damping;
      this._targetY *= damping;
    }

    // Exponential interpolation toward target
    this._currentX += (this._targetX - this._currentX) * easing;
    this._currentY += (this._targetY - this._currentY) * easing;

    // Convert normalized [-1, 1] to pixel offset
    this.offsetX = this._currentX * maxOffsetX;
    this.offsetY = this._currentY * maxOffsetY;
  }

  /**
   * Clean up all event listeners.
   */
  destroy() {
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('deviceorientation', this._onDeviceOrientation);
    if (this._inputTimeout) clearTimeout(this._inputTimeout);
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Bind input event listeners.
   */
  _bindEvents() {
    window.addEventListener('mousemove', this._onMouseMove, { passive: true });

    // Mobile gyroscope support
    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires user gesture to grant permission
        document.body.addEventListener('click', () => {
          DeviceOrientationEvent.requestPermission()
            .then(state => {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
              }
            })
            .catch(() => {});
        }, { once: true });
      } else {
        window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
      }
    }
  }

  /**
   * Handle mouse movement on desktop.
   * Normalizes cursor position to [-1, 1] from viewport center.
   *
   * @param {MouseEvent} e
   */
  _onMouseMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this._targetX = (e.clientX - w * 0.5) / (w * 0.5);
    this._targetY = (e.clientY - h * 0.5) / (h * 0.5);

    this._markInput();
  }

  /**
   * Handle device orientation on mobile.
   * Normalizes tilt to [-1, 1] range (clamped at ±30 degrees).
   *
   * @param {DeviceOrientationEvent} e
   */
  _onDeviceOrientation(e) {
    const gamma = e.gamma || 0; // left-right tilt
    const beta = e.beta || 0;   // front-back tilt

    this._targetX = Math.max(-1, Math.min(1, gamma / 30));
    this._targetY = Math.max(-1, Math.min(1, (beta - 45) / 30)); // 45° = natural hold angle

    this._markInput();
  }

  /**
   * Mark that input was received recently.
   * After 200ms of no input, damping kicks in.
   */
  _markInput() {
    this._hasInput = true;
    if (this._inputTimeout) clearTimeout(this._inputTimeout);
    this._inputTimeout = setTimeout(() => {
      this._hasInput = false;
    }, 200);
  }
}

export { CameraController };
