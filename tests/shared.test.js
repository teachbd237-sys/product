import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, whatsappDigits } from '../shared/phone.js'
import { validateName, validateEmail, detectImageType, isUuid, cleanText, isHttpUrl } from '../shared/validation.js'
import { normalizeCode, formatCode, normalizeLookupSecret, normalizeRequestRef, isValidClientToken, CODE_ALPHABET } from '../shared/codes.js'
import { applicableRequirements } from '../shared/requirements.js'
import { renderTemplate, buildWhatsAppLink } from '../shared/whatsapp.js'
import { validateSettingValue, SETTINGS_SCHEMA } from '../shared/settingsSchema.js'
import { cleanMultiline } from '../shared/validation.js'
import { mergeSettings, DEFAULT_SETTINGS, DEFAULT_WHATSAPP_TEMPLATE } from '../shared/defaults.js'

test('phone: Bangladesh local formats normalize to +880', () => {
  assert.equal(normalizePhone('01712345678').e164, '+8801712345678')
  assert.equal(normalizePhone('017-1234 5678').e164, '+8801712345678')
  assert.equal(normalizePhone('+8801712345678').e164, '+8801712345678')
  assert.equal(normalizePhone('8801712345678').e164, '+8801712345678')
  assert.equal(normalizePhone('008801712345678').e164, '+8801712345678')
  assert.equal(normalizePhone('1712345678').e164, '+8801712345678')
  assert.equal(normalizePhone('০১৭১২৩৪৫৬৭৮').e164, '+8801712345678')
})

test('phone: invalid Bangladesh numbers are rejected', () => {
  assert.equal(normalizePhone('01212345678').ok, false) // 12 অপারেটর কোড নেই
  assert.equal(normalizePhone('0171234567').ok, false) // ১ ডিজিট কম
  assert.equal(normalizePhone('+880171234567890').ok, false)
  assert.equal(normalizePhone('abc').ok, false)
  assert.equal(normalizePhone('').ok, false)
  assert.equal(normalizePhone(null).ok, false)
})

test('phone: international numbers need + or 00', () => {
  assert.equal(normalizePhone('+14155552671').e164, '+14155552671')
  assert.equal(normalizePhone('0014155552671').e164, '+14155552671')
  assert.equal(normalizePhone('+447911123456').e164, '+447911123456')
  assert.equal(normalizePhone('4155552671').ok, false) // কোড ছাড়া অস্পষ্ট
  assert.equal(normalizePhone('+0123456789').ok, false)
  assert.equal(normalizePhone('+1234').ok, false)
  assert.equal(whatsappDigits('+8801712345678'), '8801712345678')
})

test('name and email validation', () => {
  assert.equal(validateName('A').ok, false)
  assert.equal(validateName('রহিম উদ্দিন').ok, true)
  assert.equal(validateName('<script>').ok, false)
  assert.equal(validateName('x'.repeat(200)).ok, false)
  assert.equal(validateEmail(' Test@Example.COM ').value, 'test@example.com')
  assert.equal(validateEmail('no-at-sign').ok, false)
  assert.equal(validateEmail('a@b').ok, false)
  assert.equal(validateEmail('a@b..com').ok, false)
  assert.equal(validateEmail(123).ok, false)
})

test('image magic-byte detection ignores claimed type', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0])
  assert.equal(detectImageType(jpeg), 'image/jpeg')
  assert.equal(detectImageType(png), 'image/png')
  assert.equal(detectImageType(webp), 'image/webp')
  assert.equal(detectImageType(exe), null)
  assert.equal(detectImageType(new Uint8Array(3)), null)
})

test('misc validators', () => {
  assert.equal(isUuid('3f1b3c0e-6f7a-4e2c-9a52-0c1d2e3f4a5b'), true)
  assert.equal(isUuid("1' or '1'='1"), false)
  assert.equal(isHttpUrl('https://youtube.com/@x'), true)
  assert.equal(isHttpUrl('javascript:alert(1)'), false)
  assert.equal(isHttpUrl('ftp://x.com'), false)
  assert.equal(cleanText('  a\u0000  b  '), 'a b')
})

test('code normalization accepts typed variants and rejects junk', () => {
  const body = 'ABCD2345EFGH6789'.replace(/[^0-9A-Z]/g, '')
  const shown = formatCode(body)
  assert.match(shown, /^SF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  assert.equal(normalizeCode(shown), body)
  assert.equal(normalizeCode(shown.toLowerCase()), body)
  assert.equal(normalizeCode(shown.replace(/-/g, ' ')), body)
  assert.equal(normalizeCode(body), body) // Prefix ছাড়াও চলবে
  assert.equal(normalizeCode('SF-0000-0000-0000-000'), null)
  assert.equal(normalizeCode('SF-' + 'U'.repeat(16)), null) // U Alphabet-এ নেই
  assert.equal(normalizeCode(null), null)
  assert.equal(normalizeCode("SF-'; drop table"), null)
  // O/I/L সংশোধন
  assert.equal(normalizeCode('SF-OOOO-IIII-LLLL-0011'), '0000' + '1111' + '1111' + '0011')
  assert.equal(CODE_ALPHABET.length, 32)
})

test('lookup secret, request ref and client token shapes', () => {
  assert.equal(normalizeLookupSecret('abcd-2345-efgh-6789'), 'ABCD2345EFGH6789')
  assert.equal(normalizeLookupSecret('short'), null)
  assert.equal(normalizeRequestRef('sf-r7k2m9qxa'), 'SF-R7K2M9QXA')
  assert.equal(normalizeRequestRef('SF-1234'), null)
  assert.equal(isValidClientToken('a'.repeat(43)), true)
  assert.equal(isValidClientToken('short'), false)
  assert.equal(isValidClientToken('a'.repeat(43) + '!'), false)
})

test('applicable requirements follow product verification_mode', () => {
  const g1 = { id: 'g1', is_enabled: true, product_id: null, sort_order: 2 }
  const g2 = { id: 'g2', is_enabled: true, product_id: null, sort_order: 1 }
  const gOff = { id: 'g3', is_enabled: false, product_id: null, sort_order: 0 }
  const p1 = { id: 'p1x', is_enabled: true, product_id: 'P1', sort_order: 5 }
  const other = { id: 'o1', is_enabled: true, product_id: 'P2', sort_order: 0 }
  const all = [g1, g2, gOff, p1, other]
  const ids = (m) => applicableRequirements({ id: 'P1', verification_mode: m }, all).map((r) => r.id)
  assert.deepEqual(ids('global'), ['g2', 'g1'])
  assert.deepEqual(ids('custom'), ['p1x'])
  assert.deepEqual(ids('combined'), ['g2', 'g1', 'p1x'])
  assert.deepEqual(ids('none'), [])
  assert.deepEqual(applicableRequirements({ id: 'P1' }, all).map((r) => r.id), ['g2', 'g1'])
})

test('whatsapp message template + link encoding', () => {
  const msg = renderTemplate(DEFAULT_WHATSAPP_TEMPLATE, {
    customer_name: 'রহিম', product_name: 'Glitch Pack', code: 'SF-AAAA-BBBB-CCCC-DDDD',
    product_url: 'https://x.test/product/glitch', website_name: 'Story Frame',
  })
  assert.ok(msg.includes('SF-AAAA-BBBB-CCCC-DDDD'))
  assert.ok(msg.includes('Glitch Pack'))
  assert.ok(!/\{(customer_name|product_name|code|product_url|website_name)\}/.test(msg))
  const link = buildWhatsAppLink('+8801712345678', msg)
  assert.ok(link.startsWith('https://wa.me/8801712345678?text='))
  assert.ok(!link.includes(' ') && !link.includes('\n'))
  assert.equal(decodeURIComponent(link.split('?text=')[1]), msg)
})

test('settings validation', () => {
  const helpers = { cleanText, cleanMultiline, isHttpUrl, validateEmail }
  assert.equal(validateSettingValue('nope', 'x', helpers).ok, false)
  assert.equal(validateSettingValue('social_youtube', 'javascript:alert(1)', helpers).ok, false)
  assert.equal(validateSettingValue('social_youtube', 'https://youtube.com/@a', helpers).ok, true)
  assert.equal(validateSettingValue('social_youtube', '', helpers).ok, true)
  assert.equal(validateSettingValue('whatsapp_template', 'কোড নেই', helpers).ok, false)
  assert.equal(validateSettingValue('whatsapp_template', 'কোড: {code}', helpers).ok, true)
  assert.equal(validateSettingValue('site_name', 'x'.repeat(100), helpers).ok, false)
  assert.equal(validateSettingValue('contact_email', 'bad', helpers).ok, false)
  const faq = validateSettingValue('faq', [{ q: 'প্রশ্ন', a: 'উত্তর' }, { q: '', a: 'x' }], helpers)
  assert.equal(faq.value.length, 1)
  assert.equal(validateSettingValue('faq', new Array(20).fill({ q: 'a', a: 'b' }), helpers).ok, false)
  // প্রতিটি Schema Key-এর Default আছে
  for (const k of Object.keys(SETTINGS_SCHEMA)) assert.ok(k in DEFAULT_SETTINGS, `default missing: ${k}`)
})

test('mergeSettings keeps defaults for blank values', () => {
  const m = mergeSettings([
    { key: 'site_name', value: 'My Store' },
    { key: 'hero_title', value: '   ' },
    { key: 'faq', value: [] },
    { key: 'unknown_key', value: 'x' },
  ])
  assert.equal(m.site_name, 'My Store')
  assert.equal(m.hero_title, DEFAULT_SETTINGS.hero_title)
  assert.equal(m.faq.length, DEFAULT_SETTINGS.faq.length)
  assert.equal('unknown_key' in m, false)
})
