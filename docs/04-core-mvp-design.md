# Step 4: Browser-Only Core Loop MVP Design (Local-First, Cloud-Ready)

## Goal
Ship the browser-only **Core Loop MVP** (`/app` + `/pair`) from [02-core-loop-and-mvp-scope.md](02-core-loop-and-mvp-scope.md) so it runs 100% locally on `localhost` / LAN Wi-Fi today and switches to **Supabase + Cloudflare R2** purely by adding environment variables.

## 1. End-to-End Encryption (Browser Only)
- **Workspace Master Key (`#wmk=`):** Generated in-browser (`WebCrypto` 256-bit `AES-GCM`), stored in `IndexedDB` per workspace, and shared via the QR URL `#wmk=` fragment. Never sent in HTTP requests or stored on the server.
- **Encrypted Payloads:** Text notes, links, code snippets, file metadata (name, MIME type, size), and file bytes are encrypted client-side with `AES-256-GCM` (unique 96-bit IV per item/chunk) before upload.
- **Chunked File Encryption:** Files up to **500 MB** (Free cap) are encrypted in **5 MB** chunks so large 4K `.MOV` files don't blow browser memory.

## 2. Cloud-Ready Adapter Boundary
Every server boundary uses a single interface that selects **Cloud** when env vars are present and **Local Dev** when they are unset:

| Layer | Local Dev Mode (Default) | Cloud Mode (Env Vars Set) |
| --- | --- | --- |
| **Workspaces, Devices & Feed Metadata** | `.lyga-dev-data/mvp.json` | Supabase Postgres (`supabase/migrations/0002_workspaces.sql` via `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |
| **Encrypted File Blobs** | `.lyga-dev-data/blobs/` via `/api/mvp/blobs/[key]` | Cloudflare R2 presigned `PUT`/`GET` URLs (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) |
| **Realtime Sync** | Server-Sent Events (`/api/mvp/events`) + fallback poll | Supabase Realtime (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |

## 3. Routes & User Flow
1. **`/app` (Workspace & Feed):**
   - Ensures an `httpOnly` signed workspace session cookie (`lyga_ws`).
   - Ensures `#wmk=` exists in `IndexedDB` (generates one if new).
   - Displays a scannable QR code (`${origin}/pair?code=<shortCode>#wmk=<base64urlKey>`) and paired device count (`1 / 2 devices`).
   - Composer supports text, links, code snippets, and drag-and-drop / file picker uploads.
   - Feed auto-categorizes decrypted items into **All**, **Media**, **Links**, **Code**, and **Files**, with 1-click copy, 1-click download, and 1-click delete.
   - Enforces Free tier limits (**500 MB/file**, **2 GB active storage**, **7-day file expiry**, **2 devices**) and opens the Pro Waitlist modal when a limit is hit.
2. **`/pair` (Mobile Pairing):**
   - Reads `code` from query and `#wmk=` from `window.location.hash`, saves `#wmk=` to `IndexedDB`, calls `POST /api/mvp/pair` (sets `httpOnly` cookie for that workspace if within the 2-device cap), and redirects to `/app`.

## 4. UI & Stack Guardrails
- Mantine UI (`@mantine/core`, `@mantine/hooks`) + CSS Modules only (**zero Tailwind CSS**).
- Daylight Studio Utility light theme (`#FFFFFF`, `#F6F7F9`, `#115E59` Deep Spruce, `#D1FAE5`/`#065F46` encrypted badge).
- Existing `/` validation landing page and `/api/waitlist` remain untouched.
