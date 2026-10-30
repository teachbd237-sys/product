// Build শুরুর আগে Node ভার্সন যাচাই। ভুল ভার্সনে Build-ই ব্যর্থ হবে (আগে Build সফল হতো, কিন্তু Production-এ
// admin-api ক্র্যাশ করত — "native WebSocket not found")। তাই সমস্যাটি এখন Deploy-এর সময়েই ধরা পড়ে।
const major = Number(process.versions.node.split('.')[0])
const REQUIRED = 22
if (major < REQUIRED) {
  console.error(`
✖ Node.js ${process.versions.node} দিয়ে Build করা যাবে না। কমপক্ষে Node ${REQUIRED} লাগবে।
  কারণ: @supabase/supabase-js এখন Node ${REQUIRED}+ ছাড়া Netlify Function-এ ক্র্যাশ করে, এবং
        Netlify Functions-এর Runtime Build-এর Node ভার্সন থেকেই ঠিক হয়।
  সমাধান: netlify.toml-এ  NODE_VERSION = "${REQUIRED}"  আছে কিনা দেখুন (এটি Dashboard-এর মানকে Override করে)।
          Dashboard > Site configuration > Environment variables-এও NODE_VERSION মুছে ফেলা/22 রাখা যায়।
`)
  process.exit(1)
}
console.log(`✔ Node ${process.versions.node} (>= ${REQUIRED}) ঠিক আছে।`)
