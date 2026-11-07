# Luồng dữ liệu trong database

SQLAlchemy model mô tả cấu trúc, module thực thi nghiệp vụ, router quản lý
transaction. Alembic quản lý schema; startup không chạy `create_all`.

## Tài khoản và phiên

Đăng ký tạo user với email chuẩn hóa và mật khẩu Argon2id, role do server chọn.
Đăng nhập cấp access JWT và lưu hash refresh trong `auth_sessions`. Rotation
consume refresh một lần; reuse thu hồi phiên. Kiểm tra quyền đọc role/status
hiện tại từ DB. Đổi email/mật khẩu và logout-all thu hồi phiên cùng transaction.

`PATCH /api/auth/profile` chỉ sửa hồ sơ của người gọi. Ảnh được xác minh, bỏ
metadata, thu nhỏ rồi lưu WebP base64 trong `users.avatar_base64`; trường này
deferred và không xuất trong identity response của danh sách/audit.

## Khóa học

Mua khóa kiểm tra giá/quyền và khóa các hàng liên quan, ghi số dư/ledger cùng
subscription và tiến độ. Các bài thuộc quyền mua còn hạn mới được truy cập.
Client gửi thời gian xem và metadata video; server xác minh bài thuộc khóa,
giới hạn giá trị và tính lại tiến độ trong transaction.

Bài VOD không có bài tập lấy `watched_seconds / duration_seconds`, tối đa 100%.
Bài có bài tập lấy xác nhận quản trị; bài trực tiếp không có bài tập lấy điểm
danh. Tiến độ khóa là trung bình các bài. Hoàn thành học tập độc lập với điểm;
kết quả xếp loại chỉ ghi khi đủ ba điểm do quản trị nhập.

## Gia sư

Booking giữ snapshot gói/giá và ít nhất một buổi. Thanh toán ghi ledger và giữ
tiền theo nghiệp vụ. Phân công/xếp lịch khóa các hàng liên quan để chặn lịch
trùng. Chat kiểm tra người tham gia và phạm vi chat thường/tranh chấp; tải tệp
cũng kiểm tra lại quyền, không cung cấp đường dẫn ổ đĩa trực tiếp.

Quyết toán/giải ngân kiểm tra trạng thái booking và tranh chấp, chặn xử lý lặp.
Hoàn tiền và công nợ cùng cập nhật ledger/ví. Chi tiết: [gia sư](tutoring.md)
và [tài chính](finance.md).

## Nạp, rút và VNPAY

Tạo cash order ghi giá trị từ gói đang hợp lệ, không tin số tiền phía client.
Chỉ ví commercial được tạo hoặc xác nhận rút tiền; ví normal bị từ chối.
IPN VNPAY kiểm chữ ký, mã đơn, số tiền và trạng thái rồi khóa đơn/ví để cộng
credit đúng một lần. Return URL chỉ hiển thị kết quả và không tự cộng tiền.

Khoản nạp đã được xác minh vẫn được ghi nhận khi ví bị khóa; ví giữ nguyên
trạng thái khóa. Khóa ví vẫn chặn chi tiêu, rút và tạo khoản nạp mới. QueryDR
hỗ trợ kiểm tra lại giao dịch khi cần; chưa có lịch đối soát tự động toàn hệ thống.
Xem [VNPAY](vnpay-drive.md) về cấu hình và giới hạn vận hành.

## Cộng đồng và nhật ký

Ghi bài/bình luận, xử lý báo cáo và duyệt nâng bậc kiểm tra chủ sở hữu, role,
trạng thái mới nhất. Parent bình luận không đổi sau khi tạo. Các thao tác cần
audit ghi snapshot theo allowlist cùng transaction với thay đổi nghiệp vụ.
Không có API sửa/xóa action log. Bộ lọc thực hiện trước phân trang; tên người
dùng và chi tiết đối tượng được trả theo schema riêng.

## Migration và kiểm tra

Giữ toàn bộ revision 0001–0008 khi chuyển repo. Push GitHub không tự migrate
Supabase. Kiểm tra DB đích, backup rồi chạy `alembic upgrade head`; dùng
`alembic check` để phát hiện drift. Không chạy seed/test concurrency trên DB thật.
Test PostgreSQL opt-in chỉ chấp nhận loopback, tạo schema ngẫu nhiên rồi dọn.
