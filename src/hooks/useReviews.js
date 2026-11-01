import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'
import { getCache, setCache, clearCache } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useReviews — fetch reviews for a specific product.
// ponytail: cache reviews with 5 min TTL
// ---------------------------------------------------------------------------

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async (skipCache = false) => {
    if (!gunId) {
      setLoading(false)
      return
    }
    
    const cacheKey = `reviews:${gunId}`
    
    // Check cache first
    if (!skipCache) {
      const cached = getCache(cacheKey)
      if (cached) {
        setReviews(cached)
        setLoading(false)
        setError(null)
        return
      }
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

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return { 
    reviews, 
    loading, 
    error, 
    refetch: () => fetchReviews(true) 
  }
}

// ---------------------------------------------------------------------------
// useCreateReview — submit a new review for a product.
// ponytail: clear cache on successful create
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      const response = await reviewService.createReview(gunId, reviewData)

      if (response.success) {
        setSuccess(true)
        // Clear cache for this product's reviews
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
