import { useState, useEffect, useCallback } from 'react';

import { supabase } from './supabaseClient';
import { MapView } from './components/MapView';
import { LogDoorForm } from './components/LogDoorForm';
import { PitchGuide } from './components/PitchGuide';
import { StatsPanel } from './components/StatsPanel';
import { D2DLead } from './types';
import { saveLeadToSupabase, loadTodaysLeads, syncOfflineLeads } from './storage';
import { MapPin, PlusCircle, BookOpen, BarChart2, LogOut, X, Menu } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Logo } from '../components/Logo';

type D2DTab = 'map' | 'log' | 'pitch' | 'stats';

export default function D2DApp({ session, profile }: { session: any, profile: any }) {
  const [repName, setRepName] = useState<string | null>(profile?.full_name || null);
  const [repId, setRepId] = useState<string | null>(profile?.id || null);
  const [leads, setLeads] = useState<D2DLead[]>([]);
  const [activeTab, setActiveTab] = useState<D2DTab>('map');
  const [logCoords, setLogCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sessionStart] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  // Restore session
  useEffect(() => {
    if (profile) {
      setRepName(profile.full_name);
      setRepId(profile.id);
      loadTodaysLeads(profile.full_name).then(setLeads).catch(() => toast.error('Could not load leads'));
    }
  }, [profile]);

  // Load today's leads when rep logs in
  useEffect(() => {
    if (!repName) return;
    loadTodaysLeads(repName)
      .then(setLeads)
      .catch(() => toast.error('Could not load leads'));

    syncOfflineLeads();
    const syncInterval = setInterval(syncOfflineLeads, 30000);
    return () => clearInterval(syncInterval);
  }, [repName]);



  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('d2d_rep_name');
    localStorage.removeItem('d2d_rep_id');
    setRepName(null);
    setRepId(null);
    setLeads([]);
    setActiveTab('map');
    setMenuOpen(false);
  };

  const handleLogDoor = useCallback((lat: number, lng: number) => {
    setLogCoords({ lat, lng });
    setActiveTab('log');
    setMenuOpen(false);
  }, []);

  const handleSaveLead = async (leadData: Omit<D2DLead, 'id' | 'created_at' | 'rep_id'>) => {
    const saved = await saveLeadToSupabase({ ...leadData, rep_id: repId! });
    if (saved) {
      setLeads(prev => [...prev, saved]);
      setActiveTab('map');
      setLogCoords(null);
      toast.success('Door logged!');
    } else {
      throw new Error('Save failed');
    }
  };



  const tabs = [
    { id: 'map' as D2DTab, label: 'Map', icon: MapPin },
    { id: 'log' as D2DTab, label: 'Log Door', icon: PlusCircle },
    { id: 'pitch' as D2DTab, label: 'Pitch', icon: BookOpen },
    { id: 'stats' as D2DTab, label: 'Stats', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest font-sans flex flex-col">
      <Toaster position="top-center" richColors />

      {/* ── Mobile Menu Overlay ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[9999] flex md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" />

          {/* Drawer */}
          <div
            className="w-72 bg-deep-forest flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Signed in as</span>
                <span className="text-base font-bold text-amber-porch">{repName}</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-1 px-3 py-4 flex-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold text-left relative ${
                    activeTab === id ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${activeTab === id ? 'text-pathway-green' : 'text-white/50'}`} />
                  {label}
                  {id === 'stats' && leads.length > 0 && (
                    <span className="ml-auto bg-amber-porch text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {leads.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="px-5 pb-8 pt-2 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-sm font-bold"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header — matches inspection app exactly ── */}
      <header className="h-20 bg-deep-forest text-linen-white flex items-center px-4 md:px-8 shadow-md sticky top-0 z-10 w-full shrink-0">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          {/* Logo */}
          <Logo />

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors text-xs font-bold uppercase relative ${
                    activeTab === id ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === id ? 'text-pathway-green' : ''}`} />
                  {label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden md:block h-8 w-[1px] bg-white/20 mx-1" />

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

            {/* Mobile: doors pill + hamburger menu */}
            <div className="flex items-center gap-2 md:hidden">
              {leads.length > 0 && (
                <div className="flex flex-col items-center bg-pathway-green px-3 py-1 rounded-xl shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-white/80">Doors</span>
                  <span className="text-base font-bold leading-none text-white">{leads.length}</span>
                </div>
              )}
              <button
                onClick={() => setMenuOpen(true)}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">

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
    </div>
  );
}
