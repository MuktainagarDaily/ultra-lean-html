
## Social Preview Image Plan

### What exists
- `og:image` and `twitter:image` are set in `index.html` (line 27-28), currently pointing to an auto-generated Lovable screenshot URL — not a designed image
- `twitter:card` is `"summary"` (line 15) — this needs to be `"summary_large_image"` to show the big banner image on Twitter/X
- Brand colors confirmed: primary blue `#1d6db0`, amber `#f5a623`, warm off-white `#f8f6f0`

### Social image design specification
**Size**: 1200×630px (standard OG/Twitter banner ratio — works everywhere: Facebook, Twitter/X, LinkedIn, WhatsApp, Telegram)

**Design layout**:
```text
┌─────────────────────────────────────────────────────┐
│  [Blue gradient bg: #1254a0 → #1d6db0 left to right]│
│                                                     │
│   ┌──┐                                              │
│   │MD│ ← MD logo mark (pin + amber dot)             │
│   └──┘                                              │
│                                                     │
│   Muktainagar Daily          [shop icons row]       │
│   (bold white, large)                               │
│                                                     │
│   Your Hyperlocal                                   │
│   Business Directory         [amber underline bar]  │
│   (white, subtitle)                                 │
│                                                     │
│   🛒 Grocery  💊 Medical  🍽 Restaurants  +more     │
│   (small amber pills at bottom)                     │
└─────────────────────────────────────────────────────┘
```

**Elements**:
- Deep blue gradient background (left: `#1254a0`, right: `#1d6db0`)
- Subtle grid/dot texture overlay (modern, professional feel)
- Large bold white wordmark "Muktainagar Daily" 
- Amber accent: left vertical bar / underline on tagline
- Tagline: "Your Hyperlocal Business Directory"
- Category pills row: Grocery · Medical · Restaurants · Pharmacy · More
- MD logo mark (rounded square with gradient) top-left corner
- Small "muktainagar-daily.lovable.app" URL at bottom right in muted white

### Files to change: 2

#### 1. Generate social image → save to `public/og-image.png`
Use AI image generation (Nano banana pro) to create a 1200×630 polished social banner. The prompt:
> "Professional OG social preview banner, 1200x630px. Deep blue gradient background left to right #1254a0 to #1d6db0. Left side: small 'MD' rounded square logo icon with white text and amber dot. Below it large bold white sans-serif text 'Muktainagar Daily'. Below that white text 'Your Hyperlocal Business Directory'. Bottom row: small rounded pill tags in amber/gold: Grocery, Medical, Restaurants, Pharmacy. Right side: subtle abstract illustration of a map pin and small shop storefronts in white at low opacity. Clean, modern, flat design, professional."

This will be generated programmatically using a Lovable edge function calling the AI image endpoint, then saved to Supabase storage and referenced by URL — OR saved directly as a static PNG to `public/og-image.png`.

Since the AI generation produces base64, the plan is:
1. Generate the image via edge function
2. Upload to `shop-images` or a public bucket  
3. Get public URL
4. Hardcode that URL into `index.html`

**Simpler safe approach**: Generate the image in-browser via a new admin-only `/og-preview` route that renders the design using HTML/CSS/Canvas, then the user can screenshot it. But this is manual.

**Best approach for this plan**: Create a `public/og-image.svg` — a hand-crafted SVG that renders perfectly as the 1200×630 social banner. SVGs are supported for og:image on most platforms (Facebook works with PNG, Twitter requires PNG/JPG). So:
- Create `public/og-image.svg` as the design source (for reference)
- Also write a script to generate `public/og-image.png` using the Lovable AI image API called from an edge function
- Deploy edge function → call it once → get base64 PNG → save to storage → update `index.html` with storage URL

Actually the cleanest path is: generate the PNG using the AI image API within an edge function, upload it to Supabase storage's `shop-images` bucket (or a `public` bucket), get the public URL, and bake that URL into `index.html`.

#### 2. `index.html` — Update OG/Twitter meta tags
- Change `twitter:card` from `"summary"` to `"summary_large_image"`
- Update `og:image` and `twitter:image` to point to the new `/og-image.png` (relative, or absolute with the published domain)
- Add `og:image:width` = 1200 and `og:image:height` = 630
- Add `og:url` = `https://muktainagar-daily.lovable.app`

### Implementation steps
1. Create Supabase edge function `generate-og-image` that:
   - Calls the Lovable AI image API with a detailed prompt
   - Receives base64 PNG (1200×630)
   - Uploads it to the `shop-images` bucket as `og-social-preview.png`
   - Returns the public URL
2. Deploy the edge function
3. Call it once to generate and store the image
4. Update `index.html` with the returned URL + fix `twitter:card`

This ensures the og:image is a real hosted PNG that all social scrapers can fetch — not a runtime-rendered SVG that many crawlers can't process.

### Summary
- 1 new edge function: `supabase/functions/generate-og-image/index.ts`
- 1 file updated: `index.html` (twitter:card → summary_large_image, new og:image URL from storage)
- The edge function is admin-triggered (runs once), generates and stores the image, returns the URL
- After deploy, I call the function once programmatically and hardcode the resulting storage URL into `index.html`
