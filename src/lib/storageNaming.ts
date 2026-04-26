/**
 * Slug-based naming for files in the `shop-images` storage bucket.
 *
 * Goal: make every uploaded image's filename derive from the shop's name,
 * so the bucket is browseable and easy to match back to a shop.
 *
 * Format:  `{slug}.webp` or `{slug}-{n}.webp` when the base name is taken.
 * Requests use prefix `request-{slug}` until the admin approves them, then
 * the file is renamed to the final shop slug via `renameShopImage`.
 */
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/components/admin/adminHelpers';

const BUCKET = 'shop-images';
const MAX_SLUG_LEN = 60;

/** Convert a shop name into a safe storage slug. */
export function slugifyShopName(name: string | null | undefined): string {
  if (!name) return 'shop';
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // strip accents
    .replace(/[\u0900-\u097F]+/g, '')      // strip Devanagari
    .replace(/[^a-z0-9\s-]/g, '')          // keep alnum + space + hyphen
    .replace(/[\s-]+/g, '-')               // collapse to single hyphen
    .replace(/^-+|-+$/g, '')               // trim hyphens
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, '');
  return slug || 'shop';
}

/**
 * List existing files in the bucket with the given slug prefix and pick the
 * first available `slug.webp` / `slug-1.webp` / `slug-2.webp` etc.
 */
export async function findAvailableImagePath(baseSlug: string): Promise<string> {
  const safe = baseSlug || 'shop';
  // Supabase storage `list` filters by `search` (substring on filename in the given folder).
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000, search: safe });

  // If listing fails for any reason, fall back to a timestamp suffix to
  // guarantee uniqueness rather than risk overwriting a sibling file.
  if (error) {
    return `${safe}-${Date.now()}.webp`;
  }
  const taken = new Set((data || []).map((f) => f.name));
  if (!taken.has(`${safe}.webp`)) return `${safe}.webp`;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${safe}-${i}.webp`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${safe}-${Date.now()}.webp`;
}

interface UploadOpts {
  /** Optional prefix prepended to the slug, e.g. 'request' for pre-approval uploads. */
  prefix?: string;
}

/**
 * Upload a (compressed) image blob using a slug-based filename.
 * Does NOT upsert — collisions are resolved by suffixing.
 */
export async function uploadShopImage(
  blob: Blob,
  shopName: string,
  opts: UploadOpts = {}
): Promise<{ path: string; publicUrl: string }> {
  const slug = slugifyShopName(shopName);
  const baseSlug = opts.prefix ? `${opts.prefix}-${slug}` : slug;
  const path = await findAvailableImagePath(baseSlug);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Rename an existing image to follow a new shop name.
 * Returns the new path + public URL, or the original info if no rename was needed.
 */
export async function renameShopImage(
  currentImageUrl: string,
  newShopName: string
): Promise<{ path: string; publicUrl: string } | null> {
  const oldPath = extractStoragePath(currentImageUrl);
  if (!oldPath) return null;
  const desiredSlug = slugifyShopName(newShopName);
  // If the current filename already starts with the desired slug, do nothing.
  // This covers `slug.webp` and `slug-1.webp` style names.
  const filename = oldPath.split('/').pop() || oldPath;
  if (
    filename === `${desiredSlug}.webp` ||
    new RegExp(`^${desiredSlug}-\\d+\\.webp$`).test(filename)
  ) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(oldPath);
    return { path: oldPath, publicUrl: data.publicUrl };
  }
  const newPath = await findAvailableImagePath(desiredSlug);
  const { error } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
  return { path: newPath, publicUrl: data.publicUrl };
}
