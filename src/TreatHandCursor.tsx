import { useEffect, useRef } from 'react'
import type { CSSProperties, JSX } from 'react'

export interface TreatHandCursorProps {
  readonly active: boolean
  readonly isAiming: boolean
}

const CURSOR_OFFSET_X = 18
const CURSOR_OFFSET_Y = 18
const VIEWBOX_SIZE = 64

export function TreatHandCursor({
  active,
  isAiming,
}: TreatHandCursorProps): JSX.Element | null {
  const cursorRef = useRef<HTMLDivElement>(null)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!active) {
      lastPositionRef.current = null
      return
    }

    const handlePointerMove = (e: PointerEvent): void => {
      lastPositionRef.current = { x: e.clientX, y: e.clientY }
      const el = cursorRef.current
      if (el) {
        el.style.display = ''
        el.style.transform = `translate3d(${e.clientX + CURSOR_OFFSET_X}px, ${e.clientY + CURSOR_OFFSET_Y}px, 0)`
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [active])

  if (!active) {
    return null
  }

  const lastPos = lastPositionRef.current
  const initialStyle: CSSProperties = lastPos
    ? {
        transform: `translate3d(${lastPos.x + CURSOR_OFFSET_X}px, ${lastPos.y + CURSOR_OFFSET_Y}px, 0)`,
      }
    : { display: 'none' }

  return (
    <div
      ref={cursorRef}
      className={`treat-hand-cursor ${isAiming ? 'is-aiming' : ''}`}
      style={initialStyle}
      aria-hidden="true"
    >
      <div className="treat-hand-graphic">
        <TreatHandSvg isAiming={isAiming} />
      </div>
      <div className="treat-hand-badge">
        <span>{isAiming ? 'Release to toss!' : 'Click & drag to toss'}</span>
      </div>
    </div>
  )
}

function TreatHandSvg({
  isAiming,
}: {
  readonly isAiming: boolean
}): JSX.Element {
  return (
    <svg
      width={VIEWBOX_SIZE}
      height={VIEWBOX_SIZE}
      viewBox="0 0 64 64"
      fill="none"
      className={`treat-hand-svg ${isAiming ? 'aiming-tilt' : ''}`}
    >
      <defs>
        <radialGradient id="treatGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd875" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f3ad42" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Soft Glow */}
      <circle cx="32" cy="24" r="20" fill="url(#treatGlow)" />
      {/* Hand / Palm */}
      <path
        d="M18 42C16 34 20 28 26 27C27 27 28 28 29 30C31 27 34 26 36 27C38 28 39 30 40 32C42 30 45 30 47 32C49 34 50 38 48 44C46 50 40 56 32 56C24 56 19 49 18 42Z"
        fill="#f7d4b2"
        stroke="#deb088"
        strokeWidth="2"
      />
      {/* Palm crease */}
      <path
        d="M26 44C30 48 36 48 40 45"
        stroke="#deb088"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Treats in hand */}
      {/* Treat 1 - center */}
      <path
        d="M32 20L36 24L34 29L29 28L28 23Z"
        fill="#bc895d"
        stroke="#8b5e3c"
        strokeWidth="1.5"
      />
      {/* Treat 2 - left */}
      <path
        d="M23 23L27 26L25 30L20 29L19 25Z"
        fill="#cca075"
        stroke="#8b5e3c"
        strokeWidth="1.5"
      />
      {/* Treat 3 - right */}
      <path
        d="M39 24L43 27L42 32L37 31L36 26Z"
        fill="#c29165"
        stroke="#8b5e3c"
        strokeWidth="1.5"
      />
      {/* Treat 4 - front */}
      <path
        d="M30 28L34 31L32 35L27 34L26 30Z"
        fill="#dbaf82"
        stroke="#8b5e3c"
        strokeWidth="1.5"
      />
      {/* Shiny sparkles on treats */}
      <circle cx="33" cy="22" r="1" fill="#fff6d6" />
      <circle cx="24" cy="25" r="1" fill="#fff6d6" />
      <circle cx="31" cy="30" r="1" fill="#fff6d6" />
    </svg>
  )
}
