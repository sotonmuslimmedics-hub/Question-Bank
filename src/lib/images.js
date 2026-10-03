import { supabase } from './supabase'

// All image storage details live in this file. To move images to another host
// (for example Cloudflare R2) later, change imageUrl() and uploadImage() only.
const BUCKET = 'question-images'
const MAX_SIDE = 1600
const QUALITY = 0.82

export function imageUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Shrinks the picture in the browser and compresses it, so uploads stay small
// (typically 100-400 KB) and students use less data.
//
// Some browsers' canvas (notably Safari/iOS, at least on older versions)
// silently ignore a request to encode as WebP and hand back a full-size,
// uncompressed PNG instead — no error, nothing to catch, just a blob that
// quietly isn't what was asked for. That's how some uploads ended up
// ~1-2MB instead of the usual couple hundred KB. So we check what we
// actually got back and fall back to JPEG — compressed, and supported
// essentially everywhere canvas.toBlob exists at all — when WebP wasn't
// honoured.
export async function resizeToWebp(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)

  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
  let format = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    format = 'jpeg'
  }
  if (!blob) throw new Error('Could not process that image. Try a JPG or PNG.')
  return { blob, format }
}

export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).')
  const { blob, format } = await resizeToWebp(file)
  const ext = format === 'webp' ? 'webp' : 'jpg'
  const path = `questions/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: `image/${format}`,
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

export async function deleteImage(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path]) // best effort
}
