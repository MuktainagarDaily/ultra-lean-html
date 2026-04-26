import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, MapPin, Link2, Navigation, ExternalLink, AlertTriangle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/shopUtils';
import { compressImage } from '@/lib/imageUtils';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import { extractStoragePath, normalizeWhatsApp, isValidPhone, inputCls } from './adminHelpers';
import { uploadShopImage, renameShopImage } from '@/lib/storageNaming';
import { TimePickerField } from '@/components/shared/TimePickerField';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { DEV_AUTOFILL, DUMMY_SHOP_DATA } from '@/lib/devHelpers';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type DupeShopInfo = {
  id: string; name: string; phone: string; area: string | null;
  categories: { name: string; icon: string }[];
};

interface ShopModalProps { shop: any; onClose: () => void; onSaved: () => void; }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function ShopModal({ shop, onClose, onSaved }: ShopModalProps) {
  const isEdit = !!shop.id;
  const oldImageUrl = useRef<string>(shop.image_url || '');

  const [form, setForm] = useState({
    name:         shop.name || '',
    phone:        shop.phone || '',
    whatsapp:     shop.whatsapp || '',
    address:      shop.address || '',
    area:         shop.area || '',
    sub_area:     shop.sub_area || '',
    description:  shop.description || '',
    keywords:     shop.keywords || '',
    opening_time: shop.opening_time || '',
    closing_time: shop.closing_time || '',
    is_open:      shop.is_open ?? true,
    is_active:    shop.is_active ?? true,
    is_verified:  shop.is_verified ?? false,
    image_url:    shop.image_url || '',
    latitude:     shop.latitude?.toString() || '',
    longitude:    shop.longitude?.toString() || '',
  });

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [dupePhoneShop, setDupePhoneShop] = useState<DupeShopInfo | null>(null);
  const [pendingSave, setPendingSave] = useState<(() => Promise<void>) | null>(null);

  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const [mapsLinkError, setMapsLinkError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ lat: number; lng: number; rawUrl: string } | null>(null);
  const [locating, setLocating]           = useState(false);
  const [mapsLink, setMapsLink]           = useState('');

  // Crop state
  const [croppedBlob, setCroppedBlob]   = useState<Blob | null>(null);
  const [cropPreview, setCropPreview]   = useState('');

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
      const { data, error } = await supabase.from('shop_categories').select('category_id').eq('shop_id', shop.id);
      if (error) throw error;
      return data;
    },
    enabled: !!shop.id,
  });

  useEffect(() => {
    if (!shopCategoryData) return;
    if (shopCategoryData.length > 0) setSelectedCategoryIds(shopCategoryData.map((r: any) => r.category_id));
    else if (shop.category_id) setSelectedCategoryIds([shop.category_id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopCategoryData]);

  /* ── Dev autofill ───────────────────────────────────────────── */
  const handleDevFill = () => {
    setForm((f) => ({
      ...f,
      name:         DUMMY_SHOP_DATA.name,
      phone:        DUMMY_SHOP_DATA.phone,
      whatsapp:     DUMMY_SHOP_DATA.whatsapp,
      address:      DUMMY_SHOP_DATA.address,
      area:         DUMMY_SHOP_DATA.area,
      sub_area:     DUMMY_SHOP_DATA.sub_area,
      description:  DUMMY_SHOP_DATA.description,
      keywords:     DUMMY_SHOP_DATA.keywords,
      opening_time: DUMMY_SHOP_DATA.opening_time,
      closing_time: DUMMY_SHOP_DATA.closing_time,
      latitude:     DUMMY_SHOP_DATA.latitude,
      longitude:    DUMMY_SHOP_DATA.longitude,
    }));
    setErrors({});
  };

  /* ── Location ───────────────────────────────────────────────── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support location access'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setMapsLink(''); setParsedPreview(null); setMapsLinkInput(''); setLocating(false);
        toast.success('Location captured!');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) toast.error('Location permission denied.');
        else toast.error('Could not get location. Try again or paste a Maps link.');
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
    if (!coords) { setMapsLinkError('Could not find coordinates in this link. Use a full Google Maps URL (e.g. google.com/maps/place/...).'); return; }
    setMapsLinkError(''); setParsedPreview({ lat: coords.lat, lng: coords.lng, rawUrl: trimmed });
  };

  const confirmLocation = () => {
    if (!parsedPreview) return;
    setForm((f) => ({ ...f, latitude: parsedPreview.lat.toFixed(6), longitude: parsedPreview.lng.toFixed(6) }));
    setMapsLink(parsedPreview.rawUrl);
    setParsedPreview(null); setMapsLinkInput(''); setMapsLinkError('');
  };

  const clearLocation = () => {
    setForm((f) => ({ ...f, latitude: '', longitude: '' }));
    setMapsLink(''); setParsedPreview(null); setMapsLinkInput(''); setMapsLinkError('');
  };

  /* ── Validation ─────────────────────────────────────────────── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Shop name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    else if (!isValidPhone(form.phone)) errs.phone = 'Enter a valid phone number (at least 10 digits)';
    if (form.whatsapp.trim() && !isValidPhone(form.whatsapp)) errs.whatsapp = 'Enter a valid WhatsApp number (at least 10 digits)';
    if (!form.area.trim() && !form.address.trim()) errs.area = 'Area or address is required';
    if (form.latitude) { const lat = parseFloat(form.latitude); if (isNaN(lat) || lat < -90 || lat > 90) errs.latitude = 'Latitude must be between -90 and 90'; }
    if (form.longitude) { const lon = parseFloat(form.longitude); if (isNaN(lon) || lon < -180 || lon > 180) errs.longitude = 'Longitude must be between -180 and 180'; }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Image crop ─────────────────────────────────────────────── */
  const handleCropComplete = async (blob: Blob, previewDataUrl: string) => {
    setCroppedBlob(blob);
    setCropPreview(previewDataUrl);
    // Upload immediately so it's ready for save — name file after shop slug
    setUploading(true);
    const compressed = await compressImage(blob as unknown as File);
    let publicUrl = '';
    try {
      const result = await uploadShopImage(compressed, form.name);
      publicUrl = result.publicUrl;
    } catch {
      toast.error('Image upload failed');
      setUploading(false);
      return;
    }
    // Delete the old image if replacing
    if (oldImageUrl.current && oldImageUrl.current !== publicUrl) {
      const oldPath = extractStoragePath(oldImageUrl.current);
      if (oldPath) await supabase.storage.from('shop-images').remove([oldPath]);
    }
    setForm((f) => ({ ...f, image_url: publicUrl }));
    setCropPreview(''); // clear local preview — use the real URL
    toast.success('Image uploaded ✓');
    setUploading(false);
  };

  const handleCropClear = () => {
    setCroppedBlob(null); setCropPreview('');
    // Restore original image URL on clear (don't wipe it unless user explicitly cleared)
    setForm((f) => ({ ...f, image_url: oldImageUrl.current || '' }));
  };

  /* ── Save ───────────────────────────────────────────────────── */
  const normalizeArea = (s: string) => s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

  const executeSave = async () => {
    setSaving(true);
    const payload: any = {
      name:         form.name.trim(),
      phone:        form.phone.trim() || null,
      whatsapp:     form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
      address:      form.address.trim() || null,
      area:         form.area.trim() ? normalizeArea(form.area) : null,
      sub_area:     form.sub_area.trim() || null,
      description:  form.description.trim() || null,
      keywords:     form.keywords.trim() || null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      is_open:      form.is_open,
      is_active:    form.is_active,
      is_verified:  form.is_verified,
      image_url:    form.image_url || null,
      latitude:     form.latitude ? parseFloat(form.latitude) : null,
      longitude:    form.longitude ? parseFloat(form.longitude) : null,
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
    if (error) { toast.error('Failed to save shop'); setSaving(false); return; }

    if (shopId) {
      await supabase.from('shop_categories').delete().eq('shop_id', shopId);
      if (selectedCategoryIds.length > 0) {
        await supabase.from('shop_categories').insert(selectedCategoryIds.map((catId) => ({ shop_id: shopId, category_id: catId })));
      }
    }

    // If the shop was renamed and still uses an image we own, rename the file
    // so its filename keeps matching the shop name.
    if (isEdit && form.image_url && form.name.trim() && shop.name && shop.name.trim() !== form.name.trim()) {
      try {
        const renamed = await renameShopImage(form.image_url, form.name);
        if (renamed && renamed.publicUrl !== form.image_url) {
          await supabase.from('shops').update({ image_url: renamed.publicUrl }).eq('id', shopId);
          setForm((f) => ({ ...f, image_url: renamed.publicUrl }));
        }
      } catch {
        // Non-fatal: shop save already succeeded
      }
    }

    toast.success(isEdit ? 'Shop updated!' : 'Shop added!');
    // Old image is already deleted on crop upload — just update the ref
    oldImageUrl.current = form.image_url || '';
    onSaved();
    setSaving(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const normalizedPhone = normalizePhone(form.phone);
    if (normalizedPhone) {
      const { data: allPhones } = await supabase.from('shops').select('id, name, phone, area, shop_categories(categories(name, icon))');
      const dupeRaw = allPhones?.find((s: any) => s.id !== shop.id && s.phone && normalizePhone(s.phone) === normalizedPhone);
      if (dupeRaw) {
        const cats = ((dupeRaw as any).shop_categories || []).map((sc: any) => sc.categories).filter(Boolean) as { name: string; icon: string }[];
        setDupePhoneShop({ id: dupeRaw.id, name: dupeRaw.name, phone: dupeRaw.phone, area: dupeRaw.area, categories: cats });
        setPendingSave(() => executeSave);
        setSaving(false); return;
      }
    }
    setSaving(false);
    await executeSave();
  };

  const handleSaveAnyway = async () => { setDupePhoneShop(null); setPendingSave(null); await executeSave(); };

  const toggleCategory = (catId: string) =>
    setSelectedCategoryIds((prev) => prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]);

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
            {/* Dev autofill */}
            {DEV_AUTOFILL && (
              <button type="button" onClick={handleDevFill}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-dashed border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                <FlaskConical className="w-3.5 h-3.5" />
                [DEV] Auto-fill Test Data
              </button>
            )}

            <Field label="Shop Name *">
              <input value={form.name} onChange={(e) => { set('name', e.target.value); setErrors((err) => ({ ...err, name: '' })); }}
                className={inputCls + (errors.name ? ' border-destructive' : '')} placeholder="e.g. Sharma General Store" maxLength={120} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </Field>

            {/* Categories */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Categories <span className="text-muted-foreground font-normal">(select one or more)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const selected = selectedCategoryIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCategory(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary'
                      }`}>
                      <span>{c.icon}</span> {c.name}
                    </button>
                  );
                })}
              </div>
              {selectedCategoryIds.length === 0 && <p className="text-xs text-muted-foreground mt-1">No category selected</p>}
            </div>

            {/* Phone + WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone *">
                <input value={form.phone} onChange={(e) => { set('phone', e.target.value); setErrors((err) => ({ ...err, phone: '' })); }}
                  className={inputCls + (errors.phone ? ' border-destructive' : '')} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={20} />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </Field>
              <Field label="WhatsApp (optional)">
                <input value={form.whatsapp} onChange={(e) => { set('whatsapp', e.target.value); setErrors((err) => ({ ...err, whatsapp: '' })); }}
                  className={inputCls + (errors.whatsapp ? ' border-destructive' : '')} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={20} />
                {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
                <p className="text-xs text-muted-foreground mt-1">Leave blank if same as phone</p>
              </Field>
            </div>

            <Field label="Address (Street / Full address)">
              <input value={form.address} onChange={(e) => { set('address', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
                className={inputCls} placeholder="e.g. Near Bus Stand, Station Road" maxLength={250} />
            </Field>

            <Field label="Area / Locality *">
              <input value={form.area} onChange={(e) => { set('area', e.target.value); setErrors((err) => ({ ...err, area: '' })); }}
                className={inputCls + (errors.area ? ' border-destructive' : '')} placeholder="e.g. Main Road, Muktainagar"
                list="admin-common-areas" maxLength={100} />
              <datalist id="admin-common-areas">
                {['Main Road','Station Road','Bus Stand Area','Market Area','Ward 1','Ward 2','Ward 3','Ward 4','Ward 5'].map((v) => <option key={v} value={v} />)}
              </datalist>
              {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
            </Field>

            <Field label="Sub Area / Landmark (optional)">
              <input value={form.sub_area} onChange={(e) => set('sub_area', e.target.value)}
                className={inputCls} placeholder="e.g. Near Police Station, Opp. Bank" maxLength={100} />
            </Field>

            <Field label="Description (optional)">
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                className={inputCls + ' min-h-[72px] resize-y'} placeholder="What does this shop sell? Any special services?" maxLength={500} />
            </Field>

            <Field label="Keywords (optional)">
              <input value={form.keywords} onChange={(e) => set('keywords', e.target.value)}
                className={inputCls} placeholder="e.g. grocery, medicines, electronics" maxLength={200} />
              <p className="text-[11px] text-muted-foreground mt-1">Separate keywords with commas</p>
            </Field>

            {/* Location */}
            <div className="rounded-xl border" style={{ background: 'hsl(var(--muted) / 0.5)', borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold text-foreground">Shop Location (optional)</p>
              </div>
              {(form.latitude && form.longitude) && (
                <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                  style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                  <span className="text-[11px] font-mono text-foreground truncate">📍 {form.latitude}, {form.longitude}</span>
                  <button type="button" onClick={clearLocation} className="shrink-0 text-xs text-destructive font-semibold hover:opacity-70">Clear</button>
                </div>
              )}
              {!(form.latitude && form.longitude) && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" />Paste Google Maps link</p>
                    <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                      Open Google Maps → find the shop → tap <strong>Share</strong> → <strong>Copy link</strong> → paste below.
                    </p>
                    <div className="flex gap-2">
                      <input value={mapsLinkInput} onChange={(e) => { setMapsLinkInput(e.target.value); setMapsLinkError(''); setParsedPreview(null); }}
                        className={inputCls + ' text-xs flex-1' + (mapsLinkError ? ' border-destructive' : '')}
                        placeholder="https://www.google.com/maps/place/..." />
                      <button type="button" onClick={handleExtractFromLink} disabled={!mapsLinkInput.trim()}
                        className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>Extract</button>
                    </div>
                    {mapsLinkError && <p className="text-[11px] text-destructive mt-1.5 leading-relaxed">{mapsLinkError}</p>}
                  </div>
                  {parsedPreview && (
                    <div className="rounded-lg px-3 py-2.5 space-y-2"
                      style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.25)' }}>
                      <p className="text-xs font-semibold text-foreground">📍 Found: {parsedPreview.lat.toFixed(6)}, {parsedPreview.lng.toFixed(6)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={`https://www.google.com/maps?q=${parsedPreview.lat},${parsedPreview.lng}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />Verify on Maps
                        </a>
                        <span className="text-muted-foreground text-[11px]">·</span>
                        <button type="button" onClick={confirmLocation}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                          ✓ Use this location
                        </button>
                        <button type="button" onClick={() => { setParsedPreview(null); setMapsLinkError(''); }}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">✕</button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-[10px] text-muted-foreground font-medium">or use GPS</span><div className="flex-1 h-px bg-border" /></div>
                  <button type="button" onClick={handleGetLocation} disabled={locating}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 border border-border"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}>
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-primary" />}
                    {locating ? 'Getting GPS location…' : 'Use my GPS location'}
                  </button>
                </div>
              )}
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <TimePickerField label="Opening Time" optional value={form.opening_time} onChange={(v) => set('opening_time', v)} />
              <TimePickerField label="Closing Time" optional value={form.closing_time} onChange={(v) => set('closing_time', v)} />
            </div>

            {/* Flags */}
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

            {/* Image */}
            <Field label="Shop Image">
              <ImageCropPicker
                previewUrl={form.image_url || undefined}
                onCropComplete={handleCropComplete}
                onClear={handleCropClear}
                uploading={uploading}
                maxMB={10}
              />
              {uploading && <p className="text-xs text-primary mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Uploading…</p>}
            </Field>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={saving || uploading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update Shop' : 'Add Shop'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate phone dialog */}
      <Dialog open={!!dupePhoneShop} onOpenChange={(open) => { if (!open) { setDupePhoneShop(null); setPendingSave(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-secondary shrink-0" />
              Phone number already in use
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">This phone number is already registered to another shop.</p>
                {dupePhoneShop && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
                    <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shop Name</span><p className="font-semibold text-foreground">{dupePhoneShop.name}</p></div>
                    <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</span><p className="text-foreground">{dupePhoneShop.phone}</p></div>
                    {dupePhoneShop.area && <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area</span><p className="text-foreground">{dupePhoneShop.area}</p></div>}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">Are you sure you want to add a second shop with the same phone number?</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button onClick={() => { setDupePhoneShop(null); setPendingSave(null); }}
              className="flex-1 py-2.5 border border-border rounded-lg font-semibold text-foreground hover:bg-muted transition-colors text-sm">Cancel</button>
            <button onClick={handleSaveAnyway} disabled={saving}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Anyway'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
