import * as THREE from 'three';

export class PaintedEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
    this.textureLoader = new THREE.TextureLoader();
    
    this._buildSkyGradient();
    this._buildMountains();
    this._buildForestSilhouette();
    this._buildHeroTree();
    this._buildGrassLayers();
    this._buildFogCards();
  }

  _buildSkyGradient() {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.skyMat = new THREE.ShaderMaterial({
      depthWrite: false, depthTest: false,
      uniforms: {
        uTopColor: { value: new THREE.Vector3(0.4, 0.65, 0.9) },
        uBotColor: { value: new THREE.Vector3(0.85, 0.88, 0.92) }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }`,
      fragmentShader: `
        uniform vec3 uTopColor; uniform vec3 uBotColor; varying vec2 vUv;
        void main(){
          float t = smoothstep(0.0, 1.0, vUv.y);
          gl_FragColor = vec4(mix(uBotColor, uTopColor, t), 1.0);
        }`
    });
    const mesh = new THREE.Mesh(geo, this.skyMat);
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  _buildMountains() {
    // Parallax 0.1
    this.textureLoader.load('assets/wallpaper/forest_silhouette.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const aspect = tex.image.width / tex.image.height;
      const h = 50; const w = h * aspect;
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, alphaTest: 0.1, roughness: 1.0
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(0, 10, -60);
      mesh.renderOrder = -50;
      this.scene.add(mesh);
      this.layers.push({ mesh, parallax: 0.1, baseY: 10 });
    });
  }

  _buildForestSilhouette() {
    // Parallax 0.2
    this.textureLoader.load('assets/wallpaper/forest_silhouette.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const aspect = tex.image.width / tex.image.height;
      const h = 35; const w = h * aspect;
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, alphaTest: 0.1, roughness: 1.0, color: 0x8899aa
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(5, 5, -40);
      mesh.renderOrder = -40;
      this.scene.add(mesh);
      this.layers.push({ mesh, parallax: 0.2, baseY: 5 });
    });
  }

  _buildHeroTree() {
    // Parallax 0.4. Placed on left third.
    this.textureLoader.load('assets/wallpaper/hero_tree.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const aspect = tex.image.width / tex.image.height;
      const h = 22; const w = h * aspect;
      this.treeMat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, alphaTest: 0.3, roughness: 0.8,
        side: THREE.DoubleSide
      });
      // Important to cast and receive shadows on the flat 2D plane
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.treeMat);
      mesh.position.set(-8, 9, -15);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = -10;
      this.scene.add(mesh);
      this.layers.push({ mesh, parallax: 0.4, baseY: 9 });
      this.heroTree = mesh;
    });
  }

  _buildGrassLayers() {
    this.textureLoader.load('assets/wallpaper/grass_layer.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      const aspect = tex.image.width / tex.image.height;
      
      // Layer 1: Midground grass (behind tree roots)
      const mat1 = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, alphaTest: 0.3, roughness: 0.9, side: THREE.DoubleSide
      });
      const mesh1 = new THREE.Mesh(new THREE.PlaneGeometry(60, 60/aspect), mat1);
      mesh1.position.set(0, 3, -16); // Behind tree (-15)
      mesh1.receiveShadow = true;
      mesh1.renderOrder = -12;
      this.scene.add(mesh1);
      this.layers.push({ mesh: mesh1, parallax: 0.35, baseY: 3 });

      // Layer 2: Foreground grass (in front of tree)
      const tex2 = tex.clone();
      tex2.repeat.set(1.5, 1); // stretch
      const mat2 = new THREE.MeshStandardMaterial({
        map: tex2, transparent: true, alphaTest: 0.3, roughness: 0.9, color: 0xaaffaa, side: THREE.DoubleSide
      });
      const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(80, 80/aspect), mat2);
      mesh2.position.set(0, 2, -5);
      mesh2.receiveShadow = true;
      mesh2.castShadow = true;
      mesh2.renderOrder = 5;
      this.scene.add(mesh2);
      this.layers.push({ mesh: mesh2, parallax: 0.6, baseY: 2 });
    });
  }

  _buildFogCards() {
    // Soft transparent planes without alpha testing for smooth blending
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(200,220,255,0.4)');
    grad.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);

    this.fogCards = [];
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false
    });

    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), mat);
      mesh.position.set((Math.random()-0.5)*30, 2 + Math.random()*4, -10 + i*5);
      mesh.renderOrder = 10;
      this.scene.add(mesh);
      this.layers.push({ mesh, parallax: 0.7 + i*0.1, baseY: mesh.position.y });
      this.fogCards.push(mesh);
    }
  }

  triggerTreeGlow() {
    if (this.treeMat) {
      this.treeMat.emissive = new THREE.Color(0x334422);
      this._glowTimer = 2.0;
    }
  }

  update(time, phase, mx, my, wind) {
    // Parallax update
    this.layers.forEach(l => {
      if (!l.mesh) return;
      const bx = l.mesh._baseX || 0;
      l.mesh.position.x = bx + mx * l.parallax * 8;
      // Gentle breathing/sway based on wind
      if (l.parallax > 0.3 && l.parallax < 0.8) {
         l.mesh.rotation.z = Math.sin(time * 0.5 + l.parallax) * 0.01 * (1 + wind * 2);
      }
    });

    // Fog cards drift
    this.fogCards.forEach((f, i) => {
      f.position.x += 0.02;
      if (f.position.x > 40) f.position.x = -40;
      f.position.y = f.baseY || 0 + Math.sin(time + i)*1.5;
    });

    // Tree glow decay
    if (this._glowTimer > 0 && this.treeMat) {
      this._glowTimer -= 0.016;
      this.treeMat.emissiveIntensity = this._glowTimer * 0.5;
    } else if (this.treeMat) {
      this.treeMat.emissiveIntensity = 0;
    }

    // Sky colors based on time of day
    const palettes = {
      morning:   { top: [0.15, 0.18, 0.35], bot: [0.95, 0.65, 0.40] },
      afternoon: { top: [0.40, 0.65, 0.90], bot: [0.85, 0.88, 0.92] },
      evening:   { top: [0.10, 0.06, 0.18], bot: [0.90, 0.45, 0.25] },
      night:     { top: [0.02, 0.02, 0.06], bot: [0.05, 0.05, 0.12] }
    };
    const target = palettes[phase] || palettes.afternoon;
    const top = this.skyMat.uniforms.uTopColor.value;
    const bot = this.skyMat.uniforms.uBotColor.value;
    top.x += (target.top[0] - top.x) * 0.01;
    top.y += (target.top[1] - top.y) * 0.01;
    top.z += (target.top[2] - top.z) * 0.01;
    bot.x += (target.bot[0] - bot.x) * 0.01;
    bot.y += (target.bot[1] - bot.y) * 0.01;
    bot.z += (target.bot[2] - bot.z) * 0.01;
  }
}
