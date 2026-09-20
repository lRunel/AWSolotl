import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class SceneCore {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0, vx: 0, vy: 0 };
    this.clock = new THREE.Clock();
    this.paused = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.sortObjects = true;

    this.scene = new THREE.Scene();

    // Camera centered, but with gentle framing
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 5, 20);
    this.camera.lookAt(0, 4, 0);
    this.baseCamPos = this.camera.position.clone();
    this.baseCamTarget = new THREE.Vector3(0, 4, 0);

    // Setup Post-Processing (Bloom)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // strength
      0.8,  // radius
      0.6   // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Ground plane so shadows have something to hit
    const groundGeo = new THREE.PlaneGeometry(100, 60);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x112211, roughness: 1.0, metalness: 0
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.receiveShadow = true;
    this.ground.position.set(0, -0.5, 0);
    this.scene.add(this.ground);

    this._bindEvents();
  }

  _bindEvents() {
    let lastMx = 0, lastMy = 0;
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      this.mouse.vx = Math.abs(nx - lastMx) + Math.abs(ny - lastMy);
      lastMx = nx; lastMy = ny;
      this.mouse.x = nx; this.mouse.y = ny;
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!document.hidden) this.clock.getDelta();
    });
  }

  updateCamera(dt) {
    // Gentle parallax: max ~2 degrees rotation
    const maxShift = 0.8;
    const tx = this.baseCamPos.x + this.mouse.x * maxShift;
    const ty = this.baseCamPos.y - this.mouse.y * 0.3;
    this.camera.position.x += (tx - this.camera.position.x) * 1.8 * dt;
    this.camera.position.y += (ty - this.camera.position.y) * 1.8 * dt;
    const lookX = this.baseCamTarget.x + this.mouse.x * 0.5;
    const lookY = this.baseCamTarget.y - this.mouse.y * 0.2;
    this.camera.lookAt(lookX, lookY, 0);
    this.mouse.vx *= 0.94; // Decay velocity
  }

  render() {
    this.composer.render();
  }
}
