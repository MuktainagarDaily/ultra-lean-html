import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, X } from 'lucide-react';
import { ShopCard } from '@/components/ShopCard';

export default function Shops() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSearch = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops', 'all', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('shops')
        .select('*, shop_categories(categories(name, icon))')
        .eq('is_active', true)
        .order('name');

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,area.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const title = debouncedSearch ? `Results for "${debouncedSearch}"` : 'All Shops';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-1 shrink-0 hover:bg-primary-foreground/10 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
              <p className="text-primary-foreground/70 text-xs">{shops.length} shops found</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by name or area..."
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
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse h-28" />
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-foreground">No shops found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
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
              <ShopCard key={shop.id} shop={shop as any} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
