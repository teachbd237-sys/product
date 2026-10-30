import { db } from './supabase.js'

export async function audit(entry) {
  try {
    const { error } = await db().from('download_audit_logs').insert({
      actor_type: entry.actorType || 'system',
      actor_id: entry.actorId || null,
      action: entry.action,
      request_id: entry.requestId || null,
      code_id: entry.codeId || null,
      product_id: entry.productId || null,
      ip_hash: entry.ipHash || null,
      meta: entry.meta || {},
    })
    if (error) console.error('[audit]', error.message)
  } catch (e) {
    console.error('[audit]', e?.message)
  }
}
