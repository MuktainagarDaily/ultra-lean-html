import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Home() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: categories = [] } = useQuery({
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shops?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <MapPin className="w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-tight">Muktainagar Daily</h1>
          </div>
          <p className="text-primary-foreground/80 text-sm mb-6">
            आपल्या गावातील सर्व दुकाने एकाच ठिकाणी • Your local business directory
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shops, services..."
              className="w-full pl-12 pr-4 py-4 rounded-xl text-foreground bg-card text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Categories */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-foreground">Browse by Category</h2>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/category/${cat.id}`)}
                  className="flex flex-col items-center gap-2 bg-card rounded-xl p-4 border border-border hover:border-primary hover:shadow-md transition-all active:scale-95"
                >
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-xs font-semibold text-foreground text-center leading-tight">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* All Shops CTA */}
        <section className="mt-8">
          <button
            onClick={() => navigate('/shops')}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-base hover:bg-primary/90 transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            View All Shops
          </button>
        </section>

        {/* Quick Info */}
        <section className="mt-6 bg-secondary/10 rounded-xl p-4 border border-secondary/30">
          <p className="text-sm text-foreground text-center font-medium">
            📍 Muktainagar, Jalgaon District, Maharashtra
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Find local shops • Call directly • No registration needed
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground py-6 mt-4 border-t border-border">
        © 2026 Muktainagar Daily • Hyperlocal Business Directory
      </footer>
    </div>
  );
}
