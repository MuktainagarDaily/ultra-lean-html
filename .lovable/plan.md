
## Sanity Test — CSV Bulk Import

### Code audit findings before testing

**Bug found — lat/lng validation is chained off phone validation (lines 1683–1688):**

```typescript
} else if (!isValidPhone(phone)) {
  ...
} else if (latitude && ...) {          // ← only checked if phone IS valid
  ...
} else if (longitude && ...) {         // ← only checked if lat is OK (masks bad longitude)
  ...
}
```

This means:
- A row with a valid phone + bad latitude gets the lat error, but **longitude is never checked** (it's an `else if` of lat)
- Both lat and longitude errors can never appear on the same row
- These checks should be **independent `if` statements**, not chained `else if`

**Everything else is correctly implemented:**
- `parseCsvLine` handles double-quoted fields + embedded commas + escaped `""` — correct
- Two-pass duplicate detection (DB + within-CSV) — correct
- `area AND address` both empty → blocking error — correct
- Category case-insensitive lookup — correct
- Warning rows do import, error/dupe rows are skipped — correct
- Result summary has all 5 counters — correct

---

### Fix — dechain lat/lng validation

**`src/pages/AdminDashboard.tsx` lines 1683–1688** need to become independent `if` checks, not `else if` off the phone chain.

**Current (wrong):**
```typescript
if (!phone) {
  ...
} else if (!isValidPhone(phone)) {
  ...
} else if (latitude && (isNaN(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) {
  messages.push('Latitude must be between -90 and 90');
  status = 'error';
} else if (longitude && (isNaN(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) {
  messages.push('Longitude must be between -180 and 180');
  status = 'error';
}
```

**Fixed (correct):**
```typescript
if (!phone) {
  messages.push('Phone number is required');
  status = 'error';
} else if (!isValidPhone(phone)) {
  messages.push('Phone must be at least 10 digits');
  status = 'error';
}
if (latitude && (isNaN(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) {
  messages.push('Latitude must be between -90 and 90');
  status = 'error';
}
if (longitude && (isNaN(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) {
  messages.push('Longitude must be between -180 and 180');
  status = 'error';
}
```

---

### Test CSV to create (covers all 5 sanity scenarios)

The plan will construct a test CSV inline — no user action needed. The import logic will be tested using a crafted CSV with these rows:

```text
name,phone,whatsapp,address,area,category,opening_time,closing_time,latitude,longitude,is_active,is_verified

Row 1 — quoted comma in address/name  (should be ✅ Ready)
"Sharma, General Store",9876543210,,,"Near Bus Stand, Main Road",Grocery,09:00,21:00,,,true,false

Row 2 — duplicate within CSV (same phone as row 1)  (should be 🔁 Duplicate)
Another Shop,9876543210,,,Station Road,,,,,,,

Row 3 — unmatched category  (should be 🟡 Warning — imports without category)
Tea Stall,9123456789,,,Chowk Area,NonExistentCat,,,,,true,false

Row 4 — missing name + missing area & address  (should be ❌ Error)
,8800000001,,,,,,,,,true,false

Row 5 — invalid lat/lng  (should be ❌ Error — currently only lat error shown, after fix both shown)
Valid Shop,7700000001,,,Market Area,,,,999,999,true,false

Row 6 — warning row (invalid WhatsApp)  (should be 🟡 Warning — imports correctly)
Good Shop,6600000001,123,,Peth Area,Grocery,10:00,20:00,,,true,false
```

**Expected preview state after fix:**
- Row 1: ✅ Ready (quoted commas in name and address parse correctly)
- Row 2: 🔁 Duplicate (same phone as Row 1 within CSV)
- Row 3: 🟡 Warning (unmatched category)
- Row 4: ❌ Error (missing name + missing area/address — two messages)
- Row 5: ❌ Error (both lat AND lon errors shown independently — only works after fix)
- Row 6: 🟡 Warning (invalid WhatsApp)

**Expected import result:**
- Imported successfully: 1 (Row 1)
- Imported with warnings: 2 (Rows 3, 6)
- Skipped — duplicate: 1 (Row 2)
- Skipped — validation errors: 2 (Rows 4, 5)
- Failed: 0

**Public page verification:**
- Rows 1, 3, 6 should appear in Shops page (is_active: true)
- Row 1 should appear with "Sharma, General Store" name
- Row 3 should appear with no category chip
- Row 6 should appear with Grocery category chip (if Grocery exists)

---

### Files to change

Only one file needs a fix: **`src/pages/AdminDashboard.tsx`**

- Lines 1683–1688: dechain lat/lng checks from the phone `else if` chain into independent `if` statements

No DB changes. No new files. All other logic is correct and tested.
