import { useState, useEffect } from 'react';
import { AuthLogin } from '../components/AuthLogin';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { LayoutDashboard, Users, ClipboardList, LogOut, Loader2, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type AdminTab = 'dashboard' | 'inspections' | 'leads';

export default function AdminApp() {
  const [adminName, setAdminName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  
  const [inspections, setInspections] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedName = localStorage.getItem('wayside_admin_name');
    if (savedName) setAdminName(savedName);
  }, []);

  const handleLogin = (session: any, profile: any) => {
    localStorage.setItem('wayside_admin_name', profile.full_name);
    setAdminName(profile.full_name);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('wayside_admin_name');
    setAdminName(null);
  };

  useEffect(() => {
    if (!adminName) return;

    async function fetchData() {
      setLoading(true);
      try {
        const [inspectionsRes, leadsRes] = await Promise.all([
          supabase.from('inspections').select('*').order('created_at', { ascending: false }),
          supabase.from('d2d_leads').select('*').order('created_at', { ascending: false })
        ]);
        
        if (inspectionsRes.error) throw inspectionsRes.error;
        if (leadsRes.error) throw leadsRes.error;

        setInspections(inspectionsRes.data || []);
        setLeads(leadsRes.data || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [adminName]);

  if (!adminName) {
    return (
      <div className="min-h-screen bg-linen-white text-deep-forest font-sans">
        <Toaster position="top-center" richColors />
        <AuthLogin
          onLogin={handleLogin}
          requiredRole="admin"
          title="Admin Portal"
          subtitle="Sign in to oversee operations."
          altLinkText="Technician? Switch to Inspection App"
          altLinkHref="/"
        />
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:-translate-y-1 transition-all" onClick={() => setActiveTab('inspections')}>
        <div className="w-16 h-16 bg-pathway-green/10 text-pathway-green rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <ClipboardList className="w-8 h-8" />
        </div>
        <h3 className="text-3xl font-bold text-deep-forest mb-1">{inspections.length}</h3>
        <p className="text-sm font-bold uppercase tracking-wider text-deep-forest/50">Total Inspections</p>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:-translate-y-1 transition-all" onClick={() => setActiveTab('leads')}>
        <div className="w-16 h-16 bg-amber-porch/10 text-amber-porch rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <MapPin className="w-8 h-8" />
        </div>
        <h3 className="text-3xl font-bold text-deep-forest mb-1">{leads.length}</h3>
        <p className="text-sm font-bold uppercase tracking-wider text-deep-forest/50">D2D Leads Logged</p>
      </div>
    </div>
  );

  const renderInspections = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-pathway-green" /> Inspection Reports
        </h3>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {inspections.length === 0 ? (
          <div className="p-8 text-center text-deep-forest/50">No inspections found.</div>
        ) : (
          inspections.map(insp => (
            <div key={insp.id} className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-deep-forest text-lg">{insp.client_name}</p>
                <p className="text-sm text-deep-forest/60">{insp.property_address}</p>
                <p className="text-xs font-bold text-deep-forest/40 uppercase tracking-wide mt-1">
                  {new Date(insp.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pathway-green/10 text-pathway-green text-xs font-bold uppercase tracking-wide">
                  Completed
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderLeads = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-porch" /> D2D Leads
        </h3>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {leads.length === 0 ? (
          <div className="p-8 text-center text-deep-forest/50">No leads found.</div>
        ) : (
          leads.map(lead => (
            <div key={lead.id} className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-deep-forest text-lg">{lead.contact_name || 'No Contact Name'}</p>
                <p className="text-sm text-deep-forest/60">{lead.address}</p>
                <p className="text-xs text-deep-forest/40 mt-1">Logged by {lead.rep_name}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-forest/10 text-deep-forest text-xs font-bold uppercase tracking-wide">
                  {lead.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'inspections' as AdminTab, label: 'Inspections', icon: ClipboardList },
    { id: 'leads' as AdminTab, label: 'Leads', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 md:pb-0 md:pl-64 font-sans flex flex-col">
      <Toaster position="top-center" richColors />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-64 bg-deep-forest border-r border-white/10 z-30 shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-pathway-green flex items-center justify-center text-white font-bold shrink-0 shadow-[0_0_15px_rgba(29,158,117,0.5)]">
              W
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Wayside <span className="text-amber-porch">Admin</span></h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                  active 
                    ? 'bg-pathway-green text-white shadow-[0_0_15px_rgba(29,158,117,0.3)]' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white/40'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex flex-col gap-1 mb-4 px-2">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Signed in as</span>
            <span className="text-sm font-bold text-amber-porch truncate">{adminName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors font-bold text-sm"
          >
            <LogOut className="w-5 h-5 opacity-50" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-20 bg-deep-forest text-white shadow-lg border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-pathway-green flex items-center justify-center text-white text-xs font-bold">W</div>
          <span className="font-bold">Admin</span>
        </div>
        <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-deep-forest tracking-tight">
            {activeTab === 'dashboard' ? 'Overview' : activeTab === 'inspections' ? 'Inspections' : 'Sales Leads'}
          </h2>
          <p className="text-deep-forest/60 mt-1">Manage and oversee Wayside operations.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-deep-forest/40">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-pathway-green" />
            <p className="font-bold tracking-wide uppercase text-xs">Loading data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'inspections' && renderInspections()}
            {activeTab === 'leads' && renderLeads()}
          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-deep-forest/10 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1 relative"
            >
              <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-pathway-green/10 text-pathway-green' : 'text-deep-forest/40'}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${active ? 'text-pathway-green' : 'text-deep-forest/40'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
