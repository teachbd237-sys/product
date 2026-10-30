import { whatsappDigits } from './phone.js'

// {placeholder} বসিয়ে মেসেজ তৈরি। অজানা Placeholder যেমন আছে তেমনই থাকবে।
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{(customer_name|product_name|code|product_url|website_name)\}/g, (_, k) => vars[k] ?? '')
}

// https://wa.me/<digits>?text=<percent-encoded>
export function buildWhatsAppLink(e164, message) {
  return `https://wa.me/${whatsappDigits(e164)}?text=${encodeURIComponent(message)}`
}
