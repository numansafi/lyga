---
name: frontend-engineer
description: >-
  Master Frontend Engineer skill for building, redesigning, polishing, and
  verifying the entire website and web app frontend. Orchestrates and loads the
  best available design, UX, motion, copywriting, CRO, accessibility, and
  browser QA skills in the right order while enforcing Lyga's stack and design
  system. Use whenever working on pages, layouts, UI components, styling,
  animations, copy, responsiveness, or frontend verification.
---

# Frontend Engineer

Act as a senior design-minded frontend engineer. Before writing UI code, load project context and the relevant specialist skills for the current task so every page and component meets a high craft, accessibility, conversion, and performance bar.

## Step 1: Load Project Context (Always First)

Read these before designing or editing any frontend code in `lyga`:
1. `AGENTS.local.md` — Stack rules, non-negotiable guardrails, and Windows PowerShell commands (`pnpm.cmd` / `npm.cmd`).
2. `development.md` — Current architecture, repo map, and ADRs.
3. `.agents/product-marketing.md` — Positioning, ICP, voice, and objections (mandatory before writing any user-facing copy).
4. `docs/03-validation-page-and-theme.md` — "Daylight Studio Utility" theme tokens, typography, and layout rules.

### Lyga Stack Non-Negotiables
- **Framework:** Next.js (App Router) + TypeScript.
- **UI & Styling:** Mantine UI (`@mantine/core`, `@mantine/hooks`) + CSS Modules **only**. **Zero Tailwind CSS.**
- **Theme:** "Daylight Studio Utility" light theme (`#FFFFFF`, `#F6F7F9`, `#1D4ED8`, `#065F46` / `#D1FAE5`) with WCAG AA/AAA contrast.
- **Security:** E2EE keys (`#wmk=`, `#key=`) stay strictly in URL `#` fragments and client storage—never sent to servers.

---

## Step 2: Load Specialist Frontend Skills by Task

Activate and read the matching skills from `C:\Users\numan\.gemini\config\skills\` (see [skill-matrix.md](./references/skill-matrix.md) for the full directory and paths):

### A. Building or Redesigning Pages & Components
Load **all core design & craft skills**:
1. `frontend-design` — Intentional visual direction, typography, and anti-template aesthetics.
2. `design-taste-frontend` — Anti-slop layout discipline, section rhythm, real product UI, and browser finish gate.
3. `ui-ux-pro-max` — UI/UX design intelligence, color/type systems, UX guidelines, and responsive patterns.
4. `emil-design-eng` — Component interaction polish (press/hover states, popovers, tooltips, transitions).

### B. Landing, Pricing, Signup & User-Facing Copy
Load **copy, conversion, and SEO skills**:
1. `copywriting` (new copy) or `copy-editing` (tightening existing copy).
2. `humanizer` — Strip AI tells (`it's not X, it's Y`, forced triads, filler).
3. `cro` and `signup` — High-converting hierarchy, form friction reduction, honest CTAs.
4. `seo-audit` / `ai-seo` — Semantic HTML, metadata, OpenGraph, Core Web Vitals, and agent-readability.

### C. Motion & Micro-Interactions
1. `animate` — Decide *if* it should animate, then pick tool, composite-only properties, curves, and exit/interrupt behavior.
2. `animation-performance` — Keep motion at 60fps on the compositor thread; respect `prefers-reduced-motion`.
3. `apple-design` — When building gesture-driven, spring, or sheet/drawer interactions.
4. `review-animations` — Audit motion against the craft bar before finishing.

### D. Hardening, Accessibility & Verification (Required Before Done)
1. `break-ui` — Stress-test components with worst-case data (long strings, 0 items, huge counts, narrow viewports).
2. `web-design-guidelines` — Audit against Web Interface Guidelines and accessibility best practices.
3. `a11y-debugging` — Verify semantic HTML, keyboard navigation, focus rings, ARIA labels, and color contrast.
4. `ponytail` & `tdd` — Keep code minimal, modular, and tested at public seams.
5. `webapp-testing` / `qa` — Verify in a real browser across desktop and mobile viewports with zero console/network errors.

---

## Step 3: Definition of Done (Frontend)

Never declare a frontend task complete until:
- `pnpm.cmd --filter @lyga/web typecheck` (or `pnpm.cmd typecheck`) and `pnpm.cmd --filter @lyga/web build` pass cleanly.
- Zero Tailwind classes or unused CSS/deps were introduced.
- Copy matches `.agents/product-marketing.md` and has zero AI-prose tells.
- Interactive states (hover, focus-visible, active, disabled, loading, error, empty) and mobile/desktop layouts are verified in a real browser.
