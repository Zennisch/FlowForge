# FlowForge Client - UI/UX Design Specification
**Module:** Workflow Builder (Create/Edit)
**Version:** 2.0 (Canvas Paradigm)
**Target Vibe:** Visual Programming, Interactive, Contextual, Pro-developer.

---

## 1. Cấu trúc Layout Tổng thể (The Split Layout)

Màn hình chia làm 2 phần chính:
*   **Main Area (70% - 75% width):** Bảng vẽ Canvas tương tác (The Graph).
*   **Right Sidebar (25% - 30% width):** Panel Cấu hình theo ngữ cảnh (Contextual Inspector).

### 1.1. Top Header (Toolbar)
*   **Bên trái:** Nút Back (`<-`), Breadcrumbs (`Workflows / Create`), Input đổi tên Workflow trực tiếp (Click-to-edit Title).
*   **Bên phải:**
    *   Toggle Button: `Active` / `Inactive`.
    *   Nút "Save Workflow" (Primary, màu Brand).

---

## 2. Main Area: The Visual Canvas

Thay vì form Steps và Edges, người dùng sẽ thao tác trực tiếp trên đồ thị.

*   **Background:** Nền màu xám cực nhạt (`#FAFAFA` hoặc bg-grid dotted) để có cảm giác "bảng vẽ". Có tính năng Zoom in/out, Panning (kéo thả quanh bảng).
*   **Khởi tạo mặc định:** Khi tạo mới, Canvas luôn có sẵn 1 Node đầu tiên gọi là **[Trigger Node]** (Không thể xóa).
*   **Thêm Step mới (Nodes):**
    *   Dưới mỗi Node sẽ có một nút `[ + ]` nhỏ (Plus Handle).
    *   Người dùng click vào `[ + ]` -> Xổ ra 1 menu chọn loại Step (`HTTP`, `Transform`, `Store`, `Branch`).
    *   Chọn xong -> Canvas tự vẽ ra một Node mới và **tự động nối mũi tên (Edge)** từ Node cũ sang Node mới. (Giải quyết hoàn toàn việc bắt user tự map Edge ID).
*   **Branching (Rẽ nhánh):** Nếu là `Branch Step`, nó sẽ có nhiều điểm `[ + ]` ở dưới để tẻ ra các luồng khác nhau.

---

## 3. Right Sidebar: Contextual Inspector (Trái tim của cấu hình)

Thay vì cuộn một form dài ngoằng, Right Sidebar sẽ thay đổi nội dung phụ thuộc vào việc người dùng đang **Click vào Node nào trên Canvas**.

### 3.1. Trạng thái 1: Khi Click vào "Trigger Node"
Sidebar hiển thị cấu hình cho Trigger (Thay thế cho khu vực Workflow metadata cũ).

*   **Section 1: General Info**
    *   `Description`: Textarea nhỏ.
*   **Section 2: Trigger Configuration**
    *   `Trigger Type`: Dropdown (Manual, Webhook, Schedule). Đổi UI của các input bên dưới ngay lập tức.
    *   **Nếu chọn WEBHOOK:**
        *   Tối ưu UI URL: Hiển thị Base URL mờ `https://api.flowforge.com/webhook/.../` kèm một input liền kề để gõ `<path>`. Cạnh đó bắt buộc phải có nút **[Copy URL]** nổi bật.
        *   `Method`: Dropdown (GET, POST...).
        *   `Webhook Secret`: Password input có nút (Show/Hide).
    *   **Nếu chọn SCHEDULE:**
        *   `Cron Expression`: Input gõ cron.
        *   *UX Tối thượng:* Ngay bên dưới ô nhập Cron, PHẢI có một dòng text generate tự động dịch cron ra tiếng người (Ví dụ gõ `0 */5 * * *` -> Dòng text hiện: *"Runs every 5 minutes"*). Chặn đứng việc dev gõ sai cron.
        *   `Timezone`: Select dropdown có search (Autosuggest).
*   **Section 3: Additional Config**
    *   Tích hợp lại **Monaco Editor (Code Editor)** mà bạn đã làm rất tốt ở trang Trigger hôm trước vào đây.

### 3.2. Trạng thái 2: Khi Click vào "Step Node" (VD: fetch-order)
Sidebar hiển thị cấu hình cho Step đó (Thay thế cho mảng Steps cũ).

*   **Header Sidebar:** Tên của Step (Mặc định lấy StepType, cho phép click để đổi tên ID, VD: `fetch-order`).
*   **Section 1: Step Properties**
    *   `Type`: Dropdown đổi loại Step (http, transform...). Đổi icon trên Node tương ứng.
*   **Section 2: Error Handling (Retry Policy)**
    *   Đưa vào một Accordion (Mở/Đóng) có tên "Retry & Error Handling".
    *   Trong này chứa: `Max attempts` (Number input) và `Backoff` (Dropdown: Exponential/Fixed).
*   **Section 3: Step Config (JSON object)**
    *   Lại tiếp tục sử dụng **Monaco Editor** full-width trong sidebar cho phần này.
*   **Section 4: Danger Zone**
    *   Nút "Delete Step" (Màu đỏ, outline) nằm dưới cùng. Click vào sẽ xóa Node khỏi Canvas và đứt các luồng Edges.

### 3.3. Trạng thái 3: Khi Click vào Vùng trống (Background)
Sidebar hiển thị thông tin chung: Metadata workflow, ID, Ngày tạo, Thống kê tổng số nodes/edges.

---

## 4. Dữ liệu ngầm (Data Mapping)

Đây là điểm tuyệt vời nhất của kiến trúc này: Canvas sẽ tự động sync 1-1 với Contract Backend.
*   Tập hợp các Nodes trên Canvas -> Tự map ra Array `steps: WorkflowStep[]`.
*   Tập hợp các đường nối (Arrows) giữa các Nodes -> Tự map ra Array `edges: WorkflowEdge[]`.
*   Khi ấn Save, Frontend gom Cấu hình Trigger ở Node Đầu + Cấu hình các Step Nodes + Edges lại thành 1 JSON bự đẩy lên Backend qua `CreateWorkflowRequest`.