/**
 * Layer.js — Single Visual Layer
 *
 * Represents one depth-sorted visual plane in the environment.
 * Each layer is a GPU-composited <div> with a background image,
 * positioned via transform: translate3d() for zero-repaint animation.
 *
 * Responsibilities:
 *   - Create and own a single DOM element.
 *   - Apply parallax offset scaled by its depth multiplier.
 *   - Support runtime image and opacity changes via CSS transitions.
 *   - Expose a clean update(offsetX, offsetY, time) interface.
 *
 * Design notes:
 *   - `will-change: transform` promotes the element to its own compositor layer.
 *   - `translate3d` forces GPU compositing even on older browsers.
 *   - No JavaScript-driven CSS transitions — we set transform directly each frame
 *     for smooth, jank-free parallax driven by the AnimationLoop.
 *   - Opacity transitions use CSS transition for smooth visual changes that
 *     don't need per-frame precision (e.g., day/night fade).
 */

import { Config } from './Config.js';

class Layer {
  /**
   * @param {Object} options
   * @param {string}  options.name     — unique identifier for this layer.
   * @param {number}  options.depth    — parallax multiplier (0 = static, 1 = full movement).
   * @param {number}  options.z        — CSS z-index for stacking order.
   * @param {string|null} options.image — path to background image, or null for programmatic layers (e.g., sky).
   * @param {number}  [options.opacity=1] — initial opacity.
   * @param {string}  [options.backgroundSize]    — CSS background-size override.
   * @param {string}  [options.backgroundPosition] — CSS background-position override.
   */
  constructor({ name, depth, z, image = null, opacity = 1, backgroundSize, backgroundPosition }) {
    this.name = name;
    this.depth = depth;
    this.z = z;
    this.opacity = opacity;

    // Create the DOM element
    this.el = document.createElement('div');
    this.el.className = 'env-layer';
    this.el.dataset.layerName = name;
    this.el.dataset.depth = depth;

    // Base styles — position and compositing
    const s = this.el.style;
    s.position = 'absolute';
    s.inset = '0';
    s.zIndex = z;
    s.willChange = 'transform';
    s.transform = 'translate3d(0, 0, 0)';
    s.pointerEvents = 'none';
    s.opacity = opacity;

    // Transition for opacity changes (day/night fades) — NOT for transform
    s.transition = `opacity ${Config.layers.transitionDuration} ease`;

    // Image setup
    if (image) {
      s.backgroundImage = `url('${image}')`;
      s.backgroundSize = backgroundSize || Config.layers.backgroundSize;
      s.backgroundPosition = backgroundPosition || Config.layers.backgroundPosition;
      s.backgroundRepeat = 'no-repeat';
    }

    // Track current transform values to avoid unnecessary style writes
    this._currentX = 0;
    this._currentY = 0;
  }

  /**
   * Update this layer's position based on the camera offset.
   *
   * The offset is multiplied by this layer's depth — deeper layers (depth closer to 0)
   * move less, creating the parallax illusion.
   *
   * @param {number} offsetX — camera horizontal offset in pixels.
   * @param {number} offsetY — camera vertical offset in pixels.
   * @param {number} _time   — elapsed time (unused by base Layer, available for subclass override).
   */
  update(offsetX, offsetY, _time) {
    const x = offsetX * this.depth;
    const y = offsetY * this.depth;

    // Skip DOM write if values haven't meaningfully changed (< 0.1px)
    if (Math.abs(x - this._currentX) < 0.1 && Math.abs(y - this._currentY) < 0.1) {
      return;
    }

    this._currentX = x;
    this._currentY = y;
    this.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  /**
   * Replace the layer's background image at runtime.
   * Allows swapping artwork without changing code.
   *
   * @param {string} src — path to the new image.
   */
  setImage(src) {
    this.el.style.backgroundImage = `url('${src}')`;
  }

  /**
   * Smoothly transition the layer's opacity.
   * Uses CSS transition (set in constructor) for the interpolation.
   *
   * @param {number} value    — target opacity (0–1).
   * @param {string} [duration] — optional override for transition duration.
   */
  setOpacity(value, duration) {
    if (duration) {
      this.el.style.transitionDuration = duration;
    }
    this.opacity = value;
    this.el.style.opacity = value;
  }

  /**
   * Set a CSS gradient background (used for the sky layer).
   *
   * @param {string} gradient — a valid CSS gradient string.
   */
  setGradient(gradient) {
    this.el.style.backgroundImage = gradient;
    this.el.style.backgroundSize = '100% 100%';
  }

  /**
   * Remove the element from the DOM and clean up.
   */
  destroy() {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
  }
}

export { Layer };
