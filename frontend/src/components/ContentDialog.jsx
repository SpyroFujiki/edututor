import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'
import { lockPageScroll } from '../services/dialog-scroll.js'

export default function ContentDialog({ title, onClose, children, className = '' }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    const unlock = lockPageScroll(document.body)
    return () => {
      dialog.close()
      unlock()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`content-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose()
      }}
    >
      <div className="dialog-heading">
        <div className="dialog-heading-label">
          <span className="dialog-emblem" aria-hidden="true">
            <span className="theme-light-only">
              <Icon name="sprout" size={19} />
            </span>
            <span className="theme-dark-only">
              <Icon name="orbit" size={19} />
            </span>
          </span>
          <span className="eyebrow" id={titleId}>
            {title}
          </span>
        </div>
        <button
          type="button"
          className="icon-button dialog-close"
          aria-label="Đóng chi tiết"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  )
}
