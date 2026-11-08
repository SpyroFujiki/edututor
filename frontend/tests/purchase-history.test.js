import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterPurchases, purchaseStatus } from '../src/services/purchase-history.js'
import { loadCollection } from '../src/components/collection-utils.js'

const now = Date.parse('2026-11-08T12:00:00Z')
const purchases = [
  {
    id: 'old',
    type: 'booking',
    title_at_purchase: 'Gia sư Toán',
    price_at_purchase: 250000,
    status: 'cancelled',
    activated_at: '2026-09-01T10:00:00',
    expired_at: null,
  },
  {
    id: 'recent',
    type: 'course',
    title_at_purchase: 'Lập trình Python',
    price_at_purchase: 0,
    status: 'active',
    activated_at: '2026-11-07T10:00:00Z',
    expired_at: null,
  },
  {
    id: 'expired',
    type: 'course',
    title_at_purchase: 'Tiếng Anh',
    price_at_purchase: 100,
    status: 'active',
    activated_at: '2026-10-01T10:00:00',
    expired_at: '2026-11-01T10:00:00',
  },
]

test('purchase history retains expired/cancelled purchases and sorts without changing snapshots', () => {
  const before = JSON.stringify(purchases)
  assert.deepEqual(
    filterPurchases(purchases, {}, now).map((r) => r.id),
    ['recent', 'expired', 'old'],
  )
  assert.deepEqual(
    filterPurchases(purchases, { sort: 'oldest' }, now).map((r) => r.id),
    ['old', 'expired', 'recent'],
  )
  assert.equal(JSON.stringify(purchases), before)
})

test('search and service/status/time filters combine immediately with Vietnamese accent folding', () => {
  const result = filterPurchases(
    purchases,
    { query: 'gia su toan', type: 'booking', status: 'cancelled', period: '90' },
    now,
  )
  assert.deepEqual(
    result.map((r) => r.id),
    ['old'],
  )
  assert.equal(result[0].price_at_purchase, 250000)
  assert.deepEqual(
    filterPurchases(purchases, { type: 'course', status: 'expired' }, now).map((r) => r.id),
    ['expired'],
  )
  assert.deepEqual(
    filterPurchases(purchases, { query: 'RECENT', period: '7' }, now).map((r) => r.id),
    ['recent'],
  )
  assert.equal(filterPurchases(purchases, { query: 'toan', type: 'course' }, now).length, 0)
})

test('effective expiry uses UTC, preserves cancellations and excludes future/out-of-period purchases', () => {
  assert.equal(purchaseStatus(purchases[2], now), 'expired')
  assert.equal(
    purchaseStatus({ status: 'cancelled', expired_at: '2020-01-01T00:00:00' }, now),
    'cancelled',
  )
  assert.equal(
    purchaseStatus({ status: 'active', expired_at: '2026-11-08T19:00:00+07:00' }, now),
    'expired',
  )
  const rows = [
    { ...purchases[1], id: 'boundary', activated_at: '2026-11-01T12:00:00' },
    { ...purchases[1], id: 'too-old', activated_at: '2026-11-01T11:59:59' },
    { ...purchases[1], id: 'future', activated_at: '2026-11-09T00:00:00' },
  ]
  assert.deepEqual(
    filterPurchases(rows, { period: '7' }, now).map((r) => r.id),
    ['boundary'],
  )
})

test('filtering finds purchases beyond the first API page', async () => {
  const rows = Array.from({ length: 105 }, (_, i) => ({ ...purchases[1], id: String(i) }))
  rows[104] = { ...purchases[0], id: 'target', title_at_purchase: 'Gia sư Hóa riêng' }
  const offsets = []
  const all = await loadCollection(
    {
      request: async (path) => {
        const params = new URL('http://test' + path).searchParams
        const offset = Number(params.get('offset'))
        offsets.push(offset)
        return rows.slice(offset, offset + Number(params.get('limit')))
      },
    },
    '/me/subscriptions',
  )
  assert.deepEqual(offsets, [0, 100])
  assert.deepEqual(
    filterPurchases(all, { query: 'hoa rieng', status: 'cancelled' }, now).map((r) => r.id),
    ['target'],
  )
})
