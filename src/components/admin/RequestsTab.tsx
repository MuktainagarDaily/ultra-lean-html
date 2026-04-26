import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Eye, Trash2, ThumbsUp, ThumbsDown, Loader2, Inbox, X, MapPin, Download,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { extractStoragePath } from './adminHelpers';
import { renameShopImage } from '@/lib/storageNaming';
import { downloadCsv } from '@/lib/csvUtils';

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface ShopRequest {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  area: string | null;
  category_text: string | null;
  opening_time: string | null;
  closing_time: string | null;
  image_url: string | null;
  submitter_name: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  maps_link: string | null;
}

interface RequestsTabProps {
  onShopCreated: () => void;
}

export function RequestsTab({ onShopCreated }: RequestsTabProps) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('pending');
  const [viewRequest, setViewRequest] = useState<ShopRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject' | 'delete'; req: ShopRequest } | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-requests', statusFilter],
    queryFn: async () => {
      let query = supabase.from('shop_requests').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as ShopRequest[];
    },
  });

  // Independent pending count so the badge stays accurate regardless of statusFilter
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['admin-requests-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('shop_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
  });

  const handleApprove = async (req: ShopRequest) => {
    setActionLoading(req.id);

    const normPhone = normalizePhone(req.phone);
    // B5: check duplicates against both phone AND whatsapp columns
    const { data: allShops } = await supabase.from('shops').select('id, name, phone, whatsapp');
    const dupeShop = (allShops || []).find((s) => {
      const p = s.phone ? normalizePhone(s.phone) : '';
      const w = s.whatsapp ? normalizePhone(s.whatsapp) : '';
      return p === normPhone || w === normPhone;
    });
    if (dupeShop) {
      toast.error(`Phone ${req.phone} is already registered to "${dupeShop.name}". Resolve before approving.`);
      setActionLoading(null);
      return;
    }

    let resolvedCategoryId: string | null = null;
    if (req.category_text?.trim()) {
      const { data: catMatches } = await supabase.from('categories').select('id, name').ilike('name', req.category_text.trim());
      if (catMatches && catMatches.length > 0) resolvedCategoryId = catMatches[0].id;
    }

    const normalizeArea = (s: string) =>
      s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

    const hasAnyHours = !!(req.opening_time || req.closing_time);

    const { data: inserted, error: insertError } = await supabase
      .from('shops')
      .insert([{
        name: req.name.trim(),
        phone: normPhone,
        whatsapp: req.whatsapp?.trim() || null,
        address: req.address?.trim() || null,
        area: req.area?.trim() ? normalizeArea(req.area) : null,
        opening_time: req.opening_time || null,
        closing_time: req.closing_time || null,
        image_url: req.image_url || null,
        latitude: req.latitude || null,
        longitude: req.longitude || null,
        is_active: true,
        // B4: only force is_open=true when no hours captured; otherwise let DB default apply
        // and isShopOpen() compute live status from times
        ...(hasAnyHours ? {} : { is_open: true }),
        is_verified: false,
      } as any])
      .select('id')
      .single();

    if (insertError || !inserted) {
      toast.error('Failed to create shop. ' + (insertError?.message || ''));
      setActionLoading(null);
      return;
    }

    if (resolvedCategoryId) {
      await supabase.from('shop_categories').insert({ shop_id: inserted.id, category_id: resolvedCategoryId });
    }

    // Rename the request's image (request-<slug>.webp) → final shop slug filename
    if (req.image_url) {
      try {
        const renamed = await renameShopImage(req.image_url, req.name);
        if (renamed && renamed.publicUrl !== req.image_url) {
          await supabase.from('shops').update({ image_url: renamed.publicUrl }).eq('id', inserted.id);
        }
      } catch {
        // Non-fatal: shop was created with the request's image URL, admin can re-upload
      }
    }

    await supabase.from('shop_requests').update({ status: 'approved' }).eq('id', req.id);

    toast.success(`"${req.name}" has been approved and added to the shop directory.`);
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    qc.invalidateQueries({ queryKey: ['shops'] });
    onShopCreated();
    setViewRequest(null);
    setActionLoading(null);
  };

  const handleReject = async (req: ShopRequest) => {
    setActionLoading(req.id);
    const { error } = await supabase.from('shop_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (error) {
      toast.error('Failed to reject request');
    } else {
      toast.success(`Request from "${req.name}" has been rejected.`);
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    }
    setViewRequest(null);
    setActionLoading(null);
  };

  const handleDelete = async (req: ShopRequest) => {
    setActionLoading(req.id);
    const { error } = await supabase.from('shop_requests').delete().eq('id', req.id);
    if (error) {
      toast.error('Failed to delete request');
      setActionLoading(null);
      return;
    }
    if (req.image_url) {
      const path = extractStoragePath(req.image_url);
      if (path) {
        const { error: storageErr } = await supabase.storage.from('shop-images').remove([path]);
        if (storageErr) toast.warning('Request deleted, but its image could not be removed from storage.');
      }
    }
    toast.success('Request deleted');
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
    setViewRequest(null);
    setActionLoading(null);
  };

  const statusBadge = (status: RequestStatus) => {
    if (status === 'pending') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary border border-secondary/30">⏳ Pending</span>;
    if (status === 'approved') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">✅ Approved</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">❌ Rejected</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Listing Requests</h2>
          {statusFilter === 'pending' && pendingCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{pendingCount} pending review</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {(['pending', 'approved', 'rejected', 'all'] as (RequestStatus | 'all')[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                  statusFilter === opt ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const headers = ['Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Category', 'Status', 'Submitter', 'Opening Time', 'Closing Time', 'Has Image', 'Submitted At'];
              const rows = (requests as any[]).map((req) => [
                req.name, req.phone, req.whatsapp ?? '', req.area ?? '', req.address ?? '',
                req.category_text ?? '', req.status, req.submitter_name ?? '',
                req.opening_time ?? '', req.closing_time ?? '',
                req.image_url ? 'Yes' : 'No',
                new Date(req.created_at).toLocaleDateString('en-IN'),
              ]);
              downloadCsv('muktainagar-requests', headers, rows);
            }}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl p-4 border border-border skeleton-shimmer h-16" />)}</div>
      ) : requests.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-muted-foreground">
            {statusFilter === 'pending' ? 'No pending requests' : `No ${statusFilter} requests`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter === 'pending' ? 'Submissions from the public form will appear here.' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Shop</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Area</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{req.name}</div>
                      {req.phone && <div className="text-xs text-muted-foreground">{req.phone}</div>}
                      {req.submitter_name && <div className="text-xs text-muted-foreground italic">by {req.submitter_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-sm">{req.area || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm">{req.category_text || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewRequest(req)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => setConfirmAction({ type: 'approve', req })}
                              disabled={actionLoading === req.id}
                              className="p-1.5 hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                              style={{ color: 'hsl(var(--success))' }}
                            >
                              {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'reject', req })}
                              disabled={actionLoading === req.id}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setConfirmAction({ type: 'delete', req })}
                          disabled={actionLoading === req.id}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground">{viewRequest.name}</h3>
                <div className="mt-1">{statusBadge(viewRequest.status)}</div>
              </div>
              <button onClick={() => setViewRequest(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {viewRequest.image_url && (
                <img src={viewRequest.image_url} alt="Shop" className="w-full h-40 object-cover rounded-xl border border-border mb-2" />
              )}
              {[
                { label: 'Phone', value: viewRequest.phone },
                { label: 'WhatsApp', value: viewRequest.whatsapp },
                { label: 'Area', value: viewRequest.area },
                { label: 'Address', value: viewRequest.address },
                { label: 'Category', value: viewRequest.category_text },
                { label: 'Opening', value: viewRequest.opening_time ? formatTime(viewRequest.opening_time) : null },
                { label: 'Closing', value: viewRequest.closing_time ? formatTime(viewRequest.closing_time) : null },
                { label: 'Submitted by', value: viewRequest.submitter_name },
                { label: 'Submitted on', value: new Date(viewRequest.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Admin Notes', value: viewRequest.admin_notes },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-foreground break-words">{value}</span>
                  </div>
                ) : null
              )}
              {(viewRequest.latitude && viewRequest.longitude) ? (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">Location</span>
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`https://www.google.com/maps?q=${viewRequest.latitude},${viewRequest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Open in Maps ↗
                    </a>
                    <span className="text-xs text-muted-foreground font-mono">
                      {viewRequest.latitude.toFixed(5)}, {viewRequest.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>
              ) : viewRequest.maps_link ? (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">Location</span>
                  <a
                    href={viewRequest.maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    Open in Maps ↗
                  </a>
                </div>
              ) : null}
            </div>

            {viewRequest.status === 'pending' && (
              <div className="px-6 pb-6 flex gap-3 border-t border-border pt-4">
                <button
                  onClick={() => setConfirmAction({ type: 'reject', req: viewRequest })}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-destructive hover:bg-destructive/5 transition-colors text-sm disabled:opacity-50"
                >
                  {actionLoading === viewRequest.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reject'}
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'approve', req: viewRequest })}
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'hsl(var(--success))', color: 'hsl(var(--success-foreground))' }}
                >
                  {actionLoading === viewRequest.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</> : '✅ Approve & Publish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* B3: Confirmation dialog for Approve / Reject / Delete */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmAction?.type === 'delete' && <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
              {confirmAction?.type === 'reject' && <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
              {confirmAction?.type === 'approve' && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--success))' }} />}
              {confirmAction?.type === 'approve' && `Approve "${confirmAction.req.name}"?`}
              {confirmAction?.type === 'reject' && `Reject "${confirmAction?.req.name}"?`}
              {confirmAction?.type === 'delete' && `Delete "${confirmAction?.req.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirmAction?.type === 'approve' && (
                  <>
                    <p>This will publish the listing to the public directory.</p>
                    <ul className="text-xs space-y-1 pl-4 list-disc">
                      <li>Phone <strong className="text-foreground">{confirmAction.req.phone}</strong> will be checked against existing shops.</li>
                      {confirmAction.req.category_text && (
                        <li>Category <strong className="text-foreground">"{confirmAction.req.category_text}"</strong> will be auto-mapped if it exists.</li>
                      )}
                      {confirmAction.req.image_url && <li>The submitted image will be renamed to the shop's slug.</li>}
                    </ul>
                  </>
                )}
                {confirmAction?.type === 'reject' && (
                  <p>The request will be marked rejected. It will remain visible in the audit history but won't appear publicly.</p>
                )}
                {confirmAction?.type === 'delete' && (
                  <p>
                    The request and its uploaded image will be <strong className="text-foreground">permanently removed</strong>. This cannot be undone.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!actionLoading}
              onClick={async () => {
                if (!confirmAction) return;
                const { type, req } = confirmAction;
                setConfirmAction(null);
                if (type === 'approve') await handleApprove(req);
                else if (type === 'reject') await handleReject(req);
                else await handleDelete(req);
              }}
              className={
                confirmAction?.type === 'approve'
                  ? ''
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : (
                confirmAction?.type === 'approve' ? 'Approve & Publish' :
                confirmAction?.type === 'reject' ? 'Reject Request' : 'Delete Request'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
