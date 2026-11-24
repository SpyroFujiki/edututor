# EduTutor

Nền tảng khóa học, gia sư và cộng đồng học tập, dùng React/Vite, FastAPI,
SQLAlchemy và PostgreSQL. Giao diện tiếng Việt, theme sáng xanh lá theo chủ đề
ươm mầm và theme tối vũ trụ xanh navy/gold; menu bên trái, khối góc vuông và
biểu mẫu quản lý trong cửa sổ nổi.

## Chức năng

- Tài khoản, phân quyền, JWT refresh rotation, quản lý phiên, hồ sơ và ảnh đại
  diện base64; tải ảnh bằng kéo-thả hoặc chọn tệp.
- Khóa học trực tiếp/VOD; phát video ngay trong trang, lấy thời lượng và tự lưu
  thời gian xem. Bài không có bài tập tính tiến độ theo tỷ lệ thời gian xem;
  bài có bài tập cần xác nhận hoàn thành.
- Gói gia sư, đặt học, phân công, lịch buổi học, chat, tệp đính kèm và tranh chấp.
- Ví normal/commercial, nạp credit, VNPAY, sổ giao dịch, công nợ và quyết toán.
  Chỉ ví commercial được rút tiền.
- Bài viết, bình luận, báo cáo, nâng bậc và công cụ quản trị. Nhật ký có danh
  tính, chi tiết và bộ lọc tức thời theo REST, đối tượng, người dùng và thời gian.

Trạng thái và giới hạn cụ thể: [triển khai](docs/implementation.md),
[kiểm tra code](docs/code-review.md). Hợp đồng HTTP tại `/api/docs`.

## Cài đặt và chạy local

Yêu cầu: Python 3.14, Node.js 24 và PostgreSQL 18. Từ thư mục gốc trên PowerShell:

```powershell
python scripts/setup.py
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend
```

Setup tạo `backend/.venv`, cài dependency, sinh cấu hình còn thiếu và chạy
migration; giữ nguyên secret đã có. Có thể dùng PostgreSQL Docker bằng
`python scripts/setup.py --docker --db-port 5433`. Linux/macOS dùng
`backend/.venv/bin/python` để chạy các lệnh Python sau khi setup.

Mở terminal thứ hai:

```powershell
cd frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`. Backend: `http://localhost:8000`.
`/api/health` kiểm tra ứng dụng; `/api/ready` kiểm tra DB và migration head.
Chi tiết cài máy mới, pgAdmin và backup: [database-setup.md](docs/database-setup.md).

Tạo head admin đầu tiên bằng lệnh sau; mật khẩu được nhập ẩn:

```powershell
cd backend
.\.venv\Scripts\python.exe -m scripts.create_admin --email admin@example.com
```

Không có tài khoản mặc định. [Seed demo](docs/seed-data.md) chỉ dùng cho môi
trường phát triển; không công khai `.env.seed` hoặc chạy seed trên dữ liệu thật.

## Cấu hình

`.env.example` là mẫu không chứa thông tin đăng nhập. Backend đọc `.env`, rồi
`.env.local`; biến môi trường của process có ưu tiên cao nhất. Vite đọc cùng
thư mục gốc. Chỉ biến `VITE_` được phép chứa thông tin công khai.

| Biến                                                                              | Mục đích                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                                                                    | PostgreSQL URL; Supabase cần cấu hình SSL/pooler phù hợp     |
| `JWT_SECRET_KEY`                                                                  | Secret backend riêng, tối thiểu 32 byte                      |
| `CORS_ORIGINS`                                                                    | Các origin frontend được phép, ngăn cách bằng dấu phẩy       |
| `VITE_API_BASE_URL`                                                               | Bỏ trống để gọi `/api` cùng origin; Vite proxy tới port 8000 |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS` | Ghi đè chính sách JWT nếu cần                                |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`                         | Cấu hình merchant phía backend                               |

Không đưa `.env`, token, bản dump, tệp upload, cấu hình IDE hoặc dữ liệu local
lên Git. Khởi động lại server sau khi đổi cấu hình; build lại frontend khi đổi
biến public. Xem [Supabase](docs/supabase.md), [VNPAY/video](docs/vnpay-drive.md)
và [bảo mật](docs/security.md).

## Kiểm tra và định dạng

Từ thư mục gốc, sau khi setup:

```powershell
.\backend\.venv\Scripts\python.exe -m ruff check .
.\backend\.venv\Scripts\python.exe -m ruff format --check .
.\backend\.venv\Scripts\python.exe -m pip check
.\backend\.venv\Scripts\python.exe -m alembic check
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -q
cd ../frontend
npm run format:check
npm run lint
npm test
npm run build
```

Để chạy cả kiểm thử migration/khóa đồng thời trên PostgreSQL, đặt
`$env:TUTOR_TEST_POSTGRES = '1'` trước lệnh unittest. Test chỉ chấp nhận DB trên
loopback, dùng schema UUID riêng rồi tự dọn; không chạy bộ test này trên Supabase.

Ruff quản lý import và định dạng Python; dùng `ruff check --fix .` và
`ruff format .` khi cần. Frontend dùng `npm run format` với Prettier.
Migration đã phát hành được giữ nguyên; thay đổi schema phải thêm revision mới.
GitHub Actions chạy lint, format, test, build và migration trên PostgreSQL riêng,
với Python 3.14/Node.js 24. CI không kết nối hoặc cập nhật DB production.

## Cấu trúc và triển khai

| Đường dẫn                                            | Trách nhiệm                                                |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `backend/app/api/`                                   | HTTP, xác thực, phân quyền và transaction boundary         |
| `backend/app/schemas/`                               | Kiểm tra input và giới hạn output                          |
| `backend/app/modules/`                               | Nghiệp vụ tài khoản, học tập, gia sư, cộng đồng, tài chính |
| `backend/app/models/`                                | 25 model SQLAlchemy và enum                                |
| `backend/migrations/`                                | Lịch sử Alembic đầy đủ từ 0001 đến 0008                    |
| `backend/tests/`, `frontend/tests/`                  | Kiểm thử API, nghiệp vụ, concurrency và client             |
| `frontend/src/components/`, `frontend/src/services/` | UI và logic client dùng chung                              |
| `docs/`                                              | Vận hành, cấu trúc và giới hạn tích hợp                    |

[Vercel Services](docs/vercel.md) chạy frontend tại `/` và FastAPI tại `/api/*`.
Push code lên GitHub không tự cập nhật Supabase: sau khi backup và kiểm tra
cấu hình DB đích, chạy `python -m alembic upgrade head` trong môi trường deploy.
Không xóa migration cũ khi chuyển repo. Head hiện tại là `0011_booking_integrity`.

Tệp chat đang lưu trên ổ đĩa local; cần kho lưu trữ bền vững trước khi dùng
upload trên serverless. Video nhúng phụ thuộc quyền và chính sách nhà cung cấp;
Drive preview không hỗ trợ theo dõi thời gian xem. VNPAY cần merchant/IPN HTTPS
được cấu hình và kiểm thử riêng; CI không thực hiện thanh toán thật.
