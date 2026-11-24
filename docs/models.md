# Models từ DBML

`backend/app/models/` chứa 24 SQLAlchemy 2 model theo DBML và AuthSession bổ sung
cho JWT Bearer/refresh rotation (tổng 25 bảng), mỗi bảng một file.
`base.py` dùng chung metadata và quy tắc đặt tên constraint; `enums.py` chứa 15
enum; `__init__.py` import tất cả model để metadata đủ bảng khi dùng migration.
`app/schemas/` tiếp tục dành cho hợp đồng API Pydantic.

| Nhóm            | Model                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Người dùng      | `User`, `PaymentMethod`, `ActionLog`, `UserSubscription`                                                                    |
| Gia sư          | `TutoringPackage`, `Booking`, `BookingSession`, `Message`, `Dispute`                                                        |
| Đào tạo         | `Course`, `Lesson`, `Attendance`, `CourseProgress`                                                                          |
| Cộng đồng       | `Post`, `Comment`, `RoleRequest`, `CommentReport`                                                                           |
| Tài chính       | `Wallet`, `BookingSettlement`, `InternalTransaction`, `ExternalTransaction`, `CreditPackage`, `CashOrder`, `WalletSnapshot` |
| Auth ngoài DBML | `AuthSession` — hash refresh, hạn phiên, thu hồi/logout                                                                     |

## Quy ước ánh xạ

- Giữ nguyên tên bảng/cột, nullability, PK, unique, index, FK và check của DBML.
  Cột không khai báo `not null` và không thuộc PK vẫn nullable, kể cả email,
  password_hash hoặc cột có default. Chưa tự siết các cột này.
- Dùng PostgreSQL: UUID, JSONB, JSON, native enum, `Numeric` trả về `Decimal` và
  `BigInteger` cho các cột bigint. `messages.id` là BIGSERIAL.
- Enum lưu giá trị DBML (`active`, `head_admin`, `in`...), không lưu tên member
  Python viết hoa. Số 0–6 trong ghi chú role không phải giá trị lưu ở database.
- `timestamp` ánh xạ sang timestamp không timezone đúng theo DBML.
- Default được khai báo bằng `server_default` đúng những chỗ DBML có default.
  UUID chưa tự sinh; ứng dụng phải cấp UUID khi tạo bản ghi. `updated_at` không
  tự đổi khi update vì DBML không khai báo trigger hay quy tắc tự cập nhật.
- Quan hệ database được thể hiện bằng FK, gồm bốn FK ghép ở `comments`,
  `messages` và `attendance`. Chưa thêm các thuộc tính điều hướng ORM
  `relationship()` hoặc cascade xóa ngoài quy định của DBML.
- Import model không kết nối database và không tự chạy `create_all`.
- Riêng auth_sessions mới dùng timestamp có timezone; 24 bảng DBML giữ kiểu cũ.
  Bảng phiên chỉ lưu hash refresh, không lưu JWT gốc; cần migration trước khi dùng.

```python
from app.models import Base, User
from app.models.enums import UserRole

# Khi cấu hình Alembic: target_metadata = Base.metadata
# Khi xây service: dùng User/UserRole với session được quản lý riêng.
```

## Review và kiểm tra

Đã đối chiếu tự động trực tiếp với DBML đính kèm: 24 bảng khớp về tên cột,
kiểu dữ liệu, nullable, default, enum, PK, unique, index, FK và check. Metadata có
46 FK, 24 index tường minh và 17 check. Không tạo thêm một file schema DBML/SQL.

Đã đọc lại các FK ghép để xác nhận:

- Bình luận cha thuộc cùng bài viết và không thể tự làm cha trực tiếp.
- Tin nhắn tranh chấp thuộc cùng booking với tranh chấp đó.
- Attendance liên kết cả tiến độ đăng ký và bài học trong cùng khóa học.
- Giữ các unique `(id, post_id)`, `(id, booking_id)`, `(id, course_id)` và
  `(subscription_id, course_id)` để PostgreSQL có khóa đích hợp lệ cho FK ghép.

Test trong `backend/tests/test_models.py` kiểm tra cấu hình ORM, biên dịch toàn
bộ CREATE/DROP schema với PostgreSQL dialect và giá trị enum được lưu. Đây là
kiểm tra không kết nối. Ngoài ra đã chạy migration đầu tiên trên PostgreSQL 18,
kiểm tra đủ 25 bảng/15 enum và Alembic check không phát hiện drift so với model.

## Các migration bổ sung

Schema gốc giữ trong revision 0001; các revision tiếp theo thêm ràng buộc,
chỉ mục và trường nghiệp vụ, bao gồm họ tên, thời lượng bài học, xác nhận bài
tập, tiến độ độc lập điểm đánh giá và ảnh đại diện. Head là `0011_booking_integrity`.
Các con số constraint phía trên mô tả đối chiếu schema gốc, không phải tổng
sau mọi revision. Alembic check và test roundtrip PostgreSQL xác minh schema hiện tại.

Khi thay model, tạo revision mới; giữ nguyên migration đã phát hành. Không tự
đổi nullability, giới hạn tiền hoặc enum mà không migrate dữ liệu hiện hữu.
`User.avatar_base64` là TEXT nullable, có giới hạn chiều dài và deferred load;
ảnh được chuẩn hóa tại service trước khi lưu.

## Module và luồng dữ liệu

Các model không tự tạo bảng hay commit. Nghiệp vụ nằm trong
`app/modules/{users,tutoring,learning,community,finance,auth}/`.

- [Danh mục module và quy ước Session/quyền](modules.md).
- [Luồng dữ liệu DB và transaction](database-flow.md).
- [Schema và luồng JWT](security.md).
- [Cài đặt và migration](database-setup.md).
