import { apiClient, IS_SUPABASE } from '../config/api'
import { getUserIdentifier } from './userService'

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return { id: `spec-${idx}`, name: s.substring(0, colonIndex).trim(), quantity: s.substring(colonIndex + 1).trim() }
        }
        return { id: `spec-${idx}`, name: 'Specification', quantity: s.trim() }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }
  const stepsList = Array.isArray(item.steps) && item.steps.length > 0
    ? item.steps
    : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']
  let imagesList = []
  if (Array.isArray(item.images) && item.images.length > 0) {
    imagesList = item.images
  } else if (item.image_url || item.image) {
    imagesList = [item.image_url || item.image]
  }
  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    images: imagesList,
    ingredients: specsList,
    steps: stepsList,
    deleted_at: item.deleted_at || null,
  }
}

// ---------------------------------------------------------------------------
// Local archive storage helper for fallback when database lacks deleted_at column
// ---------------------------------------------------------------------------
const ARCHIVED_STORAGE_KEY = 'bb_archived_guns'

const getLocalArchivedIds = () => {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVED_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const setLocalArchivedIds = (ids) => {
  try {
    localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(ids))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// GunService
// ---------------------------------------------------------------------------
class GunService {
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      const buildQuery = (withDeletedFilter) => {
        const filterParts = []
        if (withDeletedFilter) {
          filterParts.push('deleted_at=is.null')
          // Only show published products in the public catalog
          filterParts.push('status=eq.published')
        }
        if (params.search) filterParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
        if (params.category && params.category !== 'All') filterParts.push(`type=eq.${encodeURIComponent(params.category)}`)
        const sortOrder = params.order === 'desc' ? 'desc' : 'asc'
        const sortBy = params.sort_by || 'created_at'
        filterParts.push(`order=${encodeURIComponent(sortBy)}.${sortOrder}`)
        const page = params.page || 1
        const limit = params.limit || 4
        const offset = (page - 1) * limit
        return {
          dataQuery: ['select=*', ...filterParts, `limit=${limit}`, `offset=${offset}`].join('&'),
          countQuery: ['select=id', ...filterParts].join('&'),
          page,
          limit,
          offset,
        }
      }

      let list = []
      let total = 0
      let page = params.page || 1
      let limit = params.limit || 4

      try {
        const q = buildQuery(true)
        page = q.page
        limit = q.limit
        const data = await apiClient.get(`/rest/v1/products?${q.dataQuery}`)
        list = Array.isArray(data) ? data.map(normalizeProduct) : []
        total = list.length + q.offset
        try {
          const countData = await apiClient.get(`/rest/v1/products?${q.countQuery}`)
          total = Array.isArray(countData) ? countData.length : total
        } catch { /* keep pessimistic */ }
      } catch (err) {
        // Fallback: If 'deleted_at' column does not exist in Supabase, fetch without it and filter locally
        const errMsg = err?.message || ''
        const rawMsg = JSON.stringify(err?.raw || '')
        if (errMsg.includes('deleted_at') || rawMsg.includes('deleted_at') || err?.status === 400) {
          const q = buildQuery(false)
          page = q.page
          limit = q.limit
          const data = await apiClient.get(`/rest/v1/products?${q.dataQuery}`)
          const rawList = Array.isArray(data) ? data.map(normalizeProduct) : []
          const localArchived = getLocalArchivedIds()
          list = rawList.filter((item) => !localArchived.includes(item.id))
          total = list.length + q.offset
          try {
            const countData = await apiClient.get(`/rest/v1/products?${q.countQuery}`)
            total = Array.isArray(countData) ? Math.max(0, countData.length - localArchived.length) : total
          } catch { /* keep pessimistic */ }
        } else {
          throw err
        }
      }

      return { success: true, data: list, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } }
    }
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) return { success: true, data: normalizeProduct(data[0]) }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients) ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`) : Array.isArray(data.specs) ? data.specs : []
      const imagesArray = Array.isArray(data.images) && data.images.length > 0 ? data.images : data.image_url ? [data.image_url] : []
      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: imagesArray[0] || data.image_url || null,
        images: imagesArray,
        owner_id: data.owner_id || getUserIdentifier(),
        status: data.status || 'published',
      }
      try {
        const res = await apiClient.post('/rest/v1/products', payload, { headers: { Prefer: 'return=representation' } })
        const created = Array.isArray(res) ? res[0] : res
        return { success: true, data: normalizeProduct(created) }
      } catch (err) {
        // If 'images' column doesn't exist on server, omit it and retry
        if (err?.message?.includes('images') || JSON.stringify(err?.raw || '').includes('images')) {
          delete payload.images
          const res = await apiClient.post('/rest/v1/products', payload, { headers: { Prefer: 'return=representation' } })
          const created = Array.isArray(res) ? res[0] : res
          return { success: true, data: normalizeProduct(created) }
        }
        throw err
      }
    }
    return apiClient.post('/api/v1/recipes', data)
  }

  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients) ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`) : Array.isArray(data.specs) ? data.specs : undefined
      const payload = { updated_at: new Date().toISOString() }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) payload.price = Number(data.price ?? data.cook_time ?? 0)
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined) payload.image_url = data.image_url
      if (Array.isArray(data.images)) {
        payload.images = data.images
        if (data.images.length > 0 && !payload.image_url) payload.image_url = data.images[0]
      }
      try {
        const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, { headers: { Prefer: 'return=representation' } })
        const updated = Array.isArray(res) ? res[0] : res
        return { success: true, data: normalizeProduct(updated) }
      } catch (err) {
        // If 'images' column doesn't exist on server, omit it and retry
        if (err?.message?.includes('images') || JSON.stringify(err?.raw || '').includes('images')) {
          delete payload.images
          const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, { headers: { Prefer: 'return=representation' } })
          const updated = Array.isArray(res) ? res[0] : res
          return { success: true, data: normalizeProduct(updated) }
        }
        throw err
      }
    }
    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  async patchGun(id, data) {
    if (IS_SUPABASE) return this.updateGun(id, data)
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  /** Soft-delete (archive) — sets deleted_at timestamp with fallback. */
  async archiveGun(id) {
    if (IS_SUPABASE) {
      try {
        const res = await apiClient.patch(
          `/rest/v1/products?id=eq.${id}`,
          { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { headers: { Prefer: 'return=representation' } },
        )
        const updated = Array.isArray(res) ? res[0] : res
        return { success: true, data: normalizeProduct(updated) }
      } catch (err) {
        // Fallback to local archived ID list if deleted_at column is missing on server
        const archived = getLocalArchivedIds()
        if (!archived.includes(id)) {
          setLocalArchivedIds([...archived, id])
        }
        return { success: true, data: { id, deleted_at: new Date().toISOString() } }
      }
    }
    return this.deleteGun(id)
  }

  /** Restore archived product — clears deleted_at with fallback. */
  async restoreGun(id) {
    if (IS_SUPABASE) {
      // Also clean up local archive if present
      const archived = getLocalArchivedIds().filter((aid) => aid !== id)
      setLocalArchivedIds(archived)

      try {
        const res = await apiClient.patch(
          `/rest/v1/products?id=eq.${id}`,
          { deleted_at: null, updated_at: new Date().toISOString() },
          { headers: { Prefer: 'return=representation' } },
        )
        const updated = Array.isArray(res) ? res[0] : res
        return { success: true, data: normalizeProduct(updated) }
      } catch (err) {
        return { success: true, data: { id, deleted_at: null } }
      }
    }
    return { success: false, message: 'Restore not supported on this backend.' }
  }

  /** Permanent (hard) delete. */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      const archived = getLocalArchivedIds().filter((aid) => aid !== id)
      setLocalArchivedIds(archived)
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }

  /** Fetch archived (soft-deleted) products with fallback. */
  async getArchivedGuns() {
    if (IS_SUPABASE) {
      try {
        const data = await apiClient.get(`/rest/v1/products?deleted_at=not.is.null&select=*&order=deleted_at.desc`)
        if (Array.isArray(data) && data.length > 0) {
          return { success: true, data: data.map(normalizeProduct) }
        }
      } catch { /* column might not exist, proceed to local check */ }

      // Check local archived IDs
      const localArchived = getLocalArchivedIds()
      if (localArchived.length > 0) {
        try {
          const filter = localArchived.map((id) => `id=eq.${id}`).join('&or=')
          const data = await apiClient.get(`/rest/v1/products?select=*`)
          if (Array.isArray(data)) {
            const matched = data.filter((item) => localArchived.includes(item.id))
            return {
              success: true,
              data: matched.map((item) => ({ ...normalizeProduct(item), deleted_at: new Date().toISOString() })),
            }
          }
        } catch { /* ignore */ }
      }
      return { success: true, data: [] }
    }
    return { success: true, data: [] }
  }
}

export default new GunService()