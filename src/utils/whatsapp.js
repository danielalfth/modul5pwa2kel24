// ---------------------------------------------------------------------------
// WhatsApp helper — format seller contact link
// ---------------------------------------------------------------------------

// ponytail: default number untuk demo, production bisa dari env/database per produk
const DEFAULT_SELLER_PHONE = '6281234567890' // Format: country code tanpa +

/**
 * Generate WhatsApp link untuk menghubungi penjual
 * @param {Object} product - Product data
 * @param {string} [customPhone] - Custom phone number (override default)
 */
export const getWhatsAppLink = (product, customPhone) => {
  const phone = customPhone || DEFAULT_SELLER_PHONE
  const message = `Hi, saya tertarik dengan *${product.name}*${product.type ? ` (${product.type})` : ''}. Bisakah saya mendapat info lebih lanjut?`
  
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

/**
 * Open WhatsApp in new tab/window
 */
export const openWhatsApp = (product, customPhone) => {
  const url = getWhatsAppLink(product, customPhone)
  window.open(url, '_blank', 'noopener,noreferrer')
}
