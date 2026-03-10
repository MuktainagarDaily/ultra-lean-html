/**
 * Shared image selection + basic crop component.
 * - No external library — uses canvas for cropping
 * - Crop overlay is draggable/resizable via mouse and touch
 * - On "Crop & Use" → produces WebP Blob → calls onCropComplete
 * - Parent handles the actual Supabase upload
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, Crop, RefreshCw } from 'lucide-react';

interface Props {
  onCropComplete: (blob: Blob, previewUrl: string) => void;
  onClear: () => void;
  previewUrl?: string;   // already-uploaded final image url (shows preview)
  uploading?: boolean;
  maxMB?: number;
}

type CropRect = { x: number; y: number; w: number; h: number };
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

const MIN_SIZE = 40;
const HANDLE = 10;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function ImageCropPicker({ onCropComplete, onClear, previewUrl, uploading, maxMB = 5 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imgRef       = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [srcUrl, setSrcUrl]       = useState<string | null>(null);  // object URL for current file
  const [crop, setCrop]           = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragMode, setDragMode]   = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<{ mx: number; my: number; crop: CropRect } | null>(null);
  const [cropping, setCropping]   = useState(false);
  const [imgSize, setImgSize]     = useState({ w: 0, h: 0 }); // rendered size of canvas container

  // Draw image + overlay onto canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || imgSize.w === 0) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width  = imgSize.w;
    canvas.height = imgSize.h;

    // Draw image scaled to fit
    ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);

    // Dim outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, imgSize.w, imgSize.h);

    // Clear crop area
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);

    // Crop border
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // Grid lines (rule of thirds)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(crop.x + (crop.w / 3) * i, crop.y); ctx.lineTo(crop.x + (crop.w / 3) * i, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, crop.y + (crop.h / 3) * i); ctx.lineTo(crop.x + crop.w, crop.y + (crop.h / 3) * i); ctx.stroke();
    }

    // Corner handles
    const corners = [
      { x: crop.x, y: crop.y },
      { x: crop.x + crop.w, y: crop.y },
      { x: crop.x, y: crop.y + crop.h },
      { x: crop.x + crop.w, y: crop.y + crop.h },
    ];
    corners.forEach(({ x, y }) => {
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.fillRect(x - HANDLE / 2, y - HANDLE / 2, HANDLE, HANDLE);
    });
  }, [crop, imgSize]);

  useEffect(() => { draw(); }, [draw]);

  const loadImage = (url: string) => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Determine rendered size (fit inside container width, max 600px)
      const container = containerRef.current;
      const maxW = container ? container.clientWidth : 600;
      const scale = Math.min(1, maxW / img.naturalWidth, 400 / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setImgSize({ w, h });
      // Default crop: full image
      setCrop({ x: 0, y: 0, w, h });
    };
    img.src = url;
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const mb = file.size / (1024 * 1024);
    if (mb > maxMB) { alert(`Image too large (${mb.toFixed(1)} MB). Max ${maxMB} MB.`); return; }
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    loadImage(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  // --- Pointer events ---
  const getPos = (e: React.MouseEvent | React.TouchEvent): { mx: number; my: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { mx: clientX - rect.left, my: clientY - rect.top };
  };

  const getMode = (mx: number, my: number): DragMode => {
    const { x, y, w, h } = crop;
    const near = (a: number, b: number) => Math.abs(a - b) <= HANDLE;
    if (near(mx, x)     && near(my, y))     return 'nw';
    if (near(mx, x + w) && near(my, y))     return 'ne';
    if (near(mx, x)     && near(my, y + h)) return 'sw';
    if (near(mx, x + w) && near(my, y + h)) return 'se';
    if (mx > x && mx < x + w && my > y && my < y + h) return 'move';
    return null;
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { mx, my } = getPos(e);
    const mode = getMode(mx, my);
    if (!mode) return;
    setDragMode(mode);
    setDragStart({ mx, my, crop: { ...crop } });
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragMode || !dragStart) return;
    e.preventDefault();
    const { mx, my } = getPos(e);
    const dx = mx - dragStart.mx;
    const dy = my - dragStart.my;
    const { x, y, w, h } = dragStart.crop;
    const IW = imgSize.w; const IH = imgSize.h;
    let nx = x, ny = y, nw = w, nh = h;

    if (dragMode === 'move') {
      nx = clamp(x + dx, 0, IW - w);
      ny = clamp(y + dy, 0, IH - h);
    } else {
      if (dragMode === 'nw') { nx = clamp(x + dx, 0, x + w - MIN_SIZE); ny = clamp(y + dy, 0, y + h - MIN_SIZE); nw = w - (nx - x); nh = h - (ny - y); }
      if (dragMode === 'ne') { nw = clamp(w + dx, MIN_SIZE, IW - x); ny = clamp(y + dy, 0, y + h - MIN_SIZE); nh = h - (ny - y); }
      if (dragMode === 'sw') { nx = clamp(x + dx, 0, x + w - MIN_SIZE); nw = w - (nx - x); nh = clamp(h + dy, MIN_SIZE, IH - y); }
      if (dragMode === 'se') { nw = clamp(w + dx, MIN_SIZE, IW - x); nh = clamp(h + dy, MIN_SIZE, IH - y); }
    }
    setCrop({ x: nx, y: ny, w: nw, h: nh });
  };

  const onPointerUp = () => { setDragMode(null); setDragStart(null); };

  // --- Crop & produce Blob ---
  const handleCropAndUse = () => {
    const img = imgRef.current;
    if (!img) return;
    setCropping(true);

    // Scale crop rect back to natural image coords
    const scaleX = img.naturalWidth  / imgSize.w;
    const scaleY = img.naturalHeight / imgSize.h;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sw = crop.w * scaleX;
    const sh = crop.h * scaleY;

    const out = document.createElement('canvas');
    const MAX_OUT = 1200;
    const outScale = Math.min(1, MAX_OUT / sw, MAX_OUT / sh);
    out.width  = Math.round(sw * outScale);
    out.height = Math.round(sh * outScale);
    out.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);

    out.toBlob((blob) => {
      if (blob) {
        const previewDataUrl = out.toDataURL('image/webp', 0.85);
        onCropComplete(blob, previewDataUrl);
      }
      setCropping(false);
    }, 'image/webp', 0.82);
  };

  const handleChange = () => {
    if (srcUrl) { URL.revokeObjectURL(srcUrl); setSrcUrl(null); }
    imgRef.current = null;
    setImgSize({ w: 0, h: 0 });
    onClear();
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  // If parent already has a final image url (persisted), just show preview + change button
  if (previewUrl && !srcUrl) {
    return (
      <div className="space-y-2">
        <img src={previewUrl} alt="Shop preview" className="w-full h-40 object-cover rounded-xl border border-border" />
        <button
          type="button"
          onClick={handleChange}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:underline disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Change photo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
      </div>
    );
  }

  // Crop editing mode
  if (srcUrl && imgSize.w > 0) {
    return (
      <div className="space-y-2" ref={containerRef}>
        <p className="text-xs text-muted-foreground">Drag the crop area, then tap <strong>Crop & Use</strong>.</p>
        <div className="relative rounded-xl overflow-hidden border border-border" style={{ width: imgSize.w, maxWidth: '100%' }}>
          <canvas
            ref={canvasRef}
            width={imgSize.w}
            height={imgSize.h}
            style={{ display: 'block', maxWidth: '100%', touchAction: 'none', cursor: dragMode ? 'grabbing' : 'crosshair' }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCropAndUse}
            disabled={cropping || uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {cropping || uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'Uploading…' : 'Cropping…'}</>
              : <><Crop className="w-4 h-4" /> Crop & Use</>}
          </button>
          <button
            type="button"
            onClick={handleChange}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Change
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
      </div>
    );
  }

  // Initial pick state
  return (
    <div ref={containerRef}>
      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors hover:border-primary/40 border-border bg-background ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
        <span className="text-2xl">📷</span>
        <span className="text-sm text-foreground font-medium">Choose photo</span>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="sr-only" />
      </label>
      <p className="text-[11px] text-muted-foreground mt-1">JPEG, PNG, or WebP · max {maxMB} MB · you can crop after selection</p>
    </div>
  );
}
