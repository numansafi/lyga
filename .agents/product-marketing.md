# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-11-21

## Product Overview
**One-liner:** DM yourself the important stuff. Send full-size videos, photos, and any file between your phone and computer.
**What it does:** Lyga is a personal cross-device workspace for moving full-resolution 4K videos, RAW photos, links, and code snippets between your phone and computer. Open a browser on desktop, scan a QR code on your phone, and send files without installing desktop software.
**Product category:** Cross-platform file transfer and personal encrypted feed
**Product type:** Web-first SaaS (Next.js) with native iOS and Android companion apps planned for Phase 2
**Business model:** Freemium SaaS
- **Starter (Free):** £0/mo (unlimited text, links, and code; files up to 500 MB each; 2 GB active storage; 7-day auto-expiry; 2 paired devices)
- **Pro:** £5/mo Early Bird / £8/mo Standard (files up to 5 GB, 100 GB persistent vault, up to 5 paired devices, public Drop Links, HEIC to JPG conversion)
- **Lifetime Deal (optional launch):** £79 one-time (unlimited local Wi-Fi P2P transfers, 25 GB persistent vault)

## Target Audience
**Primary wedge:** iPhone users on Windows PCs (especially creators, video editors, photographers, and freelancers) who regularly move large media and links between phone and computer.
**Secondary audience:** Developers and multi-device users moving code snippets, `.zip` archives, and screenshots across iOS, Android, Windows, Mac, and Linux.
**Primary use case:** Moving uncompressed 4K videos, RAW photos, and quick links from phone to PC (and back) without compression or size limits.
**Jobs to be done:**
- Send a 1 GB+ 4K `.MOV` or RAW photo batch from iPhone to Windows without plugging in a cable or shrinking quality.
- Drop a link or code snippet on one device and pick it up on another in a searchable timeline.
- Share a single large file with a client via an expiring, encrypted public link.

## Problems & Pain Points
**Core problem:** Moving large, uncompressed files between an iPhone and a Windows PC takes too many steps and usually degrades quality or hits strict size caps.
**Why alternatives fall short:**
- Messaging apps compress photos and cap videos (16 MB on WhatsApp Business API).
- Email and cloud drives feel slow for quick one-off drops and cap attachments at 25 MB.
- Local-only transfer tools (LocalSend, PairDrop) fail when devices sit on different networks or when the laptop is asleep.
**What it costs them:** Lost time re-exporting files, degraded client footage, and cluttered email threads or drive folders.
**Emotional tension:** Annoyance that Apple AirDrop makes Mac-to-iPhone effortless while iPhone-to-Windows still feels broken.

## Competitive Landscape
**Direct:** `fwd` (usefwd.io) — falls short because it lacks a native iPhone app, enforces a 25 MB file cap and 1 GB total limit, sits behind an invite waitlist, and blocks external sharing.
**Direct:** `Blip` — falls short because it lacks a persistent, searchable chat timeline of links, notes, and files.
**Secondary:** `LocalSend` / `PairDrop` — falls short because transfers break across different Wi-Fi networks or when the receiving computer is asleep.
**Indirect:** `WhatsApp "Message Yourself"` / `Email` / `Google Drive` — falls short because they compress media, impose 16–25 MB limits, or bury quick transfers in folders and threads.

## Differentiation
**Key differentiators:**
- **Zero-install desktop onboarding:** Open the web app and scan the live QR code immediately. No `.exe` or `.dmg` installer and no upfront signup wall.
- **Uncompressed multi-gigabyte media:** Full-res 4K video and RAW photo support up to 5 GB per file on Pro.
- **End-to-end encryption in the URL fragment:** The Workspace Master Key stays in the `#wmk=` hash and never touches the server.
- **Smart workflow extras:** 1-click HEIC to JPG conversion for Windows, auto-categorized timeline tabs (All, Media, Links, Code, Files), and 1-click encrypted public Drop Links.

## Objections
| Objection | Response |
|---|---|
| "I already use WhatsApp to message myself." | WhatsApp compresses your photos and caps videos. Lyga keeps the original file untouched, up to 5 GB on Pro. |
| "Why not use LocalSend or PairDrop?" | Those require both devices to be awake on the same Wi-Fi network. Lyga works across any network and holds files in an encrypted cloud buffer if your laptop is asleep. |
| "Is my data safe on a web app?" | Files and messages are encrypted in your browser with AES-256-GCM before upload. The server never sees your encryption key. |

**Anti-persona:** Enterprise IT teams looking for managed company file servers, compliance archiving, or multi-user team permissions.

## Switching Dynamics
**Push:** Frustration with compressed WhatsApp exports, 25 MB email limits, and flaky local-only AirDrop clones.
**Pull:** Instant QR pairing in a browser tab with full-resolution files and a clean, searchable feed.
**Habit:** Muscle memory of opening WhatsApp or emailing oneself a link.
**Anxiety:** Worry about losing anonymous browser history if cookies are cleared (solved by prompting to claim an account and set a recovery passphrase after 1–2 transfers).

## Customer Language
**How they describe the problem:**
- "Why is getting a 4K video off my iPhone onto Windows still so painful?"
- "WhatsApp ruins the quality and email says the file is too big."
**Words to use:** full-resolution, uncompressed, zero desktop install, scan QR, persistent feed, encrypted.
**Words to avoid:** revolutionary, seamless, next-gen, empower, leverage, military-grade.

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|---|---|---|---|
| Direct | Plain words, short sentences | Hype or buzzwords | "Open Lyga on your PC, scan the QR code, and drop the file." |
| Practical | Focuses on speed and file fidelity | Abstract security lectures | "Your 4K video arrives at full resolution, untouched." |
| Calm | Honest about limits and tradeoffs | Sales pressure | "Free files expire after 7 days. Upgrade to Pro to keep up to 100 GB." |

## Goals
**Business goal:** Validate willingness to pay for Pro (£5/mo Early Bird) before building the full application, then ship the Web MVP.
**Conversion action:** Email waitlist signup and Pro Founder click-through on the validation page; QR pairing + first transfer on the Web MVP.
**Validation green-light target:** 200+ targeted visitors, 10%+ email signup rate, and 15–20%+ of signups clicking the £5/mo Pro option.

## Learnings
*(Empty for now. Add findings from the 48-hour validation test and early user feedback here.)*
