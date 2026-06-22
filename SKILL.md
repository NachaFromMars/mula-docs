---
name: mula-docs
description: "Kéo documentation mới nhất theo đúng version cho bất kỳ library nào, cache local, inject vào context khi code. Dùng khi: agent cần code với library cụ thể (Next.js, Hono, Drizzle, Expo...), muốn docs chính xác theo version, tránh hallucinate API. Triggers: fetch docs, pull docs, use docs, mula-docs, tài liệu thư viện, docs mới nhất, context7, library documentation."
---

# Mula Docs — Live Documentation Fetching for OpenClaw

> "Không đoán API — đọc docs rồi mới code."

## Tổng Quan

Mula Docs giải quyết 1 vấn đề cốt lõi: **AI code sai vì dựa trên training data cũ**.

Khi agent cần code với library X version Y:
1. **Search** — tìm library trên Context7 API (miễn phí)
2. **Fetch** — kéo docs đúng version, đúng context (code examples + API reference)
3. **Cache** — lưu local, tránh fetch lại
4. **Inject** — đưa docs vào prompt của sub-agent khi code

Fork từ: [Context7](https://github.com/upstash/context7) (Upstash, MIT License)
Adapt cho: OpenClaw (không cần MCP, dùng web_fetch + exec + file cache)

## Khi Nào Dùng

- Agent cần code với library cụ thể
- Muốn tránh hallucinate API không tồn tại
- Cần code examples đúng version
- Sub-agent code feature mới cần docs reference

## Khi Nào KHÔNG Dùng

- Library quá nhỏ/niche (không có trên Context7 DB)
- Task không liên quan code
- Đã có docs cached và version chưa đổi

## Quy Trình — 4 Bước

### Bước 1: Search Library

Tìm library ID trên Context7:

```bash
node scripts/mula-docs.mjs search "next.js"
```

Output:
```json
[
  {"id": "/vercel/next.js", "name": "Next.js", "version": "15.3", "snippets": 12847},
  {"id": "/vercel/next.js:14", "name": "Next.js 14", "version": "14.2", "snippets": 8234}
]
```

Chọn library ID phù hợp version cần dùng.

### Bước 2: Fetch Docs

Kéo docs theo query cụ thể:

```bash
node scripts/mula-docs.mjs fetch "/vercel/next.js" "middleware authentication JWT"
```

Output: docs với code examples, API reference, lưu vào cache.

### Bước 3: Cache

Docs được cache tại:
```
~/.openclaw/workspace/docs-cache/
├── vercel--next.js/
│   ├── middleware-authentication-jwt.md
│   ├── server-components.md
│   └── _meta.json (timestamps, version)
├── drizzle-team--drizzle-orm/
│   └── ...
```

Cache tự hết hạn sau **24h** (configurable). Fetch lại khi cần.

### Bước 4: Inject vào Sub-Agent

Khi spawn sub-agent code:

```
1. Xác định libraries cần dùng (từ task description)
2. Chạy search → fetch cho mỗi library
3. Đọc cached docs
4. Inject vào prompt: "Dùng tài liệu sau làm reference..."
5. Sub-agent code dựa trên docs chính xác
```

## Ví Dụ Sử Dụng

### Ví dụ 1: Code Hono.js endpoint

```
User: "Tạo API endpoint upload file với Hono.js"

Agent:
1. node scripts/mula-docs.mjs search "hono"
   → ID: /honojs/hono
2. node scripts/mula-docs.mjs fetch "/honojs/hono" "file upload multipart"
   → Cache: docs-cache/honojs--hono/file-upload-multipart.md
3. Đọc cached docs → inject vào code prompt
4. Code đúng API: c.req.parseBody(), không đoán
```

### Ví dụ 2: Drizzle ORM migration

```
User: "Tạo migration thêm column với Drizzle"

Agent:
1. search "drizzle orm" → /drizzle-team/drizzle-orm
2. fetch "migration add column alter table"
3. Code đúng: import { sql } from 'drizzle-orm/sql'
   thay vì đoán API cũ
```

## API Reference

Chi tiết: `references/fetch-logic.md`

### Context7 API (miễn phí, không cần key)

| Endpoint | Mục đích |
|----------|---------|
| `GET /v2/libs/search?query=X&libraryName=Y` | Tìm library |
| `GET /v2/context?query=X&libraryId=Y` | Kéo docs |

Base URL: `https://context7.com/api`

Rate limit: ~100 req/hour (free tier). Có API key thì cao hơn.

### Script CLI

```bash
# Search
node scripts/mula-docs.mjs search "next.js"

# Fetch + cache
node scripts/mula-docs.mjs fetch "/vercel/next.js" "middleware auth" [--force]

# List cache
node scripts/mula-docs.mjs cache list

# Clear cache
node scripts/mula-docs.mjs cache clear "/vercel/next.js"

# Inject — đọc cache, output docs cho sub-agent prompt
node scripts/mula-docs.mjs inject "/vercel/next.js" "middleware auth"
```

## Cấu Trúc Skill

```
mula-docs/
├── SKILL.md                    # File này
├── scripts/
│   └── mula-docs.mjs           # CLI: search, fetch, cache, inject
├── references/
│   ├── fetch-logic.md           # Chi tiết API + error handling
│   ├── cache-system.md          # Cache structure + TTL + cleanup
│   └── inject-workflow.md       # Cách inject docs vào sub-agent prompt
```

## Xử Lý Lỗi

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|-----------|
| Rate limited (429) | Quá 100 req/h | Chờ 1h hoặc dùng API key |
| Library not found | Tên sai hoặc chưa index | Thử tên khác, check context7.com |
| Empty docs | Query quá chung | Query cụ thể hơn |
| Network error | Mất mạng | Dùng cached docs nếu có |

## Ghi Chú

- Fork từ Context7 (MIT) — adapt cho OpenClaw, không dùng MCP
- Cache mặc định 24h — đủ cho đa số use case
- Không cache toàn bộ docs — chỉ cache theo query (tiết kiệm disk)
- API miễn phí, không cần key (nhưng có key thì tốt hơn)
