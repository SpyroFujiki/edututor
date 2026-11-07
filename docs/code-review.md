# Kiểm tra code — 08/11/2026

## Phần đã làm sạch

- Bỏ component kiểm tra API của scaffold và asset mẫu không được dùng.
- Bỏ rule CSS của giao diện cũ, khai báo bo góc dư thừa; giữ khối góc vuông và
  spinner tròn theo thiết kế. Giữ theme xanh lá/vũ trụ và hỗ trợ giảm chuyển động.
- Bỏ comment TODO đã lỗi thời; cập nhật README, cấu trúc module và luồng DB
  theo hành vi hiện tại. Public facade/re-export được giữ để không phá caller.
- Chuẩn hóa import/định dạng Python bằng Ruff và frontend bằng Prettier; thêm
  cấu hình formatter, editor và GitHub Actions. Không sửa các migration đã có.
- Loại cấu hình IDE, môi trường, log, upload và dữ liệu local khỏi repo mới.
- Ghim dependency formatter; dùng minimatch 11 qua npm override cho công cụ
  phát triển để xử lý GHSA-g3hv-75wg-m249. Lint/build kiểm tra tương thích sau đổi.

## Kiểm chứng

Kết quả local sau khi làm sạch:

- Backend: 251/251 test đạt, gồm PostgreSQL opt-in cho migration, refresh
  rotation và cạnh tranh tài chính/lịch học; không có test bỏ qua.
- Frontend: 79/79 test đạt; ESLint, Prettier check và production build đạt.
- Ruff lint/format và `pip check` đạt; `npm audit` không có cảnh báo.
- Alembic check không phát hiện lệch schema; cả 8 migration giữ nguyên nội dung
  so với trước khi dọn code. So sánh AST Python không phát hiện thay đổi logic
  ngoài import và hai biến cục bộ không dùng đã bỏ, vẫn giữ lời gọi hàm.
- 274 kiểm tra HTTP qua FE proxy đạt: phân quyền, phiên, bộ lọc nhật ký, ví và
  đường dẫn frontend. FE/BE đã khởi động lại trên port 5173/8000.

Máy local chạy Python 3.13/Node.js 25; formatter giữ cú pháp tương thích Python
3.13. Phiên bản mục tiêu trong cấu hình triển khai là Python 3.14/Node.js 24.

GitHub Actions dùng Python 3.14, Node.js 24 và PostgreSQL 18 riêng cho CI;
workflow không có secret production và không migrate Supabase.

## Giới hạn cần biết

- Kiểm thử tự động/API không thay thế kiểm tra trực quan trên trình duyệt.
- Drive preview không cung cấp sự kiện xem; cần video trực tiếp hoặc YouTube
  có quyền nhúng để lấy thời lượng và tự lưu tiến độ theo thời gian phát.
- VNPAY cần cấu hình merchant, IPN HTTPS và kiểm thử sandbox riêng; chưa có
  tác vụ đối soát tự động toàn hệ thống. Return URL không phải xác nhận nạp tiền.
- Tệp chat dùng ổ đĩa local; cần kho bền vững trước khi dùng upload trên serverless.
- Rate limit hiện theo process; triển khai nhiều worker cần rate limit dùng chung.
- Chưa có luồng khôi phục mật khẩu qua email. Gói gia sư lưu tên/giá; không có
  trường số buổi cố định, booking quản lý các buổi cụ thể.

Hợp đồng API tại `/api/docs`; xem thêm [triển khai](implementation.md),
[bảo mật](security.md), [Vercel](vercel.md) và [tài chính](finance.md).
