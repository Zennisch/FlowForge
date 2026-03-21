# Quota Tuning Playbook

Tài liệu này hướng dẫn cách chỉnh quota theo tải trước khi khởi động server, giảm noisy-neighbor và giữ ổn định cho workflow engine.

## 1. Mục tiêu

- Bảo vệ hệ thống khỏi đột biến trigger và workflow quá lớn.
- Đảm bảo công bằng giữa các tenant.
- Cho phép operator chỉnh quota theo môi trường mà không cần sửa code.
- Bắt lỗi cấu hình sai ngay lúc startup (fail-fast).

## 2. Nhóm quota và biến môi trường

### 2.1 Execution Trigger Quotas

- `TRIGGER_PAYLOAD_MAX_BYTES`: giới hạn kích thước payload trigger.
- `TRIGGER_RATE_LIMIT_WINDOW_SECONDS`: cửa sổ fixed-window cho rate limit trigger.
- `TRIGGER_RATE_LIMIT_MAX_REQUESTS`: số trigger tối đa trong mỗi window.
- `TENANT_MAX_RUNNING_EXECUTIONS`: số execution `pending + running` tối đa theo tenant.
- `WORKFLOW_MAX_RUNNING_EXECUTIONS`: số execution `pending + running` tối đa theo workflow.

### 2.2 Workflow CRUD Business Limits

- `WORKFLOW_MAX_PER_TENANT`: số workflow tối đa một tenant có thể tạo.
- `WORKFLOW_MAX_STEPS_PER_WORKFLOW`: số step tối đa trong một workflow.
- `WORKFLOW_MAX_EDGES_PER_WORKFLOW`: số edge tối đa trong DAG.
- `WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT`: số workflow schedule đang active tối đa.
- `WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT`: số workflow webhook đang active tối đa.
- `WORKFLOW_MAX_DEFINITION_BYTES`: giới hạn kích thước workflow definition.

## 3. Fail-fast startup validation

Khi server bootstrap, các biến quota nếu đã khai báo bắt buộc phải là số nguyên dương.
Nếu sai định dạng (ví dụ `abc`, `0`, `-1`) server sẽ dừng ngay với lỗi cấu hình.

Ràng buộc chéo được enforce:

- `WORKFLOW_MAX_RUNNING_EXECUTIONS` phải nhỏ hơn hoặc bằng `TENANT_MAX_RUNNING_EXECUTIONS`.

Mục đích là tránh trường hợp hệ thống chạy với default ngoài ý muốn.

## 4. Preset đề xuất theo môi trường

### 4.1 Development (nhỏ, dễ debug)

```dotenv
TRIGGER_PAYLOAD_MAX_BYTES=131072
TRIGGER_RATE_LIMIT_WINDOW_SECONDS=60
TRIGGER_RATE_LIMIT_MAX_REQUESTS=30
TENANT_MAX_RUNNING_EXECUTIONS=20
WORKFLOW_MAX_RUNNING_EXECUTIONS=8

WORKFLOW_MAX_PER_TENANT=50
WORKFLOW_MAX_STEPS_PER_WORKFLOW=40
WORKFLOW_MAX_EDGES_PER_WORKFLOW=120
WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT=10
WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT=20
WORKFLOW_MAX_DEFINITION_BYTES=131072
```

### 4.2 Staging (gần production, có soak test)

```dotenv
TRIGGER_PAYLOAD_MAX_BYTES=262144
TRIGGER_RATE_LIMIT_WINDOW_SECONDS=60
TRIGGER_RATE_LIMIT_MAX_REQUESTS=90
TENANT_MAX_RUNNING_EXECUTIONS=80
WORKFLOW_MAX_RUNNING_EXECUTIONS=30

WORKFLOW_MAX_PER_TENANT=150
WORKFLOW_MAX_STEPS_PER_WORKFLOW=80
WORKFLOW_MAX_EDGES_PER_WORKFLOW=240
WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT=35
WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT=70
WORKFLOW_MAX_DEFINITION_BYTES=262144
```

### 4.3 Production (cân bằng fairness và throughput)

```dotenv
TRIGGER_PAYLOAD_MAX_BYTES=262144
TRIGGER_RATE_LIMIT_WINDOW_SECONDS=60
TRIGGER_RATE_LIMIT_MAX_REQUESTS=120
TENANT_MAX_RUNNING_EXECUTIONS=100
WORKFLOW_MAX_RUNNING_EXECUTIONS=50

WORKFLOW_MAX_PER_TENANT=200
WORKFLOW_MAX_STEPS_PER_WORKFLOW=100
WORKFLOW_MAX_EDGES_PER_WORKFLOW=300
WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT=50
WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT=100
WORKFLOW_MAX_DEFINITION_BYTES=262144
```

## 5. Quy trình tuning khuyến nghị

1. Chọn preset gần nhất với môi trường hiện tại.
2. Chỉnh file env trước khi run server.
3. Khởi động app và xác nhận không có lỗi fail-fast.
4. Theo dõi 3 nhóm chỉ số trong 24-72h:
   - Tỷ lệ bị reject 413 (payload quá lớn).
   - Tỷ lệ bị reject 429 (rate-limit và concurrent limit).
   - Độ trễ queue/worker và số execution running trung bình.
5. Điều chỉnh từng biến theo bước nhỏ 10-20% mỗi lần.
6. Lặp lại cho đến khi ổn định.

## 6. Cách đọc triệu chứng để điều chỉnh nhanh

- Nhiều lỗi 413:
  - Kiểm tra payload thừa thông tin; tối ưu client payload trước.
  - Chỉ tăng `TRIGGER_PAYLOAD_MAX_BYTES` nếu có lý do nghiệp vụ rõ ràng.

- Nhiều lỗi 429 do trigger:
  - Nếu traffic hợp lệ, tăng `TRIGGER_RATE_LIMIT_MAX_REQUESTS` theo bước nhỏ.
  - Nếu là burst ngắn, có thể giữ request cap và xử lý queue phía client.

- Nhiều lỗi 429 do concurrent:
  - Tăng `TENANT_MAX_RUNNING_EXECUTIONS` nếu worker/database còn đủ headroom.
  - Tăng `WORKFLOW_MAX_RUNNING_EXECUTIONS` theo workflow quan trọng, nhưng phải giữ <= tenant cap.

- Liên tục vượt workflow quota:
  - Đánh giá lại governance tenant.
  - Ưu tiên tiêu chuẩn hóa và tái sử dụng workflow thay vì mở rộng vô hạn.

## 7. Rule an toàn khi thay đổi quota

- Mỗi lần chỉ đổi 1-2 biến để dễ quy kết nguyên nhân.
- Không tăng đồng thời rate-limit và concurrent quá lớn trong 1 đợt.
- Luôn có rollback value trước thay đổi.
- Ghi lại lý do, timestamp, người thay đổi.

## 8. Mục tiêu SLO tham khảo

- Tỷ lệ reject quota hợp lý trong giờ cao điểm: 0.5% - 2% (để bảo vệ hệ thống).
- Tỷ lệ reject sustained > 5%: cần xem lại capacity và policy.
- Execution running không được gần sát hard cap trong thời gian dài.

## 9. Ví dụ thay đổi an toàn

Tình huống: tenant lớn gặp nhiều 429 do concurrent, nhưng CPU worker còn dư.

Bước đề xuất:

1. Tăng `TENANT_MAX_RUNNING_EXECUTIONS` từ 100 lên 120.
2. Giữ nguyên `WORKFLOW_MAX_RUNNING_EXECUTIONS` trong đợt đầu.
3. Theo dõi 24h.
4. Nếu vẫn bottleneck ở 1 workflow, tăng `WORKFLOW_MAX_RUNNING_EXECUTIONS` từ 50 lên 60.
5. Đảm bảo vẫn thỏa `WORKFLOW_MAX_RUNNING_EXECUTIONS <= TENANT_MAX_RUNNING_EXECUTIONS`.

## 10. Checklist trước khi deploy

- Đã cập nhật env của môi trường mục tiêu.
- App khởi động thành công, không fail-fast config.
- Đã chạy test quota path trong CI.
- Đã có kế hoạch rollback env.
- Team vận hành nắm rõ ngưỡng cảnh báo 413/429.
