
## Audit

**Already exists (keep unchanged):**
- `Download` icon already imported at line 7
- `ShopsTab` already has `filtered` (the current view-filtered shops array) and `shops` (all loaded shops)
- Toolbar pattern with `Import CSV` + `Add Shop` buttons at lines 315–329

**What's missing:**
- Export CSV button and the CSV generation logic

---

## Plan

**Single file change: `src/pages/AdminDashboard.tsx`**

### 1. Add `exportCsv` helper inside `ShopsTab`

Place it just after the `deleteShop` mutation (before the `return`):

```typescript
const exportCsv = useCallback(() => {
  const headers = ['Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Categories', 'Active', 'Verified'];
  const rows = filtered.map((s: any) => {
    const cats = (s.shop_categories || [])
      .map((sc: any) => sc.categories?.name)
      .filter(Boolean)
      .join(' | ');
    return [
      s.name ?? '',
      s.phone ?? '',
      s.whatsapp ?? '',
      s.area ?? '',
      s.address ?? '',
      cats,
      s.is_active ? 'Yes' : 'No',
      s.is_verified ? 'Yes' : 'No',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `muktainagar-shops-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}, [filtered]);
```

Key details:
- Uses `filtered` (respects current search/category filter — exports what admin sees)
- `\uFEFF` BOM prefix for UTF-8 Excel compatibility
- Proper CSV quoting (`""` escaping for internal quotes)
- Filename includes date: `muktainagar-shops-2026-03-08.csv`

### 2. Add Export CSV button to the toolbar

Insert between the existing `Import CSV` and `Add Shop` buttons:

```tsx
<button
  onClick={exportCsv}
  className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
>
  <Download className="w-4 h-4" />
  <span className="hidden sm:inline">Export CSV</span>
</button>
```

- Same visual style as the Import CSV button
- Label hides on mobile (icon only) — consistent with existing pattern

### Result

The toolbar in ShopsTab will read:
```text
[ 🔍 Search ] [ ▼ Category ] [ ↑ Import CSV ] [ ↓ Export CSV ] [ + Add Shop ]
```

No DB changes, no new dependencies, no new files.
