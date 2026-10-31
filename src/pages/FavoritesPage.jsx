import { useMemo } from 'react'
import { Heart, Loader, AlertCircle, ArrowRight } from 'lucide-react'
import { useFavorites } from '../hooks/useFavorites'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'

/**
 * FavoritesPage — Displays user's shortlisted / favorited weapons.
 * Supports dual-mode (server API + localStorage fallback).
 */
export default function FavoritesPage({ onSelectGun, onNavigateCatalog }) {
  const { favorites, loading: favLoading, error: favError, refetch } = useFavorites()
  const { guns: apiGuns } = useGuns({ limit: 100 })

  // All known guns catalog for fallback item lookup
  const allKnownGuns = useMemo(() => {
    const map = new Map()
    // Local catalog
    GUNS_LOCAL.forEach((g, idx) => {
      const id = g.id || `local-${idx}`
      const enriched = { ...g, id }
      map.set(id, enriched)
      map.set(String(id), enriched)
      if (g.name) map.set(g.name, enriched)
    })
    // API catalog
    apiGuns.forEach((g) => {
      if (g.id !== undefined && g.id !== null) {
        map.set(g.id, g)
        map.set(String(g.id), g)
      }
      if (g.name) map.set(g.name, g)
    })
    return map
  }, [apiGuns])

  // Resolve favorited products
  const favoriteItems = useMemo(() => {
    // 1. If backend returned full objects in favorites array:
    const resolved = []
    const seen = new Set()

    favorites.forEach((fav) => {
      const id = fav.id || fav.recipe_id || fav.gun_id
      const match = allKnownGuns.get(id) || allKnownGuns.get(fav.name) || (fav.name ? fav : null)
      if (match && !seen.has(match.id || match.name)) {
        seen.add(match.id || match.name)
        resolved.push(match)
      } else if (id && !seen.has(id)) {
        seen.add(id)
        resolved.push({
          id,
          name: fav.name || 'Hardware item',
          type: fav.category || 'Hardware',
          image_url: fav.image_url || '/guns/pistol.svg',
          price: fav.cook_time || 0,
        })
      }
    })

    return resolved
  }, [favorites, allKnownGuns])

  const isLoading = favLoading && favoriteItems.length === 0

  return (
    <div className="fav-page">
      <section className="masthead">
        <h1 className="display">Saved Shortlist</h1>
        <p className="lede">
          Weapons and equipment marked for procurement. Persisted with your armory profile.
        </p>
      </section>

      <section className="fav-content">
        <div className="list-head">
          <h2>Armory Favorites</h2>
          <span className="count">
            {favoriteItems.length} weapon{favoriteItems.length !== 1 ? 's' : ''} saved
          </span>
        </div>

        {isLoading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading your shortlist…</p>
          </div>
        )}

        {!isLoading && favError && favoriteItems.length === 0 && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{favError}</p>
            <button type="button" className="btn btn--outline" onClick={refetch}>
              Retry Connection
            </button>
          </div>
        )}

        {!isLoading && favoriteItems.length === 0 && !favError && (
          <div className="state-box">
            <Heart size={36} stroke="var(--steel)" />
            <h3>No hardware favorited yet</h3>
            <p className="lede">
              Explore the armory catalog and click the heart icon on any piece to save it here.
            </p>
            {onNavigateCatalog && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onNavigateCatalog}
                style={{ marginTop: '16px' }}
              >
                Browse Catalog <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {favoriteItems.length > 0 && (
          <ul className="stock">
            {favoriteItems.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={onSelectGun}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
