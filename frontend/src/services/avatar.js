export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function avatarFile(files) {
  if (files.length !== 1) throw new Error('Vui lòng chọn một ảnh mỗi lần.')
  const file = files[0]
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('Vui lòng chọn ảnh PNG, JPEG hoặc WebP.')
  if (!file.size || file.size > MAX_AVATAR_BYTES)
    throw new Error('Ảnh phải có dung lượng từ 1 byte đến 2 MB.')
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
