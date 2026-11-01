import FavoriteButton from '../common/FavoriteButton'
import LazyImage from '../common/LazyImage'
import { formatPrice, truncate } from '../../utils/helpers'
import { MessageCircle, Share2 } from 'lucide-react'
import { getWhatsAppLink } from '../../utils/whatsapp'
import { shareProduct } from '../../utils/share'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete }) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <LazyImage
          className="card-img"
          src={imgSrc}
          alt={gun.name}
          width="240"
          height="180"
        />

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        <FavoriteButton gunId={gun.id || gun.name} />

        <a
          href={getWhatsAppLink(gun)}
          target="_blank"
          rel="noopener noreferrer"
          className="card-act-btn"
          onClick={(e) => e.stopPropagation()}
          aria-label="Contact seller via WhatsApp"
          title="Hubungi Penjual"
        >
          <MessageCircle size={16} color="var(--ink)" />
        </a>

        <button
          type="button"
          className="card-act-btn"
          onClick={async (e) => { 
            e.stopPropagation()
            await shareProduct(gun)
          }}
          aria-label="Share this product"
          title="Share"
        >
          <Share2 size={16} color="var(--ink)" />
        </button>

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
