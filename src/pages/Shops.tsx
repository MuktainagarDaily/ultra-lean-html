import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, X, Clock, RefreshCw, AlertCircle, SlidersHorizontal } from 'lucide-react';
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
const PAGE_SIZE = 10;

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
        <div className="flex-1 h-11 rounded-lg skeleton-shimmer" />
        <div className="flex-1 h-11 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function Shops() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const initialSearch = searchParams.get('search') || '';
  const filterParam = searchParams.get('filter');
  const categoryParam = searchParams.get('category') || '';
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [availability, setAvailability] = useState<AvailabilityFilter>(filterParam === 'open' ? 'open' : 'all');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categoryParam ? [categoryParam] : []
  );
  const [verifiedOnly, setVerifiedOnly] = useState(filterParam === 'verified');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Temporary state inside the sheet (applied on "Show Results")
  const [sheetAvailability, setSheetAvailability] = useState<AvailabilityFilter>('all');
  const [sheetAreas, setSheetAreas] = useState<string[]>([]);
  const [sheetCategories, setSheetCategories] = useState<string[]>([]);
  const [sheetVerifiedOnly, setSheetVerifiedOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Reset page whenever filters or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, availability, selectedAreas, selectedCategories, verifiedOnly]);

  useEffect(() => {
    if (debouncedSearch) {
      document.title = `"${debouncedSearch}" — Muktainagar Daily`;
    } else {
      document.title = 'All Shops — Muktainagar Daily';
    }
    return () => { document.title = 'Muktainagar Daily — Local Business Directory'; };
  }, [debouncedSearch]);

  // Sync sheet state when drawer opens
  useEffect(() => {
    if (filterOpen) {
      setSheetAvailability(availability);
      setSheetAreas(selectedAreas);
      setSheetCategories(selectedCategories);
      setSheetVerifiedOnly(verifiedOnly);
    }
  }, [filterOpen]);

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
        .select('*, shop_categories(categories(name, icon, is_active))')
        .eq('is_active', true)
        .order('name');

      if (debouncedSearch) {
        // Normalize: trim, collapse multiple spaces
        const normalized = debouncedSearch.trim().replace(/\s+/g, ' ');
        const isNumeric = /^\d+$/.test(normalized) && normalized.length >= 3;
        if (isNumeric) {
          query = query.or(`phone.ilike.%${normalized}%,whatsapp.ilike.%${normalized}%`);
        } else {
          query = query.or(`name.ilike.%${normalized}%,area.ilike.%${normalized}%,address.ilike.%${normalized}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Derive sorted unique areas
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    shops.forEach((s: any) => {
      const a = s.area?.trim();
      if (a) seen.add(a);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  // Derive category options from shop data
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { name: string; icon: string }>();
    shops.forEach((s: any) => {
      s.shop_categories?.forEach((sc: any) => {
        const cat = sc.categories;
        if (cat?.name && cat.is_active !== false && !seen.has(cat.name)) {
          seen.set(cat.name, { name: cat.name, icon: cat.icon || '' });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);

  const applyFilters = useCallback((s: any, avail: AvailabilityFilter, areas: string[], cats: string[], verified: boolean) => {
    if (avail === 'open' && !isShopOpen(s)) return false;
    if (avail === 'closed' && isShopOpen(s)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    if (cats.length > 0) {
      const shopCatNames = (s.shop_categories || []).map((sc: any) => sc.categories?.name).filter(Boolean);
      if (!cats.some((c) => shopCatNames.includes(c))) return false;
    }
    if (verified && !s.is_verified) return false;
    return true;
  }, []);

  const filteredShops = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, availability, selectedAreas, selectedCategories, verifiedOnly)),
    [shops, availability, selectedAreas, selectedCategories, verifiedOnly, applyFilters]
  );

  // In-memory pagination — no extra network calls needed
  const pagedShops = useMemo(() => filteredShops.slice(0, page * PAGE_SIZE), [filteredShops, page]);
  const hasMore = pagedShops.length < filteredShops.length;

  // Preview count while sheet is open
  const sheetPreviewCount = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly)).length,
    [shops, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly, applyFilters]
  );

  const openCount = useMemo(() => shops.filter((s: any) => isShopOpen(s)).length, [shops]);

  const activeFilterCount =
    (availability !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length + (verifiedOnly ? 1 : 0);

  const title = debouncedSearch ? `"${debouncedSearch}"` : 'All Shops';

  const handleApply = () => {
    setAvailability(sheetAvailability);
    setSelectedAreas(sheetAreas);
    setSelectedCategories(sheetCategories);
    setVerifiedOnly(sheetVerifiedOnly);
    setFilterOpen(false);
  };

  const handleClearAll = () => {
    setSheetAvailability('all');
    setSheetAreas([]);
    setSheetCategories([]);
    setSheetVerifiedOnly(false);
  };

  const toggleSheetArea = (area: string) =>
    setSheetAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);

  const toggleSheetCategory = (cat: string) =>
    setSheetCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const removeFilter = (type: 'availability' | 'area' | 'category' | 'verified', value?: string) => {
    if (type === 'availability') setAvailability('all');
    if (type === 'area' && value) setSelectedAreas((prev) => prev.filter((a) => a !== value));
    if (type === 'category' && value) setSelectedCategories((prev) => prev.filter((c) => c !== value));
    if (type === 'verified') setVerifiedOnly(false);
  };

  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: 'All Shops',
    open: 'Open Now',
    closed: 'Closed Now',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-1 shrink-0 hover:bg-primary-foreground/10 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
              <p className="text-primary-foreground/70 text-xs">
                {isLoading ? 'Loading...' : `${pagedShops.length} of ${filteredShops.length} shops • ${openCount} open now`}
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
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-foreground bg-card text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground rounded-lg"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
                {availability === 'open' ? '🟢' : '🔴'} {availabilityLabel[availability]}
                <button onClick={() => removeFilter('availability')} className="ml-0.5 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {verifiedOnly && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-primary-foreground text-primary">
                ✅ Verified Only
                <button onClick={() => removeFilter('verified')} className="ml-0.5 hover:opacity-70">
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
            {selectedCategories.map((cat) => (
              <span key={cat} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-primary-foreground text-primary whitespace-nowrap">
                {categoryOptions.find((c) => c.name === cat)?.icon} {cat}
                <button onClick={() => removeFilter('category', cat)} className="ml-0.5 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {activeFilterCount > 1 && (
              <button
                onClick={() => { setAvailability('all'); setSelectedAreas([]); setSelectedCategories([]); setVerifiedOnly(false); }}
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
          <div className="text-center py-16 px-4">
            {/* Contextual empty states */}
            {localSearch && activeFilterCount === 0 ? (
              <>
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-foreground">No shops match "{localSearch}"</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different name, area, or phone number</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setLocalSearch('')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Clear search
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="bg-muted text-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Browse categories
                  </button>
                </div>
              </>
            ) : verifiedOnly && activeFilterCount === 1 ? (
              <>
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-foreground">No verified shops yet</p>
                <p className="text-sm text-muted-foreground mt-1">Check back soon as more shops get verified</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setVerifiedOnly(false)}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    View all shops
                  </button>
                </div>
              </>
            ) : availability === 'open' && activeFilterCount === 1 ? (
              <>
                <p className="text-4xl mb-3">🌙</p>
                <p className="font-semibold text-foreground">No shops open right now</p>
                <p className="text-sm text-muted-foreground mt-1">Try browsing all shops to find what you need</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setAvailability('all')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Show all shops
                  </button>
                </div>
              </>
            ) : selectedAreas.length > 0 && activeFilterCount === selectedAreas.length ? (
              <>
                <p className="text-4xl mb-3">📍</p>
                <p className="font-semibold text-foreground">
                  No shops found in {selectedAreas.length === 1 ? selectedAreas[0] : 'selected areas'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Try a different area or browse all shops</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => setSelectedAreas([])}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Clear area filter
                  </button>
                </div>
              </>
            ) : activeFilterCount > 0 ? (
              <>
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-foreground">No shops match these filters</p>
                <p className="text-sm text-muted-foreground mt-1">Remove a filter to see more results</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => { setAvailability('all'); setSelectedAreas([]); setSelectedCategories([]); setVerifiedOnly(false); }}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Clear all filters
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🏪</p>
                <p className="font-semibold text-foreground">No shops listed yet</p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to list your shop!</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={() => navigate('/')}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-all"
                  >
                    Go Home
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedShops.map((shop: any) => (
                <ShopCard key={shop.id} shop={shop as any} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="w-full mt-4 py-3 rounded-xl border font-semibold text-sm transition-colors active:scale-[0.98]"
                style={{ borderColor: 'hsl(var(--primary) / 0.3)', color: 'hsl(var(--primary))' }}
              >
                Load more ({filteredShops.length - pagedShops.length} remaining)
              </button>
            )}
            {!hasMore && filteredShops.length > PAGE_SIZE && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                All {filteredShops.length} shops shown
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Open/closed status auto-refreshes every minute
            </p>
          </>
        )}
      </main>

      {/* Filter Bottom Sheet */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between px-5 pt-4 pb-2">
            <DrawerTitle className="text-base font-bold">Filters</DrawerTitle>
            {(sheetAvailability !== 'all' || sheetAreas.length > 0 || sheetCategories.length > 0 || sheetVerifiedOnly) && (
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

            {/* Area / Locality */}
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

            {/* Category */}
            {categoryOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Category
                    {sheetCategories.length > 0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {sheetCategories.length}
                      </span>
                    )}
                  </p>
                  {sheetCategories.length > 0 && (
                    <button onClick={() => setSheetCategories([])} className="text-xs text-primary font-semibold hover:opacity-70">
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const active = sheetCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.name}
                        onClick={() => toggleSheetCategory(cat.name)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all font-medium ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verified Only */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Trust</p>
              <button
                onClick={() => setSheetVerifiedOnly((v) => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  sheetVerifiedOnly
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-card border-border text-foreground hover:border-primary/30'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="text-base">✅</span>
                  Verified shops only
                </span>
                <span className={`w-11 h-6 rounded-full flex items-center transition-all duration-200 px-0.5 ${
                  sheetVerifiedOnly ? 'bg-primary justify-end' : 'bg-muted justify-start'
                }`}>
                  <span className="w-5 h-5 rounded-full bg-background shadow-sm" />
                </span>
              </button>
            </div>
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
