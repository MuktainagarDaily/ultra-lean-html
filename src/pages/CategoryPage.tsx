import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertCircle, Clock, MapPin, X } from 'lucide-react';
import { ShopCard } from '@/components/ShopCard';
import { isShopOpen } from '@/lib/shopUtils';
import { useInterval } from '@/hooks/useInterval';

function ShopSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 skeleton-shimmer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 rounded-md skeleton-shimmer w-2/3" />
          <div className="h-3 rounded-md skeleton-shimmer w-1/2" />
          <div className="h-3 rounded-md skeleton-shimmer w-1/3" />
        </div>
        <div className="h-7 w-16 rounded-full skeleton-shimmer shrink-0" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 h-10 rounded-lg skeleton-shimmer" />
        <div className="flex-1 h-10 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');

  // Auto-refresh open/closed every 60 seconds
  useInterval(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['shops', 'category', id] });
  }, [qc, id]), 60_000);

  const { data: category } = useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shops = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['shops', 'category', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('shops(*, shop_categories(categories(name, icon)))')
        .eq('category_id', id!);
      if (error) throw error;
      return data
        .map((r: any) => r.shops)
        .filter((s: any) => s && s.is_active);
    },
    enabled: !!id,
  });

  // Derive sorted unique areas from fetched shops
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    shops.forEach((s: any) => {
      const a = s.area?.trim();
      if (a) seen.add(a);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const filteredShops = useMemo(() => {
    let result = shops as any[];
    if (openNowOnly) result = result.filter((s) => isShopOpen(s));
    if (selectedArea) result = result.filter((s) => s.area?.trim() === selectedArea);
    return result;
  }, [shops, openNowOnly, selectedArea]);

  const openCount = useMemo(() => shops.filter((s: any) => isShopOpen(s)).length, [shops]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg leading-tight truncate">
                {category?.icon} {category?.name || 'Category'}
              </h1>
              <p className="text-primary-foreground/70 text-xs">
                {isLoading ? 'Loading...' : `${filteredShops.length} shops • ${openCount} open now`}
              </p>
            </div>
          </div>

          {/* Filter chips row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {/* Open Now chip */}
            <button
              onClick={() => setOpenNowOnly((v) => !v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                openNowOnly
                  ? 'bg-success text-success-foreground'
                  : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${openNowOnly ? 'bg-success-foreground animate-pulse-open' : 'bg-primary-foreground/60'}`} />
              Open Now {openNowOnly ? `(${filteredShops.length})` : `(${openCount})`}
            </button>

            {/* Area chips */}
            {areaOptions.map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea((v) => (v === area ? '' : area))}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedArea === area
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {area}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-28">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-10 h-10 text-destructive/60" />
            <p className="font-semibold text-foreground">Failed to load shops</p>
            <button
              onClick={() => refetch()}
              className="mt-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <ShopSkeleton key={i} />)}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{openNowOnly ? '🌙' : selectedArea ? '📍' : '🏪'}</p>
            <p className="font-semibold text-foreground">
              {openNowOnly ? 'No shops open right now' : selectedArea ? `No shops in ${selectedArea}` : 'No shops in this category yet'}
            </p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {openNowOnly && (
                <button
                  onClick={() => setOpenNowOnly(false)}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  Show all
                </button>
              )}
              {selectedArea && (
                <button
                  onClick={() => setSelectedArea('')}
                  className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  Clear area filter
                </button>
              )}
              {!openNowOnly && !selectedArea && (
                <button
                  onClick={() => navigate('/')}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold"
                >
                  Go Home
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredShops.map((shop: any) => (
                <ShopCard key={shop.id} shop={shop as any} />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Open/closed status auto-refreshes every minute
            </p>
          </>
        )}
      </main>
    </div>
  );
}
