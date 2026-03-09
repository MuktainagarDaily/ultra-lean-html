
## Plan: Make location mandatory + improve Submit button UI

### What to change in `RequestListingModal.tsx`

#### 1. Make location (coords) mandatory in validation
Add a check in `validate()` after the area check (around line 155):
```
if (!hasCoords) errs.location = 'Please provide your shop location — paste a Google Maps link or use GPS';
```
Also need `hasCoords` available inside `validate()` — it's currently computed at line 321 outside the function. Move it up or recompute inline:
```
if (!form.latitude || !form.longitude) errs.location = '...';
```

#### 2. Show location error below the location section
Currently the location section ends at line 542. Add an error message right after it:
```jsx
{errors.location && (
  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
    <MapPin className="w-3 h-3" /> {errors.location}
  </p>
)}
```

#### 3. Update location section header from "optional" to required
Line 429: Change `"Shop Location (optional)"` → `"Shop Location *"` and style it accordingly.

#### 4. Highlight the location box in red when there's a location error
On the outer `div` at line 422–424, add a conditional border: if `errors.location`, use `border-destructive` instead of the default border.

#### 5. Improve Submit button UI
Current button (lines 631–641) is plain. Improve to:
- Larger, more prominent — `py-3.5` instead of `py-3`
- Add a send/arrow icon (use `Send` from lucide-react, already in lucide or add `ArrowRight`)
- Add gradient: `bg-gradient-to-r from-primary to-primary/80`
- Increase font size slightly: `text-base`
- Add shadow: `shadow-lg shadow-primary/25`
- Full-width single button (no cancel stacked alongside — keep cancel but make submit more prominent visually, keep the 2-button layout but make submit feel like the primary CTA)
- The Cancel button becomes more subdued (ghost style)

Need to import `Send` from lucide-react (add to line 2 imports).

### Summary of file changes
- **`src/components/RequestListingModal.tsx`**:
  1. Line 2: Add `Send` to lucide imports
  2. Lines 154–156 (after area validation): Add `if (!form.latitude || !form.longitude) errs.location = '...'`
  3. Lines 421–424: Change section header text and add conditional `border-destructive` class when `errors.location` exists
  4. Line 429: Change label text to `"Shop Location *"` with required indicator  
  5. Lines 542–543: Add `{errors.location && <p>...</p>}` after closing location div — also add `onClick` to clear error when user interacts with location inputs
  6. Lines 622–642: Improve button styles — submit gets gradient + shadow + `Send` icon, cancel becomes ghost

### Error clearing
When user confirms location (`confirmLocation` at line 255) or uses GPS (`handleGetLocation` success at line 211), clear the `location` error:
```
setErrors((err) => ({ ...err, location: '' }));
```
