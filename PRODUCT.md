# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users:** Cross-device creators and everyday users (especially iPhone + Windows/Mac users) moving full-quality 4K videos, photos (`.HEIC`/`.JPG`/`.PNG`), notes, links, code snippets, and arbitrary files between their own phone and computer.
- **Job to be done:** Drop and retrieve personal files, media, and notes across devices in seconds without chat-app compression, email attachment limits, or juggling cloud folders.

## Product Purpose

Lyga ("DM yourself the important stuff") turns cross-device file transfer and personal capture into a single, familiar chat-style timeline. Success means a user can pair their phone and computer in seconds, send uncompressed media or notes from either device, and preview or download them at full quality anywhere.

## Positioning

- **"DM yourself" chat timeline UX:** Organizes notes, links, media, and files in one chronological thread with quick category filters (`All`, `Notes`, `Media`, `Links`, `Files`), pins, and bulk export (`.zip`).
- **Client-side AES-GCM end-to-end encryption + QR pairing:** Workspace keys stay on paired devices (`WebCrypto` AES-GCM + ECDH/ephemeral QR key exchange); the server stores only ciphertext metadata and encrypted blobs.
- **Full-quality uncompressed transfers:** Up to 250 MB per file on Starter (Free) and 5 GB per file on Pro, preserving original quality (including `.HEIC` preview support on desktop browsers).

## Operating Context

- **Surfaces:**
  - `/` — Marketing landing page (hero, interactive DM feed preview, highlights, comparison vs WhatsApp/email, pricing, FAQ, waitlist modal).
  - `/login` — Google OAuth, 6-digit email OTP, email/password sign-in/sign-up, and cross-device QR unlock.
  - `/auth/callback` — OAuth/OTP callback and cross-device email confirmation screen.
  - `/app` — Main encrypted workspace feed, device pairing & management, storage meter, `.HEIC`/media/code preview, and `.zip` export.
  - `/pair` & `/qr-approve` — QR pairing and cross-device approval routes.
  - `/privacy` & `/terms` — Public legal policies linked from the footer.
- **Tech stack:** Next.js 15 App Router, React 19, TypeScript, Mantine Core, CSS Modules, Supabase (Auth/Postgres/Storage), local dev filesystem fallback (`.lyga-dev-data`).

## Capabilities and Constraints

- **Plan limits (confirmed):**
  - **Starter (Free):** £0/mo, 250 MB max file, 1 GB active rolling storage, 3-day file expiry, up to 2 paired devices, unlimited text/links/code snippets.
  - **Pro Founder Spot:** £5/mo (early bird vs £8/mo), 5 GB max file, 100 GB persistent vault (no 7-day expiry), up to 5 paired devices, expiring public Drop Links, 1-click HEIC-to-JPG conversion. *(Pro billing via Stripe is live.)*
- **Technical constraints:**
  - CSS Modules + Mantine Core only (no Tailwind CSS in `apps/web`).
  - Client-side E2EE invariant: plaintext notes, filenames, and file bytes must never be sent to or logged by the server.

## Brand Commitments

- **Name:** Lyga (`LYGA`).
- **Voice:** Direct, practical, calm, and honest—no exaggerated claims or fake urgency.
- **Existing brand assets:** Custom `L` arrow monogram (`favicon.svg`, `LygaQrCode` center mark) and `Bricolage Grotesque` + `JetBrains Mono` typography.

## Evidence on Hand

- Live product implementation in `apps/web` (`/`, `/login`, `/auth/callback`, `/app`, `/pair`, `/qr-approve`) and unit test suites (`waitlist-store`, `email-validation`, `mvp-store`, `crypto`, `blob-store`, `qr-login-store`, `qr-crypto`, `zip`).
- No external customer testimonials or third-party benchmarks are on hand; future copy must not fabricate them.

## Product Principles

1. **Feel like texting yourself:** Keep capture and retrieval as fast and low-friction as sending a message.
2. **Zero quality loss:** Never silently compress or alter original user files (preserve raw bytes on download/export).
3. **Private by architecture:** Encrypt before upload and keep keys on paired devices.
4. **Honest scope:** Clearly distinguish shipped features from roadmap capabilities without fabricating claims.

## Accessibility & Inclusion

- Semantic HTML, `role="tablist"`/`role="tab"`, `aria-invalid`/`aria-describedby` on form errors, keyboard-accessible modals and composer shortcuts, and mobile/tablet responsiveness (`375px`+ viewports with `16px` mobile inputs to prevent iOS auto-zoom).
