// ---------------------------------------------------------------------------
// WhatsApp helper — generate wa.me link
// ponytail: pure function, no side effects — caller decides how to open
// ---------------------------------------------------------------------------

// Default seller number. Format: country code tanpa + (e.g. 62 untuk Indonesia)
const DEFAULT_SELLER_PHONE = '6281234567890'

/**
 * Generate WhatsApp URL untuk produk.
 * @param {Object} product
 * @param {string} [customPhone]
 * @returns {string} wa.me URL
 */
export const getWhatsAppLink = (product, customPhone) => {
  const phone = customPhone || DEFAULT_SELLER_PHONE
  const message = `Halo, saya tertarik dengan *${product.name}*${product.type ? ` (${product.type})` : ''}. Boleh minta info lebih lanjut?`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
