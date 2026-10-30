// WhatsApp / ফোন নম্বর normalize ও validate করার Shared Code।
// Frontend (লাইভ ফিডব্যাক) এবং Netlify Function (আসল যাচাই) — দুই জায়গাতেই এই একই ফাইল ব্যবহার হয়।
// Output সবসময় E.164 format: +8801XXXXXXXXX

export const DEFAULT_COUNTRY_CODE = '880'

export function normalizePhone(input, defaultCountry = DEFAULT_COUNTRY_CODE) {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid' }

  // বাংলা ডিজিট (০-৯) কে ইংরেজি ডিজিটে রূপান্তর
  const bn = '০১২৩৪৫৬৭৮৯'
  let s = input
    .trim()
    .replace(/[০-৯]/g, (d) => String(bn.indexOf(d)))
    .replace(/[\s\-().]/g, '')

  if (!s) return { ok: false, reason: 'empty' }
  if (!/^\+?\d+$/.test(s)) return { ok: false, reason: 'invalid' }

  let digits
  if (s.startsWith('+')) {
    digits = s.slice(1)
  } else if (s.startsWith('00')) {
    digits = s.slice(2)
  } else if (s.startsWith('0')) {
    // স্থানীয় নম্বর (যেমন 01712345678) -> ডিফল্ট দেশের কোড বসবে
    digits = defaultCountry + s.slice(1)
  } else if (s.startsWith(defaultCountry)) {
    digits = s
  } else if (defaultCountry === '880' && /^1[3-9]\d{8}$/.test(s)) {
    // 1712345678 (শুরুতে 0 ছাড়া বাংলাদেশি নম্বর)
    digits = '880' + s
  } else {
    // কোনো দেশের কোড ছাড়া অন্য নম্বর: অস্পষ্ট, তাই + ছাড়া International ধরা হবে না
    return { ok: false, reason: 'ambiguous' }
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return { ok: false, reason: 'invalid' }

  if (digits.startsWith('880')) {
    // বাংলাদেশি মোবাইল: 880 + 1[3-9] + ৮ ডিজিট
    if (!/^8801[3-9]\d{8}$/.test(digits)) return { ok: false, reason: 'invalid_bd' }
  }

  return { ok: true, e164: '+' + digits, digits }
}

// wa.me লিংকে + ছাড়া শুধু ডিজিট লাগে
export function whatsappDigits(e164) {
  return String(e164 || '').replace(/\D/g, '')
}
