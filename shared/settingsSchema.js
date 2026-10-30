// Admin Settings-এর সব Field এখানে Define করা। Admin Panel-এর Form এবং Server-এর Validation —
// দুটোই এই একটি ফাইল থেকে চলে, তাই নতুন Setting যোগ করতে এখানে একটি লাইন বাড়ালেই হয়।
// type: text | longtext | url | email | image | json_faq | json_steps
// public: false হলে Public Website কখনো এটি পড়তে পারে না।

export const SETTING_GROUPS = [
  { id: 'general', title: 'সাধারণ সেটিংস' },
  { id: 'home', title: 'হোমপেজের লেখা' },
  { id: 'social', title: 'সোশ্যাল মিডিয়া লিংক' },
  { id: 'download', title: 'ডাউনলোড ও মেসেজ সেটিংস' },
  { id: 'whatsapp', title: 'WhatsApp মেসেজ টেমপ্লেট' },
  { id: 'content', title: 'ধাপ ও FAQ' },
]

export const SETTINGS_SCHEMA = {
  site_name: { group: 'general', label: 'ওয়েবসাইটের নাম', type: 'text', max: 60, public: true },
  site_tagline: { group: 'general', label: 'ট্যাগলাইন', type: 'text', max: 140, public: true },
  logo_url: { group: 'general', label: 'লোগো', type: 'image', public: true },
  favicon_url: { group: 'general', label: 'Favicon', type: 'image', public: true },
  contact_email: { group: 'general', label: 'যোগাযোগের ইমেইল', type: 'email', public: true },
  support_whatsapp: { group: 'general', label: 'Support WhatsApp নম্বর (+880…)', type: 'text', max: 20, public: true },
  footer_description: { group: 'general', label: 'Footer-এর বর্ণনা', type: 'longtext', max: 300, public: true },

  hero_title: { group: 'home', label: 'Hero শিরোনাম', type: 'longtext', max: 160, public: true },
  hero_subtitle: { group: 'home', label: 'Hero সাবটাইটেল', type: 'longtext', max: 300, public: true },
  home_description: { group: 'home', label: 'হোমপেজের বর্ণনা (প্রোডাক্ট লিস্টের উপরে)', type: 'longtext', max: 300, public: true },

  social_facebook: { group: 'social', label: 'Facebook লিংক', type: 'url', public: true },
  social_youtube: { group: 'social', label: 'YouTube লিংক', type: 'url', public: true },
  social_instagram: { group: 'social', label: 'Instagram লিংক', type: 'url', public: true },
  social_group: { group: 'social', label: 'Facebook Group লিংক', type: 'url', public: true },

  cta_label: { group: 'download', label: 'ডাউনলোড বাটনের লেখা', type: 'text', max: 40, public: true },
  form_heading: { group: 'download', label: 'রিকোয়েস্ট ফর্মের শিরোনাম', type: 'text', max: 100, public: true },
  form_instructions: { group: 'download', label: 'রিকোয়েস্ট ফর্মের নির্দেশনা', type: 'longtext', max: 400, public: true },
  msg_submitted: { group: 'download', label: 'রিকোয়েস্ট জমা হওয়ার মেসেজ', type: 'longtext', max: 400, public: true },
  msg_pending: { group: 'download', label: 'Pending মেসেজ', type: 'longtext', max: 400, public: true },
  msg_approved: { group: 'download', label: 'Approved মেসেজ (কোড এখনো পাঠানো হয়নি)', type: 'longtext', max: 400, public: true },
  msg_approved_sent: { group: 'download', label: 'Approved মেসেজ (কোড পাঠানো হয়েছে)', type: 'longtext', max: 400, public: true },
  msg_rejected: { group: 'download', label: 'Rejected মেসেজ', type: 'longtext', max: 400, public: true },
  msg_invalid_code: { group: 'download', label: 'ভুল কোডের মেসেজ', type: 'longtext', max: 300, public: true },
  msg_used_code: { group: 'download', label: 'ব্যবহৃত কোডের মেসেজ', type: 'longtext', max: 300, public: true },
  msg_revoked_code: { group: 'download', label: 'বাতিল কোডের মেসেজ', type: 'longtext', max: 300, public: true },
  msg_download_success: { group: 'download', label: 'সফল ডাউনলোডের মেসেজ', type: 'longtext', max: 300, public: true },

  whatsapp_template: { group: 'whatsapp', label: 'WhatsApp মেসেজ টেমপ্লেট', type: 'longtext', max: 2000, public: false },

  how_steps: { group: 'content', label: 'কীভাবে কাজ করে (ধাপসমূহ)', type: 'json_steps', public: true },
  faq: { group: 'content', label: 'সাধারণ প্রশ্নোত্তর (FAQ)', type: 'json_faq', public: true },
}

export const TEMPLATE_PLACEHOLDERS = ['{customer_name}', '{product_name}', '{code}', '{product_url}', '{website_name}']

// Server-এ Validate: ভুল হলে { ok:false, error } , ঠিক হলে { ok:true, value }
export function validateSettingValue(key, raw, helpers) {
  const def = SETTINGS_SCHEMA[key]
  if (!def) return { ok: false, error: `অজানা সেটিং: ${key}` }
  const { cleanText, cleanMultiline, isHttpUrl, validateEmail } = helpers

  switch (def.type) {
    case 'text': {
      const v = cleanText(raw, def.max + 1)
      if (v.length > def.max) return { ok: false, error: `${def.label}: সর্বোচ্চ ${def.max} অক্ষর` }
      return { ok: true, value: v }
    }
    case 'longtext': {
      const v = cleanMultiline(raw, def.max + 1)
      if (v.length > def.max) return { ok: false, error: `${def.label}: সর্বোচ্চ ${def.max} অক্ষর` }
      if (key === 'whatsapp_template' && !v.includes('{code}')) {
        return { ok: false, error: 'টেমপ্লেটে অবশ্যই {code} থাকতে হবে।' }
      }
      return { ok: true, value: v }
    }
    case 'url':
    case 'image': {
      const v = typeof raw === 'string' ? raw.trim() : ''
      if (!v) return { ok: true, value: '' }
      if (v.length > 500 || !isHttpUrl(v)) return { ok: false, error: `${def.label}: সঠিক https লিংক দিন` }
      return { ok: true, value: v }
    }
    case 'email': {
      const v = typeof raw === 'string' ? raw.trim() : ''
      if (!v) return { ok: true, value: '' }
      const r = validateEmail(v)
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: `${def.label}: সঠিক ইমেইল দিন` }
    }
    case 'json_steps': {
      if (!Array.isArray(raw) || raw.length > 8) return { ok: false, error: 'ধাপ: সর্বোচ্চ ৮টি' }
      const out = raw
        .map((s) => ({ title: cleanText(s?.title, 80), text: cleanText(s?.text, 240) }))
        .filter((s) => s.title)
      return { ok: true, value: out }
    }
    case 'json_faq': {
      if (!Array.isArray(raw) || raw.length > 12) return { ok: false, error: 'FAQ: সর্বোচ্চ ১২টি' }
      const out = raw
        .map((s) => ({ q: cleanText(s?.q, 160), a: cleanMultiline(s?.a, 600) }))
        .filter((s) => s.q && s.a)
      return { ok: true, value: out }
    }
    default:
      return { ok: false, error: 'অজানা ধরন' }
  }
}
