import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MessageCircle, ArrowLeft, Clock } from 'lucide-react';

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: category } = useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops', 'category', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, categories(name, icon)')
        .eq('category_id', id!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight">
              {category?.icon} {category?.name || 'Category'}
            </h1>
            <p className="text-primary-foreground/70 text-xs">{shops.length} shops</p>
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
            <p className="text-4xl mb-3">🏪</p>
            <p className="font-semibold text-foreground">No shops in this category yet</p>
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

  return (
    <div
      className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-base truncate">{shop.name}</h3>
          {shop.area && (
            <p className="text-sm text-muted-foreground truncate">📍 {shop.area}</p>
          )}
          {(shop.opening_time || shop.closing_time) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {shop.opening_time && shop.opening_time.slice(0, 5)} – {shop.closing_time && shop.closing_time.slice(0, 5)}
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
      </div>
    </div>
  );
}
