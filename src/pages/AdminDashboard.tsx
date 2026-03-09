import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, Pencil, Trash2, LogOut, Store, Tag, Eye, EyeOff, MapPin, X, Check, Search, Home, ShieldCheck, ShieldOff, Filter, Loader2, AlertTriangle, BarChart2, Phone, MessageCircle, TrendingUp, Upload, Download, CheckCircle2, AlertCircle, SkipForward, Inbox, ThumbsUp, ThumbsDown, Wrench, GitMerge, TriangleAlert, Users, RefreshCw, HardDrive, PackageX, Navigation, Link2, ExternalLink, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { compressImage } from '@/lib/imageUtils';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Tab = 'shops' | 'categories' | 'analytics' | 'requests' | 'quality';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('shops');
  const [shopForm, setShopForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Stats query — includes verified count + pending requests badge
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [{ count: total }, { count: active }, { count: cats }, { count: verified }, { count: pending }] = await Promise.all([
        supabase.from('shops').select('id', { count: 'exact', head: true }),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('shop_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      return { total: total || 0, active: active || 0, cats: cats || 0, verified: verified || 0, pending: pending || 0 };
    },
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
            badge={stats?.pending || 0}
          />
          <TabButton active={tab === 'quality'} onClick={() => setTab('quality')} icon={<Wrench className="w-4 h-4" />} label={<><span className="hidden sm:inline">Data Quality</span><span className="sm:hidden">Quality</span></>} />
        </div>

        {tab === 'shops' && (
          <ShopsTab
            onEdit={(shop) => setShopForm(shop)}
            onImport={() => setShowImport(true)}
          />
        )}
        {tab === 'categories' && <CategoriesTab onEdit={(cat) => setCategoryForm(cat)} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'requests' && <RequestsTab onShopCreated={() => { qc.invalidateQueries({ queryKey: ['admin-shops'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); }} />}
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
            qc.invalidateQueries({ queryKey: ['shops'] }); // BUG-05: invalidate public queries
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
      <div className={`text-lg sm:text-xl font-bold leading-tight ${highlight ? '' : 'text-foreground'}`} style={highlight ? { color: 'hsl(var(--secondary))' } : undefined}>{value}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-0.5 truncate">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: React.ReactNode; badge?: number }) {
  return (
      <button
      onClick={onClick}
      className={`relative shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:text-foreground border border-border'
      }`}
    >
      {icon} {label}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none"
          style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>
          {badge}
        </span>
      )}
    </button>
  );
}


/* ─── SHOPS TAB ─────────────────────────────────────────────── */
function ShopsTab({ onEdit, onImport }: { onEdit: (shop: any) => void; onImport: () => void }) {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(id, name, icon))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Collect all unique categories from loaded shops for the filter dropdown
  const allCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string }>();
    shops.forEach((s: any) => {
      s.shop_categories?.forEach((sc: any) => {
        if (sc.categories) map.set(sc.categories.id, sc.categories);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);

  const filtered = useMemo(() => {
    let result = shops as any[];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.area?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          s.whatsapp?.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      );
    }
    if (categoryFilter) {
      result = result.filter((s) =>
        s.shop_categories?.some((sc: any) => sc.categories?.id === categoryFilter)
      );
    }
    return result;
  }, [shops, searchText, categoryFilter]);

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('shops').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });

  const toggleVerified = useMutation({
    mutationFn: async ({ id, is_verified }: { id: string; is_verified: boolean }) => {
      const { error } = await supabase.from('shops').update({ is_verified }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const deleteShop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Shop deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete shop');
    },
  });

  const exportCsv = useCallback(() => {
    const headers = ['Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Categories', 'Active', 'Verified'];
    const rows = filtered.map((s: any) => {
      const cats = (s.shop_categories || [])
        .map((sc: any) => sc.categories?.name)
        .filter(Boolean)
        .join(' | ');
      return [
        s.name ?? '',
        s.phone ?? '',
        s.whatsapp ?? '',
        s.area ?? '',
        s.address ?? '',
        cats,
        s.is_active ? 'Yes' : 'No',
        s.is_verified ? 'Yes' : 'No',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muktainagar-shops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-foreground">Shops ({filtered.length}/{shops.length})</h2>
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, area, phone, address..."
              className="pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring w-44"
            />
          </div>
          {/* Category Filter */}
          {allCategories.length > 0 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none w-40 cursor-pointer"
              >
                <option value="">All Categories</option>
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => onImport()}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => onEdit({})}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Shop</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />)}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Categories</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden md:table-cell">Area</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden lg:table-cell">Verified</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shop: any) => {
                  const cats = shop.shop_categories
                    ?.map((sc: any) => sc.categories)
                    .filter(Boolean) || [];
                  return (
                    <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {shop.name}
                          {shop.is_verified && (
                            <span title="Verified">
                              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                            </span>
                          )}
                        </div>
                        {shop.phone && <div className="text-xs text-muted-foreground">{shop.phone}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {cats.length > 0 ? cats.map((c: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                              {c.icon} {c.name}
                            </span>
                          )) : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm">
                        {shop.area || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive.mutate({ id: shop.id, is_active: !shop.is_active })}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            shop.is_active
                              ? 'bg-success/10 text-success border border-success/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {shop.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <button
                          onClick={() => toggleVerified.mutate({ id: shop.id, is_verified: !shop.is_verified })}
                          title={shop.is_verified ? 'Click to unverify' : 'Click to verify'}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            shop.is_verified
                              ? 'bg-primary/10 text-primary border border-primary/30'
                              : 'bg-muted text-muted-foreground border border-border hover:border-primary/40'
                          }`}
                        >
                          {shop.is_verified
                            ? <><ShieldCheck className="w-3 h-3" /> Verified</>
                            : <><ShieldOff className="w-3 h-3" /> Unverified</>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(shop)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: shop.id, name: shop.name })}
                            className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      {searchText || categoryFilter ? `No shops match current filters` : 'No shops yet. Add your first shop!'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shop Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this shop and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteShop.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteShop.mutate(deleteTarget.id)}
              disabled={deleteShop.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteShop.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
              ) : (
                'Delete Shop'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── CATEGORIES TAB ─────────────────────────────────────────── */
function CategoriesTab({ onEdit }: { onEdit: (cat: any) => void }) {
  const qc = useQueryClient();
  const [deleteCatTarget, setDeleteCatTarget] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [deleteCatLinkedShops, setDeleteCatLinkedShops] = useState<string[]>([]);
  const [fetchingLinks, setFetchingLinks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergeCatTarget, setMergeCatTarget] = useState<{ id: string; name: string; icon: string; shopCount: number } | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const [{ data: cats, error: catErr }, { data: links, error: linkErr }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('shop_categories').select('category_id'),
      ]);
      if (catErr) throw catErr;
      if (linkErr) throw linkErr;
      const countMap = new Map<string, number>();
      (links || []).forEach((row: any) => {
        countMap.set(row.category_id, (countMap.get(row.category_id) || 0) + 1);
      });
      return (cats || []).map((c) => ({ ...c, shopCount: countMap.get(c.id) || 0 }));
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  const handleDeleteClick = async (cat: { id: string; name: string; icon: string }) => {
    setFetchingLinks(true);
    const { data } = await supabase
      .from('shop_categories')
      .select('shops(name)')
      .eq('category_id', cat.id);
    const shopNames = (data || []).map((row: any) => row.shops?.name).filter(Boolean) as string[];
    setDeleteCatLinkedShops(shopNames);
    setDeleteCatTarget(cat);
    setFetchingLinks(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCatTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('categories').delete().eq('id', deleteCatTarget.id);
    if (error) {
      toast.error('Failed to delete category');
    } else {
      toast.success('Category deleted');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeleteCatTarget(null);
      setDeleteCatLinkedShops([]);
    }
    setDeleting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Categories ({categories.length})</h2>
        <button
          onClick={() => {
            const headers = ['Name', 'Icon', 'Active'];
            const rows = (categories as any[]).map((c) => [c.name, c.icon, c.is_active ? 'Yes' : 'No']);
            const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `muktainagar-categories-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
        <button
          onClick={() => onEdit({})}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />)}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Icon</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Shops</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-2xl">{cat.icon}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{cat.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                      (cat as any).shopCount > 0
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {(cat as any).shopCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: cat.id, is_active: !cat.is_active })}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        cat.is_active
                          ? 'bg-success/10 text-success border border-success/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {cat.is_active ? <><Check className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Disabled</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {(cat as any).shopCount > 0 && (
                        <button
                          onClick={() => setMergeCatTarget(cat as any)}
                          title="Merge into another category"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <GitMerge className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(cat)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(cat)}
                        disabled={fetchingLinks}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {fetchingLinks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">No categories yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Category Delete Confirmation */}
      <AlertDialog open={!!deleteCatTarget} onOpenChange={(open) => !open && setDeleteCatTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              Delete "{deleteCatTarget?.icon} {deleteCatTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {deleteCatLinkedShops.length > 0 ? (
                  <>
                    <p>
                      This category is linked to <strong className="text-foreground">{deleteCatLinkedShops.length} shop{deleteCatLinkedShops.length !== 1 ? 's' : ''}</strong>.
                      The category will be deleted and all links removed — the shops themselves will not be affected.
                    </p>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Affected shops</p>
                      <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {deleteCatLinkedShops.map((name, i) => (
                          <li key={i} className="text-sm text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p>No shops are linked to this category. It is safe to delete.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
              ) : (
                'Delete Category'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Merge Modal */}
      {mergeCatTarget && (
        <CategoryMergeModal
          source={mergeCatTarget}
          allCategories={categories as any[]}
          onClose={() => setMergeCatTarget(null)}
          onMerged={() => {
            setMergeCatTarget(null);
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
            qc.invalidateQueries({ queryKey: ['shops'] });
          }}
        />
      )}
    </div>
  );
}

/* ─── CATEGORY MERGE MODAL ───────────────────────────────────── */
function CategoryMergeModal({
  source,
  allCategories,
  onClose,
  onMerged,
}: {
  source: { id: string; name: string; icon: string; shopCount: number };
  allCategories: { id: string; name: string; icon: string; shopCount: number }[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [targetId, setTargetId] = useState('');
  const [disableSource, setDisableSource] = useState(true);
  const [merging, setMerging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const targets = allCategories.filter((c) => c.id !== source.id);
  const targetCat = targets.find((c) => c.id === targetId);

  const handleMerge = async () => {
    if (!targetId) return;
    setMerging(true);
    try {
      // Fetch all shop_categories rows for the source category
      const { data: sourceLinks, error: fetchErr } = await supabase
        .from('shop_categories')
        .select('id, shop_id')
        .eq('category_id', source.id);
      if (fetchErr) throw fetchErr;

      // Fetch existing links for target to avoid duplicates
      const { data: targetLinks, error: fetchErr2 } = await supabase
        .from('shop_categories')
        .select('shop_id')
        .eq('category_id', targetId);
      if (fetchErr2) throw fetchErr2;

      const alreadyHasTarget = new Set((targetLinks || []).map((r: any) => r.shop_id));

      // Separate: shops that need reassignment vs shops already in target (delete those)
      const toReassign = (sourceLinks || []).filter((r: any) => !alreadyHasTarget.has(r.shop_id));
      const toDelete = (sourceLinks || []).filter((r: any) => alreadyHasTarget.has(r.shop_id));

      // Step 1: Delete ALL source links (both shops needing reassignment and duplicates)
      const allSourceIds = [...toReassign, ...toDelete].map((r: any) => r.id);
      if (allSourceIds.length > 0) {
        const { error: delErr } = await supabase
          .from('shop_categories')
          .delete()
          .in('id', allSourceIds);
        if (delErr) throw delErr;
      }

      // Step 2: Insert new target links only for shops not already linked to target
      if (toReassign.length > 0) {
        const newLinks = toReassign.map((r: any) => ({ shop_id: r.shop_id, category_id: targetId }));
        const { error: insertErr } = await supabase
          .from('shop_categories')
          .insert(newLinks);
        if (insertErr) throw insertErr;
      }

      // Optionally disable source category
      if (disableSource) {
        await supabase.from('categories').update({ is_active: false }).eq('id', source.id);
      }

      toast.success(`Merged ${source.icon} ${source.name} → ${targetCat?.icon} ${targetCat?.name}. ${source.shopCount} shop${source.shopCount !== 1 ? 's' : ''} reassigned.`);
      onMerged();
    } catch (e: any) {
      toast.error('Merge failed: ' + (e.message || 'Unknown error'));
    }
    setMerging(false);
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary shrink-0" />
              Merge {source.icon} {source.name}
            </DialogTitle>
            <DialogDescription>
              Reassign shops from this category into another. The exact count will be confirmed from the live database during merge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1.5">Merge into</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select target category…</option>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name} ({c.shopCount} shops)
                  </option>
                ))}
              </select>
            </div>

            {targetCat && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <strong className="text-foreground">{source.shopCount} shop{source.shopCount !== 1 ? 's' : ''}</strong> will be moved from{' '}
                <span className="font-semibold text-foreground">{source.icon} {source.name}</span> to{' '}
                <span className="font-semibold text-foreground">{targetCat.icon} {targetCat.name}</span>.
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={disableSource}
                onChange={(e) => setDisableSource(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-foreground">Disable source category after merge</span>
            </label>
          </div>

          <DialogFooter>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!targetId || merging}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Review & Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="w-5 h-5 text-secondary shrink-0" />
              Confirm merge?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {source.shopCount} shop{source.shopCount !== 1 ? 's' : ''} will be reassigned from{' '}
              <strong>{source.icon} {source.name}</strong> to <strong>{targetCat?.icon} {targetCat?.name}</strong>.
              {disableSource && ' The source category will be disabled.'}
              {' '}This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); handleMerge(); }}
              disabled={merging}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {merging ? <><Loader2 className="w-4 h-4 animate-spin" /> Merging…</> : 'Merge Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── ANALYTICS TAB ──────────────────────────────────────────── */

type DateRange = '7d' | '30d' | 'all';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
];

type ShopSort = 'total' | 'call' | 'whatsapp';

function AnalyticsTab() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [shopSort, setShopSort] = useState<ShopSort>('total');

  // Build ISO cutoff from selected range
  const cutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : 30));
    return d.toISOString();
  }, [dateRange]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-engagement', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('shop_engagement')
        .select('shop_id, event_type, created_at, shops(name, area, shop_categories(categories(id, name, icon)))')
        .order('created_at', { ascending: false })
        .limit(5000); // R7: raise above default 1000-row cap
      if (cutoff) query = query.gte('created_at', cutoff);
      const { data, error } = await query;
      if (error) throw error;
      return data as {
        shop_id: string;
        event_type: string;
        created_at: string;
        shops: {
          name: string;
          area: string | null;
          shop_categories: { categories: { id: string; name: string; icon: string } | null }[];
        } | null;
      }[];
    },
  });

  // Aggregate by shop
  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; area: string | null; call: number; whatsapp: number; total: number }>();
    rows.forEach((r) => {
      if (!map.has(r.shop_id)) {
        map.set(r.shop_id, { name: r.shops?.name ?? r.shop_id, area: r.shops?.area ?? null, call: 0, whatsapp: 0, total: 0 });
      }
      const e = map.get(r.shop_id)!;
      if (r.event_type === 'call') e.call += 1;
      if (r.event_type === 'whatsapp') e.whatsapp += 1;
      e.total += 1;
    });
    return Array.from(map.values());
  }, [rows]);

  // Sorted shop lists by dimension
  const sortedShops = useMemo(() => {
    const key = shopSort;
    return [...aggregated].sort((a, b) => b[key] - a[key]).filter((r) => r[key] > 0);
  }, [aggregated, shopSort]);

  // Aggregate by category
  const aggregatedCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; total: number; call: number; whatsapp: number }>();
    rows.forEach((r) => {
      const cats = r.shops?.shop_categories ?? [];
      cats.forEach((sc) => {
        const cat = sc.categories;
        if (!cat) return;
        if (!map.has(cat.id)) {
          map.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, total: 0, call: 0, whatsapp: 0 });
        }
        const e = map.get(cat.id)!;
        e.total += 1;
        if (r.event_type === 'call') e.call += 1;
        if (r.event_type === 'whatsapp') e.whatsapp += 1;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalCalls = rows.filter((r) => r.event_type === 'call').length;
  const totalWhatsApp = rows.filter((r) => r.event_type === 'whatsapp').length;

  return (
    <div className="space-y-6">
      {/* Header + Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">Engagement Analytics</h2>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                dateRange === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {sortedShops.length > 0 && (
          <button
            onClick={() => {
              const headers = ['Shop Name', 'Area', 'Calls', 'WhatsApp', 'Total'];
              const rows = sortedShops.map((r: any) => [r.name, r.area ?? '', r.call, r.whatsapp, r.total]);
              const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `muktainagar-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-card rounded-xl border border-border px-3 py-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-xl font-bold text-foreground">{rows.length}</div>
          <div className="text-xs text-muted-foreground">Total Taps</div>
        </div>
        <div className="bg-card rounded-xl border border-border px-3 py-3 text-center">
          <Phone className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-xl font-bold text-foreground">{totalCalls}</div>
          <div className="text-xs text-muted-foreground">Calls</div>
        </div>
        <div className="bg-card rounded-xl border border-border px-3 py-3 text-center">
          <MessageCircle className="w-5 h-5 mx-auto mb-1" style={{ color: '#25D366' }} />
          <div className="text-xl font-bold text-foreground">{totalWhatsApp}</div>
          <div className="text-xs text-muted-foreground">WhatsApp</div>
        </div>
      </div>

      {/* Top Shops */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-foreground">Top Shops</h3>
          {/* Sort dimension selector */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 self-start sm:self-auto">
            {([
              { value: 'total', label: 'Total' },
              { value: 'call', label: '📞 Calls' },
              { value: 'whatsapp', label: '💬 WhatsApp' },
            ] as { value: ShopSort; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setShopSort(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  shopSort === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-14" />)}
          </div>
        ) : sortedShops.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">📊</p>
            <p className="font-semibold text-sm">No engagement data for this period</p>
            <p className="text-xs mt-1">Call and WhatsApp taps will appear here once users engage.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-foreground w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><Phone className="w-3.5 h-3.5" /> Calls</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><MessageCircle className="w-3.5 h-3.5" /> WA</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">
                      {shopSort === 'total' ? 'Total' : shopSort === 'call' ? 'Calls' : 'WA'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShops.map((row, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{row.name}</div>
                        {row.area && <div className="text-xs text-muted-foreground">{row.area}</div>}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {row.call > 0 ? <span className="font-semibold text-foreground">{row.call}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {row.whatsapp > 0 ? <span className="font-semibold text-foreground">{row.whatsapp}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${shopSort === 'total' ? 'text-primary' : shopSort === 'call' ? 'text-primary' : ''}`} style={shopSort === 'whatsapp' ? { color: '#25D366' } : undefined}>
                          {row[shopSort]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Top Categories */}
      <div>
        <h3 className="font-bold text-foreground mb-3">Top Categories by Engagement</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-14" />)}
          </div>
        ) : aggregatedCategories.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">🏷️</p>
            <p className="font-semibold text-sm">No category engagement for this period</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-foreground w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><Phone className="w-3.5 h-3.5" /> Calls</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground hidden sm:table-cell">
                      <span className="flex items-center justify-end gap-1"><MessageCircle className="w-3.5 h-3.5" /> WA</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedCategories.map((cat, idx) => (
                    <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">{cat.icon}</span>
                          <span className="font-semibold text-foreground">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {cat.call > 0 ? <span className="font-semibold text-foreground">{cat.call}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {cat.whatsapp > 0 ? <span className="font-semibold text-foreground">{cat.whatsapp}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-primary">{cat.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DATA QUALITY HELPERS (module-level, pure — no re-creation on render) ─ */

/** Normalize area name to a comparable key: lowercase, strip Devanagari & punctuation */
function dqAreaCompareKey(area: string): string {
  // Bug 6 fix: guard against empty/whitespace-only strings
  if (!area?.trim()) return '__empty__';
  return area
    .toLowerCase()
    .replace(/[\u0900-\u097F]+/g, '')  // strip Devanagari (Marathi) characters
    .replace(/[^a-z0-9\s]/g, '')       // strip punctuation/commas
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if the string contains at least one Devanagari character */
const dqHasDevanagari = (s: string) => /[\u0900-\u097F]/.test(s);

/**
 * Title-case ASCII words; leave Devanagari words unchanged.
 * Bug 2 fix: use lookbehind (^|[\s,]) instead of \b — JS \b is ASCII-only
 * and does not fire between a Devanagari char and a lowercase ASCII letter.
 */
function dqNormalizeAreaValue(s: string): string {
  return s.trim().replace(/(^|[\s,])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** Flag suspicious area names (too short, numeric-only, or ALL-CAPS ASCII) */
function dqIsSuspiciousArea(area: string): boolean {
  const t = area.trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true; // numeric only
  // All-caps ASCII check — ignore if it contains Devanagari (might be bilingual)
  if (!dqHasDevanagari(t) && t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) return true;
  return false;
}

/* ─── DATA QUALITY TAB ───────────────────────────────────────── */
function DataQualityTab({ onEditShop }: { onEditShop: (shop: any) => void }) {
  const qc = useQueryClient();

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, shop_categories(categories(id, name, icon))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // ─── Area consistency ─────────────────────────────────────────
  const areaSummary = useMemo(() => {
    const map = new Map<string, number>();
    shops.forEach((s) => {
      const area = s.area?.trim();
      if (area) map.set(area, (map.get(area) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);
  }, [shops]);

  /** Map: normalized key → list of original area strings that share it */
  const similarAreaGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    areaSummary.forEach(({ area }) => {
      const key = dqAreaCompareKey(area);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(area);
    });
    // Only keep groups with >1 area (actual near-duplicates)
    const result = new Map<string, string[]>();
    map.forEach((areas, key) => { if (areas.length > 1) result.set(key, areas); });
    return result;
  }, [areaSummary]);

  /**
   * Precomputed map: area → best canonical candidate (or null if this area IS the best).
   * Avoids calling areaSummary.find() O(n) on every table row render.
   */
  const bestCandidateMap = useMemo(() => {
    const countMap = new Map<string, number>(areaSummary.map(({ area, count }) => [area, count]));
    const result = new Map<string, string | null>();
    similarAreaGroups.forEach((areas) => {
      // Pick best: highest count wins; tie-break: prefer the one with Devanagari (bilingual)
      // Bug 1 fix: proper tie-break — compare both sides, not just b
      const sorted = [...areas].sort((a, b) =>
        (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0) ||
        (dqHasDevanagari(b) ? 1 : 0) - (dqHasDevanagari(a) ? 1 : 0)
      );
      const best = sorted[0];
      areas.forEach((area) => {
        result.set(area, area === best ? null : best);
      });
    });
    return result;
  }, [similarAreaGroups, areaSummary]);

  const [areaRenameTarget, setAreaRenameTarget] = useState<string | null>(null);
  const [areaRenameValue, setAreaRenameValue] = useState('');
  const [areaRenaming, setAreaRenaming] = useState(false);

  const handleAreaRename = async (oldArea: string) => {
    if (!areaRenameValue.trim()) return;
    const newArea = dqNormalizeAreaValue(areaRenameValue);
    if (newArea === oldArea) { setAreaRenameTarget(null); setAreaRenameValue(''); return; }
    setAreaRenaming(true);
    const { error } = await supabase
      .from('shops')
      .update({ area: newArea })
      .eq('area', oldArea);
    if (error) {
      toast.error('Rename failed: ' + error.message);
    } else {
      toast.success(`Area renamed: "${oldArea}" → "${newArea}"`);
      setAreaRenameTarget(null);
      setAreaRenameValue('');
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
    }
    setAreaRenaming(false);
  };

  // ─── Duplicate detection ──────────────────────────────────────
  /** Group shops by normalized phone */
  const phoneDuplicateGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    shops.forEach((s) => {
      if (!s.phone) return;
      let n = s.phone.replace(/[\s\-().+]/g, '');
      if (n.startsWith('91') && n.length === 12) n = n.slice(2);
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(s);
    });
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [shops]);

  /** Group shops by similar name+area (first 5 chars + same area) */
  const nameAreaDuplicateGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    shops.forEach((s) => {
      const nameKey = s.name?.toLowerCase().replace(/\s+/g, '').slice(0, 5) || '';
      const areaKey = (s.area || '').toLowerCase().trim();
      const key = `${nameKey}::${areaKey}`;
      if (!nameKey || !areaKey) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [shops]);

  // Merge both groups, deduplicate by shop IDs
  const allDuplicateGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: any[][] = [];
    [...phoneDuplicateGroups, ...nameAreaDuplicateGroups].forEach((group) => {
      const key = group.map((s: any) => s.id).sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        groups.push(group);
      }
    });
    return groups;
  }, [phoneDuplicateGroups, nameAreaDuplicateGroups]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Data Quality</h2>
        <p className="text-sm text-muted-foreground">Review area consistency and spot potential duplicate shops. No automated changes — admin stays in control.</p>
      </div>

      {/* ── Section 1: Area Consistency ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Area Consistency</h3>
          <span className="ml-auto text-xs text-muted-foreground">{areaSummary.length} unique area{areaSummary.length !== 1 ? 's' : ''}</span>
        </div>

        {areaSummary.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">No area data found.</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Area Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-20">Shops</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {areaSummary.map(({ area, count }) => {
                   const suspicious = dqIsSuspiciousArea(area);
                   const isEditing = areaRenameTarget === area;
                   const similarKey = dqAreaCompareKey(area);
                   const similarGroup = similarAreaGroups.get(similarKey);
                   const similarPeers = similarGroup ? similarGroup.filter((a) => a !== area) : [];
                   const hasSimilar = similarPeers.length > 0;
                   // Use precomputed map — null means "this IS the best candidate"
                   const bestCandidate = bestCandidateMap.get(area) ?? null;
                   const isNotBest = hasSimilar && bestCandidate !== null;
                  return (
                    <tr key={area} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${hasSimilar ? 'bg-destructive/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{area}</span>
                          {suspicious && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                              <TriangleAlert className="w-2.5 h-2.5" /> suspicious
                            </span>
                          )}
                        </div>
                        {hasSimilar && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                           <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/25">
                               <TriangleAlert className="w-2.5 h-2.5" />
                               {/* Bug 3 fix: 45-char threshold + title tooltip for full name on hover */}
                               similar: {similarPeers.map((p) => (
                                 <span key={p} title={p}>{`"${p.length > 45 ? p.slice(0, 43) + '…' : p}"`}</span>
                               ))}
                            </span>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={areaRenameValue}
                              onChange={(e) => setAreaRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAreaRename(area); if (e.key === 'Escape') setAreaRenameTarget(null); }}
                              placeholder="New area name…"
                              autoFocus
                              className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <button
                              onClick={() => handleAreaRename(area)}
                              disabled={areaRenaming || !areaRenameValue.trim()}
                              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90"
                            >
                              {areaRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                            <button
                              onClick={() => { setAreaRenameTarget(null); setAreaRenameValue(''); }}
                              className="h-8 px-2 rounded-md border border-border text-xs hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isEditing && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isNotBest && (
                              <button
                                onClick={() => { setAreaRenameTarget(area); setAreaRenameValue(bestCandidate!); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors border border-destructive/25"
                                title={`Merge into "${bestCandidate}"`}
                              >
                                <ArrowRight className="w-3 h-3" /> Merge
                              </button>
                            )}
                            <button
                              onClick={() => { setAreaRenameTarget(area); setAreaRenameValue(area); }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                            >
                              <Pencil className="w-3 h-3" /> Rename
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Renaming an area updates all shops in that locality at once. Names are auto title-cased on save.
          <span className="inline-flex items-center gap-1 ml-1 text-secondary font-medium"><TriangleAlert className="w-3 h-3" /> suspicious</span> flags very short, all-caps, or numeric-only names.
          <span className="inline-flex items-center gap-1 ml-1 text-destructive font-medium"><TriangleAlert className="w-3 h-3" /> similar</span> detects near-duplicate names (case/script variants) — click <strong>Merge</strong> to consolidate into the best candidate.
        </p>
      </section>

      {/* ── Section 2: Possible Duplicates ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Possible Duplicate Shops</h3>
          {allDuplicateGroups.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-secondary/15 text-secondary border border-secondary/30">
              {allDuplicateGroups.length}
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-shops'] })}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {allDuplicateGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-semibold text-sm text-foreground">No duplicates detected</p>
            <p className="text-xs text-muted-foreground mt-1">No shops share the same phone number or have a very similar name in the same area.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allDuplicateGroups.map((group, gi) => (
              <div key={gi} className="bg-card rounded-xl border border-secondary/30 overflow-hidden">
                <div className="px-4 py-2 bg-secondary/8 border-b border-secondary/20 flex items-center gap-2">
                  <TriangleAlert className="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span className="text-xs font-semibold text-secondary">Possible duplicate group · {group.length} shops</span>
                </div>
                <div className="divide-y divide-border">
                  {group.map((shop: any) => {
                    const cats = (shop.shop_categories || [])
                      .map((sc: any) => sc.categories)
                      .filter(Boolean);
                    return (
                      <div key={shop.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{shop.name}</span>
                            {!shop.is_active && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Inactive</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                            {shop.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{shop.phone}</span>}
                            {shop.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{shop.area}</span>}
                            {cats.length > 0 && (
                              <span>{cats.map((c: any) => `${c.icon} ${c.name}`).join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onEditShop(shop)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Duplicates are flagged by matching normalized phone number, or very similar name + same area. No shops are automatically changed — use Edit to resolve manually.
        </p>
      </section>

      {/* ── Section 3: Storage Audit ── */}
      <StorageAuditSection />
    </div>
  );
}

/* ─── STORAGE AUDIT SECTION ─────────────────────────────────── */
function StorageAuditSection() {
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [orphans, setOrphans] = useState<{ name: string; size: number; created_at: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const runScan = async () => {
    setScanning(true);
    setScanned(false);
    setOrphans([]);
    setSelected(new Set());
    try {
      // 1. List all files in the bucket — paginate to avoid 1000-file hard cap (BUG-06)
      type StorageFile = { name: string; id: string; metadata?: { size?: number }; created_at?: string };
      let pagedFiles: StorageFile[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page, error: listErr } = await supabase.storage
          .from('shop-images')
          .list('', { limit: PAGE, offset });
        if (listErr) throw listErr;
        const valid = (page || []).filter((f) => f.name && f.id) as StorageFile[];
        pagedFiles = pagedFiles.concat(valid);
        if (!page || page.length < PAGE) break;
        offset += PAGE;
      }

      const allFiles = pagedFiles; // exclude folders already filtered above

      if (allFiles.length === 0) {
        setOrphans([]);
        setScanned(true);
        setScanning(false);
        return;
      }

      // 2. Collect all referenced image URLs from shops + shop_requests
      const [{ data: shopImgs }, { data: reqImgs }] = await Promise.all([
        supabase.from('shops').select('image_url').not('image_url', 'is', null),
        supabase.from('shop_requests').select('image_url').not('image_url', 'is', null),
      ]);

      const referencedPaths = new Set<string>();
      [...(shopImgs || []), ...(reqImgs || [])].forEach((row: any) => {
        if (row.image_url) {
          const marker = '/object/public/shop-images/';
          const idx = (row.image_url as string).indexOf(marker);
          if (idx !== -1) {
            const path = decodeURIComponent((row.image_url as string).slice(idx + marker.length).split('?')[0]);
            referencedPaths.add(path);
          }
        }
      });

      // 3. Find orphans — files not in any referenced URL
      const found = allFiles
        .filter((f) => !referencedPaths.has(f.name))
        .map((f) => ({
          name: f.name,
          size: f.metadata?.size ?? 0,
          created_at: f.created_at ?? '',
        }));

      setOrphans(found);
      setScanned(true);
    } catch (err: any) {
      toast.error('Scan failed: ' + (err?.message || 'Unknown error'));
    }
    setScanning(false);
  };

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === orphans.length) setSelected(new Set());
    else setSelected(new Set(orphans.map((o) => o.name)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const paths = Array.from(selected);
    const { error } = await supabase.storage.from('shop-images').remove(paths);
    if (error) {
      toast.error('Delete failed: ' + error.message);
    } else {
      toast.success(`Deleted ${paths.length} orphaned file${paths.length !== 1 ? 's' : ''}`);
      setOrphans((prev) => prev.filter((o) => !selected.has(o.name)));
      setSelected(new Set());
    }
    setDeleteConfirmOpen(false);
    setDeleting(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalOrphanSize = orphans.reduce((acc, o) => acc + (o.size || 0), 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-foreground">Storage Audit</h3>
        {scanned && (
          <span className={`ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold ${
            orphans.length > 0
              ? 'bg-destructive/15 text-destructive border border-destructive/30'
              : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            {orphans.length}
          </span>
        )}
        <button
          onClick={runScan}
          disabled={scanning}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {scanned ? 'Re-scan' : 'Scan Now'}
        </button>
      </div>

      {!scanned && !scanning && (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="font-semibold text-sm text-foreground">Not scanned yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Click <strong>Scan Now</strong> to list all files in the shop-images bucket and find any that are no longer referenced by a shop or request.
          </p>
        </div>
      )}

      {scanning && (
        <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Scanning storage bucket…</span>
        </div>
      )}

      {scanned && !scanning && orphans.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-sm text-foreground">No orphaned files</p>
          <p className="text-xs text-muted-foreground mt-1">All files in the bucket are referenced by an active shop or request.</p>
        </div>
      )}

      {scanned && !scanning && orphans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-destructive">{orphans.length} orphaned file{orphans.length !== 1 ? 's' : ''}</span>
              {' '}· {formatBytes(totalOrphanSize)} total · not referenced by any shop or request
            </p>
            {selected.size > 0 && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete {selected.size} selected
              </button>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === orphans.length && orphans.length > 0}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Filename</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground w-24 hidden sm:table-cell">Size</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground w-36 hidden md:table-cell">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((file) => (
                  <tr
                    key={file.name}
                    className={`border-b border-border last:border-0 transition-colors cursor-pointer ${
                      selected.has(file.name) ? 'bg-destructive/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => toggleSelect(file.name)}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(file.name)}
                        onChange={() => toggleSelect(file.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 rounded border-input cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <PackageX className="w-3.5 h-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-xs text-foreground truncate max-w-[200px] sm:max-w-none">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{formatBytes(file.size)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                      {file.created_at ? new Date(file.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        Orphaned files are images uploaded to storage but no longer linked to any shop or request record. Safe to delete — this won't affect any live data.
      </p>

      {/* Confirm delete dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete {selected.size} orphaned file{selected.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selected.size} file{selected.size !== 1 ? 's' : ''} ({formatBytes(Array.from(selected).reduce((acc, n) => acc + (orphans.find(o => o.name === n)?.size ?? 0), 0))}) from the storage bucket.
              <br /><br />
              <strong>This cannot be undone.</strong> Only do this if you are sure these files are not needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting…</> : `Delete ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ─── SHOP MODAL ─────────────────────────────────────────────── */

/** Extract the storage file path from a Supabase public URL.
 *  Returns null if the URL is not a recognized shop-images bucket URL. */
function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = '/object/public/shop-images/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
  } catch {
    return null;
  }
}


/** Normalize a WhatsApp number for a wa.me link (digits-only, with 91 prefix) */
function normalizeWhatsApp(wa: string): string {
  let n = wa.replace(/\D/g, '');
  // Ensure country code 91 is present for Indian numbers
  if (n.length === 10) n = '91' + n;
  // Strip extra leading 91 if already 12+ digits with 91 prefix
  if (n.startsWith('91') && n.length === 12) return n;
  return n;
}

/** Check if a phone number has at least 10 digits */
function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}


type DupeShopInfo = {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  categories: { name: string; icon: string }[];
};

function ShopModal({ shop, onClose, onSaved }: { shop: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!shop.id;
  // Track the image URL at mount time so we can clean it up if a new one is uploaded
  const oldImageUrl = useRef<string>(shop.image_url || '');
  const [form, setForm] = useState({
    name: shop.name || '',
    phone: shop.phone || '',
    whatsapp: shop.whatsapp || '',
    address: shop.address || '',
    area: shop.area || '',
    opening_time: shop.opening_time || '',
    closing_time: shop.closing_time || '',
    is_open: shop.is_open ?? true,
    is_active: shop.is_active ?? true,
    is_verified: shop.is_verified ?? false,
    image_url: shop.image_url || '',
    latitude: shop.latitude?.toString() || '',
    longitude: shop.longitude?.toString() || '',
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Duplicate phone dialog state
  const [dupePhoneShop, setDupePhoneShop] = useState<DupeShopInfo | null>(null);
  // Pending save payload for after dupe confirmation
  const [pendingSave, setPendingSave] = useState<(() => Promise<void>) | null>(null);

  // Location state for Maps link + GPS
  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const [mapsLinkError, setMapsLinkError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ lat: number; lng: number; rawUrl: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapsLink, setMapsLink] = useState('');

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support location access'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setMapsLink('');
        setParsedPreview(null);
        setMapsLinkInput('');
        setLocating(false);
        toast.success('Location captured!');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please allow location access.');
        } else {
          toast.error('Could not get location. Try again or paste a Maps link.');
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleExtractFromLink = () => {
    const trimmed = mapsLinkInput.trim();
    if (!trimmed) { setMapsLinkError('Please paste a Google Maps link first'); return; }
    if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps')) {
      setMapsLinkError('This is a short link. Open it in your browser, copy the full URL from the address bar, then paste it here.');
      return;
    }
    const coords = parseGoogleMapsLink(trimmed);
    if (!coords) {
      setMapsLinkError('Could not find coordinates in this link. Use a full Google Maps URL (e.g. google.com/maps/place/...).');
      return;
    }
    setMapsLinkError('');
    setParsedPreview({ lat: coords.lat, lng: coords.lng, rawUrl: trimmed });
  };

  const confirmLocation = () => {
    if (!parsedPreview) return;
    setForm((f) => ({ ...f, latitude: parsedPreview.lat.toFixed(6), longitude: parsedPreview.lng.toFixed(6) }));
    setMapsLink(parsedPreview.rawUrl);
    setParsedPreview(null);
    setMapsLinkInput('');
    setMapsLinkError('');
  };

  const clearLocation = () => {
    setForm((f) => ({ ...f, latitude: '', longitude: '' }));
    setMapsLink('');
    setParsedPreview(null);
    setMapsLinkInput('');
    setMapsLinkError('');
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: shopCategoryData } = useQuery({
    queryKey: ['shop-categories', shop.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('category_id')
        .eq('shop_id', shop.id);
      if (error) throw error;
      return data;
    },
    enabled: !!shop.id,
  });

  // FIX-A: Move setState out of queryFn to prevent background refetch
  // silently resetting admin's in-progress category selection.
  useEffect(() => {
    if (shopCategoryData === undefined) return;
    if (shopCategoryData.length > 0) {
      setSelectedCategoryIds(shopCategoryData.map((r: any) => r.category_id));
    } else if (shop.category_id) {
      // BUG-A fix: fall back to legacy category_id FK if no join rows exist yet
      setSelectedCategoryIds([shop.category_id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopCategoryData]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Shop name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!isValidPhone(form.phone)) {
      errs.phone = 'Enter a valid phone number (at least 10 digits)';
    }
    if (form.whatsapp.trim() && !isValidPhone(form.whatsapp)) {
      errs.whatsapp = 'Enter a valid WhatsApp number (at least 10 digits)';
    }
    if (!form.area.trim() && !form.address.trim()) errs.area = 'Area or address is required';
    if (form.latitude) {
      const lat = parseFloat(form.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) errs.latitude = 'Latitude must be between -90 and 90';
    }
    if (form.longitude) {
      const lon = parseFloat(form.longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) errs.longitude = 'Longitude must be between -180 and 180';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.75): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        // R2: guard against canvas.toBlob returning null (unsupported format/browser)
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else resolve(new Blob([], { type: 'image/webp' }));
        }, 'image/webp', quality);
      };
      img.src = url;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    const compressed = await compressImage(file);
    const path = `shop-${Date.now()}.webp`;
    const { error } = await supabase.storage.from('shop-images').upload(path, compressed, { upsert: true, contentType: 'image/webp' });
    if (error) {
      toast.error('Image upload failed');
    } else {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success('Image uploaded');
    }
    setUploading(false);
  };

  /** The actual save logic — extracted so it can be deferred after dupe confirmation */
  const executeSave = async () => {
    setSaving(true);

    // Capitalize first letter of each word in area for consistency
    // BUG-04: use bilingual-safe regex (handles English words after Devanagari)
    const normalizeArea = (s: string) =>
      s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      // Normalize WhatsApp to digits-only with country code for wa.me links
      whatsapp: form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
      address: form.address.trim() || null,
      area: form.area.trim() ? normalizeArea(form.area) : null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      is_open: form.is_open,
      is_active: form.is_active,
      is_verified: form.is_verified,
      image_url: form.image_url || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };

    let shopId = shop.id;
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('shops').update(payload).eq('id', shop.id));
    } else {
      const { data: inserted, error: insertError } = await supabase.from('shops').insert(payload).select('id').single();
      error = insertError;
      if (inserted) shopId = inserted.id;
    }
    if (error) {
      toast.error('Failed to save shop');
      setSaving(false);
      return;
    }
    if (shopId) {
      await supabase.from('shop_categories').delete().eq('shop_id', shopId);
      if (selectedCategoryIds.length > 0) {
        await supabase.from('shop_categories').insert(
          selectedCategoryIds.map((catId) => ({ shop_id: shopId, category_id: catId }))
        );
      }
    }
    toast.success(isEdit ? 'Shop updated!' : 'Shop added!');

    // After successful save, clean up the old image from storage if it was replaced
    if (isEdit && oldImageUrl.current && oldImageUrl.current !== form.image_url) {
      const path = extractStoragePath(oldImageUrl.current);
      if (path) {
        const { error: storageErr } = await supabase.storage.from('shop-images').remove([path]);
        if (storageErr) {
          toast.warning('Shop saved, but the previous image could not be removed from storage.');
        }
      }
    }

    onSaved();
    setSaving(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    // Duplicate phone detection — normalize before comparing
    const normalizedPhone = normalizePhone(form.phone);
    if (normalizedPhone) {
      const { data: allPhones } = await supabase.from('shops').select('id, name, phone, area, shop_categories(categories(name, icon))');
      const dupeRaw = allPhones?.find(
        (s: any) => s.id !== shop.id && s.phone && normalizePhone(s.phone) === normalizedPhone
      );
      if (dupeRaw) {
        const cats = ((dupeRaw as any).shop_categories || [])
          .map((sc: any) => sc.categories)
          .filter(Boolean) as { name: string; icon: string }[];
        setDupePhoneShop({
          id: dupeRaw.id,
          name: dupeRaw.name,
          phone: dupeRaw.phone,
          area: dupeRaw.area,
          categories: cats,
        });
        setPendingSave(() => executeSave);
        setSaving(false);
        return; // STOP — do not save yet
      }
    }

    // No duplicate — proceed immediately
    setSaving(false);
    await executeSave();
  };

  const handleSaveAnyway = async () => {
    setDupePhoneShop(null);
    setPendingSave(null);
    await executeSave();
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-bold text-lg text-foreground">{isEdit ? 'Edit Shop' : 'Add New Shop'}</h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            <Field label="Shop Name *">
              <input
                value={form.name}
                onChange={(e) => { set('name', e.target.value); setErrors((err) => ({ ...err, name: '' })); }}
                className={inputCls + (errors.name ? ' border-destructive' : '')}
                placeholder="e.g. Sharma General Store"
                maxLength={120}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </Field>

            {/* Multi-category */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Categories <span className="text-muted-foreground font-normal">(select one or more)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const selected = selectedCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      }`}
                    >
                      <span>{c.icon}</span> {c.name}
                    </button>
                  );
                })}
              </div>
              {selectedCategoryIds.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No category selected</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone *">
                <input
                  value={form.phone}
                  onChange={(e) => { set('phone', e.target.value); setErrors((err) => ({ ...err, phone: '' })); }}
                  className={inputCls + (errors.phone ? ' border-destructive' : '')}
                  placeholder="e.g. 9876543210"
                  inputMode="numeric"
                  maxLength={20}
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </Field>
              <Field label="WhatsApp (optional)">
                <input
                  value={form.whatsapp}
                  onChange={(e) => { set('whatsapp', e.target.value); setErrors((err) => ({ ...err, whatsapp: '' })); }}
                  className={inputCls + (errors.whatsapp ? ' border-destructive' : '')}
                  placeholder="e.g. 9876543210"
                  inputMode="numeric"
                  maxLength={20}
                />
                {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
                <p className="text-xs text-muted-foreground mt-1">Leave blank if same as phone</p>
              </Field>
            </div>

            <Field label="Address (Street / Full address)">
              <input value={form.address} onChange={(e) => { set('address', e.target.value); setErrors((err) => ({ ...err, area: '' })); }} className={inputCls} placeholder="e.g. Near Bus Stand, Station Road" maxLength={250} />
            </Field>
            <Field label="Area / Locality *">
              <input
                value={form.area}
                onChange={(e) => { set('area', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
                className={inputCls + (errors.area ? ' border-destructive' : '')}
                placeholder="e.g. Main Road, Muktainagar"
                list="common-areas"
                maxLength={100}
              />
              <datalist id="common-areas">
                <option value="Main Road" />
                <option value="Station Road" />
                <option value="Bus Stand Area" />
                <option value="Market Area" />
                <option value="Ward 1" />
                <option value="Ward 2" />
                <option value="Ward 3" />
                <option value="Ward 4" />
                <option value="Ward 5" />
              </datalist>
              {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
            </Field>

            {/* ── Location section ─────────────────────────────────── */}
            <div
              className="rounded-xl border"
              style={{ background: 'hsl(var(--muted) / 0.5)', borderColor: 'hsl(var(--border))' }}
            >
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold text-foreground">Shop Location (optional)</p>
              </div>

              {/* Confirmed coords badge */}
              {(form.latitude && form.longitude) && (
                <div
                  className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                  style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}
                >
                  <span className="text-[11px] font-mono text-foreground truncate">
                    📍 {form.latitude}, {form.longitude}
                  </span>
                  <button type="button" onClick={clearLocation} className="shrink-0 text-xs text-destructive font-semibold hover:opacity-70">
                    Clear
                  </button>
                </div>
              )}

              {/* Input options — shown only when no coords confirmed */}
              {!(form.latitude && form.longitude) && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Maps link paste */}
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Paste Google Maps link
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                      Open Google Maps → find the shop → tap <strong>Share</strong> → <strong>Copy link</strong> → paste below.{' '}
                      If you get a short link, open it first and copy the full URL from the address bar.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={mapsLinkInput}
                        onChange={(e) => { setMapsLinkInput(e.target.value); setMapsLinkError(''); setParsedPreview(null); }}
                        className={inputCls + ' text-xs flex-1' + (mapsLinkError ? ' border-destructive' : '')}
                        placeholder="https://www.google.com/maps/place/..."
                      />
                      <button
                        type="button"
                        onClick={handleExtractFromLink}
                        disabled={!mapsLinkInput.trim()}
                        className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
                      >
                        Extract
                      </button>
                    </div>
                    {mapsLinkError && (
                      <p className="text-[11px] text-destructive mt-1.5 leading-relaxed">{mapsLinkError}</p>
                    )}
                  </div>

                  {/* Confirmation preview card */}
                  {parsedPreview && (
                    <div
                      className="rounded-lg px-3 py-2.5 space-y-2"
                      style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.25)' }}
                    >
                      <p className="text-xs font-semibold text-foreground">
                        📍 Found: {parsedPreview.lat.toFixed(6)}, {parsedPreview.lng.toFixed(6)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://www.google.com/maps?q=${parsedPreview.lat},${parsedPreview.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Verify on Maps
                        </a>
                        <span className="text-muted-foreground text-[11px]">·</span>
                        <button
                          type="button"
                          onClick={confirmLocation}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                        >
                          ✓ Use this location
                        </button>
                        <button
                          type="button"
                          onClick={() => { setParsedPreview(null); setMapsLinkError(''); }}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-medium">or use GPS</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* GPS button */}
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locating}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 border border-border"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                  >
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-primary" />}
                    {locating ? 'Getting GPS location…' : 'Use my GPS location'}
                  </button>
                </div>
              )}
            </div>
            {/* ── End location section ───────────────────────────────── */}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Opening Time">
                <input type="time" value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} className={inputCls} />
                {form.opening_time && <p className="text-xs text-muted-foreground mt-1">{formatTime(form.opening_time)}</p>}
              </Field>
              <Field label="Closing Time">
                <input type="time" value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} className={inputCls} />
                {form.closing_time && <p className="text-xs text-muted-foreground mt-1">{formatTime(form.closing_time)}</p>}
              </Field>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_open} onChange={(e) => set('is_open', e.target.checked)} className="w-4 h-4 accent-primary" />
                <span className="text-sm font-medium text-foreground">Manual Open Override</span>
                <span className="text-xs text-muted-foreground">(fallback when no times set)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="w-4 h-4 accent-primary" />
                <span className="text-sm font-medium text-foreground">Active (Visible)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_verified} onChange={(e) => set('is_verified', e.target.checked)} className="w-4 h-4 accent-primary" />
                <span className="text-sm font-medium text-foreground">Verified</span>
              </label>
            </div>

            <Field label="Shop Image">
              {form.image_url && (
                <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2 border border-border" />
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="text-sm text-muted-foreground" />
              {uploading && <p className="text-xs text-primary mt-1">Uploading...</p>}
            </Field>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving || uploading} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update Shop' : 'Add Shop'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate Phone Confirmation Dialog */}
      <Dialog open={!!dupePhoneShop} onOpenChange={(open) => { if (!open) { setDupePhoneShop(null); setPendingSave(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-secondary shrink-0" />
              Phone number already in use
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">This phone number is already registered to another shop. Please review before saving.</p>
                {dupePhoneShop && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shop Name</span>
                      <p className="font-semibold text-foreground">{dupePhoneShop.name}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</span>
                      <p className="text-foreground">{dupePhoneShop.phone}</p>
                    </div>
                    {dupePhoneShop.area && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area</span>
                        <p className="text-foreground">{dupePhoneShop.area}</p>
                      </div>
                    )}
                    {dupePhoneShop.categories.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categories</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dupePhoneShop.categories.map((c, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                              {c.icon} {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">Are you sure you want to add a second shop with the same phone number?</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => { setDupePhoneShop(null); setPendingSave(null); }}
              className="flex-1 py-2.5 border border-border rounded-lg font-semibold text-foreground hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAnyway}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Anyway'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── CATEGORY MODAL ─────────────────────────────────────────── */
function CategoryModal({ category, onClose, onSaved }: { category: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!category.id;
  const [form, setForm] = useState({ name: category.name || '', icon: category.icon || '🏪', is_active: category.is_active ?? true });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('categories').update({ ...form, name: form.name.trim() }).eq('id', category.id));
    } else {
      ({ error } = await supabase.from('categories').insert({ ...form, name: form.name.trim() }));
    }
    if (error) {
      toast.error('Failed to save category');
    } else {
      toast.success(isEdit ? 'Category updated!' : 'Category added!');
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">{isEdit ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Icon (Emoji)">
              <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className={inputCls + ' text-2xl'} maxLength={4} />
            </Field>
            <div className="col-span-2">
              <Field label="Category Name *">
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Grocery" maxLength={60} />
              </Field>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium text-foreground">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

/* ─── REQUESTS TAB ────────────────────────────────────────────── */

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface ShopRequest {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  area: string | null;
  category_text: string | null;
  opening_time: string | null;
  closing_time: string | null;
  image_url: string | null;
  submitter_name: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  maps_link: string | null;
}

function RequestsTab({ onShopCreated }: { onShopCreated: () => void }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('pending');
  const [viewRequest, setViewRequest] = useState<ShopRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // request id being acted on

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-requests', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('shop_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as ShopRequest[];
    },
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleApprove = async (req: ShopRequest) => {
    setActionLoading(req.id);

    // BUG-01: Duplicate phone check — normalize both sides using shared utility.
    const normPhone = normalizePhone(req.phone);
    const { data: allShops } = await supabase.from('shops').select('id, name, phone');
    const dupeShop = (allShops || []).find(
      (s) => s.phone && normalizePhone(s.phone) === normPhone
    );
    if (dupeShop) {
      toast.error(`Phone ${req.phone} is already registered to "${dupeShop.name}". Resolve before approving.`);
      setActionLoading(null);
      return;
    }

    // Find category id if category_text is set
    let resolvedCategoryId: string | null = null;
    if (req.category_text?.trim()) {
      const { data: catMatches } = await supabase
        .from('categories')
        .select('id, name')
        .ilike('name', req.category_text.trim());
      if (catMatches && catMatches.length > 0) {
        resolvedCategoryId = catMatches[0].id;
      }
    }

    // Normalize area (title case)
    // BUG-04: bilingual-safe title-case
    const normalizeArea = (s: string) =>
      s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

    // Insert shop
    const { data: inserted, error: insertError } = await supabase
      .from('shops')
      .insert({
        name: req.name.trim(),
        phone: normPhone,
        whatsapp: req.whatsapp?.trim() || null,
        address: req.address?.trim() || null,
        area: req.area?.trim() ? normalizeArea(req.area) : null,
        opening_time: req.opening_time || null,
        closing_time: req.closing_time || null,
        image_url: req.image_url || null,
        latitude: req.latitude || null,
        longitude: req.longitude || null,
        is_active: true,
        is_open: true,
        is_verified: false,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      toast.error('Failed to create shop. ' + (insertError?.message || ''));
      setActionLoading(null);
      return;
    }

    // Link category if resolved
    if (resolvedCategoryId) {
      await supabase.from('shop_categories').insert({
        shop_id: inserted.id,
        category_id: resolvedCategoryId,
      });
    }

    // Update request status
    await supabase.from('shop_requests').update({ status: 'approved' }).eq('id', req.id);

    toast.success(`"${req.name}" has been approved and added to the shop directory.`);
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    qc.invalidateQueries({ queryKey: ['shops'] }); // BUG-09: invalidate public queries
    onShopCreated();
    setViewRequest(null);
    setActionLoading(null);
  };

  const handleReject = async (req: ShopRequest) => {
    setActionLoading(req.id);
    const { error } = await supabase
      .from('shop_requests')
      .update({ status: 'rejected' })
      .eq('id', req.id);
    if (error) {
      toast.error('Failed to reject request');
    } else {
      toast.success(`Request from "${req.name}" has been rejected.`);
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    }
    setViewRequest(null);
    setActionLoading(null);
  };

  const handleDelete = async (req: ShopRequest) => {
    setActionLoading(req.id);
    const { error } = await supabase.from('shop_requests').delete().eq('id', req.id);
    if (error) {
      toast.error('Failed to delete request');
      setActionLoading(null);
      return;
    }
    // DB deleted — now attempt storage cleanup (non-blocking, safe)
    if (req.image_url) {
      const path = extractStoragePath(req.image_url);
      if (path) {
        const { error: storageErr } = await supabase.storage.from('shop-images').remove([path]);
        if (storageErr) {
          toast.warning('Request deleted, but its image could not be removed from storage.');
        }
      }
    }
    toast.success('Request deleted');
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    setViewRequest(null);
    setActionLoading(null);
  };

  const statusBadge = (status: RequestStatus) => {
    if (status === 'pending') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary border border-secondary/30">⏳ Pending</span>;
    if (status === 'approved') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">✅ Approved</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">❌ Rejected</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Listing Requests</h2>
          {statusFilter === 'pending' && pendingCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{pendingCount} pending review</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {(['pending', 'approved', 'rejected', 'all'] as (RequestStatus | 'all')[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                  statusFilter === opt
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {/* Export CSV */}
          <button
            onClick={() => {
              const headers = ['Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Category', 'Status', 'Submitter', 'Opening Time', 'Closing Time', 'Has Image', 'Submitted At'];
              const rows = (requests as any[]).map((req) => [
                req.name, req.phone, req.whatsapp ?? '', req.area ?? '', req.address ?? '',
                req.category_text ?? '', req.status, req.submitter_name ?? '',
                req.opening_time ?? '', req.closing_time ?? '',
                req.image_url ? 'Yes' : 'No',
                new Date(req.created_at).toLocaleDateString('en-IN'),
              ]);
              const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `muktainagar-requests-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-muted-foreground">
            {statusFilter === 'pending' ? 'No pending requests' : `No ${statusFilter} requests`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter === 'pending' ? 'Submissions from the public form will appear here.' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Area</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{req.name}</div>
                      {req.phone && <div className="text-xs text-muted-foreground">{req.phone}</div>}
                      {req.submitter_name && <div className="text-xs text-muted-foreground italic">by {req.submitter_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-sm">{req.area || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm">{req.category_text || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewRequest(req)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading === req.id}
                              className="p-1.5 hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                              style={{ color: 'hsl(var(--success))' }}
                            >
                              {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleReject(req)}
                              disabled={actionLoading === req.id}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(req)}
                          disabled={actionLoading === req.id}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Request Detail Dialog */}
      {viewRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground">{viewRequest.name}</h3>
                <div className="mt-1">{statusBadge(viewRequest.status)}</div>
              </div>
              <button onClick={() => setViewRequest(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {viewRequest.image_url && (
                <img src={viewRequest.image_url} alt="Shop" className="w-full h-40 object-cover rounded-xl border border-border mb-2" />
              )}

              {[
                { label: 'Phone', value: viewRequest.phone },
                { label: 'WhatsApp', value: viewRequest.whatsapp },
                { label: 'Area', value: viewRequest.area },
                { label: 'Address', value: viewRequest.address },
                { label: 'Category', value: viewRequest.category_text },
                { label: 'Opening', value: viewRequest.opening_time ? formatTime(viewRequest.opening_time) : null },
                { label: 'Closing', value: viewRequest.closing_time ? formatTime(viewRequest.closing_time) : null },
                { label: 'Submitted by', value: viewRequest.submitter_name },
                { label: 'Submitted on', value: new Date(viewRequest.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-foreground break-words">{value}</span>
                  </div>
                ) : null
              )}

              {/* Location row — clickable Maps link */}
              {(viewRequest.latitude && viewRequest.longitude) ? (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">Location</span>
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`https://www.google.com/maps?q=${viewRequest.latitude},${viewRequest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Open in Maps ↗
                    </a>
                    <span className="text-xs text-muted-foreground font-mono">
                      {viewRequest.latitude.toFixed(5)}, {viewRequest.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>
              ) : viewRequest.maps_link ? (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">Location</span>
                  <a
                    href={viewRequest.maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    Open in Maps ↗
                  </a>
                </div>
              ) : null}
            </div>

            {viewRequest.status === 'pending' && (
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => handleReject(viewRequest)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-destructive hover:bg-destructive/5 transition-colors text-sm disabled:opacity-50"
                >
                  {actionLoading === viewRequest.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reject'}
                </button>
                <button
                  onClick={() => handleApprove(viewRequest)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'hsl(var(--success))', color: 'hsl(var(--success-foreground))' }}
                >
                  {actionLoading === viewRequest.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</> : '✅ Approve & Publish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CSV IMPORT MODAL ────────────────────────────────────────── */


type ImportRowStatus = 'ready' | 'warning' | 'error' | 'duplicate';

interface ImportRow {
  // raw parsed fields
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  area: string;
  category: string;
  opening_time: string;
  closing_time: string;
  latitude: string;
  longitude: string;
  is_active: string;
  is_verified: string;
  // computed
  status: ImportRowStatus;
  messages: string[];
  resolvedCategoryId: string | null;
}

/** Robust quoted-CSV parser — handles double-quoted fields with embedded commas/newlines */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse full CSV text into an array of header-keyed objects */
function parseCsv(text: string): Record<string, string>[] {
  // Normalise CRLF → LF, then split on LF
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
    return obj;
  });
}

const CSV_TEMPLATE_HEADERS = [
  'name', 'phone', 'whatsapp', 'address', 'area',
  'category', 'opening_time', 'closing_time',
  'latitude', 'longitude', 'is_active', 'is_verified',
];

const CSV_TEMPLATE_EXAMPLE = [
  'Sharma General Store', '9876543210', '9876543210',
  'Near Bus Stand Station Road', 'Main Road',
  'Grocery', '09:00', '21:00',
  '21.0325', '75.6920', 'true', 'false',
];

function downloadTemplate() {
  const rows = [CSV_TEMPLATE_HEADERS.join(','), CSV_TEMPLATE_EXAMPLE.join(',')].join('\n');
  const blob = new Blob([rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'muktainagar_shops_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type ImportStep = 'upload' | 'preview' | 'result';

interface ImportResult {
  imported: number;
  importedWithWarnings: number;
  skippedDupes: number;
  skippedErrors: number;
  failedInserts: number;
}

function CsvImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch categories once on mount
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // ── Core processing logic ──────────────────────────────────────────────────
  const processText = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) {
      toast.error('CSV has no data rows or is malformed');
      setParsing(false);
      return;
    }

    // Fetch all existing phones for dupe detection
    const { data: existingShops } = await supabase.from('shops').select('phone');
    const existingPhones = new Set(
      (existingShops || [])
        .map((s: any) => s.phone ? normalizePhone(s.phone) : '')
        .filter(Boolean)
    );

    // Build category map: normalised name → id
    const catMap = new Map<string, string>();
    categories.forEach((c: any) => {
      catMap.set(c.name.toLowerCase().trim(), c.id);
    });

    // Track phones seen within this CSV to detect intra-file dupes
    const seenPhones = new Set<string>();

    const processed: ImportRow[] = rawRows.map((raw) => {
      const name = (raw['name'] || '').trim();
      const phone = (raw['phone'] || '').trim();
      const whatsapp = (raw['whatsapp'] || '').trim();
      const address = (raw['address'] || '').trim();
      const area = (raw['area'] || '').trim();
      const category = (raw['category'] || '').trim();
      const opening_time = (raw['opening_time'] || '').trim();
      const closing_time = (raw['closing_time'] || '').trim();
      const latitude = (raw['latitude'] || '').trim();
      const longitude = (raw['longitude'] || '').trim();
      const is_active = (raw['is_active'] || '').trim();
      const is_verified = (raw['is_verified'] || '').trim();

      const messages: string[] = [];
      let status: ImportRowStatus = 'ready';

      // ── Blocking errors ──────────────────────────────────────
      if (!name) {
        messages.push('Shop name is required');
        status = 'error';
      }
      if (!phone) {
        messages.push('Phone number is required');
        status = 'error';
      } else if (!isValidPhone(phone)) {
        messages.push('Phone must be at least 10 digits');
        status = 'error';
      }
      if (latitude && (isNaN(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) {
        messages.push('Latitude must be between -90 and 90');
        status = 'error';
      }
      if (longitude && (isNaN(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) {
        messages.push('Longitude must be between -180 and 180');
        status = 'error';
      }

      // Area + address: both empty is a blocking error
      if (!area && !address) {
        messages.push('Area or address is required');
        status = 'error';
      }

      // ── Duplicate detection ───────────────────────────────────
      if (status !== 'error' && phone) {
        const norm = normalizePhone(phone);
        if (existingPhones.has(norm)) {
          messages.push('Phone already exists in database');
          status = 'duplicate';
        } else if (seenPhones.has(norm)) {
          messages.push('Duplicate phone number within this CSV');
          status = 'duplicate';
        } else {
          seenPhones.add(norm);
        }
      }

      // ── Warnings (non-blocking) ───────────────────────────────
      if (status !== 'error' && status !== 'duplicate') {
        if (whatsapp && !isValidPhone(whatsapp)) {
          messages.push('WhatsApp number appears invalid — will be skipped');
          status = 'warning';
        }
      }

      // ── Category mapping ──────────────────────────────────────
      let resolvedCategoryId: string | null = null;
      if (category) {
        resolvedCategoryId = catMap.get(category.toLowerCase().trim()) ?? null;
        if (!resolvedCategoryId && status !== 'error' && status !== 'duplicate') {
          messages.push(`Category "${category}" not found — will import without category`);
          status = 'warning';
        }
      }

      if (status === 'ready' && messages.length === 0) {
        messages.push('Ready to import');
      }

      return {
        name, phone, whatsapp, address, area, category,
        opening_time, closing_time, latitude, longitude, is_active, is_verified,
        status, messages, resolvedCategoryId,
      };
    });

    setRows(processed);
    setParsing(false);
    setStep('preview');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a .csv file');
      return;
    }
    setParsing(true);
    const csvText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
    await processText(csvText);
  };


  const importableRows = rows.filter((r) => r.status === 'ready' || r.status === 'warning');
  const dupeRows = rows.filter((r) => r.status === 'duplicate');
  const errorRows = rows.filter((r) => r.status === 'error');

  // BUG-04: bilingual-safe title-case regex
  const normalizeArea = (s: string) =>
    s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    let importedWithWarnings = 0;
    let failedInserts = 0;

    for (const row of importableRows) {
      const payload: any = {
        name: row.name,
        phone: row.phone || null,
        whatsapp: row.whatsapp ? normalizeWhatsApp(row.whatsapp) : null,
        address: row.address || null,
        area: row.area ? normalizeArea(row.area) : null,
        opening_time: row.opening_time || null,
        closing_time: row.closing_time || null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        is_active: row.is_active !== '' ? row.is_active.toLowerCase() === 'true' : true,
        is_verified: row.is_verified !== '' ? row.is_verified.toLowerCase() === 'true' : false,
        is_open: true,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('shops')
        .insert(payload)
        .select('id')
        .single();

      if (insertErr || !inserted) {
        failedInserts++;
        continue;
      }

      if (row.resolvedCategoryId) {
        await supabase.from('shop_categories').insert({
          shop_id: inserted.id,
          category_id: row.resolvedCategoryId,
        });
      }

      if (row.status === 'warning') {
        importedWithWarnings++;
      } else {
        imported++;
      }
    }

    setResult({
      imported,
      importedWithWarnings,
      skippedDupes: dupeRows.length,
      skippedErrors: errorRows.length,
      failedInserts,
    });
    setImporting(false);
    setStep('result');
  };

  const statusConfig: Record<ImportRowStatus, { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }> = {
    ready: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Ready',
      rowCls: '',
      badgeCls: 'bg-success/10 text-success border border-success/30',
    },
    warning: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'Warning',
      rowCls: 'bg-secondary/5',
      badgeCls: 'bg-secondary/10 text-secondary border border-secondary/30',
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: 'Error',
      rowCls: 'bg-destructive/5',
      badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30',
    },
    duplicate: {
      icon: <SkipForward className="w-3.5 h-3.5" />,
      label: 'Duplicate',
      rowCls: 'bg-muted/60',
      badgeCls: 'bg-muted text-muted-foreground border border-border',
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-3xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg text-foreground">Import Shops from CSV</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="p-6 space-y-6">
            {/* Instructions */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Fill in your shop data — one shop per row</li>
                <li>Upload the file and review the preview</li>
                <li>Import only valid rows</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Only simple CSV format is supported (UTF-8, comma-separated). Quoted fields are supported. Images cannot be imported via CSV.
              </p>
            </div>

            {/* Column reference */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Expected columns</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold text-foreground">Column</th>
                      <th className="text-left px-3 py-2 font-semibold text-foreground">Required</th>
                      <th className="text-left px-3 py-2 font-semibold text-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ['name', '✅ Required', 'Shop display name'],
                      ['phone', '✅ Required', 'At least 10 digits'],
                      ['whatsapp', 'Optional', 'Leave blank if same as phone'],
                      ['address', 'One of area/address required', 'Full street address'],
                      ['area', 'One of area/address required', 'Locality / neighbourhood'],
                      ['category', 'Optional', 'Must match an existing category name exactly'],
                      ['opening_time', 'Optional', 'Format: HH:MM (24h), e.g. 09:00'],
                      ['closing_time', 'Optional', 'Format: HH:MM (24h), e.g. 21:00'],
                      ['latitude', 'Optional', 'Decimal degrees, -90 to 90'],
                      ['longitude', 'Optional', 'Decimal degrees, -180 to 180'],
                      ['is_active', 'Optional', 'true or false (default: true)'],
                      ['is_verified', 'Optional', 'true or false (default: false)'],
                    ].map(([col, req, note]) => (
                      <tr key={col} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono font-semibold text-foreground">{col}</td>
                        <td className="px-3 py-2">{req}</td>
                        <td className="px-3 py-2">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template CSV
              </button>
              <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer">
                {parsing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Choose CSV File</>
                )}
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" disabled={parsing} />
              </label>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="p-6 space-y-4">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'ready').length} Ready
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/30">
                <AlertTriangle className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'warning').length} Warning
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                <AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} Error
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                <SkipForward className="w-3.5 h-3.5" /> {dupeRows.length} Duplicate
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {importableRows.length > 0
                ? `${importableRows.length} row${importableRows.length !== 1 ? 's' : ''} will be imported. Errors and duplicates are skipped.`
                : 'No valid rows to import. Please fix errors or upload a new file.'}
            </p>

            {/* Preview table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/80 border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground w-8">#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Name</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden sm:table-cell">Phone</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden md:table-cell">Area</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground hidden lg:table-cell">Category</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const cfg = statusConfig[row.status];
                      return (
                        <tr key={idx} className={`border-b border-border last:border-0 ${cfg.rowCls}`}>
                          <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-foreground">{row.name || <span className="text-destructive italic">missing</span>}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {row.messages.filter(m => m !== 'Ready to import').map((m, i) => (
                                <span key={i} className="block">{m}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{row.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{row.area || row.address || '—'}</td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            {row.resolvedCategoryId ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                                {row.category}
                              </span>
                            ) : row.category ? (
                              <span className="text-xs text-muted-foreground italic">{row.category} (unmatched)</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeCls}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => { setRows([]); setStep('upload'); }}
                className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importableRows.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                  : `Import ${importableRows.length} Shop${importableRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-bold text-foreground text-lg">Import complete</p>
                <p className="text-sm text-muted-foreground">Here's a summary of what happened.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              {[
                { label: 'Imported successfully', value: result.imported, icon: '✅' },
                { label: 'Imported with warnings', value: result.importedWithWarnings, icon: '🟡' },
                { label: 'Skipped — duplicate phone', value: result.skippedDupes, icon: '🔁' },
                { label: 'Skipped — validation errors', value: result.skippedErrors, icon: '❌' },
                { label: 'Failed (database error)', value: result.failedInserts, icon: '⚠️' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <span>{icon}</span> {label}
                  </span>
                  <span className={`font-bold text-sm ${value > 0 && label.startsWith('Imported') ? 'text-success' : value > 0 && !label.startsWith('Imported') ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={onDone}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Close & Refresh Shops
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

