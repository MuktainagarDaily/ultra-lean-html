import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, TrendingUp, Store, Star, Phone, Plus, ShieldCheck, SlidersHorizontal, X, ChevronRight } from 'lucide-react';
import { UserMenuDrawer } from '@/components/UserMenuDrawer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isShopOpen } from '@/lib/shopUtils';
import { RequestListingModal } from '@/components/RequestListingModal';
import logoIcon from '@/assets/logo-icon.png';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type AvailabilityFilter = 'all' | 'open' | 'closed';

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl p-3 border border-border skeleton-shimmer h-[88px]" />
      ))}
    </div>
  );
}

/** Compact card used in horizontal scroll rows */
function CompactShopCard({ shop }: { shop: any }) {
  const navigate = useNavigate();
  const open = isShopOpen(shop);
  const [imgError, setImgError] = useState(false);
  const shopPath = shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`;

  const logEngagement = async (type: 'call' | 'whatsapp') => {
    try {
      await supabase.from('shop_engagement').insert({ shop_id: shop.id, event_type: type });
    } catch { /* non-critical — don't block user action */ }
  };

  const waNumber = useMemo(() => {
    const raw = (shop.whatsapp || shop.phone || '').replace(/\D/g, '');
    if (raw.length === 10) return `91${raw}`;
    if (raw.length === 11 && raw.startsWith('0')) return `91${raw.slice(1)}`;
    if (raw.startsWith('91') && raw.length === 12) return raw;
    return raw;
  }, [shop.whatsapp, shop.phone]);

  const allCats = useMemo(() => {
    const from_sc = (shop.shop_categories || [])
      .map((sc: any) => sc.categories)
      .filter(Boolean);
    if (from_sc.length > 0) return from_sc;
    if (shop.categories) return [shop.categories];
    return [];
  }, [shop]);

  const catIcon = allCats[0]?.icon || '🏪';

  return (
    <button
      onClick={() => navigate(shopPath)}
      className="flex flex-col bg-card rounded-xl border border-border hover:border-primary hover:shadow-md transition-all active:scale-95 w-[185px] shrink-0 text-left overflow-hidden"
    >
      {/* Image thumbnail if available */}
      {shop.image_url && !imgError ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img
            src={shop.image_url}
            alt={shop.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-8 pointer-events-none"
            style={{ background: 'linear-gradient(to top, hsl(var(--card) / 0.7), transparent)' }}
          />
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full shrink-0 ${open ? 'animate-pulse-open' : 'opacity-60'}`}
            style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-1 w-full">
          <span className="text-xl leading-none">{catIcon}</span>
          {(!shop.image_url || imgError) && (
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${open ? 'animate-pulse-open' : 'opacity-40'}`}
              style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}
            />
          )}
        </div>
        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2 w-full">{shop.name}</p>
        {shop.area && (
          <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{shop.area}</span>
          </p>
        )}
        {shop.is_verified && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none w-fit"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            Verified
          </span>
        )}
        <div className="flex gap-1.5 w-full mt-auto pt-1">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={(e) => { e.stopPropagation(); logEngagement('call'); }}
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
            >
              📞 Call
            </a>
          )}
          {(shop.whatsapp || shop.phone) && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); logEngagement('whatsapp'); }}
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
              style={{ background: 'hsl(142 70% 45% / 0.12)', color: 'hsl(142 70% 35%)' }}
            >
              💬 WA
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

/** Sub-category placeholder row — UI foundation only, no data yet */
function SubCategoryRow() {
  const placeholders = ['All', 'Sub A', 'Sub B', 'Sub C'];
  return (
    <div className="mt-2 ml-2 pl-3 border-l-2 border-primary/20">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Sub-categories</p>
      <div className="flex flex-wrap gap-1.5">
        {placeholders.map((label, i) => (
          <span
            key={label}
            title="Coming soon"
            className={`px-2.5 py-1 rounded-full text-xs border font-medium select-none cursor-not-allowed opacity-50 ${
              i === 0
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            {label}
          </span>
        ))}
        <span className="px-2 py-1 rounded-full text-[10px] font-semibold border border-dashed border-muted-foreground/30 text-muted-foreground/60 select-none">
          + Coming soon
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [catPage, setCatPage] = useState(1);
  const CATS_PER_PAGE = 6;
  const [areaSearch, setAreaSearch] = useState('');

  // Applied filter state
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Temporary sheet state (synced on open)
  const [sheetAvailability, setSheetAvailability] = useState<AvailabilityFilter>('all');
  const [sheetAreas, setSheetAreas] = useState<string[]>([]);
  const [sheetCategories, setSheetCategories] = useState<string[]>([]);
  const [sheetVerifiedOnly, setSheetVerifiedOnly] = useState(false);

  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const categorySectionRef = useRef<HTMLElement>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ['shops', 'all', ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(category_id, categories(name, icon, is_active))')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const openNowCount = useMemo(() => shops.filter((s) => isShopOpen(s)).length, [shops]);
  const verifiedCount = useMemo(() => shops.filter((s: any) => s.is_verified).length, [shops]);

  // Autocomplete suggestions — top 5 matching shops
  const searchSuggestions = useMemo(() => {
    if (!searchFocused || search.trim().length < 2) return [];
    const q = search.trim().toLowerCase();
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
  }, [shops, search, searchFocused]);

  const catShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shops.forEach((shop) => {
      (shop as any).shop_categories?.forEach((sc: any) => {
        if (sc.category_id) counts[sc.category_id] = (counts[sc.category_id] || 0) + 1;
      });
    });
    return counts;
  }, [shops]);

  // Category counts by name (for filter drawer)
  const catNameCounts = useMemo(() => {
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

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => {
      const diff = (catShopCounts[b.id] || 0) - (catShopCounts[a.id] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    }),
    [categories, catShopCounts]
  );

  const visibleCategories = useMemo(
    () => sortedCategories.slice(0, catPage * CATS_PER_PAGE),
    [sortedCategories, catPage, CATS_PER_PAGE]
  );
  const hasMoreCats = sortedCategories.length > catPage * CATS_PER_PAGE;

  const recentShops = useMemo(
    () =>
      [...(shops as any[])]
        .filter((s) => s.name && s.phone && s.area)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [shops]
  );

  // Derive area and category options from loaded shops
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    (shops as any[]).forEach((s) => { const a = s.area?.trim(); if (a) seen.add(a); });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { name: string; icon: string }>();
    (shops as any[]).forEach((s) => {
      s.shop_categories?.forEach((sc: any) => {
        const cat = sc.categories;
        if (cat?.name && cat.is_active !== false && !seen.has(cat.name)) {
          seen.set(cat.name, { name: cat.name, icon: cat.icon || '' });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);

  // Top 3 categories for quick chips
  const topCategories = useMemo(() => {
    return [...categoryOptions]
      .sort((a, b) => (catNameCounts[b.name] || 0) - (catNameCounts[a.name] || 0))
      .slice(0, 3);
  }, [categoryOptions, catNameCounts]);

  const applyFilters = (s: any, avail: AvailabilityFilter, areas: string[], cats: string[], verified: boolean) => {
    if (avail === 'open' && !isShopOpen(s)) return false;
    if (avail === 'closed' && isShopOpen(s)) return false;
    if (areas.length > 0 && !areas.includes(s.area?.trim() || '')) return false;
    if (cats.length > 0) {
      const shopCatNames = (s.shop_categories || []).map((sc: any) => sc.categories?.name).filter(Boolean);
      if (!cats.some((c) => shopCatNames.includes(c))) return false;
    }
    if (verified && !s.is_verified) return false;
    return true;
  };

  const sheetPreviewCount = useMemo(
    () => (shops as any[]).filter((s) => applyFilters(s, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shops, sheetAvailability, sheetAreas, sheetCategories, sheetVerifiedOnly]
  );

  const activeFilterCount =
    (availability !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length + (verifiedOnly ? 1 : 0);

  const handleOpenFilter = () => {
    setSheetAvailability(availability);
    setSheetAreas(selectedAreas);
    setSheetCategories(selectedCategories);
    setSheetVerifiedOnly(verifiedOnly);
    setAreaSearch('');
    setFilterOpen(true);
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

  // Quick chip toggles
  const toggleQuickOpen = () => setAvailability((a) => a === 'open' ? 'all' : 'open');
  const toggleQuickVerified = () => setVerifiedOnly((v) => !v);
  const toggleQuickCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const handleApplyAndNavigate = () => {
    setAvailability(sheetAvailability);
    setSelectedAreas(sheetAreas);
    setSelectedCategories(sheetCategories);
    setVerifiedOnly(sheetVerifiedOnly);
    setFilterOpen(false);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (sheetVerifiedOnly) params.set('filter', 'verified');
    else if (sheetAvailability === 'open') params.set('filter', 'open');
    const qs = params.toString();
    navigate(`/shops${qs ? `?${qs}` : ''}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) { navigate('/shops'); return; }
    // If query exactly matches a category name (case-insensitive), filter by category
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    if (matchedCat) {
      navigate(`/shops?category=${encodeURIComponent(matchedCat.name)}`);
    } else {
      navigate(`/shops?search=${encodeURIComponent(q)}`);
    }
  };

  const scrollToCategories = () => {
    categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: 'All Shops', open: 'Open Now', closed: 'Closed Now',
  };

  // Filtered areas for drawer search
  const filteredAreaOptions = useMemo(() => {
    if (!areaSearch.trim()) return areaOptions;
    const q = areaSearch.trim().toLowerCase();
    return areaOptions.filter((a) => a.toLowerCase().includes(q));
  }, [areaOptions, areaSearch]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header
        className="text-primary-foreground px-4 pt-7 pb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(214 85% 28%) 60%, hsl(215 90% 22%) 100%)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(35%, -35%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent)', transform: 'translate(-35%, 35%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="max-w-lg mx-auto relative z-10">
          {/* Brand Row — logo+title centered, menu button pinned to right */}
          <div className="relative flex items-center justify-center gap-3 mb-1">
            <div className="shrink-0 drop-shadow-md animate-[logo-enter_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
              <img
                src={logoIcon}
                alt="Muktainagar Daily Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-primary-foreground/20 shadow-lg"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-primary-foreground">
                Muktainagar Daily
              </h1>
              <span
                className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase leading-none mt-0.5"
                style={{ color: 'hsl(var(--secondary))' }}
              >
              Local Business Directory
              </span>
            </div>
            {/* User menu — absolutely pinned to right so it never shifts the centered logo */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <UserMenuDrawer />
            </div>
          </div>

          <p className="text-primary-foreground/80 text-xs sm:text-sm text-center mb-0.5">
            आपल्या गावातील सर्व दुकाने एकाच ठिकाणी
          </p>
          <p className="text-primary-foreground/50 text-[10px] sm:text-xs text-center mb-4 font-medium tracking-wide">
            MUKTAINAGAR · JALGAON DISTRICT · MAHARASHTRA
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative mb-3">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
                searchFocused ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="दुकान, सेवा किंवा भाग शोधा…"
              className="w-full pl-10 pr-[88px] py-3.5 rounded-xl text-foreground bg-card text-sm shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors active:scale-95 whitespace-nowrap"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
            >
              Search
            </button>

            {/* Autocomplete suggestions dropdown */}
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
          </form>

          {/* Quick filter chips + filter bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
            <button
              onClick={handleOpenFilter}
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

            {/* Active filter pills for non-quick filters */}
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

          {/* Stats Row — clickable pills */}
          {shops.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <StatPill
                icon={<Store className="w-3 h-3" />}
                label={`${shops.length} Shops`}
                onClick={() => navigate('/shops')}
              />
              <StatPill
                icon={<span className="w-1.5 h-1.5 rounded-full animate-pulse-open shrink-0" style={{ background: 'hsl(var(--success))' }} />}
                label={`${openNowCount} Open Now`}
                highlight
                onClick={() => navigate('/shops?filter=open')}
              />
              <StatPill
                icon={<TrendingUp className="w-3 h-3" />}
                label={`${categories.length} Categories`}
                onClick={scrollToCategories}
              />
              {verifiedCount > 0 && (
                <StatPill
                  icon={<ShieldCheck className="w-3 h-3" />}
                  label={`${verifiedCount} Verified`}
                  onClick={() => navigate('/shops?filter=verified')}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* Trust Strip */}
      <div
        className="py-2.5 px-4 flex items-center justify-start sm:justify-center gap-3 sm:gap-4 border-b border-border text-xs font-medium text-muted-foreground overflow-x-auto scrollbar-none"
        style={{ background: 'hsl(var(--primary) / 0.03)' }}
      >
        <button
          onClick={() => navigate('/shops')}
          className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors group"
        >
          <Phone className="w-3 h-3 text-primary shrink-0" />
          Direct calls
          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity -ml-0.5" />
        </button>
        <span className="w-px h-3 bg-border shrink-0" />
        <button
          onClick={() => navigate('/shops?filter=verified')}
          className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors group"
        >
          <ShieldCheck className="w-3 h-3 text-primary shrink-0" />
          {verifiedCount > 0 ? `${verifiedCount} verified listings` : 'Verified listings'}
          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity -ml-0.5" />
        </button>
        <span className="w-px h-3 bg-border shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          Local businesses
        </span>
        <span className="w-px h-3 bg-border shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <Star className="w-3 h-3 text-primary shrink-0" />
          Reviewed & maintained
        </span>
      </div>

      <main className="max-w-lg mx-auto px-3 sm:px-4 py-5 pb-28">
        {/* Recently Added — now FIRST */}
        {recentShops.length >= 3 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm leading-none">🆕</span>
              <h2 className="text-base sm:text-lg font-bold text-foreground">Recently Added</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {recentShops.map((shop) => (
                <CompactShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          </section>
        )}

        {/* Browse by Category — now SECOND */}
        <section ref={categorySectionRef}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Browse by Category</h2>
            <button
              onClick={() => navigate('/shops')}
              className="text-xs font-semibold text-primary hover:underline shrink-0"
            >
              View all →
            </button>
          </div>

          {catsLoading ? (
            <CategorySkeleton />
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No categories yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                {visibleCategories.map((cat) => {
                  const count = catShopCounts[cat.id] || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => navigate(`/shops?category=${encodeURIComponent(cat.name)}`)}
                      className="group relative flex flex-col items-center gap-1.5 bg-card rounded-xl p-2.5 sm:p-3 border border-border hover:border-primary hover:shadow-md transition-all active:scale-95"
                    >
                      {count > 0 && (
                        <span
                          className="absolute top-1.5 right-1.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full leading-none"
                          style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
                        >
                          {count}
                        </span>
                      )}
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-sm group-hover:scale-110 transition-transform"
                        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))' }}
                      >
                        {cat.icon}
                      </div>
                      <span className="text-[10px] sm:text-xs font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hasMoreCats && (
                <button
                  onClick={() => setCatPage((p) => p + 1)}
                  className="w-full mt-3 py-2.5 rounded-xl border font-semibold text-sm transition-colors hover:bg-muted/50 active:scale-[0.98]"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--primary))' }}
                >
                  View more ({sortedCategories.length - visibleCategories.length} more categories)
                </button>
              )}
            </>
          )}
        </section>

        {/* All Shops CTA */}
        <section className="mt-5">
          <button
            onClick={() => navigate('/shops')}
            className="w-full py-4 rounded-xl font-bold text-sm sm:text-base transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(214 85% 30%))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Store className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span>View All {shops.length > 0 ? `${shops.length} ` : ''}Shops</span>
            {openNowCount > 0 && (
              <span
                className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: 'hsl(var(--success))', color: 'hsl(var(--success-foreground))' }}
              >
                {openNowCount} open
              </span>
            )}
          </button>
        </section>


        {/* Quick Info */}
        <section
          className="mt-3.5 rounded-xl p-3.5 border"
          style={{ background: 'hsl(var(--secondary) / 0.08)', borderColor: 'hsl(var(--secondary) / 0.3)' }}
        >
          <p className="text-xs sm:text-sm text-foreground text-center font-medium">
            📍 Muktainagar, Jalgaon District, Maharashtra
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground text-center mt-1">
            Find local shops • Call directly • No registration needed
          </p>
        </section>
      </main>

      <footer className="text-center text-[11px] text-muted-foreground py-5 border-t border-border px-4">
        © 2026 Muktainagar Daily • Hyperlocal Business Directory
      </footer>

      {showRequestModal && (
        <RequestListingModal onClose={() => setShowRequestModal(false)} />
      )}

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
                    <button onClick={() => setSheetAreas([])} className="text-xs text-primary font-semibold hover:opacity-70">Clear</button>
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

            {/* Category — with sub-category placeholder row */}
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
                    <button onClick={() => setSheetCategories([])} className="text-xs text-primary font-semibold hover:opacity-70">Clear</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const active = sheetCategories.includes(cat.name);
                    const count = catNameCounts[cat.name] || 0;
                    return (
                      <div key={cat.name} className="w-full">
                        <button
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
                        {/* Sub-category placeholder — shown when category is selected */}
                        {active && <SubCategoryRow />}
                      </div>
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

          {/* Apply CTA — navigates to Shops page with filters pre-applied */}
          <div className="px-5 pb-8 pt-2 border-t border-border">
            <button
              onClick={handleApplyAndNavigate}
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

function StatPill({
  icon,
  label,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const base = `flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold shrink-0 transition-all ${
    highlight
      ? 'bg-success/20 text-success border border-success/30'
      : 'bg-primary-foreground/15 text-primary-foreground'
  }`;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} hover:bg-primary-foreground/25 active:scale-95 cursor-pointer`}
      >
        {icon}
        <span>{label}</span>
        <ChevronRight className="w-2.5 h-2.5 opacity-60" />
      </button>
    );
  }

  return (
    <div className={base}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
