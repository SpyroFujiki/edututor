import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTopUp } from '../src/services/top-up.js'

test('VNPAY checkout preserves the selected package and request identity', async () => {
  const calls = []
  const response = {
    order_id: 'order-1',
    payment_url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  }
  const api = {
    request: async (...args) => {
      calls.push(args)
      return response
    },
  }
  assert.equal(
    await createTopUp(api, {
      provider: 'vnpay',
      packageId: 'package-1',
      requestId: 'request-1',
      vnpayEnabled: true,
    }),
    response,
  )
  assert.deepEqual(calls, [
    [
      '/payments/vnpay/checkout',
      {
        method: 'POST',
        body: { package_id: 'package-1', request_id: 'request-1' },
      },
    ],
  ])
})

test('manual top-ups remain available independently of VNPAY', async () => {
  const calls = []
  const api = { request: async (...args) => calls.push(args) }
  await createTopUp(api, {
    provider: 'manual',
    packageId: 'package-2',
    requestId: 'request-2',
    vnpayEnabled: false,
  })
  assert.deepEqual(calls, [
    [
      '/me/deposits',
      {
        method: 'POST',
        body: { package_id: 'package-2', request_id: 'request-2' },
      },
    ],
  ])
})

test('unavailable VNPAY cannot submit or silently create a manual deposit', () => {
  let requested = false
  const api = {
    request: () => {
      requested = true
    },
  }
  assert.throws(
    () =>
      createTopUp(api, {
        provider: 'vnpay',
        packageId: 'package-1',
        requestId: 'request-1',
        vnpayEnabled: false,
      }),
    /VNPAY hiện chưa khả dụng/,
  )
  assert.equal(requested, false)
})

test('an unknown provider does not submit a payment request', () => {
  let requested = false
  assert.throws(
    () =>
      createTopUp(
        {
          request: () => {
            requested = true
          },
        },
        {
          provider: 'other',
          packageId: 'package-1',
          requestId: 'request-1',
          vnpayEnabled: true,
        },
      ),
    /phương thức thanh toán hợp lệ/,
  )
  assert.equal(requested, false)
})
