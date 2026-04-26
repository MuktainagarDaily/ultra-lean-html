import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, X, Clock, RefreshCw, AlertCircle, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const initialSearch = searchParams.get('search') || '';
  const filterParam = searchParams.get('filter');
  // Support both legacy single ?category=Foo and new multi ?category=Foo&category=Bar
  const initialCategories = (() => {
    const multi = searchParams.getAll('category');
    return multi.length > 0 ? multi : [];
  })();
  const initialAreas = searchParams.getAll('area');
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityFilter>(filterParam === 'open' ? 'open' : 'all');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialAreas);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [verifiedOnly, setVerifiedOnly] = useState(filterParam === 'verified');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [areaSearch, setAreaSearch] = useState('');

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

  // Persist filter state into the URL so back-navigation from ShopDetail restores it.
  // Uses replace:true so each filter tweak doesn't add a history entry — back button
  // still moves one logical page at a time.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (availability === 'open') params.set('filter', 'open');
    else if (verifiedOnly) params.set('filter', 'verified');
    selectedAreas.forEach((a) => params.append('area', a));
    selectedCategories.forEach((c) => params.append('category', c));
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, availability, verifiedOnly, selectedAreas, selectedCategories]);

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
      setAreaSearch('');
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

  // Shop counts per category and per area
  const catShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (shops as any[]).forEach((s) => {
      s.shop_categories?.forEach((sc: any) => {
        const name = sc.categories?.name;
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
    });
    return counts;
  }, [shops]);

  const areaShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (shops as any[]).forEach((s) => {
      const a = s.area?.trim();
      if (a) counts[a] = (counts[a] || 0) + 1;
    });
    return counts;
  }, [shops]);

  // Pre-compute open status once per render cycle to avoid repeated date arithmetic
  const shopOpenMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (shops as any[]).forEach((s) => map.set(s.id, isShopOpen(s)));
    return map;
  }, [shops]);

  // Autocomplete suggestions — top 5 matching shops
  const searchSuggestions = useMemo(() => {
    if (!searchFocused || localSearch.trim().length < 2) return [];
    const q = localSearch.trim().toLowerCase();
    const results: any[] = [];
    for (const shop of shops as any[]) {
      if (results.length >= 5) break;
      const catNames = (shop.shop_categories || [])
        .map((sc: any) => sc.categories?.name || '')
        .filter(Boolean);
      const haystack = [shop.name, shop.area, shop.sub_area, shop.address, shop.description, shop.keywords, ...catNames]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) results.push(shop);
    }
    return results;
  }, [shops, localSearch, searchFocused]);

  // Top 3 categories for quick chips
  const topCategories = useMemo(() => {
    return [...categoryOptions]
      .sort((a, b) => (catShopCounts[b.name] || 0) - (catShopCounts[a.name] || 0))
      .slice(0, 3);
  }, [categoryOptions, catShopCounts]);

  const applyFilters = useCallback((s: any, avail: AvailabilityFilter, areas: string[], cats: string[], verified: boolean) => {
    if (avail === 'open' && !shopOpenMap.get(s.id)) return false;
    if (avail === 'closed' && shopOpenMap.get(s.id)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    if (cats.length > 0) {
      const shopCatNames = (s.shop_categories || []).map((sc: any) => sc.categories?.name).filter(Boolean);
      if (!cats.some((c) => shopCatNames.includes(c))) return false;
    }
    if (verified && !s.is_verified) return false;
    return true;
  }, [shopOpenMap]);

  const filteredShops = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, availability, selectedAreas, selectedCategories, verifiedOnly)),
    [shops, availability, selectedAreas, selectedCategories, verifiedOnly, applyFilters]
  );

  // In-memory pagination — no extra network calls needed
  const totalPages = Math.max(1, Math.ceil(filteredShops.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedShops = useMemo(() => filteredShops.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredShops, safePage]);

  // Preview count while sheet is open
  const sheetPreviewCount = useMemo(() =>
    (shops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly)).length,
    [shops, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly, applyFilters]
  );

  const openCount = useMemo(() => shops.filter((s: any) => isShopOpen(s)).length, [shops]);

  const activeFilterCount =
    (availability !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length + (verifiedOnly ? 1 : 0);

  const title = debouncedSearch ? `"${debouncedSearch}"` : 'All Shops';

  // Build active filter summary text
  const filterSummaryText = useMemo(() => {
    if (activeFilterCount === 0) return '';
    const parts: string[] = [];
    parts.push(`${filteredShops.length}`);
    if (availability === 'open') parts.push('open');
    if (availability === 'closed') parts.push('closed');
    if (verifiedOnly) parts.push('verified');
    parts.push(filteredShops.length === 1 ? 'shop' : 'shops');
    if (selectedAreas.length === 1) parts.push(`in ${selectedAreas[0]}`);
    else if (selectedAreas.length > 1) parts.push(`in ${selectedAreas.length} areas`);
    if (selectedCategories.length === 1) parts.push(`• ${selectedCategories[0]}`);
    else if (selectedCategories.length > 1) parts.push(`• ${selectedCategories.length} categories`);
    return `Showing ${parts.join(' ')}`;
  }, [activeFilterCount, filteredShops.length, availability, verifiedOnly, selectedAreas, selectedCategories]);

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

  // Quick chip toggle helpers
  const toggleQuickOpen = () => setAvailability((a) => a === 'open' ? 'all' : 'open');
  const toggleQuickVerified = () => setVerifiedOnly((v) => !v);
  const toggleQuickCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: 'All Shops',
    open: 'Open Now',
    closed: 'Closed Now',
  };

  // Filtered areas for drawer search
  const filteredAreaOptions = useMemo(() => {
    if (!areaSearch.trim()) return areaOptions;
    const q = areaSearch.trim().toLowerCase();
    return areaOptions.filter((a) => a.toLowerCase().includes(q));
  }, [areaOptions, areaSearch]);

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
            <UserMenuDrawer />
          </div>

          {/* Search with autocomplete */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search by name, area, address..."
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-foreground bg-card text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              autoComplete="off"
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

            {/* Autocomplete dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-[999] overflow-hidden max-h-[320px] overflow-y-auto">
                {searchSuggestions.map((shop: any) => {
                  const catName = shop.shop_categories?.[0]?.categories?.name;
                  const shopPath = shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`;
                  return (
                    <div
                      key={shop.id}
                      onMouseDown={() => navigate(shopPath)}
                      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{shop.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[shop.area, shop.sub_area].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {catName && (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {catName}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick filter chips + filter button */}
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

            {/* Quick chips — Open Now */}
            <button
              onClick={toggleQuickOpen}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                availability === 'open'
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
              }`}
            >
              🟢 Open Now
            </button>

            {/* Quick chips — Verified */}
            <button
              onClick={toggleQuickVerified}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                verifiedOnly
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
              }`}
            >
              <ShieldCheck className="w-3 h-3" /> Verified
            </button>

            {/* Quick chips — Top 3 categories */}
            {topCategories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => toggleQuickCategory(cat.name)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategories.includes(cat.name)
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}

            {/* Active filter pills (only for non-quick filters: areas, remaining categories, closed) */}
            {availability === 'closed' && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-primary-foreground text-primary">
                🔴 Closed Now
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
            {selectedCategories
              .filter((c) => !topCategories.some((tc) => tc.name === c))
              .map((cat) => (
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
        {/* Active filter summary */}
        {activeFilterCount > 0 && filteredShops.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground" style={{ background: 'hsl(var(--primary) / 0.05)' }}>
            {filterSummaryText}
          </div>
        )}

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
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={safePage <= 1}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
                >
                  ‹ Back
                </button>
                {(() => {
                  const items: React.ReactNode[] = [];
                  let lastRendered = 0;
                  for (let p = 1; p <= totalPages; p++) {
                    const show = p === 1 || p === totalPages || Math.abs(p - safePage) <= 1;
                    if (!show) continue;
                    if (lastRendered > 0 && p - lastRendered > 1) {
                      items.push(<span key={`e${p}`} className="px-1.5 text-muted-foreground text-sm select-none">…</span>);
                    }
                    lastRendered = p;
                    items.push(
                      <button
                        key={p}
                        onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-semibold transition-colors ${
                          p === safePage
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  return items;
                })()}
                <button
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={safePage >= totalPages}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
                >
                  Next ›
                </button>
              </div>
            )}
            {filteredShops.length > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredShops.length)} of {filteredShops.length} shops
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
                {/* Area search — shown when 6+ areas */}
                {areaOptions.length >= 6 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      placeholder="Search areas..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {filteredAreaOptions.map((area) => {
                    const active = sheetAreas.includes(area);
                    const count = areaShopCounts[area] || 0;
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
                        <span className="truncate flex-1">{area}</span>
                        {count > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">({count})</span>
                        )}
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
                    const count = catShopCounts[cat.name] || 0;
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
                        {count > 0 && (
                          <span className={`text-[10px] ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            ({count})
                          </span>
                        )}
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
