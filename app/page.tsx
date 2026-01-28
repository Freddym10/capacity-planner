'use client';

import React, { useState } from 'react';

export default function QuotaCapacityPlanner() {
  const [activeView, setActiveView] = useState('grid');
  const [selectedRep, setSelectedRep] = useState<any>(null);
  
  const [reps, setReps] = useState([
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
  ]);

  const [csvInput, setCsvInput] = useState('');

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
    
    reps.filter(r => r.role === 'AE').forEach(rep => {
      const ramped = calculateRampedQuota(rep);
      results.push({
        ...rep,
        rampedQuota: ramped,
        effectiveQuota: ramped
      });
    });
    
    reps.filter(r => r.role === 'Manager').forEach(mgr => {
      const directs = results.filter(r => r.reportsTo === mgr.name);
      const total = directs.reduce((sum, r) => sum + r.effectiveQuota, 0);
      const effective = total * (1 - mgr.haircut / 100);
      
      results.push({
        ...mgr,
        rampedQuota: total,
        effectiveQuota: effective,
        directReports: directs
      });
    });
    
    reps.filter(r => r.role === 'Director').forEach(dir => {
      const directs = results.filter(r => r.reportsTo === dir.name);
      const total = directs.reduce((sum, r) => sum + r.effectiveQuota, 0);
      const effective = total * (1 - dir.haircut / 100);
      
      results.push({
        ...dir,
        rampedQuota: total,
        effectiveQuota: effective,
        directReports: directs
      });
    });
    
    reps.filter(r => r.role === 'VP').forEach(vp => {
      const directs = results.filter(r => r.reportsTo === vp.name);
      const total = directs.reduce((sum, r) => sum + r.effectiveQuota, 0);
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
  const totalAEQuota = reps.filter(r => r.role === 'AE').reduce((sum, r) => sum + r.quota, 0);
  const totalRamped = capacity.filter(r => r.role === 'AE').reduce((sum, r) => sum + r.rampedQuota, 0);
  const vp = capacity.find(r => r.role === 'VP');
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
    const rows = capacity.map(r => 
      `${r.name},${r.segment},${r.role},${r.quota},${Math.round(r.rampedQuota)},${Math.round(r.effectiveQuota)}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capacity_plan.csv';
    a.click();
  };

  const getRepDetails = (repName: string) => {
    const rep = capacity.find(r => r.name === repName);
    if (!rep) return null;
    
    const mgr = reps.find(r => r.name === rep.reportsTo);
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

  const aeReps = reps.filter(r => r.role === 'AE');

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Capacity Planner</h1>
        <p className="text-gray-600 mb-6">Simple quota modeling with ramp schedules and haircuts</p>

        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveView('grid')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeView === 'grid' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeView === 'summary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
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
                  <tr className="bg-blue-50">
                    <td colSpan={6} className="px-4 py-2 font-bold">Commercial</td>
                  </tr>
                  {aeReps.filter(r => r.segment === 'Commercial').map((rep, i) => {
                    const q = [0,1,2,3].map(q => getQuarterlyQuota(rep, q));
                    const tot = q.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                        <td className="px-4 py-2">{rep.name}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[0])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[1])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[2])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[3])}</td>
                        <td className="px-4 py-2 text-right font-semibold bg-blue-50">{fmtK(tot)}</td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-green-50">
                    <td colSpan={6} className="px-4 py-2 font-bold">Mid-Market</td>
                  </tr>
                  {aeReps.filter(r => r.segment === 'Mid-Market').map((rep, i) => {
                    const q = [0,1,2,3].map(q => getQuarterlyQuota(rep, q));
                    const tot = q.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                        <td className="px-4 py-2">{rep.name}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[0])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[1])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[2])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[3])}</td>
                        <td className="px-4 py-2 text-right font-semibold bg-green-50">{fmtK(tot)}</td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-purple-50">
                    <td colSpan={6} className="px-4 py-2 font-bold">Enterprise</td>
                  </tr>
                  {aeReps.filter(r => r.segment === 'Enterprise').map((rep, i) => {
                    const q = [0,1,2,3].map(q => getQuarterlyQuota(rep, q));
                    const tot = q.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                        <td className="px-4 py-2">{rep.name}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[0])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[1])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[2])}</td>
                        <td className="px-4 py-2 text-right">{fmtK(q[3])}</td>
                        <td className="px-4 py-2 text-right font-semibold bg-purple-50">{fmtK(tot)}</td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-gray-800 text-white font-bold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s, r) => s + getQuarterlyQuota(r, 0), 0))}</td>
                    <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s, r) => s + getQuarterlyQuota(r, 1), 0))}</td>
                    <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s, r) => s + getQuarterlyQuota(r, 2), 0))}</td>
                    <td className="px-4 py-3 text-right">{fmtK(aeReps.reduce((s, r) => s + getQuarterlyQuota(r, 3), 0))}</td>
                    <td className="px-4 py-3 text-right">{fmt(totalRamped)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === 'summary' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-1">Total AE Quota</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(totalAEQuota)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-1">Ramped Capacity</div>
                <div className="text-2xl font-bold text-blue-600">{fmt(totalRamped)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-1">Effective Capacity</div>
                <div className="text-2xl font-bold text-green-600">{fmt(totalEffective)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-3">Upload Rep Data (CSV)</h2>
              <p className="text-sm text-gray-600 mb-3">Format: name,segment,role,reportsTo,startDate,quota,rampMonths,haircut</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-32 border border-gray-300 rounded p-3 font-mono text-sm mb-3"
              />
              <button onClick={handleCsvUpload} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-3">
                Upload
              </button>
              <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                Export
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  {capacity.map((rep, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
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
    </div>
  );
}