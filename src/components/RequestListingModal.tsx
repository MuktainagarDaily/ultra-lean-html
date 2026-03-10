import { useState } from 'react';
import { X, Loader2, CheckCircle2, Store, MapPin, Navigation, Link2, ExternalLink, Send, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { compressImage } from '@/lib/imageUtils';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';
import { TimePickerField } from '@/components/shared/TimePickerField';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { DEV_AUTOFILL, DUMMY_SHOP_DATA } from '@/lib/devHelpers';

/* ── helpers ────────────────────────────────────────────────────── */

function isValidIndianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return true;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return true;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return true;
  return false;
}

function normalizeWhatsApp(raw: string): string {
  const normalized = normalizePhone(raw);
  if (normalized.length === 10) return `91${normalized}`;
  return normalized;
}

function normalizeArea(s: string): string {
  return s.trim().replace(/(^|[\s,])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
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
interface Props { onClose: () => void; }

export function RequestListingModal({ onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    area: '',
    sub_area: '',
    description: '',
    keywords: '',
    category_text: '',
    opening_time: '',
    closing_time: '',
    submitter_name: '',
    latitude: '',
    longitude: '',
  });

  const [mapsLink, setMapsLink]         = useState('');
  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const [mapsLinkError, setMapsLinkError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ lat: number; lng: number; rawUrl: string } | null>(null);

  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [cropPreview, setCropPreview] = useState('');  // local data URL preview
  const [truthConfirmed, setTruthConfirmed] = useState(false);
  const [done, setDone]         = useState(false);
  const [locating, setLocating] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  /* ── Dev autofill ───────────────────────────────────────────── */
  const handleDevFill = () => {
    setForm({
      name: DUMMY_SHOP_DATA.name,
      phone: DUMMY_SHOP_DATA.phone,
      whatsapp: DUMMY_SHOP_DATA.whatsapp,
      address: DUMMY_SHOP_DATA.address,
      area: DUMMY_SHOP_DATA.area,
      sub_area: DUMMY_SHOP_DATA.sub_area,
      description: DUMMY_SHOP_DATA.description,
      keywords: DUMMY_SHOP_DATA.keywords,
      category_text: DUMMY_SHOP_DATA.category_text,
      opening_time: DUMMY_SHOP_DATA.opening_time,
      closing_time: DUMMY_SHOP_DATA.closing_time,
      submitter_name: DUMMY_SHOP_DATA.submitter_name,
      latitude: DUMMY_SHOP_DATA.latitude,
      longitude: DUMMY_SHOP_DATA.longitude,
    });
    setTruthConfirmed(true);
    setErrors({});
  };

  /* ── Validation ─────────────────────────────────────────────── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Shop name is required';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!isValidIndianPhone(form.phone)) {
      errs.phone = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
    }
    if (form.whatsapp.trim() && !isValidIndianPhone(form.whatsapp)) {
      errs.whatsapp = 'Enter a valid 10-digit Indian mobile number';
    }
    if (!form.address.trim()) errs.address = 'Address is required';
    if (!form.area.trim()) errs.area = 'Area / Locality is required';
    if (form.opening_time && form.closing_time) {
      const [oh, om] = form.opening_time.split(':').map(Number);
      const [ch, cm] = form.closing_time.split(':').map(Number);
      if (oh * 60 + om === ch * 60 + cm) {
        errs.closing_time = 'Closing time must differ from opening time';
      }
    }
    if (!truthConfirmed) errs.truth = 'Please confirm the information is accurate';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Image crop handler ──────────────────────────────────────── */
  const handleCropComplete = (blob: Blob, previewDataUrl: string) => {
    setCroppedBlob(blob);
    setCropPreview(previewDataUrl);
    setImageUrl(''); // will upload on submit
  };

  const handleCropClear = () => {
    setCroppedBlob(null);
    setCropPreview('');
    setImageUrl('');
  };

  /* ── Upload helper (called at submit time) ───────────────────── */
  const uploadCroppedBlob = async (): Promise<string> => {
    if (!croppedBlob) return imageUrl;
    setUploading(true);
    const compressed = await compressImage(croppedBlob as unknown as File);
    const path = `request-${Date.now()}.webp`;
    const { error } = await supabase.storage.from('shop-images').upload(path, compressed, { upsert: true, contentType: 'image/webp' });
    setUploading(false);
    if (error) { toast.error('Image upload failed'); return ''; }
    const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
    return data.publicUrl;
  };

  /* ── Location ───────────────────────────────────────────────── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support location access'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setMapsLink(''); setParsedPreview(null); setMapsLinkInput('');
        setLocating(false); setErrors((e) => ({ ...e, location: '' }));
        toast.success('Location captured!');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) toast.error('Location permission denied.');
        else toast.error('Could not get your location. Try again or enter a Maps link.');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleExtractFromLink = () => {
    const trimmed = mapsLinkInput.trim();
    if (!trimmed) { setMapsLinkError('Please paste a Google Maps link first'); return; }
    if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps')) {
      setMapsLinkError('This is a short link. Open it in your browser, wait for it to load fully, then copy the full URL from the address bar and paste here.');
      return;
    }
    const coords = parseGoogleMapsLink(trimmed);
    if (!coords) { setMapsLinkError('Could not find coordinates. Use a full Google Maps URL (e.g. google.com/maps/place/...).'); return; }
    setMapsLinkError(''); setParsedPreview({ lat: coords.lat, lng: coords.lng, rawUrl: trimmed });
  };

  const confirmLocation = () => {
    if (!parsedPreview) return;
    set('latitude', parsedPreview.lat.toFixed(6));
    set('longitude', parsedPreview.lng.toFixed(6));
    setMapsLink(parsedPreview.rawUrl);
    setParsedPreview(null); setMapsLinkInput(''); setMapsLinkError('');
    setErrors((e) => ({ ...e, location: '' }));
  };

  const clearLocation = () => {
    set('latitude', ''); set('longitude', '');
    setMapsLink(''); setParsedPreview(null); setMapsLinkInput(''); setMapsLinkError('');
  };

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const finalImageUrl = await uploadCroppedBlob();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('shop_requests') as any).insert({
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      whatsapp: form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
      address: form.address.trim() || null,
      area: form.area.trim() ? normalizeArea(form.area) : null,
      sub_area: form.sub_area.trim() || null,
      description: form.description.trim() || null,
      keywords: form.keywords.trim() || null,
      category_text: form.category_text.trim() || null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      image_url: finalImageUrl || null,
      submitter_name: form.submitter_name.trim() || null,
      status: 'pending',
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      maps_link: mapsLink || null,
    });
    setSaving(false);
    if (error) { toast.error('Submission failed. Please try again.'); return; }
    setDone(true);
  };

  /* ── Success screen ─────────────────────────────────────────── */
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
          <button onClick={onClose} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  const hasCoords = !!(form.latitude && form.longitude);

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
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Dev autofill */}
          {DEV_AUTOFILL && (
            <button type="button" onClick={handleDevFill}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-dashed border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              [DEV] Auto-fill Test Data
            </button>
          )}

          {/* Info banner */}
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
            <p className="font-semibold text-foreground mb-0.5">Free listing, reviewed by our team</p>
            <p className="text-muted-foreground text-xs">Fill in your shop details below. Our admin will review and publish within 1–2 business days.</p>
          </div>

          {/* ── Section: Shop Info ─────────────────────────────── */}
          <SectionDivider label="Shop Info" />

          <Field label="Shop Name *">
            <input value={form.name} onChange={(e) => { set('name', e.target.value); clearErr('name'); }}
              className={inputCls + (errors.name ? ' border-destructive' : '')} placeholder="e.g. Sharma General Store" maxLength={120} />
            {errors.name && <Err msg={errors.name} />}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number *">
              <input value={form.phone} onChange={(e) => { set('phone', e.target.value); clearErr('phone'); }}
                className={inputCls + (errors.phone ? ' border-destructive' : '')} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={13} />
              {errors.phone && <Err msg={errors.phone} />}
            </Field>
            <Field label="WhatsApp (optional)">
              <input value={form.whatsapp} onChange={(e) => { set('whatsapp', e.target.value); clearErr('whatsapp'); }}
                className={inputCls + (errors.whatsapp ? ' border-destructive' : '')} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={13} />
              {errors.whatsapp && <Err msg={errors.whatsapp} />}
            </Field>
          </div>

          <Field label="Address (Street / Landmark) *">
            <input value={form.address} onChange={(e) => { set('address', e.target.value); clearErr('address'); }}
              className={inputCls + (errors.address ? ' border-destructive' : '')} placeholder="e.g. Near Bus Stand, Station Road" maxLength={250} />
            {errors.address && <Err msg={errors.address} />}
          </Field>

          <Field label="Area / Locality *">
            <input value={form.area} onChange={(e) => { set('area', e.target.value); clearErr('area'); }}
              className={inputCls + (errors.area ? ' border-destructive' : '')} placeholder="e.g. Main Road, Muktainagar"
              list="req-common-areas" maxLength={100} />
            <datalist id="req-common-areas">
              {['Main Road','Station Road','Bus Stand Area','Market Area','Ward 1','Ward 2','Ward 3','Ward 4','Ward 5'].map((v) => <option key={v} value={v} />)}
            </datalist>
            {errors.area && <Err msg={errors.area} />}
          </Field>

          <Field label="Sub Area / Landmark (optional)">
            <input value={form.sub_area} onChange={(e) => set('sub_area', e.target.value)}
              className={inputCls} placeholder="e.g. Near Police Station, Opp. Bank" maxLength={100} />
          </Field>

          <Field label="Description (optional)">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              className={inputCls + ' min-h-[72px] resize-y'} placeholder="What does your shop sell? Any special services?"
              maxLength={500} />
          </Field>

          <Field label="Keywords (optional)">
            <input value={form.keywords} onChange={(e) => set('keywords', e.target.value)}
              className={inputCls} placeholder="e.g. grocery, medicines, electronics" maxLength={200} />
            <p className="text-[11px] text-muted-foreground mt-1">Separate keywords with commas</p>
          </Field>

          {/* ── Section: Location ─────────────────────────────── */}
          <SectionDivider label="Location" />

          <div className={`rounded-xl border ${errors.location ? 'border-destructive' : 'border-border'}`}
            style={{ background: 'hsl(var(--muted) / 0.5)' }}>
            <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${errors.location ? 'text-destructive' : 'text-primary'}`} />
              <p className={`text-xs font-semibold ${errors.location ? 'text-destructive' : 'text-foreground'}`}>Shop Location</p>
            </div>
            {hasCoords && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                <span className="text-[11px] font-mono text-foreground truncate">📍 {form.latitude}, {form.longitude}</span>
                <button type="button" onClick={clearLocation} className="shrink-0 text-xs text-destructive font-semibold hover:opacity-70">Clear</button>
              </div>
            )}
            {!hasCoords && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" />Paste Google Maps link</p>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                    Open Google Maps → find your shop → tap <strong>Share</strong> → <strong>Copy link</strong> → paste below. If you get a short link, open it first and copy the full URL.
                  </p>
                  <div className="flex gap-2">
                    <input value={mapsLinkInput} onChange={(e) => { setMapsLinkInput(e.target.value); setMapsLinkError(''); setParsedPreview(null); }}
                      className={inputCls + ' text-xs flex-1' + (mapsLinkError ? ' border-destructive' : '')} placeholder="https://www.google.com/maps/place/..." />
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
          {errors.location && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{errors.location}</p>}

          {/* ── Section: Schedule ─────────────────────────────── */}
          <SectionDivider label="Schedule" />

          <Field label="Category (optional)">
            {categories.length > 0 ? (
              <select value={form.category_text} onChange={(e) => set('category_text', e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
            ) : (
              <input value={form.category_text} onChange={(e) => set('category_text', e.target.value)}
                className={inputCls} placeholder="e.g. Grocery, Medical, Electronics" maxLength={80} />
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimePickerField label="Opening Time" optional value={form.opening_time} onChange={(v) => { set('opening_time', v); clearErr('closing_time'); }} />
            <TimePickerField label="Closing Time" optional value={form.closing_time} onChange={(v) => { set('closing_time', v); clearErr('closing_time'); }} error={errors.closing_time} />
          </div>

          {/* ── Section: Photo & Contact ─────────────────────── */}
          <SectionDivider label="Photo & Contact" />

          <Field label="Shop Photo (optional, max 5 MB)">
            <ImageCropPicker
              previewUrl={imageUrl || (cropPreview ? undefined : undefined)}
              onCropComplete={handleCropComplete}
              onClear={handleCropClear}
              uploading={uploading}
              maxMB={5}
            />
            {cropPreview && !imageUrl && (
              <img src={cropPreview} alt="Cropped preview" className="mt-2 w-full h-32 object-cover rounded-xl border border-border" />
            )}
          </Field>

          <Field label="Your Name (optional)">
            <input value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)}
              className={inputCls} placeholder="So we can follow up if needed" maxLength={80} />
          </Field>

          {/* ── Truth confirmation ───────────────────────────── */}
          <div className={`rounded-xl border p-4 space-y-2 ${errors.truth ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={truthConfirmed} onChange={(e) => { setTruthConfirmed(e.target.checked); clearErr('truth'); }}
                className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
              <span className="text-sm font-medium text-foreground leading-snug">
                I confirm that all the information provided above is accurate and true to the best of my knowledge.
              </span>
            </label>
            <div className="flex items-start gap-2 ml-7 text-[11px] leading-relaxed text-destructive font-medium">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>Official staff or employees may contact you to verify this listing before it is published.</span>
            </div>
            {errors.truth && <p className="ml-7 text-xs text-destructive font-semibold">{errors.truth}</p>}
          </div>

          {/* ── Submit ──────────────────────────────────────── */}
          <div className="flex flex-col gap-3 pt-2 pb-safe">
            <button type="submit" disabled={saving || uploading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-base shadow-lg hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {saving || uploading ? <><Loader2 className="w-4 h-4 animate-spin" />{uploading ? 'Uploading photo…' : 'Submitting…'}</> : <><Send className="w-4 h-4" /> Submit Request</>}
            </button>
            <button type="button" onClick={onClose}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function clearErr(key: string) { setErrors((e) => ({ ...e, [key]: '' })); }
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}
