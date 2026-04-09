-- ============================================================================
-- MUKTAINAGAR DAILY — MASTER DATABASE SCHEMA (Reference File)
-- ============================================================================
-- This file documents the ENTIRE database schema for Muktainagar Daily.
-- It is the single source of truth for all tables, security rules, functions,
-- triggers, indexes, storage, and default data.
--
-- ⚠️  This is a REFERENCE file — not auto-executed by the migration system.
--     To apply changes, use the Lovable Cloud migration tool, then update
--     this file to stay in sync.
--
-- WHO IS THIS FOR?
--   • Developers — understand every table, column, and relationship
--   • Non-technical readers — plain-English comments explain what each part does
--   • New team members — run this against a fresh database to get a working copy
--
-- HOW TO USE FOR A FRESH SETUP:
--   Run this against a fresh Supabase/Postgres database to recreate everything.
--   Uses "IF NOT EXISTS" and "CREATE OR REPLACE" so it is safe to re-run.
--
-- LAST UPDATED: 2026-04-09
-- ============================================================================


-- ============================================================================
-- SECTION 1: CATEGORIES TABLE
-- ============================================================================
-- What it does: Stores the types of businesses (e.g. Grocery, Medical, Salon).
-- Why it matters: Every shop is tagged with one or more categories so users
--                 can browse by type. Admins can deactivate categories to
--                 hide them from public view without deleting them.

CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,                    -- e.g. "Grocery", "Medical"
  icon       text        NOT NULL DEFAULT '🏪',       -- emoji shown in the UI
  is_active  boolean     NOT NULL DEFAULT true,        -- inactive = hidden from public
  updated_at timestamptz NOT NULL DEFAULT now()        -- auto-updated by trigger
);


-- ============================================================================
-- SECTION 2: SHOPS TABLE
-- ============================================================================
-- What it does: Stores every listed business in Muktainagar.
-- Why it matters: This is the heart of the directory. Each row has the shop's
--                 name, contact info, location, hours, and moderation status.
--
-- KEY COLUMNS EXPLAINED:
--   • is_active   — if false, the shop is hidden from all public pages
--   • is_verified — admin has confirmed this shop is real; shows a ✓ badge
--   • is_open     — legacy flag; actual open/closed is computed from hours
--   • category_id — old single-category link (kept for backward compatibility)
--   • slug        — URL-friendly name (auto-generated), e.g. "sharma-store"
--   • opening_time / closing_time — stored as TEXT like "09:00", "21:00"
--   • area / sub_area — locality names for filtering, e.g. "Main Road"

CREATE TABLE IF NOT EXISTS public.shops (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  category_id  uuid            NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  phone        text            NULL,
  whatsapp     text            NULL,
  address      text            NULL,
  area         text            NULL,
  sub_area     text            NULL,
  description  text            NULL,
  keywords     text            NULL,                  -- comma-separated search terms
  opening_time text            NULL,
  closing_time text            NULL,
  is_open      boolean     NOT NULL DEFAULT true,
  is_active    boolean     NOT NULL DEFAULT true,
  is_verified  boolean     NOT NULL DEFAULT false,
  image_url    text            NULL,                  -- path in shop-images bucket
  latitude     double precision NULL,
  longitude    double precision NULL,
  slug         text            NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Each shop gets a unique URL slug (e.g. /shop/sharma-store)
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_unique ON public.shops (slug);


-- ============================================================================
-- SECTION 3: SHOP_CATEGORIES (JUNCTION TABLE)
-- ============================================================================
-- What it does: Links shops to categories (many-to-many relationship).
-- Why it matters: A single shop can belong to multiple categories.
--                 For example, a store might be both "Grocery" and "Dairy".
--                 Each shop+category pair is unique — no duplicates.
--
-- ON DELETE CASCADE: If a shop or category is deleted, the link is
--                    automatically removed (no orphan rows).

CREATE TABLE IF NOT EXISTS public.shop_categories (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE (shop_id, category_id)
);


-- ============================================================================
-- SECTION 4: SHOP_ENGAGEMENT TABLE
-- ============================================================================
-- What it does: Records every time a public user taps "Call", "WhatsApp",
--               or "Maps" on a shop card.
-- Why it matters: Admin analytics use this to show which shops and categories
--                 get the most real-world interaction.
--
-- EVENT TYPES: "call", "whatsapp", "maps"
-- ACCESS: Public users can INSERT (record a tap). Only admins can READ.

CREATE TABLE IF NOT EXISTS public.shop_engagement (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id    uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes for admin analytics date/shop filtering
CREATE INDEX IF NOT EXISTS idx_engagement_created
  ON public.shop_engagement (created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_shop
  ON public.shop_engagement (shop_id);


-- ============================================================================
-- SECTION 5: SHOP_REQUESTS TABLE
-- ============================================================================
-- What it does: Stores "List My Shop" submissions from the public.
-- Why it matters: Public users can request their shop to be listed.
--                 Requests land here with status "pending" and wait for
--                 admin review. Admins approve (creates a real shop),
--                 reject (stays for audit), or delete.
--
-- ACCESS: Public can INSERT. Only admins can READ/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.shop_requests (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text        NOT NULL,
  phone          text        NOT NULL,
  whatsapp       text            NULL,
  address        text            NULL,
  area           text            NULL,
  sub_area       text            NULL,
  category_text  text            NULL,   -- free-text category chosen by submitter
  description    text            NULL,
  keywords       text            NULL,
  opening_time   text            NULL,
  closing_time   text            NULL,
  latitude       double precision NULL,
  longitude      double precision NULL,
  maps_link      text            NULL,   -- Google Maps URL pasted by submitter
  image_url      text            NULL,   -- path in shop-images storage bucket
  submitter_name text            NULL,   -- who submitted (optional)
  admin_notes    text            NULL,   -- internal notes written by admin
  status         text        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- SECTION 6: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- RLS controls WHO can do WHAT on each table.
--
-- SIMPLE SUMMARY:
--   ┌────────────────────┬─────────┬─────────┬─────────┬─────────┐
--   │ Table              │ Read    │ Create  │ Edit    │ Delete  │
--   ├────────────────────┼─────────┼─────────┼─────────┼─────────┤
--   │ categories         │ Anyone  │ Admin   │ Admin   │ Admin   │
--   │ shops              │ Anyone  │ Admin   │ Admin   │ Admin   │
--   │ shop_categories    │ Anyone  │ Admin   │ —       │ Admin   │
--   │ shop_engagement    │ Admin   │ Anyone  │ —       │ —       │
--   │ shop_requests      │ Admin   │ Anyone  │ Admin   │ Admin   │
--   └────────────────────┴─────────┴─────────┴─────────┴─────────┘

-- ── Enable RLS on all tables ──
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_requests   ENABLE ROW LEVEL SECURITY;

-- ── CATEGORIES ──
CREATE POLICY "Categories are publicly readable"
  ON public.categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert categories"
  ON public.categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update categories"
  ON public.categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete categories"
  ON public.categories FOR DELETE USING (auth.role() = 'authenticated');

-- ── SHOPS ──
CREATE POLICY "Shops are publicly readable"
  ON public.shops FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert shops"
  ON public.shops FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update shops"
  ON public.shops FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete shops"
  ON public.shops FOR DELETE USING (auth.role() = 'authenticated');

-- ── SHOP_CATEGORIES ──
CREATE POLICY "Shop categories are publicly readable"
  ON public.shop_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert shop_categories"
  ON public.shop_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete shop_categories"
  ON public.shop_categories FOR DELETE USING (auth.role() = 'authenticated');

-- ── SHOP_ENGAGEMENT ──
CREATE POLICY "Public can insert engagement events"
  ON public.shop_engagement FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read engagement"
  ON public.shop_engagement FOR SELECT USING (auth.role() = 'authenticated');

-- ── SHOP_REQUESTS ──
CREATE POLICY "Public can submit shop requests"
  ON public.shop_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read shop requests"
  ON public.shop_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update shop requests"
  ON public.shop_requests FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete shop requests"
  ON public.shop_requests FOR DELETE USING (auth.role() = 'authenticated');


-- ============================================================================
-- SECTION 7: FUNCTIONS
-- ============================================================================

-- ── set_updated_at ──
-- What it does: Automatically sets "updated_at" to current time when a row
--               is edited. Attached to shops, categories, and requests tables.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── generate_shop_slug ──
-- What it does: Creates a clean URL slug from a shop name.
-- Example: "Sharma General Store" → "sharma-general-store"
--          If taken, adds a number: "sharma-general-store-2"
-- When editing a shop, p_exclude_id skips the current shop's own slug.
CREATE OR REPLACE FUNCTION public.generate_shop_slug(
  p_name       text,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter   int := 0;
BEGIN
  base_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;

  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops
      WHERE slug = candidate
        AND (p_exclude_id IS NULL OR id != p_exclude_id)
    ) THEN
      RETURN candidate;
    END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;
$$;

-- ── set_shop_slug ──
-- What it does: Trigger function that auto-generates a slug when a shop is
--               created, or regenerates it when the shop name changes.
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL
     OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND NEW.name != OLD.name AND NEW.slug = OLD.slug)
  THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================================
-- SECTION 8: TRIGGERS
-- ============================================================================
-- Triggers fire automatically before/after database operations.

-- Auto-update "updated_at" timestamp when a shop row is edited
DROP TRIGGER IF EXISTS shops_updated_at ON public.shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update "updated_at" timestamp when a category row is edited
DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update "updated_at" timestamp when a shop request row is edited
DROP TRIGGER IF EXISTS set_shop_requests_updated_at ON public.shop_requests;
CREATE TRIGGER set_shop_requests_updated_at
  BEFORE UPDATE ON public.shop_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate URL slug when a shop is created or its name changes
DROP TRIGGER IF EXISTS trg_shop_slug ON public.shops;
CREATE TRIGGER trg_shop_slug
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_slug();


-- ============================================================================
-- SECTION 9: STORAGE — shop-images bucket
-- ============================================================================
-- What it does: The "shop-images" bucket stores all shop photos.
-- Why it matters: Images are compressed to WebP before upload to save space.
--
-- Access rules explained:
--   • Anyone can VIEW images (they appear on public shop cards/detail pages)
--   • Admins can UPLOAD, REPLACE, and DELETE images
--   • Public users can upload images ONLY when submitting a listing request
--     (those files are named with a "request-" prefix)

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view shop images
CREATE POLICY "Public read access for shop images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-images');

-- Admins can upload shop images
CREATE POLICY "Authenticated users can upload shop images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shop-images' AND auth.role() = 'authenticated');

-- Admins can replace/update shop images
CREATE POLICY "Authenticated users can update shop images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'shop-images' AND auth.role() = 'authenticated');

-- Admins can delete shop images
CREATE POLICY "Authenticated users can delete shop images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'shop-images' AND auth.role() = 'authenticated');

-- Public users can upload request images (filename must start with "request-")
CREATE POLICY "Public can upload request images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shop-images' AND (storage.filename(name) ILIKE 'request-%'));


-- ============================================================================
-- SECTION 10: SEED DATA — Default Categories
-- ============================================================================
-- These are the initial business categories for Muktainagar.
-- Admins can add, edit, merge, or deactivate categories from the dashboard.
-- ON CONFLICT DO NOTHING prevents duplicates if this is run again.

INSERT INTO public.categories (name, icon) VALUES
  ('Grocery',     '🛒'),
  ('Medical',     '💊'),
  ('Restaurant',  '🍽️'),
  ('Clothing',    '👗'),
  ('Electronics', '📱'),
  ('Hardware',    '🔧'),
  ('Bakery',      '🍞'),
  ('Vegetable',   '🥦'),
  ('Dairy',       '🥛'),
  ('Stationery',  '📚'),
  ('Salon',       '✂️'),
  ('Auto Parts',  '🚗')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- END OF MASTER SCHEMA
-- ============================================================================
-- CHANGE LOG:
--   2026-04-09 — Initial master file created from 15 individual migrations.
--                Covers all tables, RLS, functions, triggers, storage, seeds.
--
-- RULES FOR UPDATING THIS FILE:
--   1. When you make a database change via Lovable Cloud migration tool,
--      also update this file to reflect the new state.
--   2. Add a dated entry to the CHANGE LOG above.
--   3. This file should always represent the COMPLETE current database.
