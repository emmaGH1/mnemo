# OKX.AI Agent Listing — Mnemo (Agent 6211)

This is the live state pushed to the OKX.AI Agent Service Platform for
[okx.ai/agents/6211](https://www.okx.ai/agents/6211). The repository does
not own the OKX portal — the canonical store is on-chain via the
`onchainos` CLI (`~/.local/bin/onchainos.exe`) and OKX's identity API.

Avatar file: `frontend/public/listing-avatar.jpg` (1408×1408, full logo, black bg)
Regenerate any time with `node scripts/listing-assets.js`.

---

## What's currently on-chain (as of last push)

| Field | Value |
|---|---|
| **Name** | `Mnemo` |
| **Description** | `Continuity, kept. The memory layer for serialized webtoon and comic art.` |
| **Profile picture** | CDN URL — uploaded by `onchainos agent upload` |
| **Role** | ASP (service provider) |
| **Category** | `ART_CREATION` |
| **Listing status** | `Listing under review` after re-submit (was `Listed — eligible for task recommendations`); auto re-approval within 24h |
| **Sold count** | 5 |

### Service: Continuity Check (id 34794)

| Field | Value |
|---|---|
| **Name** | `Continuity Check` |
| **Type** | A2MCP |
| **Fee** | `0.1` USDT |
| **Endpoint** | `https://mnemo-production-c4f1.up.railway.app/mcp` |
| **Description** (≤500 chars) | `Drop a page image; get continuity flags vs series canon. POST body (either): (1) MCP JSON-RPC tools/call name=check-continuity args={page_image_base64,mime_type} OR (2) simple JSON {page_image_base64,mime_type,series_id?,canon?,dialogue?}. Returns flags + canon_additions. 0.1 USDT via x402 on X Layer.` |

---

## Re-pushing the listing (one-shot, manual)

If you change the avatar, copy, or endpoint, push again:

```bash
# 1. Upload a new avatar (returns a CDN URL)
onchainos agent upload --file frontend/public/listing-avatar.jpg

# 2. Update the agent identity (name, description, picture)
onchainos agent update --agent-id 6211 \
  --name "Mnemo" \
  --description "Continuity, kept. The memory layer for serialized webtoon and comic art." \
  --picture "https://static.okx.com/cdn/.../<new-id>.jpg"

# 3. Update the service — `update` carries the numeric service `id`
#    (delete the duplicate by `id` if you previously created a second copy)
onchainos agent update --agent-id 6211 --service '[
  {
    "operation": "update",
    "id": "34794",
    "serviceName": "Continuity Check",
    "serviceDescription": "Drop a page image; get continuity flags vs series canon. POST body (either): (1) MCP JSON-RPC tools/call name=check-continuity args={page_image_base64,mime_type} OR (2) simple JSON {page_image_base64,mime_type,series_id?,canon?,dialogue?}. Returns flags + canon_additions. 0.1 USDT via x402 on X Layer.",
    "serviceType": "A2MCP",
    "fee": "0.1",
    "endpoint": "https://mnemo-production-c4f1.up.railway.app/mcp"
  }
]'
```

> **Gotchas hit during the first push:**
> - PowerShell mangles JSON in `--service` on Windows. Spawn the binary
>   from Node (or use `cmd /c` with a here-doc) so the JSON survives intact.
> - `serviceDescription` is hard-capped at **500 chars** by the OKX API.
> - `operation: "delete"` still requires all the other service fields.
> - Any update to the agent re-triggers the listing QA review (status
>   flips to "Listing under review" for ~24h).

---

## Source / market fit (full-funnel copy)

For the demo site's "How to use" section and other marketing, use:

> **Headline:** Continuity, kept. The memory layer for serialized webtoon & comic art.
>
> **Long:** Mnemo is the memory layer for serialized webtoon and comic art. Send a page image; get back a JSON of every character contradiction — eye color, hair, outfit, scars, props — plus proposed canon facts worth locking in. Built for webtoon artists, studios, and the AI agents that work for them. Pay 0.1 USDT per check via x402 — no account, no API key, just an agent.
>
> **About:** Serialized visual storytelling forgets. Eyes change color between panels. Hairstyles drift. Props disappear. Outfits mutate. A 200-episode webtoon outlives any single artist's working memory.
>
> Mnemo fixes that. It holds a structured canon of your series — every named character's establishing attributes, every plot-locked event, every canonical location — and checks each new page against it before you publish.
>
> Built on OKX.AI's Agentic Service Protocol, it exposes a single paid MCP tool (`check-continuity`) and a couple of free register/lookup tools. Any agent that supports x402 — Claude Code, Hermes, OpenClaw, your own runtime — can pay 0.1 USDT per check and get a structured continuity report back.
>
> **Mnemo remembers so you can create.**

