
## Goal
When the user **taps/clicks** the "Verified" badge on the ShopDetail page, a small inline message appears below the badge saying something like *"✓ This shop is trusted and verified by Muktainagar Daily."*

## Approach
Use a simple React `useState` toggle — no external library, no tooltip library, no cloud changes needed. Clicking the badge flips a boolean; a small styled `<p>` animates in below the badge.

## File to change
**`src/pages/ShopDetail.tsx`** — one section only (lines 165–173)

### Current code (lines 165–173):
```jsx
{isVerified && (
  <span
    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
    style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
    title="Verified by Muktainagar Daily"
  >
    <ShieldCheck className="w-3.5 h-3.5" /> Verified
  </span>
)}
```

### New code:
1. Add a `showVerifiedInfo` state at the top of the component (alongside existing `imgError` state).
2. Replace the `<span>` with a clickable wrapper `<button>` so it's accessible.
3. Below the badge, conditionally render a small inline message when `showVerifiedInfo` is true.

```jsx
{isVerified && (
  <div className="flex flex-col gap-1">
    <button
      type="button"
      onClick={() => setShowVerifiedInfo(v => !v)}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold w-fit"
      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
    >
      <ShieldCheck className="w-3.5 h-3.5" /> Verified
    </button>
    {showVerifiedInfo && (
      <p className="text-xs text-muted-foreground px-1 leading-snug">
        ✓ This shop is trusted and verified by Muktainagar Daily.
      </p>
    )}
  </div>
)}
```

## No cloud/DB/SQL changes needed.
Everything is pure UI state — zero backend involvement.
