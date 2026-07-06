import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/GlassCard';
import { EmptyState } from '../components/EmptyState';
import { 
  GraduationCap, Search, Grid, Map as MapIcon, Heart, Compass, Loader2, SlidersHorizontal, AlertCircle
} from 'lucide-react';

interface College {
  id: string;
  name: string;
  country: string;
  city: string;
  state?: string;
  ranking: string;
  avgPackage: string;
  highestPackage: string;
  placementRate: string;
  acceptanceRate: string;
  fees: string;
  hostelFees: string;
  scholarships: string;
  popularCourses: string[];
  entranceExams?: string[];
  type?: string;
  rating: number;
  lat: number;
  lng: number;
  nearbyHostels: string;
  nearbyAirports: string;
  nearbyMetro: string;
  costOfLiving: string;
  description: string;
  streamFocus?: string[];
  numericFees?: number;
}

const COUNTRIES = ['All', 'India', 'Canada', 'United Kingdom', 'USA', 'Australia', 'Germany', 'Singapore'];
const STREAMS   = ['All', 'Commerce', 'Technology', 'Engineering', 'Medicine', 'Law', 'Business', 'Arts & Design', 'Science'];

export const CollegeExplorer: React.FC = () => {
  const { savedColleges, toggleSaveCollege } = useApp();
  const [colleges, setColleges]         = useState<College[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [retryCount, setRetryCount]     = useState(0);
  const [searchVal, setSearchVal]       = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [streamFilter, setStreamFilter]   = useState('All');
  const [viewMode, setViewMode]         = useState<'grid' | 'map'>('grid');
  const [selectedCollegeId, setSelectedCollegeId] = useState('srcc');
  const [activeTab, setActiveTab]       = useState<any>('all');
  const [showFilters, setShowFilters]   = useState(false);

  // ── Fetch full college list from backend ─────────────────────────────────
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch('/api/colleges');
        if (!res.ok) throw new Error(`Server error ${res.status}: ${res.statusText}`);
        const data: College[] = await res.json();
        setColleges(data);
        if (data.length > 0) setSelectedCollegeId(data[0].id);
      } catch (err: any) {
        console.error('College fetch error:', err);
        setFetchError(err?.message || 'Could not load college database. Is the server running?');
      } finally {
        setLoading(false);
      }
    };
    fetchColleges();
  }, [retryCount]);

  const handleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleSaveCollege(id);
  };

  // ── Client-side filter (fast, avoids extra round-trips) ──────────────────
  const filteredColleges = useMemo(() => {
    return colleges.filter((col) => {
      const matchesSearch = !searchVal ||
        col.name.toLowerCase().includes(searchVal.toLowerCase()) ||
        col.city.toLowerCase().includes(searchVal.toLowerCase()) ||
        (col.popularCourses || []).some(c => c.toLowerCase().includes(searchVal.toLowerCase()));
      const matchesCountry = countryFilter === 'All' || col.country.toLowerCase() === countryFilter.toLowerCase();
      const matchesStream  = streamFilter === 'All' ||
        (col.streamFocus || []).some(s => s.toLowerCase().includes(streamFilter.toLowerCase()));
      const matchesSaved   = activeTab === 'all' || savedColleges.includes(col.id);
      return matchesSearch && matchesCountry && matchesStream && matchesSaved;
    });
  }, [colleges, searchVal, countryFilter, streamFilter, activeTab, savedColleges]);

  const activeCollege = useMemo(
    () => colleges.find(c => c.id === selectedCollegeId) || colleges[0],
    [colleges, selectedCollegeId]
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading {colleges.length > 0 ? colleges.length : ''} colleges…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center">
            <AlertCircle size={28} className="text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Could not load College Database</h3>
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

  // ── Empty saved state ─────────────────────────────────────────────────────
  if (activeTab === 'saved' && savedColleges.length === 0) {
    return (
      <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full select-none pb-24 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-heading">
              <GraduationCap size={22} className="text-brand-primary" /> College Finder Explorer
            </h2>
            <p className="text-xs text-slate-400">Browse {colleges.length} real universities worldwide — India, USA, UK, Canada, Australia, Germany & Singapore.</p>
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button onClick={() => setActiveTab('saved')} className={`text-xs font-bold transition-all ${activeTab === 'saved' ? 'text-indigo-500 border-b-2 border-indigo-500 pb-2 font-extrabold' : 'text-slate-450 hover:text-slate-600'}`}>
            Saved Colleges (0)
          </button>
          <button onClick={() => setActiveTab('all')} className={`text-xs font-bold transition-all ${activeTab === 'all' ? 'text-indigo-500 border-b-2 border-indigo-500 pb-2 font-extrabold' : 'text-slate-450 hover:text-slate-600'}`}>
            Search & Recommended ({colleges.length})
          </button>
        </div>

        <EmptyState
          illustration={
            <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479L12 21l-6.825-4a12.083 12.083 0 01.665-6.479L12 14z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7a2 2 0 01-2 2h-3" />
            </svg>
          }
          heading="No colleges saved yet 🎓"
          subtext={`Search across ${colleges.length} global universities or complete your profile to see AI-matched colleges.`}
          buttonText="Browse All Colleges"
          onButtonClick={() => setActiveTab('all')}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full select-none pb-24 transition-colors">

      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-heading">
            <GraduationCap size={22} className="text-brand-primary" /> College Finder Explorer
          </h2>
          <p className="text-xs text-slate-400">{colleges.length} universities worldwide — India, USA, UK, Canada, Australia, Germany & Singapore.</p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${showFilters ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
          >
            <SlidersHorizontal size={13} /> Filters
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-750 text-indigo-500 shadow-sm' : 'text-slate-500'}`}
            >
              <Grid size={14} /> Grid
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'map' ? 'bg-white dark:bg-slate-750 text-indigo-500 shadow-sm' : 'text-slate-500'}`}
            >
              <MapIcon size={14} /> Detail
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-250 dark:border-slate-805 pb-2">
        <button onClick={() => setActiveTab('saved')} className={`text-xs font-bold transition-all ${activeTab === 'saved' ? 'text-indigo-500 border-b-2 border-indigo-500 pb-2 font-extrabold' : 'text-slate-450 hover:text-slate-600'}`}>
          Saved Colleges ({savedColleges.length})
        </button>
        <button onClick={() => setActiveTab('all')} className={`text-xs font-bold transition-all ${activeTab === 'all' ? 'text-indigo-500 border-b-2 border-indigo-500 pb-2 font-extrabold' : 'text-slate-450 hover:text-slate-600'}`}>
          All Colleges ({colleges.length})
        </button>
      </div>

      {/* Filters strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 transition-colors">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 px-3.5 py-2 rounded-xl w-full md:max-w-sm border border-transparent focus-within:border-indigo-500/30">
            <Search size={15} className="text-slate-400" />
            <input 
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search name, city, or course..."
              className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-250 w-full"
            />
          </div>

          {/* Country filter */}
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto scrollbar-none flex-wrap">
            {COUNTRIES.map(country => (
              <button
                key={country}
                onClick={() => setCountryFilter(country)}
                className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all whitespace-nowrap ${
                  countryFilter === country
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-550 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {country}
              </button>
            ))}
          </div>
        </div>

        {/* Stream filter row */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 self-center mr-1">Stream:</span>
            {STREAMS.map(stream => (
              <button
                key={stream}
                onClick={() => setStreamFilter(stream)}
                className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all whitespace-nowrap ${
                  streamFilter === stream
                    ? 'bg-violet-500/10 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-550 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {stream}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-slate-400">
        Showing <span className="font-bold text-slate-600 dark:text-slate-300">{filteredColleges.length}</span> of {colleges.length} colleges
        {countryFilter !== 'All' && ` in ${countryFilter}`}
        {streamFilter !== 'All' && ` · ${streamFilter}`}
        {searchVal && ` · matching "${searchVal}"`}
      </p>

      {/* AI Advisor Insight */}
      <GlassCard className="p-4 flex gap-4 border-indigo-500/10 dark:border-indigo-400/5 bg-indigo-500/[0.01] items-start">
        <Compass size={20} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-350">
          <span className="font-bold text-slate-800 dark:text-slate-100">AI College Advisor: </span>
          Use the stream and country filters to narrow down by your field of interest. Budget-sensitive? Try filtering by <strong>India</strong> + <strong>Government</strong> type for fees under ₹2L/yr. Going abroad on a budget? <strong>Germany</strong> offers top engineering degrees (TUM, RWTH Aachen) for under €3,500/year — nearly free.
        </div>
      </GlassCard>

      {/* No results */}
      {filteredColleges.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <GraduationCap size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">No colleges match your filters</p>
          <p className="text-xs mt-1">Try clearing the stream or country filter</p>
          <button
            onClick={() => { setCountryFilter('All'); setStreamFilter('All'); setSearchVal(''); }}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 transition"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Main content — Grid or Detail view */}
      {filteredColleges.length > 0 && viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredColleges.map((col) => {
            const isSaved = savedColleges.includes(col.id);
            return (
              <div 
                key={col.id}
                onClick={() => { setSelectedCollegeId(col.id); setViewMode('map'); }}
                className="glass-panel p-4 rounded-xl cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-between"
              >
                <div>
                  {/* Initials avatar */}
                  <div className="w-full h-28 rounded-lg bg-gradient-to-tr from-slate-200 to-indigo-50 dark:from-slate-800 dark:to-slate-850 flex items-center justify-center text-slate-400 text-2xl font-heading font-extrabold relative shadow-inner">
                    {col.name.split(' ').filter(x => x.length > 2).map(x => x.charAt(0)).slice(0, 3).join('')}
                    {/* Type badge */}
                    {col.type && (
                      <span className="absolute bottom-2 left-2 text-[8px] font-bold bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded text-slate-500">
                        {col.type.includes('Government') ? '🏛️ Govt' : col.type.includes('Private') ? '🏢 Private' : col.type}
                      </span>
                    )}
                    <button 
                      onClick={(e) => handleSave(e, col.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 hover:scale-105 active:scale-95 transition-transform"
                    >
                      <Heart size={13} className={isSaved ? 'fill-indigo-500 text-indigo-500' : 'text-slate-500'} />
                    </button>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{col.city}, {col.country}</span>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs font-heading line-clamp-2">{col.name}</h4>
                    <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">{col.ranking}</p>
                    {/* Stream tags */}
                    {col.streamFocus && col.streamFocus.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {col.streamFocus.slice(0, 3).map(s => (
                          <span key={s} className="text-[8px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] space-y-1.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Package:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{col.avgPackage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Annual Tuition:</span>
                    <span className="font-bold text-indigo-550">{col.fees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Placement:</span>
                    <span className="font-bold text-emerald-500">{col.placementRate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : filteredColleges.length > 0 ? (
        /* Detail / Map View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 460 }}>
          
          {/* List sidebar */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 overflow-y-auto max-h-[500px] transition-colors">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {filteredColleges.length} Universities
            </h3>
            {filteredColleges.map((col) => (
              <div 
                key={col.id}
                onClick={() => setSelectedCollegeId(col.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedCollegeId === col.id 
                    ? 'bg-slate-100 dark:bg-slate-800 border-indigo-500/40 dark:border-indigo-400/40 font-bold' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <h4 className="text-xs text-slate-800 dark:text-slate-150 line-clamp-1 font-heading">{col.name}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{col.city}, {col.country} · {col.fees}</p>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {activeCollege && (
            <div className="lg:col-span-2 space-y-4">
              <GlassCard className="p-5 flex flex-col gap-5 border-l-4 border-l-brand-secondary">
                
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{activeCollege.city}, {activeCollege.country} · {activeCollege.type}</span>
                  <h3 className="text-base font-bold font-heading mt-0.5">{activeCollege.name}</h3>
                  <p className="text-[11px] text-indigo-500 font-semibold italic mt-0.5">{activeCollege.ranking}</p>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{activeCollege.description}</p>

                {/* Key stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  {[
                    { label: 'Annual Tuition', value: activeCollege.fees, color: 'text-indigo-500' },
                    { label: 'Avg Package', value: activeCollege.avgPackage, color: 'text-emerald-500' },
                    { label: 'Placement Rate', value: activeCollege.placementRate, color: 'text-sky-500' },
                    { label: 'Acceptance Rate', value: activeCollege.acceptanceRate, color: 'text-amber-500' },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5">
                      <span className="text-slate-400 block mb-1">{item.label}</span>
                      <span className={`font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Courses */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Popular Programs</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeCollege.popularCourses || []).map(c => (
                      <span key={c} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>

                {/* Proximity metrics */}
                <div className="grid grid-cols-2 gap-4 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Student Housing:</span>
                    <p className="text-slate-700 dark:text-slate-350">{activeCollege.nearbyHostels}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Metro / Transit:</span>
                    <p className="text-slate-700 dark:text-slate-350">{activeCollege.nearbyMetro}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Cost of Living:</span>
                    <p className="text-emerald-500 font-bold">{activeCollege.costOfLiving}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Nearest Airport:</span>
                    <p className="text-slate-700 dark:text-slate-350">{activeCollege.nearbyAirports}</p>
                  </div>
                </div>

                {/* Scholarships & Entrance */}
                <div className="grid grid-cols-2 gap-4 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Scholarships:</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCollege.scholarships}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Entrance Exams:</span>
                    <p className="text-slate-700 dark:text-slate-350">{(activeCollege.entranceExams || []).join(', ')}</p>
                  </div>
                </div>

              </GlassCard>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
