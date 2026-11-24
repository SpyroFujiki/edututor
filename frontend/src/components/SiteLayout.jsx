import { useState } from 'react'
import { Action, Badge } from './Workspace.jsx'
import { isAdmin } from './workspace-utils.js'
import Icon from './Icon.jsx'
import SiteLink from './SiteLink.jsx'
import Dropdown from './Dropdown.jsx'
import Avatar from './Avatar.jsx'
import { adminGroups, adminHref } from '../admin-navigation.js'
import { navigate } from '../navigation.js'

const publicLinks = [
  ['/', 'Trang chủ'],
  ['/courses', 'Khóa học'],
  ['/tutoring', 'Gia sư'],
  ['/community', 'Cộng đồng'],
]
const workspaceGroups = [
  {
    label: 'Học tập',
    links: [
      ['/learning', 'book', 'Việc học'],
      ['/tutoring', 'calendar', 'Gia sư & lịch học'],
    ],
  },
  {
    label: 'Tài khoản & giao dịch',
    links: [
      ['/wallet', 'wallet', 'Ví & thanh toán'],
      ['/purchases', 'clock', 'Lịch sử mua dịch vụ'],
      ['/disputes', 'shield', 'Tranh chấp'],
      ['/account', 'settings', 'Tài khoản'],
    ],
  },
]
const workspaceLinks = workspaceGroups.flatMap((group) => group.links)

export function Brand() {
  return (
    <SiteLink href="/" className="brand" aria-label="EduTutor — Trang chủ">
      <span className="brand-icon">
        <Icon name="cap" size={26} />
      </span>
      <span>
        Edu<span className="brand-accent">Tutor</span>
      </span>
    </SiteLink>
  )
}

function CourseSearch({ query, onSearch }) {
  function submit(event) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('q').trim()
    navigate(value ? `/courses?${new URLSearchParams({ q: value })}` : '/courses')
    onSearch?.()
  }

  return (
    <form className="header-search" role="search" aria-label="Tìm khóa học" onSubmit={submit}>
      <input
        aria-label="Tên hoặc nội dung khóa học"
        type="search"
        name="q"
        placeholder="Tìm khóa học…"
        defaultValue={query}
        maxLength={200}
      />
      <button type="submit" className="icon-button" aria-label="Tìm khóa học">
        <Icon name="search" size={19} />
      </button>
    </form>
  )
}

export function Header({ user, pathname, courseQuery, theme, onThemeChange, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="header-inner container">
        <Brand />
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {publicLinks.slice(1).map(([href, label]) => (
            <SiteLink href={href} key={href} aria-current={pathname === href ? 'page' : undefined}>
              {label}
            </SiteLink>
          ))}
          {isAdmin(user) && (
            <Dropdown
              label="Quản trị"
              icon="grid"
              active={pathname === '/admin'}
              className="header-admin"
              align="right"
            >
              <div className="admin-mega-menu">
                {adminGroups.map((group) => (
                  <div className="menu-group" key={group.id}>
                    <p>
                      <Icon name={group.icon} size={15} />
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <SiteLink href={adminHref(item.id)} key={item.id}>
                        {item.label}
                        <Icon name="arrow" size={13} />
                      </SiteLink>
                    ))}
                  </div>
                ))}
              </div>
            </Dropdown>
          )}
        </nav>
        <div className="desktop-search">
          <CourseSearch query={courseQuery} />
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={onThemeChange}
            aria-label={
              theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
            }
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          {user ? (
            <Dropdown
              className="account-dropdown"
              align="right"
              label={
                <>
                  <Avatar user={user} decorative />
                  <span className="account-name" title={user.full_name || user.email}>
                    {user.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="sr-only">Menu tài khoản</span>
                </>
              }
            >
              <div className="dropdown-user">
                <span className="dropdown-caption">ĐANG ĐĂNG NHẬP</span>
                {user.full_name && <strong>{user.full_name}</strong>}
                <span>{user.email}</span>
                <Badge value={user.role} />
              </div>
              {workspaceLinks.map(([href, icon, label]) => (
                <SiteLink key={href} href={href}>
                  <Icon name={icon} size={17} />
                  {label}
                </SiteLink>
              ))}
              {isAdmin(user) && (
                <SiteLink href="/admin">
                  <Icon name="shield" size={17} />
                  Quản trị
                </SiteLink>
              )}
              <Action className="logout-button" onClick={onLogout}>
                <Icon name="logout" size={17} />
                Đăng xuất
              </Action>
            </Dropdown>
          ) : (
            <div className="auth-actions">
              <SiteLink
                href="/login"
                className="login-link"
                aria-current={pathname === '/login' ? 'page' : undefined}
              >
                Đăng nhập
              </SiteLink>
              <SiteLink href="/register" className="button primary button-sm">
                Tạo tài khoản
              </SiteLink>
            </div>
          )}
          <button
            type="button"
            className="icon-button mobile-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-nav container"
          aria-label="Điều hướng trên điện thoại"
        >
          <CourseSearch query={courseQuery} onSearch={() => setMenuOpen(false)} />
          {publicLinks.map(([href, label]) => (
            <SiteLink
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {label}
              <Icon name="arrow" size={16} />
            </SiteLink>
          ))}
          {!user && (
            <>
              <SiteLink href="/login" onClick={() => setMenuOpen(false)}>
                Đăng nhập
              </SiteLink>
              <SiteLink href="/register" onClick={() => setMenuOpen(false)}>
                Tạo tài khoản
              </SiteLink>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

export function WorkspaceNav({ user, pathname, adminSection }) {
  return (
    <aside className="workspace-nav">
      <nav className="container workspace-nav-inner" aria-label="Không gian cá nhân">
        {workspaceGroups.map((group) => (
          <div className="workspace-nav-group" key={group.label}>
            <p className="workspace-label">{group.label}</p>
            {group.links.map(([href, icon, label]) => (
              <SiteLink
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
              >
                <Icon name={icon} size={17} />
                {label}
              </SiteLink>
            ))}
          </div>
        ))}
        {isAdmin(user) && (
          <SiteLink href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined}>
            <Icon name="shield" size={17} />
            Quản trị
          </SiteLink>
        )}
      </nav>
      {isAdmin(user) && pathname === '/admin' && <AdminNavigation selected={adminSection} />}
    </aside>
  )
}

export function AdminNavigation({ selected }) {
  return (
    <nav className="admin-sidebar" aria-label="Danh mục quản trị">
      {adminGroups.map((group) => (
        <details
          key={`${group.id}-${selected}`}
          open={group.items.some((item) => item.id === selected)}
        >
          <summary>
            <Icon name={group.icon} size={16} />
            {group.label}
          </summary>
          {group.items.map((item) => (
            <SiteLink
              href={adminHref(item.id)}
              key={item.id}
              aria-current={selected === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </SiteLink>
          ))}
        </details>
      ))}
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand />
          <p>Nền tảng khóa học, gia sư và cộng đồng học tập.</p>
        </div>
        <nav aria-label="Liên kết cuối trang">
          <SiteLink href="/courses">Khám phá khóa học</SiteLink>
          <SiteLink href="/tutoring">Tìm gia sư đồng hành</SiteLink>
          <SiteLink href="/community">Kết nối cộng đồng</SiteLink>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} EduTutor</span>
      </div>
    </footer>
  )
}
