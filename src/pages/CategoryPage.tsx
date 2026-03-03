import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { ShopCard } from '@/components/ShopCard';

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: category } = useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops', 'category', id],
    queryFn: async () => {
      // Get shop IDs in this category via junction table
      const { data: scData, error: scError } = await supabase
        .from('shop_categories')
        .select('shop_id')
        .eq('category_id', id!);
      if (scError) throw scError;
      const shopIds = scData.map((r: any) => r.shop_id);
      if (shopIds.length === 0) return [];

      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(name, icon))')
        .in('id', shopIds)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">
              {category?.icon} {category?.name || 'Category'}
            </h1>
            <p className="text-primary-foreground/70 text-xs">{shops.length} shops</p>
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
            <p className="text-4xl mb-3">🏪</p>
            <p className="font-semibold text-foreground">No shops in this category yet</p>
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
