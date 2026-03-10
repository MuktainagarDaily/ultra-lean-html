
-- Create shop-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-images',
  'shop-images',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
);

-- Allow anyone to view/read images (public bucket)
CREATE POLICY "Public read shop images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload shop images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shop-images');

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update shop images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'shop-images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete shop images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shop-images');
