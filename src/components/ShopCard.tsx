import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
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

  return (
    <div
      className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
      onClick={() => navigate(`/shop/${shop.id}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {allCats.slice(0, 1).map((c, i) => (
              <span key={i} className="text-lg leading-none">{c.icon}</span>
            ))}
            <h3 className="font-bold text-foreground text-base truncate">{shop.name}</h3>
          </div>
          {shop.area && (
            <p className="text-sm text-muted-foreground truncate">📍 {shop.area}</p>
          )}
          {/* Category chips */}
          {allCats.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {allCats.map((c, i) => (
                <span
                  key={i}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
          {(shop.opening_time || shop.closing_time) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 shrink-0" />
              {formatTime(shop.opening_time)} – {formatTime(shop.closing_time)}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-full text-xs font-bold ${
            open
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {open ? '● OPEN' : '● CLOSED'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
        {shop.whatsapp && (
          <a
            href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#22c55e] active:scale-95 transition-all"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-blue-500 text-white px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-600 active:scale-95 transition-all"
          >
            <MapPin className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
