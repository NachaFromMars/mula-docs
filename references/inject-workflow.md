# Inject Workflow — Đưa Docs vào Sub-Agent Prompt

## Tổng Quan

Sau khi fetch và cache docs, bước cuối là **inject** vào prompt của sub-agent để code chính xác. Có 2 cách:

1. **Manual inject** — Agent đọc output của `inject` command, paste vào prompt
2. **Auto inject** — Agent tự động detect library cần dùng, fetch + inject trong workflow

## Cách 1: Manual Inject

### Workflow

```
1. User: "Build API upload file với Hono.js"

2. Main agent chạy:
   node scripts/mula-docs.mjs search "hono"
   → Tìm được /honojs/hono

3. Main agent chạy:
   node scripts/mula-docs.mjs fetch "/honojs/hono" "file upload multipart"
   → Docs cached

4. Khi spawn sub-agent code, main agent:
   - Chạy: node scripts/mula-docs.mjs inject "/honojs/hono" "file upload"
   - Lấy output
   - Thêm vào message cho sub-agent

5. Sub-agent nhận prompt:
   """
   Task: Build API upload file với Hono.js

   ## Reference Documentation: /honojs/hono
   Source: Context7 (cached 2026-03-08)
   ---
   [docs content với code examples]
   ---
   Use the documentation above as reference when coding.

   Yêu cầu:
   - Endpoint POST /upload
   - Accept multipart/form-data
   - Validate file size
   """

6. Sub-agent code dựa trên docs → API đúng
```

### Ví Dụ Sessions_Spawn

```javascript
// Main agent code
const docsOutput = await exec('node scripts/mula-docs.mjs inject "/honojs/hono" "file upload"');

const task = `Build API upload file với Hono.js.

${docsOutput}

Requirements:
- POST /upload endpoint
- Accept multipart/form-data
- Max 10MB file size
- Return file URL after upload`;

await sessions_spawn({
  task: "Build Hono file upload API",
  message: task,
  notify: true
});
```

## Cách 2: Auto Inject (Trong Agent Workflow)

### Pattern: Detect → Fetch → Inject → Code

Khi agent nhận task code, tự động:

```
1. DETECT libraries cần dùng (từ task description + codebase)
   - Parse: "Build với Hono.js, Drizzle ORM, Zod"
   - Hoặc: đọc package.json → extract dependencies

2. SEARCH mỗi library trên Context7
   - Bỏ qua nếu không có trên Context7
   - Cache library ID vào meta

3. FETCH docs cho query liên quan đến task
   - Task: "file upload" → query "file upload multipart"
   - Task: "add column migration" → query "migration alter table"

4. INJECT vào coding prompt
   - Gộp docs từ nhiều libraries
   - Ưu tiên libraries chính (Hono > lodash)
   - Giới hạn ~8000 tokens docs (tránh context bloat)

5. CODE với docs reference
```

### Pseudo-code

```javascript
async function codeWithDocs(task, codebaseDir) {
  // 1. Detect libraries
  const pkgJson = await read(`${codebaseDir}/package.json`);
  const deps = Object.keys(JSON.parse(pkgJson).dependencies || {});
  
  // 2. Prioritize main frameworks
  const priority = ['next', 'hono', 'express', 'drizzle', 'prisma', 'expo'];
  const mainLibs = deps.filter(d => priority.some(p => d.includes(p))).slice(0, 3);
  
  // 3. Extract query from task
  const query = extractKeywords(task); // "file upload validation" etc
  
  // 4. Fetch + inject for each
  let docsContext = '';
  for (const lib of mainLibs) {
    const searchResult = await exec(`node mula-docs.mjs search "${lib}"`);
    const libraryId = parseFirstResult(searchResult);
    if (libraryId) {
      await exec(`node mula-docs.mjs fetch "${libraryId}" "${query}"`);
      const docs = await exec(`node mula-docs.mjs inject "${libraryId}" "${query}"`);
      docsContext += docs + '\n\n';
    }
  }
  
  // 5. Build prompt
  const prompt = `${task}\n\n${docsContext}\n\nCode according to the documentation above.`;
  
  // 6. Spawn coding agent
  return sessions_spawn({ task, message: prompt });
}
```

## Best Practices

### DO ✅
- Query cụ thể: "middleware JWT authentication" thay vì "middleware"
- Cache first: check cache trước mỗi lần fetch
- Giới hạn docs: max 3 libraries, ~8000 tokens
- Include source URL: giúp agent biết docs từ đâu

### DON'T ❌
- Dump toàn bộ library docs (quá nhiều token)
- Fetch nhiều queries cùng lúc (rate limit)
- Bỏ qua cache (tốn API calls không cần thiết)
- Inject docs không liên quan đến task

## Output Format

```
## Reference Documentation: /honojs/hono
Source: Context7 (cached 2026-03-08)
---
[code snippets với syntax highlighting]
[explanations]
[API reference]
---
Use the documentation above as reference when coding. 
Prefer APIs and patterns from these docs over training data.
```

## Token Budget

| Thành phần | Tokens ước tính |
|------------|----------------|
| 1 library docs (1 query) | ~1500-3000 |
| 3 libraries (3 queries) | ~6000-9000 |
| Task description | ~200-500 |
| System prompt | ~1000-2000 |
| **Total context** | ~8000-12000 |

Để dành ~100K tokens cho code + reasoning của agent.
