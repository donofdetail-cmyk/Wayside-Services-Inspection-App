import { useState, useEffect } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { Menu, LayoutDashboard, Users, ClipboardList, LogOut, Loader2, MapPin, Search, FileText, Download, X, Calendar as CalendarIcon, BarChart3, Inbox, Clock, Send, Settings, Kanban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

type AdminTab = 'dashboard' | 'clients' | 'pipeline' | 'analytics' | 'dispatch' | 'action_center' | 'inspections' | 'leads' | 'team' | 'settings';

export default function AdminApp({ session, profile }: { session: any, profile: any }) {
  const [adminName, setAdminName] = useState<string | null>(profile?.full_name || null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [clientNotes, setClientNotes] = useState<any[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<any[]>([]);
  
  const [inspections, setInspections] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageTemplates, setMessageTemplates] = useState<{id: string, name: string, type: 'sms'|'email', content: string}[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const formatSeconds = (s: number) => {
    if (!s) return 'Unknown';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  useEffect(() => {
    if (profile) {
      setAdminName(profile.full_name);
    }
  }, [profile]);

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
        const savedTemplates = localStorage.getItem('wayside_message_templates');
        if (savedTemplates) {
          setMessageTemplates(JSON.parse(savedTemplates));
        } else {
          setMessageTemplates([
            { id: '1', name: 'D2D Not Home Follow-up', type: 'sms', content: 'Hi {{name}}, sorry we missed you! We are doing free roof inspections in {{neighborhood}} this week. Reply YES to book a slot.' },
            { id: '2', name: 'Post-Inspection Review', type: 'email', content: 'Hi {{name}}, thanks for choosing Wayside Services! Could you take 30 seconds to leave us a review?' },
            { id: '3', name: '6-Month Seasonal Nurture', type: 'email', content: 'Hi {{name}}, the seasons are changing! It’s a great time for a quick maintenance check on your property at {{address}}.' }
          ]);
        }
        const [inspectionsRes, leadsRes, profilesRes, templatesRes, touchpointsRes, notesRes, commsRes] = await Promise.all([
          supabase.from('inspections').select('*').order('created_at', { ascending: false }),
          supabase.from('d2d_leads').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: true }),
          supabase.from('inspection_templates').select('*').order('order_index', { ascending: true }),
          supabase.from('client_touchpoints').select('*').order('scheduled_for', { ascending: true }),
          supabase.from('client_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('communication_logs').select('*').order('created_at', { ascending: false })
        ]);
        
        if (inspectionsRes.error) throw inspectionsRes.error;
        if (leadsRes.error) throw leadsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        setInspections(inspectionsRes.data || []);
        setLeads(leadsRes.data || []);
        setProfiles(profilesRes.data || []);
        setCompanySettings(settingsRes.data || { company_name: 'Wayside Services' });
        setTemplates(templatesRes.data || []);
        setTouchpoints(touchpointsRes.data || []);
        setClientNotes(notesRes.data || []);
        setCommunicationLogs(commsRes.data || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // -- REALTIME LIVE DASHBOARD SYNC --
    const channel = supabase.channel('admin_live_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'd2d_leads' }, (payload) => {
        setLeads(prev => [payload.new as any, ...prev]);
        toast.success(`New door logged by ${payload.new.rep_name}!`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'd2d_leads' }, (payload) => {
        setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as any : l));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inspections' }, (payload) => {
        setInspections(prev => [payload.new as any, ...prev]);
        toast.success(`New inspection completed for ${payload.new.client_name}!`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inspections' }, (payload) => {
        setInspections(prev => prev.map(i => i.id === payload.new.id ? payload.new as any : i));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_touchpoints' }, () => {
        supabase.from('client_touchpoints').select('*').order('scheduled_for', { ascending: true }).then(res => {
          if (res.data) setTouchpoints(res.data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_notes' }, () => {
        supabase.from('client_notes').select('*').order('created_at', { ascending: false }).then(res => {
          if (res.data) setClientNotes(res.data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_logs' }, () => {
        supabase.from('communication_logs').select('*').order('created_at', { ascending: false }).then(res => {
          if (res.data) setCommunicationLogs(res.data);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminName]);



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
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-amber-porch" /> Overview
          </h3>
        </div>
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

  const filteredInspections = inspections.filter(i => 
    (i.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.property_address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportInspectionsCSV = () => {
    const headers = ['ID', 'Date', 'Client', 'Email', 'Phone', 'Address', 'Duration (s)', 'Technician ID', 'PDF URL'];
    const csvContent = [
      headers.join(','),
      ...inspections.map(i => [
        i.id, new Date(i.created_at).toISOString(), `"${i.client_name}"`, i.client_email || '', i.client_phone || '', 
        `"${i.property_address}"`, i.duration_seconds || '', i.technician_id, i.pdf_url || ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wayside_inspections_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const deleteInspection = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this inspection?')) return;
    const { error } = await supabase.from('inspections').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Inspection deleted');
      setInspections(prev => prev.filter(i => i.id !== id));
    }
  };

  const renderInspections = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-pathway-green" /> Inspections
        </h3>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40" />
            <Input 
              placeholder="Search inspections..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-linen-white/50 border-deep-forest/10 rounded-lg text-sm"
            />
          </div>
          <Button onClick={exportInspectionsCSV} variant="outline" className="border-deep-forest/20 text-deep-forest gap-2 rounded-xl">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {filteredInspections.length === 0 ? (
          <div className="p-8 text-center text-deep-forest/50">No inspections found.</div>
        ) : (
          filteredInspections.map(insp => (
            <div key={insp.id} className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-deep-forest text-lg">{insp.client_name}</p>
                <p className="text-sm text-deep-forest/60">{insp.property_address}</p>
                <p className="text-xs font-bold text-deep-forest/40 uppercase tracking-wide mt-1">
                  {new Date(insp.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pathway-green/10 text-pathway-green text-xs font-bold uppercase tracking-wide">
                  Completed
                </span>
                <Button variant="ghost" onClick={() => setSelectedInspection(insp)} className="text-xs font-bold text-deep-forest hover:bg-deep-forest/5 h-8">
                  View Details
                </Button>
                <button onClick={() => deleteInspection(insp.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-deep-forest/20 hover:text-red-500 flex items-center justify-center transition-colors" title="Delete">
                  <X className="w-4 h-4" />
                </button>
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

      {/* ── Lead Detail Modal ── */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-deep-forest/80 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-2xl bg-linen-white rounded-[2rem] shadow-2xl flex flex-col max-h-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            
            <div className="flex items-center justify-between p-6 border-b border-deep-forest/10 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-porch/20 flex items-center justify-center text-amber-porch">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-deep-forest leading-none">Lead Details</h2>
                  <p className="text-xs font-bold text-deep-forest/40 uppercase tracking-wider mt-1">Logged by {selectedLead.rep_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-10 h-10 rounded-full bg-deep-forest/5 text-deep-forest/50 hover:text-deep-forest hover:bg-deep-forest/10 flex items-center justify-center transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Contact</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">{selectedLead.contact_name || 'N/A'}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5 col-span-2 md:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Address</span>
                  <p className="font-bold text-deep-forest text-sm mt-1 truncate" title={selectedLead.address}>{selectedLead.address}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Status</span>
                  <p className="font-bold text-deep-forest text-sm mt-1 capitalize">{selectedLead.status ? selectedLead.status.replace('_', ' ') : 'Unknown'}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Date</span>
                  <p className="font-bold text-deep-forest text-sm mt-1">{new Date(selectedLead.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedLead.notes && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-2 block">Rep Notes</span>
                  <p className="text-sm font-medium text-deep-forest/80 leading-relaxed">{selectedLead.notes}</p>
                </div>
              )}

              {(selectedLead.lat && selectedLead.lng) && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-2 block">Coordinates</span>
                  <p className="text-sm font-medium text-deep-forest/80">Lat: {selectedLead.lat}, Lng: {selectedLead.lng}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const filteredLeads = leads.filter(l => 
    (l.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.rep_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportLeadsCSV = () => {
    const headers = ['ID', 'Date', 'Contact', 'Address', 'Status', 'Rep Name', 'Assigned Tech ID'];
    const csvContent = [
      headers.join(','),
      ...leads.map(l => [
        l.id, new Date(l.created_at).toISOString(), `"${l.contact_name}"`, `"${l.address}"`, l.status, `"${l.rep_name}"`, l.assigned_tech_id || ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wayside_leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this lead?')) return;
    const { error } = await supabase.from('d2d_leads').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Lead deleted');
      setLeads(prev => prev.filter(l => l.id !== id));
    }
  };

  const renderClientProfile = (c: any) => {
    // Collect all timeline events for this client
    const events: any[] = [];
    c.leads.forEach((l: any) => events.push({ date: new Date(l.created_at), type: 'd2d', title: 'Door Knocked', desc: `Status: ${l.status.replace('_', ' ')}`, icon: MapPin }));
    c.inspections.forEach((i: any) => events.push({ date: new Date(i.created_at), type: 'inspection', title: 'Inspection Completed', desc: `Technician: ${profiles.find(p => p.id === i.technician_id)?.full_name || 'Unknown'}`, icon: ClipboardList }));
    c.touchpoints.forEach((t: any) => events.push({ date: new Date(t.created_at), type: 'touchpoint', title: `CRM: ${t.campaign_type ? t.campaign_type.replace(/_/g, ' ') : 'Nurture'}`, desc: `Status: ${t.status}`, icon: Inbox }));
    
    // Notes and Comms (assuming c.notes and c.comms are hydrated from state in the parent render)
    const clientNotesList = clientNotes.filter(n => n.property_address === c.address);
    clientNotesList.forEach(n => events.push({ date: new Date(n.created_at), type: 'note', title: `Note from ${n.author_name}`, desc: n.content, icon: FileText }));
    
    const clientComms = communicationLogs.filter(cl => cl.property_address === c.address);
    clientComms.forEach(cl => events.push({ date: new Date(cl.created_at), type: 'comm', title: `${cl.direction === 'outbound' ? 'Sent' : 'Received'} ${cl.type.toUpperCase()}`, desc: cl.content, icon: Send }));

    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b border-deep-forest/10 flex items-center gap-4 bg-deep-forest text-white">
          <button onClick={() => setSelectedClient(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-2xl font-bold">{c.name}</h3>
            <p className="text-white/60">{c.address}</p>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Info & Notes */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-linen-white/30 p-4 rounded-xl border border-deep-forest/10">
              <h4 className="font-bold text-deep-forest mb-3">Contact Information</h4>
              <p className="text-sm text-deep-forest/70 mb-1"><strong className="text-deep-forest">Phone:</strong> {c.phone || 'N/A'}</p>
              <p className="text-sm text-deep-forest/70"><strong className="text-deep-forest">Email:</strong> {c.email || 'N/A'}</p>
            </div>

            <div className="bg-linen-white/30 p-4 rounded-xl border border-deep-forest/10">
              <h4 className="font-bold text-deep-forest mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-amber-porch" /> Add Note</h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('note') as HTMLTextAreaElement;
                if (!input.value.trim()) return;
                const { error } = await supabase.from('client_notes').insert([{ property_address: c.address, content: input.value, author_name: adminName }]);
                if (!error) { toast.success('Note added'); input.value = ''; }
                else toast.error('Failed to add note');
              }}>
                <textarea name="note" className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white resize-none focus:outline-none mb-2" rows={3} placeholder="Type a note here..." required></textarea>
                <Button type="submit" className="w-full bg-pathway-green text-white hover:brightness-110 font-bold h-9">Save Note</Button>
              </form>
            </div>
          </div>

          {/* Right Column: Activity Timeline */}
          <div className="lg:col-span-2">
            <h4 className="font-bold text-deep-forest mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-porch" /> Activity Timeline</h4>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-deep-forest/10 before:to-transparent">
              {events.length === 0 ? <p className="text-sm text-deep-forest/50">No activity logged.</p> : events.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-linen-white text-deep-forest shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-deep-forest/10 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-deep-forest">{ev.title}</span>
                        <span className="text-[10px] uppercase font-bold text-deep-forest/40">{ev.date.toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-deep-forest/70">{ev.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClients = () => {
    const clientMap: Record<string, {
      name: string;
      address: string;
      phone: string;
      email: string;
      inspections: any[];
      leads: any[];
      touchpoints: any[];
    }> = {};

    leads.forEach(l => {
      if (!l.address) return;
      if (!clientMap[l.address]) clientMap[l.address] = { name: l.contact_name || 'Resident', address: l.address, phone: '', email: '', inspections: [], leads: [], touchpoints: [] };
      clientMap[l.address].leads.push(l);
    });

    inspections.forEach(i => {
      if (!i.property_address) return;
      if (!clientMap[i.property_address]) clientMap[i.property_address] = { name: i.client_name, address: i.property_address, phone: i.client_phone || '', email: i.client_email || '', inspections: [], leads: [], touchpoints: [] };
      clientMap[i.property_address].inspections.push(i);
      if (i.client_name && clientMap[i.property_address].name === 'Resident') {
        clientMap[i.property_address].name = i.client_name;
      }
      if (i.client_phone) clientMap[i.property_address].phone = i.client_phone;
      if (i.client_email) clientMap[i.property_address].email = i.client_email;
    });

    touchpoints.forEach(t => {
      if (!t.property_address) return;
      if (clientMap[t.property_address]) {
        clientMap[t.property_address].touchpoints.push(t);
      }
    });

    const clientsList = Object.values(clientMap)
      .sort((a,b) => a.name.localeCompare(b.name))
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.address.toLowerCase().includes(searchQuery.toLowerCase()));

    if (selectedClient) {
      // Re-find the latest state of the client so notes live-update
      const currentClientState = clientsList.find(c => c.address === selectedClient.address) || selectedClient;
      return renderClientProfile(currentClientState);
    }

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-porch" /> Clients
            </h3>
            <span className="bg-deep-forest/5 text-deep-forest px-3 py-1 rounded-full text-xs font-bold uppercase">{clientsList.length} Total</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40" />
            <Input 
              placeholder="Search clients..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-linen-white/50 border-deep-forest/10 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="divide-y divide-deep-forest/5">
          {clientsList.length === 0 ? (
            <div className="p-8 text-center text-deep-forest/50">No clients found.</div>
          ) : (
            clientsList.map((c, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedClient(c)}
                className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex-1">
                  <p className="font-bold text-deep-forest text-lg">{c.name}</p>
                  <p className="text-sm text-deep-forest/60">{c.address}</p>
                  {(c.phone || c.email) && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-deep-forest/50 font-medium">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col gap-1 items-end text-xs font-bold uppercase tracking-wide">
                    {c.inspections.length > 0 && <span className="text-pathway-green">{c.inspections.length} Inspections</span>}
                    {c.leads.length > 0 && <span className="text-amber-porch">{c.leads.length} Door Hits</span>}
                    {c.touchpoints.length > 0 && <span className="text-deep-forest/40">{c.touchpoints.length} Touchpoints</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderPipeline = () => {
    const columns = [
      { id: 'new', label: 'New Leads', color: 'bg-deep-forest/5', border: 'border-deep-forest/10' },
      { id: 'not_home', label: 'Not Home', color: 'bg-amber-porch/5', border: 'border-amber-porch/20' },
      { id: 'not_interested', label: 'Not Interested', color: 'bg-red-50', border: 'border-red-200' },
      { id: 'interested', label: 'Interested', color: 'bg-blue-50', border: 'border-blue-200' },
      { id: 'scheduled', label: 'Scheduled', color: 'bg-pathway-green/10', border: 'border-pathway-green/20' }
    ];

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      const leadId = e.dataTransfer.getData('lead_id');
      if (!leadId) return;

      // Optimistic update
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      
      const { error } = await supabase.from('d2d_leads').update({ status: newStatus }).eq('id', leadId);
      if (error) {
        toast.error('Failed to update status');
      } else {
        toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
      }
    };

    return (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
            <Kanban className="w-5 h-5 text-amber-porch" /> Pipeline
          </h3>
        </div>
        
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-stretch min-h-[600px]">
          {columns.map(col => {
            const colLeads = leads.filter(l => l.status === col.id);
            return (
              <div 
                key={col.id} 
                className={`w-80 shrink-0 flex flex-col rounded-2xl border ${col.border} ${col.color}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className="p-4 border-b border-black/5 shrink-0 flex justify-between items-center pointer-events-none">
                  <h4 className="font-bold text-sm text-deep-forest uppercase tracking-wider">{col.label}</h4>
                  <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold text-deep-forest/50">{colLeads.length}</span>
                </div>
                <div 
                  className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto min-h-0 transition-all"
                  onDragEnter={e => {
                    e.preventDefault();
                    e.currentTarget.classList.add('bg-white/50', 'ring-2', 'ring-amber-porch', 'ring-inset', 'rounded-xl');
                  }}
                  onDragLeave={e => {
                    e.currentTarget.classList.remove('bg-white/50', 'ring-2', 'ring-amber-porch', 'ring-inset', 'rounded-xl');
                  }}
                  onDrop={e => {
                    e.currentTarget.classList.remove('bg-white/50', 'ring-2', 'ring-amber-porch', 'ring-inset', 'rounded-xl');
                    handleDrop(e, col.id);
                  }}
                  onDragOver={e => e.preventDefault()}
                >
                  {colLeads.map(l => (
                    <div 
                      key={l.id} 
                      draggable 
                      onDragStart={e => {
                        e.dataTransfer.setData('lead_id', l.id);
                        e.currentTarget.style.opacity = '0.4';
                      }}
                      onDragEnd={e => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      className="bg-white p-4 rounded-xl shadow-sm border border-deep-forest/5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                    >
                      <p className="font-bold text-sm text-deep-forest">{l.contact_name || 'Resident'}</p>
                      <p className="text-xs text-deep-forest/60 mt-1 truncate">{l.address}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] uppercase font-bold text-deep-forest/40">{new Date(l.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] font-bold text-amber-porch bg-amber-porch/10 px-2 py-0.5 rounded">{l.rep_name}</p>
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-black/5 rounded-xl text-deep-forest/30 text-xs font-bold uppercase tracking-wider">
                      Drop Here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLeads = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-porch" /> Leads
        </h3>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40" />
            <Input 
              placeholder="Search leads..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-linen-white/50 border-deep-forest/10 rounded-lg text-sm"
            />
          </div>
          <Button onClick={exportLeadsCSV} variant="outline" className="border-deep-forest/20 text-deep-forest gap-2 rounded-xl">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-deep-forest/50">No leads found.</div>
        ) : (
          filteredLeads.map(lead => (
            <div key={lead.id} className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-deep-forest text-lg">{lead.contact_name || 'No Contact Name'}</p>
                <p className="text-sm text-deep-forest/60">{lead.address}</p>
                <p className="text-xs text-deep-forest/40 mt-1">Logged by {lead.rep_name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right flex flex-col items-end gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-forest/10 text-deep-forest text-xs font-bold uppercase tracking-wide">
                    {lead.status ? lead.status.replace('_', ' ') : 'Unknown'}
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
                <Button variant="ghost" onClick={() => setSelectedLead(lead)} className="text-xs font-bold text-deep-forest hover:bg-deep-forest/5 h-8">
                  View Details
                </Button>
                <button onClick={() => deleteLead(lead.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-deep-forest/20 hover:text-red-500 flex items-center justify-center transition-colors" title="Delete">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => {
    // Leads by Day (Last 7 Days)
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    
    const chartData = last7Days.map(date => ({
      date: date.substring(5), // MM-DD
      leads: leads.filter(l => l.created_at.startsWith(date)).length,
      inspections: inspections.filter(ins => ins.created_at.startsWith(date)).length
    }));

    const techStats = profiles.filter(p => p.role === 'technician').map(tech => {
      const techInspections = inspections.filter(i => i.technician_id === tech.id);
      const avgDuration = techInspections.length ? techInspections.reduce((acc, i) => acc + (i.duration_seconds || 0), 0) / techInspections.length : 0;
      return { name: tech.full_name, total: techInspections.length, avgDuration: Math.round(avgDuration / 60) };
    }).sort((a, b) => b.total - a.total);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-porch" /> Analytics
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5">
            <h3 className="font-bold text-deep-forest mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-amber-porch" /> 7-Day Performance</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="#102e2150" fontSize={12} />
                  <YAxis stroke="#102e2150" fontSize={12} allowDecimals={false} />
                  <RechartsTooltip cursor={{fill: '#f5efe6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="leads" name="New Leads" fill="#1D9E75" radius={[4,4,0,0]} />
                  <Bar dataKey="inspections" name="Completed Inspections" fill="#f0a500" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5">
            <h3 className="font-bold text-deep-forest mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-amber-porch" /> Technician Leaderboard</h3>
            <div className="space-y-4">
              {techStats.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-deep-forest/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-amber-porch text-lg w-6">{idx + 1}</span>
                    <span className="font-bold text-deep-forest">{t.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-pathway-green">{t.total} Inspections</p>
                    <p className="text-xs text-deep-forest/60">Avg. {t.avgDuration} mins</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDispatch = () => {
    const scheduledLeads = leads.filter(l => l.status === 'scheduled');
    
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2 mb-6">
          <CalendarIcon className="w-5 h-5 text-amber-porch" /> Dispatch
        </h3>
        <div className="space-y-4">
          {scheduledLeads.length === 0 ? <p className="text-deep-forest/50">No scheduled leads.</p> : scheduledLeads.map(lead => (
            <div key={lead.id} className="border border-deep-forest/10 rounded-xl p-4 flex flex-col xl:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <p className="font-bold text-deep-forest">{lead.contact_name || 'No Name'} <span className="text-xs font-normal text-deep-forest/50 ml-2">Logged by {lead.rep_name}</span></p>
                <p className="text-sm text-deep-forest/70 truncate" title={lead.address}>{lead.address}</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 items-center shrink-0">
                <select
                  className="text-sm p-2 border border-deep-forest/20 rounded-md bg-white focus:outline-none w-40"
                  value={lead.assigned_tech_id || ''}
                  onChange={async (e) => {
                    const techId = e.target.value;
                    const { error } = await supabase.from('d2d_leads').update({ assigned_tech_id: techId }).eq('id', lead.id);
                    if (!error) setLeads(leads.map(l => l.id === lead.id ? { ...l, assigned_tech_id: techId } : l));
                  }}
                >
                  <option value="" disabled>Assign Tech...</option>
                  {profiles.filter(p => p.role === 'technician').map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                  ))}
                </select>
                <Input type="datetime-local" className="w-48 text-sm" value={lead.scheduled_start ? lead.scheduled_start.substring(0,16) : ''} onChange={async (e) => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  const { error } = await supabase.from('d2d_leads').update({ scheduled_start: val }).eq('id', lead.id);
                  if (!error) setLeads(leads.map(l => l.id === lead.id ? { ...l, scheduled_start: val } : l));
                }} />
                <span className="text-deep-forest/30 hidden md:block">to</span>
                <Input type="datetime-local" className="w-48 text-sm" value={lead.scheduled_end ? lead.scheduled_end.substring(0,16) : ''} onChange={async (e) => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  const { error } = await supabase.from('d2d_leads').update({ scheduled_end: val }).eq('id', lead.id);
                  if (!error) setLeads(leads.map(l => l.id === lead.id ? { ...l, scheduled_end: val } : l));
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActionCenter = () => {
    const pendingTouchpoints = touchpoints.filter(t => t.status === 'pending');
    
    const pendingLeads = leads.filter(l => l.status === 'not_home' && l.follow_up_status === 'pending');
    const pendingInspections = inspections.filter(i => i.follow_up_status === 'pending');

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <Inbox className="w-5 h-5 text-amber-porch" /> Action Center
            </h3>
          </div>
          
          <div className="space-y-8">
            {/* AI Nurturing Engine Queue */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-deep-forest">Scheduled Cadence Touchpoints</h4>
                <Button onClick={async () => {
                  for (const t of pendingTouchpoints) {
                    await supabase.from('client_touchpoints').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', t.id);
                  }
                  toast.success(`Executed ${pendingTouchpoints.length} Nurture Actions!`);
                  setTouchpoints(touchpoints.map(t => pendingTouchpoints.find(p => p.id === t.id) ? { ...t, status: 'sent', sent_at: new Date().toISOString() } : t));
                }} disabled={pendingTouchpoints.length === 0} className="bg-amber-porch text-white hover:brightness-110 gap-2">
                  <Send className="w-4 h-4" /> Execute All Touchpoints
                </Button>
              </div>
              {pendingTouchpoints.length === 0 ? <p className="text-sm text-deep-forest/50">Inbox zero! No upcoming cadences.</p> : (
                <div className="grid gap-3">
                  {pendingTouchpoints.map(t => {
                    const isOverdue = new Date(t.scheduled_for) <= new Date();
                    return (
                      <div key={t.id} className="p-4 border border-deep-forest/10 rounded-xl flex justify-between items-center bg-linen-white/30">
                        <div>
                          <p className="font-bold text-sm text-deep-forest">{t.client_name} - <span className="capitalize">{t.campaign_type ? t.campaign_type.replace(/_/g, ' ') : 'Nurture'}</span></p>
                          <p className="text-xs text-deep-forest/60">{t.property_address}</p>
                          <p className={`text-xs mt-1 font-bold ${isOverdue ? 'text-red-500' : 'text-deep-forest/40'}`}>
                            {isOverdue ? 'Overdue: ' : 'Scheduled for: '} {new Date(t.scheduled_for).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-amber-porch/10 text-amber-porch'}`}>
                            {isOverdue ? 'Requires Action' : 'Pending'}
                          </span>
                          <button 
                            onClick={async () => {
                              await supabase.from('client_touchpoints').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', t.id);
                              toast.success('Touchpoint executed');
                              setTouchpoints(touchpoints.map(tp => tp.id === t.id ? { ...tp, status: 'sent', sent_at: new Date().toISOString() } : tp));
                            }}
                            className="w-8 h-8 rounded bg-pathway-green text-white hover:brightness-110 flex items-center justify-center transition-all"
                            title="Execute Touchpoint"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Follow up leads */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-deep-forest">"Not Home" Leads to Follow Up</h4>
                <Button onClick={async () => {
                  for (const l of pendingLeads) await supabase.from('d2d_leads').update({ follow_up_status: 'sent' }).eq('id', l.id);
                  toast.success(`Sent ${pendingLeads.length} SMS messages!`);
                  setLeads(leads.map(l => pendingLeads.find(p => p.id === l.id) ? { ...l, follow_up_status: 'sent' } : l));
                }} disabled={pendingLeads.length === 0} className="bg-pathway-green text-white hover:brightness-110 gap-2">
                  <Send className="w-4 h-4" /> Send All SMS
                </Button>
              </div>
              {pendingLeads.length === 0 ? <p className="text-sm text-deep-forest/50">Inbox zero! No pending follow ups.</p> : (
                <div className="grid gap-3">
                  {pendingLeads.map(l => (
                    <div key={l.id} className="p-3 border border-deep-forest/10 rounded-lg flex justify-between items-center bg-linen-white/30">
                      <div>
                        <p className="font-bold text-sm text-deep-forest">{l.contact_name || 'Resident'} - {l.address}</p>
                        <p className="text-xs text-deep-forest/60">Logged {new Date(l.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-porch bg-amber-porch/10 px-2 py-1 rounded">Pending SMS</span>
                        <button 
                          onClick={async () => {
                            await supabase.from('d2d_leads').update({ follow_up_status: 'sent' }).eq('id', l.id);
                            toast.success('SMS Sent');
                            setLeads(leads.map(lead => lead.id === l.id ? { ...lead, follow_up_status: 'sent' } : lead));
                          }}
                          className="w-8 h-8 rounded bg-pathway-green text-white hover:brightness-110 flex items-center justify-center transition-all"
                          title="Send SMS"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow up reviews */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-deep-forest">Completed Inspections (Ask for Review)</h4>
                <Button onClick={async () => {
                  for (const i of pendingInspections) await supabase.from('inspections').update({ follow_up_status: 'sent' }).eq('id', i.id);
                  toast.success(`Sent ${pendingInspections.length} Review Request Emails!`);
                  setInspections(inspections.map(ins => pendingInspections.find(p => p.id === ins.id) ? { ...ins, follow_up_status: 'sent' } : ins));
                }} disabled={pendingInspections.length === 0} className="bg-pathway-green text-white hover:brightness-110 gap-2">
                  <Send className="w-4 h-4" /> Send All Emails
                </Button>
              </div>
              {pendingInspections.length === 0 ? <p className="text-sm text-deep-forest/50">Inbox zero! No pending review requests.</p> : (
                <div className="grid gap-3">
                  {pendingInspections.map(i => (
                    <div key={i.id} className="p-3 border border-deep-forest/10 rounded-lg flex justify-between items-center bg-linen-white/30">
                      <div>
                        <p className="font-bold text-sm text-deep-forest">{i.client_name}</p>
                        <p className="text-xs text-deep-forest/60">{i.client_email || 'No email provided'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-porch bg-amber-porch/10 px-2 py-1 rounded">Pending Email</span>
                        <button 
                          onClick={async () => {
                            await supabase.from('inspections').update({ follow_up_status: 'sent' }).eq('id', i.id);
                            toast.success('Email Sent');
                            setInspections(inspections.map(ins => ins.id === i.id ? { ...ins, follow_up_status: 'sent' } : ins));
                          }}
                          className="w-8 h-8 rounded bg-pathway-green text-white hover:brightness-110 flex items-center justify-center transition-all"
                          title="Send Email"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTeam = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <Users className="w-5 h-5 text-deep-forest" /> Team
        </h3>
      </div>
      <div className="divide-y divide-deep-forest/5">
        {profiles.map(profile => (
          <div key={profile.id} className={`p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${profile.is_active === false ? 'opacity-50 grayscale' : ''}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-deep-forest text-lg">{profile.full_name}</p>
                {profile.is_active === false && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider">Deactivated</span>
                )}
              </div>
              <p className="text-xs font-bold text-deep-forest/40 uppercase tracking-wide mt-1">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="text-sm p-2 border border-deep-forest/20 rounded-lg bg-white font-bold text-deep-forest focus:outline-none disabled:opacity-50"
                value={profile.role}
                disabled={profile.is_active === false}
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
              
              <Button 
                variant={profile.is_active === false ? "outline" : "ghost"}
                className={`text-sm font-bold ${profile.is_active === false ? 'text-pathway-green border-pathway-green' : 'text-red-500 hover:bg-red-50'}`}
                onClick={async () => {
                  const newStatus = profile.is_active === false ? true : false;
                  if (!newStatus && !confirm(`Are you sure you want to lock out ${profile.full_name}? They will instantly lose access.`)) return;
                  
                  const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', profile.id);
                  if (error) toast.error('Failed to update status');
                  else {
                    toast.success(newStatus ? 'Account Reactivated' : 'Account Deactivated');
                    setProfiles(profiles.map(p => p.id === profile.id ? { ...p, is_active: newStatus } : p));
                  }
                }}
              >
                {profile.is_active === false ? 'Reactivate' : 'Deactivate'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-porch" /> Settings
        </h3>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6">
        <h3 className="text-xl font-bold text-deep-forest mb-1">Omnichannel Message Templates</h3>
        <p className="text-sm text-deep-forest/60 mb-6">Manage the default SMS and Email templates used by the CRM Action Center.</p>
        
        <div className="grid gap-4 max-w-3xl">
          {messageTemplates.map(tpl => (
            <div key={tpl.id} className="border border-deep-forest/10 rounded-xl p-4 bg-linen-white/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-deep-forest">{tpl.name}</h4>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${tpl.type === 'sms' ? 'bg-amber-porch/10 text-amber-porch' : 'bg-pathway-green/10 text-pathway-green'}`}>
                  {tpl.type}
                </span>
              </div>
              <textarea 
                className="w-full text-sm p-3 border border-deep-forest/10 rounded-lg bg-white shadow-inner focus:outline-none focus:ring-1 focus:ring-pathway-green h-24"
                value={tpl.content}
                onChange={e => {
                  const newTpls = messageTemplates.map(t => t.id === tpl.id ? { ...t, content: e.target.value } : t);
                  setMessageTemplates(newTpls);
                  localStorage.setItem('wayside_message_templates', JSON.stringify(newTpls));
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6">
        <h3 className="text-xl font-bold text-deep-forest mb-1">Dynamic Checklists</h3>
        <p className="text-sm text-deep-forest/60 mb-6">Create and modify the required inspection questions. The Technician App will automatically download these live.</p>
        
        <div className="flex flex-col gap-3 max-w-2xl">
          {templates.map((tpl, idx) => (
            <div key={tpl.id} className="flex items-center gap-3 bg-linen-white/50 p-3 rounded-xl border border-deep-forest/10">
              <span className="w-6 h-6 flex items-center justify-center bg-deep-forest/5 rounded-md text-xs font-bold text-deep-forest/50">{idx + 1}</span>
              <Input 
                value={tpl.question_text}
                onChange={e => {
                  const newTpl = [...templates];
                  newTpl[idx].question_text = e.target.value;
                  setTemplates(newTpl);
                }}
                className="flex-1 border-none bg-white shadow-sm font-bold text-deep-forest"
              />
              <button 
                onClick={async () => {
                  if (confirm('Delete this question?')) {
                    await supabase.from('inspection_templates').delete().eq('id', tpl.id);
                    setTemplates(templates.filter(t => t.id !== tpl.id));
                    toast.success('Question deleted');
                  }
                }}
                className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          <Button 
            variant="outline"
            className="border-dashed border-2 border-deep-forest/20 text-deep-forest/60 hover:text-deep-forest hover:border-deep-forest/40 h-12 rounded-xl mt-2"
            onClick={async () => {
              const text = prompt('Enter new question:');
              if (text) {
                const { data, error } = await supabase.from('inspection_templates').insert([{
                  order_index: templates.length,
                  question_text: text
                }]).select().single();
                if (!error && data) {
                  setTemplates([...templates, data]);
                  toast.success('Question added!');
                }
              }
            }}
          >
            + Add New Question
          </Button>

          <Button 
            className="w-full bg-deep-forest text-white font-bold mt-4 shadow-lg h-12"
            onClick={async () => {
              // Update all template texts in DB
              for (const t of templates) {
                await supabase.from('inspection_templates').update({ question_text: t.question_text }).eq('id', t.id);
              }
              toast.success('All templates saved successfully!');
            }}
          >
            Save All Template Changes
          </Button>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'pipeline' as AdminTab, label: 'Pipeline', icon: Kanban },
    { id: 'clients' as AdminTab, label: 'Clients', icon: Users },
    { id: 'analytics' as AdminTab, label: 'Analytics', icon: BarChart3 },
    { id: 'dispatch' as AdminTab, label: 'Dispatch', icon: CalendarIcon },
    { id: 'action_center' as AdminTab, label: 'Action Center', icon: Inbox },
    { id: 'inspections' as AdminTab, label: 'Inspections', icon: ClipboardList },
    { id: 'leads' as AdminTab, label: 'Leads', icon: MapPin },
    { id: 'team' as AdminTab, label: 'Team', icon: Users },
    { id: 'settings' as AdminTab, label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest font-sans flex flex-col md:flex-row w-full overflow-hidden">
      <Toaster position="top-center" richColors />
      
      {/* ── Mobile Drawer Overlay ── */}
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
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10 shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Signed in as</span>
                <span className="text-base font-bold text-amber-porch">Admin</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
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
                  {id === 'action_center' && touchpoints.filter(t => t.status === 'pending').length > 0 && (
                    <span className="ml-auto bg-amber-porch text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {touchpoints.filter(t => t.status === 'pending').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="px-5 pb-8 pt-2 border-t border-white/10 shrink-0">
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

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-deep-forest text-linen-white shrink-0 sticky top-0 h-screen">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" className="w-8 h-8 shrink-0 drop-shadow-[0_0_10px_rgba(29,158,117,0.3)]" fill="none">
              <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
              <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
              <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
              <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xl font-bold tracking-tight text-white">Wayside <span className="text-amber-porch">Admin</span></span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
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
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white/40'}`} />
                {tab.label}
                {tab.id === 'action_center' && touchpoints.filter(t => t.status === 'pending').length > 0 && (
                  <span className="ml-auto bg-amber-porch text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {touchpoints.filter(t => t.status === 'pending').length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="p-5 border-t border-white/10 shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden h-20 bg-deep-forest text-linen-white flex items-center px-4 shadow-md sticky top-0 z-10 w-full shrink-0">
        <div className="w-full flex items-center justify-between">
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
              <span className="font-bold text-[9px] text-amber-porch tracking-[0.25em] uppercase">Admin Hub</span>
            </div>
          </div>
          
          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-deep-forest tracking-tight">
            {tabs.find(t => t.id === activeTab)?.label || 'Overview'}
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
            {activeTab === 'pipeline' && renderPipeline()}
            {activeTab === 'clients' && renderClients()}
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'dispatch' && renderDispatch()}
            {activeTab === 'action_center' && renderActionCenter()}
            {activeTab === 'inspections' && renderInspections()}
            {activeTab === 'leads' && renderLeads()}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
      </main>
    </div>
  );
}
