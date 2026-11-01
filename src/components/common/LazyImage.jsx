import { useState } from 'react'

/**
 * LazyImage — native lazy load + skeleton placeholder + error fallback
 *
 * ponytail: no IntersectionObserver needed, browser's native loading="lazy"
 * handles deferral. The skeleton covers the flash before decode finishes.
 */
export default function LazyImage({ src, alt, className, fallback = '/guns/pistol.svg', width, height, ...rest }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const imgSrc = errored ? fallback : (src || fallback)

  return (
    <span className="lazy-img-wrap" style={{ display: 'block', position: 'relative', width, height }}>
      {!loaded && (
        <span className="lazy-skeleton" aria-hidden="true" />
      )}
      <img
        {...rest}
        src={imgSrc}
        alt={alt}
        className={`${className || ''} lazy-img${loaded ? ' lazy-img--loaded' : ''}`}
        loading="lazy"
        decoding="async"
        width={width}
        height={height}
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); setLoaded(true) }}
      />
    </span>
  )
}
