import { useState } from 'react'
import { avatarSource } from '../services/avatar.js'

export default function Avatar({ user, className = '', decorative = false }) {
  const [failed, setFailed] = useState(null)
  const source = avatarSource(user?.avatar_base64)
  const name = user?.full_name || user?.email || 'EduTutor'
  const initial = name.trim().charAt(0).toLocaleUpperCase('vi')
  return (
    <span
      className={`avatar ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `Ảnh đại diện của ${name}`}
      aria-hidden={decorative || undefined}
    >
      {source && failed !== source ? (
        <img src={source} alt="" draggable={false} onError={() => setFailed(source)} />
      ) : (
        initial
      )}
    </span>
  )
}
