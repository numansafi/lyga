---
name: Lyga
description: "DM yourself the important stuff — dual-surface spruce & mint design system for Lyga."
colors:
  spruce-primary: "#115e59"
  spruce-hover: "#0d4743"
  spruce-tint: "#f0fdfa"
  spruce-surface-tint: "#f7fefc"
  mint-accent: "#5eead4"
  mint-soft: "#99f6e4"
  mint-text: "#ccfbf1"
  app-bg-deep: "#041715"
  app-bg-base: "#061a18"
  app-surface: "#082421"
  app-surface-elevated: "#0b2623"
  app-bubble-out-start: "#0f6a62"
  app-bubble-out-end: "#0b4f4a"
  app-bubble-in: "#162b3a"
  app-bubble-in-border: "#2a506b"
  app-border: "#153b37"
  light-bg-page: "#ffffff"
  light-bg-surface: "#f6f7f9"
  light-border: "#e5e7eb"
  light-text-primary: "#111827"
  light-text-secondary: "#4b5563"
  status-encrypted-bg: "#d1fae5"
  status-encrypted-text: "#065f46"
  danger-coral: "#f87171"
  danger-text: "#fecaca"
typography:
  display:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(24px, 3.8vw, 46px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15.5px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0em"
  body:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14.5px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0em"
  caption:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  micro:
    fontFamily: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0em"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  xs: "4px"
  sm: "10px"
  md: "12px"
  card-sm: "14px"
  lg: "18px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "32px"
components:
  button-primary-app:
    backgroundColor: "{colors.mint-accent}"
    textColor: "#042220"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-auth:
    backgroundColor: "{colors.spruce-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-secondary-auth:
    backgroundColor: "#0b2623"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "44px"
  button-primary-light:
    backgroundColor: "{colors.spruce-primary}"
    textColor: "{colors.light-bg-page}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  input-dark:
    backgroundColor: "#051917"
    textColor: "{colors.spruce-tint}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  nav-pill:
    backgroundColor: "rgba(255, 255, 255, 0.92)"
    textColor: "{colors.light-text-secondary}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  chip-encrypted:
    backgroundColor: "{colors.status-encrypted-bg}"
    textColor: "{colors.status-encrypted-text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card-dark:
    backgroundColor: "{colors.app-surface}"
    textColor: "{colors.spruce-tint}"
    rounded: "{rounded.xl}"
    padding: "30px"
---

# Design System: Lyga

## Overview

**Creative North Star: "The Encrypted Thread"**

Lyga bridges everyday chat familiarity with cryptographic trust. Its visual system pairs a crisp, airy light mode for public persuasion (`/`) with a deep, calm spruce-slate dark mode for focused product operation (`/app`, `/login`, `/auth/callback`), anchored throughout by a shared Spruce-to-Mint accent family.

The aesthetic is tactile and crisp: pill navigation, soft-bordered glass cards, chat-bubble geometry with directional tail corners, and subtle lift or scale feedback on interaction. Nothing feels noisy or ornamental—every surface exists to make dropping a 4K video, photo, or note between devices feel effortless and private.

**Key Characteristics:**
- Dual-surface architecture: white/frost light mode on `/` marketing, deep spruce-slate dark mode (`#041715`–`#082421`) in `/login`, `/auth/callback`, and `/app`.
- Distinctive `Bricolage Grotesque` geometric warmth paired with `JetBrains Mono` for timestamps, file sizes, and security badges.
- Chat-inspired geometry: directional bubble corners (`18px 18px 4px 18px`), pill filter strips, and clean floating toasts.
- CSS Modules + Mantine Core only (zero Tailwind CSS).

## Colors

The palette uses a focused Spruce-to-Mint accent spectrum over neutral light-frost (`#ffffff` / `#f6f7f9`) and deep spruce-slate (`#041715` / `#061a18`) surfaces.

### Primary
- **Deep Spruce** (`#115e59`): Primary brand action on light surfaces, active filter pills, and focus rings (`--accent-primary`).
- **Deep Spruce Hover** (`#0d4743`): Hover state for light-mode primary actions (`--accent-primary-hover`).
- **Electric Mint** (`#5eead4`): Primary action CTA, icons, and active highlights on dark app/auth surfaces.
- **Soft Mint** (`#99f6e4`): Hover state for dark-mode primary buttons and inline links.

### Neutral
- **Pure Canvas** (`#ffffff`) & **Frost Surface** (`#f6f7f9`): Light-mode landing page background and card wells.
- **Ink Slate** (`#111827`) & **Muted Slate** (`#4b5563`): Light-mode primary and secondary copy.
- **Abyssal Spruce** (`#041715`) & **Workspace Base** (`#061a18`): Dark-mode page and chat canvas backgrounds.
- **Glass Spruce** (`#082421`) & **Header Spruce** (`#0b2623`): Elevated dark cards, modals, and top bars.
- **Spruce Hairline** (`#153b37`) & **Mist Border** (`#e5e7eb`): Subtle 1px structural dividers on dark and light surfaces respectively.
- **Mint White** (`#f0fdfa`) & **Mint Mist** (`#ccfbf1`): High-contrast body and secondary text on dark surfaces.

### Semantic
- **Encrypted Mint** (`#d1fae5` bg / `#065f46` text on light; `rgba(94, 234, 212, 0.12)` bg / `#5eead4` text on dark): Encryption badges and verified status indicators.
- **Coral Alert** (`#f87171` border / `#fecaca` text): Inline validation errors, error toasts, and danger-zone actions.

### Named Rules
**The Dual-Surface Rule.** Marketing surfaces (`/`) stay crisp white/frost with Deep Spruce (`#115e59`) accents; authenticated and app surfaces (`/login`, `/auth/callback`, `/app`) live in Abyssal/Workspace Spruce (`#041715`–`#082421`) with Electric Mint (`#5eead4`) accents. Never mix light-mode Mantine defaults into dark app surfaces.

## Typography

**Display Font:** `Bricolage Grotesque` (with `-apple-system, BlinkMacSystemFont, sans-serif`)
**Body Font:** `Bricolage Grotesque` (with `-apple-system, BlinkMacSystemFont, sans-serif`)
**Label/Mono Font:** `JetBrains Mono` (with `monospace`)

**Character:** `Bricolage Grotesque` brings friendly editorial character to headlines and chat bubbles, while `JetBrains Mono` grounds timestamps, byte counts, and encryption pills in technical precision.

### Hierarchy
- **Display** (`700`, `clamp(24px, 3.8vw, 46px)`, `1.1`, `-0.03em`): Landing hero headline (`DM yourself the important stuff.`).
- **Headline** (`700`, `24px`, `1.2`, `-0.02em`): Auth card titles, confirmation headings, and section titles.
- **Title** (`700`, `15.5px`, `1.25`): App header identity (`My Lyga`) and card headers.
- **Body** (`500`, `14.5px`, `1.5`): Chat message text, composer input (`16px` on `<= 920px` to prevent iOS zoom), and descriptions.
- **Label / Mono** (`600`, `11px`, `0.04em`): Timestamps, filter counts, file-size metadata, and `Encrypted` badges.

### Named Rules
**The Mobile Input Rule.** Form inputs and textareas on `<= 920px` viewports must stay at `16px` font size so iOS Safari never auto-zooms on focus.

## Layout

- **Landing (`/`):** Centered `1040px` hero stage and `900px` floating pill header (`56px` height) with `24px` horizontal padding (`16px` on mobile). Sections alternate cleanly between deep-spruce hero gradient and crisp white/frost sections.
- **Auth (`/login`, `/auth/callback`):** Full-viewport `100dvh` centered grid (`env(safe-area-inset-*)` padded). `/login` uses an `820px` 2-column split (`1.08fr` form / `0.92fr` QR panel) collapsing to a `440px` 1-column card on `<= 760px` (where QR polling is disabled), with `44×44px` minimum touch targets under `@media (pointer: coarse), (max-width: 760px)`. `/auth/callback` uses a focused `440px` card.
- **Workspace (`/app`):** Full-height `var(--app-height, 100dvh)` 2-column grid (`minmax(0, 1fr) 332px` on desktop, `290px` rail on `921px–1120px`, single column on `<= 920px` with `Devices` + account button in the top-right header and full-width filter strip below).

## Elevation & Depth

Lyga uses **tonal layering + translucent glass** over deep shadows:
- Light surfaces rely on `1px` borders (`#e5e7eb`) and soft ambient shadows on the floating header (`0 10px 28px -6px rgba(17, 24, 39, 0.16)`).
- Dark app surfaces separate layers via translucent spruce fills (`#061a18` -> `#082421` -> `#0b2623`), `1px` teal-tinted borders (`rgba(94, 234, 212, 0.18)`), and `backdrop-filter: blur(14px)` on floating toasts and popovers.

### Named Rules
**The Zero-Shift Toast Rule.** Floating notices and errors in `/app` anchor inside a zero-height overlay below the header so they never push the feed or composer down.

## Shapes

- **Pills (`9999px`):** Navigation header, filter strips, encryption badges, composer dock, and status chips.
- **Cards & Modals (`22px`–`24px`):** Auth shells, callback card, and dark modals.
- **Inputs & Buttons (`12px`):** Text fields, password inputs, and primary action buttons (`44px` height).
- **Chat Bubbles (`18px` with `4px` tail corner):** Outgoing bubbles use `18px 18px 4px 18px`; incoming peer bubbles use `18px 18px 18px 4px`.

## Components

### Buttons
- **Shape:** `12px` radius (`44px` height) for form CTAs; `9999px` pill for header/action chips.
- **Primary (Dark App, e.g. composer):** Electric Mint (`#5eead4`) background, `#042220` text, `font-weight: 700`. Hover shifts to `#99f6e4` with soft mint glow; active scales to `0.985`.
- **Primary (Auth, `/login`):** Deep Spruce (`#115e59`) background, `#ffffff` text, `1px solid rgba(94, 234, 212, 0.35)` border, `font-weight: 700`. Hover shifts to `#0d4743` with a brighter `0.55` border; active scales to `0.985`; disabled drops to `0.65` opacity. Built as a native `<button>` (`AuthSubmitButton`), with no `!important` overrides of Mantine.
- **Secondary (Auth, Continue with Google):** `#0b2623` fill, `1px solid rgba(94, 234, 212, 0.24)` border, `#ffffff` text, four-color Google `G`; hover `#10332f` with a `0.48` border. It stays visually quieter than the primary submit so the form action leads.
- **Primary (Light Marketing):** Deep Spruce (`#115e59`) background, `#ffffff` text; hover `#0d4743`.
- **Secondary / Ghost:** `rgba(255, 255, 255, 0.05)` fill with `1px solid rgba(255, 255, 255, 0.14)` border.

### Chips
- **Style:** `9999px` pill with `1px` translucent teal border (`rgba(94, 234, 212, 0.24)`), `JetBrains Mono` `11px` label.
- **State:** Active filter pills use `#115e59` fill with `#ffffff` text and `inset 0 0 0 1px rgba(94, 234, 212, 0.45)`.

### Cards / Containers
- **Corner Style:** `22px`–`24px` on auth/modal shells; `18px` on chat bubbles.
- **Background:** `rgba(8, 36, 33, 0.94)` on dark surfaces; `#ffffff` or `#f6f7f9` on light surfaces.
- **Border:** `1px solid rgba(94, 234, 212, 0.18)` on dark; `1px solid #e5e7eb` on light.

### Inputs / Fields
- **Style:** `44px` height, `12px` radius, `#051917` background, `1px solid rgba(94, 234, 212, 0.24)` border, muted mint placeholder (`rgba(204, 251, 241, 0.56)`).
- **Focus:** `#5eead4` border with `0 0 0 3px rgba(94, 234, 212, 0.14)` ring.
- **Error:** Coral border (`rgba(248, 113, 113, 0.72)`) with inline `#fca5a5` message directly below the field.

### Navigation
- **Marketing:** Centered `900px` floating pill (`56px` height) with `backdrop-filter: blur(16px)` and pill links.
- **Workspace:** Sticky `#0b2623` header with `My Lyga` identity, `All · Notes · Media · Links · Files` filter strip, and mobile `Devices` + account avatar on the top-right.

## Do's and Don'ts

### Do:
- **Do** use CSS Modules + Mantine Core (`primaryColor: 'spruce'`) for all styling.
- **Do** render field validation errors inline below the offending input (`aria-invalid="true"`) with `noValidate` on forms.
- **Do** separate destructive actions (`Clear all storage`, `Delete account`) into a bottom `Danger zone` away from neutral `Sign out`.
- **Do** keep `16px` minimum font size on mobile inputs (`<= 920px`).
- **Do** keep form `<p role="alert">` error messages outside `<label>` inside a `.fieldGroup` (`<label htmlFor>` + sibling `<input>` + error) so screen-reader accessible names stay clean.

### Don't:
- **Don't** add Tailwind CSS anywhere in `apps/web`.
- **Don't** use Mantine's default light-mode `<Alert>` inside dark `#061a18` views (causes unreadable dark-on-dark contrast).
- **Don't** show native browser validation tooltips or native textarea scrollbar arrows (`::-webkit-scrollbar` hidden on `.composerInput`).
- **Don't** place action-level error/info banners above `Continue with Google` on `/login` where they shift the card layout.
