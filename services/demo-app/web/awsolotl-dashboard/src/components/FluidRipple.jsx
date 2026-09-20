import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle, RenderTarget } from 'ogl'

// Interactive water-ripple / refraction background, driven by a real 2-buffer
// wave-equation fluid sim on the GPU (ping-pong FBOs), not a canned CSS
// animation. Renders the page's own background gradient through it with
// chromatic aberration at the ripple peaks -- the classic unseen.studio-style
// distortion overlay, scoped to the background layer this app controls
// (pointer-events: none, sits behind real content, so buttons/links/filters
// stay exactly as clickable as before).
//
// Why OGL instead of three.js/r3f: this is one fullscreen shader pass plus a
// tiny sim pass, nothing that needs a scene graph, lights, or loaders --
// OGL gives raw Renderer/Program/RenderTarget access at ~30KB instead of
// three's 150KB+, and is what most of these exact ripple-overlay effects on
// award-site clones are actually built with.
//
// Height field encoding: WebGL render targets default to UNSIGNED_BYTE
// (safe everywhere -- no OES_texture_float / EXT_color_buffer_float
// extension dependency to worry about on an unknown GPU), which only holds
// [0,1]. Wave heights need negative values, so every height is stored as
// value*0.5+0.5 and decoded back with (v-0.5)*2.0 in the shaders below.

const VERTEX = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const SIM_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;
  uniform float uDamping;
  varying vec2 vUv;

  float decode(float v) { return (v - 0.5) * 2.0; }
  float encode(float v) { return clamp(v * 0.5 + 0.5, 0.0, 1.0); }

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 data = texture2D(uTexture, vUv);
    float prevHeight = decode(data.g);

    float n = decode(texture2D(uTexture, vUv + vec2(0.0, texel.y)).r);
    float s = decode(texture2D(uTexture, vUv - vec2(0.0, texel.y)).r);
    float e = decode(texture2D(uTexture, vUv + vec2(texel.x, 0.0)).r);
    float w = decode(texture2D(uTexture, vUv - vec2(texel.x, 0.0)).r);

    // Classic two-buffer wave equation: a point's new height is the average
    // of its neighbours last frame, minus its own height the frame before
    // that -- produces real outward-propagating concentric ripples.
    float newHeight = (n + s + e + w) * 0.5 - prevHeight;
    newHeight *= uDamping;

    float dist = distance(vUv, uMouse);
    float drop = smoothstep(uMouseRadius, 0.0, dist) * uMouseStrength;
    newHeight = clamp(newHeight + drop, -1.0, 1.0);

    gl_FragColor = vec4(encode(newHeight), data.r, 0.0, 1.0);
  }
`

const DISPLAY_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uHeightMap;
  uniform vec2 uResolution;
  uniform float uRefraction;
  uniform float uAberration;
  varying vec2 vUv;

  float decode(float v) { return (v - 0.5) * 2.0; }

  // Procedural stand-in for the page's own CSS background (see
  // index.css .gallery-bg) so the shader has something of ours to distort
  // instead of needing an expensive DOM-to-texture capture every frame.
  vec3 bgColor(vec2 uv) {
    vec3 top = vec3(0.949, 0.945, 0.925);
    vec3 bottom = vec3(0.914, 0.906, 0.878);
    vec3 base = mix(top, bottom, clamp(uv.y, 0.0, 1.0));
    float d = distance(uv, vec2(0.5, 1.15));
    vec3 glow = vec3(0.757, 0.314, 0.180) * smoothstep(0.9, 0.0, d) * 0.09;
    return base + glow;
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    float hC = decode(texture2D(uHeightMap, vUv).r);
    float hX = decode(texture2D(uHeightMap, vUv + vec2(texel.x, 0.0)).r);
    float hY = decode(texture2D(uHeightMap, vUv + vec2(0.0, texel.y)).r);
    vec2 grad = vec2(hX - hC, hY - hC);

    vec2 distortedUv = vUv + grad * uRefraction;
    float aberration = clamp(length(grad) * uAberration, 0.0, 0.03);

    float r = bgColor(distortedUv + vec2(aberration, 0.0)).r;
    float g = bgColor(distortedUv).g;
    float b = bgColor(distortedUv - vec2(aberration, 0.0)).b;

    gl_FragColor = vec4(r, g, b, 1.0);
  }
`

const SIM_RES = 256 // low-res sim field, upsampled smoothly in the display pass -- keeps this at 60fps regardless of screen size

export default function FluidRipple() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return // touch: ripples need a real cursor

    const canvas = canvasRef.current
    let renderer
    try {
      renderer = new Renderer({ canvas, alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) })
    } catch {
      return // WebGL unavailable -- the CSS gradient background underneath still renders fine without this
    }
    const gl = renderer.gl

    const geometry = new Triangle(gl)

    const simProgram = new Program(gl, {
      vertex: VERTEX,
      fragment: SIM_FRAGMENT,
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: [SIM_RES, SIM_RES] },
        uMouse: { value: [0.5, 0.5] },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: 0.05 },
        uDamping: { value: 0.985 },
      },
    })
    const simMesh = new Mesh(gl, { geometry, program: simProgram })

    const displayProgram = new Program(gl, {
      vertex: VERTEX,
      fragment: DISPLAY_FRAGMENT,
      uniforms: {
        uHeightMap: { value: null },
        uResolution: { value: [SIM_RES, SIM_RES] },
        uRefraction: { value: 0.06 },
        uAberration: { value: 1.4 },
      },
    })
    const displayMesh = new Mesh(gl, { geometry, program: displayProgram })

    const targetOpts = { width: SIM_RES, height: SIM_RES, depth: false }
    let fboRead = new RenderTarget(gl, targetOpts)
    let fboWrite = new RenderTarget(gl, targetOpts)

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    resize()

    // Pointer state is written on every real event, but only *consumed*
    // (injected into the sim) once per rAF tick -- this is the "throttle
    // pointer event writes to requestAnimationFrame" requirement: mousemove
    // can fire far faster than 60fps, the GPU upload must not.
    const pointer = { x: 0.5, y: 0.5, lastX: 0.5, lastY: 0.5, strength: 0, dirty: false }

    function setPointerFromEvent(clientX, clientY) {
      const x = clientX / window.innerWidth
      const y = 1 - clientY / window.innerHeight
      const speed = Math.hypot(x - pointer.lastX, y - pointer.lastY)
      pointer.lastX = pointer.x
      pointer.lastY = pointer.y
      pointer.x = x
      pointer.y = y
      pointer.strength = Math.min(2.2, 0.35 + speed * 18)
      pointer.dirty = true
    }

    function onPointerMove(e) { setPointerFromEvent(e.clientX, e.clientY) }
    function onWheel(e) {
      // Scroll delta reads as an extra ripple at the last known cursor spot,
      // scaled by how hard the wheel moved.
      pointer.strength = Math.min(2.2, pointer.strength + Math.min(1.2, Math.abs(e.deltaY) / 300))
      pointer.dirty = true
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('resize', resize)

    let raf
    function tick() {
      raf = requestAnimationFrame(tick)

      simProgram.uniforms.uTexture.value = fboRead.texture
      simProgram.uniforms.uMouse.value = [pointer.x, pointer.y]
      simProgram.uniforms.uMouseStrength.value = pointer.dirty ? pointer.strength : 0
      pointer.dirty = false // consumed for this frame -- next injection needs a fresh event

      renderer.render({ scene: simMesh, target: fboWrite })
      ;[fboRead, fboWrite] = [fboWrite, fboRead]

      displayProgram.uniforms.uHeightMap.value = fboRead.texture
      renderer.render({ scene: displayMesh })
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', resize)
      if (fboRead.texture?.texture) gl.deleteTexture(fboRead.texture.texture)
      if (fboWrite.texture?.texture) gl.deleteTexture(fboWrite.texture.texture)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <canvas ref={canvasRef} className="fluid-ripple" />
}
