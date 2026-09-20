/**
 * LayerManager.js — Layer Collection Manager
 *
 * Owns, orders, and updates all Layer instances in the environment.
 * Acts as the single point of contact between the Scene (which provides
 * camera offsets) and the individual layers.
 *
 * Responsibilities:
 *   - Create Layer instances from config definitions.
 *   - Maintain layers sorted by z-index (back to front).
 *   - Propagate camera offset to each layer, weighted by depth.
 *   - Mount/unmount all layer DOM elements into a parent container.
 *   - Support runtime add/remove of layers.
 *
 * Design notes:
 *   - The manager does NOT know about the camera, time system, or particles.
 *     It receives (offsetX, offsetY, time) from its owner and distributes.
 *   - Layers are stored in a Map for O(1) name-based lookup,
 *     with a sorted array maintained for ordered iteration.
 */

import { Layer } from './Layer.js';

class LayerManager {
  constructor() {
    /** @type {Map<string, Layer>} */
    this._layerMap = new Map();

    /** @type {Layer[]} Sorted by z-index, back to front */
    this._sorted = [];

    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Add a new layer from a configuration object.
   *
   * @param {Object} config — layer configuration (see Layer constructor).
   * @returns {Layer} The created layer instance.
   */
  addLayer(config) {
    if (this._layerMap.has(config.name)) {
      console.warn(`[LayerManager] Layer "${config.name}" already exists. Skipping.`);
      return this._layerMap.get(config.name);
    }

    const layer = new Layer(config);
    this._layerMap.set(config.name, layer);
    this._rebuildSorted();

    // If already mounted, insert the new element in the correct position
    if (this._container) {
      this._mountLayer(layer);
    }

    return layer;
  }

  /**
   * Remove a layer by name.
   *
   * @param {string} name — the layer's unique name.
   * @returns {boolean} True if the layer was found and removed.
   */
  removeLayer(name) {
    const layer = this._layerMap.get(name);
    if (!layer) return false;

    layer.destroy();
    this._layerMap.delete(name);
    this._rebuildSorted();
    return true;
  }

  /**
   * Retrieve a layer by name.
   *
   * @param {string} name
   * @returns {Layer|undefined}
   */
  getLayer(name) {
    return this._layerMap.get(name);
  }

  /**
   * Update all layers with the current camera offset and time.
   *
   * Called once per frame by the Scene.
   *
   * @param {number} offsetX — camera horizontal offset in pixels.
   * @param {number} offsetY — camera vertical offset in pixels.
   * @param {number} time    — elapsed time in seconds.
   */
  update(offsetX, offsetY, time) {
    for (let i = 0; i < this._sorted.length; i++) {
      this._sorted[i].update(offsetX, offsetY, time);
    }
  }

  /**
   * Mount all layer DOM elements into a parent container.
   * Elements are inserted in z-order (lowest z first = furthest back).
   *
   * @param {HTMLElement} container — the parent DOM element.
   */
  mount(container) {
    this._container = container;

    for (let i = 0; i < this._sorted.length; i++) {
      this._mountLayer(this._sorted[i]);
    }
  }

  /**
   * Remove all layer elements from the DOM and clean up.
   */
  destroy() {
    for (const layer of this._layerMap.values()) {
      layer.destroy();
    }
    this._layerMap.clear();
    this._sorted.length = 0;
    this._container = null;
  }

  /**
   * @returns {number} The number of active layers.
   */
  get count() {
    return this._layerMap.size;
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Rebuild the sorted array from the map.
   * Called when layers are added or removed.
   */
  _rebuildSorted() {
    this._sorted = Array.from(this._layerMap.values());
    this._sorted.sort((a, b) => a.z - b.z);
  }

  /**
   * Insert a single layer element into the container at the correct z-position.
   *
   * @param {Layer} layer
   */
  _mountLayer(layer) {
    if (!this._container || !layer.el) return;

    // Find the first existing child with a higher z-index and insert before it
    const children = this._container.children;
    let inserted = false;

    for (let i = 0; i < children.length; i++) {
      const childZ = parseInt(children[i].style.zIndex, 10) || 0;
      if (childZ > layer.z) {
        this._container.insertBefore(layer.el, children[i]);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this._container.appendChild(layer.el);
    }
  }
}

export { LayerManager };
