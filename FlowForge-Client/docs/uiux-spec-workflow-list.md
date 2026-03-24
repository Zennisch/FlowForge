# FlowForge Client - UI/UX Design Specification

**Module:** Workflow Management (List View)
**Version:** 1.0
**Target Vibe:** Data-dense, CLI-like efficiency, Action-oriented, Highly scannable.

---

## 1. Triết lý thiết kế (Design Philosophy)

- **Data Density (Mật độ dữ liệu cao):** Loại bỏ các khoảng trắng thừa của thiết kế Card cũ. Sử dụng cấu trúc Table (bảng) ẩn viền (borderless) hoặc List item với các cột rõ ràng để tối đa hóa lượng thông tin hiển thị trên một màn hình.
- **Action-First (Hành động là ưu tiên):** Đưa nút Trigger (Kích hoạt) lên đầu dòng thay vì giấu bên trong chi tiết. Người dùng có thể chạy workflow ngay lập tức mà không cần chuyển trang.
- **Glanceability (Dễ dàng quét mắt):** Sử dụng các Icon và Badge màu sắc để biểu diễn `TriggerType` và `WorkflowStatus` giúp người dùng nhận diện tình trạng hệ thống chỉ trong 1 giây.

---

## 2. Bố cục trang (Page Layout)

Nằm trong Main Content Area (dưới Top Header đã thiết kế ở bước trước).

### 2.1. Page Header & Toolbar (Thanh công cụ cục bộ)

- **Title:** "Workflows" (Heading lớn) kèm sub-text "Manage and trigger your automation DAGs."
- **Tabs / Quick Filters:** Dưới title, có một dãy Tabs đơn giản để lọc nhanh: `All`, `Active`, `Inactive`.
- **Lưu ý:** Nút "New Workflow" đã được đặt ở Top Header (theo thiết kế App Shell), nên trang này không cần lặp lại nút tạo to đùng nữa, giữ cho view tập trung vào data.

### 2.2. Khung danh sách (The List Container)

- **Background:** Nền trắng (Light) hoặc đen nhám `#09090B` (Dark).
- **Border:** Viền bo góc `8px` bao quanh toàn bộ danh sách, với màu viền xám rất mờ (`border-zinc-200` / `border-zinc-800`).

---

## 3. Đặc tả Cấu trúc Dòng (Row Structure)

Mỗi Workflow là một dòng (Row) trong danh sách. Khi hover chuột vào dòng, nền của dòng đó đổi màu nhẹ (`bg-zinc-50` / `bg-zinc-800/50`) để tạo cảm giác focus.

Cấu trúc từ **Trái sang Phải** gồm các cột sau:

### Cột 1: Quick Action (Trigger)

- **Visual:** Một nút Icon "Play" (Tam giác) hình tròn, nằm gọn gàng ở đầu dòng.
- **Logic (dựa trên contract):**
  - Nếu `status === 'active'`: Nút có màu xanh dương (Brand Blue) nhạt, hover lên đậm hơn. Tooltip: _"Trigger Workflow"_.
  - Nếu `status === 'inactive'`: Nút bị `disabled`, màu xám mờ. Tooltip: _"Workflow is inactive"_.

### Cột 2: Workflow Identity (Tên & Mô tả)

- **Tên (Name):** Font weight 500, màu text chính (Đen/Trắng). Tên workflow đồng thời là một **Link** có thể click để đi vào trang chi tiết/Canvas builder.
- **Mô tả (Description):** Nằm ngay dưới Tên, font size nhỏ hơn (`text-sm`), màu xám (`text-zinc-500`). Cắt bớt (truncate `...`) nếu text quá dài (vd: max 1 dòng).

### Cột 3: Trigger Type (Loại kích hoạt)

- _Hiển thị icon kèm text nhỏ để user biết workflow này được chạy theo cách nào._
- Nếu `trigger.type === 'webhook'`: Icon ⚡️ (Tia sét) + "Webhook".
- Nếu `trigger.type === 'schedule'`: Icon 🕒 (Đồng hồ) + "Schedule".
- Nếu `trigger.type === 'manual'`: Icon 🖱️ (Bàn tay/Click) + "Manual".

### Cột 4: Topology (Quy mô Workflow)

- Hiển thị thông tin kỹ thuật để biết workflow này nặng/nhẹ ra sao.
- **Format:** `{steps.length} steps · {edges.length} edges` (Ví dụ: "5 steps · 4 edges"). Sử dụng font monospace mờ để tăng tính kỹ thuật.

### Cột 5: Status (Trạng thái)

- Sử dụng Badge nhỏ, viền bo tròn (`rounded-full`).
- Nếu `active`: Chấm tròn nhỏ màu xanh lá + text "Active" (Nền `bg-emerald-500/10`, chữ `text-emerald-500`).
- Nếu `inactive`: Chấm tròn màu xám + text "Inactive".

### Cột 6: Updated / Created

- Hiển thị thời gian `updatedAt` dưới dạng Relative Time (Ví dụ: "2h ago", "3d ago") để tối giản UI. Hover vào sẽ hiện Tooltip ngày giờ chính xác.

### Cột 7: Context Menu (Hành động khác)

- **Visual:** Nút icon 3 chấm dọc (Kebab menu) hoặc ngang (Meatballs menu) ở cuối cùng bên phải.
- **Dropdown Items:**
  1.  `Edit / View Canvas` (Icon Bút chì)
  2.  `View Executions` (Icon Activity/List - Dẫn sang trang Executions và tự động filter theo `workflowId` này).
  3.  _Divider (Đường gạch ngang)_
  4.  `Copy ID` (Copy `workflow.id` vào clipboard - Rất cần cho dev).
  5.  `Delete` (Icon Thùng rác, màu Đỏ - Click vào sẽ mở Modal Confirm).

---

## 4. Trải nghiệm Vi mô (Micro-interactions & Edge Cases)

- **Hành động Trigger (Khi bấm nút Play ở Cột 1):**
  - Dựa theo contract `TriggerExecutionRequest { payload, idempotencyKey }`.
  - Khi bấm nút Play, **KHÔNG** chạy ngay (để tránh lỡ tay). Thay vào đó, mở một **Slide-over (Panel trượt từ phải ra)** hoặc **Modal nhỏ**.
  - Trong Modal này cho phép user nhập `JSON Payload` (nếu cần) và tuỳ chọn nhập `Idempotency Key`. Có sẵn nút "Run Execution".
  - Nếu thành công: Hiển thị Toast Notification (Góc phải dưới): _"Execution triggered successfully. [View Run ->]"_
- **Empty State (Trạng thái rỗng):** Nếu danh sách không có dữ liệu (0 workflows). Hiển thị một khung đứt nét (Dashed border) ở giữa màn hình. Bên trong là Icon Diagram mờ, câu text: _"No workflows found. Build your first asynchronous process."_ và một nút "Create Workflow".
