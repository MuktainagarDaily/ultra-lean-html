import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Search, Filter, Loader2, ShieldCheck, ShieldOff, Upload, Download, ExternalLink, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ShopsTabProps {
  onEdit: (shop: any) => void;
  onImport: () => void;
  onSpeedAdd: () => void;
}

export function ShopsTab({ onEdit, onImport, onSpeedAdd }: ShopsTabProps) {
  const qc = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
        s.name ?? '', s.phone ?? '', s.whatsapp ?? '', s.area ?? '',
        s.address ?? '', cats, s.is_active ? 'Yes' : 'No', s.is_verified ? 'Yes' : 'No',
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
          <button onClick={onImport} className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={onSpeedAdd} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-secondary/90 shrink-0">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Speed Add</span>
          </button>
          <button onClick={() => onEdit({})} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary/90 shrink-0">
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
                  const cats = shop.shop_categories?.map((sc: any) => sc.categories).filter(Boolean) || [];
                  return (
                    <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {shop.name}
                          {shop.is_verified && <span title="Verified"><ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" /></span>}
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
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm">{shop.area || '—'}</td>
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
                          <a
                            href={`/shop/${shop.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Preview public page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button onClick={() => onEdit(shop)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: shop.id, name: shop.name })} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
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
                      {searchText || categoryFilter ? 'No shops match current filters' : 'No shops yet. Add your first shop!'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              {deleteShop.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Shop'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
