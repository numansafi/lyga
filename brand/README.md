# Lyga Brand & Logo Kit

Official brand marks, app icons, favicons, and marketing assets for **Lyga** (*"DM yourself the important stuff"*).

## Brand Colours
| Token | Hex | Usage |
| --- | --- | --- |
| **Deep Spruce (Primary)** | `#115E59` | App icon tile, primary buttons, favicon mark |
| **Aurora Dark** | `#072B28` | Header & OG banner top stop |
| **Aurora Light** | `#16776F` | Hero & OG banner bottom stop |
| **Spruce Tint** | `#F0FDFA` | Subtle surfaces & pills |
| **Ink** | `#111827` | Primary wordmark on light backgrounds |
| **White** | `#FFFFFF` | Mark on dark/Spruce tiles & wordmark on dark backgrounds |

## Directory Structure
### `brand/svg/` (Master Vectors)
- `lyga-icon-spruce.svg` — Primary `256×256` app icon (`#115E59` squircle + `#FFFFFF` mark)
- `lyga-mark-spruce.svg` — Naked `#115E59` mark for light surfaces
- `lyga-mark-white.svg` — Naked `#FFFFFF` mark for dark/Spruce surfaces
- `lyga-mark-black.svg` — Monochrome `#111827` mark
- `lyga-lockup-dark.svg` — Horizontal icon + `LYGA` wordmark for light backgrounds
- `lyga-lockup-light.svg` — Horizontal icon + `LYGA` wordmark for dark/Spruce backgrounds
- `lyga-og-banner.svg` — `1200×630` social/OpenGraph marketing banner

### `brand/png/` (Marketing & Store Exports)
- `lyga-icon-1024.png` — `1024×1024` App Store / store-ready app icon
- `lyga-icon-spruce.png` — `1024×1024` master icon PNG
- `lyga-lockup-dark.png` / `lyga-lockup-light.png` — Horizontal lockup PNGs
- `lyga-og-banner.png` — `1200×630` social share banner (copied to `apps/web/public/og-image.png`)

### `apps/web/public/` (Web & PWA Icons)
- `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` (`180×180`)
- `icon-192.png`, `icon-512.png`, `maskable-512.png`, `site.webmanifest`
- `og-image.png` (`1200×630` OpenGraph & Twitter card image)

## Usage Guidelines
- Keep at least **20% clear space** around the squircle or naked mark.
- Never stretch, rotate, or add drop shadows to the mark.
- Use `lyga-mark-white.svg` or `lyga-lockup-light.svg` on dark/Deep Spruce backgrounds, and `lyga-icon-spruce.svg` or `lyga-lockup-dark.svg` on white/light backgrounds.
