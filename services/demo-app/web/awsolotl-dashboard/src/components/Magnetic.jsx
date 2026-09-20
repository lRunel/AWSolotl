import { useMagnetic } from '../useMagnetic'

// Wraps any element (usually a button) so it pulls toward the cursor on
// hover. A thin div wrapper rather than cloning the child keeps this safe
// to use around anything without worrying whether the child forwards refs.
export default function Magnetic({ children, strength = 14, style, block = false }) {
  const { ref, onMouseMove, onMouseLeave } = useMagnetic(strength)
  return (
    <div
      ref={ref}
      className="magnetic"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ ...(block ? { display: 'flex', width: '100%' } : {}), ...style }}
    >
      {children}
    </div>
  )
}
