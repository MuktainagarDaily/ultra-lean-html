import { useState } from 'react';
import { X, Loader2, CheckCircle2, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatTime } from '@/lib/shopUtils';

/* ── helpers (mirrors AdminDashboard patterns) ─────────────────── */
function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

function normalizeArea(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ── component ─────────────────────────────────────────────────── */
interface Props {
  onClose: () => void;
}

export function RequestListingModal({ onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    area: '',
    category_text: '',
    opening_time: '',
    closing_time: '',
    submitter_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [done, setDone] = useState(false);

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

  const set = (key: string, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

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
    if (!form.area.trim() && !form.address.trim()) {
      errs.area = 'Area or address is required';
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
    const path = `request-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from('shop-images')
      .upload(path, compressed, { upsert: true, contentType: 'image/webp' });
    if (error) {
      toast.error('Image upload failed');
    } else {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const { error } = await supabase.from('shop_requests').insert({
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      whatsapp: form.whatsapp.trim() ? form.whatsapp.replace(/\D/g, '') : null,
      address: form.address.trim() || null,
      area: form.area.trim() ? normalizeArea(form.area) : null,
      category_text: form.category_text.trim() || null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      image_url: imageUrl || null,
      submitter_name: form.submitter_name.trim() || null,
      status: 'pending',
    });

    setSaving(false);
    if (error) {
      toast.error('Submission failed. Please try again.');
      return;
    }
    setDone(true);
  };

  /* ── Success screen ───────────────────────────────────────────── */
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl p-8 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: 'hsl(var(--success))' }} />
          <h2 className="text-xl font-bold text-foreground mb-2">Request Submitted!</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Thank you! Your listing request has been received.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Our team will review the details and your shop will appear on Muktainagar Daily once approved — usually within 1–2 business days.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-bold text-lg text-foreground">List Your Shop</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div
          className="mx-6 mt-5 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}
        >
          <p className="font-semibold text-foreground mb-0.5">Free listing, reviewed by our team</p>
          <p className="text-muted-foreground text-xs">
            Fill in your shop details below. Our admin will review your request and publish it within 1–2 business days.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Shop Name */}
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

          {/* Phone + WhatsApp */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone Number *">
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
            </Field>
          </div>

          {/* Address */}
          <Field label="Address (Street / Landmark)">
            <input
              value={form.address}
              onChange={(e) => { set('address', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
              className={inputCls}
              placeholder="e.g. Near Bus Stand, Station Road"
              maxLength={250}
            />
          </Field>

          {/* Area */}
          <Field label="Area / Locality *">
            <input
              value={form.area}
              onChange={(e) => { set('area', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
              className={inputCls + (errors.area ? ' border-destructive' : '')}
              placeholder="e.g. Main Road, Muktainagar"
              list="req-common-areas"
              maxLength={100}
            />
            <datalist id="req-common-areas">
              <option value="Main Road" />
              <option value="Station Road" />
              <option value="Bus Stand Area" />
              <option value="Market Area" />
              <option value="Ward 1" /><option value="Ward 2" /><option value="Ward 3" />
              <option value="Ward 4" /><option value="Ward 5" />
            </datalist>
            {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
          </Field>

          {/* Category */}
          <Field label="Category (optional)">
            {categories.length > 0 ? (
              <select
                value={form.category_text}
                onChange={(e) => set('category_text', e.target.value)}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={form.category_text}
                onChange={(e) => set('category_text', e.target.value)}
                className={inputCls}
                placeholder="e.g. Grocery, Medical, Electronics"
                maxLength={80}
              />
            )}
          </Field>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Opening Time (optional)">
              <input
                type="time"
                value={form.opening_time}
                onChange={(e) => set('opening_time', e.target.value)}
                className={inputCls}
              />
              {form.opening_time && (
                <p className="text-xs text-muted-foreground mt-1">{formatTime(form.opening_time)}</p>
              )}
            </Field>
            <Field label="Closing Time (optional)">
              <input
                type="time"
                value={form.closing_time}
                onChange={(e) => set('closing_time', e.target.value)}
                className={inputCls}
              />
              {form.closing_time && (
                <p className="text-xs text-muted-foreground mt-1">{formatTime(form.closing_time)}</p>
              )}
            </Field>
          </div>

          {/* Shop image */}
          <Field label="Shop Photo (optional)">
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2 border border-border" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="text-sm text-muted-foreground"
            />
            {uploading && <p className="text-xs text-primary mt-1">Uploading…</p>}
          </Field>

          {/* Submitter name */}
          <Field label="Your Name (optional)">
            <input
              value={form.submitter_name}
              onChange={(e) => set('submitter_name', e.target.value)}
              className={inputCls}
              placeholder="So we can follow up if needed"
              maxLength={80}
            />
          </Field>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
