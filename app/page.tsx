'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function QuotaCapacityPlanner() {
  const [activeView, setActiveView] = useState('grid');
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('All Teams');
  
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
      { name: 'Mike Johnson', segment: 'Enterprise', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 2160000, rampMonths: 0, haircut: 10 },
      
      { name: 'Emily Rodriguez', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-11-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'David Kim', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-08-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'Lisa Park', segment: 'Mid-Market', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 1440000, rampMonths: 0, haircut: 10 },
      
      { name: 'Chris Taylor', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2024-09-01', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Morgan Smith', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2025-01-15', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Jessica Wu', segment: 'Commercial', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 900000, rampMonths: 0, haircut: 10 },
      
      { name: 'Robert Chen', segment: 'All', role: 'Director', reportsTo: 'Jennifer Martinez', startDate: '2024-01-01', quota: 4250000, rampMonths: 0, haircut: 15 },
      { name: 'Jennifer Martinez', segment: 'All', role: 'VP', reportsTo: '', startDate: '2024-01-01', quota: 4000000, rampMonths: 0, haircut: 20 }
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
    
    // First, calculate all AE capacities
    reps.filter((r: any) => r.role === 'AE').forEach((rep: any) => {
      const ramped = calculateRampedQuota(rep);
      results.push({
        ...rep,
        capacity: ramped,        // Active/ramped capacity
        quota: rep.quota,        // Annual quota
        effectiveQuota: ramped   // For AEs, effective = capacity
      });
    });
    
    // Calculate total AE capacity (this is the baseline for all rollups)
    const totalAECapacity = results.reduce((sum: number, r: any) => sum + r.capacity, 0);
    
    // Managers: capacity = sum of direct report AE capacity, quota = capacity with haircut applied
    reps.filter((r: any) => r.role === 'Manager').forEach((mgr: any) => {
      const directAEs = results.filter((r: any) => r.reportsTo === mgr.name);
      const managerCapacity = directAEs.reduce((sum: number, r: any) => sum + r.capacity, 0);
      const managerQuota = managerCapacity * (1 - mgr.haircut / 100); // Haircut used to SET quota
      
      results.push({
        ...mgr,
        capacity: managerCapacity,     // Raw AE capacity rollup
        quota: managerQuota,            // Quota set with haircut buffer
        effectiveQuota: managerCapacity, // Effective = actual capacity
        directReports: directAEs
      });
    });
    
    // Directors: capacity = sum of their AE capacity (NOT manager quotas), quota = capacity with haircut
    reps.filter((r: any) => r.role === 'Director').forEach((dir: any) => {
      // Find all managers reporting to this director
      const directManagers = results.filter((r: any) => r.reportsTo === dir.name && r.role === 'Manager');
      // Sum up the AE capacity under those managers
      const directorCapacity = directManagers.reduce((sum: number, mgr: any) => sum + mgr.capacity, 0);
      const directorQuota = directorCapacity * (1 - dir.haircut / 100);
      
      results.push({
        ...dir,
        capacity: directorCapacity,      // Raw AE capacity rollup
        quota: directorQuota,             // Quota set with haircut buffer
        effectiveQuota: directorCapacity, // Effective = actual capacity
        directReports: directManagers
      });
    });
    
    // VPs: capacity = sum of their AE capacity (NOT director quotas), quota = capacity with haircut
    reps.filter((r: any) => r.role === 'VP').forEach((vp: any) => {
      // Find all directors reporting to this VP
      const directDirectors = results.filter((r: any) => r.reportsTo === vp.name && r.role === 'Director');
      // Sum up the AE capacity under those directors
      const vpCapacity = directDirectors.reduce((sum: number, dir: any) => sum + dir.capacity, 0);
      const vpQuota = vpCapacity * (1 - vp.haircut / 100);
      
      results.push({
        ...vp,
        capacity: vpCapacity,         // Raw AE capacity rollup
        quota: vpQuota,                // Quota set with haircut buffer
        effectiveQuota: vpCapacity,    // Effective = actual capacity
        directReports: directDirectors
      });
    });
    
    return results;
  };

  const capacity = calculateCapacity();
  const totalAEQuota = reps.filter((r: any) => r.role === 'AE').reduce((sum: number, r: any) => sum + r.quota, 0);
  const totalAECapacity = capacity.filter((r: any) => r.role === 'AE').reduce((sum: number, r: any) => sum + r.capacity, 0);

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
    const headers = 'Name,Segment,Role,Annual Quota,Capacity,Coverage %\n';
    const rows = capacity.map((r: any) => {
      const coverage = r.quota > 0 ? ((r.capacity / r.quota) * 100).toFixed(1) : 'N/A';
      return `${r.name},${r.segment},${r.role},${Math.round(r.quota)},${Math.round(r.capacity)},${coverage}%`;
    }).join('\n');
    
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

  // Get unique team names dynamically - CRITICAL: Explicit type annotation for Vercel
  const uniqueTeams = [...new Set<string>(aeReps.map((r: any) => r.segment as string))].sort() as string[];

  // Filter AEs by selected team for all calculations
  const filteredAEs = selectedTeamFilter === 'All Teams' 
    ? aeReps 
    : aeReps.filter((r: any) => r.segment === selectedTeamFilter);

  // Calculate capacity trend data for chart
  const getCapacityTrendData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month, monthIndex) => {
      // Calculate total monthly capacity (ramped)
      const monthlyCapacity = filteredAEs.reduce((total: number, rep: any) => {
        return total + getMonthlyQuota(rep, monthIndex);
      }, 0);
      
      // Calculate total monthly quota (what they'd hit at 100% from day 1)
      const monthlyQuota = filteredAEs.reduce((total: number, rep: any) => {
        return total + (rep.quota / 12);
      }, 0);
      
      // Calculate fully ramped capacity (only AEs at 100%)
      const fullyRampedCapacity = filteredAEs.reduce((total: number, rep: any) => {
        const start = new Date(rep.startDate);
        const currentMonth = new Date(2025, monthIndex, 1);
        const monthsSince = monthIndex - start.getMonth() + (start.getFullYear() === 2024 ? 12 : 0);
        
        // Only count if fully ramped (monthsSince >= rampMonths)
        if (monthsSince >= rep.rampMonths) {
          return total + (rep.quota / 12);
        }
        return total;
      }, 0);
      
      return {
        month,
        quota: Math.round(monthlyQuota),
        capacity: Math.round(monthlyCapacity),
        fullyRamped: Math.round(fullyRampedCapacity)
      };
    });
  };

  const capacityTrendData = getCapacityTrendData();

  // Calculate quick stats for grid view (filtered by team)
  const fullyRampedAEs = filteredAEs.filter((rep: any) => {
    const start = new Date(rep.startDate);
    const now = new Date('2025-01-20');
    const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    return monthsSince >= rep.rampMonths;
  });
  
  const rampingAEs = filteredAEs.filter((rep: any) => {
    const start = new Date(rep.startDate);
    const now = new Date('2025-01-20');
    const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    return monthsSince < rep.rampMonths && monthsSince >= 0;
  });

  // Calculate filtered team's quota and capacity
  const filteredQuota = filteredAEs.reduce((sum: number, rep: any) => sum + rep.quota, 0);
  const filteredCapacity = filteredAEs.reduce((sum: number, rep: any) => {
    return sum + calculateRampedQuota(rep);
  }, 0);
  const filteredCoverage = filteredQuota > 0 ? (filteredCapacity / filteredQuota) * 100 : 0;

  const quickStats = {
    quota: filteredQuota,
    capacity: filteredCapacity,
    coverage: filteredCoverage,
    totalAEs: filteredAEs.length,
    fullyRamped: fullyRampedAEs.length,
    ramping: rampingAEs.length
  };

  // Show loading state until mounted on client
  if (!mounted) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-slate-600 text-lg">Loading...</div>
      </div>
    );
  }

  // Custom tooltip formatter for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xl">
          <p className="text-sm font-semibold text-slate-900 mb-2">{payload[0].payload.month} 2025</p>
          <div className="space-y-1.5">
            <p className="text-sm text-slate-600">
              Quota: <span className="font-semibold">{fmt(payload[0].payload.quota)}</span>
            </p>
            <p className="text-sm text-blue-600">
              Capacity: <span className="font-semibold">{fmt(payload[0].payload.capacity)}</span>
            </p>
            <p className="text-sm text-emerald-600">
              Fully Ramped: <span className="font-semibold">{fmt(payload[0].payload.fullyRamped)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Premium Header */}
      <header className="bg-white border-b border-slate-200/60 shadow-sm backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CapacityPro</h1>
                <p className="text-xs text-slate-500 font-medium">Revenue Capacity Planning</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600 font-medium hidden sm:block">
                Built for Revenue Leaders
              </div>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-slate-300 transition-colors"
              >
                <option value="All Teams">All Teams</option>
                {uniqueTeams.map((team: string) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* View Switcher */}
        <div className="bg-white rounded-xl shadow-sm mb-8 p-1.5 inline-flex gap-1 border border-slate-200/50">
          <button
            onClick={() => setActiveView('grid')}
            className={`px-7 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${
              activeView === 'grid' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`px-7 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${
              activeView === 'summary' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Data Manager
          </button>
        </div>

        {/* Rep Details Modal */}
        {selectedRep && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setSelectedRep(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">{selectedRep.name}</h2>
                  <p className="text-slate-600 mt-1 font-medium">{selectedRep.role} • {selectedRep.segment}</p>
                </div>
                <button onClick={() => setSelectedRep(null)} className="text-slate-400 hover:text-slate-600 text-3xl leading-none transition-colors">×</button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">Profile</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Manager</span>
                      <span className="font-semibold text-slate-900">{selectedRep.manager}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Start Date</span>
                      <span className="font-semibold text-slate-900">{selectedRep.startDate}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600 font-medium">Tenure</span>
                      <span className="font-semibold text-slate-900">{selectedRep.monthsSinceStart} months</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">Quota</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Annual Quota</span>
                      <span className="font-semibold text-slate-900">{fmt(selectedRep.quota)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Capacity</span>
                      <span className="font-semibold text-blue-600">{fmt(selectedRep.capacity)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600 font-medium">Coverage</span>
                      <span className={`font-semibold ${selectedRep.quota > 0 && (selectedRep.capacity / selectedRep.quota) >= 1 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {selectedRep.quota > 0 ? ((selectedRep.capacity / selectedRep.quota) * 100).toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRep.role === 'AE' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">Ramp Progress</h3>
                  <div className="bg-slate-100 rounded-full h-8 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-blue-700 h-full flex items-center justify-center text-white text-sm font-bold shadow-inner"
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
            {/* New Card Layout: Quota | Capacity | Coverage | Headcount */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Card 1: Quota */}
              <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-slate-200 group">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team Quota</div>
                <div className="text-3xl font-bold text-slate-900 mb-2">{fmt(quickStats.quota)}</div>
                <div className="text-xs text-slate-600 font-medium">Annual Target</div>
              </div>

              {/* Card 2: Capacity */}
              <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-blue-200 group">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Capacity</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">{fmt(quickStats.capacity)}</div>
                <div className="text-xs text-slate-600 font-medium">Ramped Delivery</div>
              </div>

              {/* Card 3: Coverage */}
              <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-emerald-200 group">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quota Coverage</div>
                <div className={`text-3xl font-bold mb-2 ${quickStats.coverage >= 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {quickStats.coverage.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {quickStats.coverage >= 100 ? 'On Track ✓' : 'Below Target'}
                </div>
              </div>

              {/* Card 4: Headcount */}
              <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-purple-200 group">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Headcount</div>
                <div className="text-3xl font-bold text-slate-900 mb-2">{quickStats.totalAEs} AEs</div>
                <div className="text-xs text-slate-600 font-medium">
                  <span className="text-emerald-600 font-bold">{quickStats.fullyRamped} Ramped</span>
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span className="text-blue-600 font-bold">{quickStats.ramping} Ramping</span>
                </div>
              </div>
            </div>

            {/* Capacity Trend Chart */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 mb-8 overflow-hidden">
              <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-900">Capacity Trend • 2025</h2>
              </div>
              <div className="p-7">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={capacityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#64748b"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#64748b"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="quota" 
                      stroke="#94a3b8" 
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={false}
                      name="Target Quota"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="capacity" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ fill: '#2563eb', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7 }}
                      name="Active Capacity"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="fullyRamped" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7 }}
                      name="Fully Ramped Capacity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Premium Table - Filtered by Team */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-lg font-bold text-slate-900">Quarterly Capacity by Team</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wide">Rep</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Q1</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Q2</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Q3</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Q4</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide bg-blue-50">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedTeamFilter === 'All Teams' ? uniqueTeams : [selectedTeamFilter]).map((teamName: string, teamIndex: number) => {
                      const teamReps = filteredAEs.filter((r: any) => r.segment === teamName);
                      if (teamReps.length === 0) return null;
                      
                      const colors = ['blue', 'emerald', 'purple', 'orange', 'pink', 'indigo'];
                      const color = colors[teamIndex % colors.length];
                      
                      return (
                        <React.Fragment key={teamName}>
                          <tr className={`bg-${color}-50/50 border-t-2 border-${color}-200`}>
                            <td colSpan={6} className="px-6 py-3 font-bold text-slate-900 text-sm">{teamName}</td>
                          </tr>
                          {teamReps.map((rep: any, i: number) => {
                            const q = [0,1,2,3].map(qi => getQuarterlyQuota(rep, qi));
                            const tot = q.reduce((s, v) => s + v, 0);
                            return (
                              <tr key={i} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                                <td className="px-6 py-4 font-medium text-slate-900">{rep.name}</td>
                                <td className="px-6 py-4 text-right text-slate-700 font-semibold">{fmtK(q[0])}</td>
                                <td className="px-6 py-4 text-right text-slate-700 font-semibold">{fmtK(q[1])}</td>
                                <td className="px-6 py-4 text-right text-slate-700 font-semibold">{fmtK(q[2])}</td>
                                <td className="px-6 py-4 text-right text-slate-700 font-semibold">{fmtK(q[3])}</td>
                                <td className={`px-6 py-4 text-right font-bold text-${color}-700 bg-${color}-50/50`}>{fmtK(tot)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    
                    <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                      <td className="px-6 py-4 text-sm uppercase tracking-wide">Total</td>
                      <td className="px-6 py-4 text-right">{fmtK(filteredAEs.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 0), 0))}</td>
                      <td className="px-6 py-4 text-right">{fmtK(filteredAEs.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 1), 0))}</td>
                      <td className="px-6 py-4 text-right">{fmtK(filteredAEs.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 2), 0))}</td>
                      <td className="px-6 py-4 text-right">{fmtK(filteredAEs.reduce((s: number, r: any) => s + getQuarterlyQuota(r, 3), 0))}</td>
                      <td className="px-6 py-4 text-right text-lg">{fmt(quickStats.capacity)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeView === 'summary' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-7 border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Total AE Quota</div>
                <div className="text-3xl font-bold text-slate-900">{fmt(totalAEQuota)}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-7 border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Total AE Capacity</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">{fmt(totalAECapacity)}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-7 border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Coverage</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                  {totalAEQuota > 0 ? ((totalAECapacity / totalAEQuota) * 100).toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-7 mb-8 border border-slate-100">
              <h2 className="text-xl font-bold mb-4 text-slate-900">Upload Rep Data</h2>
              <p className="text-sm text-slate-600 mb-4 font-medium">CSV Format: name, segment, role, reportsTo, startDate, quota, rampMonths, haircut</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-36 border-2 border-slate-200 rounded-xl p-4 font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Paste CSV data here..."
              />
              <div className="flex gap-3 flex-wrap">
                <button onClick={downloadTemplate} className="px-5 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg">
                  Download Template
                </button>
                <button onClick={handleCsvUpload} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg">
                  Upload Data
                </button>
                <button onClick={exportCSV} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg">
                  Export Results
                </button>
                <button onClick={() => {
                  if (confirm('Clear all data? This cannot be undone.')) {
                    setReps([]);
                    localStorage.removeItem('capacityPlannerReps');
                  }
                }} className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg">
                  Clear All Data
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h3 className="text-lg font-bold text-slate-900">All Team Members</h3>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-7 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wide">Name</th>
                    <th className="px-7 py-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wide">Role</th>
                    <th className="px-7 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Quota</th>
                    <th className="px-7 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Capacity</th>
                    <th className="px-7 py-4 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {capacity.map((rep: any, i: number) => {
                    const coverage = rep.quota > 0 ? ((rep.capacity / rep.quota) * 100).toFixed(1) : 'N/A';
                    const coverageColor = rep.quota > 0 && (rep.capacity / rep.quota) >= 1 ? 'text-emerald-700' : 'text-orange-700';
                    return (
                      <tr key={i} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                        <td className="px-7 py-5 font-semibold text-slate-900">{rep.name}</td>
                        <td className="px-7 py-5 text-slate-700 font-medium">{rep.role}</td>
                        <td className="px-7 py-5 text-right text-slate-900 font-bold">{fmt(rep.quota)}</td>
                        <td className="px-7 py-5 text-right text-blue-700 font-bold">{fmt(rep.capacity)}</td>
                        <td className={`px-7 py-5 text-right font-bold ${coverageColor}`}>{typeof coverage === 'string' ? coverage : coverage + '%'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Premium Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200/60 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-600 font-medium">
              <strong className="text-slate-900 font-bold">CapacityPro</strong> — Professional Revenue Planning
            </div>
            <div className="flex gap-6 text-sm text-slate-500 font-medium">
              <span>v1.0.0</span>
              <span className="text-slate-300">•</span>
              <span>© 2025</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}