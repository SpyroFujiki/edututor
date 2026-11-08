import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  avatarFile,
  avatarSource,
  MAX_AVATAR_BYTES,
  readAvatarFile,
  prepareAvatarFile,
} from '../src/services/avatar.js'

test('the file picker and dropped files accept one supported image within the limit', () => {
  assert.equal(MAX_AVATAR_BYTES, 5 * 1024 * 1024)
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    const file = { type, size: MAX_AVATAR_BYTES, name: 'avatar' }
    assert.equal(avatarFile([file]), file)
  }
  for (const files of [
    [],
    [{ type: 'image/png', size: 0 }],
    [{ type: 'image/png', size: MAX_AVATAR_BYTES + 1 }],
    [{ type: 'image/svg+xml', size: 100 }],
    [{ type: '', size: 100 }],
    [
      { type: 'image/png', size: 1 },
      { type: 'image/jpeg', size: 1 },
    ],
  ]) {
    assert.throws(() => avatarFile(files))
  }
})

test('a five MiB image is resized before creating the base64 request payload', async () => {
  const file = { type: 'image/png', size: 5 * 1024 * 1024 }
  let closed = false
  const image = {
    width: 1536,
    height: 3072,
    close: () => {
      closed = true
    },
  }
  const canvas = {
    getContext: () => ({ drawImage: (...args) => assert.deepEqual(args, [image, 0, 0, 256, 512]) }),
    toDataURL: (type, quality) => {
      assert.equal(type, 'image/webp')
      assert.equal(quality, 0.85)
      return 'data:image/webp;base64,YWJj'
    },
  }
  const result = await prepareAvatarFile(file, {
    decode: async (value) => {
      assert.equal(value, file)
      return image
    },
    createCanvas: () => canvas,
  })
  assert.equal(result, 'data:image/webp;base64,YWJj')
  assert.equal(canvas.width, 256)
  assert.equal(canvas.height, 512)
  assert.equal(closed, true)
})

test('invalid image contents, excessive resolution and unavailable encoding do not produce an upload', async () => {
  const file = { type: 'image/png', size: 100 }
  await assert.rejects(
    prepareAvatarFile(file, {
      decode: async () => {
        throw new Error('decode failure')
      },
    }),
    /Không đọc được ảnh/,
  )
  let closed = false
  await assert.rejects(
    prepareAvatarFile(file, {
      decode: async () => ({
        width: 5000,
        height: 5000,
        close: () => {
          closed = true
        },
      }),
    }),
    /độ phân giải quá lớn/,
  )
  assert.equal(closed, true)
  await assert.rejects(
    prepareAvatarFile(file, {
      decode: async () => ({ width: 20, height: 20 }),
      createCanvas: () => ({ getContext: () => null }),
    }),
    /Chưa xử lý được ảnh/,
  )
})

test('selected or dropped image bytes are read as a data URL', async () => {
  const file = { type: 'image/png', size: 3 }
  class Reader {
    readAsDataURL(value) {
      assert.equal(value, file)
      this.result = 'data:image/png;base64,YWJj'
      this.onload()
    }
  }
  assert.equal(await readAvatarFile(avatarFile([file]), Reader), 'data:image/png;base64,YWJj')
})

test('file read failures and cancellation reject without a stale preview result', async () => {
  class FailedReader {
    readAsDataURL() {
      this.onerror()
    }
  }
  class AbortedReader {
    readAsDataURL() {
      this.onabort()
    }
  }
  await assert.rejects(readAvatarFile({}, FailedReader), /Không đọc được ảnh/)
  await assert.rejects(readAvatarFile({}, AbortedReader), /hủy đọc ảnh/)
})

test('avatar rendering accepts raster data URLs and never external or executable sources', () => {
  for (const type of ['png', 'jpeg', 'webp'])
    assert.equal(avatarSource(`data:image/${type};base64,YWJj`), `data:image/${type};base64,YWJj`)
  for (const value of [
    null,
    undefined,
    '',
    'https://example.com/user.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ]) {
    assert.equal(avatarSource(value), null)
  }
})
