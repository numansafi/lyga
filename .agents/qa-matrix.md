# Lyga — QA Matrix (`.agents/qa-matrix.md`)

This matrix defines verification checks for `qa` and `principal-pr-review` once `apps/web` is scaffolded.

## Viewport & Theme Matrix
- **Viewports:** `390×844` (mobile), `768×1024` (tablet), `1440×900` (desktop)
- **Theme:** Light mode ("Daylight Studio Utility": `#FFFFFF` page, `#F6F7F9` surface, `#E5E7EB` borders, `#1D4ED8` primary accent)
- **Mobile Hero Preview Check (`< 640px`):** QR pairing card must collapse cleanly into a compact status bar (`Paired: iPhone 16 to Windows`) with zero horizontal overflow.

## Validation Landing Page Checklist (Phase 1)
- **Hero (`/`):** Headline (`DM yourself the important stuff.`), subheadline, `Join Early Access` CTA, and interactive feed preview tabs (`All`, `Media`, `Links`, `Files`) filter sample items cleanly.
- **Comparison Table:** All 4 columns (WhatsApp, Email/`fwd`, LocalSend, Lyga) readable on mobile and desktop.
- **Pricing Cards:** `Starter (Free)` (`£0/mo`, 500 MB/file, 2 GB active storage, 7-day expiry, 2 devices) and `Pro Founder Spot` (`£5/mo`, `£8/mo` crossed out, `"No card required today"`).
- **Waitlist Modal & `POST /api/waitlist`:**
  - Rejects invalid/empty email with clear inline error.
  - Submits valid email + `plan` (`free` | `pro_founder`) and advances to Step 2 (`device_combo` poll + optional file pain prompt).
  - Fires PostHog events: `landing_viewed`, `cta_clicked`, `waitlist_submitted`, `device_combo_selected`.

## Domain & Security Non-Negotiables
- **Zero Tailwind CSS:** No Tailwind classes or config; Mantine UI + CSS Modules only.
- **Accessibility:** Keyboard navigation for tabs/accordion/modal, visible focus rings, and WCAG AA contrast (`#065F46` on `#D1FAE5` for the `Encrypted` badge).
- **E2EE (Phase 2 MVP):** `#wmk=` and `#key=` URL fragments must never be sent in API requests or logged server-side.
