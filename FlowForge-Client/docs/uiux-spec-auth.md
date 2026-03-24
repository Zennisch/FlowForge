# FlowForge Client - UI/UX Design Specification

**Module:** Authentication (Login, Register, Forgot Password, Verification)
**Version:** 1.0
**Target Vibe:** Modern SaaS, Developer-friendly, Fast, Reliable, Event-driven.

---

## 1. Triết lý thiết kế (Design Philosophy)

- **Split-Screen Architecture:** Chuyển từ "Centered Card" sang "Split-Screen" trên Desktop.
  - **Cột trái (Branding Area):** Khẳng định vị thế và câu chuyện của sản phẩm. Sử dụng animation dạng lưới (nodes/edges) hoặc các luồng data chạy để thể hiện khái niệm "workflow automation" và "event-driven".
  - **Cột phải (Action Area):** Trải nghiệm nhập liệu tối giản, sạch sẽ, tập trung hoàn toàn vào việc chuyển đổi (conversion).
- **Theming:** Hỗ trợ Light/Dark mode. Tuy nhiên, với các tool kỹ thuật như FlowForge, **Dark Mode** nên là giao diện được ưu tiên (default) để tạo cảm giác chuyên nghiệp.
- **Gradient Flow:** Tận dụng dải màu gradient từ Logo (Cyan -> Blue) làm điểm nhấn cho các tương tác chính, tượng trưng cho dòng chảy của dữ liệu (flow).

---

## 2. Hệ thống màu sắc & Typography (Design Tokens)

**Typography:**

- **Primary Font:** `Inter` hoặc `Geist` (rất phù hợp cho các tool kỹ thuật, dễ đọc chữ số và code).
- **Heading:** Font-weight 600-700, tracking tight (khoảng cách chữ hẹp lại một chút tạo sự hiện đại).

**Color Palette (Dựa trên Logo FlowForge):**

- **Primary Brand Gradient:** `linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)` (Cyan to Blue).
- **Brand Solid (Buttons):** `#2563EB` (Blue 600) với hiệu ứng hover sáng lên `#3B82F6` (Blue 500).
- **Background (Light):** `#FAFAFA` (Main) / `#FFFFFF` (Form Surface).
- **Background (Dark - Khuyên dùng):** `#09090B` (Main) / `#18181B` (Form Surface).
- **Text (Light Mode):** `#0F172A` (Slate 900) cho Heading / `#64748B` (Slate 500) cho Subtext.
- **Text (Dark Mode):** `#F8FAFC` (Slate 50) cho Heading / `#94A3B8` (Slate 400) cho Subtext.
- **Borders/Dividers:** `#E2E8F0` (Light) / `#27272A` (Dark).

---

## 3. Cấu trúc Layout Tổng thể (Desktop)

Màn hình chia làm 2 phần tỉ lệ `4:6` hoặc `5:5`.

### 3.1. Phân vùng bên trái: "The Engine Room" (Branding)

- **Background:** Màu Dark Navy sâu (`#020617`).
- **Visual Graphic:** Một animation WebGL hoặc SVG nhẹ nhàng mô phỏng các "Nodes" (điểm) đang kết nối với nhau bằng các tia sáng (thể hiện workflows & event-driven).
- **Content:** Logo FlowForge đặt ở góc trên cùng bên trái. Ở giữa là một câu Tagline lớn: _"Automate at the Speed of Thought"_ hoặc _"The Event-Driven Workflow Engine"_.
- **Testimonial/Stats (Tùy chọn):** Một dòng text nhỏ ở góc dưới: _"Powering millions of asynchronous tasks daily."_

### 3.2. Phân vùng bên phải: "The Gateway" (Authentication Forms)

- **Background:** Trắng (Light) hoặc Đen nhám (Dark).
- **Alignment:** Form được căn giữa hoàn hảo theo chiều dọc và ngang của cột phải. Độ rộng form tối đa (max-width) là `400px` để mắt không phải lia quá xa.

---

## 4. Đặc tả chi tiết từng màn hình

### 4.1. Màn hình Sign In (Login)

- **Header:**
  - Title: "Welcome back" (Size lớn, bold).
  - Subtitle: "Sign in to manage your workflows and integrations."
- **Form Inputs:**
  - **Email:** Input field với label đặt bên trên (Top-label). Loại bỏ viền xanh toàn bộ khung như bản cũ, thay bằng border màu xám nhạt, bo góc `8px` (Radius-md). Khi Focus: Border đổi sang màu Brand Blue, kèm shadow nhẹ (Glow effect).
  - **Password:** Tương tự Email. Tích hợp icon "Eye" (Show/Hide password) ở góc phải bên trong input.
  - **Forgot Password:** Đưa link "Forgot password?" lên ngang hàng với label `Password` (nằm ở góc phải của label) thay vì để dưới đáy form. Đây là UX pattern hiện đại nhất.
- **Primary Action (Nút Sign In):**
  - Button full-width.
  - Background sử dụng Brand Gradient hoặc Solid Blue.
  - Text: "Sign in" (Font weight 500).
- **Footer Form:**
  - "No account yet? **Create one**" -> Chữ "Create one" dùng màu Brand Blue, có gạch chân khi hover.
  - "Need a new verification email? **Resend**".

### 4.2. Màn hình Register (Create Account)

- _Layout giữ nguyên, chỉ thay đổi nội dung cột Form._
- **Header:** "Create your account" / "Start building your automated workflows today."
- **Inputs:** First Name & Last Name (Xếp trên cùng 1 hàng - Grid 2 cột), Email, Password.
- **Password Strength Indicator:** Thêm một thanh progress bar nhỏ xíu dưới ô nhập password để báo hiệu độ mạnh (Yếu/Vừa/Mạnh) - tính năng cực kỳ cần thiết cho các platform technical.
- **Primary Action:** "Create account".

### 4.3. Màn hình Forgot Password

- **Header:** "Reset your password" / "Enter your email address and we will send you a link to reset your password."
- **Inputs:** Chỉ duy nhất 1 ô Email.
- **Actions:**
  - Nút "Send reset link".
  - Nút phụ (Secondary button / Ghost button) bên dưới: "<- Back to sign in" với icon mũi tên.

### 4.4. Màn hình Verification (Check your email)

- **Visual:** Thay vì form nhập liệu, hiển thị một Icon phong bì thư (Mail) to, cách điệu đẹp mắt ở giữa.
- **Header:** "Check your inbox"
- **Content:** "We've sent a temporary link to **user@email.com**. Please check your email to verify your account."
- **Action:** Nút "Open email app" (mở mailto: mặc định) hoặc "Resend email".

---

## 5. Trải nghiệm Vi mô & Chuyển động (Micro-interactions & Animations)

- **Page Load:** Khi mở trang, cột Branding hiện ra trước (fade in), sau đó cột Form trượt nhẹ từ phải sang trái (Slide in right - duration: 300ms, easing: ease-out).
- **Button Loading State:** Khi bấm "Sign in", chữ trên nút biến mất, thay bằng một spinner/loader đang xoay. Nút chuyển sang trạng thái `disabled` để ngăn user bấm 2 lần (Double-submit).
- **Error Handling (Inline):** Nếu nhập sai pass/email, không dùng alert popup. Viền ô input chuyển sang màu Đỏ (`#EF4444`), và dòng chữ báo lỗi màu đỏ xuất hiện ngay _dưới_ ô input kèm hiệu ứng rung nhẹ (Shake animation).
- **Focus Ring:** Mọi thành phần có thể tương tác (inputs, buttons, links) đều phải có `ring` (viền focus) rõ ràng khi người dùng sử dụng phím `Tab` trên bàn phím (Accessibility).

---

## 6. Responsive Design (Mobile & Tablet)

- **Tablet (dưới 1024px) & Mobile (dưới 768px):**
  - Layout Split-Screen bị hủy bỏ.
  - Cột Branding (Bên trái) bị ẩn đi (Display: none).
  - Form Auth sẽ chiếm toàn bộ màn hình, được căn giữa như một "Centered Card" nhưng chiếm toàn bộ width trên mobile.
  - Bổ sung Logo FlowForge thu nhỏ đặt ở trên cùng đỉnh Form để giữ nhận diện thương hiệu.
