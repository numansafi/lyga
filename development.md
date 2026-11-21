# Lyga — Engineering & Product Brain (`development.md`)

**Remote Repository:** `https://github.com/numansafi/lyga.git`

## Product Overview & Positioning
**Lyga** is a personal cross-device encrypted feed ("DM yourself the important stuff") for moving full-size 4K videos, photos, links, code snippets, and files between phone and computer without desktop installs or media compression.
- **Primary Wedge:** iPhone + Windows creators, video editors, photographers, and freelancers.
- **Tiers:**
  - **Starter (Free — £0/mo):** Unlimited text, links & code; files up to 500 MB each; 2 GB active storage; 7-day rolling auto-expiry; 2 paired devices.
  - **Pro (£5/mo Early Bird / £8/mo Standard):** Files up to 5 GB; 100 GB persistent vault; up to 5 paired devices; public Drop Links; 1-click HEIC → JPG conversion.

## Planned Tech Stack
- **Web App (`apps/web`):** Next.js (App Router) + TypeScript + Mantine UI + CSS Modules (zero Tailwind CSS)
- **Analytics (Validation):** PostHog (`posthog-js`)
- **Database, Auth & Realtime:** Supabase (PostgreSQL + Realtime + RLS)
- **Storage (MVP):** Cloudflare R2 (presigned URLs, 5 MB parallel chunked encryption)
- **Hosting:** Vercel
- **Mobile (Phase 2):** Expo (React Native + Expo Router + `expo-share-intent`)

## Current Repository Map
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example` — Monorepo root config
- `supabase/migrations/0001_waitlist.sql` — Waitlist schema (`email`, `plan`, `device_combo`, `pain_note`)
- `apps/web/src/app/page.tsx` — 48-hour Validation Landing Page (`/`)
- `apps/web/src/app/api/waitlist/route.ts` — `POST` & `PATCH` waitlist capture (Supabase + `.lyga-dev-data/waitlist.json` local fallback)
- `apps/web/src/components/` — `LandingHeader`, `HeroSection`, `HeroFeedPreview`, `ComparisonSection`, `PricingSection`, `FaqSection`, `WaitlistModal`
- `apps/web/src/lib/` — `analytics.ts` (PostHog funnel), `waitlist-store.ts`
- `.agents/product-marketing.md` — Canonical marketing & positioning context
- `docs/README.md` — Pre-build planning index
- `docs/01-problem-and-validation.md` — Step 1: Problem, ICP, validation plan (**Done**)
- `docs/02-core-loop-and-mvp-scope.md` — Step 2: Core loop & MVP cut (**In Progress**)
- `docs/03-validation-page-and-theme.md` — Step 3: Validation landing page & "Daylight Studio Utility" theme (**Done**)

## Decision Log (ADRs)
| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-11-21 | Brand renamed to **Lyga** | Short, memorable, no App Store file-transfer conflicts (unlike `Feli`/`Feil`). |
| 2026-11-21 | Build **48-hour Validation Landing Page** first (`/`), then Core Web MVP (`/app`) | De-risk willingness to pay (£5/mo Pro Founder Spot) before building full E2EE/R2 infrastructure. |
| 2026-11-21 | Pricing in `£` (`£0` / `£5` Early Bird / `£8` Standard) with PostHog tracking | Undercuts WeTransfer Starter ($8/mo) and matches Send Anywhere Lite ($5.99/mo) with 100 GB vault. |
| 2026-11-21 | Free tier set to **500 MB/file, 2 GB active storage, 7-day auto-expiry** | Allows users to test a real 30–60s 4K `.MOV` clip (150–400 MB) while preserving Pro upgrade incentives. |
| 2026-11-21 | **"Daylight Studio Utility"** light theme (`#FFFFFF`, `#F6F7F9`, `#1D4ED8`, `#065F46`/`#D1FAE5`) | Avoids generic dark-mode SaaS templates; passes WCAG AA/AAA contrast on badges and text. |

## Changelog
- **2026-11-21:** Verified `apps/web` Validation Landing Page (`pnpm test`, `pnpm typecheck`, `pnpm build`, live `/api/waitlist` smoke test), hardened `/api/waitlist` validation, production Supabase guard, and `WaitlistModal` feedback state, and added `waitlist-store.test.ts`.
- **2026-11-21:** Scaffolded monorepo root, `supabase/migrations/0001_waitlist.sql`, and `apps/web` Validation Landing Page (Next.js App Router + Mantine UI + CSS Modules + PostHog + `/api/waitlist`).
- **2026-11-21:** Completed pre-build Step 1 (`01-problem-and-validation.md`), Step 2 draft (`02-core-loop-and-mvp-scope.md`), Step 3 theme & landing page spec (`03-validation-page-and-theme.md`), `.agents/product-marketing.md`, and initial `project-agent-setup` context.

## Open Next Steps
1. Deploy to Vercel with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_POSTHOG_KEY` configured.
2. Run the 48-hour Reddit/Indie Hackers/X validation test and monitor PostHog funnel conversion.
3. Finalize `docs/02-core-loop-and-mvp-scope.md` and begin Core Web MVP (`/app`) if validation targets are met.
