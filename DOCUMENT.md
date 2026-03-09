# Muktainagar Daily — Project Documentation

> **Version:** V2.8  
> **Domain:** muktainagardaily.in  
> **Last Updated:** 9 March 2026  
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
8. [Key Features — Current State (V2)](#key-features--current-state-v2)
9. [Business Logic](#business-logic)
10. [Performance & Caching](#performance--caching)
11. [Known Limitations — V3 Backlog](#known-limitations--v3-backlog)

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
| Form Validation | Custom client-side (name, phone required; area/address ≥1 required; lat/lng range validated) |
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
│   ├── ShopCard.tsx           — Reusable shop listing card (with verified badge)
│   ├── RequestListingModal.tsx — Public shop submission form (FAB → modal)
│   ├── NavLink.tsx            — (Unused in V2, safe to remove)
│   └── ui/                    — shadcn/ui component library
├── hooks/
│   ├── useAuth.tsx            — Supabase auth state + signOut
│   ├── useInterval.ts         — Safe setInterval hook (for auto-refresh)
│   └── use-mobile.tsx         — Mobile breakpoint detection
├── lib/
│   ├── shopUtils.ts           — isShopOpen(), formatTime() utilities
│   └── utils.ts               — Tailwind cn() merge helper
├── pages/
│   ├── Home.tsx               — Public homepage (hero, search, categories, featured/recent, trust strip)
│   ├── Shops.tsx              — All shops listing + search + bottom-sheet filter
│   ├── CategoryPage.tsx       — Shops filtered by category + bottom-sheet filter
│   ├── ShopDetail.tsx         — Individual shop detail + engagement tracking
│   ├── AdminLogin.tsx         — Admin login form
│   ├── AdminDashboard.tsx     — Admin management UI (5 tabs: Shops, Categories, Analytics, Requests, Quality)
│   ├── Index.tsx              — (Redirect to Home if needed)
│   └── NotFound.tsx           — 404 page
├── integrations/supabase/
│   ├── client.ts              — Supabase client instance (auto-generated)
│   └── types.ts               — TypeScript types from DB schema (auto-generated)
supabase/
└── config.toml                — Supabase project config (auto-generated)
DOCUMENT.md                    — This file
V2_DOC_CHANGES.md              — Change log tracking V2 additions and bug fixes
```

---

## Routes & Pages

| Path | Component | Description | Access |
|---|---|---|---|
| `/` | `Home` | Homepage: hero, search, trust strip, categories, featured shops, recent additions, stats | Public |
| `/shops` | `Shops` | All active shops, search + bottom-sheet filter (area, availability, category) | Public |
| `/category/:id` | `CategoryPage` | Shops filtered by a specific category + bottom-sheet filter | Public |
| `/shop/:id` | `ShopDetail` | Full shop details — **blocked if `is_active = false`** | Public |
| `/admin/login` | `AdminLogin` | Admin email + password login | Public |
| `/admin` | `AdminDashboard` | Manage shops, categories, analytics, requests, data quality | Auth-only |
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
- Admin behaviour is unaffected (admin accesses shops through the dashboard)

---

## Database Schema

### Table: `categories`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | — | Category display name (e.g. "Grocery") |
| `icon` | text | No | `'🏪'` | Emoji icon for the category |
| `is_active` | boolean | No | `true` | Show/hide on public site; also used to flag merged/disabled categories |
| `updated_at` | timestamptz | No | `now()` | Auto-updated by trigger on UPDATE |

### Table: `shops`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | — | Shop name (required) |
| `phone` | text | Yes | null | Primary contact phone |
| `whatsapp` | text | Yes | null | WhatsApp number (digits only, `91XXXXXXXXXX` prefix) |
| `address` | text | Yes | null | Full street address |
| `area` | text | Yes | null | Locality / ward / area name (title-cased on save) |
| `latitude` | float8 | Yes | null | GPS latitude (-90 to 90) |
| `longitude` | float8 | Yes | null | GPS longitude (-180 to 180) |
| `opening_time` | time | Yes | null | Daily opening time (HH:MM) |
| `closing_time` | time | Yes | null | Daily closing time (HH:MM); overnight supported (close < open) |
| `is_open` | boolean | No | `true` | Manual override flag (fallback when no times set) |
| `is_active` | boolean | No | `true` | Admin-controlled visibility |
| `is_verified` | boolean | No | `false` | Admin-checked verification badge (shown on card + detail) |
| `image_url` | text | Yes | null | Public URL to shop image in storage |
| `category_id` | uuid | Yes | null | Legacy FK to categories (kept for compat; canonical source is `shop_categories`) |
| `created_at` | timestamptz | No | `now()` | Record creation time |
| `updated_at` | timestamptz | No | `now()` | Auto-updated by trigger on UPDATE |

> **Note on `category_id`:** This legacy column is populated on insert for backward compatibility. The canonical multi-category source is the `shop_categories` junction table. The `ShopModal` pre-fills categories from `shop_categories` first, falling back to `category_id` if the junction is empty (handles pre-V2 shops). A data migration backfills `shop_categories` from `category_id` for shops that were missing a junction row.

### Table: `shop_categories` (junction table)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `shop_id` | uuid | No | — | FK → shops.id |
| `category_id` | uuid | No | — | FK → categories.id |

> **Note:** `UNIQUE(shop_id, category_id)` constraint prevents duplicate links.  
> A shop can belong to multiple categories via this table.  
> No UPDATE policy on this table (intentional). Category reassignment uses DELETE + INSERT to bypass the RLS gap.

### Table: `shop_engagement`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `shop_id` | uuid | No | — | FK → shops.id (CASCADE DELETE) |
| `event_type` | text | No | — | `'call'` or `'whatsapp'` |
| `created_at` | timestamptz | No | `now()` | Timestamp of the tap event |

> **Purpose:** Every time a public user taps "Call" or "Chat on WhatsApp" on a shop detail page **or the home page compact card**, a record is inserted here. Used by admin to rank shops by engagement in the Analytics tab.  
> **Indexed on:** `shop_id`, `event_type`, `created_at` for fast aggregation.

### Table: `shop_requests`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | — | Shop name (required) |
| `phone` | text | No | — | Contact phone (required) |
| `whatsapp` | text | Yes | null | WhatsApp number |
| `address` | text | Yes | null | Full address |
| `area` | text | Yes | null | Locality |
| `category_text` | text | Yes | null | Free-text category (no FK) |
| `opening_time` | text | Yes | null | Opening time as text |
| `closing_time` | text | Yes | null | Closing time as text; overnight supported (close < open) |
| `latitude` | float8 | Yes | null | GPS latitude |
| `longitude` | float8 | Yes | null | GPS longitude |
| `maps_link` | text | Yes | null | Pasted Google Maps URL (auto-parsed for lat/lng) |
| `image_url` | text | Yes | null | Uploaded photo (stored in `shop-images`) |
| `submitter_name` | text | Yes | null | Person who submitted the request |
| `admin_notes` | text | Yes | null | Admin notes on approval/rejection |
| `status` | text | No | `'pending'` | `'pending'` / `'approved'` / `'rejected'` |
| `created_at` | timestamptz | No | `now()` | Submission time |
| `updated_at` | timestamptz | No | `now()` | Auto-updated on status change |

> **Flow:** Public user submits via the WhatsApp FAB → `RequestListingModal`. Admin reviews in the Requests tab: duplicate-check → approve (auto-creates shop) or reject. Deleting a request also deletes its image from storage.

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

> **No UPDATE policy** — intentional. Category reassignment (including the merge feature) uses DELETE + INSERT to avoid the missing UPDATE policy.

### `shop_engagement`

| Policy | Command | Rule |
|---|---|---|
| Public can insert engagement events | INSERT | `true` (anonymous tap tracking, no auth required) |
| Authenticated users can read engagement | SELECT | `auth.role() = 'authenticated'` (admin only) |

> INSERT is intentionally open to anonymous users so tap tracking works without requiring login.

### `shop_requests`

| Policy | Command | Rule |
|---|---|---|
| Public can submit shop requests | INSERT | `true` (anyone can submit) |
| Authenticated users can read shop requests | SELECT | `auth.role() = 'authenticated'` |
| Authenticated users can update shop requests | UPDATE | `auth.role() = 'authenticated'` |
| Authenticated users can delete shop requests | DELETE | `auth.role() = 'authenticated'` |

---

## Storage Buckets

| Bucket | Public | Used For |
|---|---|---|
| `shop-images` | Yes | Compressed WebP shop photos (from both admin adds and public requests) |

### Upload Flow
1. User selects an image file (admin form or public request form)
2. Client compresses it to WebP (max 800px width, 75% quality) via Canvas API
3. Uploaded to `shop-images/{timestamp}.webp` with `upsert: true`
4. Public URL is stored in `shops.image_url` (admin) or `shop_requests.image_url` (request)
5. **Storage cleanup:** When a shop image is replaced, the old file is deleted from storage. When a request is deleted, its image is also deleted from storage.

### Storage Pagination
The admin Data Quality → Storage Audit tool uses a paginated loop (`from(0, 999)` per page) to list all files, since the storage API returns max 1000 items per call. This prevents missed files in buckets with many images.

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

## Key Features — Current State (V2)

### Public Site

#### Homepage (`Home.tsx`)
- **Hero section** — deep gradient (145deg, primary → darker blue), subtle grid texture overlay, decorative blobs
- **Brand & tagline** — "Muktainagar Daily" with Marathi subtitle + location line
- **Trust strip** — "Direct calls · Verified listings · Local businesses · Free listing"
- **Search bar** — full-width; placeholder in Marathi; navigates to `/shops?q=`
- **Category quick-filter chips** — horizontally scrollable chip strip below the search bar; shows up to 6 active categories (icon + name); clicking navigates directly to `/category/:id`; a trailing "More →" chip links to `/shops` when there are more than 6 categories; zero extra queries (uses already-loaded `sortedCategories`)
- **Stats pills** — total shops, open-now count (success-tinted), verified count (accent), category count
- **Category grid** — sorted by shop count descending; count badge per tile; links to `/category/:id`
- **Featured Verified Shops** — horizontal scroll of `is_verified = true` shops with compact tap-to-call/WA cards and engagement tracking
- **Recently Added** — horizontal scroll of the 8 most recently created shops (compact cards + engagement tracking)
- **?filter=verified** URL param — scrolls/focuses verified section on load
- **WhatsApp FAB** — floating "दुकान नोंदवा / List your shop" button → opens `RequestListingModal`

#### Shop Listing & Detail
- **All Shops** — search by name, area, address (ilike on DB), phone digit match; bottom-sheet filter (area multiselect, availability toggle, category multiselect); "Open Now" filter; skeleton loading; error state with retry
- **Category Page** — single-query join; bottom-sheet filter; "Open Now" filter; skeleton loading
- **Shop Detail** — full info card; Call / WhatsApp / Open in Google Maps / Share buttons; verified badge if `is_verified = true`; broken image URLs fail gracefully
- **Inactive Shop Guard** — `/shop/:id` for `is_active = false` shows unavailable screen (🔒), not shop data
- **Share Button** — uses `navigator.share` on mobile; falls back to clipboard copy with toast
- **Auto-refresh** — `useInterval` hook refreshes shop open/closed status every 60 seconds

#### Public Shop Submission (`RequestListingModal`)
- Triggered by floating WhatsApp FAB on homepage
- Fields: Name (required), Phone (required), WhatsApp (optional), Area, Address, Category (free text), Opening/Closing time, Google Maps link (auto-parses lat/lng), Photo upload
- **Overnight time validation** — closing time identical to opening time is blocked; close before open is explicitly allowed (overnight shops)
- **Location optional** — Google Maps link, lat/lng, address are all optional; form submits without them
- **Area normalization** — title-cased using bilingual-safe regex (preserves Devanagari, capitalises ASCII word starts after spaces/commas)
- Inserts to `shop_requests` table with `status = 'pending'`
- Image compressed to WebP before upload to `shop-images`

#### Engagement Tracking
- Tapping **"Call"** fires a fire-and-forget insert to `shop_engagement` (`event_type = 'call'`)
- Tapping **"Chat on WhatsApp"** fires an insert (`event_type = 'whatsapp'`)
- Tracking fires from **both** `ShopDetail` page **and** compact cards on the Home page
- Non-blocking — errors are silently ignored; no authentication required from visitor

### Admin Panel (`AdminDashboard.tsx`)

#### Stats Bar
4 cards (2-col on mobile, 5-col on xl): Total Shops / Active / Verified / Categories / Pending Requests

#### Shops Tab
- Add / Edit / Delete shops with full form (`ShopModal`)
- **Search** (client-side: name, area, address, phone) + **Category filter** dropdown
- Activate/deactivate toggle; Verified toggle
- **Quick-preview link** — `ExternalLink` icon per row opens `/shop/:id` in a new tab (shows exactly what a public visitor sees)
- **CSV Export** — downloads filtered shop list (name, phone, WhatsApp, area, address, pipe-separated categories, active, verified); UTF-8 BOM for Excel
- **CSV Import** — upload, preview with per-row validation/duplicate detection, import with result summary
- **Safe delete** — `AlertDialog` with shop name; loading state

#### Categories Tab
- Add / Edit / Delete / Toggle active status
- **Category Merge** — merge source category into target; optionally disable source; reassigns all `shop_categories` links using DELETE + INSERT (no UPDATE policy workaround)
- **CSV Export** — downloads category list (name, icon, active)
- **Safe delete** — `AlertDialog` shows names of all linked shops

#### Analytics Tab
- Date range filter: Last 7 days / Last 30 days / All time (default: 30 days)
- Three summary cards: Total Taps, Calls, WhatsApp taps
- **Top Shops** table — sortable by Total / Calls / WhatsApp; ranked by engagement (highest first)
- **Top Categories** table — ranked by engagement via `shop_categories` join
- **CSV Export** — downloads current view (shop name, area, calls, WhatsApp, total); only shown when data exists
- Data source: `shop_engagement` with 5000-row limit to exceed Supabase default 1000-row cap

#### Requests Tab
- Lists `shop_requests` filtered by status: Pending / Approved / Rejected / All
- **Approve** — duplicate phone check → creates shop (copies all fields, uploads image if present) → marks request `approved` → invalidates public shops cache
- **Reject** — marks request `rejected`
- **Delete** — deletes request record + its storage image (if any)
- **View detail** — dialog showing all submitted fields including `admin_notes` (when present)
- **CSV Export** — downloads current filtered list (all fields including submitter, status, timestamps)

#### Data Quality Tab
- **Area Consistency** — detects similar area name variants (case-insensitive grouping); allows bulk rename; flags suspicious names (too short, has digits, looks auto-generated)
- **Possible Duplicates** — detects shops with same normalised phone number, or same name + area
- **Storage Audit** — paginates through `shop-images` bucket (1000/page loop); identifies files not referenced by any shop or request; bulk select + delete; shows file sizes

#### Shop Form Validation (`ShopModal`)
- **Name** — required
- **Phone** — required; must have at least 10 digits
- **WhatsApp** — optional; if provided must have ≥10 digits; normalised to `91XXXXXXXXXX` on save
- **Area / Address** — at least one required; area title-cased on save (bilingual-safe regex)
- **Latitude** — optional; if provided must be a number in range -90 to 90
- **Longitude** — optional; if provided must be a number in range -180 to 180
- **Overnight times** — closing time identical to opening time is blocked; close before open is allowed
- Inline error messages; save blocked until validation passes
- Common area suggestions via `<datalist>`

#### Duplicate Phone Detection (ShopModal, CSV import, Request approval)
Before saving, the form:
1. Normalises phone: strips spaces, dashes, parentheses, `+`; strips leading `91` country code from 12-digit numbers
2. Compares against all existing shops (excluding self on edit)
3. If duplicate: blocks save, opens a `Dialog` showing existing shop details; admin must explicitly click **"Save Anyway"**
4. All three paths (ShopModal, CSV import, request approval) use the same normalisation function

---

## Business Logic

### Open/Closed Status (`isShopOpen` in `src/lib/shopUtils.ts`)

```typescript
// Priority order:
// 1. If both opening_time and closing_time are set → calculate from current time
//    - Supports overnight hours (e.g. 22:00 – 06:00): if closing < opening, wrap around midnight
// 2. Fallback: use shop.is_open (manual override checkbox in admin form)
```

### Area Normalisation (bilingual-safe)

```typescript
// Used in: ShopModal executeSave, handleApprove (request approval),
//          CSV import normaliseArea, RequestListingModal
function normalizeArea(s: string): string {
  return s.trim().replace(/(^|[\s,])([a-z])/g, (_m, sep, c) => sep + c.toUpperCase());
}
// Preserves Devanagari characters; only capitalises ASCII letters after
// word boundaries (start, space, comma). Avoids \b\w which breaks on Unicode.
```

### Phone Normalisation

```typescript
function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  // Strip leading country code: 91XXXXXXXXXX → XXXXXXXXXX (10 digits)
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}
// Used for duplicate detection only; display format is preserved
```

### Engagement Tracking (`logEngagement`)

```typescript
// Fire-and-forget insert — never blocks the tap action
async function logEngagement(shopId: string, eventType: 'call' | 'whatsapp') {
  try {
    await supabase.from('shop_engagement').insert({ shop_id: shopId, event_type: eventType });
  } catch { /* silently ignore */ }
}
// Called from ShopDetail (Call/WA links) AND CompactShopCard on Home (Call/WA buttons)
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
| Engagement query limit | 5000 rows (overrides Supabase default 1000-row cap) |
| Storage audit pagination | 1000 files/page loop (handles buckets > 1000 files) |

### Cache Invalidation
Public-facing queries (`['shops']`, `['categories']`) are invalidated after:
- Admin saves/deletes a shop
- CSV import completes
- Request is approved (new shop created)

This ensures public pages reflect changes immediately without requiring a browser reload.

---

## Known Limitations — V3 Backlog

| Feature | Reason Deferred |
|---|---|
| User signup / accounts | Not needed for read-only public directory |
| Shop reviews & ratings | Requires moderation; V3 |
| Analytics chart / visualisation | Table view is sufficient for V2; bar chart is V2.5 |
| Multi-city support | Muktainagar-only; V3 |
| Area autocomplete | Small dataset; plain text is fine |
| Pagination / infinite scroll | Shop count is small enough for single page |
| Bulk approve / reject requests | V2.5 — high value, not yet built |
| Admin notes editing (writable) | `admin_notes` column exists and is now **displayed** in view modal; making it editable requires a mutation UX — deferred |
| Engagement drill-down per shop | All-time + date range only; per-tap log not shown in UI |
| Password reset flow | Admin can reset via auth settings for now |
| RLS-level inactive shop filtering | Currently filtered at app layer; could add DB-level policy |
| Analytics date range beyond 5000 rows | If engagement volume exceeds 5000/30d, cap needs raising |
| Payment / ad platform | V3+ |
| Job board / lost & found | Out of scope |
| PWA push notifications | V3 |
| AI recommendations | V3+ |
| Verified badge on category page cards | Shown on ShopDetail + ShopCard; category page uses same ShopCard so it's there |
| Dynamic OG images per shop | Requires SSR; client-side React cannot generate per-URL meta at crawl time |
| PWA screenshots in manifest | Requires actual device screenshots + design work |

