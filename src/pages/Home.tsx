import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, TrendingUp, Store } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isShopOpen } from '@/lib/shopUtils';

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl p-4 border border-border skeleton-shimmer h-24" />
      ))}
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

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

  // Per-category shop counts
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

  // Sort categories by shop count descending (most-used first), alphabetical as tiebreaker
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
        className="text-primary-foreground px-4 pt-10 pb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(214 85% 30%) 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent)', transform: 'translate(30%, -30%)' }}
        />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary-glow)), transparent)', transform: 'translate(-30%, 30%)' }}
        />

        <div className="max-w-lg mx-auto text-center relative z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="bg-primary-foreground/20 p-2 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Muktainagar Daily</h1>
          </div>
          <p className="text-primary-foreground/80 text-sm mb-5">
            आपल्या गावातील सर्व दुकाने एकाच ठिकाणी
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shops, services, areas..."
              className="w-full pl-12 pr-28 py-4 rounded-xl text-foreground bg-card text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
            >
              Search
            </button>
          </form>

          {/* Stats Row */}
          {shops.length > 0 && (
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5 bg-primary-foreground/15 px-3 py-1.5 rounded-full">
                <Store className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{shops.length} Shops</span>
              </div>
              <div className="flex items-center gap-1.5 bg-primary-foreground/15 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full animate-pulse-open" style={{ background: 'hsl(var(--success))' }} />
                <span className="text-xs font-semibold">{openNowCount} Open Now</span>
              </div>
              <div className="flex items-center gap-1.5 bg-primary-foreground/15 px-3 py-1.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{categories.length} Categories</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-28">
        {/* Categories — sorted by shop count (most popular first) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Browse by Category</h2>
            <button
              onClick={() => navigate('/shops')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all →
            </button>
          </div>

          {catsLoading ? (
            <CategorySkeleton />
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No categories yet.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {sortedCategories.map((cat) => {
                const count = catShopCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/category/${cat.id}`)}
                    className="group flex flex-col items-center gap-2 bg-card rounded-xl p-3 border border-border hover:border-primary hover:shadow-md transition-all active:scale-95 relative"
                  >
                    {/* Count badge */}
                    {count > 0 && (
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>
                        {count}
                      </span>
                    )}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.06))' }}>
                      {cat.icon}
                    </div>
                    <span className="text-xs font-semibold text-foreground text-center leading-tight">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* All Shops CTA */}
        <section className="mt-6">
          <button
            onClick={() => navigate('/shops')}
            className="w-full py-4 rounded-xl font-bold text-base transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(214 85% 30%))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Store className="w-5 h-5" />
            View All {shops.length > 0 ? `${shops.length} ` : ''}Shops
            {openNowCount > 0 && (
              <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(var(--success))', color: 'hsl(var(--success-foreground))' }}>
                {openNowCount} open
              </span>
            )}
          </button>
        </section>

        {/* Quick Info */}
        <section className="mt-4 rounded-xl p-4 border"
          style={{ background: 'hsl(var(--secondary) / 0.08)', borderColor: 'hsl(var(--secondary) / 0.3)' }}>
          <p className="text-sm text-foreground text-center font-medium">
            📍 Muktainagar, Jalgaon District, Maharashtra
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Find local shops • Call directly • No registration needed
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border">
        © 2026 Muktainagar Daily • Hyperlocal Business Directory
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919373065746?text=Hello%2C%20I%20want%20my%20shop%20listed%20on%20Muktainagar%20Daily!"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-4 flex items-center gap-2 text-white px-4 py-3 rounded-full shadow-lg active:scale-95 transition-all z-50 font-semibold text-sm"
        style={{ background: '#25D366' }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="leading-tight">दुकान नोंदवा / List your shop</span>
      </a>
    </div>
  );
}
