import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, X, Clock, RefreshCw, AlertCircle, MapPin } from 'lucide-react';
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

export default function Shops() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const initialSearch = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Auto-refresh open/closed status every 60 seconds
  useInterval(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['shops'] });
    setLastRefreshed(new Date());
  }, [qc]), 60_000);

  const { data: shops = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['shops', 'all', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('shops')
        .select('*, shop_categories(categories(name, icon))')
        .eq('is_active', true)
        .order('name');

      if (debouncedSearch) {
        const isNumeric = /^\d+$/.test(debouncedSearch.trim()) && debouncedSearch.trim().length >= 3;
        if (isNumeric) {
          query = query.or(`phone.ilike.%${debouncedSearch.trim()}%,whatsapp.ilike.%${debouncedSearch.trim()}%`);
        } else {
          query = query.or(`name.ilike.%${debouncedSearch}%,area.ilike.%${debouncedSearch}%,address.ilike.%${debouncedSearch}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Derive sorted, unique, non-empty area list from fetched shops
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

  const openCount = useMemo(() => shops.filter((s) => isShopOpen(s)).length, [shops]);

  const title = debouncedSearch ? `"${debouncedSearch}"` : 'All Shops';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-1 shrink-0 hover:bg-primary-foreground/10 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
              <p className="text-primary-foreground/70 text-xs">
                {isLoading ? 'Loading...' : `${filteredShops.length} shops${openNowOnly ? ' open now' : ''} • ${openCount} open now`}
              </p>
            </div>
            <button
              onClick={() => { refetch(); setLastRefreshed(new Date()); }}
              className="p-1.5 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
              title={`Last updated ${lastRefreshed.toLocaleTimeString()}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by name, area, address..."
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

            {/* Area chips — only render when areas available */}
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
            <p className="text-sm text-muted-foreground">Check your connection and try again</p>
            <button
              onClick={() => refetch()}
              className="mt-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <ShopSkeleton key={i} />)}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{openNowOnly ? '🌙' : selectedArea ? '📍' : '🔍'}</p>
            <p className="font-semibold text-foreground">
              {openNowOnly ? 'No shops open right now' : selectedArea ? `No shops in ${selectedArea}` : 'No shops found'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {openNowOnly ? 'Try removing the Open Now filter' : selectedArea ? 'Try a different area or clear the filter' : 'Try a different search term'}
            </p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {openNowOnly && (
                <button
                  onClick={() => setOpenNowOnly(false)}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  Show all shops
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
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  Clear search
                </button>
              )}
              {!openNowOnly && !localSearch && !selectedArea && (
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
              {filteredShops.map((shop) => (
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
