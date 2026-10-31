import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import './SplashScreen.css'

/**
 * SplashScreen — Full-bleed signature splash animation for Bore & Barrel
 * (Gunshop Asli Ngawi).
 *
 * Features:
 * - Dynamic rush & glow animation on logo
 * - Bullet trail, muzzle flash, glass crack SVG
 * - Interactive recoil/shake effect on click
 * - Auto-dismiss after 5.4s with smooth fade-out
 * - Skip / Enter Armory button
 *
 * @param {Object} props
 * @param {Function} [props.onFinish] - Callback when splash finishes / is dismissed
 * @param {number} [props.duration=5400] - Duration in ms before auto-fading
 */
export default function SplashScreen({ onFinish, duration = 5400 }) {
  const [isHit, setIsHit] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const dismissedRef = useRef(false)

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setIsFading(true)
    setTimeout(() => {
      if (onFinish) onFinish()
    }, 600)
  }, [onFinish])

  // Interactive recoil on tap/click
  const handleHit = (e) => {
    // If user clicked the skip button, let that handler run instead
    if (e.target.closest('.splash-skip-btn')) return

    setIsHit(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsHit(true)
      })
    })
  }

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, duration)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [duration, handleDismiss])

  return (
    <main
      className={`splash-overlay ${isHit ? 'hit' : ''} ${isFading ? 'splash-overlay--fading' : ''}`}
      id="splash"
      onClick={handleHit}
      role="dialog"
      aria-modal="true"
      aria-label="Bore & Barrel Intro"
    >
      {/* Light bullet trail */}
      <div className="splash-trail" aria-hidden="true" />

      {/* Muzzle flash */}
      <div className="splash-flash" aria-hidden="true" />

      {/* Gunshop Asli Ngawi cropped emblem */}
      <img
        className="splash-mark"
        src="/logo.png"
        alt="Bore & Barrel Gunshop Asli Ngawi Logo"
      />

      {/* Bullet impact cracks SVG */}
      <svg
        className="splash-cracks"
        viewBox="0 0 720 1280"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g transform="translate(525 500)">
          <path d="M0 0 28 -24 61 -31 84 -58 120 -72 158 -91 196 -128 230 -145 M61 -31 74 5 108 26 125 58 M120 -72 134 -42 166 -23 184 14 M0 0 -34 -22 -72 -27 -95 -52 -128 -61 -159 -92 M-72 -27 -69 7 -92 31 -105 63 M-128 -61 -148 -40 -176 -38 -204 -17 M0 0 14 38 10 75 35 103 42 137 M14 38 48 49 71 76 96 88 M0 0 -31 27 -55 60 -83 81 -105 119 M-55 60 -40 91 -49 119 M0 0 40 13 68 8 96 29 129 32 M40 13 44 -18 66 -39 M0 0 7 -45 -2 -76 13 -108 5 -139 M7 -45 33 -64 53 -91" />
          <path d="M-159 -92 -173 -119 -198 -133 M196 -128 214 -101 245 -88 M42 137 66 163 70 194 M-105 119 -128 144 -154 156 M230 -145 254 -164 279 -166" />
        </g>
      </svg>

      {/* Brand title reveal */}
      <section className="splash-brand">
        <div className="splash-brand-name">Bore &amp; Barrel</div>
        <div className="splash-brand-sub">GUNSHOP ASLI NGAWI</div>
      </section>

      {/* Skip button */}
      <button
        type="button"
        className="splash-skip-btn"
        onClick={(e) => {
          e.stopPropagation()
          handleDismiss()
        }}
        aria-label="Skip splash screen"
      >
        <span>Enter Armory</span>
        <ArrowRight size={14} />
      </button>

      <span className="splash-hint">Tap anywhere to recoil</span>
    </main>
  )
}
