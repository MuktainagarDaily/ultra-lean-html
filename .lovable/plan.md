
## Full Audit: Area Consistency — All Bugs Found & Fixes

### Bug 1 (Critical Logic): `bestCandidateMap` tie-break comparator is invalid
**Location**: line 1260–1263  
**Problem**: `(dqHasDevanagari(b) ? 1 : -1)` only checks `b`, not relative `a` vs `b`. If counts are equal and `b` has no Devanagari, it returns `-1` regardless of `a` — this is not a stable sort and produces wrong winners.  
**Fix**: `(dqHasDevanagari(b) ? 1 : 0) - (dqHasDevanagari(a) ? 1 : 0)`

### Bug 2 (Logic): `dqNormalizeAreaValue` fails to title-case words after Devanagari
**Location**: line 1195–1197  
**Problem**: JS `\b` (word boundary) is ASCII-only — it doesn't fire between a Devanagari character and a lowercase ASCII letter. So in `"परिवर्तन chowk"`, the `c` in `chowk` never gets title-cased.  
**Fix**: Replace the `\b[a-z]` approach with a regex that matches the first letter after any non-alpha char (space, comma, Devanagari end) — use a lookbehind: `/(^|[\s,])([a-z])/g` → uppercase the captured letter.

### Bug 3 (UX Confusion): Similar badge truncates too aggressively
**Location**: line 1401  
**Problem**: Truncates at 30 chars with `…` but bilingual names like `"Near Parivartan Chowk, परिवर्तन चौकाजवळ"` are ~40 chars — the truncated version in the badge is confusing.  
**Fix**: Increase truncation to 45 chars. Also add `title={peer}` on the badge span so hovering shows the full name.

### Bug 4 (Console Error): `DrawerHeader` React ref warning in Shops.tsx
**Location**: `src/components/ui/drawer.tsx` line 46–48  
**Problem**: vaul internally tries to pass a ref through `DrawerHeader` (used as a composition child), but it's a plain function component — not `forwardRef`. React throws: "Function components cannot be given refs."  
**Fix**: Wrap `DrawerHeader` with `React.forwardRef`.

### Bug 5 (State leak): `handleAreaRename` doesn't reset `areaRenameValue` on cancel path
**Location**: line 1276–1294  
**Problem**: When `newArea === oldArea` (no-op), the function returns early after clearing `areaRenameTarget` but does NOT reset `areaRenameValue`. If admin then clicks Rename on a different area, the old value is still in the input.  
**Fix**: Add `setAreaRenameValue('')` alongside `setAreaRenameTarget(null)` in the early-return branch.

### Bug 6 (Minor): `dqAreaCompareKey` doesn't guard against non-string input
**Location**: line 1179  
**Problem**: If `area` is somehow an empty string or whitespace-only (shouldn't happen given `areaSummary`'s guard, but defensive programming), calling `.toLowerCase()` on it works but produces an empty key — all empty areas would be grouped together as "similar".  
**Fix**: Add an early return: `if (!area?.trim()) return '__empty__';`

---

### Files to Change

**`src/components/ui/drawer.tsx`** (1 fix)
- Wrap `DrawerHeader` with `React.forwardRef` to fix the React ref warning

**`src/pages/AdminDashboard.tsx`** (5 fixes)
1. Line 1260–1263: Fix tie-break comparator in `bestCandidateMap`
2. Line 1195–1197: Fix `dqNormalizeAreaValue` to title-case words after Devanagari using lookbehind regex
3. Line 1179: Add empty-string guard in `dqAreaCompareKey`
4. Line 1279: Add `setAreaRenameValue('')` to no-op early-return in `handleAreaRename`
5. Line 1401: Increase badge truncation threshold to 45, add `title` tooltip on badge

---

### What is NOT changed
- Core rename/merge flow — works correctly
- `dqIsSuspiciousArea` — correctly ignores Devanagari bilingual names
- `similarAreaGroups` — correct grouping logic
- `areaSummary` — correct deduplication
- All other tabs, queries, modals — unaffected
