// কোন Product-এর জন্য কোন Social Requirement প্রযোজ্য — Frontend ও Server একই নিয়ম ব্যবহার করে।
//
// products.verification_mode:
//   'global'   -> শুধু Global Requirement (product_id = null)
//   'custom'   -> শুধু এই Product-এর নিজস্ব Requirement (Global বাদ)
//   'combined' -> Global + এই Product-এর নিজস্ব
//   'none'     -> কোনো Requirement নেই

export function applicableRequirements(product, all) {
  if (!product) return []
  const mode = product.verification_mode || 'global'
  if (mode === 'none') return []
  const enabled = (all || []).filter((r) => r.is_enabled)
  const globals = enabled.filter((r) => !r.product_id)
  const own = enabled.filter((r) => r.product_id === product.id)
  let list
  if (mode === 'custom') list = own
  else if (mode === 'combined') list = [...globals, ...own]
  else list = globals
  return [...list].sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at || '').localeCompare(String(b.created_at || '')))
}

export const PLATFORMS = {
  facebook_profile: 'Facebook Profile',
  facebook_page: 'Facebook Page',
  facebook_group: 'Facebook Group',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  website: 'Website',
  other: 'অন্যান্য',
}
