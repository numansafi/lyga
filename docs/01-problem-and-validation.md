# Step 1: Problem, Target User, and 48-Hour Validation

## 1. Who We Are Building For
**Primary wedge:** iPhone users on Windows PCs (creators, video editors, photographers, and freelancers) who regularly move large media and links between phone and computer.

**The problem:** Moving full-resolution 4K videos, RAW photos, links, and code snippets from an iPhone to a Windows PC still takes too many steps. Messaging apps shrink photos and cap videos. Email and cloud drives feel slow for quick drops and cap attachments at 25 MB. Local-only tools like LocalSend and PairDrop break when devices are on different Wi-Fi networks or when a laptop is asleep.

**Current workarounds:** Messaging yourself on WhatsApp, emailing links to yourself, uploading to Google Drive, or plugging in a USB cable.

---

## 2. Competitive Positioning
| Tool | Where It Falls Short | How Lyga Wins |
| --- | --- | --- |
| WhatsApp / Telegram | Compresses photos, caps Business API videos at 16 MB, clunky on desktop | Uncompressed originals, up to 5 GB (Pro), fast browser workflow |
| Email / Google Drive | 25 MB attachment cap, slow for quick drops, clutters your inbox | Instant QR pairing in a searchable chat feed |
| LocalSend / PairDrop / Blip | Fails across networks or when a laptop sleeps; no persistent feed | Works across any network via encrypted cloud buffer and keeps your history |
| fwd (usefwd.io) | No iPhone app, 25 MB file limit, 1 GB total cap, invite waitlist, no external sharing | Zero-install web plus mobile app later, 100 MB Free / 5 GB Pro, public Drop Links |

---

## 3. 48-Hour Pre-Code Validation Plan
Before building the full app, test whether people want this enough to click **Pro**:

1. **Single Validation Landing Page**
   - **Hero Headline:** "DM yourself the important stuff."
   - **Subheadline:** "Send full-size videos, photos, and any file between your phone and computer."
   - **Above-the-fold Visual:** Interactive or animated desktop feed preview showing a live QR code and a 1.4 GB `.MOV` video dropping in at full quality, paired with a single primary CTA ("Get Early Access").
   - **Pricing / CTA Smoke Test:**
     - **Starter (Free):** "Join Free Waitlist" (£0/mo for unlimited text, links, and code; files up to 500 MB each; 2 GB active storage; 7-day auto-expiry; 2 paired devices)
     - **Pro Founder Spot:** "Claim £5/mo Founder Spot" (£5/mo Early Bird, £8/mo standard struck through, with "No card required today, locks in £5/mo at launch" for 5 GB max files, 100 GB vault, 5 paired devices, public Drop Links, and HEIC to JPG conversion)
   - **Frictionless Waitlist Form:** Email-only upfront. After submit, show a 1-click poll ("Which setup do you use?": `iPhone + Windows`, `iPhone + Mac`, `Android + Windows`, `Other`) and an optional one-line question ("What was the last file that was annoying to send?").
   - **PostHog Funnel Events:** `landing_viewed`, `cta_clicked` (`plan: "free" | "pro_founder"`), `waitlist_submitted` (`plan: "free" | "pro_founder"`), and `device_combo_selected`.

2. **15-Second Concept Video**
   - Film scanning the QR code on a Windows laptop with an iPhone and dropping a 1.4 GB `.MOV` video into the browser feed.
   - Upload natively on `r/Windows11`, `r/iphone`, `r/VideoEditing`, Indie Hackers, and X, sharing the real story and linking Lyga to capture emails into an owned waitlist.

3. **Green-Light Target**
   - 200+ targeted visitors
   - 10%+ email signup rate
   - 15–20%+ of signups clicking the £5/mo Pro option

---

## 4. Open Decisions for Step 1
- [x] Brand name: **Lyga**
- [x] Primary target user: **iPhone + Windows creators and freelancers** (with developers/everyday cross-device users as secondary)
- [x] Build order: Ship the **48-hour Validation Landing Page** first, then build the **Core Web MVP**
- [x] Currency: **£** (£0 / £5 / £8)
- [x] Analytics tool: **PostHog**
