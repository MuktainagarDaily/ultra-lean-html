import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, MapPin, Clock, Tag, Navigation } from 'lucide-react';

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, categories(name, icon)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary h-16 animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="bg-card rounded-xl p-4 border border-border animate-pulse">
            <div className="h-6 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
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

  const isOpen = shop.is_open;
  const hasCoords = shop.latitude && shop.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(shop.address + ' ' + (shop.area || '') + ' Muktainagar')}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg leading-tight truncate">{shop.name}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Shop Image */}
        {shop.image_url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img
              src={shop.image_url}
              alt={shop.name}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Name + Status */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{shop.name}</h2>
              {shop.categories && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-lg">{shop.categories.icon}</span>
                  <span className="text-sm text-muted-foreground">{shop.categories.name}</span>
                </div>
              )}
            </div>
            <span
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
                isOpen
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {isOpen ? '● OPEN' : '● CLOSED'}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {shop.address && (
            <DetailRow icon={<MapPin className="w-5 h-5 text-primary" />} label="Address" value={shop.address} />
          )}
          {shop.area && (
            <DetailRow icon={<MapPin className="w-5 h-5 text-primary" />} label="Area" value={shop.area} />
          )}
          {(shop.opening_time || shop.closing_time) && (
            <DetailRow
              icon={<Clock className="w-5 h-5 text-primary" />}
              label="Hours"
              value={`${shop.opening_time ? formatTime(shop.opening_time) : '--'} to ${shop.closing_time ? formatTime(shop.closing_time) : '--'}`}
            />
          )}
          {shop.categories && (
            <DetailRow icon={<Tag className="w-5 h-5 text-primary" />} label="Category" value={shop.categories.name} />
          )}
          {hasCoords && (
            <DetailRow
              icon={<Navigation className="w-5 h-5 text-primary" />}
              label="Coordinates"
              value={`${Number(shop.latitude).toFixed(5)}, ${Number(shop.longitude).toFixed(5)}`}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              className="flex items-center justify-center gap-3 w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-base hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Phone className="w-5 h-5" />
              Call {shop.phone}
            </a>
          )}
          {shop.whatsapp && (
            <a
              href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white py-4 rounded-xl font-bold text-base hover:bg-[#22c55e] active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              Chat on WhatsApp
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-blue-500 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-600 active:scale-95 transition-all"
            >
              <MapPin className="w-5 h-5" />
              Open in Google Maps
            </a>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-foreground font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}
