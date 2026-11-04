import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

/**
 * CreateGunPage â€” Create a new weapon / hardware item with image upload,
 * draft persistence (auto-save), specs, and assembly steps.
 */
export default function CreateGunPage({ onBack, onSuccess }) {
  const navigate = useNavigate()
  const handleBack = onBack || (() => navigate(-1))
  const handleSuccess = onSuccess || (() => navigate('/'))
  // Step state: 'upload' (upload or choose image) or 'form' (enter details)
  const [currentStep, setCurrentStep] = useState('upload')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan', // API validation expects 'makanan' or 'minuman'
    difficulty: 'mudah',  // 'mudah' (Standard) | 'sedang' (Service) | 'sulit' (Match)
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [extraFiles, setExtraFiles] = useState([])
  const [uploadedImageUrl, setUploadedImageUrl] = useState('')
  const [additionalImages, setAdditionalImages] = useState([])
  const [uploadingAdditional, setUploadingAdditional] = useState(false)

  // Specifications (ingredients in API)
  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])

  // Maintenance / Assembly Steps (steps in API)
  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Draft management
  const [showDraftModal, setShowDraftModal] = useState(() => hasDraft('create'))
  const [draftTimestamp, setDraftTimestamp] = useState(() => getDraftTimestamp('create'))

  const handleSaveDraft = useCallback((notify = true) => {
    const draftData = {
      formData,
      specs,
      steps,
      uploadedImageUrl,
      additionalImages,
    }
    const saved = saveDraft(draftData, 'create')
    if (saved) {
      const ts = getDraftTimestamp('create')
      setDraftTimestamp(ts)
      if (notify) {
        setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    }
  }, [formData, specs, steps, uploadedImageUrl, additionalImages])

  // Auto-save draft every 30 seconds while in form step
  useEffect(() => {
    if (currentStep !== 'form') return

    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (draft.additionalImages) setAdditionalImages(draft.additionalImages)
      if (draft.uploadedImageUrl) {
        setUploadedImageUrl(draft.uploadedImageUrl)
        setImagePreview(draft.uploadedImageUrl)
        setCurrentStep('form')
      }
      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Handle file selection (supports selecting multiple images)
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds 5MB limit.`)
        return
      }
      if (!allowed.includes(f.type)) {
        setError('Allowed formats: .jpg, .jpeg, .png, .webp')
        return
      }
    }

    const primary = files[0]
    setImageFile(primary)
    setImagePreview(URL.createObjectURL(primary))
    setExtraFiles(files.slice(1))
    setError('')
  }

  // Quick fallback select vector from local assets
  const handleSelectPreset = (url) => {
    setImageFile(null)
    setExtraFiles([])
    setImagePreview(url)
    setUploadedImageUrl(url)
    setCurrentStep('form')
    setError('')
  }

  // Upload image(s) to server
  const handleUploadImage = async () => {
    if (!imageFile) {
      // If user already previewed a preset or entered a url, advance to form
      if (uploadedImageUrl) {
        setCurrentStep('form')
        return
      }
      setError('Please select an image file first.')
      return
    }

    try {
      setUploading(true)
      setError('')
      const result = await uploadService.uploadImage(imageFile)
      let primaryUrl = ''
      if (result.success && result.data?.url) {
        primaryUrl = result.data.url
      } else {
        primaryUrl = imagePreview || '/guns/pistol.svg'
      }
      setUploadedImageUrl(primaryUrl)

      // If additional images were selected at Step 1, upload them too
      if (extraFiles.length > 0) {
        const extraUrls = []
        for (const file of extraFiles) {
          try {
            const res = await uploadService.uploadImage(file)
            if (res.success && res.data?.url) {
              extraUrls.push(res.data.url)
            }
          } catch { /* proceed */ }
        }
        if (extraUrls.length > 0) {
          setAdditionalImages((prev) => [...prev, ...extraUrls])
        }
      }

      setCurrentStep('form')
    } catch (err) {
      console.warn('Upload API failed, falling back to local preview:', err)
      setUploadedImageUrl(imagePreview || '/guns/pistol.svg')
      setCurrentStep('form')
    } finally {
      setUploading(false)
    }
  }

  // Handle uploading additional gallery images from device
  const handleUploadAdditionalFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadingAdditional(true)
    setError('')
    try {
      const urls = []
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File "${file.name}" exceeds 5MB limit.`)
        }
        const res = await uploadService.uploadImage(file)
        if (res.success && res.data?.url) {
          urls.push(res.data.url)
        } else {
          throw new Error(res.message || 'Image upload failed.')
        }
      }
      setAdditionalImages((prev) => [...prev, ...urls])
      setSuccessMsg(`${urls.length} photo(s) added to gallery.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to upload additional photos.')
    } finally {
      setUploadingAdditional(false)
      e.target.value = ''
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Specs handlers
  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => {
    setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  }

  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  // Steps handlers
  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => {
    setSteps((prev) => [...prev, ''])
  }

  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit create product
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    // Prepare payload compliant with backend /api/v1/recipes schema
    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: uploadedImageUrl || '/guns/pistol.svg',
      images: [uploadedImageUrl || '/guns/pistol.svg', ...additionalImages].filter(Boolean),
      prep_time: 15,
      cook_time: Number(formData.price) || 500, // Price stored in cook_time
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        handleSuccess(response.data)
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={handleBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a firearm or accessory to the catalog. Data will be synchronized with the
          university RESTful backend.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Step Indicators */}
      <div className="form-steps-nav">
        <div className={`step-badge ${currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'}`}>
          1. Imagery
        </div>
        <div className="step-badge-connector" />
        <div className={`step-badge ${currentStep === 'form' ? 'step-badge--active' : ''}`}>
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Upload Image */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Weapon Imagery</h2>
          <p className="card-box-desc">
            Upload an authentic photograph or blueprint (max 5MB), or select an armory preset.
          </p>

          {!imagePreview ? (
            <div className="upload-dropzone">
              <input
                id="gun-image-input"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden-file-input"
              />
              <label htmlFor="gun-image-input" className="upload-label">
                <Upload size={36} className="upload-icon" />
                <span className="upload-main-text">Click to choose image file(s)</span>
                <span className="upload-sub-text">JPG, PNG, or WebP up to 5MB (select 1 or multiple for gallery)</span>
              </label>

              <div className="preset-selector">
                <span className="preset-title">Or use a stock preset:</span>
                <div className="preset-pills">
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/pistol.svg')}
                  >
                    Pistol Vector
                  </button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/rifle.svg')}
                  >
                    Rifle Vector
                  </button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/shotgun.svg')}
                  >
                    Shotgun Vector
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-container">
              <div className="preview-image-wrap">
                <img src={imagePreview} alt="Hardware preview" className="preview-img" />
                <button
                  type="button"
                  className="preview-remove-btn"
                  onClick={() => {
                    setImageFile(null)
                    setExtraFiles([])
                    setImagePreview(null)
                    setUploadedImageUrl('')
                  }}
                  title="Remove image"
                >
                  <X size={18} />
                </button>
              </div>
              {extraFiles.length > 0 && (
                <p className="form-hint" style={{ marginTop: 8, color: 'var(--brass)' }}>
                  +{extraFiles.length} additional image(s) selected for the product gallery.
                </p>
              )}

              <div className="preview-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUploadImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="spin" /> Uploading to MinIOâ€¦
                    </>
                  ) : (
                    <>
                      <Upload size={18} /> Confirm Imagery &amp; Continue
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    setUploadedImageUrl(imagePreview)
                    setCurrentStep('form')
                  }}
                >
                  Continue without uploading
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Product Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          {/* Active Image Thumbnail */}
          <div className="selected-thumb-bar">
            <img src={uploadedImageUrl || imagePreview} alt="Selected" className="thumb-small" />
            <div className="thumb-info">
              <span className="thumb-title">Imagery Assigned</span>
              <span className="thumb-sub">Ready for registration</span>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Change Image
            </button>
          </div>

          {/* Core Info */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  // Map category for backend schema
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
                className="form-select"
              >
                <option value="Pistol">Pistol (Sidearm)</option>
                <option value="Rifle">Rifle (Long Gun)</option>
                <option value="Shotgun">Shotgun (Smoothbore)</option>
                <option value="Submachine Gun">Submachine Gun</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid--3">
            <div className="form-group">
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="599"
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

          {/* Specifications (Ingredients) */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications &amp; Components</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>
            <div className="multi-rows">
              {specs.map((spec, i) => (
                <div key={i} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Barrel Length, Action)"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16 inch, Striker-fired)"
                    value={spec.quantity}
                    onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(i)}
                    disabled={specs.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Assembly / Maintenance Steps */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Assembly &amp; Maintenance Protocol</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="multi-rows">
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>
                  <input
                    type="text"
                    placeholder="e.g. Clear the chamber and lock slide back..."
                    value={st}
                    onChange={(e) => handleStepChange(i, e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Images / Gallery */}
          <div className="form-fieldset">
            <div className="fieldset-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Gallery / Additional Images (optional)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label
                  htmlFor="extra-images-file-input"
                  className="btn btn--primary btn--sm"
                  style={{ cursor: uploadingAdditional ? 'not-allowed' : 'pointer', margin: 0 }}
                  title="Upload image files from your computer"
                >
                  <Upload size={14} /> Upload Image(s)
                  <input
                    id="extra-images-file-input"
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleUploadAdditionalFiles}
                    disabled={uploadingAdditional}
                    className="hidden-file-input"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => setAdditionalImages((prev) => [...prev, ''])}
                >
                  <Plus size={14} /> Add Image URL
                </button>
              </div>
            </div>

            {uploadingAdditional && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--brass)' }}>
                <Loader size={16} className="spin" />
                <span>Uploading additional photo(s) to storage…</span>
              </div>
            )}

            {additionalImages.length === 0 ? (
              <p className="form-hint">No additional images yet. Click <strong>Upload Image(s)</strong> to select files, or <strong>Add Image URL</strong> to enter a link.</p>
            ) : (
              <div className="multi-rows">
                {additionalImages.map((url, i) => (
                  <div key={i} className="multi-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {url ? (
                      <img
                        src={url}
                        alt={`Gallery ${i + 1}`}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)', flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    ) : null}
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => {
                        const copy = [...additionalImages]
                        copy[i] = e.target.value
                        setAdditionalImages(copy)
                      }}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      onClick={() => setAdditionalImages((prev) => prev.filter((_, j) => j !== i))}
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Featured checkbox */}
          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />
            <label htmlFor="is_featured" className="checkbox-label">
              Feature in Armory Showcase (Highlight product on catalog)
            </label>
          </div>

          {/* Submit bar */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleBack}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Registering Hardwareâ€¦
                </>
              ) : (
                'Commit to Armory'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Restore Draft Modal */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'} was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
