## Audit Summary

**What already exists and works correctly — keeping untouched:**

- `normalizePhone()` and `normalizeWhatsApp()` helpers (lines 913–927) — will **reuse directly** for import
- `isValidPhone()` (line 930) — will **reuse directly**
- `validate()` function in `ShopModal` — same rules will be mirrored in import validation
- Duplicate phone detection logic (lines 1110–1132) — will **reuse the same pattern** for bulk checking
- `ShopsTab` with the Add Shop / Edit / search / filter UI — **untouched**
- Categories query from `admin-categories` — will reuse to build category name→id map
- `executeSave()` insert + `shop_categories` pattern — will **reuse exactly** for bulk insert
- All admin styling: `inputCls`, `Field`, `TabButton`, `StatCard`, card/table patterns — **reused throughout**
- All Phase 1 + Phase 2 features — **untouched**

**Nothing related to CSV import exists yet.**

---

## Plan: V2 Phase 3 — CSV Bulk Import

### Architecture Decision

The import UI will live entirely inside `AdminDashboard.tsx` as a new `CsvImportModal` component (same pattern as `ShopModal` and `CategoryModal`). A new "Import CSV" button is added to the `ShopsTab` header row. No new files, no new routes.

### Step-by-step flow

```text
[Import CSV] button  →  CsvImportModal opens
│
├── Step 1: Upload
│     - Instructions + column reference table
│     - "Download Template" button (generates a CSV blob)
│     - File input (.csv only)
│
├── Step 2: Preview (after parse)
│     - Summary: X valid / Y warnings / Z errors / D duplicates
│     - Table showing all rows with per-row status badge
│       • ✅ Ready  🟡 Warning (missing optional field)  ❌ Error (blocking)  🔁 Duplicate
│     - "Import N valid rows" CTA  +  "Back" link
│
└── Step 3: Result
      - Imported: N  |  Skipped (dupes): D  |  Failed: F
      - "Close & Refresh" button
```

### Files changed

`**src/pages/AdminDashboard.tsx**` — only file changed:

1. Add `Upload` to lucide imports
2. Add "Import CSV" button to `ShopsTab` header (next to "Add Shop")
3. Add `showImport` state in `AdminDashboard`, pass `onImportDone` callback
4. Add `CsvImportModal` component at the bottom of the file

### CsvImportModal implementation details

**CSV parsing** — native `FileReader` + manual line split (no new library needed — Papa Parse not installed, and the CSV format is simple enough for a native parser that handles quoted fields)

**Column mapping** (case-insensitive, trim):

```
name, phone, whatsapp, address, area,
category, opening_time, closing_time,
latitude, longitude, is_active, is_verified
```

**Per-row validation** (mirrors existing `validate()`):

- `name` empty → ❌ error
- `phone` missing → ❌ error; invalid (< 10 digits) → ❌ error
- `whatsapp` present but invalid → 🟡 warning (not blocking)
- `area` AND `address` both empty → 🟡 warning (not blocking for import, just flagged)
- `latitude` present but out of range → 🟡 warning
- `longitude` present but out of range → 🟡 warning
- `category` text provided but no match found in existing categories → 🟡 warning (shop imported without category)

**Duplicate detection:**

- Before rendering preview, fetch all existing `shops.phone` from DB (same as `handleSave` dupe check)
- Any row whose `normalizePhone(phone)` matches an existing phone → flagged 🔁 Duplicate (skipped by default)
- Rows with ❌ errors → also skipped
- Rows with 🟡 warnings or ✅ → imported

**Category mapping:**

- Fetch all categories at start of modal open (same query as `ShopModal`)
- Build `Map<normalizedName, id>` (lowercase trim)
- Match `row.category` (lowercase trim) → category id
- If matched → assign; if not → import without category + show warning

**Import execution:**

- Loop over valid rows (no error, not duplicate)
- Insert shop using same `supabase.from('shops').insert(payload)` pattern
- If `categoryId` resolved → insert `shop_categories` row
- Collect success/fail counts
- Show Step 3 result summary

**Template download:**

- `Blob` with CSV header row + one example row
- `URL.createObjectURL` → programmatic `<a>` click → revoke URL

### Preview table columns (compact)

```
# | Name | Phone | Area | Category | Status
```

Status badge: ✅ Ready / 🟡 Warning / ❌ Error / 🔁 Duplicate

On hover/expand: show the specific validation messages per row (via a small expandable detail or tooltip-style inline text under the row).

&nbsp;

## **This plan is good. Proceed, with these refinements:**

1. If both area and address are empty, treat that row as a blocking error, not just a warning.

2. If latitude or longitude is provided but invalid/out of range, treat that row as a blocking error.

3. Detect duplicate phone numbers both:

   - against existing database shops

   - within the uploaded CSV itself

4. In the final result summary, separate:

   - imported rows

   - imported with warnings

   - skipped duplicates

   - skipped validation errors

   - failed inserts

5. Keep category import to one clear category text field unless multi-category support is trivial and safe.

6. Do not use a fragile naive CSV parser. Either handle quoted CSV fields properly or explicitly limit support to simple CSV format and document that clearly in the import UI/template.

7. Reuse existing validation, normalization, and insert patterns wherever possible.

8. Preserve all existing admin workflows unchanged outside this import flow.

### What is NOT done (intentional Phase 3 limits)

- No XLSX/Excel support
- No image import (image_url column silently ignored)
- No override-duplicate option (safe default: skip)
- No per-row "force import anyway" checkbox
- No export system
- No public submission flow

### UI pattern reuse

- Modal uses same fixed-inset overlay as `ShopModal`
- Table uses same card+table pattern as `ShopsTab`
- Buttons use same primary/outline/destructive pattern
- Error/warning colors use existing `text-destructive` / `text-secondary` / `text-success` tokens
- Loading state uses `Loader2` animate-spin (already imported)

### V2_DOC_CHANGES.md

Updated at end to document Phase 3.