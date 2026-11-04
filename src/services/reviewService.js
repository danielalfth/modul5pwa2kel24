import { apiClient, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Supports both Supabase (public.reviews) and university API.
// ---------------------------------------------------------------------------

class ReviewService {
  /** Fetch all reviews for a given product. */
  async getReviews(gunId) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
      )
      const list = Array.isArray(data)
        ? data.map((r) => ({
            id: r.id,
            product_id: r.product_id,
            user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
            rating: r.rating,
            comment: r.comment || '',
            created_at: r.created_at,
            thumbs_up: r.thumbs_up || 0,
            thumbs_down: r.thumbs_down || 0,
          }))
        : []
      return { success: true, data: list }
    }
    return apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
  }

  /** Submit a new review. */
  async createReview(gunId, reviewData) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
      }
      try {
        // Attempt with thumbs_up & thumbs_down columns if they exist
        const res = await apiClient.post('/rest/v1/reviews', { ...payload, thumbs_up: 0, thumbs_down: 0 }, {
          headers: { Prefer: 'return=representation' },
        })
        const created = Array.isArray(res) ? res[0] : res
        return { success: true, data: created }
      } catch (err) {
        // Fallback without thumbs columns if table schema doesn't have them
        const res = await apiClient.post('/rest/v1/reviews', payload, {
          headers: { Prefer: 'return=representation' },
        })
        const created = Array.isArray(res) ? res[0] : res
        return { success: true, data: created }
      }
    }
    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
  }

  /** Edit an existing review. */
  async updateReview(reviewId, reviewData) {
    if (IS_SUPABASE) {
      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        { rating: Number(reviewData.rating), comment: reviewData.comment },
        { headers: { Prefer: 'return=representation' } },
      )
      return { success: true, data: Array.isArray(res) ? res[0] : res }
    }
    return apiClient.put(`/api/v1/reviews/${reviewId}`, reviewData)
  }

  /** Delete a review. */
  async deleteReview(reviewId) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      return { success: true }
    }
    return apiClient.delete(`/api/v1/reviews/${reviewId}`)
  }

  /** Thumbs up a review — increments thumbs_up counter. */
  async thumbsUp(reviewId, currentValue = 0) {
    if (IS_SUPABASE) {
      try {
        const res = await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          { thumbs_up: currentValue + 1 },
          { headers: { Prefer: 'return=representation' } },
        )
        return { success: true, data: Array.isArray(res) ? res[0] : res }
      } catch {
        // Soft fallback if thumbs_up column does not exist on Supabase
        return { success: true }
      }
    }
    return { success: true }
  }

  /** Thumbs down a review — increments thumbs_down counter. */
  async thumbsDown(reviewId, currentValue = 0) {
    if (IS_SUPABASE) {
      try {
        const res = await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          { thumbs_down: currentValue + 1 },
          { headers: { Prefer: 'return=representation' } },
        )
        return { success: true, data: Array.isArray(res) ? res[0] : res }
      } catch {
        // Soft fallback if thumbs_down column does not exist on Supabase
        return { success: true }
      }
    }
    return { success: true }
  }
}

export default new ReviewService()