import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { formatTime, isShopOpen } from '@/lib/shopUtils';

interface Shop {
  id: string;
  name: string;
  area?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  is_open: boolean;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  image_url?: string | null;
  // BUG-07: include is_active on category so the runtime cast has type backing
  shop_categories?: { categories: { name: string; icon: string; is_active?: boolean } | null }[];
  categories?: { name: string; icon: string; is_active?: boolean } | null;
}

export function ShopCard({ shop }: { shop: Shop }) {
  const navigate = useNavigate();
  const open = isShopOpen(shop);
  const [imgError, setImgError] = useState(false);

  const allCats: { name: string; icon: string }[] = [];
  if (shop.shop_categories?.length) {
    shop.shop_categories.forEach((sc) => {
      if (sc.categories && (sc.categories as any).is_active !== false) allCats.push(sc.categories);
    });
  } else if (shop.categories && (shop.categories as any).is_active !== false) {
    allCats.push(shop.categories);
  }

  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        shop.address + ' ' + (shop.area || '') + ' Muktainagar'
      )}`
    : null;

  const waNumber = shop.whatsapp
    ? (() => {
        let n = shop.whatsapp.replace(/\D/g, '');
        if (n.length === 10) n = '91' + n;
        return n;
      })()
    : null;

  return (
    <div
      className="bg-card rounded-xl border border-border hover:shadow-md transition-all cursor-pointer active:scale-[0.99] overflow-hidden"
      onClick={() => navigate(`/shop/${shop.id}`)}
    >
      {/* Shop image */}
      {shop.image_url && !imgError && (
        <div className="h-32 sm:h-36 overflow-hidden">
          <img
            src={shop.image_url}
            alt={shop.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-3 sm:p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Name row — icon + name on same line; verified badge on new chip row below */}
            <div className="flex items-center gap-1 mb-0.5">
              {allCats.slice(0, 1).map((c, i) => (
                <span key={i} className="text-base leading-none shrink-0">{c.icon}</span>
              ))}
              <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug truncate min-w-0">{shop.name}</h3>
            </div>

            {/* Verified badge on its own line so it never orphans */}
            {(shop as any).is_verified && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none mb-0.5"
                style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                title="Verified by Muktainagar Daily"
              >
                <ShieldCheck className="w-2.5 h-2.5" /> Verified
              </span>
            )}

            {shop.area && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" /> {shop.area}
              </p>
            )}

            {/* Category chips — text-[11px] for accessibility */}
            {allCats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {allCats.slice(0, 2).map((c, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                  >
                    {c.icon} {c.name}
                  </span>
                ))}
                {allCats.length > 2 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                    +{allCats.length - 2}
                  </span>
                )}
              </div>
            )}

            {(shop.opening_time || shop.closing_time) && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 shrink-0" />
                {formatTime(shop.opening_time)} – {formatTime(shop.closing_time)}
              </p>
            )}
          </div>

          {/* Open/closed badge */}
          <div
            className={`shrink-0 flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border ${
              open ? 'border-success/30 text-success' : 'border-destructive/20 text-destructive'
            }`}
            style={{
              background: open ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
              style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
            />
            {open ? 'OPEN' : 'CLOSED'}
          </div>
        </div>

        {/* Action buttons — min-h ensures 44px touch target */}
        <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold active:scale-95 transition-all"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Call
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-white min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold active:scale-95 transition-all"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> WhatsApp
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-white min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold active:scale-95 transition-all"
              style={{ background: 'hsl(211 100% 45%)' }}
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
