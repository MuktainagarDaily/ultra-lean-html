
## What needs to change

The logo image currently sits inside a plain `<div className="flex justify-center mb-1">` with no special blending. The PNG itself likely has a non-transparent background (a white or colored rectangle), which makes it look like a box sitting on top of the gradient.

The fix is purely CSS — no image editing needed:

### Approach

1. **Logo container** (`src/pages/Home.tsx`, lines 217-224):
   - Wrap the `<img>` in a container that has `background: transparent` and a soft centered radial glow overlay (using a `::before`-style pseudo div or a sibling `<div>` with `pointer-events-none absolute inset-0 rounded-full` and a radial gradient of `rgba(255,255,255,0.06)` fading to transparent).
   - Set `mix-blend-mode: screen` or `mix-blend-mode: lighten` on the `<img>` itself — this makes the dark/colored background of the PNG dissolve into the blue hero gradient, keeping only the bright logo content visible.
   - Apply `filter: drop-shadow(0 10px 30px rgba(0,0,0,0.35))` for depth.
   - Remove the existing `drop-shadow-2xl` class and the old inline filter style.

2. **Hero background** (lines 191-195):
   - Swap to the exact gradient specified: `linear-gradient(135deg, #0F3D6E 0%, #1E4FA3 100%)` — slightly different from the current `145deg` HSL version, gives a cleaner deep navy-to-blue look.

### Exact code change — lines 217–224

```tsx
{/* Brand Logo — blended into hero gradient */}
<div className="relative flex justify-center items-center mb-1">
  {/* Soft radial glow behind logo */}
  <div
    className="absolute inset-0 pointer-events-none rounded-full"
    style={{
      background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)',
    }}
  />
  <img
    src={logoIcon}
    alt="Muktainagar Daily — Local Business & Services Hub"
    className="w-full max-w-[360px] sm:max-w-[420px] object-contain relative z-10"
    style={{
      mixBlendMode: 'screen',
      filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.35))',
    }}
  />
</div>
```

`mix-blend-mode: screen` causes any near-black pixels in the PNG background to become fully transparent against the dark blue gradient, while white/light/colored pixels in the actual logo artwork remain visible. No image re-export needed.

### Files to edit
- `src/pages/Home.tsx` — logo container (lines 217–224) + hero gradient (line 194)

No database, no new components, no asset changes needed.
