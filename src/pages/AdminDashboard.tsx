import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, Pencil, Trash2, LogOut, Store, Tag, Eye, EyeOff, MapPin, X, Check, Search, Home, ShieldCheck, ShieldOff, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTime } from '@/lib/shopUtils';

type Tab = 'shops' | 'categories';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('shops');
  const [shopForm, setShopForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Stats query — includes verified count
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [{ count: total }, { count: active }, { count: cats }, { count: verified }] = await Promise.all([
        supabase.from('shops').select('id', { count: 'exact', head: true }),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      ]);
      return { total: total || 0, active: active || 0, cats: cats || 0, verified: verified || 0 };
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
          <span className="text-xs text-primary-foreground/70 hidden md:block truncate max-w-[140px]">{user?.email}</span>
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
          <div className="grid grid-cols-4 gap-3 mb-5">
            <StatCard label="Total Shops" value={stats.total} icon="🏪" />
            <StatCard label="Active" value={stats.active} icon="✅" />
            <StatCard label="Verified" value={stats.verified} icon="🛡️" />
            <StatCard label="Categories" value={stats.cats} icon="🏷️" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <TabButton active={tab === 'shops'} onClick={() => setTab('shops')} icon={<Store className="w-4 h-4" />} label="Shops" />
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={<Tag className="w-4 h-4" />} label="Categories" />
        </div>

        {tab === 'shops' && <ShopsTab onEdit={(shop) => setShopForm(shop)} />}
        {tab === 'categories' && <CategoriesTab onEdit={(cat) => setCategoryForm(cat)} />}
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
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-card rounded-xl border border-border px-2 py-3 text-center">
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:text-foreground border border-border'
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ─── SHOPS TAB ─────────────────────────────────────────────── */
function ShopsTab({ onEdit }: { onEdit: (shop: any) => void }) {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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
          s.phone?.includes(q)
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
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

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
              placeholder="Search name, area, phone..."
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
                            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" title="Verified" />
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
                            onClick={() => { if (confirm(`Delete "${shop.name}"?`)) deleteShop.mutate(shop.id); }}
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
    </div>
  );
}

/* ─── CATEGORIES TAB ─────────────────────────────────────────── */
function CategoriesTab({ onEdit }: { onEdit: (cat: any) => void }) {
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  const handleDeleteCategory = async (cat: { id: string; name: string }) => {
    // Count linked shops before deleting
    const { count } = await supabase
      .from('shop_categories')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', cat.id);

    const linkedCount = count || 0;
    const msg = linkedCount > 0
      ? `Delete "${cat.name}"? This will unlink it from ${linkedCount} shop${linkedCount > 1 ? 's' : ''}. The shops themselves will not be deleted.`
      : `Delete "${cat.name}"?`;

    if (confirm(msg)) {
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) {
        toast.error('Failed to delete category');
      } else {
        toast.success('Category deleted');
        qc.invalidateQueries({ queryKey: ['admin-categories'] });
        qc.invalidateQueries({ queryKey: ['admin-stats'] });
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Categories ({categories.length})</h2>
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
                <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-2xl">{cat.icon}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{cat.name}</td>
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
                      <button
                        onClick={() => onEdit(cat)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-muted-foreground">No categories yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── SHOP MODAL ─────────────────────────────────────────────── */

/** Normalize phone for duplicate detection: strip spaces, dashes, parens; keep + and digits */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

function ShopModal({ shop, onClose, onSaved }: { shop: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!shop.id;
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

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  useQuery({
    queryKey: ['shop-categories', shop.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('category_id')
        .eq('shop_id', shop.id);
      if (error) throw error;
      setSelectedCategoryIds(data.map((r: any) => r.category_id));
      return data;
    },
    enabled: !!shop.id,
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Shop name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    if (!form.area.trim() && !form.address.trim()) errs.area = 'Area or address is required';
    if (form.latitude && isNaN(parseFloat(form.latitude))) errs.latitude = 'Invalid latitude';
    if (form.longitude && isNaN(parseFloat(form.longitude))) errs.longitude = 'Invalid longitude';
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
        canvas.toBlob((blob) => resolve(blob!), 'image/webp', quality);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    // Duplicate phone detection (new shops only, or edit if phone changed)
    const normalizedPhone = normalizePhone(form.phone);
    if (normalizedPhone) {
      let query = supabase
        .from('shops')
        .select('id, name')
        .limit(5);

      // Check all stored phones for normalization match
      const { data: allPhones } = await supabase.from('shops').select('id, name, phone');
      const duplicate = allPhones?.find(
        (s) => s.id !== shop.id && s.phone && normalizePhone(s.phone) === normalizedPhone
      );
      if (duplicate) {
        toast.warning(`⚠️ Phone already used by "${duplicate.name}" — saving anyway`);
      }
      void query; // silence unused warning
    }

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      area: form.area.trim() || null,
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
    onSaved();
    setSaving(false);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">{isEdit ? 'Edit Shop' : 'Add New Shop'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone *">
              <input
                value={form.phone}
                onChange={(e) => { set('phone', e.target.value); setErrors((err) => ({ ...err, phone: '' })); }}
                className={inputCls + (errors.phone ? ' border-destructive' : '')}
                placeholder="+91 9876543210"
                maxLength={20}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} placeholder="+91 9876543210" maxLength={20} />
            </Field>
          </div>

          <Field label="Address">
            <input value={form.address} onChange={(e) => { set('address', e.target.value); setErrors((err) => ({ ...err, area: '' })); }} className={inputCls} placeholder="Full address" maxLength={250} />
          </Field>
          <Field label="Area / Locality *">
            <input
              value={form.area}
              onChange={(e) => { set('area', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
              className={inputCls + (errors.area ? ' border-destructive' : '')}
              placeholder="e.g. Main Road, Ward 5"
              maxLength={100}
            />
            {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
          </Field>

          {/* GPS Coordinates */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              📍 Location (GPS Coordinates)
            </label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <input type="number" step="any" value={form.latitude} onChange={(e) => { set('latitude', e.target.value); setErrors((err) => ({ ...err, latitude: '' })); }} className={inputCls + (errors.latitude ? ' border-destructive' : '')} placeholder="Latitude e.g. 21.0325" />
                {errors.latitude && <p className="text-xs text-destructive mt-1">{errors.latitude}</p>}
              </div>
              <div>
                <input type="number" step="any" value={form.longitude} onChange={(e) => { set('longitude', e.target.value); setErrors((err) => ({ ...err, longitude: '' })); }} className={inputCls + (errors.longitude ? ' border-destructive' : '')} placeholder="Longitude e.g. 75.6920" />
                {errors.longitude && <p className="text-xs text-destructive mt-1">{errors.longitude}</p>}
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent((form.name || '') + ' ' + (form.area || '') + ' Muktainagar')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              🗺️ Find on Google Maps → right-click pin → copy lat/lng
            </a>
          </div>

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
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update Shop' : 'Add Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add'}
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
