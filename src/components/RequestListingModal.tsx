import { useState } from 'react';
import { X, Loader2, CheckCircle2, Store, MapPin, Navigation, Link2, ExternalLink, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { compressImage } from '@/lib/imageUtils';
import { parseGoogleMapsLink } from '@/lib/mapsUtils';

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

/**
 * Extract lat/lng from a full Google Maps URL.
 * Handles: @lat,lng  |  ?q=lat,lng  |  ll=lat,lng  |  !3d<lat>!4d<lng>
 */
function parseGoogleMapsLink(url: string): { lat: number; lng: number } | null {
  const valid = (lat: number, lng: number) =>
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  // @lat,lng (place URLs)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng or &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // !3d<lat>!4d<lng>  (data parameter)
  const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  return null;
}

const MAX_IMAGE_MB = 5;

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
    latitude: '',
    longitude: '',
  });

  // Location state
  const [mapsLink, setMapsLink] = useState('');            // confirmed link to store
  const [mapsLinkInput, setMapsLinkInput] = useState('');  // raw paste field value
  const [mapsLinkError, setMapsLinkError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ lat: number; lng: number; rawUrl: string } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [done, setDone] = useState(false);
  const [locating, setLocating] = useState(false);

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
    } else if (!isValidIndianPhone(form.phone)) {
      errs.phone = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
    }
    if (form.whatsapp.trim() && !isValidIndianPhone(form.whatsapp)) {
      errs.whatsapp = 'Enter a valid 10-digit Indian mobile number';
    }
    if (!form.address.trim()) {
      errs.address = 'Address is required';
    }
    if (!form.area.trim()) {
      errs.area = 'Area / Locality is required';
    }
    // BUG-02: location is optional — admin can add it during approval
    // BUG-10: allow overnight hours (closing < opening means next-day close)
    if (form.opening_time && form.closing_time) {
      const [oh, om] = form.opening_time.split(':').map(Number);
      const [ch, cm] = form.closing_time.split(':').map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;
      // Only reject same-time; overnight (close < open) is valid
      if (closeMins === openMins) {
        errs.closing_time = 'Closing time must differ from opening time';
      }
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
          else resolve(new Blob([], { type: 'image/webp' })); // empty blob fallback
        }, 'image/webp', quality);
      };
      img.src = url;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const fileMB = file.size / (1024 * 1024);
    if (fileMB > MAX_IMAGE_MB) {
      toast.error(`Image too large (${fileMB.toFixed(1)} MB). Maximum size is ${MAX_IMAGE_MB} MB.`);
      e.target.value = '';
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

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support location access'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
      set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setMapsLink('');
        setParsedPreview(null);
        setMapsLinkInput('');
        setLocating(false);
        setErrors((err) => ({ ...err, location: '' }));
        toast.success('Location captured!');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please allow location access in your browser.');
        } else {
          toast.error('Could not get your location. Try again or enter coordinates manually.');
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleExtractFromLink = () => {
    const trimmed = mapsLinkInput.trim();
    if (!trimmed) { setMapsLinkError('Please paste a Google Maps link first'); return; }

    // Short link — can't parse client-side
    if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps')) {
      setMapsLinkError(
        'This is a short link. Open it in your browser, wait for the page to load fully, then copy the full URL from the address bar and paste it here.'
      );
      return;
    }

    const coords = parseGoogleMapsLink(trimmed);
    if (!coords) {
      setMapsLinkError(
        'Could not find coordinates in this link. Make sure it is a full Google Maps URL (e.g. google.com/maps/place/...).'
      );
      return;
    }

    setMapsLinkError('');
    setParsedPreview({ lat: coords.lat, lng: coords.lng, rawUrl: trimmed });
  };

  const confirmLocation = () => {
    if (!parsedPreview) return;
    set('latitude', parsedPreview.lat.toFixed(6));
    set('longitude', parsedPreview.lng.toFixed(6));
    setMapsLink(parsedPreview.rawUrl);
    setParsedPreview(null);
    setMapsLinkInput('');
    setMapsLinkError('');
    setErrors((err) => ({ ...err, location: '' }));
  };

  const clearLocation = () => {
    set('latitude', '');
    set('longitude', '');
    setMapsLink('');
    setParsedPreview(null);
    setMapsLinkInput('');
    setMapsLinkError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('shop_requests') as any).insert({
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      whatsapp: form.whatsapp.trim() ? normalizeWhatsApp(form.whatsapp) : null,
      address: form.address.trim() || null,
      area: form.area.trim() ? normalizeArea(form.area) : null,
      category_text: form.category_text.trim() || null,
      opening_time: form.opening_time || null,
      closing_time: form.closing_time || null,
      image_url: imageUrl || null,
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
          {/* ── Section: Shop Info ─────────────────────────────── */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Shop Info</span>
            <div className="flex-1 h-px bg-border" />
          </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number *">
              <input
                value={form.phone}
                onChange={(e) => { set('phone', e.target.value); setErrors((err) => ({ ...err, phone: '' })); }}
                className={inputCls + (errors.phone ? ' border-destructive' : '')}
                placeholder="e.g. 9876543210"
                inputMode="numeric"
                maxLength={13}
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
                maxLength={13}
              />
              {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
            </Field>
          </div>

          {/* Address */}
          <Field label="Address (Street / Landmark) *">
            <input
              value={form.address}
              onChange={(e) => { set('address', e.target.value); setErrors((err) => ({ ...err, address: '' })); }}
              className={inputCls + (errors.address ? ' border-destructive' : '')}
              placeholder="e.g. Near Bus Stand, Station Road"
              maxLength={250}
            />
            {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
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

          {/* ── Section: Location ─────────────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Location *</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* ── Location section ──────────────────────────────────── */}
          <div
            className={`rounded-xl border ${errors.location ? 'border-destructive' : 'border-border'}`}
            style={{ background: 'hsl(var(--muted) / 0.5)' }}
          >
            {/* Section header */}
            <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${errors.location ? 'text-destructive' : 'text-primary'}`} />
              <p className={`text-xs font-semibold ${errors.location ? 'text-destructive' : 'text-foreground'}`}>Shop Location *</p>
            </div>

            {/* Confirmed coords badge */}
            {hasCoords && (
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
            {!hasCoords && (
              <div className="px-4 pb-4 space-y-3">

                {/* Maps link paste */}
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Paste Google Maps link
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                    Open Google Maps → find your shop → tap <strong>Share</strong> → <strong>Copy link</strong> → paste below.{' '}
                    <span>If you get a short link, open it first and copy the full URL from the address bar.</span>
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
          {/* Location section error */}
          {errors.location && (
            <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" /> {errors.location}
            </p>
          )}


          {/* ── Section: Schedule ─────────────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Schedule</span>
            <div className="flex-1 h-px bg-border" />
          </div>

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

          {/* Times — stacked on mobile for better iOS time picker UX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Opening Time (optional)">
              <input
                type="time"
                value={form.opening_time}
                onChange={(e) => { set('opening_time', e.target.value); setErrors((err) => ({ ...err, closing_time: '' })); }}
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
                onChange={(e) => { set('closing_time', e.target.value); setErrors((err) => ({ ...err, closing_time: '' })); }}
                className={inputCls + (errors.closing_time ? ' border-destructive' : '')}
              />
              {errors.closing_time && <p className="text-xs text-destructive mt-1">{errors.closing_time}</p>}
              {!errors.closing_time && form.closing_time && (
                <p className="text-xs text-muted-foreground mt-1">{formatTime(form.closing_time)}</p>
              )}
            </Field>
          </div>

          {/* ── Section: Photo & Submitter ────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Photo & Contact</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Shop image */}
          <Field label={`Shop Photo (optional, max ${MAX_IMAGE_MB} MB)`}>
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2 border border-border" />
            )}
            <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : 'hover:border-primary/40'} border-border bg-background`}>
              <span className="text-xl">📷</span>
              <span className="text-sm text-foreground font-medium">
                {uploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Choose photo'}
              </span>
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">JPEG, PNG, or WebP · max {MAX_IMAGE_MB} MB · compressed automatically</p>
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
          <div className="flex flex-col gap-3 pt-2 pb-safe">
            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-base shadow-lg hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              ) : (
                <><Send className="w-4 h-4" /> Submit Request</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
