# Muktainagar Daily — Project Documentation

> **Version:** V1  
> **Domain:** muktainagardaily.in  
> **Last Updated:** March 2026  
> **Purpose:** Hyperlocal business directory for Muktainagar, Jalgaon District, Maharashtra

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Routes & Pages](#routes--pages)
4. [Database Schema](#database-schema)
5. [RLS Policies](#rls-policies)
6. [Storage Buckets](#storage-buckets)
7. [Authentication](#authentication)
8. [Key Features — V1](#key-features--v1)
9. [Business Logic](#business-logic)
10. [Performance & Caching](#performance--caching)
11. [Known Limitations — V2 Backlog](#known-limitations--v2-backlog)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v3 + CSS custom properties (design tokens) |
| Routing | React Router DOM v6 |
| Data Fetching | TanStack React Query v5 |
| Backend | Lovable Cloud (Supabase under the hood) |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (email + password, admin-only) |
| Storage | Supabase Storage (`shop-images` bucket, public) |
| UI Components | Radix UI primitives + shadcn/ui (`AlertDialog`, `Dialog`, etc.) |
| Icons | Lucide React |
| Toast Notifications | Sonner |
| Form Validation | Custom client-side (name, phone, area required; lat/lng range validated) |
| Image Compression | Canvas API → WebP (client-side) |
| Deployment | Lovable Cloud |

---

## Project Structure

```
src/
├── App.tsx                    — Root: QueryClient, Router, Auth, Toasts
├── main.tsx                   — Entry point
├── index.css                  — Design tokens (HSL), animations, skeleton shimmer
├── components/
│   ├── ShopCard.tsx           — Reusable shop listing card
│   ├── NavLink.tsx            — (Unused in V1, safe to remove)
│   └── ui/                    — shadcn/ui component library
├── hooks/
│   ├── useAuth.tsx            — Supabase auth state + signOut
│   ├── useInterval.ts         — Safe setInterval hook (for auto-refresh)
│   └── use-mobile.tsx         — Mobile breakpoint detection
├── lib/
│   ├── shopUtils.ts           — isShopOpen(), formatTime() utilities
│   └── utils.ts               — Tailwind cn() merge helper
├── pages/
│   ├── Home.tsx               — Public homepage (hero, search, categories, trust strip)
│   ├── Shops.tsx              — All shops listing + search + filter
│   ├── CategoryPage.tsx       — Shops filtered by category
│   ├── ShopDetail.tsx         — Individual shop detail + engagement tracking
│   ├── AdminLogin.tsx         — Admin login form
│   ├── AdminDashboard.tsx     — Admin management UI (Shops, Categories, Analytics tabs)
│   ├── Index.tsx              — (Redirect to Home if needed)
│   └── NotFound.tsx           — 404 page
├── integrations/supabase/
│   ├── client.ts              — Supabase client instance (auto-generated)
│   └── types.ts               — TypeScript types from DB schema (auto-generated)
supabase/
└── config.toml                — Supabase project config (auto-generated)
DOCUMENT.md                    — This file
```

---

## Routes & Pages

| Path | Component | Description | Access |
|---|---|---|---|
| `/` | `Home` | Homepage: hero, search, trust strip, categories, stats | Public |
| `/shops` | `Shops` | All active shops, search + Open Now filter | Public |
| `/category/:id` | `CategoryPage` | Shops filtered by a specific category | Public |
| `/shop/:id` | `ShopDetail` | Full shop details — **blocked if `is_active = false`** | Public |
| `/admin/login` | `AdminLogin` | Admin email + password login | Public |
| `/admin` | `AdminDashboard` | Manage shops, categories, and analytics | Auth-only |
| `*` | `NotFound` | 404 catch-all | Public |

### Route Protection
`ProtectedRoute` wrapper in `App.tsx` uses `useAuth()` to:
- Show a loading state while auth is resolving
- Redirect unauthenticated users to `/admin/login`
- Render children if authenticated

### Inactive Shop Access
If a user navigates directly to `/shop/:id` for a shop where `is_active = false`:
- The shop detail page renders an **"unavailable" state** (🔒 icon, "This shop is currently unavailable" message)
- The shop data is never displayed to the public
- Admin behavior is unaffected (admin accesses shops through the dashboard, not public URLs)

---

## Database Schema

### Table: `categories`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | — | Category display name (e.g. "Grocery") |
| `icon` | text | No | `'🏪'` | Emoji icon for the category |
| `is_active` | boolean | No | `true` | Show/hide on public site |
| `updated_at` | timestamptz | No | `now()` | Auto-updated by trigger on UPDATE |

### Table: `shops`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | — | Shop name (required) |
| `phone` | text | Yes | null | Primary contact phone |
| `whatsapp` | text | Yes | null | WhatsApp number (digits only for wa.me) |
| `address` | text | Yes | null | Full street address |
| `area` | text | Yes | null | Locality / ward / area name |
| `latitude` | float8 | Yes | null | GPS latitude (-90 to 90) |
| `longitude` | float8 | Yes | null | GPS longitude (-180 to 180) |
| `opening_time` | time | Yes | null | Daily opening time (HH:MM) |
| `closing_time` | time | Yes | null | Daily closing time (HH:MM) |
| `is_open` | boolean | No | `true` | Manual override flag (fallback when no times set) |
| `is_active` | boolean | No | `true` | Admin-controlled visibility |
| `is_verified` | boolean | No | `false` | Admin-checked verification badge |
| `image_url` | text | Yes | null | Public URL to shop image in storage |
| `category_id` | uuid | Yes | null | Legacy FK to categories (kept for compat) |
| `created_at` | timestamptz | No | `now()` | Record creation time |
| `updated_at` | timestamptz | No | `now()` | Auto-updated by trigger on UPDATE |

### Table: `shop_categories` (junction table)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `shop_id` | uuid | No | — | FK → shops.id |
| `category_id` | uuid | No | — | FK → categories.id |

> **Note:** `UNIQUE(shop_id, category_id)` constraint prevents duplicate links.  
> A shop can belong to multiple categories via this table.

### Table: `shop_engagement`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `shop_id` | uuid | No | — | FK → shops.id (CASCADE DELETE) |
| `event_type` | text | No | — | `'call'` or `'whatsapp'` |
| `created_at` | timestamptz | No | `now()` | Timestamp of the tap event |

> **Purpose:** Every time a public user taps "Call" or "Chat on WhatsApp" on a shop detail page, a record is inserted here. Used by admin to rank shops by engagement in the Analytics tab.  
> **Indexed on:** `shop_id`, `event_type`, `created_at` for fast aggregation.

### Database Functions & Triggers

```sql
-- Function: auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger on shops (idempotent)
DROP TRIGGER IF EXISTS shops_updated_at ON public.shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger on categories (idempotent)
DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## RLS Policies

All tables have Row-Level Security enabled.

### `categories`

| Policy | Command | Rule |
|---|---|---|
| Categories are publicly readable | SELECT | `true` (anyone can read) |
| Authenticated users can insert categories | INSERT | `auth.role() = 'authenticated'` |
| Authenticated users can update categories | UPDATE | `auth.role() = 'authenticated'` |
| Authenticated users can delete categories | DELETE | `auth.role() = 'authenticated'` |

### `shops`

| Policy | Command | Rule |
|---|---|---|
| Shops are publicly readable | SELECT | `true` (anyone can read, incl. inactive) |
| Authenticated users can insert shops | INSERT | `auth.role() = 'authenticated'` |
| Authenticated users can update shops | UPDATE | `auth.role() = 'authenticated'` |
| Authenticated users can delete shops | DELETE | `auth.role() = 'authenticated'` |

> **Note:** The public `SELECT` policy returns all rows including `is_active = false`. Inactive shop filtering is enforced **at the application layer** — public listing pages add `.eq('is_active', true)` to their queries; `ShopDetail` blocks rendering if `is_active = false`.

### `shop_categories`

| Policy | Command | Rule |
|---|---|---|
| Shop categories are publicly readable | SELECT | `true` |
| Authenticated users can insert shop_categories | INSERT | `auth.role() = 'authenticated'` |
| Authenticated users can delete shop_categories | DELETE | `auth.role() = 'authenticated'` |

### `shop_engagement`

| Policy | Command | Rule |
|---|---|---|
| Public can insert engagement events | INSERT | `true` (anonymous tap tracking, no auth required) |
| Authenticated users can read engagement | SELECT | `auth.role() = 'authenticated'` (admin only) |

> **Design decision:** INSERT is intentionally open to anonymous users so tap tracking works without requiring login. SELECT is restricted to admin only so engagement data is not publicly readable.

---

## Storage Buckets

| Bucket | Public | Used For |
|---|---|---|
| `shop-images` | Yes | Compressed WebP shop photos |

### Upload Flow
1. Admin selects an image file in the shop form
2. Client compresses it to WebP (max 800px width, 75% quality) via Canvas API
3. Uploaded to `shop-images/{shop-timestamp}.webp` with `upsert: true`
4. Public URL is stored in `shops.image_url`
5. Existing images remain intact on edit; new upload replaces the URL

---

## Authentication

| Setting | Value |
|---|---|
| Provider | Supabase Auth (built-in) |
| Method | Email + Password |
| Access | Admin only (no public signup) |
| Session | Persisted in `localStorage`, auto-refreshed |
| Email Verification | Enabled (required before login) |

### Auth Flow
- Admin navigates to `/admin/login`
- Enters email + password → `supabase.auth.signInWithPassword()`
- On success → redirected to `/admin`
- `useAuth()` hook exposes `user`, `loading`, `signOut()`
- `ProtectedRoute` guards `/admin` — unauthenticated redirected to `/admin/login`

---

## Key Features — V1

### Public Site

#### Homepage (`Home.tsx`)
- **Hero section** — deep gradient (145deg, primary → darker blue), subtle grid texture overlay, decorative blobs
- **Brand & tagline** — "Muktainagar Daily" with Marathi subtitle + location line (`MUKTAINAGAR · JALGAON DISTRICT · MAHARASHTRA`)
- **Trust strip** — thin bar below hero showing "Direct phone calls · Verified listings · Local businesses" with icons
- **Search bar** — prominent, full-width; placeholder in Marathi (`दुकान, सेवा किंवा भाग शोधा…`); focus ring animates on tap (standard browser focus; no programmatic auto-focus implemented)
- **Stats pills** — total shops, open-now count (success-tinted pill), category count
- **Category grid** — sorted by shop count descending (most popular first); count badge per tile
- **WhatsApp FAB** — floating "दुकान नोंदवा / List your shop" button

#### Shop Listing & Detail
- **All Shops** — search by name, area, address (ilike on DB), plus phone digit match; "Open Now" filter toggle; skeleton loading; error state with retry
- **Category Page** — single-query join; "Open Now" filter; skeleton loading
- **Shop Detail** — full info card; Call / WhatsApp / Open in Google Maps / Share buttons; verified badge if `is_verified = true`; broken image URLs fail gracefully (card stays stable)
- **Inactive Shop Guard** — `/shop/:id` for `is_active = false` shows unavailable screen (🔒), not shop data
- **Share Button** — uses `navigator.share` on mobile; falls back to clipboard copy with toast
- **Auto-refresh** — `useInterval` hook refreshes shop open/closed status every 60 seconds

#### Engagement Tracking
- Tapping **"Call"** on a shop detail page fires a fire-and-forget insert to `shop_engagement` with `event_type = 'call'`
- Tapping **"Chat on WhatsApp"** fires an insert with `event_type = 'whatsapp'`
- Tracking is non-blocking — errors are silently ignored, never breaking the user action
- No authentication required from the visitor — the `shop_engagement` INSERT policy is open to anonymous users

### Admin Panel (`AdminDashboard.tsx`)

#### Shops Tab
- Add / Edit / Delete shops with full form
- Activate/deactivate toggle (controls public visibility)
- Verified toggle (controls `is_verified` badge)
- Search by name, area, address, or phone (client-side filter)
- Category filter dropdown (client-side, no extra query)
- **Safe delete** — `AlertDialog` (Radix UI) with shop name; loading state; requires explicit confirm

#### Categories Tab
- Add / Edit / Delete / Toggle categories
- **Safe delete** — `AlertDialog` shows names of all linked shops in a scrollable list; explains links are removed but shops are not deleted; loading state

#### Analytics Tab *(new in V1)*
- Three summary cards: Total Taps, Calls, WhatsApp taps
- Ranked table of shops by total engagement (highest first)
- Shows shop name, area, call count, WhatsApp count, and total
- Empty state when no data exists yet
- Data source: `shop_engagement` table; aggregated client-side from all-time records

#### Shop Form Validation
- **Name** — required
- **Phone** — required; must have at least 10 digits
- **WhatsApp** — optional; if provided must have at least 10 digits; normalized to `91XXXXXXXXXX` on save
- **Area / Address** — at least one required; area title-cased on save for consistency
- **Latitude** — optional; if provided must be a number in range -90 to 90
- **Longitude** — optional; if provided must be a number in range -180 to 180
- Inline error messages below each field; save is blocked until validation passes
- Common area suggestions provided via `<datalist>` (Main Road, Station Road, Bus Stand Area, etc.)

#### Duplicate Phone Detection
Before saving a shop, the admin form:
1. Normalizes the phone number: strips spaces, dashes, parentheses, `+`; strips leading `91` country code (12-digit → 10-digit)
2. Compares against all existing shops (excluding self on edit)
3. If a duplicate is found: **blocks the save**, opens a `Dialog` (Radix UI) showing:
   - Existing shop name, phone, area, and category pills
4. Admin must explicitly click **"Save Anyway"** to proceed; **"Cancel"** is the safe default
5. If no duplicate: proceeds immediately

#### Other Admin Features
- **Stats bar** — Total Shops / Active / Verified / Categories (4 cards)
- **Image upload** — compress to WebP via Canvas API; preview; stored in `shop-images` bucket
- **Multi-category pills** — select one or more categories per shop; junction table `shop_categories`
- **GPS coordinates** — latitude/longitude with range validation; link to Google Maps for pin lookup
- **Manual Open Override** — `is_open` checkbox clearly labeled as fallback for shops without opening/closing times

---

## Business Logic

### Open/Closed Status (`isShopOpen` in `src/lib/shopUtils.ts`)

```typescript
// Priority order:
// 1. If both opening_time and closing_time are set → calculate from current time
//    - Supports overnight hours (e.g. 22:00 – 06:00): if closing < opening, wrap around midnight
// 2. Fallback: use shop.is_open (manual override checkbox in admin form)
```

### Phone Normalization (`normalizePhone` in `AdminDashboard.tsx`)

```typescript
function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  // Strip leading country code: 91XXXXXXXXXX → XXXXXXXXXX (10 digits)
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}
// Used for duplicate detection only; display format is preserved
```

### Engagement Tracking (`logEngagement` in `ShopDetail.tsx`)

```typescript
// Fire-and-forget insert — never blocks the tap action
async function logEngagement(shopId: string, eventType: 'call' | 'whatsapp') {
  try {
    await supabase.from('shop_engagement').insert({ shop_id: shopId, event_type: eventType });
  } catch { /* silently ignore */ }
}
// Called from onClick on the Call <a> and WhatsApp <a> buttons
```

---

## Performance & Caching

| Setting | Value |
|---|---|
| `staleTime` | 30 seconds |
| `gcTime` (garbage collection) | 5 minutes |
| `retry` | 1 |
| `refetchOnWindowFocus` | false |
| Auto-refresh interval | 60 seconds (shops query only) |
| Image loading | `loading="lazy"` on all shop images |
| Image format | WebP (compressed client-side before upload) |

---

## Known Limitations — V2 Backlog

These were deliberately excluded from V1 to keep the product simple and maintainable:

| Feature | Reason Deferred |
|---|---|
| User signup / accounts | Not needed for read-only public directory |
| Shop reviews & ratings | Requires moderation; V2 |
| Analytics date range filter | All-time only in V1; date filter is V1.5 |
| Analytics chart / visualisation | Table view is sufficient for V1; bar chart is V1.5 |
| Multi-city support | Muktainagar-only for V1 |
| Area autocomplete | Small dataset; plain text is fine for V1 |
| Pagination / infinite scroll | Shop count is small enough for single page in V1 |
| Verified badge on shop listing cards | `is_verified` shown on ShopDetail; listing cards is V1.5 |
| Admin image delete (storage cleanup) | Old images accumulate; add cleanup in V1.5 |
| Password reset flow | Admin can reset via auth settings for now |
| RLS-level inactive filtering | Currently filtered at app layer; could add DB-level policy in V2 |
| Payment / ad platform | V3+ |
| Job board / lost & found | Out of scope |
| PWA push notifications | V2 |
| AI recommendations | V3+ |
