# Step 2: Core Loop and MVP Scope

## 1. The Single Core Loop
Before adding extras, **Lyga** has to nail one loop end to end:

> Desktop opens Lyga and shows a live QR code. The phone scans it to pair and receive the encryption key locally in `#wmk=`. The user drops text, a link, code, a photo, or a video. It encrypts in the browser, uploads, and appears on the other device at full original quality.

If that loop feels fast and reliable, the rest of the product has a solid base.

---

## 2. What Is in the MVP vs. What Waits

### In MVP v1.0 (Web First)
1. **Zero-install Desktop Workspace (`/`)**
   - Creates an anonymous workspace automatically with an `httpOnly` session cookie.
   - Displays a live pairing QR code (`https://.../pair?code=XYZ#wmk=MASTER_KEY`).
2. **Mobile Browser Pairing (`/pair`)**
   - Reads `#wmk=` locally from the URL hash (never sent to the server).
   - Registers the mobile device and enforces the 2-device cap on Free.
3. **End-to-End Encrypted Feed**
   - Sends and receives text, links, code snippets, images, videos, and files.
   - Auto-categorizes into timeline tabs: **All**, **Media**, **Links**, **Code**, and **Files**.
   - Supports 1-click copy for text/links/code and 1-click download for files.
4. **Cloud Buffer Uploads (Cloudflare R2)**
   - Uses presigned upload and download URLs with 5 MB parallel chunked encryption for large files.
   - Enforces the Free tier cap (500 MB per file, 2 GB active storage, 7-day rolling auto-expiry).
5. **Realtime Sync**
   - Uses Supabase Realtime so new items show up right away on paired devices.

### Out for v1.1+ (Build After the Core Loop Works)
- **Public Encrypted Drop Links (`/s/[id]#key=...`):** Pro feature to share a single file externally.
- **1-Click `HEIC -> JPG` Conversion:** Pro action for Windows users downloading iPhone photos.
- **Account Claim and Recovery Passphrase:** Magic Link / OAuth signup prompted after 1–2 transfers.
- **Pro Billing (Stripe or Lemon Squeezy):** Checkout and webhook for 5 GB files, 100 GB vault, and 5 devices.
- **Same-Wi-Fi WebRTC P2P:** Local router fast path when both devices are online together.
- **Native Mobile App (`apps/mobile` with Expo):** iOS Share Sheet and Android Share Intent.

---

## 3. Open Decisions for Step 2
- [x] **First-mile route:** `/` is the landing page, and `/app` opens the live workspace + QR code.
- [ ] **MVP file-size target:** Start with the 500 MB Free cap in v1.0 to verify chunked E2EE before unlocking 5 GB Pro uploads?
- [x] **Build order:** Validation landing page first, then Core Web MVP.
