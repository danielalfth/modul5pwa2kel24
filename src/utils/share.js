// ---------------------------------------------------------------------------
// Share helper — Web Share API dengan clipboard fallback
// ---------------------------------------------------------------------------

/**
 * Generate shareable URL untuk produk
 */
export const getProductShareUrl = (product) => {
  const baseUrl = window.location.origin
  return `${baseUrl}/catalog/${product.id}`
}

/**
 * Generate share text untuk produk
 */
export const getShareText = (product) => {
  const price = product.price ?? product.cook_time ?? 0
  return `Check out ${product.name} - ${product.type || 'Hardware'} • $${price}`
}

/**
 * Share produk menggunakan Web Share API (jika available) atau copy ke clipboard
 * @returns {Promise<{success: boolean, method: 'native'|'clipboard'|'none', message: string}>}
 */
export const shareProduct = async (product) => {
  const url = getProductShareUrl(product)
  const text = getShareText(product)
  const title = `${product.name} | Bore & Barrel`

  // Try Web Share API first (mobile-friendly)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return { 
        success: true, 
        method: 'native', 
        message: 'Shared successfully!' 
      }
    } catch (err) {
      // User cancelled share dialog
      if (err.name === 'AbortError') {
        return { 
          success: false, 
          method: 'native', 
          message: 'Share cancelled' 
        }
      }
      // Fall through to clipboard
    }
  }

  // Fallback: Copy to clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url)
      return { 
        success: true, 
        method: 'clipboard', 
        message: 'Link copied to clipboard!' 
      }
    }
    
    // Legacy fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    
    return { 
      success: true, 
      method: 'clipboard', 
      message: 'Link copied to clipboard!' 
    }
  } catch (err) {
    return { 
      success: false, 
      method: 'none', 
      message: 'Unable to share. Please copy the URL manually.' 
    }
  }
}
