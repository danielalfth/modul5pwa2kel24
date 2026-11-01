import { useState, useEffect, useCallback } from 'react'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'
import { getCache, setCache, clearCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// localStorage fallback — used when the backend is unavailable so that
// favourites are still fully functional offline.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'bore_barrel_favorites'

const readLocalFavs = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalFavs = (ids) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
  } catch {
    /* quota exceeded — silently fail */
  }
}

// ---------------------------------------------------------------------------
// useFavorites — list all favourited product IDs.
//
// First attempts the server; on failure uses localStorage.
// ponytail: cache favorites with 2 min TTL (frequently changing data)
// ---------------------------------------------------------------------------

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLocal, setIsLocal] = useState(false)
  const userIdentifier = getUserIdentifier()

  const fetchFavorites = useCallback(async (skipCache = false) => {
    const cacheKey = `favorites:${userIdentifier}`
    
    // Check cache first
    if (!skipCache) {
      const cached = getCache(cacheKey)
      if (cached) {
        setFavorites(cached)
        setIsLocal(false)
        setLoading(false)
        setError(null)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      const response = await favoriteService.getFavorites(userIdentifier)

      if (response.success) {
        const data = response.data || []
        setFavorites(data)
        setIsLocal(false)
        // Cache with shorter TTL (2 minutes)
        setCache(cacheKey, data, 2 * 60 * 1000)
      } else {
        throw new Error(response.message)
      }
    } catch {
      // Fallback to localStorage
      setFavorites(readLocalFavs())
      setIsLocal(true)
    } finally {
      setLoading(false)
    }
  }, [userIdentifier])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return { 
    favorites, 
    loading, 
    error, 
    isLocal, 
    refetch: () => fetchFavorites(true) 
  }
}

// ---------------------------------------------------------------------------
// useToggleFavorite — toggle a product in/out of favourites.
// ---------------------------------------------------------------------------

export function useToggleFavorite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const userIdentifier = getUserIdentifier()

  const toggleFavorite = async (gunId) => {
    try {
      setLoading(true)
      setError(null)

      const response = await favoriteService.toggleFavorite({
        recipe_id: gunId,
        user_identifier: userIdentifier,
      })

      if (response.success) {
        // Invalidate favorites cache so next fetch is fresh
        clearCache(`favorites:${userIdentifier}`)
        return response.data
      }
      throw new Error(response.message)
    } catch {
      // Fallback: toggle in localStorage
      const current = readLocalFavs()
      const idx = current.findIndex((id) => String(id) === String(gunId))
      let isFavorited

      if (idx === -1) {
        current.push(gunId)
        isFavorited = true
      } else {
        current.splice(idx, 1)
        isFavorited = false
      }
      writeLocalFavs(current)
      return { is_favorited: isFavorited }
    } finally {
      setLoading(false)
    }
  }

  return { toggleFavorite, loading, error }
}

// ---------------------------------------------------------------------------
// useIsFavorited — convenience wrapper for a single product.
// ---------------------------------------------------------------------------

export function useIsFavorited(gunId) {
  const { favorites, loading: fetchLoading, refetch } = useFavorites()
  const { toggleFavorite: toggle, loading: toggleLoading } = useToggleFavorite()

  // Check both server-format (objects with .id) and local-format (plain ids)
  const isFavorited = favorites.some((fav) => {
    const favId = typeof fav === 'object' && fav !== null ? (fav.id ?? fav.product_id ?? fav.recipe_id) : fav
    return String(favId) === String(gunId)
  })

  const toggleFavorite = async () => {
    const result = await toggle(gunId)
    if (result) await refetch()
    return result
  }

  return {
    isFavorited,
    loading: fetchLoading || toggleLoading,
    toggleFavorite,
  }
}

export { getUserIdentifier }
