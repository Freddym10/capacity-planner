'use client';

import React, { useState, useEffect } from 'react';

export default function QuotaCapacityPlanner() {
  const [activeView, setActiveView] = useState('grid');
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  
  const [reps, setReps] = useState(() => {
    // Try to load from localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('capacityPlannerReps');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error loading saved data:', e);
        }
      }
    }
    // Default data if nothing saved
    return [
      { name: 'Sarah Chen', segment: 'Enterprise', role: 'AE', reportsTo: 'Mike Johnson', startDate: '2025-01-01', quota: 1200000, rampMonths: 5, haircut: 0 },
      { name: 'James Liu', segment: 'Enterprise', role: 'AE', reportsTo: 'Mike Johnson', startDate: '2024-10-01', quota: 1200000, rampMonths: 5, haircut: 0 },
      { name: 'Mike Johnson', segment: 'Enterprise', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 0, rampMonths: 0, haircut: 10 },
      
      { name: 'Emily Rodriguez', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-11-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'David Kim', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-08-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'Lisa Park', segment: 'Mid-Market', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 0, rampMonths: 0, haircut: 10 },
      
      { name: 'Chris Taylor', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2024-09-01', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Morgan Smith', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2025-01-15', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Jessica Wu', segment: 'Commercial', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 0, rampMonths: 0, haircut: 10 },
      
      { name: 'Robert Chen', segment: 'All', role: 'Director', reportsTo: 'Jennifer Martinez', startDate: '2024-01-01', quota: 0, rampMonths: 0, haircut: 15 },
      { name: 'Jennifer Martinez', segment: 'All', role: 'VP', reportsTo: '', startDate: '2024-01-01', quota: 0, rampMonths: 0, haircut: 20 }
    ];
  });

  const [csvInput, setCsvInput] = useState('');

  // Wait for client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-save to localStorage whenever reps change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('capacityPlannerReps', JSON.stringify(reps));
    }
  }, [reps, mounted]);

  const fmt = (n: number) => '$' + (n / 1000000).toFixed(2) + 'M';
  const fmtK = (n: number) => '$' + Math.round(n / 1000) + 'K';

  const getMonthlyQuota = (rep: any, monthIndex: number) => {
    if (rep.role !== 'AE') return 0;
    
    const start = new Date(rep.startDate);
    const monthStart = new Date(2025, monthIndex, 1);
    
    if (monthStart < start) return 0;
    
    const monthsSince = monthIndex - start.getMonth() + (start.getFullYear() === 2024 ? 12 : 0);
    let rampPct = 100;
    
    if (monthsSince < rep.rampMonths) {
      rampPct = ((monthsSince + 1) / rep.rampMonths) * 100;
    }
    
    return (rep.quota / 12) * (rampPct / 100);
  };

  const getQuarterlyQuota = (rep: any, quarterIndex: number) => {
    const startMonth = quarterIndex * 3;
    let total = 0;
    for (let i = 0; i < 3; i++) {
      total += getMonthlyQuota(rep, startMonth + i);
    }
    return total;
  };

  const calculateRampedQuota = (rep: any) => {
    if (rep.role !== 'AE') return 0;
    let total = 0;
    for (let m = 0; m < 12; m++) {
      total += getMonthlyQuota(rep, m);
    }
    return total;
  };

  const calculateCapacity = () => {
    const results: any[] = [];
    
    reps.filter((r: any) => r.role === 'AE').forEach((rep: any) => {
      const ramped = calculateRampedQuota(rep);
      results.push({
        ...rep,
        rampedQuota: ramped,
        effectiveQuota: ramped
      });
    });
    
    reps.filter((r: any) => r.role === 'Manager').forEach((mgr: any) => {
      const directs = results.filter((r: any) => r.reportsTo === mgr.name);
      const total = directs.reduce((sum: number, r: any) => sum + r.effectiveQuota, 0);
      const effective = total * (1 - mgr.haircut / 100);
      
      results.push({
        ...mgr,
        rampedQuota: total,
        effectiveQuota: effective,
        directReports: directs
      });
    });
    
    reps.filter((r: any) => r.role === 'Director').forEach((dir: any) => {
      const directs = results.filter((r: any) => r.reportsTo === dir.name);
      const total = directs.reduce((sum: number, r: any) => sum + r.effectiveQuota, 0);
      const effective = total * (1 - dir.haircut / 100);
      
      results.push({
        ...dir,
        rampedQuota: total,
        effectiveQuota: effective,
        directReports: directs
      });
    });
    
    reps.filter((r: any) => r.role === 'VP').forEach((vp: any) => {
      const directs = results.filter((r: any) => r.reportsTo === vp.name);
      const total = directs.reduce((sum: number, r: any) => sum + r.effectiveQuota, 0);
      const effective = total * (1 - vp.haircut / 100);
      
      results.push({
        ...vp,
        rampedQuota: total,
        effectiveQuota: effective,
        directReports: directs
      });
    });
    
    return results;
  };

  const capacity = calculateCapacity();
  const totalAEQuota = reps.filter((r: any) => r.role === 'AE').reduce((sum: number, r: any) => sum + r.quota, 0);
  const totalRamped = capacity.filter((r: any) => r.role === 'AE').reduce((sum: number, r: any) => sum + r.rampedQuota, 0);
  const vp = capacity.find((r: any) => r.role === 'VP');
  const totalEffective = vp?.effectiveQuota || 0;

  const handleCsvUpload = () => {
    const lines = csvInput.trim().split('\n');
    const newReps: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      newReps.push({
        name: parts[0]?.trim(),
        segment: parts[1]?.trim(),
        role: parts[2]?.trim(),
        reportsTo: parts[3]?.trim(),
        startDate: parts[4]?.trim(),
        quota: parseFloat(parts[5]) || 0,
        rampMonths: parseInt(parts[6]) || 3,
        haircut: parseFloat(parts[7]) || 0
      });
    }
    
    setReps(newReps);
    setCsvInput('');
  };

  const exportCSV = () => {
    const headers = 'Name,Segment,Role,Annual Quota,Ramped Quota,Effective Quota\n';
    const rows = capacity.map((r: any) => 
      `${r.name},${r.segment},${r.role},${r.quota},${Math.round(r.rampedQuota)},${Math.round(r.effectiveQuota)}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capacity_plan.csv';
    a.click();
  };

  const downloadTemplate = () => {
    const template = `name,segment,role,reportsTo,startDate,quota,rampMonths,haircut
John Doe,Sales Team A,AE,Jane Smith,2025-01-01,1000000,4,0
Jane Smith,Sales Team A,Manager,Bob Johnson,2024-01-01,0,0,10
Bob Johnson,Sales Team A,Director,Mary Wilson,2024-01-01,0,0,15
Mary Wilson,All,VP,,2024-01-01,0,0,20`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capacity_planner_template.csv';
    a.click();
  };

  const getRepDetails = (repName: string) => {
    const rep = capacity.find((r: any) => r.name === repName);
    if (!rep) return null;
    
    const mgr = reps.find((r: any) => r.name === rep.reportsTo);
    const start = new Date(rep.startDate);
    const now = new Date('2025-01-20');
    const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    const rampProg = rep.role === 'AE' ? Math.min(100, (monthsSince / rep.rampMonths) * 100) : 100;
    
    return {
      ...rep,
      manager: mgr?.name || 'None',
      monthsSinceStart: monthsSince,
      rampProgress: Math.round(rampProg)
    };
  };

  const aeReps = reps.filter((r: any) => r.role === 'AE');

  // Get unique team names dynamically
  const uniqueTeams = [...new Set(aeReps.map((r: any) => r.segment))].sort();

  // Calculate quick stats for grid view
  const quickStats = {
    totalAEs: aeReps.length,
    fullyRamped: aeReps.filter((rep: any) => {
      const start = new Date(rep.startDate);
      const now = new Date('2025-01-20');
      const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
      return monthsSince >= rep.rampMonths;
    }).length,
    ramping: aeReps.filter((rep: any) => {
      const start = new Date(rep.startDate);
      const now = new Date('2025-01-20');
      const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
      return monthsSince < rep.rampMonths && monthsSince >= 0;
    }).length,
    totalTeams: uniqueTeams.length,
    avgRamp: aeReps.length > 0 ? (aeReps.reduce((sum: number, r: any) => sum + r.rampMonths, 0) / aeReps.length).toFixed(1) : 0,
    totalCapacity: totalRamped,
    effectiveCapacity: totalEffective
  };

  // Show loading state until mounted on client
  if (!mounted) {
    return (
      <div className="w-full min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Professional Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">CP</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CapacityPro</h1>
                <p className="text-xs text-gray-500">Sales Planning Made Simple</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="hidden sm:inline">Built for Revenue Ops</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm mb-8 p-1 inline-flex gap-1">
          <button
            onClick={() => setActiveView('grid')}
            className={`px-6 py-2.5 font-medium rounded-md transition-all ${
              activeView === 'grid' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`px-6 py-2.5 font-medium rounded-md transition-all ${
              activeView === 'summary' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Summary
          </button>
        </div>

        {selectedRep && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedRep(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedRep.name}</h2>
                  <p className="text-gray-600">{selectedRep.role} - {selectedRep.segment}</p>
                </div>
                <button onClick={() => setSelectedRep(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Profile</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Manager:</span>
                      <span className="font-medium">{selectedRep.manager}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start Date:</span>
                      <span className="font-medium">{selectedRep.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Months Since Start:</span>
                      <span className="font-medium">{selectedRep.monthsSinceStart}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Quota Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Quota:</span>
                      <span className="font-medium">{selectedRep.quota > 0 ? fmt(selectedRep.quota) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ramped Quota:</span>
                      <span className="font-medium text-blue-600">{fmt(selectedRep.rampedQuota)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRep.role === 'AE' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Ramp Status</h3>
                  <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${selectedRep.rampProgress}%` }}
                    >
                      {selectedRep.rampProgress}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'grid' && (
          <>
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total AEs</div>
                <div className="text-2xl font-bold text-gray-900">{quickStats.totalAEs}</div>
                <div className="text-xs text-gray-600 mt-1">
                  <span className="text-green-600 font-medium">{quickStats.fullyRamped} Ramped</span>
                  {' • '}
                  <span className="text-blue-600 font-medium">{quickStats.ramping} Ramping</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Capacity</div>
                <div className="text-2xl font-bold text-blue-600">{fmt(quickStats.totalCapacity)}</div>
                <div className="text-xs text-gray-600 mt-1">Ramped Quota</div>
              </div>

              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Effective Capacity</div>
                <div className="text-2xl font-bold text-green-600">{fmt(quickStats.effectiveCapacity)}</div>
                <div className="text-xs text-gray-600 mt-1">After Haircuts</div>
              </div>

              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Ramp</div>
                <div className="text-2xl font-bold text-purple-600">{quickStats.avgRamp} mo</div>
                <div className="text-xs text-gray-600 mt-1">{quickStats.totalTeams} Teams</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold">Quarterly Capacity by Team</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2">Rep</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b-2">Q1</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b-2">Q2</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b-2">Q3</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b-2">Q4</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b-2 bg-blue-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTeams.map((teamName, teamIndex) => {
                      const teamReps = aeReps.filter((r: any) => r.segment === teamName);
                      const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];
                      const color = colors[teamIndex % colors.length];
                      
                      return (
                        <React.Fragment key={teamName}>
                          <tr className={`bg-${color}-50`}>
                            <td colSpan={6} className="px-4 py-2 font-bold">{teamName}</td>
                          </tr>
                          {teamReps.map((rep: any, i: number) => {
                            const q = [0,1,2,3].map(qi => getQuarterlyQuota(rep, qi));
                            const tot = q.reduce((s, v) => s + v, 0);
                            return (
                              <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                                <td className="px-4 py-2">{rep.name}</td>
                                <td className="px-4 py-2 text-right">{fmtK(q[0])}</td>
                                <td className="px-4 py-2 text-right">{fmtK(q[1])}</td>
                                <td className="px-4 py-2 text-right">{fmtK(q[2])}</td>
                                <td className="px-4 py-2 text-right">{fmtK(q[3])}</td>
                                <td className={`px-4 py-2 text-right font-semibold bg-${color}-50`}>{fmtK(tot)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    
                    <tr className="bg-gray-800 text-white font-bold">
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 1), 0))}</td>
                      <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 2), 0))}</td>
                      <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 3), 0))}</td>
                      <td className="px-4 py-3 text-right">{fmt(totalRamped)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeView === 'summary' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Total AE Quota</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(totalAEQuota)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Ramped Capacity</div>
                <div className="text-2xl font-bold text-blue-600">{fmt(totalRamped)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Effective Capacity</div>
                <div className="text-2xl font-bold text-green-600">{fmt(totalEffective)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
              <h2 className="text-lg font-semibold mb-3">Upload Rep Data (CSV)</h2>
              <p className="text-sm text-gray-600 mb-3">Format: name,segment,role,reportsTo,startDate,quota,rampMonths,haircut</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-32 border border-gray-300 rounded p-3 font-mono text-sm mb-3"
                placeholder="Paste CSV data here or download template below..."
              />
              <div className="flex gap-3 flex-wrap">
                <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                  Download Template
                </button>
                <button onClick={handleCsvUpload} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Upload
                </button>
                <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                  Export Results
                </button>
                <button onClick={() => {
                  if (confirm('Clear all data? This cannot be undone.')) {
                    setReps([]);
                    localStorage.removeItem('capacityPlannerReps');
                  }
                }} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                  Clear Data
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold">All Team Members</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Role</th>
                    <th className="px-6 py-3 text-right">Ramped Quota</th>
                    <th className="px-6 py-3 text-right">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {capacity.map((rep: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                      <td className="px-6 py-4">{rep.name}</td>
                      <td className="px-6 py-4">{rep.role}</td>
                      <td className="px-6 py-4 text-right text-blue-600">{fmt(rep.rampedQuota)}</td>
                      <td className="px-6 py-4 text-right text-green-600">{fmt(rep.effectiveQuota)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              <strong className="text-gray-900">CapacityPro</strong> — Built for Revenue Operations
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <span>v1.0.0</span>
              <span>•</span>
              <span>© 2025</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} //test