import { Catalog } from './Learning.jsx'
import Icon from './Icon.jsx'
import SiteLink from './SiteLink.jsx'
import './Home.css'

const discoveryLinks = [
  ['/courses', 'book', 'Tất cả khóa học'],
  ['/courses?format=video', 'video', 'Khóa học video'],
  ['/courses?format=live', 'calendar', 'Lớp học trực tiếp'],
  ['/courses?price=free', 'gift', 'Khóa học miễn phí'],
  ['/tutoring', 'users', 'Tìm gia sư'],
  ['/community', 'chat', 'Cộng đồng'],
]

export default function Home({ api, user, onLogin, onPurchased }) {
  return (
    <>
      <div className="home-intro">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title">Bạn muốn học gì hôm nay?</h1>
            <p>Học qua video, tham gia lớp trực tiếp hoặc đặt lịch học cùng gia sư.</p>
            <div className="home-hero-actions">
              <SiteLink className="button home-hero-primary" href={user ? '/learning' : '/courses'}>
                {user ? 'Việc học của tôi' : 'Khám phá khóa học'}
              </SiteLink>
              <SiteLink className="button home-hero-secondary" href="/tutoring">
                Tìm gia sư
              </SiteLink>
            </div>
          </div>
          <div className="home-hero-media">
            <img src="/learning-hero.jpg" alt="" width="1448" height="1086" fetchPriority="high" />
          </div>
        </section>

        <nav className="home-discovery" aria-label="Khám phá EduTutor">
          <h2>Danh mục học tập</h2>
          <ul>
            {discoveryLinks.map(([href, icon, title]) => (
              <li key={href}>
                <SiteLink href={href}>
                  <Icon name={icon} size={19} />
                  <span>{title}</span>
                  <Icon name="chevron" size={15} className="home-discovery-chevron" />
                </SiteLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Catalog api={api} user={user} onLogin={onLogin} onPurchased={onPurchased} featured />

      <section className="home-tutoring">
        <span className="home-tutoring-icon">
          <Icon name="users" size={28} />
        </span>
        <div>
          <h2>Học cùng gia sư</h2>
          <p>Chọn gói gia sư theo nhu cầu và quản lý lịch học trong tài khoản của bạn.</p>
        </div>
        <SiteLink href="/tutoring" className="button">
          Xem các gói gia sư
        </SiteLink>
      </section>
    </>
  )
}
