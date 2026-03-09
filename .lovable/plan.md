## Root Cause Analysis

### Bug 1 — CRITICAL: `shop_categories` has no UPDATE RLS policy

From the schema:

```
Currently users can't do any of the following actions on shop_categories:
- Can't UPDATE records from the table
```

The merge calls:

```ts
supabase.from('shop_categories').update({ category_id: targetId }).in('id', reassignIds)
```

Supabase RLS silently blocks UPDATE (no error thrown, 0 rows affected). The source links are **never reassigned** — they just sit pointing at the old category. Then if `disableSource = true`, the source category is disabled, making those shops effectively invisible.

**Result**: shops that needed reassignment (not already in target) silently lose their source link and never appear under the target. Exactly the described symptom.

### Bug 2 — Cache invalidation misses public queries

After merge, `onMerged` invalidates `['admin-categories']` and `['admin-shops']` only. The `CategoryPage` uses `['shops', 'category', id]` and the public `Shops` page uses `['shops', 'all', ...]`. Neither is invalidated — even if the fix were applied, the public pages would still show stale data until next manual refresh.

### Fix Strategy

**For Bug 1**: Instead of `UPDATE category_id`, use **DELETE + INSERT**:

1. Delete ALL source-category links (`toReassign` + `toDelete`)
2. Insert new target-category links only for shops not already linked to target (`toReassign` shops)

This completely avoids the missing UPDATE policy. It's also safer — atomic per-shop intent.

**For Bug 2**: After merge, also invalidate:

- `['shops']` (broad key — catches public Shops page)
- `['shops', 'category', targetId]` (catches the target CategoryPage)
- `['admin-stats']` (shop counts change if source was disabled)

### Files to Change

`**src/pages/AdminDashboard.tsx**` — `handleMerge` function (lines 746–801):

Replace the update-based reassignment with delete+insert:

```
OLD:
  // Delete duplicates
  .delete().in('id', toDelete.map(r=>r.id))
  // Update remainders
  .update({ category_id: targetId }).in('id', reassignIds)

NEW:
  // Step 1: Delete ALL source links (both groups)
  .delete().in('id', [...toReassign, ...toDelete].map(r=>r.id))
  // Step 2: Insert new target links only for shops not already in target
  .insert(toReassign.map(r => ({ shop_id: r.shop_id, category_id: targetId })))
```

Also update the `onMerged` callback (lines 715–719) to invalidate broader query keys:

```ts
qc.invalidateQueries({ queryKey: ['admin-categories'] });
qc.invalidateQueries({ queryKey: ['admin-shops'] });
qc.invalidateQueries({ queryKey: ['admin-stats'] });
qc.invalidateQueries({ queryKey: ['shops'] }); // catches public pages
```

### What stays unchanged

- The CategoryMergeModal UI (dialog, confirm alert, checkbox, target selector)
- The `disableSource` logic
- All other tabs, queries, RLS policies, DB schema
- No migration needed (insert uses existing authenticated INSERT policy which is allowed)
- make sure site remain smooth

### Summary 


| #   | Bug                                                                                  | Fix                                                                                 |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | `shop_categories` UPDATE is blocked by RLS (no policy) — reassignment silently fails | Replace `.update()` with `.delete()` + `.insert()`                                  |
| 2   | Cache invalidation misses public category/shop queries                               | Add `['shops']` and `['admin-stats']` to `qc.invalidateQueries` calls in `onMerged` |
