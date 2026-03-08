import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, TrendingUp, Store, Star, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isShopOpen } from '@/lib/shopUtils';

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl p-3 border border-border skeleton-shimmer h-[88px]" />
      ))}
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
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
        .select('*, shop_categories(category_id, categories(name, icon))')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const openNowCount = useMemo(
    () => shops.filter((s) => isShopOpen(s)).length,
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

          {/* Stats Row — wraps gracefully on tiny screens */}
          {shops.length > 0 && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <StatPill icon={<Store className="w-3 h-3" />} label={`${shops.length} Shops`} />
              <StatPill
                icon={<span className="w-1.5 h-1.5 rounded-full animate-pulse-open shrink-0" style={{ background: 'hsl(var(--success))' }} />}
                label={`${openNowCount} Open Now`}
                highlight
              />
              <StatPill icon={<TrendingUp className="w-3 h-3" />} label={`${categories.length} Categories`} />
            </div>
          )}
        </div>
      </header>

      {/* Trust Strip — scrollable on tiny screens */}
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
          <Star className="w-3 h-3 text-primary shrink-0" />
          Verified listings
        </span>
        <span className="w-px h-3 bg-border shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          Local businesses
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

      {/* Footer */}
      <footer className="text-center text-[11px] text-muted-foreground py-5 border-t border-border px-4">
        © 2026 Muktainagar Daily • Hyperlocal Business Directory
      </footer>

      {/* Floating WhatsApp Button — raised above bottom safe area */}
      <a
        href="https://wa.me/919373065746?text=Hello%2C%20I%20want%20my%20shop%20listed%20on%20Muktainagar%20Daily!"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-3 sm:right-4 flex items-center gap-1.5 text-white px-3.5 sm:px-4 py-3 rounded-full shadow-lg active:scale-95 transition-all z-50 font-semibold text-xs sm:text-sm max-w-[200px] sm:max-w-none"
        style={{ background: '#25D366' }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="leading-tight truncate">दुकान नोंदवा / List your shop</span>
      </a>
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
