'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import {
  computeCapacity,
  expandHiringPlan,
  summarizeBySegment,
  tenureMonthsAt,
  monthOffset,
  type Rep,
  type PlannedHire,
  type PlanPeriod,
  type CapacityResult,
  type Role,
} from './lib/engine';
import { store } from './lib/storage';
import {
  SEED_REPS,
  SEED_HIRES,
  ROLES,
  parseCsv,
  toCsv,
  CSV_TEMPLATE,
  CSV_HEADERS,
  downloadFile,
} from './lib/data';

// ---------- Static class maps (Tailwind v4 cannot see interpolated classes) ----------

const TEAM_ACCENTS = [
  { header: 'bg-indigo-50/60 border-indigo-200', total: 'text-indigo-700 bg-indigo-50/60' },
  { header: 'bg-emerald-50/60 border-emerald-200', total: 'text-emerald-700 bg-emerald-50/60' },
  { header: 'bg-purple-50/60 border-purple-200', total: 'text-purple-700 bg-purple-50/60' },
  { header: 'bg-amber-50/60 border-amber-200', total: 'text-amber-700 bg-amber-50/60' },
  { header: 'bg-rose-50/60 border-rose-200', total: 'text-rose-700 bg-rose-50/60' },
  { header: 'bg-cyan-50/60 border-cyan-200', total: 'text-cyan-700 bg-cyan-50/60' },
];

const ROLE_BADGE: Record<Role, string> = {
  VP: 'bg-purple-100 text-purple-700',
  Director: 'bg-indigo-100 text-indigo-700',
  Manager: 'bg-blue-100 text-blue-700',
  AE: 'bg-emerald-100 text-emerald-700',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_PERIOD: PlanPeriod = { startYear: 2026, startMonth: 0, months: 12 };

const emptyRep = (): Rep => ({
  id: `r-${Date.now()}`,
  name: '',
  segment: 'Enterprise',
  role: 'AE',
  reportsToId: '',
  startDate: '2026-01-01',
  annualQuota: 0,
  ramp: { type: 'linear', rampMonths: 4 },
  haircut: 0,
});

export default function CapacityPlanner() {
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<'grid' | 'hierarchy' | 'management' | 'planning' | 'data'>('grid');

  const [period, setPeriod] = useState<PlanPeriod>(DEFAULT_PERIOD);
  const [reps, setReps] = useState<Rep[]>(SEED_REPS);
  const [hires, setHires] = useState<PlannedHire[]>(SEED_HIRES);

  const [selectedMonth, setSelectedMonth] = useState(-1); // -1 = full period
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [includeHires, setIncludeHires] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Rep | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newRep, setNewRep] = useState<Rep>(emptyRep());

  const [csvInput, setCsvInput] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [engineError, setEngineError] = useState<string | null>(null);

  // ---------- Load / persist ----------

  useEffect(() => {
    setReps(store.loadReps(SEED_REPS));
    setHires(store.loadHires(SEED_HIRES));
    setPeriod(store.loadPeriod(DEFAULT_PERIOD));
    setMounted(true);
  }, []);

  useEffect(() => { if (mounted) store.saveReps(reps); }, [reps, mounted]);
  useEffect(() => { if (mounted) store.saveHires(hires); }, [hires, mounted]);
  useEffect(() => { if (mounted) store.savePeriod(period); }, [period, mounted]);

  // ---------- Engine ----------

  /** Planned hires expand into synthetic reps so scenarios move the numbers. */
  const scenarioReps = useMemo(
    () => (includeHires ? [...reps, ...expandHiringPlan(hires)] : reps),
    [reps, hires, includeHires]
  );

  const results: CapacityResult[] = useMemo(() => {
    try {
      const r = computeCapacity(period, scenarioReps);
      setEngineError(null);
      return r;
    } catch (e) {
      setEngineError(e instanceof Error ? e.message : String(e));
      return [];
    }
  }, [period, scenarioReps]);

  const byId = useMemo(() => new Map(results.map((r) => [r.id, r])), [results]);
  const aeResults = useMemo(() => results.filter((r) => r.role === 'AE'), [results]);

  const teams = useMemo(
    () => [...new Set(aeResults.map((a) => a.segment))].sort(),
    [aeResults]
  );

  const visibleAEs = useMemo(
    () => (teamFilter === 'All Teams' ? aeResults : aeResults.filter((a) => a.segment === teamFilter)),
    [aeResults, teamFilter]
  );

  const asOfMonth = selectedMonth === -1 ? period.months - 1 : selectedMonth;

  const segmentSummary = useMemo(
    () => summarizeBySegment(period, scenarioReps, results, asOfMonth),
    [period, scenarioReps, results, asOfMonth]
  );

  // ---------- Headline stats ----------

  const stats = useMemo(() => {
    const quota =
      selectedMonth === -1
        ? visibleAEs.reduce((s, a) => s + a.quota, 0)
        : visibleAEs.reduce((s, a) => s + a.quota / period.months, 0);
    const capacity =
      selectedMonth === -1
        ? visibleAEs.reduce((s, a) => s + a.capacity, 0)
        : visibleAEs.reduce((s, a) => s + a.monthlyCapacity[selectedMonth], 0);

    const sourceReps = scenarioReps.filter(
      (r) => r.role === 'AE' && (teamFilter === 'All Teams' || r.segment === teamFilter)
    );
    const active = sourceReps.filter((r) => tenureMonthsAt(period, r, asOfMonth) >= 0);
    const ramped = active.filter((r) => tenureMonthsAt(period, r, asOfMonth) >= r.ramp.rampMonths);

    return {
      quota,
      capacity,
      coverage: quota > 0 ? (capacity / quota) * 100 : 0,
      totalAEs: sourceReps.length,
      fullyRamped: ramped.length,
      ramping: active.length - ramped.length,
    };
  }, [visibleAEs, scenarioReps, selectedMonth, period, teamFilter, asOfMonth]);

  const trendData = useMemo(
    () =>
      Array.from({ length: period.months }, (_, m) => ({
        month: MONTH_LABELS[(period.startMonth + m) % 12],
        quota: Math.round(visibleAEs.reduce((s, a) => s + a.quota / period.months, 0)),
        capacity: Math.round(visibleAEs.reduce((s, a) => s + a.monthlyCapacity[m], 0)),
        fullyRamped: Math.round(
          scenarioReps
            .filter((r) => r.role === 'AE' && (teamFilter === 'All Teams' || r.segment === teamFilter))
            .filter((r) => tenureMonthsAt(period, r, m) >= r.ramp.rampMonths)
            .reduce((s, r) => s + r.annualQuota / period.months, 0)
        ),
      })),
    [visibleAEs, scenarioReps, period, teamFilter]
  );

  // ---------- Formatting ----------

  const fmt = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
  const fmtK = (n: number) => '$' + Math.round(n / 1000) + 'K';
  const pct = (v: number | null) => (v === null ? 'N/A' : v.toFixed(1) + '%');

  const quarterTotal = (r: CapacityResult, q: number) =>
    r.monthlyCapacity.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0);

  // ---------- Handlers ----------

  const toggleRow = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const saveEdit = () => {
    if (!editForm) return;
    setReps(reps.map((r) => (r.id === editingId ? editForm : r)));
    setEditingId(null);
    setEditForm(null);
  };

  const deleteRep = (id: string) => {
    const orphans = reps.filter((r) => r.reportsToId === id);
    const msg = orphans.length
      ? `This person has ${orphans.length} direct report(s). They will be moved to unassigned. Continue?`
      : 'Delete this person?';
    if (!confirm(msg)) return;
    setReps(reps.filter((r) => r.id !== id).map((r) => (r.reportsToId === id ? { ...r, reportsToId: '' } : r)));
  };

  const addRep = () => {
    if (!newRep.name.trim()) return;
    setReps([...reps, { ...newRep, id: `r-${Date.now()}` }]);
    setNewRep(emptyRep());
    setIsAdding(false);
  };

  const importCsv = () => {
    const { reps: parsed, errors } = parseCsv(csvInput);
    setCsvErrors(errors);
    if (parsed.length && errors.length === 0) {
      setReps(parsed);
      setCsvInput('');
    }
  };

  const managerOptions = reps.filter((r) => r.role !== 'AE');

  // ---------- Render ----------

  if (!mounted) {
    return (
      <div className="w-full min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-600">Loading…</div>
      </div>
    );
  }

  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedSource = selectedId ? scenarioReps.find((r) => r.id === selectedId) : null;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50">
      <header className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border-b border-stone-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">CapacityPro</h1>
              <p className="text-xs text-stone-400 font-medium">Revenue Capacity Planning</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 bg-stone-800 border border-stone-700 text-stone-200 rounded-lg text-sm font-medium"
            >
              <option value={-1}>Full Plan ({period.startYear})</option>
              {Array.from({ length: period.months }, (_, m) => (
                <option key={m} value={m}>
                  {MONTH_LABELS[(period.startMonth + m) % 12]} {period.startYear + Math.floor((period.startMonth + m) / 12)}
                </option>
              ))}
            </select>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-4 py-2 bg-stone-800 border border-stone-700 text-stone-200 rounded-lg text-sm font-medium"
            >
              <option>All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {engineError && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-5">
            <div className="font-bold mb-1">Plan data problem</div>
            <div className="text-sm">{engineError}</div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md mb-8 p-1.5 inline-flex gap-1 border border-stone-200 flex-wrap">
          {([
            ['grid', 'Dashboard'],
            ['hierarchy', 'Hierarchy'],
            ['management', 'Management'],
            ['planning', 'Planning'],
            ['data', 'Data Manager'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`px-6 py-2.5 font-bold rounded-lg transition-all text-sm ${
                activeView === key
                  ? 'bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-lg'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900">{selected.name}</h2>
                  <p className="text-stone-600 mt-1 font-medium">{selected.role} • {selected.segment}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-stone-400 hover:text-stone-600 text-3xl leading-none">×</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-4 uppercase tracking-wide">Profile</h3>
                  <div className="space-y-3 text-sm">
                    <Row label="Manager" value={byId.get(selected.reportsToId)?.name ?? 'None'} />
                    <Row label="Start Date" value={selectedSource?.startDate ?? '—'} />
                    {selectedSource?.endDate && <Row label="Departure" value={selectedSource.endDate} />}
                    <Row label="Ramp" value={`${selectedSource?.ramp.rampMonths ?? 0} months`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-4 uppercase tracking-wide">Quota</h3>
                  <div className="space-y-3 text-sm">
                    <Row label="Plan Quota" value={fmt(selected.quota)} />
                    <Row label="Capacity" value={fmt(selected.capacity)} />
                    <Row label="Coverage" value={pct(selected.coveragePct)} />
                  </div>
                </div>
              </div>
              {selected.role === 'AE' && selectedSource && (
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wide">Ramp Progress</h3>
                  <div className="bg-stone-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full flex items-center justify-center text-white text-sm font-bold"
                      style={{
                        width: `${Math.min(100, Math.max(0, selectedSource.ramp.rampMonths === 0 ? 100 : ((tenureMonthsAt(period, selectedSource, asOfMonth) + 1) / selectedSource.ramp.rampMonths) * 100))}%`,
                      }}
                    >
                      {Math.round(Math.min(100, Math.max(0, selectedSource.ramp.rampMonths === 0 ? 100 : ((tenureMonthsAt(period, selectedSource, asOfMonth) + 1) / selectedSource.ramp.rampMonths) * 100)))}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- Dashboard ---------------- */}
        {activeView === 'grid' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <Card label="Team Quota" value={fmt(stats.quota)} sub={selectedMonth === -1 ? 'Plan Target' : 'Monthly Target'} />
              <Card label="Active Capacity" value={fmt(stats.capacity)} sub="Ramped Delivery" valueClass="text-indigo-600" />
              <Card
                label="Quota Coverage"
                value={stats.coverage.toFixed(1) + '%'}
                sub={stats.coverage >= 100 ? 'On Track' : 'Below Target'}
                valueClass={stats.coverage >= 100 ? 'text-emerald-600' : 'text-amber-500'}
              />
              <div className="bg-white rounded-xl shadow-lg p-6 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Headcount</div>
                <div className="text-3xl font-bold text-stone-900 mb-2">{stats.totalAEs} AEs</div>
                <div className="text-xs font-medium">
                  <span className="text-emerald-600 font-bold">{stats.fullyRamped} ramped</span>
                  <span className="mx-1.5 text-stone-300">•</span>
                  <span className="text-indigo-600 font-bold">{stats.ramping} ramping</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 mb-8 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-bold text-stone-900">Capacity Trend</h2>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-600">
                  <input type="checkbox" checked={includeHires} onChange={(e) => setIncludeHires(e.target.checked)} />
                  Include planned hires
                </label>
              </div>
              <div className="p-4 sm:p-7">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="month" stroke="#78716c" tickLine={false} style={{ fontSize: 13 }} />
                    <YAxis stroke="#78716c" tickLine={false} style={{ fontSize: 13 }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend iconType="line" wrapperStyle={{ paddingTop: 20 }} />
                    <Line type="monotone" dataKey="quota" stroke="#a8a29e" strokeWidth={2.5} strokeDasharray="6 4" dot={false} name="Target Quota" />
                    <Line type="monotone" dataKey="capacity" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Active Capacity" />
                    <Line type="monotone" dataKey="fullyRamped" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Fully Ramped" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50">
                <h2 className="text-lg font-bold text-stone-900">Quarterly Capacity by Team</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">Rep</th>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                        <th key={q} className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">{q}</th>
                      ))}
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide bg-indigo-50">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(teamFilter === 'All Teams' ? teams : [teamFilter]).map((team, ti) => {
                      const rows = visibleAEs.filter((a) => a.segment === team);
                      if (!rows.length) return null;
                      const accent = TEAM_ACCENTS[ti % TEAM_ACCENTS.length];
                      return (
                        <React.Fragment key={team}>
                          <tr className={`${accent.header} border-t-2`}>
                            <td colSpan={6} className="px-6 py-3 font-bold text-stone-900 text-sm">{team}</td>
                          </tr>
                          {rows.map((r) => (
                            <tr key={r.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setSelectedId(r.id)}>
                              <td className="px-6 py-4 font-medium text-stone-900">{r.name}</td>
                              {[0, 1, 2, 3].map((q) => (
                                <td key={q} className="px-6 py-4 text-right text-stone-700 font-semibold">{fmtK(quarterTotal(r, q))}</td>
                              ))}
                              <td className={`px-6 py-4 text-right font-bold ${accent.total}`}>{fmtK(r.capacity)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    <tr className="bg-stone-900 text-white font-bold">
                      <td className="px-6 py-4 text-sm uppercase tracking-wide">Total</td>
                      {[0, 1, 2, 3].map((q) => (
                        <td key={q} className="px-6 py-4 text-right">
                          {fmtK(visibleAEs.reduce((s, r) => s + quarterTotal(r, q), 0))}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right text-lg">{fmt(visibleAEs.reduce((s, r) => s + r.capacity, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ---------------- Hierarchy ---------------- */}
        {activeView === 'hierarchy' && (
          <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
            <div className="px-7 py-5 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-stone-900">Organization Structure</h2>
              <div className="flex gap-2">
                <button onClick={() => setExpanded(new Set(results.filter((r) => r.directReports.length).map((r) => r.id)))} className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg">Expand All</button>
                <button onClick={() => setExpanded(new Set())} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 rounded-lg">Collapse All</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">Name</th>
                    <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Quota</th>
                    <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Capacity</th>
                    <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Coverage</th>
                    <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide"># AEs</th>
                  </tr>
                </thead>
                <tbody>
                  {results
                    .filter((r) => !r.reportsToId)
                    .flatMap((root) =>
                      renderTree(root, 0, expanded, toggleRow, setSelectedId, fmt, pct)
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- Management ---------------- */}
        {activeView === 'management' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Management</h2>
              <p className="text-stone-600">Edit the plan roster. Reporting lines use stable IDs, so renaming someone never breaks the org chart.</p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex justify-between items-center border border-stone-200">
              <button onClick={() => setIsAdding(true)} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm shadow-md">
                + Add Person
              </button>
              <div className="text-sm text-stone-600 font-medium">{reps.length} people in plan</div>
            </div>

            {isAdding && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-stone-900 mb-4">Add New Person</h3>
                <RepFields rep={newRep} onChange={setNewRep} managerOptions={managerOptions} teams={teams} />
                <div className="flex gap-3 mt-4">
                  <button onClick={addRep} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">Save</button>
                  <button onClick={() => setIsAdding(false)} className="px-5 py-2 bg-stone-300 text-stone-700 rounded-lg font-bold text-sm">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-x-auto mb-6">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    {['Name', 'Team', 'Role', 'Reports To', 'Start', 'End', 'Quota', 'Ramp', 'Haircut', ''].map((h) => (
                      <th key={h} className="px-5 py-4 text-left font-bold text-stone-700 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reps.map((rep) => (
                    <tr key={rep.id} className="hover:bg-stone-50">
                      {editingId === rep.id && editForm ? (
                        <td colSpan={10} className="px-5 py-4 bg-indigo-50/50">
                          <RepFields rep={editForm} onChange={setEditForm} managerOptions={managerOptions.filter((m) => m.id !== rep.id)} teams={teams} />
                          <div className="flex gap-3 mt-4">
                            <button onClick={saveEdit} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Save</button>
                            <button onClick={() => { setEditingId(null); setEditForm(null); }} className="px-4 py-2 bg-stone-300 text-stone-700 rounded-lg text-sm font-bold">Cancel</button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-5 py-4 font-semibold text-stone-900">{rep.name}</td>
                          <td className="px-5 py-4 text-stone-700 text-sm">{rep.segment}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${ROLE_BADGE[rep.role]}`}>{rep.role}</span>
                          </td>
                          <td className="px-5 py-4 text-stone-600 text-sm">{reps.find((r) => r.id === rep.reportsToId)?.name ?? '—'}</td>
                          <td className="px-5 py-4 text-stone-700 text-sm">{rep.startDate}</td>
                          <td className="px-5 py-4 text-amber-700 text-sm">{rep.endDate ?? '—'}</td>
                          <td className="px-5 py-4 text-right font-bold text-stone-900 text-sm">{fmt(rep.annualQuota)}</td>
                          <td className="px-5 py-4 text-right text-stone-700 text-sm">{rep.ramp.rampMonths}mo</td>
                          <td className="px-5 py-4 text-right text-stone-700 text-sm">{rep.haircut}%</td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingId(rep.id); setEditForm({ ...rep }); }} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">Edit</button>
                              <button onClick={() => deleteRep(rep.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- Planning ---------------- */}
        {activeView === 'planning' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Planning</h2>
              <p className="text-stone-600">Model hiring and attrition. Every change here flows through the same engine as the dashboard.</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-7 mb-6">
              <h3 className="text-xl font-bold text-stone-900 mb-2">Plan Period</h3>
              <p className="text-sm text-stone-600 mb-5">Set a fiscal start month if your year doesn&apos;t begin in January.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Start Year">
                  <input type="number" value={period.startYear} onChange={(e) => setPeriod({ ...period, startYear: parseInt(e.target.value) || period.startYear })} className={inputCls} />
                </Field>
                <Field label="Start Month">
                  <select value={period.startMonth} onChange={(e) => setPeriod({ ...period, startMonth: parseInt(e.target.value) })} className={inputCls}>
                    {MONTH_LABELS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Months in Plan">
                  <input type="number" value={period.months} onChange={(e) => setPeriod({ ...period, months: Math.max(1, parseInt(e.target.value) || 12) })} className={inputCls} />
                </Field>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-7 mb-6">
              <h3 className="text-xl font-bold text-stone-900 mb-2">Hiring Plan</h3>
              <p className="text-sm text-stone-600 mb-5">Each cohort expands into ramping reps and lands in the capacity numbers immediately.</p>
              <div className="space-y-4">
                {hires.map((h, idx) => (
                  <div key={h.id} className="bg-stone-50 rounded-lg p-5 border border-stone-200 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                    <Field label="Team">
                      <input value={h.segment} onChange={(e) => updateHire(hires, setHires, idx, { segment: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="# of AEs">
                      <input type="number" value={h.count} onChange={(e) => updateHire(hires, setHires, idx, { count: Math.max(0, parseInt(e.target.value) || 0) })} className={inputCls} />
                    </Field>
                    <Field label="Start Date">
                      <input type="date" value={h.startDate} onChange={(e) => updateHire(hires, setHires, idx, { startDate: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Quota Each">
                      <input type="number" value={h.annualQuota} onChange={(e) => updateHire(hires, setHires, idx, { annualQuota: parseInt(e.target.value) || 0 })} className={inputCls} />
                    </Field>
                    <div className="flex gap-2">
                      <Field label="Ramp (mo)">
                        <input type="number" value={h.ramp.rampMonths} onChange={(e) => updateHire(hires, setHires, idx, { ramp: { type: 'linear', rampMonths: parseInt(e.target.value) || 0 } })} className={inputCls} />
                      </Field>
                      <button onClick={() => setHires(hires.filter((_, i) => i !== idx))} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold h-10 self-end">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setHires([...hires, { id: `h-${Date.now()}`, segment: teams[0] ?? 'Enterprise', count: 1, startDate: `${period.startYear}-07-01`, annualQuota: 800_000, ramp: { type: 'linear', rampMonths: 4 } }])}
                className="mt-4 px-5 py-2.5 bg-stone-200 text-stone-700 rounded-lg font-bold text-sm"
              >
                + Add Hiring Cohort
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-7 mb-6">
              <h3 className="text-xl font-bold text-stone-900 mb-2">Attrition</h3>
              <p className="text-sm text-stone-600 mb-5">Set a departure date on a rep and their capacity stops that month.</p>
              <div className="space-y-3">
                {reps.filter((r) => r.role === 'AE').map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100">
                    <span className="font-medium text-stone-900">{r.name} <span className="text-stone-500 text-sm">• {r.segment}</span></span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={r.endDate ?? ''}
                        onChange={(e) => setReps(reps.map((x) => (x.id === r.id ? { ...x, endDate: e.target.value || undefined } : x)))}
                        className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm"
                      />
                      {r.endDate && (
                        <button onClick={() => setReps(reps.map((x) => (x.id === r.id ? { ...x, endDate: undefined } : x)))} className="px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold">Clear</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-7">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wide mb-5">Scenario Impact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center mb-6">
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase mb-1">Capacity w/ Plan</div>
                  <div className="text-3xl font-bold text-indigo-600">{fmt(aeResults.reduce((s, a) => s + a.capacity, 0))}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase mb-1">Planned Hires</div>
                  <div className="text-3xl font-bold text-emerald-600">+{hires.reduce((s, h) => s + h.count, 0)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase mb-1">Departures</div>
                  <div className="text-3xl font-bold text-amber-600">-{reps.filter((r) => r.endDate && monthOffset(period, r.endDate) < period.months).length}</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 uppercase text-xs font-bold">
                    <th className="py-2">Team</th>
                    <th className="py-2 text-right">Quota</th>
                    <th className="py-2 text-right">Capacity</th>
                    <th className="py-2 text-right">Coverage</th>
                    <th className="py-2 text-right">Ramped / Ramping</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentSummary.map((s) => (
                    <tr key={s.segment} className="border-t border-indigo-100">
                      <td className="py-2 font-semibold text-stone-900">{s.segment}</td>
                      <td className="py-2 text-right">{fmt(s.quota)}</td>
                      <td className="py-2 text-right text-indigo-600 font-semibold">{fmt(s.capacity)}</td>
                      <td className={`py-2 text-right font-bold ${(s.coveragePct ?? 0) >= 100 ? 'text-emerald-600' : 'text-amber-500'}`}>{pct(s.coveragePct)}</td>
                      <td className="py-2 text-right text-stone-600">{s.fullyRampedCount} / {s.rampingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- Data Manager ---------------- */}
        {activeView === 'data' && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-7 mb-8 border border-stone-200">
              <h2 className="text-xl font-bold mb-2 text-stone-900">Import Roster</h2>
              <p className="text-sm text-stone-600 mb-4 font-mono break-all">{CSV_HEADERS}</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-36 border-2 border-stone-200 rounded-xl p-4 font-mono text-sm mb-4 resize-none"
                placeholder="Paste CSV data here…"
              />
              {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="font-bold text-red-800 text-sm mb-2">Import blocked ({csvErrors.length} issue{csvErrors.length > 1 ? 's' : ''})</div>
                  <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                    {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => downloadFile('capacity_template.csv', CSV_TEMPLATE)} className="px-5 py-2.5 bg-stone-700 text-white rounded-lg font-bold text-sm">Download Template</button>
                <button onClick={importCsv} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm">Import</button>
                <button onClick={() => downloadFile('capacity_roster.csv', toCsv(reps))} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-bold text-sm">Export Roster</button>
                <button
                  onClick={() => { if (confirm('Reset to sample data?')) { store.clearAll(); setReps(SEED_REPS); setHires(SEED_HIRES); setPeriod(DEFAULT_PERIOD); } }}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold text-sm"
                >
                  Reset Data
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-x-auto">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50">
                <h3 className="text-lg font-bold text-stone-900">All Plan Members</h3>
              </div>
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    {['Name', 'Role', 'Quota', 'Capacity', 'Coverage'].map((h) => (
                      <th key={h} className="px-7 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setSelectedId(r.id)}>
                      <td className="px-7 py-5 font-semibold text-stone-900">{r.name}</td>
                      <td className="px-7 py-5 text-stone-700 font-medium">{r.role}</td>
                      <td className="px-7 py-5 text-right font-bold text-stone-900">{fmt(r.quota)}</td>
                      <td className="px-7 py-5 text-right text-indigo-600 font-bold">{fmt(r.capacity)}</td>
                      <td className={`px-7 py-5 text-right font-bold ${(r.coveragePct ?? 0) >= 100 ? 'text-emerald-600' : 'text-amber-500'}`}>{pct(r.coveragePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <footer className="bg-gradient-to-r from-stone-900 to-stone-800 border-t border-stone-700 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-stone-400 font-medium">
            <strong className="text-white font-bold">CapacityPro</strong> — Revenue Capacity Planning
          </div>
          <div className="text-sm text-stone-500 font-medium">v2.0.0</div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Small helpers / subcomponents ----------

const inputCls = 'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-2">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-stone-100">
      <span className="text-stone-600 font-medium">{label}</span>
      <span className="font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function Card({ label, value, sub, valueClass = 'text-stone-900' }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-stone-200">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold mb-2 ${valueClass}`}>{value}</div>
      <div className="text-xs text-stone-600 font-medium">{sub}</div>
    </div>
  );
}

function RepFields({
  rep,
  onChange,
  managerOptions,
  teams,
}: {
  rep: Rep;
  onChange: (r: Rep) => void;
  managerOptions: Rep[];
  teams: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Field label="Name">
        <input value={rep.name} onChange={(e) => onChange({ ...rep, name: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Team">
        <input list="team-options" value={rep.segment} onChange={(e) => onChange({ ...rep, segment: e.target.value })} className={inputCls} />
        <datalist id="team-options">{teams.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field label="Role">
        <select value={rep.role} onChange={(e) => onChange({ ...rep, role: e.target.value as Role })} className={inputCls}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Reports To">
        <select value={rep.reportsToId} onChange={(e) => onChange({ ...rep, reportsToId: e.target.value })} className={inputCls}>
          <option value="">— none —</option>
          {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
        </select>
      </Field>
      <Field label="Start Date">
        <input type="date" value={rep.startDate} onChange={(e) => onChange({ ...rep, startDate: e.target.value })} className={inputCls} />
      </Field>
      <Field label="End Date">
        <input type="date" value={rep.endDate ?? ''} onChange={(e) => onChange({ ...rep, endDate: e.target.value || undefined })} className={inputCls} />
      </Field>
      <Field label="Annual Quota">
        <input type="number" value={rep.annualQuota || ''} onChange={(e) => onChange({ ...rep, annualQuota: parseInt(e.target.value) || 0 })} className={inputCls} />
      </Field>
      <Field label="Ramp / Haircut">
        <div className="flex gap-2">
          <input type="number" value={rep.ramp.rampMonths} onChange={(e) => onChange({ ...rep, ramp: { type: 'linear', rampMonths: parseInt(e.target.value) || 0 } })} className={inputCls} />
          <input type="number" value={rep.haircut} onChange={(e) => onChange({ ...rep, haircut: parseInt(e.target.value) || 0 })} className={inputCls} />
        </div>
      </Field>
    </div>
  );
}

function updateHire(
  hires: PlannedHire[],
  setHires: (h: PlannedHire[]) => void,
  idx: number,
  patch: Partial<PlannedHire>
) {
  setHires(hires.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
}

function countAEs(node: CapacityResult): number {
  if (node.role === 'AE') return 1;
  return node.directReports.reduce((s, c) => s + countAEs(c), 0);
}

function renderTree(
  node: CapacityResult,
  level: number,
  expanded: Set<string>,
  toggle: (id: string) => void,
  select: (id: string) => void,
  fmt: (n: number) => string,
  pct: (v: number | null) => string
): React.ReactNode[] {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.directReports.length > 0;
  const aeCount = countAEs(node);
  const rows: React.ReactNode[] = [];

  rows.push(
    <tr
      key={node.id}
      className="hover:bg-stone-50 cursor-pointer border-b border-stone-100"
      onClick={() => (node.role === 'AE' ? select(node.id) : hasChildren && toggle(node.id))}
    >
      <td className="px-6 py-4" style={{ paddingLeft: `${level * 2.5 + 1.5}rem` }}>
        <div className="flex items-center gap-2">
          {hasChildren && <span className="text-stone-400 font-bold">{isOpen ? '▼' : '▶'}</span>}
          <div>
            <div className="font-semibold text-stone-900">{node.name}</div>
            <div className="text-xs text-stone-500">
              {node.role}
              {!isOpen && hasChildren && <span className="ml-2 text-stone-400">({node.directReports.length} direct • {aeCount} AEs)</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right font-semibold text-stone-900">{fmt(node.quota)}</td>
      <td className="px-6 py-4 text-right font-semibold text-indigo-600">{fmt(node.capacity)}</td>
      <td className={`px-6 py-4 text-right font-bold ${(node.coveragePct ?? 0) >= 100 ? 'text-emerald-600' : 'text-amber-500'}`}>{pct(node.coveragePct)}</td>
      <td className="px-6 py-4 text-right font-semibold text-stone-700">{aeCount || '-'}</td>
    </tr>
  );

  if (isOpen) {
    [...node.directReports]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => rows.push(...renderTree(c, level + 1, expanded, toggle, select, fmt, pct)));
  }

  return rows;
}
