import { useEffect, useRef } from 'react'

// A two-part custom cursor (a tight dot + a lagging ring) that expands over
// anything marked `data-cursor-hover` -- buttons, cards, links. Standard
// award-site cursor pattern; the ring's CSS transition (not JS) is what
// gives the lag/ease instead of a jumpy 1:1 follow. Falls back to the
// system cursor entirely on touch devices (see the (hover:none) media query
// in index.css) and if anything here throws, since this is pure polish and
// must never block interaction.
export default function CustomCursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return

    document.body.classList.add('has-cursor')
    const dot = dotRef.current
    const ring = ringRef.current
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let ringX = targetX
    let ringY = targetY

    function onMove(e) {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      targetX = e.clientX
      targetY = e.clientY
      // Any naturally-interactive element counts -- no need to hand-tag
      // every button/link/card with a data attribute.
      const hoverTarget = e.target.closest?.('button, a, input[type="range"], .panel--interactive, [data-cursor-hover]')
      ring.classList.toggle('is-hover', Boolean(hoverTarget))
    }

    // Lerp toward the target each frame -- this is what makes the ring trail
    // a beat behind the dot instead of snapping to the mouse 1:1.
    let raf
    function tick() {
      ringX += (targetX - ringX) * 0.18
      ringY += (targetY - ringY) * 0.18
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      document.body.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </>
  )
}
