import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Check, EyeOff, Loader2, AlertTriangle, Download, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryMergeModal } from './CategoryMergeModal';

interface CategoriesTabProps {
  onEdit: (cat: any) => void;
}

export function CategoriesTab({ onEdit }: CategoriesTabProps) {
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
    const { data } = await supabase.from('shop_categories').select('shops(name)').eq('category_id', cat.id);
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
        <div className="flex gap-2">
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
                      (cat as any).shopCount > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
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
                      <button onClick={() => onEdit(cat)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
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
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
