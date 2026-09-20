import { SceneCore } from './wallpaper/SceneCore.js';
import { Lighting } from './wallpaper/Lighting.js';
import { PaintedEnvironment } from './wallpaper/PaintedEnvironment.js';
import { SpriteParticles } from './wallpaper/SpriteParticles.js';
import { EasterEggs } from './wallpaper/EasterEggs.js';
import { OSBridge } from './wallpaper/OSBridge.js';

/**
 * Wallpaper3D — Pure Illustrated HD-2D Desktop
 *
 * Layer stack (All 2D-in-3D billboards):
 *   1. Sky (shader gradient)          — static
 *   2. Mountains (matte billboard)    — parallax 0.1×
 *   3. Forest (matte billboard)       — parallax 0.2×
 *   4. Hero Tree (painted PNG)        — parallax 0.4×
 *   5. Grass L1 (painted PNG)         — parallax 0.5×
 *   6. Grass L2 (painted PNG)         — parallax 0.6×
 *   7. Fog Cards (soft planes)        — parallax 0.7×
 *   8. Particles (GPU points)         — parallax 0.9×
 *   9. Desktop OS (DOM)               — parallax 1.0×
 */
class Wallpaper3D {
  constructor() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    // Core renderer & post-processing
    this.core = new SceneCore(canvas);

    // Environment and Lighting
    this.lighting = new Lighting(this.core.scene);
    this.environment = new PaintedEnvironment(this.core.scene);
    this.sprites = new SpriteParticles(this.core.scene);
    this.eggs = new EasterEggs(this.core.scene);

    // OS integration
    this.bridge = new OSBridge();
    this._wireOSBridge();

    // Desktop dimming
    this._dimObserver();

    // Start render loop
    this._animate();
  }

  _wireOSBridge() {
    // Kernel boot → tree glows
    this.bridge.on('kernel:boot', () => {
      this.environment.triggerTreeGlow();
    });

    // Window open → dust burst
    this.bridge.on('window:open', () => {
      this.sprites.setParticleBoost(0.4);
    });

    // Window close → dust burst
    this.bridge.on('window:close', () => {
      this.sprites.setParticleBoost(0.2);
    });

    // Terminal command → fireflies pulse
    this.bridge.on('terminal:command', () => {
      this.sprites.setParticleBoost(0.6);
    });

    // Scheduler heartbeat → ambient light pulse + volumetrics flare
    this.bridge.on('scheduler:heartbeat', () => {
      this.lighting.triggerPulse();
    });

    // Memory spike → wind increases
    this.bridge.on('memory:spike', () => {
      this.sprites.setParticleBoost(1.0);
    });
  }

  _dimObserver() {
    const canvas = this.core.canvas;
    const check = () => {
      const wins = document.querySelectorAll('.window.maximized');
      let shouldDim = false;
      wins.forEach(w => {
        if (!w.classList.contains('minimized')) shouldDim = true;
      });
      if (shouldDim) canvas.classList.add('dimmed');
      else canvas.classList.remove('dimmed');
    };
    setInterval(check, 500);
  }

  _animate() {
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.core.paused) return;

      const dt = Math.min(this.core.clock.getDelta(), 0.05);
      const time = this.core.clock.elapsedTime;
      const wind = this.core.mouse.vx;
      const mx = this.core.mouse.x;
      const my = this.core.mouse.y;

      // Update camera
      this.core.updateCamera(dt);

      // Update layers
      const phase = this.lighting.update(time);
      this.environment.update(time, phase, mx, my, wind);
      this.sprites.update(time, phase, wind);
      this.eggs.update(time, dt, phase, mx);

      // Tone mapping exposure per phase
      const targetExposure = { morning: 1.0, afternoon: 1.2, evening: 0.85, night: 0.45 };
      this.core.renderer.toneMappingExposure +=
        ((targetExposure[phase] || 1.0) - this.core.renderer.toneMappingExposure) * 0.015;

      // Render via post-processing composer
      this.core.render();
    };
    loop();
  }
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Wallpaper3D());
} else {
  new Wallpaper3D();
}

window.Wallpaper3D = Wallpaper3D;
