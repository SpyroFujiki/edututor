# Module nghiệp vụ

Các module nhận SQLAlchemy `Session` từ caller, kiểm tra quyền và quy tắc
nghiệp vụ, sau đó flush trong transaction hiện tại. Router chịu trách nhiệm
serialize response theo allowlist rồi commit; không tự tạo bảng khi khởi động.

| Package     | Trách nhiệm chính                                                        |
| ----------- | ------------------------------------------------------------------------ |
| `auth`      | Xác thực mật khẩu, access token, refresh rotation/reuse và thu hồi phiên |
| `users`     | Hồ sơ, tên/ảnh đại diện, phương thức thanh toán, subscription và audit   |
| `learning`  | Khóa/bài học, mua quyền, metadata video, điểm danh, bài tập và kết quả   |
| `tutoring`  | Gói, booking, phân công, lịch, tin nhắn, tệp và tranh chấp               |
| `community` | Bài viết, bình luận, kiểm duyệt, báo cáo và nâng bậc                     |
| `finance`   | Ví, nạp/rút, ledger, VNPAY, công nợ, quyết toán và snapshot              |

`common.py` tập trung helper truy vấn có phạm vi, lỗi nghiệp vụ, thời gian và
audit. `users/audit_labels.py` chuẩn hóa thao tác REST và tên đối tượng tiếng Việt.
Ảnh đại diện được kiểm tra và chuẩn hóa tại `core/avatar.py`, không ghi blob vào
nhật ký hoặc danh sách quản trị.

`finance/payments.py` và `tutoring/tutoring_service.py` giữ public import tương
thích cho router/caller; nghiệp vụ nằm trong các file theo thực thể. Không xóa
re-export chỉ vì không có lời gọi nội bộ trong chính file facade.

## Quy tắc thay đổi

- Giữ kiểm tra chủ sở hữu/role ở backend; UI không quyết định quyền.
- Khóa hàng và kiểm tra lại trạng thái trong cùng transaction khi thay đổi ví,
  booking, quyền mua hoặc quyết toán. Ledger và số dư phải cùng commit.
- Refresh reuse phải commit thu hồi phiên trước khi trả 401.
- Module không tự commit hoặc mở transaction lồng sau query của auth dependency.
- Endpoint dùng schema input chặt và output allowlist, không serialize ORM tùy ý.
- Thay model bằng migration Alembic mới; không sửa các revision đã phát hành.

[Luồng DB](database-flow.md) mô tả ranh giới ghi dữ liệu.
[Triển khai](implementation.md) liệt kê hành vi hiện có; OpenAPI `/api/docs`
là hợp đồng route/request/response. Các bài kiểm thử nằm trong `backend/tests/`.
