# CapacityPro v2 — how to apply

## Files

| Action | Path |
|---|---|
| **Replace** | `app/page.tsx` |
| **Add** | `app/lib/engine.ts` |
| **Add** | `app/lib/storage.ts` |
| **Add** | `app/lib/data.ts` |
| **Add** | `tests/engine.test.ts` |

No new dependencies. Next 16.1.6 / React 19.2.3 / recharts 3.7 / Tailwind v4 all unchanged, so `package.json` stays as-is.

## Steps

```bash
git checkout -b v2-engine        # safety: keeps main deployable
# copy the files in, matching the paths above
npm run dev                      # check http://localhost:3000
node --experimental-strip-types --test tests/engine.test.ts   # 14 tests should pass
git add -A && git commit -m "v2: engine-backed capacity model"
git push -u origin v2-engine
```

Pushing the branch gives you a Vercel **preview** URL, so production keeps serving v1 until you merge. When the preview looks right, merge `v2-engine` into `main` and Vercel promotes it.

## What changed functionally

- **Reporting lines use stable IDs.** Renaming someone no longer detaches their team. "Reports To" is now a dropdown, not free text.
- **The Planning tab actually works.** Hiring cohorts expand into ramping reps and hit the dashboard immediately; a departure date on any AE stops their capacity that month. Toggle "Include planned hires" on the dashboard to compare scenarios.
- **Plan period is configurable.** Fiscal start month and plan length replace the hardcoded 2026 calendar year.
- **CSV import validates before it commits.** Bad roles, duplicate IDs, and broken reporting lines are reported as errors instead of silently corrupting the roster. Quoted fields with commas parse correctly.
- **Tailwind interpolation bug fixed.** Team accent colors come from a static class map, so they survive the v4 build.
- **Persistence isolated** in `app/lib/storage.ts` — swapping in an API later touches only that file.

## Known rough edge

Planned-hire cohorts have no manager assigned, so they appear as top-level rows in the Hierarchy view. Assigning cohorts to a manager is a small follow-up.
