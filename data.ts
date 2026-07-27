/**
 * Seed data + CSV import/export.
 *
 * Import produces Rep[] — the engine's input type is the contract, so a
 * Salesforce ingestion layer later just needs to emit the same shape.
 */

import type { Rep, PlannedHire, Role } from './engine';

export const SEED_REPS: Rep[] = [
  { id: 'r-mgr-ent', name: 'Mike Johnson', segment: 'Enterprise', role: 'Manager', reportsToId: 'r-dir', startDate: '2024-01-01', annualQuota: 0, ramp: { type: 'linear', rampMonths: 0 }, haircut: 10 },
  { id: 'r-ae-1', name: 'Sarah Chen', segment: 'Enterprise', role: 'AE', reportsToId: 'r-mgr-ent', startDate: '2026-01-01', annualQuota: 1_200_000, ramp: { type: 'linear', rampMonths: 5 }, haircut: 0 },
  { id: 'r-ae-2', name: 'James Liu', segment: 'Enterprise', role: 'AE', reportsToId: 'r-mgr-ent', startDate: '2024-10-01', annualQuota: 1_200_000, ramp: { type: 'linear', rampMonths: 5 }, haircut: 0 },

  { id: 'r-mgr-mm', name: 'Lisa Park', segment: 'Mid-Market', role: 'Manager', reportsToId: 'r-dir', startDate: '2024-01-01', annualQuota: 0, ramp: { type: 'linear', rampMonths: 0 }, haircut: 10 },
  { id: 'r-ae-3', name: 'Emily Rodriguez', segment: 'Mid-Market', role: 'AE', reportsToId: 'r-mgr-mm', startDate: '2024-11-01', annualQuota: 800_000, ramp: { type: 'linear', rampMonths: 4 }, haircut: 0 },
  { id: 'r-ae-4', name: 'David Kim', segment: 'Mid-Market', role: 'AE', reportsToId: 'r-mgr-mm', startDate: '2024-08-01', annualQuota: 800_000, ramp: { type: 'linear', rampMonths: 4 }, haircut: 0 },

  { id: 'r-mgr-com', name: 'Jessica Wu', segment: 'Commercial', role: 'Manager', reportsToId: 'r-dir', startDate: '2024-01-01', annualQuota: 0, ramp: { type: 'linear', rampMonths: 0 }, haircut: 10 },
  { id: 'r-ae-5', name: 'Chris Taylor', segment: 'Commercial', role: 'AE', reportsToId: 'r-mgr-com', startDate: '2024-09-01', annualQuota: 500_000, ramp: { type: 'linear', rampMonths: 3 }, haircut: 0 },
  { id: 'r-ae-6', name: 'Morgan Smith', segment: 'Commercial', role: 'AE', reportsToId: 'r-mgr-com', startDate: '2026-01-15', annualQuota: 500_000, ramp: { type: 'linear', rampMonths: 3 }, haircut: 0 },

  { id: 'r-dir', name: 'Robert Chen', segment: 'All', role: 'Director', reportsToId: 'r-vp', startDate: '2024-01-01', annualQuota: 0, ramp: { type: 'linear', rampMonths: 0 }, haircut: 15 },
  { id: 'r-vp', name: 'Jennifer Martinez', segment: 'All', role: 'VP', reportsToId: '', startDate: '2024-01-01', annualQuota: 0, ramp: { type: 'linear', rampMonths: 0 }, haircut: 20 },
];

export const SEED_HIRES: PlannedHire[] = [
  { id: 'h-q2-ent', segment: 'Enterprise', count: 2, startDate: '2026-04-01', annualQuota: 1_200_000, ramp: { type: 'linear', rampMonths: 5 } },
];

export const ROLES: Role[] = ['AE', 'Manager', 'Director', 'VP'];

// ---------- CSV ----------

/** RFC-ish CSV line splitter: respects quoted fields containing commas. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export const CSV_HEADERS = 'id,name,segment,role,reportsToId,startDate,endDate,annualQuota,rampMonths,haircut';

export interface CsvParseResult {
  reps: Rep[];
  errors: string[];
}

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { reps: [], errors: ['CSV needs a header row and at least one data row.'] };

  const reps: Rep[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const p = splitCsvLine(lines[i]);
    const rowNum = i + 1;
    const id = p[0] || `row-${i}`;
    const name = p[1] || '';
    const role = (p[3] || 'AE') as Role;

    if (!name) { errors.push(`Row ${rowNum}: missing name.`); continue; }
    if (!ROLES.includes(role)) { errors.push(`Row ${rowNum}: unknown role "${p[3]}".`); continue; }
    if (seen.has(id)) { errors.push(`Row ${rowNum}: duplicate id "${id}".`); continue; }
    seen.add(id);

    const rampMonths = parseInt(p[8]) || 0;
    reps.push({
      id,
      name,
      segment: p[2] || 'Unassigned',
      role,
      reportsToId: p[4] || '',
      startDate: p[5] || '2026-01-01',
      endDate: p[6] || undefined,
      annualQuota: parseFloat(p[7]) || 0,
      ramp: { type: 'linear', rampMonths },
      haircut: parseFloat(p[9]) || 0,
    });
  }

  // Validate the org tree before handing it to the engine
  const ids = new Set(reps.map((r) => r.id));
  for (const r of reps) {
    if (r.reportsToId && !ids.has(r.reportsToId)) {
      errors.push(`${r.name}: reportsToId "${r.reportsToId}" does not match any row.`);
    }
  }

  return { reps, errors };
}

export function toCsv(reps: Rep[]): string {
  const esc = (v: string | number | undefined) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = reps.map((r) =>
    [r.id, r.name, r.segment, r.role, r.reportsToId, r.startDate, r.endDate ?? '', r.annualQuota, r.ramp.rampMonths, r.haircut]
      .map(esc)
      .join(',')
  );
  return [CSV_HEADERS, ...rows].join('\n');
}

export const CSV_TEMPLATE = `${CSV_HEADERS}
v1,Mary Wilson,All,VP,,2024-01-01,,0,0,20
d1,Bob Johnson,All,Director,v1,2024-01-01,,0,0,15
m1,Jane Smith,Sales Team A,Manager,d1,2024-01-01,,0,0,10
a1,John Doe,Sales Team A,AE,m1,2026-01-01,,1000000,4,0`;

export function downloadFile(filename: string, contents: string, mime = 'text/csv') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
