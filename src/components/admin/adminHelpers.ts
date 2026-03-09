/**
 * Shared admin-only helpers — extracted from AdminDashboard monolith (RISK-01 fix).
 * Public-facing utilities (normalizePhone, compressImage, parseGoogleMapsLink) remain
 * in their respective shared lib files.
 */

/** Extract the storage file path from a Supabase public URL.
 *  Returns null if the URL is not a recognized shop-images bucket URL. */
export function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = '/object/public/shop-images/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
  } catch {
    return null;
  }
}

/** Normalize a WhatsApp number for a wa.me link (digits-only, with 91 prefix) */
export function normalizeWhatsApp(wa: string): string {
  let n = wa.replace(/\D/g, '');
  if (n.length === 10) n = '91' + n;
  if (n.startsWith('91') && n.length === 12) return n;
  return n;
}

/** Check if a phone number has at least 10 digits */
export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

export const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm';
