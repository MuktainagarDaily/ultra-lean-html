## Root cause

The previous fix raised the autocomplete dropdown's `z-index` to `z-[999]`, but the dropdown is **still being hidden** — not behind other sections, but **clipped by its parent**.

In `src/pages/Home.tsx` line 402, the `<header>` element has:

```tsx
className="text-primary-foreground px-4 pt-7 pb-6 relative overflow-hidden"
```

The `overflow-hidden` is required to contain three decorative absolute layers inside the header (lines 407–421): a top-right white radial blob, a bottom-left secondary blob, and a faint grid overlay. These all use `absolute inset-0` with translate offsets and would visually leak outside the header without clipping.

The autocomplete dropdown (`absolute top-full mt-1`, line 485) is rendered **inside this header**. When it extends below the header's bottom edge into the area where "Recently Added" sits, it gets visually **cut off by `overflow-hidden`** — `z-index` cannot escape an `overflow-hidden` ancestor. That's why only the first ~2 suggestions are visible: they fit within the header's residual padding; the rest are clipped.

## Fix

Move the decorative layers into a dedicated **clipping wrapper** so the header itself no longer needs `overflow-hidden`. The dropdown can then extend freely below the header and float over "Recently Added" thanks to its existing `z-[999]`.

### `src/pages/Home.tsx` — lines 401–422

**Change 1**: Remove `overflow-hidden` from the `<header>` element.

```diff
- <header
-   className="text-primary-foreground px-4 pt-7 pb-6 relative overflow-hidden"
+ <header
+   className="text-primary-foreground px-4 pt-7 pb-6 relative"
    style={{
      background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(214 85% 28%) 60%, hsl(215 90% 22%) 100%)',
    }}
  >
```

**Change 2**: Wrap the three decorative divs (lines 407–421) in a single `absolute inset-0 overflow-hidden pointer-events-none` container. The wrapper clips the blobs/grid; the header itself no longer clips its children.

```tsx
<div className="absolute inset-0 overflow-hidden pointer-events-none">
  {/* existing top-right blob */}
  {/* existing bottom-left blob */}
  {/* existing grid overlay */}
</div>
```

That's it — no other changes. The dropdown's existing `z-[999]` and `top-full` positioning will then correctly float above the "Recently Added" section, the trust strip, and the categories section beneath the header.

### Why not other approaches

- **Move dropdown to a portal** — overkill, adds positioning complexity for what is purely a CSS clipping issue.
- **Position dropdown `fixed`** — would break alignment on resize/scroll and complicate width calculation.
- **Open dropdown upward (`bottom-full`)** — was discussed earlier; awkward UX since the search bar is already near the top of the page and the dropdown would cover the brand title.

## Files to change

| File | Change |
|---|---|
| `src/pages/Home.tsx` | Remove `overflow-hidden` from `<header>`; wrap the 3 decorative blobs/grid in a single `absolute inset-0 overflow-hidden pointer-events-none` clipping div |

No database, env, or other file changes.
