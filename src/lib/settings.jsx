import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { DEFAULT_SETTINGS, mergeSettings } from '../../shared/defaults.js'

const Ctx = createContext({ s: DEFAULT_SETTINGS, ready: false, reload: () => {} })
export const useSettings = () => useContext(Ctx)

export function SettingsProvider({ children }) {
  const [s, setS] = useState(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  async function load() {
    // RLS: Public শুধু is_public = true সেটিংস পড়তে পারে (WhatsApp টেমপ্লেট নয়)
    const { data } = await supabase.from('website_settings').select('key, value').eq('is_public', true)
    setS(mergeSettings(data || []))
    setReady(true)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    document.title = `${s.site_name} — ফ্রি ডাউনলোড`
    if (s.favicon_url) {
      let link = document.querySelector("link[rel='icon']")
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.removeAttribute('type')
      link.href = s.favicon_url
    }
  }, [s.site_name, s.favicon_url])

  return <Ctx.Provider value={{ s, ready, reload: load }}>{children}</Ctx.Provider>
}
