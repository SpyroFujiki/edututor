import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  avatarFile,
  avatarSource,
  MAX_AVATAR_BYTES,
  readAvatarFile,
} from '../src/services/avatar.js'

test('the file picker and dropped files accept one supported image within the limit', () => {
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
