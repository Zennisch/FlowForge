# FlowForge Client - UI/UX Design Specification

**Module:** Dashboard Shell (Sidebar & Top Header)
**Version:** 1.0
**Target Vibe:** High Data-Density, Observability-focused, Keyboard-centric, Minimalist.

---

## 1. Triết lý thiết kế chung (Shell Architecture)

- **App Shell Layout:** Cấu trúc cố định với `Left Sidebar` (quản lý điều hướng chính) và `Top Header` (quản lý ngữ cảnh và hành động toàn cục). Khu vực Main Content sẽ cuộn độc lập.
- **Iconography:** Sử dụng bộ icon dạng line mỏng, sắc nét (ví dụ: Lucide Icons hoặc Phosphor Icons) để tạo cảm giác kỹ thuật (technical).
- **Keyboard-first:** Hướng tới việc user thao tác nhanh, mọi công cụ trên Header/Sidebar nên hỗ trợ phím tắt (đặc biệt là Global Search).

---

## 2. Đặc tả Cột điều hướng trái (Left Sidebar)

**Mục tiêu:** Nhỏ gọn, chỉ chứa Navigation, hiển thị trạng thái ngầm, có thể thu gọn (Collapse).
**Giao diện (Visual):** Nền tối (`#09090B` - Zinc 950) cho cả Light/Dark mode để tạo sự tách biệt với vùng nội dung (Main content) và nhấn mạnh đây là "Bảng điều khiển". Đường viền phải (Border-right) mỏng, màu xám đen (`#27272A`).

### 2.1. Top Area (Brand & Workspace)

- **Logo & Brand:** Chữ "FlowForge" đặt cạnh icon bánh răng xanh (thu nhỏ lại so với bản cũ).
- **Workspace/Project Switcher (Tùy chọn tương lai):** Một dropdown mờ nhạt bên dưới logo hiển thị "Personal Workspace" hoặc tên tổ chức.

### 2.2. Primary Navigation (Dựa trên Contract)

Loại bỏ hoàn toàn phần text description dư thừa. Mỗi item bao gồm: `Icon + Label`.
Trạng thái Active: Thay vì box xanh to như cũ, đổi background thành xám nhẹ, text sáng lên và có một đường chỉ nhỏ màu Brand Blue (Cyan/Blue) ở mép trái.

1.  **Workflows**
    - _Icon:_ Nút thắt (Nodes/Edges), Git-branch, hoặc Diagram.
    - _Badge (Tùy chọn):_ Hiển thị số lượng workflow đang `active`.
2.  **Executions (Global Runs)**
    - _Icon:_ Activity pulse (Nhịp đập), Terminal, hoặc List-check.
    - _Sub-menu (Thiết kế mở rộng dựa trên `ExecutionStatus`):_ Cho phép xổ ra các menu con nhỏ mờ hơn như: _Running, Failed, Pending_. Việc này giúp user nhảy nhanh vào xem các event đang chết (`failed`) thay vì phải vào danh sách chung rồi mới filter.
3.  **Schedules / Triggers (Tương lai)**
    - _Icon:_ Clock hoặc Zap (Tia sét). Dựa trên `TriggerType` ('manual' | 'webhook' | 'schedule').

### 2.3. Bottom Area (User & System)

Loại bỏ nút "Sign out" khổng lồ.

- **System Status:** Một chấm xanh lá cực nhỏ kèm text mờ "All systems operational" (Thay cho cái badge "Session active" ở Header bản cũ).
- **User Profile (Mini):** Hiển thị Avatar (hoặc chữ cái đầu của `email`) + Email người dùng rút gọn. Click vào sẽ mở ra Menu Dropdown (Chứa: _Settings, API Keys, Theme Switcher, Sign Out_).

---

## 3. Đặc tả Thanh trên cùng (Top Header)

**Mục tiêu:** Cung cấp ngữ cảnh (bạn đang ở trang nào), thanh tìm kiếm toàn cục (Command Palette), và các hành động chính (Primary Actions).
**Giao diện (Visual):** Nền màu trong suốt kèm blur (Backdrop-blur) hoặc màu nền đồng nhất với Main Content, viền dưới (Border-bottom) cực mỏng. Chiều cao: cố định `56px` hoặc `64px`.

### 3.1. Left Area (Context - Ngữ cảnh)

- **Breadcrumbs (Đường dẫn):** Thay vì text tĩnh "Workflow Dashboard". Hãy dùng Breadcrumbs động.
  - _Ví dụ 1:_ `FlowForge` / `Workflows`
  - _Ví dụ 2:_ `Workflows` / `Data-Sync-Job-01` / `Settings`
  - _Ví dụ 3:_ `Executions` / `exe_123456789` (Màu text nhạt hơn cho cấp cha, màu Brand cho cấp hiện tại).

### 3.2. Center Area (Global Search / Command Palette)

- **Search Input:** Một thanh tìm kiếm mờ nằm giữa Header.
- **Placeholder Text:** "Search workflows, executions, or events..."
- **Phím tắt (Crucial):** Hiển thị badge nhỏ báo hiệu phím tắt `⌘ K` (Mac) hoặc `Ctrl K` (Win) ở góc phải thanh search. Khi bấm sẽ hiện popup to ở giữa màn hình để tìm kiếm nhanh theo `id`, `name`, hoặc `idempotencyKey` của execution.

### 3.3. Right Area (Global Actions)

- **Notifications (Chuông):** Hiển thị cảnh báo nếu có `execution` chuyển sang trạng thái `failed` hoặc `compensating`.
- **Theme Toggle (Mặt trăng/Mặt trời):** Chuyển đổi Light/Dark mode.
- **Primary Action Button:** Di chuyển nút **"New Workflow"** từ Sidebar cũ lên đây.
  - _Thiết kế:_ Nút Solid Brand Blue, nhỏ gọn (Size: sm), bo góc vừa phải. Chỉ hiện nút này khi user đang ở màn hình danh sách Workflows.

---

## 4. Trải nghiệm Vi mô (Micro-interactions)

- **Sidebar Collapse:** Bổ sung nút bấm nhỏ xíu ở mép Sidebar cho phép thu gọn Sidebar lại chỉ còn các Icon (chừa không gian tối đa để xem DAG/Edges của Workflow hoặc Log của Execution).
- **Active State Transitions:** Các hiệu ứng hover vào menu item ở sidebar cần mượt mà, đổi màu background trong `150ms`.
