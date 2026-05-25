import { useState, useEffect, useCallback } from 'react';
import { D2DLogin } from './components/D2DLogin';
import { MapView } from './components/MapView';
import { LogDoorForm } from './components/LogDoorForm';
import { PitchGuide } from './components/PitchGuide';
import { StatsPanel } from './components/StatsPanel';
import { D2DLead } from './types';
import { saveLeadToSupabase, loadTodaysLeads } from './storage';
import { MapPin, PlusCircle, BookOpen, BarChart2, LogOut, X, Menu } from 'lucide-react';
import { Toaster, toast } from 'sonner';

type D2DTab = 'map' | 'log' | 'pitch' | 'stats';

export default function D2DApp() {
  const [repName, setRepName] = useState<string | null>(null);
  const [leads, setLeads] = useState<D2DLead[]>([]);
  const [activeTab, setActiveTab] = useState<D2DTab>('map');
  const [logCoords, setLogCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sessionStart] = useState(new Date());

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem('d2d_rep_name');
    if (saved) setRepName(saved);
  }, []);

  // Load today's leads when rep logs in
  useEffect(() => {
    if (!repName) return;
    loadTodaysLeads(repName)
      .then(setLeads)
      .catch(() => toast.error('Could not load leads'));
  }, [repName]);

  const handleLogin = (name: string) => setRepName(name);

  const handleLogout = () => {
    localStorage.removeItem('d2d_rep_name');
    setRepName(null);
    setLeads([]);
    setActiveTab('map');
  };

  const handleLogDoor = useCallback((lat: number, lng: number) => {
    setLogCoords({ lat, lng });
    setActiveTab('log');
  }, []);

  const handleSaveLead = async (leadData: Omit<D2DLead, 'id' | 'created_at'>) => {
    const saved = await saveLeadToSupabase(leadData);
    if (saved) {
      setLeads(prev => [...prev, saved]);
      setActiveTab('map');
      setLogCoords(null);
      toast.success('Door logged!');
    } else {
      throw new Error('Save failed');
    }
  };

  if (!repName) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <D2DLogin onLogin={handleLogin} />
      </>
    );
  }

  const tabs = [
    { id: 'map' as D2DTab, label: 'Map', icon: MapPin },
    { id: 'log' as D2DTab, label: 'Log Door', icon: PlusCircle },
    { id: 'pitch' as D2DTab, label: 'Pitch', icon: BookOpen },
    { id: 'stats' as D2DTab, label: 'Stats', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest font-sans flex flex-col">
      <Toaster position="top-center" richColors />

      {/* ── Header — matches inspection app exactly ── */}
      <header className="h-20 bg-deep-forest text-linen-white flex items-center px-4 md:px-8 shadow-md sticky top-0 z-10 w-full shrink-0">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
              <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
              <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
              <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
              <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-xl text-white tracking-tight">Wayside</span>
              <span className="font-bold text-[9px] text-pathway-green tracking-[0.25em] uppercase">D2D Sales</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Doors badge */}
            <div className="flex flex-col items-center bg-pathway-green px-3 py-1 rounded-xl shadow-inner">
              <span className="text-[10px] uppercase font-bold text-white/80">Doors</span>
              <span className="text-base font-bold leading-none text-white">{leads.length}</span>
            </div>

            {/* Divider */}
            <div className="hidden md:block h-8 w-[1px] bg-white/20" />

            {/* Rep name + logout */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <p className="text-xs opacity-70 uppercase font-semibold">Rep</p>
                  <button onClick={handleLogout} className="text-[9px] uppercase font-bold text-white/40 hover:text-white transition-colors underline">
                    Logout
                  </button>
                </div>
                <p className="text-sm font-medium text-amber-porch">{repName}</p>
              </div>
            </div>

            {/* Mobile logout */}
            <button
              onClick={handleLogout}
              className="md:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 80px - 64px)' }}>

        {/* Map — full bleed, no padding */}
        {activeTab === 'map' && (
          <MapView leads={leads} onLogDoor={handleLogDoor} />
        )}

        {/* Log Door */}
        {activeTab === 'log' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="px-5 pt-6 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-pathway-green uppercase tracking-wider">Log a Door</h2>
                  <p className="text-[11px] italic text-deep-forest/70 mt-1">Record the outcome of this knock</p>
                </div>
                <button
                  onClick={() => { setActiveTab('map'); setLogCoords(null); }}
                  className="w-9 h-9 rounded-xl border border-deep-forest/10 flex items-center justify-center text-deep-forest/40 hover:text-deep-forest transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <LogDoorForm
                repName={repName}
                initialLat={logCoords?.lat}
                initialLng={logCoords?.lng}
                onSave={handleSaveLead}
                onCancel={() => { setActiveTab('map'); setLogCoords(null); }}
              />
            </div>
          </div>
        )}

        {/* Pitch Guide */}
        {activeTab === 'pitch' && (
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="max-w-4xl mx-auto">
              <div className="px-5 pt-6 pb-0">
                <h2 className="text-sm font-bold text-pathway-green uppercase tracking-wider">Pitch Guide</h2>
                <p className="text-[11px] italic text-deep-forest/70 mt-1">Plans, pricing, and objection rebuttals</p>
              </div>
              <PitchGuide />
            </div>
          </div>
        )}

        {/* Stats */}
        {activeTab === 'stats' && (
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="max-w-4xl mx-auto">
              <div className="px-5 pt-6 pb-0">
                <h2 className="text-sm font-bold text-pathway-green uppercase tracking-wider">Today's Stats</h2>
                <p className="text-[11px] italic text-deep-forest/70 mt-1">
                  {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <StatsPanel leads={leads} sessionStart={sessionStart} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Tab Bar ── */}
      <nav className="shrink-0 bg-white border-t border-deep-forest/10 flex items-stretch h-16 z-10 shadow-[0_-1px_0_rgba(27,58,45,0.06)]">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
                isActive ? 'text-pathway-green' : 'text-deep-forest/30 hover:text-deep-forest/60'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {id === 'log' && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-pathway-green rounded-full" />
                )}
                {id === 'stats' && leads.length > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 text-[9px] font-black text-amber-porch">
                    {leads.length}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-pathway-green' : 'text-deep-forest/30'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
