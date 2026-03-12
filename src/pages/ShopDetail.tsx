import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, MapPin, Clock, Tag, Share2, ShieldCheck, Navigation } from 'lucide-react';
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
  const waNumber = shop.whatsapp
    ? (() => {
        let n = shop.whatsapp.replace(/\D/g, '');
        if (n.length === 10) n = '91' + n;
        else if (n.startsWith('91') && n.length === 12) { /* already correct */ }
        return n;
      })()
    : null;

  const isVerified = (shop as any).is_verified;

  // Count visible action buttons to determine grid columns
  const actionCount = [shop.phone, waNumber, mapsUrl, true /* share always shown */].filter(Boolean).length;
  const gridCols = actionCount === 4 ? 'grid-cols-4' : actionCount === 3 ? 'grid-cols-3' : actionCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

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

      {/* Extra bottom padding to clear the sticky action bar */}
      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-32">
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

                {/* Verified badge — CSS tooltip on hover/focus */}
                {isVerified && (
                  <div className="relative group">
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold cursor-default select-none"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                    {/* Tooltip */}
                    <div
                      className="absolute left-0 top-full mt-1.5 z-20 w-max max-w-[200px] rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md pointer-events-none
                                 invisible opacity-0 translate-y-1
                                 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0
                                 transition-all duration-150"
                      style={{
                        background: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                      }}
                    >
                      ✓ Verified by Muktainagar Daily
                      {/* Arrow */}
                      <span
                        className="absolute -top-1 left-3 w-2 h-2 rotate-45"
                        style={{ background: 'hsl(var(--primary))' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Clickable category chips */}
              {allCats.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allCats.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => navigate(`/shops?category=${encodeURIComponent(c.name)}`)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all hover:opacity-80 active:scale-95"
                      style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                    >
                      <span>{c.icon}</span> {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Open / Closed indicator */}
            <div
              className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-full text-sm font-bold border min-w-[80px] text-center ${
                open
                  ? 'border-success/30 text-success'
                  : 'border-destructive/20 text-destructive'
              }`}
              style={{
                background: open ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
                  style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
                />
                <span>{open ? 'OPEN' : 'CLOSED'}</span>
              </div>
              {/* Show "Open at HH:MM" when closed and opening time is available */}
              {!open && shop.opening_time && (
                <span className="text-[10px] font-medium mt-0.5 opacity-80 whitespace-nowrap">
                  Open at {formatTime(shop.opening_time)}
                </span>
              )}
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
        </div>
      </main>

      {/* ── Sticky Bottom Action Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border shadow-2xl"
        style={{ background: 'hsl(var(--card))' }}
      >
        {/* iOS safe-area bottom */}
        <div className={`max-w-lg mx-auto px-3 py-2.5 grid gap-2 ${gridCols}`}>
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={() => logEngagement(shop.id, 'call')}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
            >
              <Phone className="w-5 h-5" />
              <span>Call</span>
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logEngagement(shop.id, 'whatsapp')}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(142 70% 45% / 0.12)', color: 'hsl(142 70% 35%)' }}
            >
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp</span>
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
              style={{ background: 'hsl(211 100% 45% / 0.1)', color: 'hsl(211 100% 40%)' }}
            >
              <Navigation className="w-5 h-5" />
              <span>Maps</span>
            </a>
          )}
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] active:scale-95 transition-all"
            style={{
              background: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            <Share2 className="w-5 h-5" />
            <span>Share</span>
          </button>
        </div>
        {/* iOS safe-area spacer */}
        <div className="pb-safe" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
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
