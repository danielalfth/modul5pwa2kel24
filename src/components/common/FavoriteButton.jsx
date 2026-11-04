import { Heart } from 'lucide-react'
import { useFavoritesContext } from '../../contexts/FavoritesContext'

/**
 * A toggleable heart button. Now uses shared FavoritesContext.
 */
export default function FavoriteButton({ gunId, onToggle }) {
  const { isFavorited, toggleFavorite } = useFavoritesContext()

  const handleClick = async (e) => {
    e.stopPropagation()
    const result = await toggleFavorite(gunId)
    if (result && onToggle) onToggle(result)
  }

  return (
    <button
      type="button"
      className={`fav-btn${isFavorited(gunId) ? ' fav-btn--active' : ''}`}
      onClick={handleClick}
      aria-label={isFavorited(gunId) ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorited(gunId) ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        size={18}
        fill={isFavorited(gunId) ? 'var(--brass)' : 'none'}
        stroke={isFavorited(gunId) ? 'var(--brass)' : 'var(--steel)'}
      />
    </button>
  )
}
