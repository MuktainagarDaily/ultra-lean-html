import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, MapPin, Clock, Tag, Navigation, Share2, ShieldCheck } from 'lucide-react';
import { formatTime, isShopOpen } from '@/lib/shopUtils';
import { toast } from 'sonner';

/** Fire-and-forget engagement log — never blocks the UI */
async function logEngagement(shopId: string, eventType: 'call' | 'whatsapp') {
  try {
    await supabase.from('shop_engagement').insert({ shop_id: shopId, event_type: eventType });
  } catch {
    // non-blocking — silently ignore errors
  }
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [showVerifiedInfo, setShowVerifiedInfo] = useState(false);

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(name, icon, is_active))')
        .eq('id', id!)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (shop?.name) {
      document.title = `${shop.name} — Muktainagar Daily`;
      return () => { document.title = 'Muktainagar Daily — Local Business Directory'; };
    }
  }, [shop?.name]);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: shop?.name ?? 'Shop on Muktainagar Daily',
      text: `Check out ${shop?.name} on Muktainagar Daily`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      } catch {
        toast.error('Could not copy link');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 skeleton-shimmer" />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="rounded-xl skeleton-shimmer h-40 border border-border" />
          <div className="rounded-xl skeleton-shimmer h-28 border border-border" />
          <div className="rounded-xl skeleton-shimmer h-40 border border-border" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-4xl">😕</p>
        <p className="font-semibold text-foreground">Shop not found</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold"
        >
          Go Home
        </button>
      </div>
    );
  }

  const open = isShopOpen(shop);

  const allCats: { name: string; icon: string }[] = (shop as any).shop_categories
    ?.map((sc: any) => sc.categories)
    .filter((c: any) => c && c.is_active !== false) || [];

  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        shop.address + ' ' + (shop.area || '') + ' Muktainagar'
      )}`
    : null;

  // Normalize WhatsApp number for wa.me (digits only, with 91 country code)
  // Handles: 10-digit → add 91 prefix; 12-digit with 91 already → leave as-is; anything else → use as-is
  const waNumber = shop.whatsapp
    ? (() => {
        let n = shop.whatsapp.replace(/\D/g, '');
        if (n.length === 10) n = '91' + n;
        else if (n.startsWith('91') && n.length === 12) { /* already correct */ }
        return n;
      })()
    : null;

  const isVerified = (shop as any).is_verified;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg leading-tight truncate flex-1">{shop.name}</h1>
          <button
            onClick={handleShare}
            className="p-1.5 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
            title="Share this shop"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-28">
        {/* Shop Image — graceful fallback on broken URL */}
        {shop.image_url && !imgError && (
          <div className="rounded-xl overflow-hidden border border-border shadow-sm">
            <img
              src={shop.image_url}
              alt={shop.name}
              className="w-full h-40 sm:h-52 object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Name + Status */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{shop.name}</h2>
                {isVerified && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setShowVerifiedInfo(v => !v)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold w-fit"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </button>
                    {showVerifiedInfo && (
                      <p className="text-xs text-muted-foreground px-1 leading-snug">
                        ✓ This shop is trusted and verified by Muktainagar Daily.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {allCats.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allCats.map((c, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <span>{c.icon}</span> {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${
              open
                ? 'border-success/30 text-success'
                : 'border-destructive/20 text-destructive'
            }`}
              style={{
                background: open ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
              }}>
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
                style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
              />
              {open ? 'OPEN' : 'CLOSED'}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {/* Merge address + area into one row when both exist */}
          {shop.address && shop.area ? (
            <DetailRow
              icon={<MapPin className="w-5 h-5 text-primary" />}
              label="Location"
              value={`${shop.address}, ${shop.area}`}
            />
          ) : shop.address ? (
            <DetailRow icon={<MapPin className="w-5 h-5 text-primary" />} label="Address" value={shop.address} />
          ) : shop.area ? (
            <DetailRow icon={<MapPin className="w-5 h-5 text-primary" />} label="Area" value={shop.area} />
          ) : null}
          {(shop.opening_time || shop.closing_time) && (
            <DetailRow
              icon={<Clock className="w-5 h-5 text-primary" />}
              label="Hours"
              value={`${formatTime(shop.opening_time) || '--'} – ${formatTime(shop.closing_time) || '--'}`}
            />
          )}
          {allCats.length > 0 && (
            <DetailRow
              icon={<Tag className="w-5 h-5 text-primary" />}
              label="Categories"
              value={allCats.map((c) => `${c.icon} ${c.name}`).join('  •  ')}
            />
          )}
          {/* Coordinates row removed — Maps button below handles navigation */}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={() => logEngagement(shop.id, 'call')}
              className="flex items-center justify-center gap-2 sm:gap-3 w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base active:scale-95 transition-all shadow-sm min-h-[52px]"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="truncate">Call {shop.phone}</span>
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logEngagement(shop.id, 'whatsapp')}
              className="flex items-center justify-center gap-2 sm:gap-3 w-full text-white py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base active:scale-95 transition-all shadow-sm min-h-[52px]"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              Chat on WhatsApp
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 sm:gap-3 w-full text-white py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base active:scale-95 transition-all shadow-sm min-h-[52px]"
              style={{ background: 'hsl(211 100% 45%)' }}
            >
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              Open in Google Maps
            </a>
          )}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 sm:gap-3 w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base active:scale-95 transition-all min-h-[52px]"
            style={{ background: 'hsl(var(--secondary) / 0.12)', border: '1px solid hsl(var(--secondary) / 0.3)', color: 'hsl(var(--foreground))' }}
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            Share this shop
          </button>
        </div>
      </main>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-foreground font-medium mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
