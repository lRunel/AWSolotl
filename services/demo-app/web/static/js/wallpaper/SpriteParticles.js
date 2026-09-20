import * as THREE from 'three';

export class SpriteParticles {
  constructor(scene) {
    this.scene = scene;
    this._buildDust();
    this._buildFireflies();
  }

  _buildDust() {
    const count = 100;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 40;
      pos[i*3+1] = Math.random() * 12 + 0.5;
      pos[i*3+2] = (Math.random() - 0.5) * 20;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    // Create a soft radial gradient texture programmatically for dust
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);

    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffeecc, size: 0.15, transparent: true, opacity: 0.3,
      depthWrite: false, map: tex, blending: THREE.AdditiveBlending
    }));
    this.dust.renderOrder = 20;
    this.scene.add(this.dust);
  }

  _buildFireflies() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 30;
      pos[i*3+1] = Math.random() * 6 + 0.5;
      pos[i*3+2] = (Math.random() - 0.5) * 15;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(200,255,100,1)');
    grad.addColorStop(0.2, 'rgba(150,255,50,0.8)');
    grad.addColorStop(1, 'rgba(50,150,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);

    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.4, transparent: true, opacity: 0,
      depthWrite: false, map: tex, blending: THREE.AdditiveBlending
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.renderOrder = 22;
    this.scene.add(this.fireflies);
  }

  setParticleBoost(intensity) {
    this._particleBoost = Math.min(1, intensity);
  }

  update(time, phase, wind) {
    const boost = this._particleBoost || 0;

    // Dust & Pollen
    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      dp.setY(i, dp.getY(i) + Math.sin(time * 0.5 + i) * 0.003 * (1 + boost * 3));
      dp.setX(i, dp.getX(i) + 0.005 + wind * 0.02);
      if (dp.getX(i) > 25) dp.setX(i, -25);
    }
    dp.needsUpdate = true;

    // Fireflies (night/evening only)
    const ffTarget = phase === 'night' ? 0.8 : phase === 'evening' ? 0.3 : 0;
    this.fireflyMat.opacity += (ffTarget - this.fireflyMat.opacity) * 0.015;
    
    if (this.fireflyMat.opacity > 0.01) {
      this.fireflyMat.size = 0.3 + Math.sin(time * 4) * 0.15; // Pulse glow
      const fp = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        fp.setX(i, fp.getX(i) + Math.sin(time * 1.5 + i * 4) * 0.005);
        fp.setY(i, fp.getY(i) + Math.cos(time * 1.2 + i * 3) * 0.004);
      }
      fp.needsUpdate = true;
    }

    if (this._particleBoost) this._particleBoost *= 0.98;
  }
}
