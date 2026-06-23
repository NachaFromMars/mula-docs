# mula-docs — Version-accurate library docs fetched on demand

> Fetch the exact documentation for any library version and inject it into the agent's context before coding. Powered by Context7 — stops the LLM from hallucinating outdated APIs.

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-blueviolet)](https://github.com/NachaFromMars)

## Overview
mula-docs solves one core problem: AI agents code against stale training data and hallucinate APIs that no longer exist. For any library, it searches Context7 (free API), fetches documentation for the exact version needed, caches it locally to avoid re-fetching, then injects the docs into the sub-agent prompt before coding begins. Fork of [Context7 by Upstash](https://github.com/upstash/context7) (MIT), adapted for OpenClaw without MCP dependency.

## Features
- **Context7-powered** — free API, broad library coverage
- **Version-accurate** — fetches docs for the exact version, not just latest
- **Local cache** — avoids redundant fetches; check version before re-fetching
- **Injection-ready** — output formatted for sub-agent prompt injection
- **Hallucination prevention** — no more invented API methods

## Usage / Quick Start
1. Search the library on Context7
2. Fetch docs for the target version
3. Cache locally
4. Inject into sub-agent prompt before coding

## When to Use / Not Use
✅ Coding with a specific library version | ✅ Need accurate API reference | ✅ Feature needing docs
❌ Library not in Context7 DB | ❌ Non-code tasks | ❌ Same version already cached

## Trigger Keywords (OpenClaw)
fetch docs, pull docs, mula-docs, library documentation, docs for library, context7, tài liệu thư viện

---
Part of the [NachaFromMars](https://github.com/NachaFromMars) OpenClaw skill ecosystem.
