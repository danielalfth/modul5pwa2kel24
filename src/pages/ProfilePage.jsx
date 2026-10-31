import { useState } from 'react'
import {
  Shield,
  Copy,
  Check,
  Save,
  Heart,
  FileText,
  Camera,
  Play,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'

/**
 * Get count of active drafts in localStorage
 */
const getActiveDraftCount = () => {
  try {
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('bore_barrel_draft_') || key.startsWith('recipe_draft_'))) {
        count++
      }
    }
    return count
  } catch {
    return 0
  }
}

/**
 * ProfilePage — User identity and Armory settings.
 * Manages operator profile, identifier, favorites stats, and draft storage.
 */
export default function ProfilePage({ onReplaySplash }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')

  const { favorites } = useFavorites()
  const [draftCount] = useState(getActiveDraftCount)

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setFeedback('Avatar image must be under 2MB.')
      setTimeout(() => setFeedback(''), 3000)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target.result
      setAvatar(base64)
      userService.updateAvatar(base64)
      setFeedback('Avatar updated.')
      setTimeout(() => setFeedback(''), 3000)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    const updated = {
      ...profile,
      username: username.trim() || 'Shooter',
      bio: bio.trim(),
      avatar,
    }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setFeedback('Profile successfully updated.')
      setTimeout(() => setFeedback(''), 3000)
    } else {
      setFeedback('Failed to save profile.')
    }
  }

  return (
    <div className="profile-page">
      <section className="masthead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, procurement statistics, and armorer details.
          </p>
        </div>
        {onReplaySplash && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onReplaySplash}
            title="Replay introductory splash animation"
          >
            <Play size={14} /> Replay Intro
          </button>
        )}
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {avatar ? (
              <img src={avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
            <label htmlFor="avatar-file-input" className="avatar-upload-btn" title="Upload avatar">
              <Camera size={14} />
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden-file-input"
              />
            </label>
          </div>

          <div className="profile-identity">
            <h2 className="display">{profile.username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{draftCount}</div>
            <div className="stat-label">Saved Offline Drafts</div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="profile-form">
        <h3 className="section-title">Armorer Details</h3>

        <div className="form-group">
          <label htmlFor="prof-name" className="form-label">
            Callsign / Operator Alias
          </label>
          <input
            id="prof-name"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Operator Delta, Master Gunsmith"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="prof-bio" className="form-label">
            Armory Notes / Station Bio
          </label>
          <textarea
            id="prof-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Qualifications, preferred calibers, unit assignment..."
            rows={3}
            className="form-textarea"
          />
        </div>

        <button type="submit" className="btn btn--primary">
          <Save size={16} /> Save Armorer Profile
        </button>
      </form>
    </div>
  )
}
