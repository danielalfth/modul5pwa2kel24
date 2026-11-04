import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Shield,
  Copy,
  Check,
  Heart,
  FileText,
  Play,
  Edit3,
  Trash2,
  AlertCircle,
  PackageOpen,
  Archive,
  RotateCcw,
  Loader,
} from 'lucide-react'
import userService from '../services/userService'
import gunService from '../services/gunService'
import ConfirmModal from '../components/modals/ConfirmModal'
import { clearAllCache } from '../utils/queryCache'
import { useFavorites } from '../hooks/useFavorites'
import {
  getAllDraftIds,
  loadDraft,
  deleteDraft,
  getDraftTimestamp,
  formatDraftTime,
  clearAllDrafts,
} from '../utils/draftStorage'

// ---------------------------------------------------------------------------
// Draft list helpers
// ---------------------------------------------------------------------------

const loadAllDrafts = () =>
  getAllDraftIds().map((id) => ({
    id,
    timestamp: getDraftTimestamp(id),
    data: loadDraft(id),
  }))

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = ['Overview', 'Drafts', 'Archive', 'About', 'Contact']

/**
 * ProfilePage — tabbed hub: Overview, Drafts, About, Contact
 *
 * @param {Function} onReplaySplash   — replay intro animation
 * @param {Function} onEditProfile    — navigate to EditProfilePage
 * @param {Function} onOpenDraft      — navigate to Create/Edit with a draft loaded
 */
export default function ProfilePage({ onReplaySplash }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'Overview')
  const [profile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const [drafts, setDrafts] = useState(loadAllDrafts)

  const { favorites } = useFavorites()

  const handleCopyId = () => {
    navigator.clipboard?.writeText(profile.userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---- Archive (soft delete) ----
  const [archived, setArchived] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [archivedError, setArchivedError] = useState('')
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [permDeleteTarget, setPermDeleteTarget] = useState(null)

  const loadArchived = useCallback(async () => {
    try {
      setArchivedLoading(true)
      setArchivedError('')
      const res = await gunService.getArchivedGuns()
      setArchived(res.success ? res.data || [] : [])
    } catch (err) {
      setArchivedError(err.message || 'Failed to load archive.')
    } finally {
      setArchivedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'Archive') loadArchived()
  }, [activeTab, loadArchived])

  const handleRestore = async (gun) => {
    try {
      setArchiveBusy(true)
      setArchivedError('')
      const res = await gunService.restoreGun(gun.id)
      if (res && res.success === false) throw new Error(res.message)
      clearAllCache()
      setArchived((prev) => prev.filter((g) => g.id !== gun.id))
    } catch (err) {
      setArchivedError(err.message || 'Failed to restore.')
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleDeletePermanent = async () => {
    if (!permDeleteTarget) return
    try {
      setArchiveBusy(true)
      setArchivedError('')
      await gunService.deleteGun(permDeleteTarget.id)
      clearAllCache()
      setArchived((prev) => prev.filter((g) => g.id !== permDeleteTarget.id))
      setPermDeleteTarget(null)
    } catch (err) {
      setArchivedError(err.message || 'Failed to delete.')
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleDeleteDraft = (id) => {
    deleteDraft(id)
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const handleClearAllDrafts = () => {
    clearAllDrafts()
    setDrafts([])
  }

  return (
    <div className="profile-page">
      {/* Masthead */}
      <section
        className="masthead"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">Credentials, statistics, and armory settings.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onReplaySplash && (
            <button type="button" className="btn btn--outline btn--sm" onClick={onReplaySplash}>
              <Play size={14} /> Replay Intro
            </button>
          )}
          {(
            <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate('/profile/edit')}>
              <Edit3 size={14} /> Edit Profile
            </button>
          )}        </div>
      </section>

      {/* Tab nav */}
      <div className="adv-filter__pills" style={{ margin: '0 0 24px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`pill${activeTab === t ? ' pill--active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {activeTab === 'Overview' && (
        <>
          {/* Operator card */}
          <div className="profile-card">
            <div className="profile-card-top">
              <div className="avatar-wrap" style={{ width: 80, height: 80 }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.username} className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">
                    <Shield size={36} stroke="var(--brass)" />
                  </div>
                )}
              </div>

              <div className="profile-identity">
                <h2 className="display">{profile.username || 'Shooter'}</h2>
                {profile.bio && (
                  <p style={{ margin: '4px 0 8px', fontSize: '0.9rem', color: 'var(--steel)' }}>
                    {profile.bio}
                  </p>
                )}
                <div className="profile-id-row">
                  <span className="mono-badge">{profile.userId}</span>
                  <button type="button" className="icon-btn" onClick={handleCopyId} title="Copy User ID">
                    {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="profile-stats">
              <div className="stat-item">
                <Heart size={20} stroke="var(--brass)" />
                <div className="stat-val">{favorites.length}</div>
                <div className="stat-label">Favorites</div>
              </div>
              <div className="stat-item">
                <FileText size={20} stroke="var(--steel)" />
                <div className="stat-val">{drafts.length}</div>
                <div className="stat-label">Saved Drafts</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: Drafts ── */}
      {activeTab === 'Drafts' && (
        <div className="card-box">
          <div className="fieldset-header" style={{ marginBottom: '16px' }}>
            <h2 className="card-box-title" style={{ margin: 0 }}>
              Saved Drafts
            </h2>
            {drafts.length > 0 && (
              <button
                type="button"
                className="btn btn--danger-ghost btn--sm"
                onClick={handleClearAllDrafts}
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="state-box" style={{ border: 'none', padding: '32px 0' }}>
              <PackageOpen size={28} />
              <p>No saved drafts. Start creating a product and save a draft to see it here.</p>
            </div>
          ) : (
            <ul className="review-list">
              {drafts.map((draft) => {
                const name = draft.data?.formData?.name || 'Untitled Draft'
                const type = draft.data?.formData?.type || ''
                const isCreate = draft.id === 'create'

                return (
                  <li key={draft.id} className="review-item">
                    <div className="review-head">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="review-user">
                          {name}
                          {type ? <span className="type" style={{ marginLeft: 8 }}>{type}</span> : null}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--steel)' }}>
                          {isCreate ? 'New product draft' : `Edit draft · ID: ${draft.id.slice(0, 8)}…`}
                          {draft.timestamp ? ` · Saved ${formatDraftTime(draft.timestamp)}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        onClick={() => handleDeleteDraft(draft.id)}
                        title="Delete draft"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {draft.data?.uploadedImageUrl && (
                      <img
                        src={draft.data.uploadedImageUrl}
                        alt={name}
                        style={{ width: 60, height: 44, objectFit: 'cover', borderRadius: 4, marginTop: 8, border: '1px solid var(--line)' }}
                        loading="lazy"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="form-hint" style={{ marginTop: 16 }}>
            Drafts are stored locally in your browser. They will be available when you open the Create or Edit form.
          </p>
        </div>
      )}

      {/* ── TAB: Archive ── */}
      {activeTab === 'Archive' && (
        <div className="card-box">
          <div className="fieldset-header" style={{ marginBottom: '16px' }}>
            <h2 className="card-box-title" style={{ margin: 0 }}>
              Archived Products
            </h2>
            <span className="count">{archived.length} archived</span>
          </div>

          {archivedLoading && (
            <div className="state-box" style={{ border: 'none', padding: '32px 0' }}>
              <Loader size={28} className="spin" />
              <p>Loading archive…</p>
            </div>
          )}

          {!archivedLoading && archivedError && (
            <div className="state-box state-box--error" style={{ border: 'none', padding: '16px 0' }}>
              <AlertCircle size={24} />
              <p>{archivedError}</p>
            </div>
          )}

          {!archivedLoading && archived.length === 0 && !archivedError && (
            <div className="state-box" style={{ border: 'none', padding: '32px 0' }}>
              <Archive size={28} />
              <p>No archived products. Archived items can be restored or deleted permanently from here.</p>
            </div>
          )}

          {archived.length > 0 && (
            <ul className="review-list">
              {archived.map((gun) => (
                <li key={gun.id} className="review-item">
                  <div className="review-head">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="review-user">
                        {gun.name}
                        {gun.type ? <span className="type" style={{ marginLeft: 8 }}>{gun.type}</span> : null}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--steel)' }}>
                        Archived {gun.deleted_at ? new Date(gun.deleted_at).toLocaleString('id-ID') : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={archiveBusy}
                        onClick={() => handleRestore(gun)}
                        title="Restore to catalog"
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        disabled={archiveBusy}
                        onClick={() => setPermDeleteTarget(gun)}
                        title="Delete permanently"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <ConfirmModal
            open={!!permDeleteTarget}
            title="Delete Permanently"
            message={`Delete "${permDeleteTarget?.name}" permanently? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            loading={archiveBusy}
            onConfirm={handleDeletePermanent}
            onCancel={() => setPermDeleteTarget(null)}
          />
        </div>
      )}

      {/* ── TAB: About ── */}
      {activeTab === 'About' && (
        <div className="card-box">
          <h2 className="card-box-title">A one-room armory.</h2>
          <p style={{ color: 'var(--steel)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
            from the bench — no markup theatre, no filler.
          </p>
          <p style={{ color: 'var(--steel)', lineHeight: 1.6, margin: 0 }}>
            Built as a Progressive Web App (PWA) for Praktikum Pemrograman Berbasis Platform,
            Universitas Diponegoro. Runs fully offline with a service worker, local data
            fallback, and indexed catalog.
          </p>
        </div>
      )}

      {/* ── TAB: Contact ── */}
      {activeTab === 'Contact' && (
        <div className="card-box">
          <h2 className="card-box-title">Come by the shop.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--steel)', fontSize: '0.95rem' }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>Address</strong><br />
              123 Range Road, Semarang, Central Java
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>Hours</strong><br />
              Tuesday – Saturday, 10:00 – 18:00
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>Phone</strong><br />
              <a href="tel:+62812345670" style={{ color: 'var(--brass)', textDecoration: 'none' }}>
                +62 812-3456-7890
              </a>
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>WhatsApp</strong><br />
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--brass)', textDecoration: 'none' }}
              >
                Open in WhatsApp
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
