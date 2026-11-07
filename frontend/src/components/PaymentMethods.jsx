import { useId } from 'react'
import Icon from './Icon.jsx'

export default function PaymentMethods({ resource, value, onChange, disabled = false }) {
  const name = useId()
  const enabled = resource.data?.enabled === true && !resource.loading && !resource.error
  return (
    <fieldset className="payment-methods" disabled={disabled}>
      <legend>Phương thức thanh toán</legend>
      <div className="payment-method-grid">
        <label
          className={`payment-method ${value === 'vnpay' ? 'is-selected' : ''} ${!enabled ? 'is-unavailable' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value="vnpay"
            checked={value === 'vnpay'}
            disabled={!enabled}
            onChange={() => onChange('vnpay')}
          />
          <span>
            <strong>VNPAY</strong>
            <small>
              {resource.loading
                ? 'Đang kiểm tra phương thức thanh toán…'
                : !enabled
                  ? 'Tạm thời chưa khả dụng.'
                  : 'Thanh toán qua VNPAY, credit tự động cộng sau xác nhận.'}
            </small>
          </span>
          <Icon name="shield" size={22} />
        </label>
        <label className={`payment-method ${value === 'manual' ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name={name}
            value="manual"
            checked={value === 'manual'}
            onChange={() => onChange('manual')}
          />
          <span>
            <strong>Chuyển khoản</strong>
            <small>Khoản nạp được quản trị đối soát và xác nhận.</small>
          </span>
          <Icon name="exchange" size={22} />
        </label>
      </div>
      {resource.error && (
        <p role="alert" className="payment-method-error">
          Chưa kiểm tra được trạng thái VNPAY.{' '}
          <button type="button" onClick={resource.reload}>
            Thử lại
          </button>
        </p>
      )}
    </fieldset>
  )
}
