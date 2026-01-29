'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function QuotaCapacityPlanner() {
  const [activeView, setActiveView] = useState('grid');
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('All Teams');
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = January, 11 = December
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [reps, setReps] = useState(() => {
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
    return [
      { name: 'Sarah Chen', segment: 'Enterprise', role: 'AE', reportsTo: 'Mike Johnson', startDate: '2026-01-01', quota: 1200000, rampMonths: 5, haircut: 0 },
      { name: 'James Liu', segment: 'Enterprise', role: 'AE', reportsTo: 'Mike Johnson', startDate: '2024-10-01', quota: 1200000, rampMonths: 5, haircut: 0 },
      { name: 'Mike Johnson', segment: 'Enterprise', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 2160000, rampMonths: 0, haircut: 10 },
      
      { name: 'Emily Rodriguez', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-11-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'David Kim', segment: 'Mid-Market', role: 'AE', reportsTo: 'Lisa Park', startDate: '2024-08-01', quota: 800000, rampMonths: 4, haircut: 0 },
      { name: 'Lisa Park', segment: 'Mid-Market', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 1440000, rampMonths: 0, haircut: 10 },
      
      { name: 'Chris Taylor', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2024-09-01', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Morgan Smith', segment: 'Commercial', role: 'AE', reportsTo: 'Jessica Wu', startDate: '2026-01-15', quota: 500000, rampMonths: 3, haircut: 0 },
      { name: 'Jessica Wu', segment: 'Commercial', role: 'Manager', reportsTo: 'Robert Chen', startDate: '2024-01-01', quota: 900000, rampMonths: 0, haircut: 10 },
      
      { name: 'Robert Chen', segment: 'All', role: 'Director', reportsTo: 'Jennifer Martinez', startDate: '2024-01-01', quota: 4250000, rampMonths: 0, haircut: 15 },
      { name: 'Jennifer Martinez', segment: 'All', role: 'VP', reportsTo: '', startDate: '2024-01-01', quota: 4000000, rampMonths: 0, haircut: 20 }
    ];
  });

  const [csvInput, setCsvInput] = useState('');

  const months = [
    { value: 0, label: 'January 2026' },
    { value: 1, label: 'February 2026' },
    { value: 2, label: 'March 2026' },
    { value: 3, label: 'April 2026' },
    { value: 4, label: 'May 2026' },
    { value: 5, label: 'June 2026' },
    { value: 6, label: 'July 2026' },
    { value: 7, label: 'August 2026' },
    { value: 8, label: 'September 2026' },
    { value: 9, label: 'October 2026' },
    { value: 10, label: 'November 2026' },
    { value: 11, label: 'December 2026' }
  ];

  useEffect(() => {
    setMounted(true);
    // Set default to current month
    const now = new Date();
    setSelectedMonth(now.getMonth());
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('capacityPlannerReps', JSON.stringify(reps));
    }
  }, [reps, mounted]);

  const fmt = (n: number) => '$' + (n / 1000000).toFixed(2) + 'M';
  const fmtK = (n: number) => '$' + Math.round(n / 1000) + 'K';

  // Get current date based on selected month
  const getCurrentDate = () => {
    return new Date(2026, selectedMonth, 15); // Mid-month
  };

  const getMonthlyQuota = (rep: any, monthIndex: number) => {
    if (rep.role !== 'AE') return 0;
    
    const start = new Date(rep.startDate);
    const monthStart = new Date(2026, monthIndex, 1);
    
    if (monthStart < start) return 0;
    
    // Calculate months between start date and current month in 2026
    const monthsSince = (2026 - start.getFullYear()) * 12 + (monthIndex - start.getMonth());
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
        capacity: ramped,
        quota: rep.quota,
        effectiveQuota: ramped
      });
    });
    
    reps.filter((r: any) => r.role === 'Manager').forEach((mgr: any) => {
      const directAEs = results.filter((r: any) => r.reportsTo === mgr.name);
      const managerCapacity = directAEs.reduce((sum: number, r: any) => sum + r.capacity, 0);
      const managerQuota = mgr.quota || (managerCapacity * (1 - mgr.haircut / 100));
      
      results.push({
        ...mgr,
        capacity: managerCapacity,
        quota: managerQuota,
        effectiveQuota: managerCapacity,
        directReports: directAEs
      });
    });
    
    reps.filter((r: any) => r.role === 'Director').forEach((dir: any) => {
      const directManagers = results.filter((r: any) => r.reportsTo === dir.name && r.role === 'Manager');
      const directorCapacity = directManagers.reduce((sum: number, mgr: any) => sum + mgr.capacity, 0);
      const directorQuota = dir.quota || (directorCapacity * (1 - dir.haircut / 100));
      
      results.push({
        ...dir,
        capacity: directorCapacity,
        quota: directorQuota,
        effectiveQuota: directorCapacity,
        directReports: directManagers
      });
    });
    
    reps.filter((r: any) => r.role === 'VP').forEach((vp: any) => {
      const directDirectors = results.filter((r: any) => r.reportsTo === vp.name && r.role === 'Director');
      const vpCapacity = directDirectors.reduce((sum: number, dir: any) => sum + dir.capacity, 0);
      const vpQuota = vp.quota || (vpCapacity * (1 - vp.haircut / 100));
      
      results.push({
        ...vp,
        capacity: vpCapacity,
        quota: vpQuota,
        effectiveQuota: vpCapacity,
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
John Doe,Sales Team A,AE,Jane Smith,2026-01-01,1000000,4,0
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
    const now = getCurrentDate();
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
  const uniqueTeams = [...new Set<string>(aeReps.map((r: any) => r.segment as string))].sort() as string[];
  const filteredAEs = selectedTeamFilter === 'All Teams' 
    ? aeReps 
    : aeReps.filter((r: any) => r.segment === selectedTeamFilter);

  // Hierarchy functions
  const toggleRow = (name: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedRows(newExpanded);
  };

  const expandAll = () => {
    const allNames = new Set<string>();
    capacity.forEach((person: any) => {
      if (person.role !== 'AE') {
        allNames.add(person.name);
      }
    });
    setExpandedRows(allNames);
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const countAEs = (person: any): number => {
    if (person.role === 'AE') return 1;
    if (!person.directReports) return 0;
    
    return person.directReports.reduce((sum: number, child: any) => {
      return sum + countAEs(child);
    }, 0);
  };

  const getDirectReportSummary = (person: any): string => {
    if (!person.directReports || person.directReports.length === 0) return '';
    
    const byRole: any = {};
    person.directReports.forEach((child: any) => {
      const role = child.role === 'AE' ? 'AE' : child.role.toLowerCase();
      byRole[role] = (byRole[role] || 0) + 1;
    });
    
    const parts: string[] = [];
    if (byRole['manager']) parts.push(`${byRole['manager']} manager${byRole['manager'] > 1 ? 's' : ''}`);
    if (byRole['director']) parts.push(`${byRole['director']} director${byRole['director'] > 1 ? 's' : ''}`);
    if (byRole['AE']) parts.push(`${byRole['AE']} AE${byRole['AE'] > 1 ? 's' : ''}`);
    
    const totalAEs = countAEs(person);
    if (totalAEs > 0 && person.role !== 'Manager') {
      return `${parts.join(', ')} • ${totalAEs} AE${totalAEs > 1 ? 's' : ''} total`;
    }
    
    return parts.join(', ');
  };

  const renderHierarchyRow = (person: any, level: number): React.ReactNode[] => {
    const isExpanded = expandedRows.has(person.name);
    const hasChildren = person.directReports && person.directReports.length > 0;
    const coverage = person.quota > 0 ? (person.capacity / person.quota) * 100 : 0;
    const coverageColor = coverage >= 100 ? 'text-emerald-600' : 'text-amber-500';
    const aeCount = countAEs(person);
    const summary = getDirectReportSummary(person);
    
    const indent = level * 2.5;
    const rows: React.ReactNode[] = [];
    
    rows.push(
      <tr 
        key={person.name} 
        className="hover:bg-stone-50 cursor-pointer transition-colors border-b border-stone-100"
        onClick={() => {
          if (person.role === 'AE') {
            setSelectedRep(getRepDetails(person.name));
          } else if (hasChildren) {
            toggleRow(person.name);
          }
        }}
      >
        <td className="px-6 py-4" style={{ paddingLeft: `${indent + 1.5}rem` }}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="text-stone-400 font-bold text-lg">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <div>
              <div className="font-semibold text-stone-900">{person.name}</div>
              <div className="text-xs text-stone-500">
                {person.role}
                {!isExpanded && summary && (
                  <span className="ml-2 text-stone-400">({summary})</span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-right font-semibold text-stone-900">{fmt(person.quota)}</td>
        <td className="px-6 py-4 text-right font-semibold text-indigo-600">{fmt(person.capacity)}</td>
        <td className={`px-6 py-4 text-right font-bold ${coverageColor}`}>
          {person.quota > 0 ? coverage.toFixed(1) + '%' : 'N/A'}
        </td>
        <td className="px-6 py-4 text-right font-semibold text-stone-700">
          {aeCount > 0 ? aeCount : '-'}
        </td>
      </tr>
    );
    
    if (isExpanded && hasChildren) {
      const sortedChildren = [...person.directReports].sort((a: any, b: any) => 
        a.name.localeCompare(b.name)
      );
      
      sortedChildren.forEach((child: any) => {
        rows.push(...renderHierarchyRow(child, level + 1));
      });
    }
    
    return rows;
  };

  const getCapacityTrendData = () => {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return monthLabels.map((month, monthIndex) => {
      const monthlyCapacity = filteredAEs.reduce((total: number, rep: any) => {
        return total + getMonthlyQuota(rep, monthIndex);
      }, 0);
      
      const monthlyQuota = filteredAEs.reduce((total: number, rep: any) => {
        return total + (rep.quota / 12);
      }, 0);
      
      const fullyRampedCapacity = filteredAEs.reduce((total: number, rep: any) => {
        const start = new Date(rep.startDate);
        const currentMonthDate = new Date(2026, monthIndex, 1);
        
        // Calculate months between start date and current month
        const monthsSince = (currentMonthDate.getFullYear() - start.getFullYear()) * 12 + 
                           (currentMonthDate.getMonth() - start.getMonth());
        
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

  const fullyRampedAEs = filteredAEs.filter((rep: any) => {
    const start = new Date(rep.startDate);
    const now = getCurrentDate();
    const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    return monthsSince >= rep.rampMonths;
  });
  
  const rampingAEs = filteredAEs.filter((rep: any) => {
    const start = new Date(rep.startDate);
    const now = getCurrentDate();
    const monthsSince = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    return monthsSince < rep.rampMonths && monthsSince >= 0;
  });

  const filteredQuota = filteredAEs.reduce((sum: number, rep: any) => sum + rep.quota, 0);
  const filteredCapacity = filteredAEs.reduce((sum: number, rep: any) => {
    // Calculate capacity up through selected month (YTD)
    let ytdCapacity = 0;
    for (let m = 0; m <= selectedMonth; m++) {
      ytdCapacity += getMonthlyQuota(rep, m);
    }
    return sum + ytdCapacity;
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

  if (!mounted) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50 p-6 flex items-center justify-center">
        <div className="text-stone-600 text-lg">Loading...</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-stone-200 rounded-lg shadow-xl">
          <p className="text-sm font-semibold text-stone-900 mb-2">{payload[0].payload.month} 2026</p>
          <div className="space-y-1.5">
            <p className="text-sm text-stone-600">
              Quota: <span className="font-semibold">{fmt(payload[0].payload.quota)}</span>
            </p>
            <p className="text-sm text-indigo-600">
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
    <div className="w-full min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50">
      {/* Premium Header */}
      <header className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border-b border-stone-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">CapacityPro</h1>
                <p className="text-xs text-stone-400 font-medium">Revenue Capacity Planning</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-stone-300 font-medium hidden lg:block">
                Built for Revenue Leaders
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-4 py-2 bg-stone-800 border border-stone-700 text-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-stone-600 transition-colors"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-4 py-2 bg-stone-800 border border-stone-700 text-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-stone-600 transition-colors"
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
        <div className="bg-white rounded-xl shadow-md mb-8 p-1.5 inline-flex gap-1 border border-stone-200">
          <button
            onClick={() => setActiveView('grid')}
            className={`px-7 py-2.5 font-bold rounded-lg transition-all duration-200 text-sm ${
              activeView === 'grid' 
                ? 'bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-lg' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveView('hierarchy')}
            className={`px-7 py-2.5 font-bold rounded-lg transition-all duration-200 text-sm ${
              activeView === 'hierarchy' 
                ? 'bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-lg' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            Hierarchy
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`px-7 py-2.5 font-bold rounded-lg transition-all duration-200 text-sm ${
              activeView === 'summary' 
                ? 'bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-lg' 
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            Data Manager
          </button>
        </div>

        {/* Rep Details Modal */}
        {selectedRep && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedRep(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900">{selectedRep.name}</h2>
                  <p className="text-stone-600 mt-1 font-medium">{selectedRep.role} • {selectedRep.segment}</p>
                </div>
                <button onClick={() => setSelectedRep(null)} className="text-stone-400 hover:text-stone-600 text-3xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-4 uppercase tracking-wide">Profile</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-600 font-medium">Manager</span>
                      <span className="font-semibold text-stone-900">{selectedRep.manager}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-600 font-medium">Start Date</span>
                      <span className="font-semibold text-stone-900">{selectedRep.startDate}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-stone-600 font-medium">Tenure</span>
                      <span className="font-semibold text-stone-900">{selectedRep.monthsSinceStart} months</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-4 uppercase tracking-wide">Quota</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-600 font-medium">Annual Quota</span>
                      <span className="font-semibold text-stone-900">{fmt(selectedRep.quota)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-600 font-medium">Capacity</span>
                      <span className="font-semibold text-indigo-600">{fmt(selectedRep.capacity)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-stone-600 font-medium">Coverage</span>
                      <span className={`font-semibold ${selectedRep.quota > 0 && (selectedRep.capacity / selectedRep.quota) >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {selectedRep.quota > 0 ? ((selectedRep.capacity / selectedRep.quota) * 100).toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRep.role === 'AE' && (
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wide">Ramp Progress</h3>
                  <div className="bg-stone-100 rounded-full h-8 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full flex items-center justify-center text-white text-sm font-bold"
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
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Team Quota</div>
                <div className="text-3xl font-bold text-stone-900 mb-2">{fmt(quickStats.quota)}</div>
                <div className="text-xs text-stone-600 font-medium">Annual Target</div>
              </div>

              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Active Capacity</div>
                <div className="text-3xl font-bold text-indigo-600 mb-2">{fmt(quickStats.capacity)}</div>
                <div className="text-xs text-stone-600 font-medium">Ramped Delivery</div>
              </div>

              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Quota Coverage</div>
                <div className={`text-3xl font-bold mb-2 ${quickStats.coverage >= 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {quickStats.coverage.toFixed(1)}%
                </div>
                <div className="text-xs text-stone-600 font-medium">
                  {quickStats.coverage >= 100 ? 'On Track ✓' : 'Below Target'}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Total Headcount</div>
                <div className="text-3xl font-bold text-stone-900 mb-2">{quickStats.totalAEs} AEs</div>
                <div className="text-xs text-stone-600 font-medium">
                  <span className="text-emerald-600 font-bold">{quickStats.fullyRamped} Ramped</span>
                  <span className="mx-1.5 text-stone-300">•</span>
                  <span className="text-indigo-600 font-bold">{quickStats.ramping} Ramping</span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl shadow-lg border border-stone-200 mb-8 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50">
                <h2 className="text-lg font-bold text-stone-900">Capacity Trend • 2026</h2>
              </div>
              <div className="p-7">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={capacityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#78716c"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#78716c"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                    <Line 
                      type="monotone" 
                      dataKey="quota" 
                      stroke="#a8a29e" 
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={false}
                      name="Target Quota"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="capacity" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', r: 5, strokeWidth: 2, stroke: '#fff' }}
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

            {/* Quarterly Table */}
            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50">
                <h2 className="text-lg font-bold text-stone-900">Quarterly Capacity by Team</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">Rep</th>
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Q1</th>
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Q2</th>
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Q3</th>
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Q4</th>
                      <th className="px-6 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide bg-indigo-50">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(selectedTeamFilter === 'All Teams' ? uniqueTeams : [selectedTeamFilter]).map((teamName: string, teamIndex: number) => {
                      const teamReps = filteredAEs.filter((r: any) => r.segment === teamName);
                      if (teamReps.length === 0) return null;
                      
                      const colors = ['indigo', 'emerald', 'purple', 'amber', 'rose', 'cyan'];
                      const color = colors[teamIndex % colors.length];
                      
                      return (
                        <React.Fragment key={teamName}>
                          <tr className={`bg-${color}-50/50 border-t-2 border-${color}-200`}>
                            <td colSpan={6} className="px-6 py-3 font-bold text-stone-900 text-sm">{teamName}</td>
                          </tr>
                          {teamReps.map((rep: any, i: number) => {
                            const q = [0,1,2,3].map(qi => getQuarterlyQuota(rep, qi));
                            const tot = q.reduce((s, v) => s + v, 0);
                            return (
                              <tr key={i} className="hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                                <td className="px-6 py-4 font-medium text-stone-900">{rep.name}</td>
                                <td className="px-6 py-4 text-right text-stone-700 font-semibold">{fmtK(q[0])}</td>
                                <td className="px-6 py-4 text-right text-stone-700 font-semibold">{fmtK(q[1])}</td>
                                <td className="px-6 py-4 text-right text-stone-700 font-semibold">{fmtK(q[2])}</td>
                                <td className="px-6 py-4 text-right text-stone-700 font-semibold">{fmtK(q[3])}</td>
                                <td className={`px-6 py-4 text-right font-bold text-${color}-700 bg-${color}-50/50`}>{fmtK(tot)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    
                    <tr className="bg-stone-900 text-white font-bold border-t-2 border-stone-700">
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

        {activeView === 'hierarchy' && (
          <>
            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-stone-900">Organization Structure</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={expandAll}
                    className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    Expand All
                  </button>
                  <button 
                    onClick={collapseAll}
                    className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    Collapse All
                  </button>
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
                    {capacity
                      .filter((person: any) => person.role === 'VP')
                      .map((vp: any) => renderHierarchyRow(vp, 0))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeView === 'summary' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-7 border border-stone-200">
                <div className="text-sm font-bold text-stone-500 mb-2 uppercase tracking-wide">Total AE Quota</div>
                <div className="text-3xl font-bold text-stone-900">{fmt(totalAEQuota)}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-7 border border-stone-200">
                <div className="text-sm font-bold text-stone-500 mb-2 uppercase tracking-wide">Total AE Capacity</div>
                <div className="text-3xl font-bold text-indigo-600">{fmt(totalAECapacity)}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-7 border border-stone-200">
                <div className="text-sm font-bold text-stone-500 mb-2 uppercase tracking-wide">Coverage</div>
                <div className="text-3xl font-bold text-emerald-600">
                  {totalAEQuota > 0 ? ((totalAECapacity / totalAEQuota) * 100).toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-7 mb-8 border border-stone-200">
              <h2 className="text-xl font-bold mb-4 text-stone-900">Upload Rep Data</h2>
              <p className="text-sm text-stone-600 mb-4 font-medium">CSV Format: name, segment, role, reportsTo, startDate, quota, rampMonths, haircut</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-36 border-2 border-stone-200 rounded-xl p-4 font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Paste CSV data here..."
              />
              <div className="flex gap-3 flex-wrap">
                <button onClick={downloadTemplate} className="px-5 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 transition-all duration-200 font-bold text-sm shadow-md">
                  Download Template
                </button>
                <button onClick={handleCsvUpload} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-bold text-sm shadow-md">
                  Upload Data
                </button>
                <button onClick={exportCSV} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-bold text-sm shadow-md">
                  Export Results
                </button>
                <button onClick={() => {
                  if (confirm('Clear all data? This cannot be undone.')) {
                    setReps([]);
                    localStorage.removeItem('capacityPlannerReps');
                  }
                }} className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 font-bold text-sm shadow-md">
                  Clear All Data
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
              <div className="px-7 py-5 border-b border-stone-200 bg-stone-50">
                <h3 className="text-lg font-bold text-stone-900">All Team Members</h3>
              </div>
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-7 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">Name</th>
                    <th className="px-7 py-4 text-left font-bold text-stone-700 text-sm uppercase tracking-wide">Role</th>
                    <th className="px-7 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Quota</th>
                    <th className="px-7 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Capacity</th>
                    <th className="px-7 py-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {capacity.map((rep: any, i: number) => {
                    const coverage = rep.quota > 0 ? ((rep.capacity / rep.quota) * 100).toFixed(1) : 'N/A';
                    const coverageColor = rep.quota > 0 && (rep.capacity / rep.quota) >= 1 ? 'text-emerald-600' : 'text-amber-500';
                    return (
                      <tr key={i} className="hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => setSelectedRep(getRepDetails(rep.name))}>
                        <td className="px-7 py-5 font-semibold text-stone-900">{rep.name}</td>
                        <td className="px-7 py-5 text-stone-700 font-medium">{rep.role}</td>
                        <td className="px-7 py-5 text-right text-stone-900 font-bold">{fmt(rep.quota)}</td>
                        <td className="px-7 py-5 text-right text-indigo-600 font-bold">{fmt(rep.capacity)}</td>
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

      {/* Footer */}
      <footer className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border-t border-stone-700 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-stone-400 font-medium">
              <strong className="text-white font-bold">CapacityPro</strong> — Professional Revenue Planning
            </div>
            <div className="flex gap-6 text-sm text-stone-500 font-medium">
              <span>v1.0.0</span>
              <span className="text-stone-700">•</span>
              <span>© 2026</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}