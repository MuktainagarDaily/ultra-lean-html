import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertCircle, Clock, X, SlidersHorizontal } from 'lucide-react';
import { ShopCard } from '@/components/ShopCard';
import { isShopOpen } from '@/lib/shopUtils';
import { useInterval } from '@/hooks/useInterval';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type AvailabilityFilter = 'all' | 'open' | 'closed';

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

  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Temp sheet state
  const [sheetAvailability, setSheetAvailability] = useState<AvailabilityFilter>('all');
  const [sheetAreas, setSheetAreas] = useState<string[]>([]);

  // Sync sheet when drawer opens
  useEffect(() => {
    if (filterOpen) {
      setSheetAvailability(availability);
      setSheetAreas(selectedAreas);
    }
  }, [filterOpen]);

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

  useEffect(() => {
    if (category?.name) {
      document.title = `${category.icon ? category.icon + ' ' : ''}${category.name} Shops — Muktainagar Daily`;
      return () => { document.title = 'Muktainagar Daily — Local Business Directory'; };
    }
  }, [category?.name, category?.icon]);

  const { data: shops = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['shops', 'category', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('shops(*, shop_categories(categories(name, icon, is_active)))')
        .eq('category_id', id!);
      if (error) throw error;
      const seen = new Set<string>();
      return data
        .map((r: any) => r.shops)
        .filter((s: any) => {
          if (!s || !s.is_active) return false;
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
    },
    enabled: !!id,
  });

  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    shops.forEach((s: any) => {
      const a = s.area?.trim();
      if (a) seen.add(a);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const applyFilters = useCallback((s: any, avail: AvailabilityFilter, areas: string[]) => {
    if (avail === 'open' && !isShopOpen(s)) return false;
    if (avail === 'closed' && isShopOpen(s)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    return true;
  }, []);

  const filteredShops = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, availability, selectedAreas)),
    [shops, availability, selectedAreas, applyFilters]
  );

  const sheetPreviewCount = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas)).length,
    [shops, sheetAvailability, sheetAreas, applyFilters]
  );

  const openCount = useMemo(() => shops.filter((s: any) => isShopOpen(s)).length, [shops]);

  const activeFilterCount = (availability !== 'all' ? 1 : 0) + selectedAreas.length;

  const handleApply = () => {
    setAvailability(sheetAvailability);
    setSelectedAreas(sheetAreas);
    setFilterOpen(false);
  };

  const handleClearAll = () => {
    setSheetAvailability('all');
    setSheetAreas([]);
  };

  const toggleSheetArea = (area: string) =>
    setSheetAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);

  const removeFilter = (type: 'availability' | 'area', value?: string) => {
    if (type === 'availability') setAvailability('all');
    if (type === 'area' && value) setSelectedAreas((prev) => prev.filter((a) => a !== value));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          {/* Title row */}
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

          {/* Filter bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none scroll-fade-right">
            {/* Filter button */}
            <button
              onClick={() => setFilterOpen(true)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeFilterCount > 0
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Active filter pills */}
            {availability !== 'all' && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-primary-foreground text-primary">
                {availability === 'open' ? '🟢' : '🔴'} {availability === 'open' ? 'Open Now' : 'Closed Now'}
                <button onClick={() => removeFilter('availability')} className="ml-0.5 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedAreas.map((area) => (
              <span key={area} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-primary-foreground text-primary whitespace-nowrap">
                📍 {area}
                <button onClick={() => removeFilter('area', area)} className="ml-0.5 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {activeFilterCount > 1 && (
              <button
                onClick={() => { setAvailability('all'); setSelectedAreas([]); }}
                className="shrink-0 text-xs text-primary-foreground/60 hover:text-primary-foreground underline whitespace-nowrap"
              >
                Clear all
              </button>
            )}
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
          <div className="text-center py-16 px-4">
            {activeFilterCount > 0 ? (
              <>
                <p className="text-4xl mb-3">{availability === 'open' ? '🌙' : '📍'}</p>
                <p className="font-semibold text-foreground">
                  No {category?.name || 'shops'} match your filters
                </p>
                <p className="text-sm text-muted-foreground mt-1">Try removing a filter to see more results</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => { setAvailability('all'); setSelectedAreas([]); }}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Clear filters
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🏪</p>
                <p className="font-semibold text-foreground">
                  No {category?.name || ''} shops listed yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to list one!</p>
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  <button
                    onClick={() => navigate('/shops')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    View all shops
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Browse categories
                  </button>
                </div>
              </>
            )}
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

      {/* Filter Bottom Sheet */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="flex items-center justify-between px-5 pt-4 pb-2">
            <DrawerTitle className="text-base font-bold">Filters</DrawerTitle>
            {(sheetAvailability !== 'all' || sheetAreas.length > 0) && (
              <button onClick={handleClearAll} className="text-sm text-primary font-semibold hover:opacity-70">
                Clear all
              </button>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-6 space-y-6">
            {/* Availability */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Availability</p>
              <div className="flex gap-2">
                {(['all', 'open', 'closed'] as AvailabilityFilter[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSheetAvailability(opt)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      sheetAvailability === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    {opt === 'all' ? 'All' : opt === 'open' ? '🟢 Open' : '🔴 Closed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Area */}
            {areaOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Area / Locality
                    {sheetAreas.length > 0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {sheetAreas.length}
                      </span>
                    )}
                  </p>
                  {sheetAreas.length > 0 && (
                    <button onClick={() => setSheetAreas([])} className="text-xs text-primary font-semibold hover:opacity-70">
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {areaOptions.map((area) => {
                    const active = sheetAreas.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => toggleSheetArea(area)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all text-left ${
                          active
                            ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                            : 'bg-card text-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          active ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        }`}>
                          {active && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
                        </span>
                        <span className="truncate">{area}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Apply CTA */}
          <div className="px-5 pb-8 pt-2 border-t border-border">
            <button
              onClick={handleApply}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-[0.98] transition-all"
            >
              Show {sheetPreviewCount} {sheetPreviewCount === 1 ? 'Shop' : 'Shops'}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
