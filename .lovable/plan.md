
## Replace App Icons with Uploaded Image

### Task
Copy the uploaded logo image to replace both `public/icons/icon-192.png` and `public/icons/icon-512.png`, and also update `public/favicon.ico` reference.

### What changes
- Copy `user-uploads://ChatGPT_Image_Mar_8_2026_09_58_57_PM.png` → `public/icons/icon-192.png`
- Copy same image → `public/icons/icon-512.png`
- Copy same image → `src/assets/logo-icon.png` (used in the branded nav header in `Home.tsx`)
- Copy same image → `src/assets/logo-icon-flat.png` (backup asset reference)

The image is already the right format (PNG, square, rounded corners). Both sizes will use the same source — browsers and PWA installers will scale appropriately. No code changes needed since `index.html` and `manifest.json` already point to these paths.
