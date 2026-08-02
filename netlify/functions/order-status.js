// এই Function Order Status Check করে এবং Payment Approved হলে
// Supabase Storage থেকে একটি সাময়িক (Signed) Download Link তৈরি করে দেয়।
//
// এখানে Service Role Key ব্যবহার করা হয়েছে বলেই এটি Netlify Function-এর ভিতরে রাখা হয়েছে,
// কারণ এই Key কখনোই Frontend Code-এ রাখা যাবে না।

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { orderCode, email } = JSON.parse(event.body || '{}')

    if (!orderCode || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Order ID এবং Email দুটোই প্রয়োজন।' }) }
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, customer_email, product_id, products ( name, version, file_path )')
      .eq('order_code', orderCode.toUpperCase())
      .maybeSingle()

    if (error || !order) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order খুঁজে পাওয়া যায়নি।' }) }
    }

    if (order.customer_email.toLowerCase() !== email.toLowerCase()) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Email Address মিলছে না।' }) }
    }

    const response = {
      status: order.status,
      productName: order.products?.name,
      productVersion: order.products?.version,
    }

    if (order.status === 'approved' && order.products?.file_path) {
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from('product-files')
        .createSignedUrl(order.products.file_path, 60 * 10) // 10 minutes valid

      if (signError) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Download Link তৈরি করা যায়নি।' }) }
      }
      response.downloadUrl = signed.signedUrl
    }

    return { statusCode: 200, body: JSON.stringify(response) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
