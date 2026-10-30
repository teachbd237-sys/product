// Screenshot ছোট করে (সর্বোচ্চ ১৬০০px, JPEG) Base64 বানানো — Netlify-র ৬MB সীমার মধ্যে থাকতে।
export async function prepareScreenshot(file) {
  if (!file) throw new Error('কোনো ফাইল বাছাই করা হয়নি।')
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবি (JPG / PNG / WEBP) আপলোড করুন।')
  if (file.size > 15 * 1024 * 1024) throw new Error('ছবিটি অনেক বড় (সর্বোচ্চ ১৫ MB)।')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('ছবিটি পড়া যায়নি। JPG বা PNG ছবি দিন।'))
      i.src = url
    })
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob) throw new Error('ছবিটি প্রসেস করা যায়নি।')
    if (blob.size > 2.4 * 1024 * 1024) throw new Error('ছবিটি এখনো বড়। ছোট রেজুলিউশনের স্ক্রিনশট নিন।')
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1])
      r.onerror = () => reject(new Error('ছবিটি পড়া যায়নি।'))
      r.readAsDataURL(blob)
    })
    return { data, preview: URL.createObjectURL(blob), name: file.name, size: blob.size }
  } finally {
    URL.revokeObjectURL(url)
  }
}
