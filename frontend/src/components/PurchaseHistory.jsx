import { useState } from 'react'
import {
  filterPurchases,
  purchaseStatus,
  purchaseStatuses,
  purchaseTypes,
} from '../services/purchase-history.js'
import { date, money } from './workspace-utils.js'
import { useCollection } from './use-collection.js'
import { Pager, Resource } from './Workspace.jsx'
import CollectionToolbar from './CollectionToolbar.jsx'
import ContentDialog from './ContentDialog.jsx'
import DataTable from './DataTable.jsx'
import Icon from './Icon.jsx'
import PageHeading from './PageHeading.jsx'
import SiteLink from './SiteLink.jsx'

function price(value) {
  return value === null || value === undefined
    ? 'Chưa ghi nhận'
    : Number(value) === 0
      ? 'Miễn phí'
      : `${money(value)} credit`
}

function PurchaseStatus({ row }) {
  const status = purchaseStatus(row)
  return (
    <span className={`badge badge-${status ?? 'unknown'}`}>
      {purchaseStatuses[status] ?? 'Chưa rõ'}
    </span>
  )
}

export function PurchaseHistoryTable({ rows, onSelect }) {
  return (
    <DataTable
      label="Lịch sử mua dịch vụ"
      rows={rows}
      columns={[
        {
          key: 'title_at_purchase',
          label: 'Dịch vụ đã mua',
          render: (row) => <strong>{row.title_at_purchase || purchaseTypes[row.type]}</strong>,
        },
        {
          key: 'type',
          label: 'Loại dịch vụ',
          render: (row) => purchaseTypes[row.type] ?? 'Dịch vụ',
        },
        {
          key: 'price_at_purchase',
          label: 'Giá tại thời điểm mua',
          render: (row) => price(row.price_at_purchase),
        },
        { key: 'activated_at', label: 'Thời gian mua', render: (row) => date(row.activated_at) },
        {
          key: 'status',
          label: 'Trạng thái đăng ký',
          render: (row) => <PurchaseStatus row={row} />,
        },
        {
          key: 'actions',
          label: 'Chi tiết',
          render: (row) => (
            <button
              type="button"
              onClick={() => onSelect(row)}
              aria-label={`Xem chi tiết ${row.title_at_purchase || purchaseTypes[row.type]}`}
            >
              Chi tiết
            </button>
          ),
        },
      ]}
    />
  )
}

export function PurchaseDetails({ row }) {
  return (
    <>
      <h2>{row.title_at_purchase || purchaseTypes[row.type]}</h2>
      <dl className="details">
        <div>
          <dt>Mã đăng ký</dt>
          <dd>{row.id}</dd>
        </div>
        <div>
          <dt>Loại dịch vụ</dt>
          <dd>{purchaseTypes[row.type] ?? 'Dịch vụ'}</dd>
        </div>
        <div>
          <dt>Giá tại thời điểm mua</dt>
          <dd>{price(row.price_at_purchase)}</dd>
        </div>
        <div>
          <dt>Thời gian mua</dt>
          <dd>{date(row.activated_at)}</dd>
        </div>
        <div>
          <dt>Hạn sử dụng</dt>
          <dd>{row.expired_at ? date(row.expired_at) : 'Không giới hạn'}</dd>
        </div>
        <div>
          <dt>Trạng thái đăng ký</dt>
          <dd>
            <PurchaseStatus row={row} />
          </dd>
        </div>
      </dl>
      <div className="actions">
        <SiteLink
          className="button primary"
          href={row.type === 'course' ? '/learning' : '/tutoring'}
        >
          <Icon name={row.type === 'course' ? 'book' : 'calendar'} size={17} />
          {row.type === 'course' ? 'Đến việc học của tôi' : 'Đến gia sư & lịch học'}
        </SiteLink>
        <SiteLink className="button" href="/wallet">
          Xem giao dịch ví
        </SiteLink>
      </div>
    </>
  )
}

export default function PurchaseHistory({ api }) {
  const resource = useCollection(api, '/me/subscriptions')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('all')
  const [sort, setSort] = useState('newest')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)
  const rows = filterPurchases(resource.data ?? [], { query, type, status, period, sort })
  const change = (setter) => (value) => {
    setter(value)
    setOffset(0)
  }
  const reset = () => {
    setQuery('')
    setType('all')
    setStatus('all')
    setPeriod('all')
    setSort('newest')
    setOffset(0)
  }
  const selectedPurchase = resource.data?.find((row) => row.id === selected?.id) ?? selected
  return (
    <section className="purchase-history-page">
      <PageHeading
        title="Lịch sử mua dịch vụ"
        eyebrow="CÁC LẦN ĐĂNG KÝ CỦA BẠN"
        description="Xem lại khóa học, gói gia sư và giá tại thời điểm đăng ký, kể cả dịch vụ đã hết hạn hoặc đã hủy."
        icon="clock"
      >
        <button
          type="button"
          disabled={resource.loading}
          onClick={() => {
            setOffset(0)
            resource.reload()
          }}
        >
          <Icon name="refresh" size={17} /> Làm mới
        </button>
      </PageHeading>
      {!resource.error && (
        <CollectionToolbar
          query={query}
          onQueryChange={change(setQuery)}
          placeholder="Tìm tên dịch vụ hoặc mã đăng ký…"
          filters={[
            {
              label: 'Loại dịch vụ',
              value: type,
              onChange: change(setType),
              options: [['all', 'Mọi dịch vụ'], ...Object.entries(purchaseTypes)],
            },
            {
              label: 'Trạng thái đăng ký',
              value: status,
              onChange: change(setStatus),
              options: [['all', 'Mọi trạng thái'], ...Object.entries(purchaseStatuses)],
            },
            {
              label: 'Thời gian mua',
              value: period,
              onChange: change(setPeriod),
              options: [
                ['all', 'Mọi thời gian'],
                ['7', '7 ngày qua'],
                ['30', '30 ngày qua'],
                ['90', '90 ngày qua'],
              ],
            },
            {
              label: 'Sắp xếp',
              value: sort,
              onChange: change(setSort),
              options: [
                ['newest', 'Mới nhất'],
                ['oldest', 'Cũ nhất'],
              ],
            },
          ]}
          active={
            !!query || type !== 'all' || status !== 'all' || period !== 'all' || sort !== 'newest'
          }
          count={resource.loading ? null : rows.length}
          noun="lần mua"
          onReset={reset}
        />
      )}
      <Resource
        resource={{
          ...resource,
          error: resource.error ? 'Không tải được lịch sử mua dịch vụ. Vui lòng thử lại.' : null,
        }}
        empty={
          <>
            <span>Bạn chưa mua dịch vụ nào.</span>
            <SiteLink className="button" href="/courses">
              Khám phá khóa học
            </SiteLink>
          </>
        }
      >
        {() => (
          <>
            <PurchaseHistoryTable rows={rows.slice(offset, offset + 20)} onSelect={setSelected} />
            <Pager
              offset={offset}
              setOffset={setOffset}
              length={rows.slice(offset, offset + 20).length}
              hasNext={offset + 20 < rows.length}
            />
          </>
        )}
      </Resource>
      {selectedPurchase && (
        <ContentDialog title="Chi tiết lần mua dịch vụ" onClose={() => setSelected(null)}>
          <PurchaseDetails row={selectedPurchase} />
        </ContentDialog>
      )}
    </section>
  )
}
