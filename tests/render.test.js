// পেজগুলো Server-side Render করে দেখা — Import/Render Error থাকলে এখানে ধরা পড়ে।
// (useEffect চলে না, তাই এটি শুধু প্রথম অবস্থার Render পরীক্ষা করে; আসল Browser পরীক্ষা Live Site-এ করতে হবে।)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'

process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'anon'

let vite
test.before(async () => { vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' }) })
test.after(async () => { await vite.close() })

async function render(path) {
  const App = (await vite.ssrLoadModule('/src/App.jsx')).default
  const { SettingsProvider } = await vite.ssrLoadModule('/src/lib/settings.jsx')
  return renderToString(React.createElement(StaticRouter, { location: path }, React.createElement(SettingsProvider, null, React.createElement(App))))
}

test('public routes render', async () => {
  for (const p of ['/', '/product/x', '/request/x', '/request-status', '/request-status/SF-RAAAAAAAA', '/nope']) {
    const html = await render(p)
    assert.ok(html.length > 200, p)
    assert.ok(html.includes('Story Frame'), `${p} should show site name`)
  }
})

test('request status page shows Bangla form; old bKash words are gone from public pages', async () => {
  const html = await render('/request-status')
  assert.ok(html.includes('রিকোয়েস্ট স্ট্যাটাস'))
  for (const p of ['/', '/request-status']) {
    const h = (await render(p)).toLowerCase()
    for (const bad of ['bkash', 'transaction id', 'payment screenshot', 'send money']) assert.ok(!h.includes(bad), `${p} still mentions ${bad}`)
  }
})

test('admin login renders; protected admin redirects (no admin UI leaks to logged-out render)', async () => {
  const login = await render('/admin/login')
  assert.ok(login.includes('Admin Login'))
  const dash = await render('/admin')
  assert.ok(!dash.includes('ওভারভিউ'))
})

test('no leftover bKash code in source', async () => {
  const { execSync } = await import('node:child_process')
  const out = execSync("grep -rIil 'bkash' src netlify shared index.html || true").toString().trim()
  assert.equal(out, '', `bKash references remain in: ${out}`)
})
