import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'
import { getCache, setCache, clearCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useReviews — fetch reviews for a specific product, with 5-min cache.
// ---------------------------------------------------------------------------

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async (skipCache = false) => {
    if (!gunId) { setLoading(false); return }
    const cacheKey = `reviews:${gunId}`
    if (!skipCache) {
      const cached = getCache(cacheKey)
      if (cached) { setReviews(cached); setLoading(false); setError(null); return }
    }
    try {
      setLoading(true)
      setError(null)
      const response = await reviewService.getReviews(gunId)
      if (response.success) {
        const data = response.data || []
        setReviews(data)
        setCache(cacheKey, data)
      } else {
        setError(response.message || 'Failed to fetch reviews.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching reviews.')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [gunId])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  return { reviews, loading, error, refetch: () => fetchReviews(true) }
}

// ---------------------------------------------------------------------------
// useCreateReview — submit a new review.
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true); setError(null); setSuccess(false)
      const response = await reviewService.createReview(gunId, reviewData)
      if (response.success) {
        setSuccess(true)
        clearCache(`reviews:${gunId}`)
        return response.data
      } else {
        setError(response.message || 'Failed to submit review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}

// ---------------------------------------------------------------------------
// useUpdateReview — edit an existing review.
// ---------------------------------------------------------------------------

export function useUpdateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const updateReview = async (reviewId, gunId, reviewData) => {
    try {
      setLoading(true); setError(null)
      const response = await reviewService.updateReview(reviewId, reviewData)
      if (response.success) {
        clearCache(`reviews:${gunId}`)
        return response.data
      } else {
        setError(response.message || 'Failed to update review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { updateReview, loading, error }
}

// ---------------------------------------------------------------------------
// useDeleteReview — delete a review.
// ---------------------------------------------------------------------------

export function useDeleteReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const deleteReview = async (reviewId, gunId) => {
    try {
      setLoading(true); setError(null)
      const response = await reviewService.deleteReview(reviewId)
      if (response.success) {
        clearCache(`reviews:${gunId}`)
        return true
      } else {
        setError(response.message || 'Failed to delete review.')
        return false
      }
    } catch (err) {
      setError(err.message || 'An error occurred while deleting review.')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteReview, loading, error }
}

// ---------------------------------------------------------------------------
// useThumbsVote — thumbs up/down on a review.
// ---------------------------------------------------------------------------

export function useThumbsVote() {
  const [loading, setLoading] = useState(false)

  const vote = async (reviewId, direction, currentValue, gunId) => {
    try {
      setLoading(true)
      let response
      if (direction === 'up') {
        response = await reviewService.thumbsUp(reviewId, currentValue)
      } else {
        response = await reviewService.thumbsDown(reviewId, currentValue)
      }
      if (response.success) {
        clearCache(`reviews:${gunId}`)
        return response.data
      }
    } catch (err) {
      console.warn('Thumbs vote error:', err)
    } finally {
      setLoading(false)
    }
    return null
  }

  return { vote, loading }
}