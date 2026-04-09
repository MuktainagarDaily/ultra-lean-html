## Problem

The autocomplete dropdown appears **below** the search bar (`top-full mt-1`), which causes suggestions beyond the first 2 to be hidden behind the trust strip, recent shops, and browse categories sections underneath.

## Fix

Change the dropdown to open **frontof** the trust strip instead of behind it it. This keeps all 5 suggestions visible without being clipped or covered.

### `src/pages/Home.tsx` — line 466

Change:

```diff

```

&nbsp;

### Files changed


| File                 | Change                                                      |
| -------------------- | ----------------------------------------------------------- |
| `src/pages/Home.tsx` | Move autocomplete dropdown from below to above search input |
