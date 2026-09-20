import * as THREE from 'three';

export function getTimeOfDay() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 5 && h < 8) return { phase: 'morning', t: (h - 5) / 3 };
  if (h >= 8 && h < 16) return { phase: 'afternoon', t: (h - 8) / 8 };
  if (h >= 16 && h < 19.5) return { phase: 'evening', t: (h - 16) / 3.5 };
  return { phase: 'night', t: h >= 19.5 ? (h - 19.5) / 4.5 : (h + 4.5) / 4.5 };
}

const LIGHT_PALETTES = {
  morning: {
    sun: new THREE.Color(0xffddaa), sunIntensity: 2.0,
    ambient: new THREE.Color(0x667788), ambientIntensity: 0.8,
    sunPos: [15, 8, 5], fogDensity: 0.025,
    fogColor: new THREE.Color(0xaabbcc),
    godRayOpacity: 0.25
  },
  afternoon: {
    sun: new THREE.Color(0xffffee), sunIntensity: 2.5,
    ambient: new THREE.Color(0x88aabb), ambientIntensity: 1.0,
    sunPos: [8, 25, 5], fogDensity: 0.015,
    fogColor: new THREE.Color(0x88aacc),
    godRayOpacity: 0.15
  },
  evening: {
    sun: new THREE.Color(0xff8844), sunIntensity: 1.8,
    ambient: new THREE.Color(0x554455), ambientIntensity: 0.6,
    sunPos: [-15, 6, 5], fogDensity: 0.02,
    fogColor: new THREE.Color(0x664444),
    godRayOpacity: 0.3
  },
  night: {
    sun: new THREE.Color(0x6677aa), sunIntensity: 0.4,
    ambient: new THREE.Color(0x111122), ambientIntensity: 0.2,
    sunPos: [-10, 15, -5], fogDensity: 0.03,
    fogColor: new THREE.Color(0x0a0c1a),
    godRayOpacity: 0.0
  }
};

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this._pulseIntensity = 0;

    // Directional Sun/Moon
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(15, 20, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); // High res shadows for crisp leaves
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 100;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 20;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.bias = -0.001; // Prevent artifacting on flat planes
    scene.add(this.sun);

    // Ambient Fill
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(this.ambient);

    // Hemisphere for soft ground bounce
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(this.hemi);

    // Atmospheric Fog
    scene.fog = new THREE.FogExp2(0x88aacc, 0.015);

    this._buildGodRays();
  }

  _buildGodRays() {
    // Procedural volumetric light shafts
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(255, 255, 230, 0.0)');
    grad.addColorStop(0.5, 'rgba(255, 255, 230, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 230, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);
    const tex = new THREE.CanvasTexture(canvas);

    this.rayGroup = new THREE.Group();
    this.rayGroup.position.set(-8, 5, -5); // Originate from tree area
    
    this.rayMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.2, depthWrite: false, 
      blending: THREE.AdditiveBlending, color: 0xffeedd, side: THREE.DoubleSide
    });

    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(3 + Math.random()*2, 20 + Math.random()*10);
      const m = new THREE.Mesh(geo, this.rayMat);
      m.position.set((Math.random()-0.5)*5, (Math.random()-0.5)*2, (Math.random()-0.5)*5);
      m.rotation.z = Math.PI / 4 + (Math.random()-0.5)*0.2; // Angle down-right
      m.rotation.y = (Math.random()-0.5)*0.5;
      this.rayGroup.add(m);
    }
    this.scene.add(this.rayGroup);
  }

  triggerPulse() {
    this._pulseIntensity = 0.2;
  }

  update(time) {
    const { phase } = getTimeOfDay();
    const p = LIGHT_PALETTES[phase] || LIGHT_PALETTES.afternoon;

    // Transition lights
    this.sun.color.lerp(p.sun, 0.02);
    this.sun.intensity += (p.sunIntensity - this.sun.intensity) * 0.02;
    this.ambient.color.lerp(p.ambient, 0.02);
    this.ambient.intensity += (p.ambientIntensity - this.ambient.intensity) * 0.02;

    this.sun.position.x += (p.sunPos[0] - this.sun.position.x) * 0.01;
    this.sun.position.y += (p.sunPos[1] - this.sun.position.y) * 0.01;
    this.sun.position.z += (p.sunPos[2] - this.sun.position.z) * 0.01;

    // Transition fog
    this.scene.fog.color.lerp(p.fogColor, 0.02);
    this.scene.fog.density += (p.fogDensity - this.scene.fog.density) * 0.01;

    // God rays
    this.rayMat.opacity += (p.godRayOpacity - this.rayMat.opacity) * 0.02;
    this.rayGroup.position.y = 5 + Math.sin(time * 0.5) * 0.2; // Slow hover

    // Pulse
    if (this._pulseIntensity > 0.005) {
      this.ambient.intensity += this._pulseIntensity;
      this.rayMat.opacity += this._pulseIntensity * 0.5; // Rays flash on heartbeat
      this._pulseIntensity *= 0.9;
    }

    return phase;
  }
}
