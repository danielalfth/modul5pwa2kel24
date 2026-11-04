import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, Send, Loader, MessageCircle, Share2, Check,
  ThumbsUp, ThumbsDown, Edit3, Trash2, X, ChevronLeft, ChevronRight,
  Archive, RotateCcw,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import LazyImage from '../common/LazyImage'
import {
  useReviews, useCreateReview, useUpdateReview,
  useDeleteReview, useThumbsVote,
} from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'
import { getWhatsAppLink } from '../../utils/whatsapp'
import { shareProduct } from '../../utils/share'

/**
 * Full-screen product detail view.
 *
 * Features:
 * - Multi-image carousel
 * - Review CRUD (create, edit, delete)
 * - Thumbs up / down on reviews
 * - WhatsApp contact
 * - Share link
 * - Archive / restore / permanent delete
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete, onArchive, onRestore }) {
  const navigate = useNavigate()
  const handleBack = onBack || (() => navigate(-1))
  // Derive image list — prefer gun.images[], fall back to single image_url
  const images =
    Array.isArray(gun.images) && gun.images.length > 0
      ? gun.images
      : [gun.image_url || gun.image || '/guns/pistol.svg']

  const [imgIndex, setImgIndex] = useState(0)
  const imgSrc = images[imgIndex] || '/guns/pistol.svg'

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Reviews
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const { updateReview, loading: updating } = useUpdateReview()
  const { deleteReview, loading: deleting } = useDeleteReview()
  const { vote } = useThumbsVote()

  // Create-review form state
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Edit-review state
  const [editingReview, setEditingReview] = useState(null) // { id, rating, comment }
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')

  // Local optimistic thumbs — keyed by review id
  const [thumbsState, setThumbsState] = useState({}) // { [id]: { up: n, down: n, voted: 'up'|'down'|null } }

  // Share state
  const [shareSuccess, setShareSuccess] = useState(false)

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  // ---- Handlers ----
  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')
    if (rating < 1 || rating > 5) { setReviewError('Rating must be between 1 and 5.'); return }
    const result = await createReview(gun.id, {
      user_identifier: getUserIdentifier(),
      rating,
      comment: comment.trim(),
    })
    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  const handleStartEdit = (rev) => {
    setEditingReview(rev)
    setEditRating(rev.rating)
    setEditComment(rev.comment)
  }

  const handleSaveEdit = async () => {
    if (!editingReview) return
    const result = await updateReview(editingReview.id, gun.id, { rating: editRating, comment: editComment })
    if (result !== null) {
      setEditingReview(null)
      refetchReviews()
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return
    const ok = await deleteReview(reviewId, gun.id)
    if (ok) refetchReviews()
  }

  const handleVote = async (rev, direction) => {
    const local = thumbsState[rev.id] || { up: rev.thumbs_up || 0, down: rev.thumbs_down || 0, voted: null }
    if (local.voted) return // already voted

    // Optimistic update
    setThumbsState((prev) => ({
      ...prev,
      [rev.id]: {
        up: direction === 'up' ? local.up + 1 : local.up,
        down: direction === 'down' ? local.down + 1 : local.down,
        voted: direction,
      },
    }))

    await vote(
      rev.id,
      direction,
      direction === 'up' ? local.up : local.down,
      gun.id,
    )
  }

  const handleShare = async () => {
    const result = await shareProduct(gun)
    if (result.success) {
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 3000)
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={handleBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero */}
      <div className="detail-hero">
        {/* Image carousel */}
        <div className="detail-img-wrap" style={{ position: 'relative' }}>
          <LazyImage
            className="detail-img"
            src={imgSrc}
            alt={gun.name}
            width="600"
            height="420"
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="img-nav img-nav--prev"
                onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="img-nav img-nav--next"
                onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
              <div className="img-dots">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`img-dot${i === imgIndex ? ' img-dot--active' : ''}`}
                    onClick={() => setImgIndex(i)}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />
            <a
              href={getWhatsAppLink(gun)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary"
              title="Contact seller via WhatsApp"
            >
              <MessageCircle size={18} /> Hubungi Penjual
            </a>
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleShare}
              title="Share this product"
            >
              {shareSuccess ? (
                <><Check size={18} /> Shared!</>
              ) : (
                <><Share2 size={18} /> Share</>
              )}
            </button>
            {onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}
            {onArchive && !gun.deleted_at && (
              <button
                type="button"
                className="btn btn--outline"
                title="Archive (soft delete)"
                onClick={() => onArchive(gun)}
              >
                <Archive size={16} /> Archive
              </button>
            )}
            {onRestore && gun.deleted_at && (
              <button
                type="button"
                className="btn btn--outline"
                title="Restore from archive"
                onClick={() => onRestore(gun)}
              >
                <RotateCcw size={16} /> Restore
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={() => onDelete(gun)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail strip for multi-image */}
      {images.length > 1 && (
        <div className="img-strip">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`img-thumb-btn${i === imgIndex ? ' img-thumb-btn--active' : ''}`}
              onClick={() => setImgIndex(i)}
            >
              <img src={src} alt={`View ${i + 1}`} className="img-thumb" />
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>{step.instruction || step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {/* Submit review form */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button type="submit" className="btn btn--primary" disabled={submitting || !gun.id}>
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> Submit Review</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              const localThumbs = thumbsState[rev.id]
              const upCount = localThumbs ? localThumbs.up : (rev.thumbs_up || 0)
              const downCount = localThumbs ? localThumbs.down : (rev.thumbs_down || 0)
              const voted = localThumbs?.voted || null
              const isEditing = editingReview?.id === rev.id

              return (
                <li key={rev.id} className="review-item">
                  {isEditing ? (
                    /* ---- Edit mode ---- */
                    <div className="review-edit-form">
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        maxLength={500}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={handleSaveEdit}
                          disabled={updating}
                        >
                          {updating ? <Loader size={14} className="spin" /> : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => setEditingReview(null)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ---- Display mode ---- */
                    <>
                      <div className="review-head">
                        <span className="review-user">{rev.user_identifier || 'Anonymous'}</span>
                        <span className="review-stars-display">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              fill={i < rev.rating ? 'var(--brass)' : 'none'}
                              stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                            />
                          ))}
                        </span>

                        {/* Review action buttons */}
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleStartEdit(rev)}
                            title="Edit review"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => handleDeleteReview(rev.id)}
                            disabled={deleting}
                            title="Delete review"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {rev.comment && <p className="review-comment">{rev.comment}</p>}

                      {/* Thumbs up / down */}
                      <div className="review-thumbs">
                        <button
                          type="button"
                          className={`thumb-btn${voted === 'up' ? ' thumb-btn--active thumb-btn--up' : ''}`}
                          onClick={() => handleVote(rev, 'up')}
                          disabled={!!voted}
                          title="Helpful"
                        >
                          <ThumbsUp size={14} /> {upCount > 0 && <span>{upCount}</span>}
                        </button>
                        <button
                          type="button"
                          className={`thumb-btn${voted === 'down' ? ' thumb-btn--active thumb-btn--down' : ''}`}
                          onClick={() => handleVote(rev, 'down')}
                          disabled={!!voted}
                          title="Not helpful"
                        >
                          <ThumbsDown size={14} /> {downCount > 0 && <span>{downCount}</span>}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}