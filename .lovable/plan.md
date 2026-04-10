

## What to build

Two new CSV import features: one for bulk category import in the Categories tab, and one for analytics engagement import in the Analytics tab. Both follow the existing `CsvImportModal` pattern (upload → preview → import).

---

### 1. Category CSV Import Modal — `src/components/admin/CategoryCsvImportModal.tsx`

New modal component following the same pattern as `CsvImportModal.tsx`:

- **Template**: 3 columns — `Name, Icon, Active` (matches the uploaded CSV format)
- **Download template** button generates a sample CSV with one example row
- **Upload & parse**: reuse the same `parseCsvLine`/`parseCsv` helpers (extract to shared util or inline)
- **Preview table**: show parsed rows with validation status:
  - `error` if `name` is empty
  - `warning` if `icon` is empty (default to `🏪`)
  - `duplicate` if name already exists in DB categories
- **Import**: for each valid row, upsert into `categories` table (`name`, `icon`, `is_active`)
  - Skip duplicates (by name match) or update them — show choice
- **Result summary**: imported / skipped / errors

### 2. Wire it into `CategoriesTab.tsx`

- Add an "Import CSV" button next to existing "Export CSV" and "Add Category" buttons
- Add state `showCatImport` and render `CategoryCsvImportModal` when true
- On done, invalidate `admin-categories` and `admin-stats` queries

---

### 3. Analytics CSV Import Modal — `src/components/admin/AnalyticsCsvImportModal.tsx`

New modal for importing engagement data:

- **Template**: 5 columns — `Shop Name, Area, Calls, WhatsApp, Total` (matches uploaded CSV)
- **Download template** generates sample CSV
- **Upload & parse**: parse CSV, match `Shop Name` against existing shops in DB
- **Preview table**: show rows with status:
  - `error` if shop name not found in DB
  - `ready` if matched
  - Show resolved shop name for confirmation
- **Import**: for each matched row, insert `N` engagement events into `shop_engagement`:
  - `calls` count → N rows with `event_type = 'call'`
  - `whatsapp` count → N rows with `event_type = 'whatsapp'`
  - Use current timestamp for `created_at`
- **Result summary**: events inserted / shops matched / skipped

### 4. Wire it into `AnalyticsTab.tsx`

- Add "Import CSV" button next to existing "Export CSV" button
- Add state and render `AnalyticsCsvImportModal`
- On done, invalidate `admin-engagement` query

---

### Files to create/change

| File | Change |
|---|---|
| `src/components/admin/CategoryCsvImportModal.tsx` | New — category bulk import modal |
| `src/components/admin/AnalyticsCsvImportModal.tsx` | New — analytics engagement import modal |
| `src/components/admin/CategoriesTab.tsx` | Add Import CSV button + modal state |
| `src/components/admin/AnalyticsTab.tsx` | Add Import CSV button + modal state |

No database changes needed — using existing `categories` and `shop_engagement` tables with existing RLS policies.

