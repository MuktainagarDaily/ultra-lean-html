
## Plan: Near-Duplicate Area Detection + One-Click Merge

### The Core Problem
`areaSummary` groups areas by **exact string match**. "Near Parivartan Chowk, परिवर्तन चौकाजवळ" and "Near Parivartan chowk" differ in case and have a Marathi suffix, so they're counted as 2 separate unique areas even though they're the same locality.

### Approach: Add a "Similar Areas" warning row + Merge button

Instead of auto-merging (admin stays in control), surface a **"similar areas" badge** inline on the area table rows, and add a **"Merge into →"** dropdown/quick-action button that lets the admin click once to consolidate one area into another.

#### Algorithm for detecting near-duplicates
Normalize each area name to a comparable key:
```ts
function areaCompareKey(area: string): string {
  return area
    .toLowerCase()
    .replace(/[\u0900-\u097F]+/g, '')   // strip Devanagari (Marathi) characters
    .replace(/[^a-z0-9\s]/g, '')        // strip punctuation/commas
    .replace(/\s+/g, ' ')
    .trim();
}
```

Two areas are "similar" if their compare keys are identical (or one is a prefix/substring of the other at ≥80% overlap). For the specific case in the screenshot:
- "Near Parivartan Chowk, परिवर्तन चौकाजवळ" → `"near parivartan chowk"`
- "Near Parivartan chowk" → `"near parivartan chowk"`

These produce the **same key** — flagged as a pair.

#### UI Changes in `areaSummary` table (lines 1320–1378)
1. Compute `similarAreaGroups` as a `Map<string, string[]>` in a `useMemo` — key = normalized compare key, value = list of original area strings with that key
2. For each row in the table, check if that area's key has `similarAreaGroups.get(key).length > 1`
3. If yes → show an orange **"similar to: X"** badge (like the suspicious badge) under the area name, showing what it's similar to
4. Add a **"Merge →"** button next to the Rename button that pre-fills the rename input with the **"best" candidate** from the similar group

#### Picking the "best" area name
When the user clicks "Merge →", pre-fill the rename input with the candidate that has:
- The most shops (higher count = canonical one)
- If tied: the one with Marathi characters (more complete bilingual name wins)
- Logic: `candidates.sort((a,b) => b.count - a.count || (hasDevanagari(b.area) ? 1 : -1))[0].area`

#### State additions (minimal)
```ts
const [areaMergeTarget, setAreaMergeTarget] = useState<string | null>(null);
```
When merge is clicked on an area row → it sets `areaRenameTarget` to that area AND pre-fills `areaRenameValue` with the best candidate name. No new state needed — reuse existing rename flow completely.

### Files to change
**`src/pages/AdminDashboard.tsx`** only:

1. **Lines 1192–1201** — Add `areaCompareKey()` helper and `similarAreaGroups` useMemo after `areaSummary`

2. **Lines 1320–1378** — In each area table row:
   - Compute `similarKey = areaCompareKey(area)`
   - Look up `similarAreaGroups.get(similarKey)` — if it has other entries, show an orange **"similar: Near Parivartan chowk"** badge under the name
   - Add a **"Merge →"** button that calls `setAreaRenameTarget(area)` + `setAreaRenameValue(bestCandidate)` in one click (reuses existing rename/save flow)

3. **Lines 1383–1386** — Update the hint text to mention the new similar-area detection

### What stays unchanged
- The rename flow, save/cancel, toast messages — all unchanged
- The `handleAreaRename` function is reused as-is; "Merge" just pre-fills it with the canonical name
- No DB schema changes needed

### Visual result (area table row for the duplicate)

```text
Area Name                                          Shops   Actions
──────────────────────────────────────────────────────────────────────
Near Parivartan Chowk, परिवर्तन चौकाजवळ    [1]   [Rename]
  ⚠ similar: "Near Parivartan chowk"              [Merge →]

Near Parivartan chowk                        [1]   [Rename]
  ⚠ similar: "Near Parivartan Chowk, परिवर्तन…"  [Merge →]
```

Clicking **"Merge →"** on "Near Parivartan chowk" pre-fills the rename input with "Near Parivartan Chowk, परिवर्तन चौकाजवळ" (the bilingual/higher-count one). Admin clicks Save — done. All shops in the discarded area are now under the canonical name.
