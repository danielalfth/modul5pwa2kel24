import { useState, useEffect, useCallback, useRef } from 'react'
import gunService from '../services/gunService'
import { getCache, setCache, generateCacheKey } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API.
//
// Returns { guns, loading, error, pagination, refetch }.
//
// ponytail: AbortController cancels stale requests when params change fast
// (e.g. typing in search). Cache with 5 min TTL avoids redundant fetches.
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Stable string key — re-run effect only when params actually change
  const paramKey = JSON.stringify(params)
  const abortRef = useRef(null)

  const fetchGuns = useCallback(async (skipCache = false) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    const cacheKey = generateCacheKey('guns', params)

    if (!skipCache) {
      const cached = getCache(cacheKey)
      if (cached) {
        setGuns(cached.guns)
        setPagination(cached.pagination)
        setLoading(false)
        setError(null)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGuns(params)

      // If this request was aborted, ignore the result
      if (abortRef.current?.signal.aborted) return

      if (response.success) {
        const result = {
          guns: response.data || [],
          pagination: response.pagination || null,
        }
        setGuns(result.guns)
        setPagination(result.pagination)
        setCache(cacheKey, result)
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
    return () => abortRef.current?.abort()
  }, [fetchGuns])

  return {
    guns,
    loading,
    error,
    pagination,
    refetch: () => fetchGuns(true),
  }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const response = await gunService.getGunById(id)
      if (response.success) {
        setGun(response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchGun() }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}
