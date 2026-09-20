/**
 * Scene.js — DOM Scene Container
 *
 * Creates and owns the #environment DOM subtree. Wires the LayerManager
 * and CameraController together so that camera movement drives layer parallax.
 *
 * Responsibilities:
 *   - Create the <div id="environment"> container element.
 *   - Instantiate and configure LayerManager with the default layer stack.
 *   - Instantiate CameraController for input handling.
 *   - On each frame, update the camera and propagate its offset to all layers.
 *   - Manage the sky gradient based on time-of-day phase.
 *   - Handle the "dimmed" state when a window is maximized.
 *
 * Design notes:
 *   - Scene does NOT own the AnimationLoop. The EnvironmentEngine registers
 *     Scene.update() as a subscriber on the shared loop.
 *   - Scene does NOT read the clock. It receives the current phase/progress
 *     from outside (EnvironmentEngine passes it in).
 *   - The #environment div replaces the old <canvas id="bg-canvas">.
 */

import { Config } from './Config.js';
import { LayerManager } from './LayerManager.js';
import { CameraController } from './CameraController.js';

class Scene {
  constructor() {
    /** @type {HTMLElement} */
    // Reuse existing #environment div from HTML, or create one
    this.el = document.getElementById('environment') || document.createElement('div');
    this.el.id = 'environment';

    /** @type {LayerManager} */
    this.layers = new LayerManager();

    /** @type {CameraController} */
    this.camera = new CameraController();

    /** @type {string} Current sky phase for gradient transitions */
    this._currentPhase = 'afternoon';

    /** @type {number|null} Dim observer interval */
    this._dimTimer = null;

    // Build the default layer stack from Config
    this._buildLayers();

    // Mount layers into our container
    this.layers.mount(this.el);

    // Apply initial sky gradient
    this._applySkyGradient('afternoon');

    // Observe window maximization for dimming
    this._startDimObserver();
  }

  /**
   * Per-frame update. Called by the AnimationLoop via EnvironmentEngine.
   *
   * @param {number} dt    — delta time in seconds.
   * @param {string} phase — current time-of-day phase.
   * @param {number} time  — total elapsed time in seconds (for subtle animations).
   */
  update(dt, phase, time) {
    // Update camera smoothing
    this.camera.update(dt);

    // Propagate camera offset to all layers
    this.layers.update(this.camera.offsetX, this.camera.offsetY, time);

    // Transition sky gradient if phase changed
    if (phase !== this._currentPhase) {
      this._currentPhase = phase;
      this._applySkyGradient(phase);
    }

    // Subtle cloud drift — very slow horizontal movement
    const cloudLayer = this.layers.getLayer('clouds');
    if (cloudLayer) {
      const drift = Math.sin(time * 0.02) * 3; // ±3px over ~5 minutes
      const parallaxX = this.camera.offsetX * cloudLayer.depth;
      cloudLayer.el.style.transform =
        `translate3d(${(parallaxX + drift).toFixed(1)}px, ${(this.camera.offsetY * cloudLayer.depth).toFixed(1)}px, 0)`;
    }

    // Subtle foreground sway — barely perceptible
    const fgLayer = this.layers.getLayer('foreground');
    if (fgLayer) {
      const sway = Math.sin(time * 0.4) * 0.3; // ±0.3px gentle breathing
      const parallaxX = this.camera.offsetX * fgLayer.depth;
      const parallaxY = this.camera.offsetY * fgLayer.depth;
      fgLayer.el.style.transform =
        `translate3d(${(parallaxX).toFixed(1)}px, ${(parallaxY + sway).toFixed(1)}px, 0)`;
    }
  }

  /**
   * Insert the environment container into the DOM.
   *
   * @param {HTMLElement} parent — the parent element to prepend into.
   */
  mount(parent) {
    // Insert as the first child so it sits behind all other content
    parent.insertBefore(this.el, parent.firstChild);
  }

  /**
   * Clean up everything.
   */
  destroy() {
    if (this._dimTimer) clearInterval(this._dimTimer);
    this.camera.destroy();
    this.layers.destroy();
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Create all layers from the Config.layerStack definition.
   */
  _buildLayers() {
    for (const def of Config.layerStack) {
      const layer = this.layers.addLayer({
        name: def.name,
        depth: def.depth,
        z: def.z,
        image: def.image,
        opacity: def.opacity,
      });

      // Both sky layers need cover sizing
      if (def.name === 'sky-day' || def.name === 'sky-night') {
        layer.el.style.backgroundSize = 'cover';
        layer.el.style.backgroundPosition = 'center center';
        layer.el.style.transition = 'none';
      }
    }
  }

  /**
   * Crossfade between day and night wallpaper layers based on time-of-day phase.
   * Day wallpaper is shown during morning/afternoon, night wallpaper during evening/night.
   *
   * @param {string} phase
   */
  _applySkyGradient(phase) {
    const dayLayer = this.layers.getLayer('sky-day');
    const nightLayer = this.layers.getLayer('sky-night');
    if (!dayLayer || !nightLayer) return;

    // Determine night intensity based on phase
    let nightOpacity = 0;
    if (phase === 'night') {
      nightOpacity = 1;
    } else if (phase === 'evening') {
      nightOpacity = 0.7;
    } else if (phase === 'morning') {
      nightOpacity = 0.2;
    } else {
      // afternoon — full day
      nightOpacity = 0;
    }

    dayLayer.el.style.opacity = 1;
    nightLayer.el.style.opacity = nightOpacity;
  }

  /**
   * Periodically check whether a maximized window should dim the environment.
   * This replaces the old Wallpaper3D._dimObserver().
   */
  _startDimObserver() {
    this._dimTimer = setInterval(() => {
      const wins = document.querySelectorAll('.window.maximized:not(.minimized)');
      if (wins.length > 0) {
        this.el.classList.add('dimmed');
      } else {
        this.el.classList.remove('dimmed');
      }
    }, 500);
  }
}

export { Scene };
