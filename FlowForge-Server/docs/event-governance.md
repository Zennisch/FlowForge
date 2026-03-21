# Hướng Dẫn Quản Trị Sự Kiện

Tài liệu này định nghĩa cơ chế quản trị vòng đời lưu giữ, lưu trữ và legal hold (giữ dữ liệu theo yêu cầu pháp lý) cho các sự kiện thực thi.

## 1. Chính Sách Lưu Giữ

Nhóm lưu giữ sự kiện được xác định theo loại sự kiện khi không được chỉ định tường minh:

- `security`: `execution.failed`, `execution.cancelled`, `step.failed`, `step.retrying`, `step.compensation.failed`
- `compliance`: `execution.completed`, `execution.compensating`, `step.compensation.started`, `step.compensation.completed`
- `operational`: tất cả loại sự kiện còn lại

Khoảng thời gian lưu giữ có thể cấu hình bằng biến môi trường:

- `EVENT_RETENTION_DAYS_OPERATIONAL` (mặc định: `90`)
- `EVENT_RETENTION_DAYS_SECURITY` (mặc định: `90`)
- `EVENT_RETENTION_DAYS_COMPLIANCE` (mặc định: `90`)

Tại thời điểm ghi, mỗi sự kiện lưu các trường:

- `retention_class`
- `expires_at`
- `payload_size_bytes`

## 2. Chính Sách Lưu Trữ

Hành vi của pipeline lưu trữ:

1. Quét các bản ghi đã hết hạn trong `execution_events` với điều kiện `expires_at <= now` và `legal_hold != true`.
2. Upsert từng sự kiện vào `execution_events_archive` theo khóa duy nhất `source_event_id`.
3. Xóa các bản ghi đã lưu trữ khỏi `execution_events`.

Thông số điều khiển:

- `EVENT_ARCHIVE_ENABLED` (`true`/`false`, mặc định `false`)
- `EVENT_ARCHIVE_INTERVAL_MS` (mặc định `60000`)
- `EVENT_ARCHIVE_BATCH_SIZE` (mặc định `500`)

## 3. Quy Trình Legal Hold

Legal hold áp dụng theo phạm vi execution và ngăn các hành động của vòng đời lưu giữ.

Endpoints:

- `POST /executions/:id/legal-hold` với body tùy chọn `{ "reason": "..." }`
- `DELETE /executions/:id/legal-hold`

Hành vi:

- Khi hold đang hoạt động, các sự kiện hiện tại và tương lai của execution đó được đánh dấu `legal_hold=true` và đặt mốc không hết hạn.
- Job lưu trữ bỏ qua toàn bộ sự kiện đang bị hold.
- Khi gỡ hold, hệ thống tính lại `expires_at` từ `occurred_at` + chính sách lưu giữ và bật lại xử lý vòng đời.

## 4. Khuyến Nghị Vận Hành

- Giới hạn quyền truy cập endpoint legal-hold cho operator đáng tin cậy.
- Sử dụng chuỗi reason để truy vết và liên kết sự cố.
- Theo dõi thông lượng và độ trễ lưu trữ bằng metric định kỳ về số lượng đã chuyển/xóa.

## 5. Tăng Cường Bảo Mật Hoãn Triển Khai (Phân Quyền)

Triển khai hiện tại đang giới hạn theo owner và đáp ứng nhu cầu của giai đoạn dự án.

Các hạng mục tăng cường cho bản phát hành tương lai:

- Bổ sung vai trò operator/admin chuyên biệt cho thao tác legal-hold.
- Áp dụng kiểm tra truy cập theo vai trò cho `POST /executions/:id/legal-hold` và `DELETE /executions/:id/legal-hold`.
- Bổ sung bản ghi kiểm toán bất biến cho danh tính người giữ/gỡ hold và ngữ cảnh phê duyệt.

Trạng thái: đã được tài liệu hóa và hoãn theo quyết định; không bắt buộc trong giai đoạn hiện tại.
