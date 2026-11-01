// ---------------------------------------------------------------------------
// queryCache.js — Simple in-memory cache with TTL
// ponytail: minimal cache, no external lib needed
// ---------------------------------------------------------------------------

const cache = new Map()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Set cache with TTL
 */
export const setCache = (key, data, ttl = DEFAULT_TTL) => {
  const expires = Date.now() + ttl
  cache.set(key, { data, expires })
}

/**
 * Get cache if not expired
 */
export const getCache = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

/**
 * Clear specific cache key
 */
export const clearCache = (key) => {
  cache.delete(key)
}

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  cache.clear()
}

/**
 * Check if cache exists and is valid
 */
export const hasCache = (key) => {
  return getCache(key) !== null
}

/**
 * Generate cache key from params object
 */
export const generateCacheKey = (prefix, params = {}) => {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key]
      return acc
    }, {})
  return `${prefix}:${JSON.stringify(sorted)}`
}
