import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, Clock, Search, MapPin, X } from 'lucide-react';

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function Shops() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSearch = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(initialSearch);

  // Debounce search query for API calls
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops', 'all', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('shops')
        .select('*, categories(name, icon)')
        .eq('is_active', true)
        .order('name');

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,area.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const title = debouncedSearch ? `Results for "${debouncedSearch}"` : 'All Shops';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-1 shrink-0">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="font-bold text-lg leading-tight">{title}</h1>
              <p className="text-primary-foreground/70 text-xs">{shops.length} shops found</p>
            </div>
          </div>
          {/* Inline search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by name or area..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-foreground bg-card text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-foreground">No shops found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold"
            >
              Go Home
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} onClick={() => navigate(`/shop/${shop.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ShopCard({ shop, onClick }: { shop: any; onClick: () => void }) {
  const isOpen = shop.is_open;
  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(shop.address + ' ' + (shop.area || '') + ' Muktainagar')}`
    : null;

  return (
    <div
      className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{shop.categories?.icon || '🏪'}</span>
            <h3 className="font-bold text-foreground text-base truncate">{shop.name}</h3>
          </div>
          {shop.area && (
            <p className="text-sm text-muted-foreground truncate">📍 {shop.area}</p>
          )}
          {shop.categories?.name && (
            <p className="text-xs text-muted-foreground mt-0.5">{shop.categories.name}</p>
          )}
          {(shop.opening_time || shop.closing_time) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {shop.opening_time && formatTime(shop.opening_time)} – {shop.closing_time && formatTime(shop.closing_time)}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-full text-xs font-bold ${
            isOpen
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
        )}
        {shop.whatsapp && (
          <a
            href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#22c55e] active:scale-95 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
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
