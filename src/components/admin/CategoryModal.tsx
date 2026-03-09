import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { inputCls } from './adminHelpers';

interface CategoryModalProps {
  category: any;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryModal({ category, onClose, onSaved }: CategoryModalProps) {
  const isEdit = !!category.id;
  const [form, setForm] = useState({ name: category.name || '', icon: category.icon || '🏪', is_active: category.is_active ?? true });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Category name is required'); return; }
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
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Icon (Emoji)</label>
              <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className={inputCls + ' text-2xl'} maxLength={4} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-1.5">Category Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Grocery" maxLength={60} />
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
