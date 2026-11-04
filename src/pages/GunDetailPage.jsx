import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader, AlertCircle } from 'lucide-react'
import GunDetail from '../components/gun/GunDetail'
import { useGunById } from '../hooks/useGuns'
import gunService from '../services/gunService'
import { clearAllCache } from '../utils/queryCache'

/**
 * GunDetailPage — route /catalog/:id
 * Loads a single product by URL param, handles loading/error/not-found.
 * Sets document.title for SEO and share link previews.
 */
export default function GunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { gun, loading, error } = useGunById(id)

  useEffect(() => {
    if (gun) {
      document.title = `${gun.name} | Bore & Barrel`
    } else {
      document.title = 'Bore & Barrel'
    }
    return () => { document.title = 'Bore & Barrel' }
  }, [gun])

  if (loading) {
    return (
      <div className="state-box" style={{ marginTop: 48 }}>
        <Loader size={28} className="spin" />
        <p>Loading hardware details…</p>
      </div>
    )
  }

  if (error || !gun) {
    return (
      <div className="state-box state-box--error" style={{ marginTop: 48 }}>
        <AlertCircle size={28} />
        <p>{error || 'Product not found.'}</p>
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => navigate('/')}
        >
          Back to Catalog
        </button>
      </div>
    )
  }

  // Archived or draft not owned by user → treat as not found
  if (gun.deleted_at || (gun.status === 'draft')) {
    return (
      <div className="state-box" style={{ marginTop: 48 }}>
        <AlertCircle size={28} />
        <p>This product is no longer available.</p>
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => navigate('/')}
        >
          Back to Catalog
        </button>
      </div>
    )
  }

  return (
    <GunDetail
      gun={gun}
      onBack={() => navigate('/')}
      onEdit={() => navigate(`/edit/${gun.id}`)}
      onArchive={async (g) => {
        const res = await gunService.archiveGun(g.id)
        if (res && res.success === false) return
        clearAllCache()
        navigate('/profile', { state: { tab: 'Archive' } })
      }}
    />
  )
}
