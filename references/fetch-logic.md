# Fetch Logic — Chi Tiết API + Xử Lý

## Context7 API v2

Base URL: `https://context7.com/api`

### 1. Search Library

```
GET /v2/libs/search?query={query}&libraryName={name}
```

**Params:**
- `query` (required): Câu hỏi/task của user — dùng để LLM ranking
- `libraryName` (required): Tên library cần tìm

**Response (JSON):**
```json
{
  "results": [
    {
      "id": "/vercel/next.js",
      "name": "Next.js",
      "version": "15.3.1",
      "totalSnippets": 12847,
      "trustScore": 0.95,
      "description": "The React Framework for the Web"
    }
  ]
}
```

**Lưu ý:**
- `id` là library ID dùng cho bước fetch — format: `/owner/repo` hoặc `/owner/repo:version`
- `totalSnippets` cho biết docs phong phú cỡ nào
- `trustScore` thể hiện độ tin cậy nguồn

### 2. Fetch Context (Docs)

```
GET /v2/context?query={query}&libraryId={libraryId}
```

**Params:**
- `query` (required): Query cụ thể cần docs (ví dụ: "file upload multipart")
- `libraryId` (required): ID từ bước search (ví dụ: "/honojs/hono")

**Response (text):**
Trả về text thuần — code snippets + explanations, đã format sẵn cho LLM context.

**Response JSON (thêm `&type=json`):**
```json
{
  "codeSnippets": [
    {
      "filepath": "docs/api/request.md",
      "content": "## File Upload\n\n```ts\napp.post('/upload', async (c) => {\n  const body = await c.req.parseBody()\n  const file = body['file']\n})\n```",
      "startLine": 45,
      "endLine": 52
    }
  ],
  "infoSnippets": [
    {
      "title": "Request Body Parsing",
      "content": "Hono supports multipart/form-data...",
      "source": "https://hono.dev/docs/api/request"
    }
  ]
}
```

### 3. Headers

```
CONTEXT7_API_KEY: ctx7sk_xxxx  (optional — tăng rate limit)
```

Không có key vẫn dùng được, rate limit thấp hơn (~100 req/hour).

## Luồng Xử Lý Trong Script

```
1. USER gọi: mula-docs search "hono"
   │
   ├─ Gọi GET /v2/libs/search?query=hono&libraryName=hono
   ├─ Parse JSON response
   ├─ Format + hiển thị results
   └─ Return library IDs

2. USER gọi: mula-docs fetch "/honojs/hono" "file upload"
   │
   ├─ Check cache trước (docs-cache/honojs--hono/file-upload.md)
   │   ├─ Cache HIT + chưa hết hạn → return cached
   │   └─ Cache MISS hoặc hết hạn → tiếp
   ├─ Gọi GET /v2/context?query=file+upload&libraryId=/honojs/hono
   ├─ Nhận response text
   ├─ Lưu vào cache file
   ├─ Cập nhật _meta.json (timestamp, query, libraryId)
   └─ Return docs text

3. USER gọi: mula-docs inject "/honojs/hono" "file upload"
   │
   ├─ Đọc cached docs
   ├─ Format thành prompt-friendly block:
   │   ```
   │   ## Reference Documentation: Hono.js — File Upload
   │   Source: Context7 (cached 2026-03-08)
   │   ---
   │   [docs content]
   │   ---
   │   Dùng tài liệu trên làm reference khi code. Ưu tiên API và patterns từ docs.
   │   ```
   └─ Output to stdout (agent đọc + inject)
```

## Error Handling

| HTTP Status | Ý nghĩa | Xử lý |
|-------------|---------|-------|
| 200 | OK | Parse + cache |
| 404 | Library không tồn tại | Thông báo user, gợi ý search lại |
| 429 | Rate limited | Thông báo + suggest API key. Dùng cache nếu có |
| 401 | API key sai | Bỏ key, thử không key |
| 500+ | Server error | Retry 1 lần, sau đó dùng cache fallback |
| Network | Mất mạng | Dùng cache. Không cache → báo lỗi |

## Rate Limiting

- Free (không key): ~100 requests/hour
- Với API key (ctx7sk_xxx): cao hơn, tùy plan
- Script tự track request count trong _meta.json
- Khi gần limit: ưu tiên cache, giảm fetch

## Quy Tắc Sử Dụng Trong Agent

1. **Trước khi code**: luôn check có cần fetch docs không
2. **Search trước, fetch sau**: không đoán library ID
3. **Query cụ thể**: "middleware JWT authentication" tốt hơn "middleware"
4. **Cache first**: luôn check cache trước khi fetch
5. **Inject ngắn gọn**: chỉ inject docs liên quan, không dump toàn bộ
