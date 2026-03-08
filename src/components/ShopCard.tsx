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
  shop_categories?: { categories: { name: string; icon: string } | null }[];
  categories?: { name: string; icon: string } | null;
}

export function ShopCard({ shop }: { shop: Shop }) {
  const navigate = useNavigate();
  const open = isShopOpen(shop);
  const [imgError, setImgError] = useState(false);

  const allCats: { name: string; icon: string }[] = [];
  if (shop.shop_categories?.length) {
    shop.shop_categories.forEach((sc) => {
      if (sc.categories) allCats.push(sc.categories);
    });
  } else if (shop.categories) {
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

  // Normalize WhatsApp number for wa.me (digits only, with 91 country code)
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
      {/* Shop image — graceful fallback on error */}
      {shop.image_url && !imgError && (
        <div className="h-32 overflow-hidden">
          <img
            src={shop.image_url}
            alt={shop.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              {allCats.slice(0, 1).map((c, i) => (
                <span key={i} className="text-base leading-none">{c.icon}</span>
              ))}
              <h3 className="font-bold text-foreground text-base truncate">{shop.name}</h3>
              {(shop as any).is_verified && (
                <span
                  className="shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                  title="Verified by Muktainagar Daily"
                >
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>

            {shop.area && (
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" /> {shop.area}
              </p>
            )}

            {/* Category chips */}
            {allCats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {allCats.map((c, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                  >
                    {c.icon} {c.name}
                  </span>
                ))}
              </div>
            )}

            {(shop.opening_time || shop.closing_time) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                {formatTime(shop.opening_time)} – {formatTime(shop.closing_time)}
              </p>
            )}
          </div>

          {/* Open/closed badge */}
          <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border ${
            open
              ? 'border-success/30 text-success'
              : 'border-destructive/20 text-destructive'
          }`}
            style={{
              background: open ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
            }}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${open ? 'animate-pulse-open' : ''}`}
              style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
            />
            {open ? 'OPEN' : 'CLOSED'}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-all"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Phone className="w-4 h-4" /> Call
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-white py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-all"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-white px-3 py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-all"
              style={{ background: 'hsl(211 100% 50%)' }}
            >
              <MapPin className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
