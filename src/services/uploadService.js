import axios from 'axios'
import { BASE_URL, SUPABASE_KEY, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// UploadService — image upload service.
// Supports Supabase Storage (/storage/v1/object/:bucket/:file) and
// standard REST API (/api/v1/upload), with client-side fallback.
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

class UploadService {
  /**
   * Upload a single image file.
   * @param {File} file
   * @returns {Promise<{ success: boolean, data: { url: string } }>}
   */
  async uploadImage(file) {
    if (!file) {
      throw new Error('No file provided.')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        'Invalid file type. Allowed formats: .jpg, .jpeg, .png, .webp',
      )
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('File size exceeds the 5 MB limit.')
    }

    // --- Supabase Storage flow ---
    if (IS_SUPABASE) {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `gun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
      const bucketName = 'guns'

      try {
        const uploadUrl = `${BASE_URL}/storage/v1/object/${bucketName}/${fileName}`
        await axios.post(uploadUrl, file, {
          headers: {
            'Content-Type': file.type,
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          timeout: 30000,
        })

        const publicUrl = `${BASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`
        return {
          success: true,
          data: { url: publicUrl, filename: fileName },
        }
      } catch (err) {
        console.warn('Supabase bucket upload not accessible, creating base64 data URL:', err)
        // Read file as base64 Data URL so the image displays and persists
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        return {
          success: true,
          data: { url: dataUrl, filename: file.name },
        }
      }
    }

    // --- University API flow (/api/v1/upload) ---
    const formData = new FormData()
    formData.append('image', file)

    const response = await axios.post(`${BASE_URL}/api/v1/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })

    return response.data
  }
}

export default new UploadService()
