# Hướng Dẫn Truy Vấn Execution

Tài liệu này mô tả các năng lực truy vấn sẵn sàng cho môi trường production đối với nghiệp vụ execution.

## Endpoints

### `GET /executions`
Danh sách execution theo phạm vi owner với bộ lọc đã được xác thực và phân trang bằng cursor.

Các query params được hỗ trợ:
- `status`: giá trị phân tách bằng dấu phẩy hoặc lặp lại (`pending,running,failed,cancelled,completed,compensating`)
- `workflow_id`: Mongo ObjectId của workflow
- `trigger_type`: giá trị phân tách bằng dấu phẩy hoặc lặp lại (`manual,webhook,schedule`)
- `started_from`, `started_to`: khoảng thời gian ISO-8601 cho `started_at`
- `completed_from`, `completed_to`: khoảng thời gian ISO-8601 cho `completed_at`
- `has_errors`: `true` hoặc `false`
- `q`: tìm kiếm chính xác theo `idempotency_key`, và theo `_id` khi cung cấp đúng định dạng ObjectId
- `cursor`: cursor opaque trả về từ trang trước
- `limit`: số nguyên từ 1 đến 100 (mặc định 20)

Guardrails:
- Truy vấn không có bộ lọc bị giới hạn tối đa `limit` là 50.
- Khoảng thời gian phải hợp lệ và không vượt quá 31 ngày.

Thứ tự sắp xếp:
- `created_at desc`, sau đó `_id desc` (thứ tự xác định).

Response mẫu:
```json
{
  "items": [
    {
      "_id": "...",
      "status": "running"
    }
  ],
  "page_info": {
    "limit": 20,
    "cursor": null,
    "next_cursor": "eyJjcmVhdGVkX2F0Ijoi...",
    "has_next_page": true
  }
}
```

Ví dụ:
```http
GET /executions?status=running,failed&trigger_type=manual&limit=20
Authorization: Bearer <token>
```

Ví dụ trang tiếp theo:
```http
GET /executions?status=running,failed&trigger_type=manual&limit=20&cursor=<next_cursor>
Authorization: Bearer <token>
```

### `GET /executions/summary`
Trả về số lượng execution theo từng trạng thái để phục vụ dashboard vận hành.

Các query params được hỗ trợ:
- `workflow_id`: Mongo ObjectId của workflow (tùy chọn)
- `started_from`, `started_to`: khoảng thời gian ISO-8601 cho `started_at` (tùy chọn)

Response mẫu:
```json
{
  "counts": {
    "pending": 0,
    "running": 12,
    "completed": 245,
    "failed": 4,
    "cancelled": 3,
    "compensating": 1
  },
  "total": 265
}
```

Ví dụ:
```http
GET /executions/summary?workflow_id=65f0d3fbd1d2a4b4b8f16c11&started_from=2026-03-01T00:00:00.000Z&started_to=2026-03-22T00:00:00.000Z
Authorization: Bearer <token>
```

### `GET /executions/:id/events`
Truy vấn dòng thời gian sự kiện theo phạm vi owner với phân trang cursor và bộ lọc tùy chọn.

Các query params được hỗ trợ:
- `type`: loại sự kiện phân tách bằng dấu phẩy hoặc lặp lại (`execution.started,step.failed,...`)
- `step_id`: định danh step chính xác
- `occurred_from`, `occurred_to`: khoảng thời gian ISO-8601 cho `occurred_at`
- `cursor`: cursor opaque trả về từ trang trước
- `limit`: số nguyên từ 1 đến 200 (mặc định 50)

Thứ tự sắp xếp:
- `occurred_at asc`, sau đó `_id asc`.

Response mẫu:
```json
{
  "items": [
    {
      "type": "step.started",
      "step_id": "step-1"
    }
  ],
  "page_info": {
    "limit": 50,
    "cursor": null,
    "next_cursor": "eyJvY2N1cnJlZF9hdCI6IjIwMjYtMDMtMjJUMDA6MDA6MDAuMDAwWiIsImlkIjoiLi4uIn0",
    "has_next_page": true
  }
}
```

### `POST /executions/:id/legal-hold`
Đặt legal hold cho một execution. Body tùy chọn:

```json
{
  "reason": "audit investigation 2026-03"
}
```

### `DELETE /executions/:id/legal-hold`
Gỡ legal hold và tiếp tục vòng đời lưu giữ theo chính sách.

## Ghi Chú Vận Hành

- Tất cả truy vấn đều được giới hạn theo owner thông qua danh tính JWT.
- Các compound index trong `execution.schema.ts` tối ưu truy vấn danh sách và summary theo owner.
- Truy vấn dòng thời gian sự kiện sử dụng index `execution_events` trên `(execution_id, occurred_at, _id)` và `(execution_id, type, occurred_at)`.
- Sự kiện nóng đã hết hạn đủ điều kiện lưu trữ khi `EVENT_ARCHIVE_ENABLED=true`; job lưu trữ sẽ chuyển bản ghi đủ điều kiện sang `execution_events_archive` trước khi xóa khỏi `execution_events`.
- Vòng đời legal-hold và ma trận chính sách được tài liệu hóa tại `docs/event-governance.md`.
- Với các đợt điều tra lưu lượng lớn, nên ưu tiên cửa sổ hẹp (status + workflow_id + started range).
- `cursor` là opaque token và client không nên tự phân tích.
