import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, Upload, Download, CheckCircle2, AlertTriangle, AlertCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/shopUtils';
import { normalizeWhatsApp, isValidPhone } from './adminHelpers';

type ImportRowStatus = 'ready' | 'warning' | 'error' | 'duplicate';
interface ImportRow {
  name: string; phone: string; whatsapp: string; address: string; area: string;
  category: string; opening_time: string; closing_time: string; latitude: string;
  longitude: string; is_active: string; is_verified: string;
  status: ImportRowStatus; messages: string[]; resolvedCategoryId: string | null;
}
interface ImportResult { imported: number; importedWithWarnings: number; skippedDupes: number; skippedErrors: number; failedInserts: number; }
type ImportStep = 'upload' | 'preview' | 'result';

function parseCsvLine(line: string): string[] {
  const result: string[] = []; let current = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim()); return result;
}
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line); const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); }); return obj;
  });
}
const CSV_TEMPLATE_HEADERS = ['name','phone','whatsapp','address','area','category','opening_time','closing_time','latitude','longitude','is_active','is_verified'];
const CSV_TEMPLATE_EXAMPLE = ['Sharma General Store','9876543210','9876543210','Near Bus Stand Station Road','Main Road','Grocery','09:00','21:00','21.0325','75.6920','true','false'];
function downloadTemplate() {
  const rows = [CSV_TEMPLATE_HEADERS.join(','), CSV_TEMPLATE_EXAMPLE.join(',')].join('\n');
  const blob = new Blob([rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'muktainagar_shops_template.csv'; a.click(); URL.revokeObjectURL(url);
}

interface CsvImportModalProps { onClose: () => void; onDone: () => void; }

export function CsvImportModal({ onClose, onDone }: CsvImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => { const { data, error } = await supabase.from('categories').select('*').order('name'); if (error) throw error; return data; },
  });

  const processText = async (csvText: string) => {
    const rawRows = parseCsv(csvText);
    if (rawRows.length === 0) { toast.error('CSV has no data rows or is malformed'); setParsing(false); return; }
    const { data: existingShops } = await supabase.from('shops').select('phone');
    const existingPhones = new Set((existingShops || []).map((s: any) => s.phone ? normalizePhone(s.phone) : '').filter(Boolean));
    const catMap = new Map<string, string>();
    categories.forEach((c: any) => catMap.set(c.name.toLowerCase().trim(), c.id));
    const seenPhones = new Set<string>();
    const processed: ImportRow[] = rawRows.map((raw) => {
      const name = (raw['name'] || '').trim(); const phone = (raw['phone'] || '').trim();
      const whatsapp = (raw['whatsapp'] || '').trim(); const address = (raw['address'] || '').trim();
      const area = (raw['area'] || '').trim(); const category = (raw['category'] || '').trim();
      const opening_time = (raw['opening_time'] || '').trim(); const closing_time = (raw['closing_time'] || '').trim();
      const latitude = (raw['latitude'] || '').trim(); const longitude = (raw['longitude'] || '').trim();
      const is_active = (raw['is_active'] || '').trim(); const is_verified = (raw['is_verified'] || '').trim();
      const messages: string[] = []; let status: ImportRowStatus = 'ready';
      if (!name) { messages.push('Shop name is required'); status = 'error'; }
      if (!phone) { messages.push('Phone number is required'); status = 'error'; }
      else if (!isValidPhone(phone)) { messages.push('Phone must be at least 10 digits'); status = 'error'; }
      if (latitude && (isNaN(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) { messages.push('Latitude must be between -90 and 90'); status = 'error'; }
      if (longitude && (isNaN(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) { messages.push('Longitude must be between -180 and 180'); status = 'error'; }
      if (!area && !address) { messages.push('Area or address is required'); status = 'error'; }
      if (status !== 'error' && phone) {
        const norm = normalizePhone(phone);
        if (existingPhones.has(norm)) { messages.push('Phone already exists in database'); status = 'duplicate'; }
        else if (seenPhones.has(norm)) { messages.push('Duplicate phone number within this CSV'); status = 'duplicate'; }
        else { seenPhones.add(norm); }
      }
      if (status !== 'error' && status !== 'duplicate' && whatsapp && !isValidPhone(whatsapp)) { messages.push('WhatsApp number appears invalid — will be skipped'); status = 'warning'; }
      let resolvedCategoryId: string | null = null;
      if (category) {
        resolvedCategoryId = catMap.get(category.toLowerCase().trim()) ?? null;
        if (!resolvedCategoryId && status !== 'error' && status !== 'duplicate') { messages.push(`Category "${category}" not found — will import without category`); status = 'warning'; }
      }
      if (status === 'ready' && messages.length === 0) messages.push('Ready to import');
      return { name, phone, whatsapp, address, area, category, opening_time, closing_time, latitude, longitude, is_active, is_verified, status, messages, resolvedCategoryId };
    });
    setRows(processed); setParsing(false); setStep('preview');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') { toast.error('Please upload a .csv file'); return; }
    setParsing(true);
    const csvText = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = (ev) => resolve(ev.target?.result as string); reader.onerror = reject; reader.readAsText(file, 'utf-8'); });
    await processText(csvText);
  };

  const importableRows = rows.filter((r) => r.status === 'ready' || r.status === 'warning');
  const dupeRows = rows.filter((r) => r.status === 'duplicate');
  const errorRows = rows.filter((r) => r.status === 'error');
  const normalizeArea = (s: string) => s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

  const handleImport = async () => {
    setImporting(true); let imported = 0; let importedWithWarnings = 0; let failedInserts = 0;
    for (const row of importableRows) {
      const payload: any = { name: row.name, phone: row.phone || null, whatsapp: row.whatsapp ? normalizeWhatsApp(row.whatsapp) : null, address: row.address || null, area: row.area ? normalizeArea(row.area) : null, opening_time: row.opening_time || null, closing_time: row.closing_time || null, latitude: row.latitude ? parseFloat(row.latitude) : null, longitude: row.longitude ? parseFloat(row.longitude) : null, is_active: row.is_active !== '' ? row.is_active.toLowerCase() === 'true' : true, is_verified: row.is_verified !== '' ? row.is_verified.toLowerCase() === 'true' : false, is_open: true };
      const { data: inserted, error: insertErr } = await supabase.from('shops').insert(payload).select('id').single();
      if (insertErr || !inserted) { failedInserts++; continue; }
      if (row.resolvedCategoryId) await supabase.from('shop_categories').insert({ shop_id: inserted.id, category_id: row.resolvedCategoryId });
      if (row.status === 'warning') importedWithWarnings++; else imported++;
    }
    setResult({ imported, importedWithWarnings, skippedDupes: dupeRows.length, skippedErrors: errorRows.length, failedInserts });
    setImporting(false); setStep('result');
  };

  const statusConfig: Record<ImportRowStatus, { icon: React.ReactNode; label: string; rowCls: string; badgeCls: string }> = {
    ready: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Ready', rowCls: '', badgeCls: 'bg-success/10 text-success border border-success/30' },
    warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Warning', rowCls: 'bg-secondary/5', badgeCls: 'bg-secondary/10 text-secondary border border-secondary/30' },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error', rowCls: 'bg-destructive/5', badgeCls: 'bg-destructive/10 text-destructive border border-destructive/30' },
    duplicate: { icon: <SkipForward className="w-3.5 h-3.5" />, label: 'Duplicate', rowCls: 'bg-muted/60', badgeCls: 'bg-muted text-muted-foreground border border-border' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-3xl shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /><h2 className="font-bold text-lg text-foreground">Import Shops from CSV</h2></div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {step === 'upload' && (
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How to use</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li><li>Fill in your shop data — one shop per row</li>
                <li>Upload the file and review the preview</li><li>Import only valid rows</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button onClick={downloadTemplate} className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors">
                <Download className="w-4 h-4" />Download Template CSV
              </button>
              <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer">
                {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Upload className="w-4 h-4" /> Choose CSV File</>}
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" disabled={parsing} />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30"><CheckCircle2 className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'ready').length} Ready</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/30"><AlertTriangle className="w-3.5 h-3.5" /> {importableRows.filter(r => r.status === 'warning').length} Warning</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30"><AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} Error</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border"><SkipForward className="w-3.5 h-3.5" /> {dupeRows.length} Duplicate</span>
            </div>
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
                            <div className="text-xs text-muted-foreground mt-0.5">{row.messages.filter(m => m !== 'Ready to import').map((m, i) => <span key={i} className="block">{m}</span>)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{row.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{row.area || row.address || '—'}</td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            {row.resolvedCategoryId ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>{row.category}</span>
                              : row.category ? <span className="text-xs text-muted-foreground italic">{row.category} (unmatched)</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeCls}`}>{cfg.icon} {cfg.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => { setRows([]); setStep('upload'); }} className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-foreground hover:bg-muted transition-colors text-sm">← Back</button>
              <button onClick={handleImport} disabled={importing || importableRows.length === 0} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Import ${importableRows.length} Shop${importableRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3"><CheckCircle2 className="w-7 h-7 text-success shrink-0" /><div><p className="font-bold text-foreground text-lg">Import complete</p><p className="text-sm text-muted-foreground">Here's a summary of what happened.</p></div></div>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              {[
                { label: 'Imported successfully', value: result.imported, icon: '✅' },
                { label: 'Imported with warnings', value: result.importedWithWarnings, icon: '🟡' },
                { label: 'Skipped — duplicate phone', value: result.skippedDupes, icon: '🔁' },
                { label: 'Skipped — validation errors', value: result.skippedErrors, icon: '❌' },
                { label: 'Failed (database error)', value: result.failedInserts, icon: '⚠️' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground flex items-center gap-2"><span>{icon}</span> {label}</span>
                  <span className={`font-bold text-sm ${value > 0 && label.startsWith('Imported') ? 'text-success' : 'text-muted-foreground'}`}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={onDone} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors">Close & Refresh Shops</button>
          </div>
        )}
      </div>
    </div>
  );
}
