# Lyga Security Best Practices Report

**Date:** 2026-11-27  
**Scope:** `apps/web` (Next.js 15.5.29 App Router, React 19, TypeScript 5.8, Node.js API Route Handlers)  
**References Applied:** `javascript-typescript-nextjs-web-server-security.md`, `javascript-typescript-react-web-frontend-security.md`, `javascript-general-web-frontend-security.md`

---

## Executive Summary

Overall, Lyga has a **solid security baseline**:
- **Zero XSS / DOM sinks:** No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, or unsafe `postMessage` calls exist in `apps/web/src`.
- **Safe redirects & external links:** `apps/web/src/app/auth/callback/page.tsx` validates `next` with `startsWith('/') && !startsWith('//')` (lines 83–87), and feed links enforce `http:`/`https:` with `rel="noopener noreferrer"`.
- **Signed session & auth cookies:** `lyga_ws` and `lyga_auth` use HMAC-SHA256 with `timingSafeEqual`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production (`session.ts`, `auth.ts`, `api-context.ts`), with a hard error if `LYGA_SESSION_SECRET` is missing in production (`session.ts:13-15`).
- **No Critical vulnerabilities found.** The highest-priority items are missing HTTP security headers in `next.config.ts` and patching `postcss` via `pnpm` overrides.

---

## High Severity Findings

### [1] Missing HTTP Security Headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- **Rule ID:** `NEXT-HEADERS-001` / `REACT-CSP-001`
- **Location:** [apps/web/next.config.ts](file:///c:/git/lyga/apps/web/next.config.ts#L4-L9)
- **Evidence:** `nextConfig` defines `outputFileTracingRoot` and `experimental.optimizePackageImports`, with no `headers()` configuration (and no `middleware.ts`/`proxy.ts` setting security headers). *(Not visible in app code; verify if set at Vercel edge/CDN.)*
- **Impact:** Without `X-Content-Type-Options: nosniff`, `X-Frame-Options` / CSP `frame-ancestors`, `Referrer-Policy`, and a Content-Security-Policy, the app lacks browser-enforced defense-in-depth against clickjacking, MIME-type sniffing, and injected scripts.
- **Fix:** Add `async headers()` in `apps/web/next.config.ts` returning `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a baseline `Content-Security-Policy` compatible with Mantine/PostHog/Supabase.

### [2] Known Vulnerabilities in `postcss` (`<=8.5.22`)
- **Rule ID:** `NEXT-SUPPLY-001`
- **Location:** [apps/web/package.json](file:///c:/git/lyga/apps/web/package.json#L33) (`"postcss": "^8.5.3"`) & `pnpm-lock.yaml` (`apps__web>next>postcss`)
- **Evidence:** `pnpm.cmd audit --prod` reported **4 vulnerabilities** in `postcss` (**2 High**: `GHSA-6g55-p6wh-862q`, `GHSA-qx2v-qp2m-jg93`; **2 Moderate**: `GHSA-fxqj-rqcc-2cmp` — patched in `>=8.5.23`).
- **Impact:** Arbitrary file / `.map` disclosure if untrusted CSS containing `sourceMappingURL` is processed by PostCSS. (Low practical risk in Lyga because only first-party CSS Modules are compiled at build time, but should still be patched.)
- **Fix:** Add `"pnpm": { "overrides": { "postcss": ">=8.5.23" } }` to root `package.json`, bump `"postcss": "^8.5.23"` in `apps/web/package.json`, and run `pnpm.cmd install`.

---

## Medium Severity Findings

### [3] Non-Constant-Time Secret Comparison & Missing Rate Limiting on Pairing / QR Endpoints
- **Rule ID:** `AUTH-TIMING-001` / `ABUSE-RATE-001`
- **Location:**
  - [apps/web/src/lib/mvp/qr-login-store.ts](file:///c:/git/lyga/apps/web/src/lib/mvp/qr-login-store.ts#L131-L134) & [L168](file:///c:/git/lyga/apps/web/src/lib/mvp/qr-login-store.ts#L168)
  - [apps/web/src/app/api/mvp/qr-login/route.ts](file:///c:/git/lyga/apps/web/src/app/api/mvp/qr-login/route.ts#L9-L20)
  - [apps/web/src/app/api/mvp/pair/route.ts](file:///c:/git/lyga/apps/web/src/app/api/mvp/pair/route.ts#L5-L35)
- **Evidence:** `row.secret !== secret` and `entry.secret !== secret` use standard string inequality rather than `timingSafeEqual`; `POST /api/mvp/qr-login` and `POST /api/mvp/pair` have no in-app rate limiting.
- **Impact:** Unauthenticated callers could spam `qr_login_challenges` rows or attempt brute-force guesses against pairing codes if edge/WAF rate limiting is not configured.
- **Fix:** Compare `secret` using `timingSafeEqual` in `qr-login-store.ts`, and add Vercel WAF / rate-limiting rules on `/api/mvp/pair`, `/api/mvp/qr-login`, and `/api/waitlist`.

### [4] `POST /api/mvp/qr-login/approve` Does Not Cross-Check `lyga_auth` Ownership
- **Rule ID:** `AUTHZ-SESSION-001`
- **Location:** [apps/web/src/app/api/mvp/qr-login/approve/route.ts](file:///c:/git/lyga/apps/web/src/app/api/mvp/qr-login/approve/route.ts#L8-L35)
- **Evidence:** Validates `lyga_ws` and `getWorkspaceState`, whereas `GET /api/mvp/workspace` ([route.ts:24](file:///c:/git/lyga/apps/web/src/app/api/mvp/workspace/route.ts#L24)) also checks `(!auth || !state.workspace.user_id || state.workspace.user_id === auth.userId)`.
- **Fix:** Use `withWorkspaceSession` and reject if `auth` is present and `state.workspace.user_id` does not match `auth.userId`.

---

## Low Severity Findings

### [5] Local Blob Download Missing `X-Content-Type-Options: nosniff` & `Content-Disposition`
- **Rule ID:** `FILE-DL-001`
- **Location:** [apps/web/src/app/api/mvp/blobs/[key]/route.ts](file:///c:/git/lyga/apps/web/src/app/api/mvp/blobs/%5Bkey%5D/route.ts#L71-L76)
- **Evidence:** Returns `Content-Type: application/octet-stream` and `Cache-Control: private, no-store` without `X-Content-Type-Options: nosniff` or `Content-Disposition: attachment`. (Low impact since blobs are AES-GCM ciphertext.)
- **Fix:** Add `'X-Content-Type-Options': 'nosniff'` and `'Content-Disposition': 'attachment'`.

### [6] `next` Semver Range in `package.json` Allows `<15.5.7`
- **Rule ID:** `NEXT-SUPPLY-001`
- **Location:** [apps/web/package.json](file:///c:/git/lyga/apps/web/package.json#L21)
- **Evidence:** `"next": "^15.2.4"` (lockfile resolves `15.5.29`, which is patched for `CVE-2025-66478`, but `package.json` range is older).
- **Fix:** Update `"next": "^15.5.29"` in `apps/web/package.json`.
