import { useState, useEffect } from 'react';
import { AuthLogin } from '../components/AuthLogin';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { LayoutDashboard, Users, ClipboardList, LogOut, Loader2, MapPin, Search, FileText, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type AdminTab = 'dashboard' | 'inspections' | 'leads' | 'team';

export default function AdminApp() {
  const [adminName, setAdminName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  
  const [inspections, setInspections] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  const formatSeconds = (s: number) => {
    if (!s) return 'Unknown';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

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
        const [inspectionsRes, leadsRes, profilesRes] = await Promise.all([
          supabase.from('inspections').select('*').order('created_at', { ascending: false }),
          supabase.from('d2d_leads').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: true })
        ]);
        
        if (inspectionsRes.error) throw inspectionsRes.error;
        if (leadsRes.error) throw leadsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        setInspections(inspectionsRes.data || []);
        setLeads(leadsRes.data || []);
        setProfiles(profilesRes.data || []);
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

  const renderDashboard = () => {
    const totalLeads = leads.length;
    const appointmentsSet = leads.filter(l => l.status === 'scheduled').length;
    const conversionRate = totalLeads > 0 ? Math.round((appointmentsSet / totalLeads) * 100) : 0;
    
    // Group leads by rep
    const repStats = leads.reduce((acc, lead) => {
      acc[lead.rep_name] = acc[lead.rep_name] || { total: 0, appointments: 0 };
      acc[lead.rep_name].total++;
      if (lead.status === 'scheduled') acc[lead.rep_name].appointments++;
      return acc;
    }, {} as Record<string, { total: number, appointments: number }>);
    
    const topReps = Object.entries(repStats)
      .sort((a, b) => b[1].appointments - a[1].appointments)
      .slice(0, 3);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-pathway-green/10 text-pathway-green rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-bold text-deep-forest mb-1">{inspections.length}</h3>
            <p className="text-sm font-bold uppercase tracking-wider text-deep-forest/50">Total Inspections</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-amber-porch/10 text-amber-porch rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-bold text-deep-forest mb-1">{totalLeads}</h3>
            <p className="text-sm font-bold uppercase tracking-wider text-deep-forest/50">D2D Leads Logged</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-deep-forest/10 text-deep-forest rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-bold text-deep-forest mb-1">{conversionRate}%</h3>
            <p className="text-sm font-bold uppercase tracking-wider text-deep-forest/50">Appt Conversion Rate</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5">
          <h3 className="text-lg font-bold text-deep-forest mb-4">Top Performing Reps</h3>
          <div className="divide-y divide-deep-forest/5">
            {topReps.map(([name, stats], idx) => (
              <div key={name} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-deep-forest/5 flex items-center justify-center text-sm font-bold text-deep-forest">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-deep-forest">{name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-pathway-green">{stats.appointments} Appts</span>
                  <span className="text-xs text-deep-forest/40 ml-2">({stats.total} doors)</span>
                </div>
              </div>
            ))}
            {topReps.length === 0 && <p className="text-sm text-deep-forest/50 py-2">No leads logged yet.</p>}
          </div>
        </div>
      </div>
    );
  };

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
              <div className="text-right flex flex-col items-end gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pathway-green/10 text-pathway-green text-xs font-bold uppercase tracking-wide">
                  Completed
                </span>
                <Button variant="ghost" onClick={() => setSelectedInspection(insp)} className="text-xs font-bold text-deep-forest hover:bg-deep-forest/5 h-8">
                  View Details
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-forest/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedInspection(null)}>
          <div className="bg-linen-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 bg-white border-b border-deep-forest/10 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-deep-forest mb-1">Inspection Details</h2>
                <p className="text-sm font-bold text-deep-forest/60 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {selectedInspection.property_address}
                </p>
              </div>
              <button onClick={() => setSelectedInspection(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-deep-forest/5 hover:bg-deep-forest/10 text-deep-forest transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Client</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">{selectedInspection.client_name}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Phone</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">{selectedInspection.client_phone || 'N/A'}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Date</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">{new Date(selectedInspection.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Technician</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">
                    {profiles.find(p => p.id === selectedInspection.technician_id)?.full_name || 'Unknown Tech'}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Duration</span>
                  <p className="font-bold text-pathway-green text-sm mt-1">
                    {formatSeconds(selectedInspection.duration_seconds)}
                  </p>
                </div>
              </div>

              {/* Raw Client Info Expansion (if exists) */}
              {selectedInspection.client_info && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-2 block">Full Client Data Payload</span>
                  <pre className="text-xs text-deep-forest/70 bg-linen-white p-3 rounded-xl overflow-x-auto">
                    {JSON.stringify(selectedInspection.client_info, null, 2)}
                  </pre>
                </div>
              )}

              {/* PDF Button */}
              {selectedInspection.pdf_url && (
                <a href={selectedInspection.pdf_url} target="_blank" rel="noopener noreferrer" className="bg-amber-porch text-white font-bold px-6 py-4 rounded-2xl flex items-center justify-between group hover:brightness-110 transition-all shadow-md shadow-amber-porch/20">
                  <span className="flex items-center gap-2"><FileText className="w-5 h-5" /> Official PDF Report</span>
                  <Download className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </a>
              )}

              {/* Checklist Breakdown */}
              <div>
                <h3 className="text-lg font-bold text-deep-forest mb-4 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> Checklist X-Ray
                </h3>
                <div className="grid gap-3">
                  {selectedInspection.checklist_data && Array.isArray(selectedInspection.checklist_data) ? selectedInspection.checklist_data.map((item: any, idx: number) => {
                    if (!item) return null;
                    const isPass = item.status === 'Pass' || item.status === 'Good';
                    const statusColor = isPass ? 'text-pathway-green bg-pathway-green/10' : 'text-red-600 bg-red-50';
                    return (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-deep-forest/5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-deep-forest text-sm">Item {idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                            {item.status || 'N/A'}
                          </span>
                        </div>
                        {item.seasonalTaskName && (
                          <p className="text-xs font-bold text-amber-porch mb-1">Seasonal Task: {item.seasonalTaskName}</p>
                        )}
                        {item.notes && (
                          <div className="mt-2 text-xs text-deep-forest/70 bg-linen-white p-3 rounded-lg border border-deep-forest/5 italic">
                            "{item.notes}"
                          </div>
                        )}
                        {item.rooms && item.rooms.length > 0 && (
                          <div className="mt-2 pl-3 border-l-2 border-pathway-green/20">
                            <span className="text-[10px] font-bold uppercase text-deep-forest/40">Room Details:</span>
                            {item.rooms.map((r: any, rIdx: number) => (
                              <p key={rIdx} className="text-xs text-deep-forest/80 mt-1">
                                <strong className="text-deep-forest">{r.name || 'Room'}:</strong> {r.notes || 'No notes'}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-deep-forest/50 italic p-4 bg-white rounded-xl">No detailed checklist data available for this legacy record.</p>
                  )}
                </div>
              </div>

              {/* Signatures */}
              {(selectedInspection.client_signature || selectedInspection.technician_signature) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {selectedInspection.client_signature && (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5 flex flex-col items-center">
                      <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-2">Client Signature</span>
                      <img src={selectedInspection.client_signature} alt="Client Signature" className="h-20 object-contain mix-blend-multiply" />
                    </div>
                  )}
                  {selectedInspection.technician_signature && (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5 flex flex-col items-center">
                      <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-2">Technician Signature</span>
                      <img src={selectedInspection.technician_signature} alt="Technician Signature" className="h-20 object-contain mix-blend-multiply" />
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
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
              <div className="text-right flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-forest/10 text-deep-forest text-xs font-bold uppercase tracking-wide">
                  {lead.status.replace('_', ' ')}
                </span>
                {lead.status === 'scheduled' && !lead.assigned_tech_id && (
                  <select
                    className="text-xs p-1.5 border border-deep-forest/20 rounded-md bg-white focus:outline-none"
                    onChange={async (e) => {
                      const techId = e.target.value;
                      if (!techId) return;
                      const { error } = await supabase.from('d2d_leads').update({ assigned_tech_id: techId }).eq('id', lead.id);
                      if (error) toast.error('Failed to assign job');
                      else {
                        toast.success('Job assigned to tech!');
                        setLeads(leads.map(l => l.id === lead.id ? { ...l, assigned_tech_id: techId } : l));
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Assign Tech...</option>
                    {profiles.filter(p => p.role === 'technician').map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                    ))}
                  </select>
                )}
                {lead.assigned_tech_id && (
                  <span className="text-[10px] uppercase font-bold text-pathway-green">
                    Assigned to {profiles.find(p => p.id === lead.assigned_tech_id)?.full_name || 'Tech'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <Users className="w-5 h-5 text-deep-forest" /> Employee Roster
        </h3>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {profiles.map(profile => (
          <div key={profile.id} className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-deep-forest text-lg">{profile.full_name}</p>
              <p className="text-xs font-bold text-deep-forest/40 uppercase tracking-wide mt-1">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="text-sm p-2 border border-deep-forest/20 rounded-lg bg-white font-bold text-deep-forest focus:outline-none"
                value={profile.role}
                onChange={async (e) => {
                  const newRole = e.target.value;
                  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
                  if (error) toast.error('Failed to update role');
                  else {
                    toast.success('Role updated successfully');
                    setProfiles(profiles.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
                  }
                }}
              >
                <option value="technician">Technician</option>
                <option value="rep">Sales Rep</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'inspections' as AdminTab, label: 'Inspections', icon: ClipboardList },
    { id: 'leads' as AdminTab, label: 'Leads', icon: MapPin },
    { id: 'team' as AdminTab, label: 'Team', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 md:pb-0 md:pl-64 font-sans flex flex-col">
      <Toaster position="top-center" richColors />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-64 bg-deep-forest border-r border-white/10 z-30 shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" className="w-8 h-8 shrink-0 drop-shadow-[0_0_10px_rgba(29,158,117,0.3)]" fill="none">
              <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
              <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
              <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
              <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-bold tracking-tight text-white">Wayside <span className="text-amber-porch">Admin</span></span>
            </div>
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
          <svg viewBox="0 0 48 48" className="w-6 h-6 shrink-0" fill="none">
            <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
            <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
            <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
            <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-bold text-lg">Admin</span>
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
            {activeTab === 'team' && renderTeam()}
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
