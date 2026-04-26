import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Home, LogOut, Store, Tag, BarChart2, Inbox, Wrench } from 'lucide-react';

import { ShopsTab } from '@/components/admin/ShopsTab';
import { CategoriesTab } from '@/components/admin/CategoriesTab';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { RequestsTab } from '@/components/admin/RequestsTab';
import { DataQualityTab } from '@/components/admin/DataQualityTab';
import { ShopModal } from '@/components/admin/ShopModal';
import { CategoryModal } from '@/components/admin/CategoryModal';
import { CsvImportModal } from '@/components/admin/CsvImportModal';
import { SpeedShopModal } from '@/components/admin/SpeedShopModal';

type Tab = 'shops' | 'categories' | 'analytics' | 'requests' | 'quality';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('shops');
  const [shopForm, setShopForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [showSpeedForm, setShowSpeedForm] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [{ count: total }, { count: active }, { count: cats }, { count: verified }, { count: pending }] =
        await Promise.all([
          supabase.from('shops').select('id', { count: 'exact', head: true }),
          supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_verified', true),
          supabase.from('shop_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
      return { total: total ?? 0, active: active ?? 0, cats: cats ?? 0, verified: verified ?? 0, pending: pending ?? 0 };
    },
    staleTime: 30_000, // P1: stop refetching on every tab switch
  });

  return (
    <div className="min-h-screen bg-muted">
      {/* Top Bar */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-5 h-5 shrink-0" />
          <span className="font-bold text-base sm:text-lg truncate">Muktainagar Admin</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Client Site</span>
          </button>
          <span className="text-xs text-primary-foreground/70 hidden xl:block truncate max-w-[160px]">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
            <StatCard label="Total Shops" value={stats.total} icon="🏪" />
            <StatCard label="Active" value={stats.active} icon="✅" />
            <StatCard label="Verified" value={stats.verified} icon="🛡️" />
            <StatCard label="Categories" value={stats.cats} icon="🏷️" />
            <StatCard label="Pending" value={stats.pending} icon="📬" highlight={stats.pending > 0} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          <TabButton active={tab === 'shops'} onClick={() => setTab('shops')} icon={<Store className="w-4 h-4" />} label="Shops" />
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={<Tag className="w-4 h-4" />} label="Categories" />
          <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={<BarChart2 className="w-4 h-4" />} label="Analytics" />
          <TabButton
            active={tab === 'requests'}
            onClick={() => setTab('requests')}
            icon={<Inbox className="w-4 h-4" />}
            label="Requests"
            badge={stats?.pending ?? 0}
          />
          <TabButton
            active={tab === 'quality'}
            onClick={() => setTab('quality')}
            icon={<Wrench className="w-4 h-4" />}
            label={<><span className="hidden sm:inline">Data Quality</span><span className="sm:hidden">Quality</span></>}
          />
        </div>

        {tab === 'shops' && (
          <ShopsTab onEdit={(shop) => setShopForm(shop)} onImport={() => setShowImport(true)} onSpeedAdd={() => setShowSpeedForm(true)} />
        )}
        {tab === 'categories' && <CategoriesTab onEdit={(cat) => setCategoryForm(cat)} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'requests' && (
          <RequestsTab
            onShopCreated={() => {
              qc.invalidateQueries({ queryKey: ['admin-shops'] });
              qc.invalidateQueries({ queryKey: ['admin-stats'] });
            }}
          />
        )}
        {tab === 'quality' && <DataQualityTab onEditShop={(shop) => setShopForm(shop)} />}
      </div>

      {shopForm !== null && (
        <ShopModal
          shop={shopForm}
          onClose={() => setShopForm(null)}
          onSaved={() => {
            setShopForm(null);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}

      {categoryForm !== null && (
        <CategoryModal
          category={categoryForm}
          onClose={() => setCategoryForm(null)}
          onSaved={() => {
            setCategoryForm(null);
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}

      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
            qc.invalidateQueries({ queryKey: ['shops'] });
          }}
        />
      )}
      {showSpeedForm && (
        <SpeedShopModal
          onClose={() => setShowSpeedForm(false)}
          onDone={() => {
            setShowSpeedForm(false);
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
            qc.invalidateQueries({ queryKey: ['shops'] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={`bg-card rounded-xl border px-2 py-3 text-center ${highlight ? 'border-secondary/60' : 'border-border'}`}>
      <div className="text-xl mb-0.5">{icon}</div>
      <div
        className={`text-lg sm:text-xl font-bold leading-tight ${highlight ? '' : 'text-foreground'}`}
        style={highlight ? { color: 'hsl(var(--secondary))' } : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-0.5 truncate">{label}</div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-card text-muted-foreground hover:text-foreground border border-border'
      }`}
    >
      {icon} {label}
      {badge != null && badge > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none"
          style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
