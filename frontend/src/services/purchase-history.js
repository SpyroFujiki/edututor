import { searchText } from '../components/collection-utils.js'

export const purchaseTypes = { course: 'Khóa học', booking: 'Gói gia sư' }
export const purchaseStatuses = {
  active: 'Đang hiệu lực',
  expired: 'Đã hết hạn',
  cancelled: 'Đã hủy',
}

function timestamp(value) {
  if (!value) return 0
  const result = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`)
  return Number.isFinite(result) ? result : 0
}

export function purchaseStatus(row, now = Date.now()) {
  const expiry = timestamp(row.expired_at)
  return row.status === 'active' && expiry && expiry <= now ? 'expired' : row.status
}

export function filterPurchases(
  rows,
  { query = '', type = 'all', status = 'all', period = 'all', sort = 'newest' } = {},
  now = Date.now(),
) {
  const term = searchText(query)
  const days = Number(period)
  const cutoff = Number.isFinite(days) && days > 0 ? now - days * 86400000 : null
  return rows
    .filter((row) => {
      if (type !== 'all' && row.type !== type) return false
      if (status !== 'all' && purchaseStatus(row, now) !== status) return false
      const purchased = timestamp(row.activated_at)
      if (cutoff !== null && (purchased < cutoff || purchased > now)) return false
      return (
        !term ||
        searchText([row.title_at_purchase, row.id, purchaseTypes[row.type]].join(' ')).includes(
          term,
        )
      )
    })
    .sort(
      (a, b) =>
        (timestamp(a.activated_at) - timestamp(b.activated_at)) * (sort === 'oldest' ? 1 : -1) ||
        String(a.id).localeCompare(String(b.id)),
    )
}
