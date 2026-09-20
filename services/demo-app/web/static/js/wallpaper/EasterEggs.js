import * as THREE from 'three';

export class EasterEggs {
  constructor(scene) {
    this.scene = scene;
    this._buildBirds();
    this._buildShootingStar();
    this._cursorNearTree = 0;
    this._birdsFlying = false;
    this._shootingStarTimer = 60 + Math.random() * 120;
  }

  _buildBirds() {
    this.birds = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 3), mat);
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), mat);
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), mat);
      wL.position.set(-0.12, 0, 0); wR.position.set(0.12, 0, 0);
      g.add(body, wL, wR);
      // Position near tree (left third)
      g.position.set(-7 + (Math.random()-0.5)*3, 8 + Math.random()*2, -2 + (Math.random()-0.5)*2);
      g._wL = wL; g._wR = wR;
      g._vel = new THREE.Vector3(0, 0, 0);
      g._home = g.position.clone();
      g.renderOrder = 8;
      this.scene.add(g);
      this.birds.push(g);
    }
  }

  _buildShootingStar() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(15 * 3);
    for (let i = 0; i < 15; i++) pos[i*3] = i * 0.4;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.shootingStar = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, transparent: true, opacity: 0, depthWrite: false
    }));
    this.shootingStar.visible = false;
    this.shootingStar.renderOrder = -85;
    this.scene.add(this.shootingStar);
  }

  update(time, dt, phase, mouseX) {
    // Birds: scatter if cursor lingers near tree (left third: mouseX < -0.3)
    if (mouseX < -0.3) {
      this._cursorNearTree += dt;
    } else {
      this._cursorNearTree = Math.max(0, this._cursorNearTree - dt * 2);
    }

    if (this._cursorNearTree > 4 && !this._birdsFlying) {
      this._birdsFlying = true;
      this.birds.forEach(b => {
        b._vel.set((Math.random()-0.5)*6 + 3, 2 + Math.random()*2, (Math.random()-0.5)*3);
      });
    }

    this.birds.forEach(b => {
      if (this._birdsFlying) {
        b.position.add(b._vel.clone().multiplyScalar(dt));
        b._wL.rotation.z = Math.sin(time * 15) * 0.5;
        b._wR.rotation.z = -Math.sin(time * 15) * 0.5;
        if (b.position.y > 30) b.visible = false;
      } else {
        b._wL.rotation.z = Math.sin(time * 3 + b._home.x) * 0.08;
        b._wR.rotation.z = -Math.sin(time * 3 + b._home.x) * 0.08;
        b.position.y = b._home.y + Math.sin(time * 0.5 + b._home.x) * 0.08;
      }
    });

    if (this._birdsFlying && this._cursorNearTree < 0.5) {
      this._birdsFlying = false;
      this.birds.forEach(b => {
        b.position.copy(b._home);
        b.visible = true;
        b._vel.set(0, 0, 0);
      });
    }

    // Shooting star (night/evening)
    this._shootingStarTimer -= dt;
    if (this._shootingStarTimer <= 0 && (phase === 'night' || phase === 'evening')) {
      this.shootingStar.visible = true;
      this.shootingStar.material.opacity = 0.85;
      this.shootingStar.position.set(25 + Math.random()*15, 30 + Math.random()*8, -50);
      this._shootingStarTimer = 80 + Math.random() * 200;
    }
    if (this.shootingStar.visible) {
      this.shootingStar.position.x -= 35 * dt;
      this.shootingStar.position.y -= 12 * dt;
      this.shootingStar.material.opacity -= 0.35 * dt;
      if (this.shootingStar.material.opacity <= 0) this.shootingStar.visible = false;
    }
  }
}
