import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../components/GlassCard';
import { EmptyState } from '../components/EmptyState';
import { 
  GitCompare, Check, Plus, Trash2, BrainCircuit, Search, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, LineChart, Line, CartesianGrid 
} from 'recharts';

interface CareerEntry {
  id: string;
  name: string;
  category: string;
  avgSalaryIndia?: string;
  difficulty?: string;
  aiAutomationRisk?: string;
  futureDemandRating?: number;
  educationRequired?: string;
  typicalDuration?: string;
  requiredSkills?: string[];
  description?: string;
}

// Transform raw career data into comparison-ready format
function toComparisonEntry(c: CareerEntry) {
  // Parse salary to numeric (₹X LPA → X * 100000)
  const rawSal = (c.avgSalaryIndia || '0').replace(/[₹, ]/g, '');
  const salNum = parseFloat(rawSal.replace(/[^0-9.]/g, '')) || 0;
  // Convert LPA → absolute if the number looks like LPA
  const salary = salNum < 1000 ? salNum * 100000 : salNum;

  const riskRaw = (c.aiAutomationRisk || '0%').replace(/[^0-9.]/g, '');
  const growth = Math.round(((c.futureDemandRating || 5) / 10) * 30); // approx annual growth %

  const stressMap: Record<string, string> = {
    hard: 'High', medium: 'Medium', easy: 'Low', 'very hard': 'Very High'
  };
  const stress = stressMap[(c.difficulty || 'medium').toLowerCase()] || 'Medium';

  // Fee estimation from duration
  const durationNum = parseFloat((c.typicalDuration || '3').replace(/[^0-9.]/g, '')) || 3;
  const feeEst = durationNum <= 3 ? '₹2–5L' : durationNum <= 4 ? '₹5–10L' : '₹10–25L';

  return {
    id: c.id,
    name: c.name,
    category: c.category,
    salary,
    duration: c.typicalDuration || '3–4 Years',
    fees: feeEst,
    difficulty: c.difficulty || 'Medium',
    aiRisk: `${riskRaw}%`,
    stress,
    growth,
  };
}


export const Comparison: React.FC = () => {
  const [allCareers, setAllCareers] = useState<ReturnType<typeof toComparisonEntry>[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchVal, setSearchVal]   = useState('');
  const [streamFilter, setStreamFilter] = useState('All');
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);

  // ── Fetch all careers directly from /api/careers (no AI required) ─────────
  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch('/api/careers');
        if (!res.ok) throw new Error(`Server error ${res.status}: ${res.statusText}`);
        const data: CareerEntry[] = await res.json();
        setAllCareers(data.map(toComparisonEntry));
      } catch (err: any) {
        console.error('Careers fetch error:', err);
        setFetchError(err?.message || 'Could not load career database. Is the server running?');
      } finally {
        setLoading(false);
      }
    };
    fetchCareers();
  }, [retryCount]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(allCareers.map(c => c.category)));
    return ['All', ...cats];
  }, [allCareers]);

  const visibleCareers = useMemo(() => {
    return allCareers.filter(c => {
      const matchesSearch = !searchVal || c.name.toLowerCase().includes(searchVal.toLowerCase());
      const matchesStream = streamFilter === 'All' || c.category === streamFilter;
      return matchesSearch && matchesStream;
    });
  }, [allCareers, searchVal, streamFilter]);

  const activeCareers = useMemo(
    () => allCareers.filter(c => selectedIds.includes(c.id)),
    [allCareers, selectedIds]
  );

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length < 5) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const salaryChartData = activeCareers.map(c => ({
    name: c.name.split(' ').map(w => w.charAt(0)).join(''),
    fullName: c.name,
    Salary: parseFloat((c.salary / 100000).toFixed(1))
  }));

  const growthChartData = activeCareers.map(c => ({
    name: c.name.split(' ').map(w => w.charAt(0)).join(''),
    fullName: c.name,
    'Growth Rate %': c.growth
  }));

  const aiRiskChartData = activeCareers.map(c => ({
    name: c.name.split(' ').map(w => w.charAt(0)).join(''),
    fullName: c.name,
    'AI Risk %': parseFloat(c.aiRisk.replace('%', '') || '0')
  }));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading career database…</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center">
            <BrainCircuit size={28} className="text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Could not load Career Database</h3>
            <p className="text-xs text-slate-400 mt-1">{fetchError}</p>
          </div>
          <button
            onClick={() => setRetryCount(c => c + 1)}
            className="px-5 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Career selector panel (shown in both empty and filled states)
  const SelectorPanel = () => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-3 transition-colors">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 px-3 py-2 rounded-xl w-full sm:max-w-xs border border-transparent focus-within:border-indigo-500/30">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder={`Search ${allCareers.length} careers…`}
            className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-250 w-full"
          />
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Select up to 5 to compare</span>
        {selectedIds.length > 0 && (
          <button
            onClick={() => setSelectedIds([])}
            className="text-[10px] text-rose-500 font-bold hover:text-rose-600 transition"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setStreamFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-bold border transition-all ${
              streamFilter === cat
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {cat === 'All' ? `All (${allCareers.length})` : cat}
          </button>
        ))}
      </div>

      {/* Career pills */}
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
        {visibleCareers.length === 0 && (
          <p className="text-xs text-slate-400 italic">No careers match your search.</p>
        )}
        {visibleCareers.map((c) => {
          const selected = selectedIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => handleToggle(c.id)}
              title={c.category}
              className={`px-2.5 py-1.5 rounded-full border text-[10px] font-bold flex items-center gap-1 transition-all ${
                selected 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-550 dark:text-slate-400 hover:bg-slate-100'
              } ${selectedIds.length >= 5 && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {selected ? <Check size={10} /> : <Plus size={10} />}
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (selectedIds.length === 0) {
    return (
      <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full select-none pb-24 transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-heading">
            <GitCompare size={22} className="text-brand-primary" /> Career Comparison Matrix
          </h2>
          <p className="text-xs text-slate-400">Compare up to 5 of {allCareers.length} careers across salary, growth, AI risk, stress, and more.</p>
        </div>

        <SelectorPanel />

        <EmptyState
          illustration={
            <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17M12 5l7 2M12 5L5 7M5 7l2 8M19 7l-2 8M8 15h8M9 20h6" />
            </svg>
          }
          heading="No careers added yet ⚖"
          subtext="Search and select up to 5 careers above to compare them side by side across all key metrics."
          buttonText="Try: Compare top careers"
          onButtonClick={() => {
            const defaults = allCareers.filter(c =>
              ['chartered-accountant', 'software-engineer', 'data-scientist', 'management-consultant', 'doctor-general-physician'].includes(c.id)
            ).slice(0, 4).map(c => c.id);
            setSelectedIds(defaults.length > 0 ? defaults : allCareers.slice(0, 4).map(c => c.id));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full select-none pb-24 transition-colors">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-heading">
            <GitCompare size={22} className="text-brand-primary" /> Career Comparison Matrix
          </h2>
          <p className="text-xs text-slate-400">Comparing {activeCareers.length} career{activeCareers.length !== 1 ? 's' : ''} from a pool of {allCareers.length}.</p>
        </div>
      </div>

      <SelectorPanel />

      {/* Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-450 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 w-44 shrink-0">Metric</th>
                {activeCareers.map(c => (
                  <th key={c.id} className="p-4 font-bold text-slate-800 dark:text-slate-100 font-heading min-w-[160px]">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div>{c.name}</div>
                        <div className="text-[9px] font-normal text-slate-400 mt-0.5">{c.category}</div>
                      </div>
                      <button 
                        onClick={() => handleToggle(c.id)}
                        className="text-slate-400 hover:text-rose-500 font-normal shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Avg Entry Salary</td>
                {activeCareers.map(c => (
                  <td key={c.id} className="p-4 font-bold text-indigo-550">
                    ₹{(c.salary / 100000).toFixed(1)} LPA
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Typical Duration</td>
                {activeCareers.map(c => (
                  <td key={c.id} className="p-4">{c.duration}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Approx Fees</td>
                {activeCareers.map(c => (
                  <td key={c.id} className="p-4">{c.fees}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Difficulty</td>
                {activeCareers.map(c => (
                  <td key={c.id} className="p-4 font-bold text-amber-500 capitalize">{c.difficulty}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">AI Automation Risk</td>
                {activeCareers.map(c => {
                  const riskNum = parseFloat(c.aiRisk);
                  const color = riskNum < 20 ? 'text-emerald-500' : riskNum < 40 ? 'text-amber-500' : 'text-rose-500';
                  return (
                    <td key={c.id} className={`p-4 font-bold ${color}`}>{c.aiRisk}</td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Annual Growth Rate</td>
                {activeCareers.map(c => (
                  <td key={c.id} className="p-4 font-bold text-emerald-500">{c.growth}%</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 dark:bg-slate-950/20 text-slate-450">Stress Index</td>
                {activeCareers.map(c => {
                  const colors: Record<string, string> = { 'Very High': 'text-rose-500', High: 'text-orange-500', Medium: 'text-amber-500', Low: 'text-emerald-500' };
                  return (
                    <td key={c.id} className={`p-4 font-semibold ${colors[c.stress] || ''}`}>{c.stress}</td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salary (₹ LPA)</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salaryChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value} LPA`, 'Avg Salary']} labelFormatter={(label) => {
                  const item = salaryChartData.find(d => d.name === label);
                  return item?.fullName || label;
                }} />
                <Bar dataKey="Salary" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Growth Rate %</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}%`, 'Growth Rate']} />
                <Line type="monotone" dataKey="Growth Rate %" stroke="#7C3AED" strokeWidth={2.5} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Automation Risk %</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiRiskChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}%`, 'AI Risk']} />
                <Bar dataKey="AI Risk %" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* AI Analysis Panel */}
      <GlassCard className="p-5 space-y-3 border-indigo-500/10 dark:border-indigo-400/5 bg-indigo-500/[0.01]">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-indigo-500" />
          <h4 className="font-bold text-sm font-heading">AI Comparison Intelligence</h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
          {activeCareers.length > 0 && (() => {
            const highest = [...activeCareers].sort((a, b) => b.salary - a.salary)[0];
            const lowestRisk = [...activeCareers].sort((a, b) => parseFloat(a.aiRisk) - parseFloat(b.aiRisk))[0];
            const highestGrowth = [...activeCareers].sort((a, b) => b.growth - a.growth)[0];
            return (
              <>
                Among your selected careers, <strong>{highest?.name}</strong> offers the highest average salary at ₹{(highest.salary / 100000).toFixed(1)} LPA. 
                {' '}<strong>{lowestRisk?.name}</strong> carries the lowest AI automation risk at {lowestRisk?.aiRisk}, making it more future-proof. 
                {' '}<strong>{highestGrowth?.name}</strong> shows the strongest projected annual growth at {highestGrowth?.growth}%. 
                Consider balancing earnings potential against AI disruption risk and stress level for the best long-term career choice.
              </>
            );
          })()}
        </p>
      </GlassCard>
    </div>
  );
};
