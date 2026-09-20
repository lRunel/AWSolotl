/**
 * Config.js — Environment Engine Configuration
 *
 * All tuning constants for the environment system live here.
 * Pure data. Zero logic. Deep-frozen to prevent runtime mutation.
 *
 * To adjust the feel of the environment, edit values in this file.
 * No other file should contain magic numbers.
 */

const Config = Object.freeze({

  /**
   * Virtual camera — converts mouse/gyro input to a subtle parallax offset.
   *
   * maxOffsetX/Y: maximum pixel displacement applied to the deepest layer.
   * easing:       interpolation factor per frame (lower = smoother, slower).
   * damping:      decay multiplier when no input is active (lower = faster stop).
   */
  camera: Object.freeze({
    maxOffsetX: 12,
    maxOffsetY: 6,
    easing: 0.04,
    damping: 0.92,
  }),

  /**
   * Layer defaults — base values for visual layers.
   *
   * transitionDuration: CSS transition length for opacity/transform changes.
   * backgroundSize:     default CSS background-size for layer images.
   * backgroundPosition: default CSS background-position.
   */
  layers: Object.freeze({
    transitionDuration: '0s',
    backgroundSize: 'cover',
    backgroundPosition: 'center bottom',
  }),

  /**
   * Default layer stack — ordered from back to front.
   *
   * depth: parallax multiplier (0 = static, 1 = moves with camera fully).
   * z:     CSS z-index for stacking order.
   * image: path relative to project root (swappable without code changes).
   */
  layerStack: Object.freeze([
    Object.freeze({ name: 'sky-day',   depth: 0.05, z: -101, image: 'assets/wallpaper/wallpaper_day.png',   opacity: 1.0 }),
    Object.freeze({ name: 'sky-night', depth: 0.05, z: -100, image: 'assets/wallpaper/wallpaper_night.png', opacity: 0.0 }),
  ]),

  /**
   * Particle system — subtle, occasional floating motes.
   *
   * count:      total particle elements in the pool.
   * minSize/maxSize: pixel range for particle diameter.
   * speed:      base drift speed in pixels per second.
   * opacity:    base opacity (particles should be barely visible).
   * depthRange: [min, max] parallax depth for particles.
   */
  particles: Object.freeze({
    count: 20,
    minSize: 2,
    maxSize: 4,
    speed: 0.3,
    opacity: 0.25,
    depthRange: Object.freeze([0.6, 0.9]),
    color: 'rgba(255, 248, 230, VAR_OPACITY)',
  }),

  /**
   * Time system — phase boundaries based on hour of day.
   *
   * Each phase is defined by a start hour (inclusive).
   * The system selects the latest matching phase.
   */
  time: Object.freeze({
    phases: Object.freeze([
      Object.freeze({ name: 'night',     start: 0 }),
      Object.freeze({ name: 'morning',   start: 5 }),
      Object.freeze({ name: 'afternoon', start: 8 }),
      Object.freeze({ name: 'evening',   start: 16 }),
      Object.freeze({ name: 'night',     start: 20 }),
    ]),
    pollIntervalMs: 60000,
  }),

  /**
   * Sky gradient colors per time phase.
   *
   * Each phase defines a CSS linear-gradient from top to bottom.
   * Transitions between phases use CSS transition on background.
   */
  skyColors: Object.freeze({
    morning:   Object.freeze({ top: '#2b3059', bottom: '#f2a65a' }),
    afternoon: Object.freeze({ top: '#6ba3d6', bottom: '#d6dfe8' }),
    evening:   Object.freeze({ top: '#1a102e', bottom: '#e67340' }),
    night:     Object.freeze({ top: '#050510', bottom: '#0d0d1f' }),
  }),

  /**
   * Performance — animation targets and guards.
   *
   * maxDeltaMs:   clamp deltaTime to prevent spiral-of-death after tab switch.
   * targetFPS:    informational; the loop does not enforce this.
   */
  performance: Object.freeze({
    maxDeltaMs: 50,
    targetFPS: 60,
  }),

});

export { Config };
