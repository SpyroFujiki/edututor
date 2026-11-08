export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const MAX_AVATAR_PIXELS = 4096 * 4096
const MAX_STORED_AVATAR_DATA_LENGTH = 2796244
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function avatarFile(files) {
  if (files.length !== 1) throw new Error('Vui lòng chọn một ảnh mỗi lần.')
  const file = files[0]
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('Vui lòng chọn ảnh PNG, JPEG hoặc WebP.')
  if (!file.size || file.size > MAX_AVATAR_BYTES)
    throw new Error('Ảnh phải có dung lượng từ 1 byte đến 5 MB.')
  return file
}

export function readAvatarFile(file, Reader = globalThis.FileReader) {
  return new Promise((resolve, reject) => {
    if (!Reader) return reject(new Error('Chưa đọc được ảnh trên trình duyệt này.'))
    const reader = new Reader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Không đọc được ảnh đã chọn.'))
    reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn. Vui lòng thử lại.'))
    reader.onabort = () => reject(new Error('Đã hủy đọc ảnh.'))
    reader.readAsDataURL(file)
  })
}

export function avatarSource(value) {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value)
    ? value
    : null
}

async function decodeAvatarFile(file) {
  if (globalThis.createImageBitmap)
    return globalThis.createImageBitmap(file, { imageOrientation: 'from-image' })
  const source = await readAvatarFile(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'))
    image.src = source
  })
}

export async function prepareAvatarFile(
  file,
  { decode = decodeAvatarFile, createCanvas = () => document.createElement('canvas') } = {},
) {
  avatarFile([file])
  let image
  try {
    image = await decode(file)
  } catch {
    throw new Error('Không đọc được ảnh. Vui lòng chọn ảnh PNG, JPEG hoặc WebP hợp lệ.')
  }
  try {
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > MAX_AVATAR_PIXELS
    )
      throw new Error('Ảnh có độ phân giải quá lớn; vui lòng chọn ảnh nhỏ hơn.')
    const scale = Math.min(1, 512 / width, 512 / height)
    const canvas = createCanvas()
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Chưa xử lý được ảnh trên trình duyệt này. Vui lòng thử lại.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const value = canvas.toDataURL('image/webp', 0.85)
    if (!avatarSource(value) || value.length > MAX_STORED_AVATAR_DATA_LENGTH)
      throw new Error('Chưa thu nhỏ được ảnh. Vui lòng chọn ảnh khác.')
    return value
  } finally {
    image.close?.()
  }
}
