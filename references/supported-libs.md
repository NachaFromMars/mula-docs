# Supported Libraries — Danh Sách & Tips

## Libraries Phổ Biến (đã test hoạt động)

| Library | Context7 ID | Snippets | Ghi chú |
|---------|-------------|----------|---------|
| Next.js | /vercel/next.js | 2238 | Official docs |
| Next.js (full) | /llmstxt/nextjs_llms-full_txt | 40721 | Community, nhiều hơn |
| Hono | /llmstxt/hono_dev_llms_txt | - | hono.dev docs |
| Drizzle ORM | /drizzle-team/drizzle-orm-docs | - | Official docs |
| Expo | /expo/expo | - | React Native |
| React | /websites/react_dev | - | react.dev |
| Tailwind CSS | /tailwindlabs/tailwindcss.com | - | Official docs |
| Prisma | /prisma/docs | - | ORM docs |
| Zod | /colinhacks/zod | - | Validation |
| tRPC | /websites/trpc_io | - | Type-safe API |

## Quy Tắc Chọn Library ID

### Khi có nhiều kết quả
Search thường trả về nhiều versions:
- `/vercel/next.js` — official, ít snippets hơn
- `/llmstxt/nextjs_llms_txt` — community, nhiều snippets hơn
- `/websites/nextjs` — website crawl

**Ưu tiên:**
1. Official (`/org/repo-docs`, `/org/repo`)
2. llmstxt versions (nhiều snippets, tốt cho LLM)
3. Websites (backup)

### Version-specific
Một số libraries có version suffix:
- `/vercel/next.js:14` — Next.js 14 specifically
- `/vercel/next.js:15` — Next.js 15

Kiểm tra version trong kết quả search.

## Libraries KHÔNG Có trên Context7

Context7 tập trung vào:
- ✅ Major frameworks (React, Vue, Angular, Svelte)
- ✅ Popular packages (lodash, axios, date-fns)
- ✅ Database tools (Prisma, Drizzle, TypeORM)
- ✅ Build tools (Vite, Webpack, esbuild)

Có thể KHÔNG có:
- ❌ Packages quá nhỏ/niche (<1000 stars)
- ❌ Internal/private packages
- ❌ Packages mới (chưa index)

**Fallback:** Nếu không có trên Context7, dùng:
1. GitHub README trực tiếp
2. Official docs qua web_fetch
3. Training knowledge (có thể outdated)

## Query Tips Theo Library

### Next.js
```
"app router server components"
"middleware authentication"
"api routes POST handler"
"dynamic routes params"
"metadata SEO"
```

### Hono
```
"file upload multipart"
"middleware cors"
"validator zod"
"jwt authentication"
"streaming response"
```

### Drizzle ORM
```
"migration add column"
"relations one to many"
"select where condition"
"insert returning"
"transaction rollback"
```

### Expo
```
"camera permissions"
"push notifications"
"file system"
"navigation stack"
"build production"
```

### Prisma
```
"findMany where"
"create nested"
"update many"
"migration deploy"
"raw query"
```

### Zod
```
"object schema"
"array validation"
"transform pipe"
"error messages custom"
"infer types"
```

## Cập Nhật Danh Sách

Context7 liên tục thêm libraries mới. Để check:
```bash
node scripts/mula-docs.mjs search "tên-library"
```

Nếu có kết quả → có thể dùng.
Nếu không → library chưa được index.
