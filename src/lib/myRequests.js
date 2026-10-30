// গ্রাহকের নিজের Browser-এ রিকোয়েস্ট Reference ও Status Key সংরক্ষণ (শুধু এই ডিভাইসে, সার্ভারে নয়)।
const K = 'sf_my_requests'
export function listMine() { try { return JSON.parse(localStorage.getItem(K) || '[]') } catch { return [] } }
export function saveMine(entry) {
  try {
    const rest = listMine().filter((x) => x.ref !== entry.ref)
    localStorage.setItem(K, JSON.stringify([entry, ...rest].slice(0, 10)))
  } catch { /* ignore */ }
}
