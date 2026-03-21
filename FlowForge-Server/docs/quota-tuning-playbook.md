# Quota Tuning Playbook

Tai lieu nay huong dan cach chinh quota theo tai truoc khi khoi dong server, giam noisy-neighbor va giu on dinh cho workflow engine.

## 1. Muc tieu

- Bao ve he thong khoi dot bien trigger va workflow qua lon.
- Dam bao cong bang giua cac tenant.
- Cho phep operator chinh quota theo moi truong ma khong can sua code.
- Bat loi cau hinh sai ngay luc startup (fail-fast).

## 2. Nhom quota va bien moi truong

### 2.1 Execution Trigger Quotas

- `TRIGGER_PAYLOAD_MAX_BYTES`: gioi han kich thuoc payload trigger.
- `TRIGGER_RATE_LIMIT_WINDOW_SECONDS`: cua so fixed-window cho rate limit trigger.
- `TRIGGER_RATE_LIMIT_MAX_REQUESTS`: so trigger toi da trong moi window.
- `TENANT_MAX_RUNNING_EXECUTIONS`: so execution `pending + running` toi da theo tenant.
- `WORKFLOW_MAX_RUNNING_EXECUTIONS`: so execution `pending + running` toi da theo workflow.

### 2.2 Workflow CRUD Business Limits

- `WORKFLOW_MAX_PER_TENANT`: so workflow toi da mot tenant co the tao.
- `WORKFLOW_MAX_STEPS_PER_WORKFLOW`: so step toi da trong mot workflow.
- `WORKFLOW_MAX_EDGES_PER_WORKFLOW`: so edge toi da trong DAG.
- `WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT`: so workflow schedule dang active toi da.
- `WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT`: so workflow webhook dang active toi da.
- `WORKFLOW_MAX_DEFINITION_BYTES`: gioi han kich thuoc workflow definition.

## 3. Fail-fast startup validation

Khi server bootstrap, cac bien quota neu da khai bao bat buoc phai la so nguyen duong.
Neu sai dinh dang (vi du `abc`, `0`, `-1`) server se dung ngay voi loi cau hinh.

Rang buoc cheo duoc enforce:

- `WORKFLOW_MAX_RUNNING_EXECUTIONS` phai nho hon hoac bang `TENANT_MAX_RUNNING_EXECUTIONS`.

Muc dich la tranh truong hop he thong chay voi default ngoai y muon.

## 4. Preset de xuat theo moi truong

### 4.1 Development (nho, de debug)

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

### 4.2 Staging (gan production, co soak test)

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

### 4.3 Production (can bang fairness va throughput)

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

## 5. Quy trinh tuning khuyen nghi

1. Chon preset gan nhat voi moi truong hien tai.
2. Chinh file env truoc khi run server.
3. Khoi dong app va xac nhan khong co loi fail-fast.
4. Theo doi 3 nhom chi so trong 24-72h:
   - Ty le bi reject 413 (payload qua lon).
   - Ty le bi reject 429 (rate-limit va concurrent limit).
   - Do tre queue/worker va so execution running trung binh.
5. Dieu chinh tung bien theo buoc nho 10-20% moi lan.
6. Lap lai cho den khi on dinh.

## 6. Cach doc trieu chung de dieu chinh nhanh

- Nhieu loi 413:
  - Kiem tra payload thua thong tin; toi uu client payload truoc.
  - Chi tang `TRIGGER_PAYLOAD_MAX_BYTES` neu co ly do nghiep vu ro rang.

- Nhieu loi 429 do trigger:
  - Neu traffic hop le tang `TRIGGER_RATE_LIMIT_MAX_REQUESTS` theo buoc nho.
  - Neu la burst ngan, co the giu request cap va xu ly queue phia client.

- Nhieu loi 429 do concurrent:
  - Tang `TENANT_MAX_RUNNING_EXECUTIONS` neu worker/database con du headroom.
  - Tang `WORKFLOW_MAX_RUNNING_EXECUTIONS` theo workflow quan trong, nhung phai giu <= tenant cap.

- Lien tuc vuot workflow quota:
  - Danh gia lai governance tenant.
  - Uu tien tieu chuan hoa va tai su dung workflow thay vi mo rong vo han.

## 7. Rule an toan khi thay doi quota

- Moi lan chi doi 1-2 bien de de quy ket nguyen nhan.
- Khong tang dong thoi rate-limit va concurrent qua lon trong 1 dot.
- Luon co rollback value truoc thay doi.
- Ghi lai ly do, timestamp, nguoi thay doi.

## 8. Muc tieu SLO tham khao

- Ty le reject quota hop ly trong gio cao diem: 0.5% - 2% (de bao ve he thong).
- Ty le reject sustained > 5%: can xem lai capacity va policy.
- Execution running khong duoc gan sat hard cap trong thoi gian dai.

## 9. Vi du thay doi an toan

Tinh huong: tenant lon gap nhieu 429 do concurrent, nhung CPU worker con du.

Buoc de xuat:

1. Tang `TENANT_MAX_RUNNING_EXECUTIONS` tu 100 len 120.
2. Giu nguyen `WORKFLOW_MAX_RUNNING_EXECUTIONS` trong dot dau.
3. Theo doi 24h.
4. Neu van bottleneck o 1 workflow, tang `WORKFLOW_MAX_RUNNING_EXECUTIONS` tu 50 len 60.
5. Dam bao van thoa `WORKFLOW_MAX_RUNNING_EXECUTIONS <= TENANT_MAX_RUNNING_EXECUTIONS`.

## 10. Checklist truoc khi deploy

- Da cap nhat env cua moi truong muc tieu.
- App khoi dong thanh cong, khong fail-fast config.
- Da chay test quota path trong CI.
- Da co ke hoach rollback env.
- Team van hanh nam ro nguong canh bao 413/429.
