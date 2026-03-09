
## Plan: Documentation Update + Missing Export Tools

### What needs to happen

**Part 1 — Three missing export functions** (code-only, no new UI patterns needed — reuse exact same `exportCsv` pattern already in `ShopsTab`)

**Part 2 — Documentation rewrite** (DOCUMENT.md + V2_DOC_CHANGES.md only)

---

### Part 1: Export Tools

**Categories export** — add to `CategoriesTab` header (next to "Add Category"):
- Columns: Name, Icon, Active, Shop Count
- Filename: `muktainagar-categories-YYYY-MM-DD.csv`
- Uses already-loaded `categories` array (no new query)

**Requests export** — add to `RequestsTab` header (next to status filter):
- Columns: Name, Phone, WhatsApp, Area, Address, Category, Status, Submitter, Opening, Closing, Has Image, Submitted At
- Filename: `muktainagar-requests-YYYY-MM-DD.csv`
- Uses already-loaded `requests` array (no new query)
- Note: exports whatever the current status filter shows (all requests if "All" is selected)

**Analytics export** — add to `AnalyticsTab` header (next to date range selector):
- Columns: Shop Name, Area, Calls, WhatsApp, Total
- Filename: `muktainagar-analytics-YYYY-MM-DD.csv`
- Uses already-computed `sortedShops` (no new query, current date range reflected)
- Only shown when data exists

All three: same `Download` icon, same `bg-card border border-border` button style as existing shops export. No new imports needed (`Download` already imported).

---

### Part 2: Documentation

**DOCUMENT.md** — rewrite to reflect current state:
- Version: V2
- Add `shop_requests` table to schema section
- Update `AdminDashboard.tsx` tab list (add Requests, Data Quality tabs)
- Update admin features section to include: Requests tab, Data Quality tab, Category merge, CSV import, CSV export (all 4), analytics date range, verified filter
- Remove stale backlog items that were shipped (verified badge on cards, storage cleanup, analytics date filter)
- Add new backlog items that are still genuinely deferred (bulk approve/reject, admin notes on approval, engagement drill-down, multi-city)
- Update business logic section: add `normalizeArea` bilingual regex, overnight time validation note, location-optional note in public form
- Update `shop_categories` RLS note — no UPDATE policy (intentional, merge uses DELETE+INSERT)
- Fix project structure (add `RequestListingModal.tsx`)
- Update engagement tracking: now also tracks from `CompactShopCard` on home page

**V2_DOC_CHANGES.md** — append a new "V2 Phase 7 — Bug Fixes & QA Hardening" section covering:
- Category merge RLS fix (DELETE+INSERT bypass)
- BUG-01: request approval phone normalization
- BUG-02: location optional in public form
- BUG-05/09: cache invalidation for public queries
- BUG-07: ShopCard type safety for `is_active`
- BUG-08: CompactShopCard engagement tracking
- BUG-10: overnight time validation fix
- R2: canvas.toBlob null guard
- R7: analytics 5000-row limit
- BUG-04/BUG-C: bilingual normalizeArea regex (all locations)
- BUG-06: storage scan pagination loop
- BUG-A data migration: backfill shop_categories from legacy category_id
- BUG-B data migration: delete orphaned shop_categories pointing to inactive categories

---

### Files to change

1. **`src/pages/AdminDashboard.tsx`** — add `exportCsv` functions to `CategoriesTab`, `RequestsTab`, and `AnalyticsTab`
2. **`DOCUMENT.md`** — full rewrite to match V2 reality
3. **`V2_DOC_CHANGES.md`** — append Phase 7 section

### What stays unchanged
- All public pages
- All existing export in ShopsTab
- Schema, RLS policies, DB
- All component logic
