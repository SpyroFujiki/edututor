export function createTopUp(api, { provider, packageId, requestId, vnpayEnabled }) {
  if (!['vnpay', 'manual'].includes(provider))
    throw new Error('Vui lòng chọn phương thức thanh toán hợp lệ.')
  if (provider === 'vnpay' && !vnpayEnabled)
    throw new Error('VNPAY hiện chưa khả dụng. Vui lòng thử lại hoặc chọn chuyển khoản.')
  return api.request(provider === 'vnpay' ? '/payments/vnpay/checkout' : '/me/deposits', {
    method: 'POST',
    body: { request_id: requestId, package_id: packageId },
  })
}
