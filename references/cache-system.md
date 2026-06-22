# Cache System — Cấu Trúc + TTL + Cleanup

## Thư Mục Cache

```
~/.openclaw/workspace/docs-cache/
├── _global-meta.json              # Stats tổng: total size, last cleanup
├── vercel--next.js/               # Library: owner--repo (-- thay /)
│   ├── _meta.json                 # Metadata library: version, last fetch
│   ├── middleware-jwt-auth.md     # Cached docs (query → filename)
│   └── server-components.md
├── honojs--hono/
│   ├── _meta.json
│   └── file-upload-multipart.md
└── drizzle-team--drizzle-orm/
    ├── _meta.json
    └── migration-add-column.md
```

## Quy Tắc Đặt Tên

### Library folder
- Library ID `/vercel/next.js` → folder `vercel--next.js`
- Thay `/` bằng `--`, bỏ `/` đầu
- Lowercase toàn bộ

### Cache file
- Query "middleware JWT authentication" → file `middleware-jwt-authentication.md`
- Lowercase, thay space bằng `-`, bỏ ký tự đặc biệt
- Max 80 ký tự filename

## _meta.json — Library Metadata

```json
{
  "libraryId": "/vercel/next.js",
  "libraryName": "Next.js",
  "version": "15.3.1",
  "lastSearched": "2026-03-08T10:00:00Z",
  "queries": {
    "middleware-jwt-authentication": {
      "fetchedAt": "2026-03-08T10:01:00Z",
      "expiresAt": "2026-03-09T10:01:00Z",
      "sizeBytes": 4523,
      "source": "context7-api"
    },
    "server-components": {
      "fetchedAt": "2026-03-08T09:30:00Z",
      "expiresAt": "2026-03-09T09:30:00Z",
      "sizeBytes": 6789,
      "source": "context7-api"
    }
  },
  "requestCount": 5,
  "requestCountResetAt": "2026-03-08T11:00:00Z"
}
```

## TTL (Time-To-Live)

| Loại | TTL mặc định | Lý do |
|------|-------------|-------|
| Docs cache | 24 giờ | Library docs ít thay đổi trong ngày |
| Search results | 7 ngày | Library IDs hiếm khi đổi |
| Rate limit counter | 1 giờ | Reset theo Context7 API window |

### Override TTL
- `--force` flag: bỏ qua cache, fetch mới
- `--ttl 48h`: set TTL custom cho query cụ thể
- TTL 0: không cache (one-shot fetch)

## Cache Lookup Flow

```
fetch(libraryId, query)
  │
  ├─ 1. Tính cache key: slugify(query) → filename
  │
  ├─ 2. Check file tồn tại?
  │   └─ NO → fetch API → save → return
  │
  ├─ 3. Check _meta.json → expiresAt
  │   ├─ CHƯA hết hạn → return cached content
  │   └─ HẾT HẠN → fetch API → overwrite → update meta → return
  │
  └─ 4. Nếu fetch FAIL (network/rate limit):
      ├─ Cache còn (dù expired) → return stale + warning
      └─ Không có cache → return error
```

## Cleanup

### Auto cleanup (mỗi 7 ngày hoặc khi cache > 50MB):
1. Scan toàn bộ docs-cache/
2. Xóa files expired > 7 ngày
3. Nếu vẫn > 50MB: xóa files cũ nhất theo LRU (Least Recently Used)
4. Update _global-meta.json

### Manual cleanup:
```bash
# Xóa cache 1 library
node scripts/mula-docs.mjs cache clear "/vercel/next.js"

# Xóa toàn bộ cache
node scripts/mula-docs.mjs cache clear --all

# Xem stats
node scripts/mula-docs.mjs cache list
# Output:
# docs-cache/ — 3 libraries, 8 queries, 45KB total
# vercel--next.js: 3 queries, 18KB, expires in 12h
# honojs--hono: 2 queries, 11KB, expires in 20h
# drizzle-team--drizzle-orm: 3 queries, 16KB, expires in 5h
```

## Stale-While-Revalidate

Khi docs hết hạn nhưng network fail:
- Return stale cache + warning: "[stale] Docs cached 2 ngày trước, network unavailable"
- Agent vẫn code được, chỉ docs có thể hơi cũ
- Tốt hơn không có docs gì cả

## Disk Space

- Mỗi query cache ~3-8KB (text)
- 100 queries ≈ 500KB
- Max 50MB default (configurable)
- Cleanup tự động giữ cache gọn
