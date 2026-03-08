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
│   ├── Home.tsx               — Public homepage
│   ├── Shops.tsx              — All shops listing + search + filter
│   ├── CategoryPage.tsx       — Shops filtered by category
│   ├── ShopDetail.tsx         — Individual shop detail page
│   ├── AdminLogin.tsx         — Admin login form
│   ├── AdminDashboard.tsx     — Admin management UI
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
| `/` | `Home` | Homepage: hero, search, categories, stats | Public |
| `/shops` | `Shops` | All active shops, search + Open Now filter | Public |
| `/category/:id` | `CategoryPage` | Shops filtered by a specific category | Public |
| `/shop/:id` | `ShopDetail` | Full shop details — **blocked if `is_active = false`** | Public |
| `/admin/login` | `AdminLogin` | Admin email + password login | Public |
| `/admin` | `AdminDashboard` | Manage shops and categories | Auth-only |
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

-- Trigger on shops (created via migration, idempotent)
DROP TRIGGER IF EXISTS shops_updated_at ON public.shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger on categories (created via migration, idempotent)
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

> **Note:** The public `SELECT` policy returns all rows including `is_active = false`. Inactive shop filtering is enforced **at the application layer** (public listing pages filter `is_active = true` in the query; ShopDetail blocks rendering if `is_active = false`).

### `shop_categories`

| Policy | Command | Rule |
|---|---|---|
| Shop categories are publicly readable | SELECT | `true` |
| Authenticated users can insert shop_categories | INSERT | `auth.role() = 'authenticated'` |
| Authenticated users can delete shop_categories | DELETE | `auth.role() = 'authenticated'` |

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
- **Homepage** — hero with gradient, search bar, live stats (total shops, open now, categories)
- **Category Grid** — sorted by shop count descending; shows shop count badge; navigates to CategoryPage
- **All Shops** — search by name/area/phone; "Open Now" filter toggle; skeleton loading; error state with retry
- **Category Page** — single-query join; "Open Now" filter; skeleton loading
- **Shop Detail** — full info, Call/WhatsApp/Maps/Share buttons; "Verified" badge if `is_verified = true`
- **Inactive Shop Guard** — direct URL `/shop/:id` for inactive shop shows unavailable screen, not shop data
- **Share Button** — uses `navigator.share` on mobile; falls back to clipboard copy with toast
- **Auto-refresh** — `useInterval` hook refreshes shop open/closed status every 60 seconds
- **WhatsApp FAB** — floating "List your shop" button on homepage

### Admin Panel
- **Admin Login** — email + password auth
- **Stats Bar** — Total Shops / Active / Verified / Categories
- **Shop Management** — Add/Edit/Delete shops; activate/deactivate toggle; verified toggle
- **Category Filter** — dropdown in admin shops tab (client-side, no extra query)
- **Search** — filter by name, area, or phone in admin shops tab
- **Duplicate Phone Detection** — before saving, normalizes and checks for duplicate phone numbers:
  - strips spaces, dashes, parentheses, `+`
  - strips leading `91` country code (12-digit → 10-digit normalization)
  - if duplicate found: **blocks the save**, opens a confirmation `Dialog`
  - shows: matching shop name, phone, area, and categories
  - admin must explicitly click "Save Anyway" to proceed; Cancel is the safe default
- **Shop Delete Confirmation** — uses `AlertDialog` (Radix UI); shows shop name; requires explicit confirm; loading state while deleting
- **Category Delete Confirmation** — uses `AlertDialog` (Radix UI); fetches and shows names of all linked shops in a scrollable list; explains that shops are not deleted, only links are removed; loading state while deleting
- **Category Management** — Add/Edit/Delete/Toggle categories
- **Image Upload** — compress to WebP, preview, store in `shop-images` bucket
- **Form Validation** — name required, phone required, area/address required; latitude validated (-90 to 90); longitude validated (-180 to 180)
- **Multi-category** — pill selector in shop form; junction table `shop_categories`
- **GPS Coordinates** — latitude/longitude fields with range validation and link to Google Maps for lookup
- **Manual Open Override** — `is_open` checkbox clearly labeled as fallback for shops without opening/closing times

### Open/Closed Status Logic (`isShopOpen`)
```typescript
// src/lib/shopUtils.ts
// Priority: if opening_time and closing_time both set → calculate automatically
// Supports overnight hours (e.g. 22:00 – 06:00)
// Fallback: use shop.is_open (manual override)
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
| Analytics dashboard | Basic click tracking is V1.5; full dashboard is V2 |
| Multi-city support | Muktainagar-only for V1 |
| WhatsApp click tracking | Easy to add in V1.5; not blocking |
| Area autocomplete | Small dataset; plain text is fine for V1 |
| Pagination / infinite scroll | Shop count is small enough for single page in V1 |
| Verified badge on shop cards | `is_verified` column exists; show on cards in V1.5 |
| Admin image delete (storage cleanup) | Old images accumulate; add cleanup in V1.5 |
| Password reset flow | Admin can reset via auth settings for now |
| RLS-level inactive filtering | Currently filtered at app layer; could add DB-level policy in V2 |
| Payment / ad platform | V3+ |
| Job board / lost & found | Out of scope |
| PWA push notifications | V2 |
| AI recommendations | V3+ |
