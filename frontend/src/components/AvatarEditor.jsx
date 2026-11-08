import { useEffect, useId, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import ContentDialog from './ContentDialog.jsx'
import Icon from './Icon.jsx'
import { avatarFile, AVATAR_TYPES, prepareAvatarFile } from '../services/avatar.js'

export default function AvatarEditor({ api, user, onProfileChange }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <>
      <div className="profile-avatar-row">
        <Avatar user={user} className="avatar-profile" />
        <div>
          <strong>Ảnh đại diện</strong>
          <p>Thêm một hình ảnh để tài khoản mang dấu ấn của bạn.</p>
          <button
            type="button"
            onClick={() => {
              setMessage('')
              setOpen(true)
            }}
          >
            <Icon name="edit" size={16} />
            Đổi ảnh đại diện
          </button>
        </div>
      </div>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {open && (
        <AvatarDialog
          api={api}
          user={user}
          onClose={() => setOpen(false)}
          onSaved={(updated) => {
            onProfileChange(updated)
            setOpen(false)
            setMessage('Đã cập nhật ảnh đại diện.')
          }}
        />
      )}
    </>
  )
}

export function AvatarDialog({ api, user, onClose, onSaved }) {
  const [draft, setDraft] = useState(user.avatar_base64 ?? null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selection = useRef(0)
  const dragDepth = useRef(0)
  const lock = useRef(false)
  const active = useRef(true)
  const hintId = useId()
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      selection.current += 1
    }
  }, [])

  async function choose(files) {
    if (lock.current) return
    const version = ++selection.current
    setError('')
    setReading(true)
    try {
      const file = avatarFile(Array.from(files))
      const value = await prepareAvatarFile(file)
      if (version === selection.current) setDraft(value)
    } catch (failure) {
      if (version === selection.current) setError(failure.message)
    } finally {
      if (version === selection.current) setReading(false)
    }
  }

  async function save() {
    if (lock.current || reading) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const updated = await api.request('/auth/profile', {
        method: 'PATCH',
        body: { avatar_base64: draft },
      })
      if (active.current) onSaved(updated)
    } catch (failure) {
      if (active.current) setError(failure.message)
    } finally {
      lock.current = false
      if (active.current) setBusy(false)
    }
  }

  return (
    <ContentDialog title="ẢNH ĐẠI DIỆN" className="avatar-editor-dialog" onClose={onClose}>
      <h2>Một hình ảnh của riêng bạn.</h2>
      <p className="dialog-description">
        Chọn ảnh mới hoặc kéo và thả vào vùng bên dưới. Bạn có thể xem trước khi lưu.
      </p>
      <label
        className={`avatar-dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          choose(event.dataTransfer.files)
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept={AVATAR_TYPES.join(',')}
          disabled={busy}
          aria-label="Chọn ảnh đại diện"
          aria-describedby={hintId}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files)
            event.currentTarget.value = ''
            if (files.length) choose(files)
          }}
        />
        <span className="avatar-dropzone-icon">
          <Icon name="upload" size={25} />
        </span>
        <strong>
          {reading
            ? 'Đang xử lý ảnh…'
            : dragging
              ? 'Thả ảnh để xem trước'
              : 'Kéo và thả ảnh vào đây'}
        </strong>
        <span>
          hoặc <span className="avatar-file-link">chọn ảnh từ thiết bị</span>
        </span>
        <small id={hintId}>PNG, JPEG hoặc WebP · Tối đa 5 MB</small>
      </label>
      <div className="avatar-preview-row">
        <Avatar user={{ ...user, avatar_base64: draft }} className="avatar-preview" />
        <div>
          <h3>Xem trước</h3>
          <p>Ảnh sẽ hiển thị trên tài khoản và thanh điều hướng.</p>
          {draft && (
            <button
              type="button"
              className="text-button"
              disabled={busy || reading}
              onClick={() => {
                selection.current += 1
                setDraft(null)
                setError('')
              }}
            >
              Xóa ảnh đại diện
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="avatar-editor-actions">
        <button type="button" onClick={onClose}>
          Hủy
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || reading || draft === (user.avatar_base64 ?? null)}
          onClick={save}
        >
          {busy ? 'Đang lưu…' : 'Lưu ảnh đại diện'}
          <Icon name="check" size={17} />
        </button>
      </div>
    </ContentDialog>
  )
}
