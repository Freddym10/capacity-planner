/**
 * Persistence seam.
 *
 * Everything the app knows about saving/loading lives here. Today it's
 * localStorage; swapping in an API-backed store later means changing this
 * file only — no component or engine changes required.
 */

import type { Rep, PlannedHire, PlanPeriod } from './engine';

const KEY_REPS = 'capacitypro:reps:v2';
const KEY_HIRES = 'capacitypro:hires:v2';
const KEY_PERIOD = 'capacitypro:period:v2';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or private mode — fail silently for now */
  }
}

export const store = {
  loadReps: (fallback: Rep[]) => read<Rep[]>(KEY_REPS, fallback),
  saveReps: (reps: Rep[]) => write(KEY_REPS, reps),

  loadHires: (fallback: PlannedHire[]) => read<PlannedHire[]>(KEY_HIRES, fallback),
  saveHires: (hires: PlannedHire[]) => write(KEY_HIRES, hires),

  loadPeriod: (fallback: PlanPeriod) => read<PlanPeriod>(KEY_PERIOD, fallback),
  savePeriod: (period: PlanPeriod) => write(KEY_PERIOD, period),

  clearAll: () => {
    if (typeof window === 'undefined') return;
    [KEY_REPS, KEY_HIRES, KEY_PERIOD].forEach((k) => window.localStorage.removeItem(k));
  },
};
