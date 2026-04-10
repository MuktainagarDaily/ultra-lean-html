

## Home Page Audit — Duplicates & UX Improvements

### Duplicates Found

**1. "Open Now" appears 3 times**
- Quick filter chip "🟢 Open Now" (line 560)
- StatPill "15 Open Now" (line 643)
- Inside "View All Shops" CTA badge "15 open" (line 786)

**2. "Verified" appears 3 times**
- Quick filter chip "Verified" (line 571)
- StatPill "20 Verified" (line 654)
- Trust Strip "20 verified listings" (line 685)

**3. "All Shops" / shop count appears 3 times**
- StatPill "21 Shops" links to /shops (line 638)
- "View All 21 Shops" CTA button links to /shops (line 779)
- "View all →" link next to Browse by Category links to /shops (line 720)

**4. Trust Strip is fully redundant**
- "Direct calls" — not actionable, filler text
- "Verified listings" — duplicate of stat pill + quick chip
- "Local businesses" — obvious from context
- "Reviewed & maintained" — filler

**5. Quick Info section at bottom is redundant**
- "📍 Muktainagar, Jalgaon District, Maharashtra" — already in the header
- "Find local shops • Call directly • No registration needed" — repeats trust strip

**6. SubCategoryRow placeholder**
- Shows "Coming soon" placeholders with no data — adds visual noise with zero value

---

### Proposed Changes

| # | Change | Why |
|---|--------|-----|
| 1 | **Remove Trust Strip** (lines 667-698) | All info is duplicated in stat pills or obvious from context |
| 2 | **Remove Quick Info section** (lines 799-809) | Repeats header location + trust strip messaging |
| 3 | **Remove SubCategoryRow component** (lines 141-167) and its usage in filter drawer (line 950) | Placeholder UI with no data — visual noise |
| 4 | **Remove "Open Now" quick chip** (lines 559-568) | Already in StatPills with count; filter drawer has it too |
| 5 | **Remove "Verified" quick chip** (lines 571-581) | Already in StatPills with count; filter drawer has it too |
| 6 | **Keep top 3 category quick chips** | These are useful for fast navigation and not duplicated elsewhere in the header |
| 7 | **Remove the "15 open" badge from "View All Shops" CTA** (lines 786-793) | Count already shown in stat pills above — the CTA is cleaner without it |
| 8 | **Tighten spacing** — reduce `pb-28` on main to `pb-16`, reduce `mt-5` on CTA to `mt-4` | Less dead space at bottom, tighter flow |

### What stays unchanged
- Search bar + autocomplete — working well
- StatPills row — concise, clickable, useful
- Filter button + filter drawer — user requested this stays
- Recently Added section — good discovery feature
- Browse by Category grid — core navigation
- "View All Shops" CTA — primary action (just removing the redundant open badge)
- Footer — minimal, appropriate
- Category quick chips in filter row — useful shortcuts

### Files changed
- `src/pages/Home.tsx` only — remove ~80 lines of duplicate/filler UI

No backend, no database, no Cloud changes.

