import { useRef } from 'react'

// Wraps a button so it pulls slightly toward the cursor on hover and snaps
// back on leave -- the ".magnetic" CSS transition supplies the easing, this
// hook just tracks pointer position. Strength is in pixels of max pull.
export function useMagnetic(strength = 14) {
  const ref = useRef(null)

  function onMouseMove(e) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - (rect.left + rect.width / 2)
    const y = e.clientY - (rect.top + rect.height / 2)
    el.style.transform = `translate(${(x / rect.width) * strength}px, ${(y / rect.height) * strength}px)`
  }

  function onMouseLeave() {
    const el = ref.current
    if (el) el.style.transform = 'translate(0, 0)'
  }

  return { ref, onMouseMove, onMouseLeave }
}
