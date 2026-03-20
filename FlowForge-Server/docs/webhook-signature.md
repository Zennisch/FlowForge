# Hướng Dẫn Ký Webhook FlowForge (Frontend)

Mục tiêu: gọi endpoint webhook theo chuẩn bảo mật mới, tránh replay và bị từ chối bởi server.

## 1. Endpoint

`POST /webhook/:userId/:path`

Ví dụ:
- `userId = 65f0c8d1f2a4b8a72d0e1234`
- `path = orders-created`
- `URL = https://api.example.com/webhook/65f0c8d1f2a4b8a72d0e1234/orders-created`

## 2. Header bắt buộc

- `x-webhook-timestamp`: thời điểm gửi request
  - Chấp nhận unix seconds, unix milliseconds, hoặc ISO-8601
- `x-webhook-nonce`: chuỗi unique cho mỗi request (không được gửi lại)

Nếu workflow có cấu hình `trigger.config.secret`, bắt buộc thêm:
- `x-webhook-signature`: HMAC SHA256 của payload ký, cho phép 2 định dạng
  - `sha256=<hex>`
  - `<hex>`

## 3. Chuỗi ký (signature payload)

Server verify theo đúng format sau (nối bằng dấu chấm):

`timestampSeconds.nonce.METHOD.path.bodySha256`

Trong đó:
- `timestampSeconds`: làm tròn xuống theo giây
- `nonce`: dùng giá trị trong `x-webhook-nonce`
- `METHOD`: in hoa (ví dụ `POST`)
- `path`: path webhook không có dấu `/` đầu-cuối, ví dụ `orders-created`
- `bodySha256`: SHA256 hex của JSON body đã canonicalize

## 4. Quy tắc canonical JSON để tính bodySha256

Cần đồng bộ với server:
- Object: sort key theo alphabet, sau đó stringify đệ quy
- Array: giữ nguyên thứ tự phần tử
- Primitive: dùng `JSON.stringify`
- Nếu body `null/undefined` ở mức top-level thì dùng `{}` trước khi hash

## 5. Ví dụ JavaScript (trình duyệt)

Ghi chú: không để lộ secret trên frontend public. Nếu cần ký HMAC, nên ký ở backend/BFF.

```javascript
import CryptoJS from 'crypto-js';

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${pairs.join(',')}}`;
}

function sha256Hex(text) {
  return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

function hmacSha256Hex(secret, text) {
  return CryptoJS.HmacSHA256(text, secret).toString(CryptoJS.enc.Hex);
}

function buildWebhookHeaders({ method, path, body, secret }) {
  const nowMs = Date.now();
  const timestampSeconds = Math.floor(nowMs / 1000);
  const nonce = crypto.randomUUID();

  const normalizedPath = String(path).trim().replace(/^\/+|\/+$/g, '');
  const normalizedMethod = String(method || 'POST').trim().toUpperCase();
  const safeBody = body ?? {};
  const bodyHash = sha256Hex(stableStringify(safeBody));

  const signingPayload = [
    String(timestampSeconds),
    nonce,
    normalizedMethod,
    normalizedPath,
    bodyHash,
  ].join('.');

  const signatureHex = hmacSha256Hex(secret, signingPayload);

  return {
    'content-type': 'application/json',
    'x-webhook-timestamp': String(timestampSeconds),
    'x-webhook-nonce': nonce,
    'x-webhook-signature': `sha256=${signatureHex}`,
  };
}
```

## 6. Mã lỗi thường gặp

- `401 Unauthorized`
  - Thiếu/sai `x-webhook-timestamp`
  - Timestamp quá cũ (ngoài cửa sổ cho phép)
  - Thiếu/sai nonce, hoặc nonce đã dùng rồi (replay)
  - Workflow có secret nhưng signature không hợp lệ
- `429 Too Many Requests`
  - Vượt ngưỡng rate limit theo workflow và IP

## 7. Checklist nhanh trước khi gọi

- Mỗi request dùng nonce mới
- Timestamp là thời gian hiện tại
- Path đúng giá trị trên URL (không slash đầu-cuối)
- Body canonicalize đúng rule
- Ký HMAC đúng secret của workflow (nếu workflow có secret)
