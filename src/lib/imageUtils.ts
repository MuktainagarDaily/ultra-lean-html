/**
 * Shared image utilities
 */

/**
 * Compress an image file to WebP using a canvas.
 * R2: guards against canvas.toBlob returning null (unsupported format/browser).
 */
export function compressImage(file: File, maxWidth = 800, quality = 0.75): Promise<Blob> {
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
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else resolve(new Blob([], { type: 'image/webp' })); // empty blob fallback
      }, 'image/webp', quality);
    };
    img.src = url;
  });
}
