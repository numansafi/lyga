# Lyga — Project Operating Guide (`AGENTS.local.md`)

## Role & Expertise
Full-stack Next.js (App Router) + TypeScript + Mantine UI engineer building **Lyga** (cross-device encrypted file & feed workspace), starting with the 48-hour Validation Landing Page and followed by the Core Web MVP.

## Session Startup
1. Read `development.md` for current architecture, decisions, and next steps.
2. Read `.agents/product-marketing.md` before writing any user-facing copy or UI text.
3. Read `docs/03-validation-page-and-theme.md` for the "Daylight Studio Utility" theme tokens and layout rules.

## Targeted Reading Order (Current Repository)
- **Product & Marketing Context:**
  - `.agents/product-marketing.md` — Positioning, primary wedge (iPhone + Windows creators), objections, brand voice
- **Planning & Design Specs:**
  - `docs/README.md` — Planning index and step status
  - `docs/01-problem-and-validation.md` — Problem, competitive positioning, 48-hour validation plan & PostHog funnel
  - `docs/02-core-loop-and-mvp-scope.md` — Core loop and MVP v1.0 vs. v1.1+ cut
  - `docs/03-validation-page-and-theme.md` — Color tokens, typography, landing page sections, and waitlist modal spec

- **Current App (`apps/web`):**
  - `apps/web/src/app/page.tsx` — Validation Landing Page (`/`)
  - `apps/web/src/app/app/page.tsx` — Core E2EE Workspace (`/app`)
  - `apps/web/src/app/login/page.tsx`, `pair/page.tsx`, `qr-approve/page.tsx` — Auth & QR pairing flows
  - `apps/web/src/lib/mvp/` — E2EE crypto, session/auth tokens, workspace/blob/QR stores, pure feed selectors (`feed-selectors.ts`), and `api-context.ts`

## Non-Negotiable Guardrails
- **No Remote Push or Release Without Explicit Approval:** Never run `git push`, `gh pr create`, `git merge`, or remote production deploys (`vercel --prod`) unless the user explicitly asks for it. Keep work local while iterating.
- **Zero Tailwind CSS:** Use Mantine UI (`@mantine/core`, `@mantine/hooks`) and CSS Modules only.
- **E2EE Key Discipline (MVP):** Workspace Master Keys (`#wmk=`) and public Drop Link keys (`#key=`) must stay in URL `#` fragments and client storage (`IndexedDB` / `expo-secure-store`)—never sent to the server.
- **Validation Phase Honesty:** Waitlist CTAs must clearly state `"No card required today"` for the £5/mo Pro Founder Spot and track real intent in PostHog (`landing_viewed`, `cta_clicked`, `waitlist_submitted`, `device_combo_selected`).
- **Windows PowerShell Commands:** Use `pnpm.cmd` / `npm.cmd` in PowerShell when `.ps1` execution policy blocks `pnpm` / `npm`.
