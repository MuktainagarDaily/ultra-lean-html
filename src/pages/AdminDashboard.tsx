import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, Pencil, Trash2, LogOut, Store, Tag, Eye, EyeOff, MapPin, X, Check
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'shops' | 'categories';

function formatAdminTime(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

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

  return (
    <div className="min-h-screen bg-muted">
      {/* Top Bar */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-5 h-5 shrink-0" />
          <span className="font-bold text-base sm:text-lg truncate">Muktainagar Daily — Admin</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            🏠 <span className="hidden sm:inline">Client Site</span>
          </button>
          <span className="text-xs text-primary-foreground/70 hidden md:block truncate max-w-[140px]">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <TabButton active={tab === 'shops'} onClick={() => setTab('shops')} icon={<Store className="w-4 h-4" />} label="Shops" />
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={<Tag className="w-4 h-4" />} label="Categories" />
        </div>

        {tab === 'shops' && (
          <ShopsTab onEdit={(shop) => setShopForm(shop)} />
        )}
        {tab === 'categories' && (
          <CategoriesTab onEdit={(cat) => setCategoryForm(cat)} />
        )}
      </div>

      {/* Shop Modal */}
      {shopForm !== null && (
        <ShopModal
          shop={shopForm}
          onClose={() => setShopForm(null)}
          onSaved={() => { setShopForm(null); qc.invalidateQueries({ queryKey: ['admin-shops'] }); }}
        />
      )}

      {/* Category Modal */}
      {categoryForm !== null && (
        <CategoryModal
          category={categoryForm}
          onClose={() => setCategoryForm(null)}
          onSaved={() => { setCategoryForm(null); qc.invalidateQueries({ queryKey: ['admin-categories'] }); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border'
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ─── SHOPS TAB ─────────────────────────────────────────────── */
function ShopsTab({ onEdit }: { onEdit: (shop: any) => void }) {
  const qc = useQueryClient();

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('shops').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });

  const deleteShop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Shop deleted');
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Shops ({shops.length})</h2>
        <button
          onClick={() => onEdit({})}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Shop
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden md:table-cell">Area</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{shop.name}</div>
                      {shop.phone && <div className="text-xs text-muted-foreground">{shop.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {shop.categories?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {shop.area || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive.mutate({ id: shop.id, is_active: !shop.is_active })}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          shop.is_active
                            ? 'bg-success/10 text-success border border-success/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {shop.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(shop)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this shop?')) deleteShop.mutate(shop.id); }}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shops.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No shops yet. Add your first shop!
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

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Category deleted');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

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
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
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
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        cat.is_active
                          ? 'bg-success/10 text-success border border-success/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {cat.is_active ? <><Check className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Disabled</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(cat)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this category?')) deleteCategory.mutate(cat.id); }}
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
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">No categories yet.</td>
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
function ShopModal({ shop, onClose, onSaved }: { shop: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!shop.id;
  const [form, setForm] = useState({
    name: shop.name || '',
    category_id: shop.category_id || '',
    phone: shop.phone || '',
    whatsapp: shop.whatsapp || '',
    address: shop.address || '',
    area: shop.area || '',
    opening_time: shop.opening_time || '',
    closing_time: shop.closing_time || '',
    is_open: shop.is_open ?? true,
    is_active: shop.is_active ?? true,
    image_url: shop.image_url || '',
    latitude: shop.latitude?.toString() || '',
    longitude: shop.longitude?.toString() || '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

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
    setSaving(true);
    const payload = {
      ...form,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      category_id: form.category_id || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('shops').update(payload).eq('id', shop.id));
    } else {
      ({ error } = await supabase.from('shops').insert(payload));
    }
    if (error) {
      toast.error('Failed to save shop');
    } else {
      toast.success(isEdit ? 'Shop updated!' : 'Shop added!');
      onSaved();
    }
    setSaving(false);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">{isEdit ? 'Edit Shop' : 'Add New Shop'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <Field label="Shop Name *">
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Sharma General Store" />
          </Field>
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputCls}>
              <option value="">— Select category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="+91 9876543210" />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} placeholder="+91 9876543210" />
            </Field>
          </div>
          <Field label="Address">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="Full address" />
          </Field>
          <Field label="Area / Locality">
            <input value={form.area} onChange={(e) => set('area', e.target.value)} className={inputCls} placeholder="e.g. Main Road, Ward 5" />
          </Field>

          {/* Google Maps Location */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              📍 Location (Google Maps Pin)
            </label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                  className={inputCls}
                  placeholder="Latitude e.g. 21.0325"
                />
              </div>
              <div>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                  className={inputCls}
                  placeholder="Longitude e.g. 75.6920"
                />
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent((form.name || '') + ' ' + (form.area || '') + ' Muktainagar')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              🗺️ Search on Google Maps to find coordinates → right-click the pin → copy lat/lng
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Opening Time">
              <input type="time" value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} className={inputCls} />
              {form.opening_time && <p className="text-xs text-muted-foreground mt-1">{formatAdminTime(form.opening_time)}</p>}
            </Field>
            <Field label="Closing Time">
              <input type="time" value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} className={inputCls} />
              {form.closing_time && <p className="text-xs text-muted-foreground mt-1">{formatAdminTime(form.closing_time)}</p>}
            </Field>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_open} onChange={(e) => set('is_open', e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-sm font-medium text-foreground">Currently Open</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-sm font-medium text-foreground">Active (Visible)</span>
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
    setSaving(true);
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('categories').update(form).eq('id', category.id));
    } else {
      ({ error } = await supabase.from('categories').insert(form));
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
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Grocery" />
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
