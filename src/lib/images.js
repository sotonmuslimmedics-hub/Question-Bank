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

// Shrinks the picture in the browser and converts it to WebP, so uploads stay small
// (typically 100-400 KB) and students use less data.
export async function resizeToWebp(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
  if (!blob) throw new Error('Could not process that image. Try a JPG or PNG.')
  return blob
}

export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).')
  const blob = await resizeToWebp(file)
  const path = `questions/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

export async function deleteImage(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path]) // best effort
}
