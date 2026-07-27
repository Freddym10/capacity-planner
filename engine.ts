/**
 * CapacityPro — Core Capacity Engine
 * Pure calculation module. No React, no persistence, no I/O.
 *
 * Fixes vs. v1:
 *  - Stable IDs instead of name-as-primary-key
 *  - PlanPeriod abstraction (no hardcoded year, supports fiscal offsets)
 *  - Configurable ramp curves (linear, stepped, custom)
 *  - Hiring plan and attrition flow INTO capacity math
 *  - Fully testable seam for future ingestion (Salesforce, CSV, etc.)
 */

// ---------- Types ----------

export type Role = 'AE' | 'Manager' | 'Director' | 'VP';

export interface RampCurve {
  /** 'linear' ramps evenly over rampMonths; 'stepped' uses explicit monthly % */
  type: 'linear' | 'stepped';
  rampMonths: number;
  /** For 'stepped': percentage of full productivity per month index, e.g. [25, 50, 75, 100].
   *  Length should equal rampMonths. Months beyond the array are 100%. */
  steps?: number[];
}

export interface Rep {
  id: string;
  name: string;
  segment: string;
  role: Role;
  /** Stable ID of manager, not a name. Empty string = top of tree. */
  reportsToId: string;
  /** ISO date string, e.g. '2026-01-15' */
  startDate: string;
  /** ISO date string if the rep is departing (attrition). Capacity stops this month. */
  endDate?: string;
  /** Annual quota at full ramp (AEs). For non-AEs, optional explicit quota override. */
  annualQuota: number;
  ramp: RampCurve;
  /** Roll-up haircut % for non-AE roles (quota = team capacity * (1 - haircut/100)) */
  haircut: number;
}

export interface PlanPeriod {
  /** First month of the plan, e.g. { year: 2026, month: 0 } for Jan 2026. month is 0-indexed. */
  startYear: number;
  startMonth: number;
  /** Number of months in the plan (12 for a standard year) */
  months: number;
}

export interface PlannedHire {
  id: string;
  segment: string;
  count: number;
  /** ISO date the cohort starts */
  startDate: string;
  annualQuota: number;
  ramp: RampCurve;
}

export interface CapacityResult {
  id: string;
  name: string;
  segment: string;
  role: Role;
  reportsToId: string;
  /** Quota for the plan period (prorated for partial-period tenure is NOT applied to quota; quota is target) */
  quota: number;
  /** Ramped, attrition-adjusted expected production for the plan period */
  capacity: number;
  /** capacity / quota, as a percentage. null when quota is 0. */
  coveragePct: number | null;
  monthlyCapacity: number[];
  directReports: CapacityResult[];
}

// ---------- Date helpers ----------

/** Month index of `date` relative to plan start (0 = first plan month). Negative = before plan. */
export function monthOffset(period: PlanPeriod, isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00');
  return (d.getFullYear() - period.startYear) * 12 + (d.getMonth() - period.startMonth);
}

/** Whole months of tenure a rep has at the START of plan-month m (0-indexed).
 *  A rep starting mid-month counts that month as ramp month 0. */
export function tenureMonthsAt(period: PlanPeriod, rep: { startDate: string }, m: number): number {
  return m - monthOffset(period, rep.startDate);
}

// ---------- Ramp ----------

/** Productivity % (0-100) for a rep in their Nth month of tenure (0-indexed). */
export function rampPct(ramp: RampCurve, tenureMonth: number): number {
  if (tenureMonth < 0) return 0;
  if (tenureMonth >= ramp.rampMonths) return 100;
  if (ramp.type === 'stepped' && ramp.steps && ramp.steps.length > 0) {
    const idx = Math.min(tenureMonth, ramp.steps.length - 1);
    return Math.max(0, Math.min(100, ramp.steps[idx]));
  }
  // linear: month 0 of a 4-month ramp = 25%, month 3 = 100%
  return ((tenureMonth + 1) / ramp.rampMonths) * 100;
}

// ---------- Monthly capacity ----------

/** Expected production for one AE in one plan month. */
export function monthlyCapacity(period: PlanPeriod, rep: Rep, m: number): number {
  if (rep.role !== 'AE') return 0;
  if (m < 0 || m >= period.months) return 0;

  const tenure = tenureMonthsAt(period, rep, m);
  if (tenure < 0) return 0; // hasn't started

  // Attrition: no capacity from the departure month onward
  if (rep.endDate !== undefined) {
    const endOffset = monthOffset(period, rep.endDate);
    if (m >= endOffset) return 0;
  }

  const pct = rampPct(rep.ramp, tenure) / 100;
  return (rep.annualQuota / period.months) * pct;
}

/** Full-period capacity vector for an AE. */
export function capacityVector(period: PlanPeriod, rep: Rep): number[] {
  return Array.from({ length: period.months }, (_, m) => monthlyCapacity(period, rep, m));
}

// ---------- Hiring plan expansion ----------

/** Expand a planned-hire cohort into synthetic Rep records so hires flow into the model. */
export function expandHiringPlan(hires: PlannedHire[]): Rep[] {
  const reps: Rep[] = [];
  for (const h of hires) {
    for (let i = 0; i < h.count; i++) {
      reps.push({
        id: `${h.id}-h${i + 1}`,
        name: `Planned Hire (${h.segment}) #${i + 1}`,
        segment: h.segment,
        role: 'AE',
        reportsToId: '',
        startDate: h.startDate,
        annualQuota: h.annualQuota,
        ramp: h.ramp,
        haircut: 0,
      });
    }
  }
  return reps;
}

// ---------- Roll-up ----------

const ROLLUP_ORDER: Role[] = ['AE', 'Manager', 'Director', 'VP'];

/**
 * Compute the full capacity tree.
 * - AEs: capacity = ramped/attrition-adjusted production; quota = annualQuota prorated to period length.
 * - Managers/Directors/VPs: capacity = sum of direct reports' capacity;
 *   quota = explicit annualQuota if > 0, else capacity * (1 - haircut/100).
 * Throws on duplicate IDs or unknown reportsToId (data integrity guardrails).
 */
export function computeCapacity(period: PlanPeriod, reps: Rep[]): CapacityResult[] {
  // Integrity checks — the silent-breakage class of bugs from v1
  const ids = new Set<string>();
  for (const r of reps) {
    if (ids.has(r.id)) throw new Error(`Duplicate rep id: ${r.id}`);
    ids.add(r.id);
  }
  for (const r of reps) {
    if (r.reportsToId && !ids.has(r.reportsToId)) {
      throw new Error(`Rep ${r.name} (${r.id}) reports to unknown id: ${r.reportsToId}`);
    }
  }

  const results = new Map<string, CapacityResult>();

  for (const role of ROLLUP_ORDER) {
    for (const rep of reps.filter((r) => r.role === role)) {
      if (role === 'AE') {
        const vec = capacityVector(period, rep);
        const cap = vec.reduce((s, v) => s + v, 0);
        const quota = rep.annualQuota * (period.months / 12);
        results.set(rep.id, {
          id: rep.id,
          name: rep.name,
          segment: rep.segment,
          role: rep.role,
          reportsToId: rep.reportsToId,
          quota,
          capacity: cap,
          coveragePct: quota > 0 ? (cap / quota) * 100 : null,
          monthlyCapacity: vec,
          directReports: [],
        });
      } else {
        const children = [...results.values()].filter((c) => c.reportsToId === rep.id);
        const vec = Array.from({ length: period.months }, (_, m) =>
          children.reduce((s, c) => s + c.monthlyCapacity[m], 0)
        );
        const cap = vec.reduce((s, v) => s + v, 0);
        // Haircut derives quota from team capacity when no explicit quota is set
        const derivedQuota =
          rep.annualQuota > 0 ? rep.annualQuota * (period.months / 12) : cap * (1 - rep.haircut / 100);
        results.set(rep.id, {
          id: rep.id,
          name: rep.name,
          segment: rep.segment,
          role: rep.role,
          reportsToId: rep.reportsToId,
          quota: derivedQuota,
          capacity: cap,
          coveragePct: derivedQuota > 0 ? (cap / derivedQuota) * 100 : null,
          monthlyCapacity: vec,
          directReports: children,
        });
      }
    }
  }

  return [...results.values()];
}

// ---------- Aggregates ----------

export interface TeamSummary {
  segment: string;
  quota: number;
  capacity: number;
  coveragePct: number | null;
  aeCount: number;
  fullyRampedCount: number;
  rampingCount: number;
}

/** Per-segment summary across AEs, evaluated at a given plan month for ramp status. */
export function summarizeBySegment(
  period: PlanPeriod,
  reps: Rep[],
  results: CapacityResult[],
  asOfMonth: number
): TeamSummary[] {
  const aes = results.filter((r) => r.role === 'AE');
  const segments = [...new Set(aes.map((a) => a.segment))].sort();

  return segments.map((seg) => {
    const segAEs = aes.filter((a) => a.segment === seg);
    const segReps = reps.filter((r) => r.role === 'AE' && r.segment === seg);
    const quota = segAEs.reduce((s, a) => s + a.quota, 0);
    const capacity = segAEs.reduce((s, a) => s + a.capacity, 0);
    const fullyRamped = segReps.filter(
      (r) => tenureMonthsAt(period, r, asOfMonth) >= r.ramp.rampMonths
    ).length;
    const active = segReps.filter((r) => tenureMonthsAt(period, r, asOfMonth) >= 0).length;
    return {
      segment: seg,
      quota,
      capacity,
      coveragePct: quota > 0 ? (capacity / quota) * 100 : null,
      aeCount: segReps.length,
      fullyRampedCount: fullyRamped,
      rampingCount: Math.max(0, active - fullyRamped),
    };
  });
}
