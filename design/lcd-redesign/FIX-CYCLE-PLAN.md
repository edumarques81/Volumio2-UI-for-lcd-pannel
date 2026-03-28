# Gallery QA Fix Cycle — Master Plan

## Workflow
1. **Dev agent** picks up an issue → implements fix → runs `npm run test:run` + `npx tsc --noEmit`
2. **QA agent** opens the real app in browser → tests the specific fix + regression → Pass/Fail
3. **Pass** → Bruce commits with descriptive message
4. **Fail** → Dev agent gets feedback, fixes, back to step 2
5. Repeat until all issues resolved

## Branch: `fix/gallery-qa-fixes`

---

## Issue Queue (Priority Order)

### Batch 1 — Critical Logic Fixes (no visual changes needed to verify)

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 1 | **VIZ mode destroys right panel** | QA-001, TC-060 | ✅ Fixed (c516b5b3) |
| 2 | **Queue track titles empty** | QA-007, U-24 | ✅ Fixed (c516b5b3) |
| 3 | **Library fetch before socket init** | U-23, TC-004 | ✅ Fixed (c516b5b3) |

### Batch 2 — Touch Target & Font Sizing (LCD usability)

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 4 | **Prev/Next buttons too small** | QA-003, U-35 | ✅ Fixed (6f57888d) |
| 5 | **Shuffle/Repeat icons too small** | QA-004 | ✅ Fixed (6f57888d) |
| 6 | **Right panel fonts too small** | QA-006 | ✅ Fixed (6f57888d) |
| 7 | **Source tab pills too small** | U-29 | ✅ Fixed (6f57888d) |

### Batch 3 — Missing Features & UX

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 8 | **Playlist browse-first** | U-27, TC-025 | ✅ Fixed (8e577389) |
| 9 | **Queue clear confirmation** | U-30, TC-044 | ✅ Fixed (8e577389) |
| 10 | **Queue remove safety** | U-31, TC-083 | ✅ Fixed (8e577389) |
| 11 | **Track action icons** | QA-005 | ✅ Fixed (8e577389) |
| 12 | **Settings scroll indicator** | U-28, TC-084 | ✅ Fixed (8e577389) |
| 13 | **Search clear + no results** | U-34, U-40 | ✅ Fixed (8e577389) |
| 14 | **Album art error fallback** | QA-019 | ✅ Fixed (8e577389) |

### Batch 4 — Data & Backend Issues

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 15 | **Filename parsing** | U-25, TC-019 | ✅ Fixed (620fe01f) |
| 16 | **Library stats** | U-37, TC-055 | ✅ Fixed (620fe01f) — track count needs rescan |
| 17 | **Network status** | U-39, TC-020 | ✅ Fixed (620fe01f) |
| 18 | **Audio output** | U-36, TC-054 | ✅ Fixed (620fe01f) |
| 19 | **Event handler dedup** | U-32, TC-005 | ✅ Fixed (620fe01f) — pushBitPerfect still 2x |

### Batch 5 — Accessibility

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 20 | **No ARIA labels on playback buttons** | TC-090 | 🔘 Pending |
| 21 | **No ARIA on sliders** (volume, seek, brightness) | TC-091-093 | 🔘 Pending |
| 22 | **No ARIA tab roles** on utility panel | TC-094 | 🔘 Pending |

### Batch 6 — Settings Completeness

| # | Issue | Source | Status |
|---|-------|--------|--------|
| 23 | **Missing NAS/source management** in settings | QA-008 | 🔘 Pending |
| 24 | **Max client connections setting** | Eduardo request | 🔘 Pending |

---

## Completed
_(issues move here after QA pass + commit)_
