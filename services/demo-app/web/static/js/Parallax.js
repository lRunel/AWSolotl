/* ===== Parallax.js — Apple-style 3D depth wallpaper ===== */
const Parallax = (() => {
    'use strict';

    let scene = null;
    let layers = [];
    let currentX = 0, currentY = 0;
    let targetX = 0, targetY = 0;
    const ease = 0.08; // Lerp factor — lower = smoother
    let rafId = null;

    function init() {
        scene = document.getElementById('parallax-scene');
        if (!scene) return;
        layers = Array.from(scene.querySelectorAll('.parallax-layer'));
        if (!layers.length) return;

        // Desktop: mouse tracking
        document.addEventListener('mousemove', onMouseMove, { passive: true });

        // Mobile: gyroscope / device orientation
        if (window.DeviceOrientationEvent) {
            // iOS 13+ requires permission request
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                document.body.addEventListener('click', requestGyroPermission, { once: true });
            } else {
                window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
            }
        }

        tick();
    }

    function requestGyroPermission() {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
                }
            })
            .catch(console.warn);
    }

    function onMouseMove(e) {
        // Normalize mouse position to range [-1, 1] from center
        const w = window.innerWidth;
        const h = window.innerHeight;
        targetX = (e.clientX - w / 2) / (w / 2);
        targetY = (e.clientY - h / 2) / (h / 2);
    }

    function onDeviceOrientation(e) {
        // gamma: left-right tilt (-90 to 90)
        // beta: front-back tilt (-180 to 180)
        const gamma = e.gamma || 0;
        const beta = e.beta || 0;
        // Normalize to [-1, 1] range (clamp at ±30 degrees)
        targetX = Math.max(-1, Math.min(1, gamma / 30));
        targetY = Math.max(-1, Math.min(1, (beta - 45) / 30)); // 45° = holding phone normally
    }

    function tick() {
        // Smooth lerp toward target
        currentX += (targetX - currentX) * ease;
        currentY += (targetY - currentY) * ease;

        // Apply transforms to each layer
        for (const layer of layers) {
            const depth = parseFloat(layer.dataset.depth) || 0;
            const maxShift = 40; // max pixels of movement
            const moveX = currentX * depth * maxShift;
            const moveY = currentY * depth * maxShift;
            layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        }

        rafId = requestAnimationFrame(tick);
    }

    function destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('deviceorientation', onDeviceOrientation);
    }

    return { init, destroy };
})();
