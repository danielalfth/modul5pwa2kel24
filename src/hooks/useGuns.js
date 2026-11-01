import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'
import { getCache, setCache, generateCacheKey } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API.
//
// Returns { guns, loading, error, pagination, refetch }.
// When the API is unreachable the `error` string will be set and `guns`
// will remain an empty array so the UI can show a proper error state.
//
// ponytail: cache with 5 min TTL to reduce API calls
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Serialise params so the effect re-runs when they change.
  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async (skipCache = false) => {
    const cacheKey = generateCacheKey('guns', params)
    
    // Check cache first
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

      if (response.success) {
        const result = {
          guns: response.data || [],
          pagination: response.pagination || null
        }
        setGuns(result.guns)
        setPagination(result.pagination)
        
        // Cache the result
        setCache(cacheKey, result)
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  return { 
    guns, 
    loading, 
    error, 
    pagination, 
    refetch: () => fetchGuns(true) // Force skip cache on manual refetch
  }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID.
//
// Returns { gun, loading, error, refetch }.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
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

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}
