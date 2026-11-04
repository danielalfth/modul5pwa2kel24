import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'
import { getCache, setCache, clearCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// FavoritesContext — single source of truth for favorites across the app
// Replaces multiple useFavorites() calls with one shared state.
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
    /* quota exceeded */
  }
}

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLocal, setIsLocal] = useState(false)
  const userIdentifier = getUserIdentifier()

  const fetchFavorites = useCallback(async (skipCache = false) => {
    const cacheKey = `favorites:${userIdentifier}`

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
        setCache(cacheKey, data, 2 * 60 * 1000)
      } else {
        throw new Error(response.message)
      }
    } catch {
      setFavorites(readLocalFavs())
      setIsLocal(true)
    } finally {
      setLoading(false)
    }
  }, [userIdentifier])

  const toggleFavorite = async (gunId) => {
    try {
      const response = await favoriteService.toggleFavorite({
        recipe_id: gunId,
        user_identifier: userIdentifier,
      })

      if (response.success) {
        clearCache(`favorites:${userIdentifier}`)
        await fetchFavorites(true)
        return response.data
      }
      throw new Error(response.message)
    } catch {
      // Fallback: localStorage toggle
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
      setFavorites(current)
      return { is_favorited: isFavorited }
    }
  }

  const isFavorited = useCallback(
    (gunId) =>
      favorites.some((fav) => {
        const favId =
          typeof fav === 'object' && fav !== null
            ? fav.id ?? fav.product_id ?? fav.recipe_id
            : fav
        return String(favId) === String(gunId)
      }),
    [favorites],
  )

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        loading,
        error,
        isLocal,
        isFavorited,
        toggleFavorite,
        refetch: () => fetchFavorites(true),
      }}
    >
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavoritesContext() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavoritesContext must be inside FavoritesProvider')
  return ctx
}
