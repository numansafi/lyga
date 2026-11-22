# Validation Landing Page and App Theme

This document records the visual design system (shared between the landing page and the MVP web app) and the structure of the 48-hour validation landing page.

---

## 1. Visual Identity and Theme ("Daylight Studio Utility")
Lyga is an everyday utility for creators and cross-device users. The interface feels fast, calm, and legible in bright daylight rather than like a dark hacker terminal.

### Color Palette
| Token | Hex | Usage |
| --- | --- | --- |
| `--bg-page` | `#FFFFFF` | Primary page background |
| `--bg-surface` | `#F6F7F9` | Secondary panels, feed preview container, comparison rows |
| `--border-subtle` | `#E5E7EB` | Tactile 1px borders on cards, tabs, and inputs (no soft grey drop shadows) |
| `--text-primary` | `#111827` | Headings, primary labels, item titles |
| `--text-secondary` | `#4B5563` | Body copy, subheadlines, helper text |
| `--accent-primary` | `#115E59` | Official Deep Spruce accent (buttons, hero, Pro card border) |
| `--accent-primary-hover` | `#0D4743` | Hover state for primary buttons |
| `--accent-primary-tint` | `#F0FDFA` | Soft spruce tint for Early Bird badge and active chips |
| *(Saved presets)* | `#A51C30`, `#E14D2A` | Alternate Harvard Crimson & Electric Vermilion presets |
| `--status-encrypted-bg` | `#D1FAE5` | Background for the "Encrypted" badge |
| `--status-encrypted-text` | `#065F46` | Text for the "Encrypted" badge (WCAG AA/AAA compliant) |

### Typography and Restraint Rules
- **Font family:** `Bricolage Grotesque` for headings and body, plus `JetBrains Mono` for file sizes and code snippets.
- **Sentence case everywhere:** No ALL-CAPS eyebrow labels above headings, no gradient text, and no arrow symbols (`->`) appended to buttons.
- **Left-aligned editorial hero:** Keeps reading natural across desktop and mobile.
- **Flat tactile surfaces:** Use `1px solid #E5E7EB` borders and `#F6F7F9` surface shifts instead of generic drop shadows.
- **One bold focal point:** Put visual weight on the interactive feed preview in the hero; keep the rest of the page quiet and spacious.

---

## 2. Landing Page Structure (4 Sections)

### Section 1: Hero + Interactive Feed Preview
- **Left column:**
  - **Headline:** `DM yourself the important stuff.`
  - **Subheadline:** `Send full-size videos, photos, and any file between your phone and computer.`
  - **Primary CTA:** `Join Early Access` (scrolls smoothly to Pricing or opens the waitlist modal)
  - **Micro-trust line:** `Early access opens soon. Free up to 500 MB per file.`
- **Right column (Interactive Lyga Feed Preview):**
  - Clickable filter tabs: `All`, `Media`, `Links`, `Files`
  - Live-style QR pairing card on desktop (`Scan to pair phone`) that collapses into a compact status bar (`Paired: iPhone 16 to Windows`) on mobile (`< 640px`), paired with the `Encrypted` badge (`#065F46` on `#D1FAE5`)
  - Realistic sample items:
    - `IMG_4021.MOV` (`1.4 GB, 4K video`)
    - `DSC08812.ARW` (`42 MB, RAW photo`)
    - `figma.com/file/lyga-cut` (`Design review link`)
    - `release-v2.zip` (`310 MB, Archive`)

### Section 2: Comparison Table
A scannable 4-column table comparing **WhatsApp**, **Email / `fwd`**, **LocalSend**, and **Lyga** across:
- Max file size (`16 MB` / `25 MB` / `Unlimited local` / `500 MB Free, 5 GB Pro`)
- Original quality (`Compressed` / `Original` / `Original` / `Original`)
- Works across networks (`Yes` / `Yes` / `Same Wi-Fi only` / `Yes`)
- Persistent feed (`Buried in chat` / `Inbox clutter` / `None` / `Searchable encrypted feed`)

### Section 3: Pricing Cards (Smoke Test)
Two side-by-side cards with the three key numbers (`500 MB` vs `5 GB`, `7-day expiry` vs `100 GB vault`, `2 devices` vs `5 devices`) prominent at the top:
- **Starter (Free)** (`£0/mo`)
  - Unlimited text, links, and code snippets
  - Files up to 500 MB each
  - 2 GB active storage (7-day auto-expiry)
  - 2 paired devices
  - CTA: `Join Free Waitlist`
- **Pro Founder Spot** (`£5/mo Early Bird`, `£8/mo` crossed out)
  - Files up to 5 GB each
  - 100 GB persistent encrypted vault
  - Up to 5 paired devices
  - Public expiring Drop Links
  - 1-click HEIC to JPG conversion
  - Note under CTA: `No card required today. Locks in £5/mo at launch.`
  - CTA: `Claim £5/mo Founder Spot`

### Section 4: Mini FAQ (4 Questions)
1. **How is it encrypted?** Files and messages are encrypted in your browser (AES-256-GCM) before upload. The pairing key stays in the URL `#` fragment and never reaches our servers.
2. **Which devices work?** Any modern desktop or mobile browser (Windows, Mac, Linux, iPhone, Android), with native iOS and Android Share Sheet apps planned next.
3. **What happens to Free files after 7 days?** Free files expire automatically after 7 days to keep storage lean. Text, links, and code snippets stay, and Pro keeps files in a 100 GB persistent vault.
4. **Will I be charged today for the Founder Spot?** No. Entering your email reserves the £5/mo Early Bird rate for when Pro launches.

---

## 3. Waitlist Modal and PostHog Funnel
- **Step 1 (Email only):** Single email input + submit button (`Join Free Waitlist` / `Reserve £5/mo Spot`).
- **Step 2 (Post-submit confirmation):**
  - 1-click setup poll: `iPhone + Windows`, `iPhone + Mac`, `Android + Windows`, `Other`
  - Optional 1-line prompt: `What was the last file that was annoying to send?`
- **PostHog Events:**
  - `landing_viewed`
  - `cta_clicked` (`plan: "free" | "pro_founder" | "hero"`)
  - `waitlist_submitted` (`plan: "free" | "pro_founder"`)
  - `device_combo_selected` (`combo: string`)

---

## 4. Tech Stack for Validation Page (and Future MVP)
- **Framework:** Next.js (App Router) + TypeScript (`apps/web`)
- **UI & Styling:** Mantine UI (`@mantine/core`, `@mantine/hooks`) + CSS Modules (zero Tailwind CSS)
- **Analytics:** PostHog (`posthog-js`)
- **Backend:** `POST /api/waitlist` writing to Supabase `waitlist` table (with local JSON fallback in dev)
- **Hosting:** Vercel
