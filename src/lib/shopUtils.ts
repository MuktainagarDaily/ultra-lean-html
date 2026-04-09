/**
 * Shared utilities for shop display logic
 */

/**
 * Normalize a phone string for duplicate detection and wa.me links.
 * Strips spaces, dashes, parens, dots, +; strips leading 91 country code (12-digit → 10-digit).
 */
export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}

/**
 * Convert a shop name to a URL-safe slug (same logic as the DB trigger).
 * e.g. "Sharma's General Store!" → "sharmas-general-store"
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[ -]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'shop';
}

/** Format HH:MM (24h) → 12-hour AM/PM */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Dynamically determine if shop is open right now.
 * Falls back to the manual `is_open` flag when no times are set.
 */
export function isShopOpen(shop: {
  is_open: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
}): boolean {
  const { opening_time, closing_time, is_open } = shop;
  if (!opening_time || !closing_time) return is_open;

  const now = new Date();
  const [oh, om] = opening_time.split(':').map(Number);
  const [ch, cm] = closing_time.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  // Handle overnight shops (e.g. 10 PM – 2 AM)
  if (closeMins < openMins) {
    return nowMins >= openMins || nowMins < closeMins;
  }
  return nowMins >= openMins && nowMins < closeMins;
}
