import { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import SiteLink from './SiteLink.jsx'

export default function AuthPage({ mode, expired, next, onAuthenticate }) {
  const register = mode === 'register'
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const alternate = `${register ? '/login' : '/register'}${next ? `?${new URLSearchParams({ next })}` : ''}`
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const values = new FormData(event.currentTarget)
    if (register && values.get('password') !== values.get('confirm_password')) {
      setError('Mật khẩu xác nhận chưa khớp. Vui lòng kiểm tra lại.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await onAuthenticate(
        {
          email: values.get('email').trim(),
          password: values.get('password'),
          ...(register ? { full_name: values.get('full_name').trim() } : {}),
        },
        register,
      )
    } catch (error) {
      setError(error.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <section className="auth-page">
      <aside className="auth-story">
        <h2>Việc học trong một tài khoản</h2>
        <p>Tiếp tục bài giảng, theo dõi tiến độ và xem lịch học cùng gia sư.</p>
      </aside>
      <div className="auth-form-panel">
        <SiteLink href="/" className="back-link">
          <Icon name="back" size={17} />
          Về trang chủ
        </SiteLink>
        <div className="auth-form-content">
          <div className="auth-form-icon">
            <Icon name={register ? 'cap' : 'book'} size={27} />
          </div>
          <h1>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
          <p className="auth-description">
            {register
              ? 'Tham gia EduTutor để lưu tiến độ và đặt lịch học với gia sư.'
              : 'Đăng nhập vào tài khoản EduTutor của bạn.'}
          </p>
          {expired && !register && (
            <p className="notice error" role="alert">
              <Icon name="alert" size={18} />
              Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
            </p>
          )}
          <form className="form auth-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              {register && (
                <label htmlFor="auth-full-name">
                  Họ và tên
                  <div className="input-with-icon">
                    <Icon name="users" size={18} />
                    <input
                      id="auth-full-name"
                      name="full_name"
                      autoComplete="name"
                      placeholder="Nhập họ và tên của bạn"
                      required
                      maxLength={200}
                      pattern=".*\S.*"
                    />
                  </div>
                </label>
              )}
              <label htmlFor="auth-email">
                Địa chỉ email
                <div className="input-with-icon">
                  <Icon name="mail" size={18} />
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ban@example.com"
                    required
                    maxLength={320}
                  />
                </div>
              </label>
              <label htmlFor="auth-password">
                Mật khẩu
                <div className="input-with-icon">
                  <Icon name="lock" size={18} />
                  <input
                    id="auth-password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={register ? 'new-password' : 'current-password'}
                    placeholder={register ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của bạn'}
                    required
                    minLength={register ? 8 : 1}
                    maxLength={1024}
                  />
                  <button
                    type="button"
                    className="password-toggle icon-button"
                    aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </div>
              </label>
              {register && (
                <label htmlFor="auth-confirm-password">
                  Xác nhận mật khẩu
                  <div className="input-with-icon">
                    <Icon name="lock" size={18} />
                    <input
                      id="auth-confirm-password"
                      name="confirm_password"
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      required
                      minLength={8}
                      maxLength={1024}
                    />
                  </div>
                </label>
              )}
              {error && (
                <p className="notice error" role="alert">
                  <Icon name="alert" size={18} />
                  {error}
                </p>
              )}
              <button className="primary auth-submit" type="submit">
                {busy ? (
                  <>
                    <span className="spinner" />
                    Đang xử lý…
                  </>
                ) : register ? (
                  'Tạo tài khoản'
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </fieldset>
          </form>
          <p className="auth-switch">
            {register ? 'Bạn đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <SiteLink href={alternate}>{register ? 'Đăng nhập' : 'Đăng ký ngay'}</SiteLink>
          </p>
          <div className="auth-reassurance">
            <Icon name="shield" size={18} />
            <span>
              Duy trì đăng nhập trên trình duyệt này.
              <br />
              Bạn có thể quản lý và thu hồi phiên trong Tài khoản.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
