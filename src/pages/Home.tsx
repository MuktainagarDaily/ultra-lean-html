import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, TrendingUp, Store, Star, Phone, Plus, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isShopOpen } from '@/lib/shopUtils';
import { RequestListingModal } from '@/components/RequestListingModal';

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl p-3 border border-border skeleton-shimmer h-[88px]" />
      ))}
    </div>
  );
}

/** Compact card used in horizontal scroll rows (Verified + Recent sections) */
function CompactShopCard({ shop }: { shop: any }) {
  const navigate = useNavigate();
  const open = isShopOpen(shop);

  const waNumber = useMemo(() => {
    const raw = (shop.whatsapp || shop.phone || '').replace(/\D/g, '');
    return raw.length === 10 ? `91${raw}` : raw;
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
      onClick={() => navigate(`/shop/${shop.id}`)}
      className="flex flex-col gap-2 bg-card rounded-xl p-3 border border-border hover:border-primary hover:shadow-md transition-all active:scale-95 w-[185px] shrink-0 text-left"
    >
      {/* Top row: icon + open dot */}
      <div className="flex items-center justify-between gap-1 w-full">
        <span className="text-xl leading-none">{catIcon}</span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${open ? 'animate-pulse-open' : 'opacity-40'}`}
          style={{ background: open ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}
        />
      </div>

      {/* Name */}
      <p className="text-xs font-bold text-foreground leading-tight line-clamp-2 w-full">{shop.name}</p>

      {/* Area */}
      {shop.area && (
        <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{shop.area}</span>
        </p>
      )}

      {/* Verified badge */}
      {shop.is_verified && (
        <span
          className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none w-fit"
          style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
        >
          <ShieldCheck className="w-2.5 h-2.5" />
          Verified
        </span>
      )}

      {/* Quick actions */}
      <div className="flex gap-1.5 w-full mt-auto pt-1">
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
            style={{ background: 'hsl(142 70% 45% / 0.12)', color: 'hsl(142 70% 35%)' }}
          >
            💬 WA
          </a>
        )}
      </div>
    </button>
  );
}

export default function Home() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

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

  const openNowCount = useMemo(
    () => shops.filter((s) => isShopOpen(s)).length,
    [shops]
  );

  const verifiedCount = useMemo(
    () => shops.filter((s: any) => s.is_verified).length,
    [shops]
  );

  const catShopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shops.forEach((shop) => {
      (shop as any).shop_categories?.forEach((sc: any) => {
        if (sc.category_id) {
          counts[sc.category_id] = (counts[sc.category_id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [shops]);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const diff = (catShopCounts[b.id] || 0) - (catShopCounts[a.id] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }),
    [categories, catShopCounts]
  );

  // Recently added — active shops with name + phone + area, most recent first, max 4
  const recentShops = useMemo(
    () =>
      [...(shops as any[])]
        .filter((s) => s.name && s.phone && s.area)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [shops]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shops?search=${encodeURIComponent(search.trim())}`);
    } else {
      navigate('/shops');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header
        className="text-primary-foreground px-4 pt-7 pb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(214 85% 28%) 60%, hsl(215 90% 22%) 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(35%, -35%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent)', transform: 'translate(-35%, 35%)' }}
        />
        {/* Grid texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="max-w-lg mx-auto relative z-10">
          {/* Brand Row */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="bg-primary-foreground/20 backdrop-blur-sm p-2 rounded-xl border border-primary-foreground/10 shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">Muktainagar Daily</h1>
          </div>

          {/* Trust tagline */}
          <p className="text-primary-foreground/80 text-xs sm:text-sm text-center mb-0.5">
            आपल्या गावातील सर्व दुकाने एकाच ठिकाणी
          </p>
          <p className="text-primary-foreground/50 text-[10px] sm:text-xs text-center mb-4 font-medium tracking-wide">
            MUKTAINAGAR · JALGAON DISTRICT · MAHARASHTRA
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative mb-4">
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
              onBlur={() => setSearchFocused(false)}
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
          </form>

          {/* Stats Row */}
          {shops.length > 0 && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <StatPill icon={<Store className="w-3 h-3" />} label={`${shops.length} Shops`} />
              <StatPill
                icon={<span className="w-1.5 h-1.5 rounded-full animate-pulse-open shrink-0" style={{ background: 'hsl(var(--success))' }} />}
                label={`${openNowCount} Open Now`}
                highlight
              />
              <StatPill icon={<TrendingUp className="w-3 h-3" />} label={`${categories.length} Categories`} />
              {verifiedCount > 0 && (
                <StatPill icon={<ShieldCheck className="w-3 h-3" />} label={`${verifiedCount} Verified`} />
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
        <span className="flex items-center gap-1.5 shrink-0">
          <Phone className="w-3 h-3 text-primary shrink-0" />
          Direct calls
        </span>
        <span className="w-px h-3 bg-border shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <ShieldCheck className="w-3 h-3 text-primary shrink-0" />
          {verifiedCount > 0 ? `${verifiedCount} verified listings` : 'Verified listings'}
        </span>
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
        {/* Categories */}
        <section>
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
            <div className="grid grid-cols-3 gap-2.5">
              {sortedCategories.map((cat) => {
                const count = catShopCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/category/${cat.id}`)}
                    className="group relative flex flex-col items-center gap-1.5 bg-card rounded-xl p-2.5 sm:p-3 border border-border hover:border-primary hover:shadow-md transition-all active:scale-95"
                  >
                    {/* Count badge */}
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
          )}
        </section>

        {/* Recently Added — hidden when fewer than 3 qualifying shops */}
        {recentShops.length >= 3 && (
          <section className="mt-5">
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

        {/* List Your Shop CTA */}
        <section className="mt-3">
          <button
            onClick={() => setShowRequestModal(true)}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 border"
            style={{
              background: 'hsl(var(--secondary) / 0.1)',
              borderColor: 'hsl(var(--secondary) / 0.35)',
              color: 'hsl(var(--foreground))',
            }}
          >
            <Plus className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--secondary))' }} />
            <span>List Your Shop — Free</span>
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

      {/* Footer */}
      <footer className="text-center text-[11px] text-muted-foreground py-5 border-t border-border px-4">
        © 2026 Muktainagar Daily • Hyperlocal Business Directory
      </footer>

      {/* Request Listing Modal */}
      {showRequestModal && (
        <RequestListingModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}

function StatPill({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold shrink-0 ${
      highlight ? 'bg-success/20 text-success border border-success/30' : 'bg-primary-foreground/15'
    }`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
