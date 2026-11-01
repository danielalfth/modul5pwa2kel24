import { useState } from 'react'
import { ArrowLeft, Camera, Save, Check, Shield } from 'lucide-react'
import userService from '../services/userService'

/**
 * EditProfilePage — dedicated page for editing operator profile.
 * Separated from ProfilePage to keep concerns clean.
 */
export default function EditProfilePage({ onBack }) {
  const [profile] = useState(() => userService.getUserProfile())
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')
  const [saving, setSaving] = useState(false)

  const showFeedback = (msg, type = 'success') => {
    setFeedback(msg)
    setFeedbackType(type)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showFeedback('Avatar image must be under 2MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatar(ev.target.result)
      userService.updateAvatar(ev.target.result)
      showFeedback('Avatar updated.')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSaving(true)
    const result = userService.saveUserProfile({
      ...profile,
      username: username.trim() || 'Shooter',
      bio: bio.trim(),
      avatar,
    })
    setSaving(false)
    if (result.success) {
      showFeedback('Profile saved successfully.')
      setTimeout(() => onBack(), 1200)
    } else {
      showFeedback('Failed to save profile.', 'error')
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Profile
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Edit Profile</h1>
        <p className="lede">Update your operator callsign, bio, and avatar.</p>
      </div>

      {feedback && (
        <div className={`toast toast--${feedbackType}`}>
          {feedbackType === 'success' && <Check size={18} />} {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="entry-form">
        {/* Avatar */}
        <div className="card-box" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="avatar-wrap" style={{ width: 80, height: 80, flexShrink: 0 }}>
            {avatar ? (
              <img src={avatar} alt="Avatar" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
            <label htmlFor="avatar-edit-input" className="avatar-upload-btn" title="Change avatar">
              <Camera size={14} />
              <input
                id="avatar-edit-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden-file-input"
              />
            </label>
          </div>

          <div>
            <p className="form-label" style={{ marginBottom: 4 }}>Profile Avatar</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--steel)', margin: 0 }}>
              Click the camera icon to upload. Max 2MB.
            </p>
            {avatar && (
              <button
                type="button"
                className="btn btn--danger-ghost btn--sm"
                style={{ marginTop: 8 }}
                onClick={() => { setAvatar(null); userService.updateAvatar(null) }}
              >
                Remove avatar
              </button>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="form-group">
          <label htmlFor="edit-username" className="form-label">
            Callsign / Operator Alias <span className="req">*</span>
          </label>
          <input
            id="edit-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Operator Delta, Master Gunsmith"
            className="form-input"
            maxLength={40}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-bio" className="form-label">
            Armory Notes / Bio
          </label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Qualifications, preferred calibers, unit assignment..."
            rows={4}
            className="form-textarea"
            maxLength={300}
          />
          <p className="form-hint">{bio.length}/300</p>
        </div>

        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
