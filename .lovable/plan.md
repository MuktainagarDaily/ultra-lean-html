

## Plan: Consolidate migrations into a single master SQL file

### Audit findings — No issues found
- All 5 tables (`categories`, `shops`, `shop_categories`, `shop_engagement`, `shop_requests`) match code expectations
- All RLS policies are correctly permissive and properly scoped
- All triggers (`shops_updated_at`, `categories_updated_at`, `set_shop_requests_updated_at`, `trg_shop_slug`) are active
- All functions (`set_updated_at`, `generate_shop_slug`, `set_shop_slug`) are present
- Storage bucket `shop-images` with correct policies
- No column mismatches, no missing indexes, no broken foreign keys
- **No database changes or code wiring fixes needed**

### What will be done
Replace all 15 individual migration SQL files with a single `00000000000000_master_schema.sql` file that:
1. Creates the complete database from scratch (tables, columns, constraints, indexes)
2. Sets up all RLS policies
3. Creates all functions and triggers
4. Creates the storage bucket and its policies
5. Seeds default categories
6. Is thoroughly commented so both technical and non-technical readers can understand each section

### File structure
- **Delete**: All 15 existing migration files in `supabase/migrations/`
- **Create**: `supabase/migrations/00000000000000_master_schema.sql`

### Master file sections (with comments)
1. **Categories table** — the directory of business types
2. **Shops table** — all listed businesses with their details
3. **Shop Categories junction table** — links shops to multiple categories
4. **Shop Engagement table** — tracks call/WhatsApp taps for analytics
5. **Shop Requests table** — public listing submissions awaiting admin review
6. **RLS policies** — who can read, write, update, delete each table
7. **Functions** — `set_updated_at`, `generate_shop_slug`, `set_shop_slug`
8. **Triggers** — auto-update timestamps and auto-generate slugs
9. **Indexes** — performance indexes on engagement table
10. **Storage** — `shop-images` bucket and access policies
11. **Seed data** — default category entries

### Technical notes
- The master file uses `IF NOT EXISTS` / `CREATE OR REPLACE` where possible for safety
- Column types match the live database exactly (e.g., `opening_time` is `TEXT`, not `TIME`)
- Foreign keys include `ON DELETE CASCADE` for junction tables and `ON DELETE SET NULL` for legacy `category_id`
- The `slug` column has a unique constraint
- Comments are written in plain English explaining the "why" not just the "what"
- This file will be kept updated whenever future database changes are made

