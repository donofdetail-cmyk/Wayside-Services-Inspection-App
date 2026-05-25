import React, { useState, useEffect } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { TerritoryZone, Customer, Property, ServiceAgreement, ServiceTicket } from '../types';
import { Menu, LayoutDashboard, Users, ClipboardList, LogOut, Loader2, MapPin, Search, FileText, Download, X, Calendar as CalendarIcon, BarChart3, Inbox, Clock, Send, Settings, Mail, ChevronDown, ChevronLeft, ChevronRight, Map } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Logo } from '../components/Logo';
import { DispatchMap } from './components/DispatchMap';

type AdminTab = 'dashboard' | 'clients' | 'scheduling' | 'action_center' | 'inspections' | 'leads' | 'territories' | 'team' | 'settings';
import { TimesheetDashboard } from './components/TimesheetDashboard';
export default function AdminApp({ session, profile }: { session: any, profile: any }) {
  const [adminName, setAdminName] = useState<string | null>(profile?.full_name || null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [clientNotes, setClientNotes] = useState<any[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<any[]>([]);
  const [leadView, setLeadView] = useState<'list' | 'board'>('list');
  
  const [inspections, setInspections] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [inspectionSearch, setInspectionSearch] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);
  const [scheduleModal, setScheduleModal] = useState<any | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ start: '', end: '', techId: '', zoneId: '', price: '', frequency: 'bi-monthly' });
  const [messageTemplates, setMessageTemplates] = useState<{id: string, name: string, type: 'sms'|'email', content: string}[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Phase 12: Route Optimization State
  const [territoryZones, setTerritoryZones] = useState<TerritoryZone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [serviceAgreements, setServiceAgreements] = useState<ServiceAgreement[]>([]);
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', color: '#1D3B34' });
  const [selectedZone, setSelectedZone] = useState<TerritoryZone | null>(null);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<{id?: string, full_name: string, email: string, phone: string}>({ full_name: '', email: '', phone: '' });

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
        const [inspectionsRes, leadsRes, profilesRes, templatesRes, touchpointsRes, notesRes, commsRes, zonesRes, ticketsRes, agreementsRes, propertiesRes, customersRes] = await Promise.all([
          supabase.from('inspections').select('*').order('created_at', { ascending: false }),
          supabase.from('d2d_leads').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: true }),
          supabase.from('inspection_templates').select('*').order('order_index', { ascending: true }),
          supabase.from('client_touchpoints').select('*').order('scheduled_for', { ascending: true }),
          supabase.from('client_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('communication_logs').select('*').order('created_at', { ascending: false }),
          supabase.from('territory_zones').select('*').order('created_at', { ascending: true }),
          supabase.from('service_tickets').select('*').order('created_at', { ascending: false }),
          supabase.from('service_agreements').select('*'),
          supabase.from('properties').select('*'),
          supabase.from('customers').select('*')
        ]);
        
        if (inspectionsRes.error) throw inspectionsRes.error;
        if (leadsRes.error) throw leadsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        setInspections(inspectionsRes.data || []);
        setLeads(leadsRes.data || []);
        setProfiles(profilesRes.data || []);

        setTemplates(templatesRes.data || []);
        setTouchpoints(touchpointsRes.data || []);
        setClientNotes(notesRes.data || []);
        setCommunicationLogs(commsRes.data || []);
        setTerritoryZones(zonesRes.data || []);
        setServiceTickets(ticketsRes.data || []);
        setServiceAgreements(agreementsRes.data || []);
        setProperties(propertiesRes.data || []);
        setCustomers(customersRes.data || []);
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

  // --- Handlers for Territory Zones ---
  const handleCreateZone = async () => {
    if (!zoneForm.name.trim()) return toast.error("Zone name required");
    const { data, error } = await supabase.from('territory_zones').insert([{
      name: zoneForm.name,
      color: zoneForm.color
    }]).select().single();
    
    if (error) {
      toast.error("Failed to create zone");
    } else {
      toast.success("Zone created");
      setTerritoryZones(prev => [...prev, data]);
      setZoneModalOpen(false);
      setZoneForm({ name: '', color: '#1D3B34' });
    }
  };

  const handleToggleZone = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('territory_zones').update({ is_active: !currentStatus }).eq('id', id);
    if (error) toast.error("Failed to update status");
    else setTerritoryZones(prev => prev.map(z => z.id === id ? { ...z, is_active: !currentStatus } : z));
  };


  const handleSaveClient = async () => {
    if (!clientForm.full_name.trim()) return toast.error("Full Name is required");
    
    if (clientForm.id) {
      const { error } = await supabase.from('customers').update({
        full_name: clientForm.full_name,
        email: clientForm.email,
        phone: clientForm.phone
      }).eq('id', clientForm.id);
      
      if (error) toast.error("Failed to update client");
      else {
        toast.success("Client updated!");
        setCustomers(prev => prev.map(c => c.id === clientForm.id ? { ...c, ...clientForm } as any : c));
        setClientModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from('customers').insert([{
        full_name: clientForm.full_name,
        email: clientForm.email,
        phone: clientForm.phone
      }]).select().single();
      
      if (error) toast.error("Failed to create client");
      else {
        toast.success("Client added!");
        setCustomers(prev => [...prev, data]);
        setClientModalOpen(false);
      }
    }
  };

  const handleDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to completely remove this client and all associated data?")) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast.error("Failed to delete client");
    else {
      toast.success("Client deleted");
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    }
  };
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
      .sort((a, b) => (b[1] as any).appointments - (a[1] as any).appointments)
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

        {/* ── Today's Scheduled Jobs Banner ── */}
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const todaysJobs = leads.filter(l => l.status === 'scheduled' && (l.scheduled_start || '').startsWith(todayStr));
          return (
            <div className="bg-deep-forest rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="shrink-0">
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">Today's Jobs</p>
                <p className="text-5xl font-bold leading-none">{todaysJobs.length}</p>
                <p className="text-white/40 text-xs mt-2">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="flex-1 w-full">
                {todaysJobs.length === 0 ? (
                  <p className="text-white/40 text-sm italic">No jobs scheduled for today — all clear!</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                    {todaysJobs.map(j => (
                      <div key={j.id} className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-4 py-2.5 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-pathway-green shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold leading-none truncate">{j.contact_name || 'Resident'}</p>
                          <p className="text-xs text-white/50 truncate mt-0.5">{j.address}</p>
                        </div>
                        <span className="text-xs font-bold text-pathway-green bg-pathway-green/20 px-2 py-0.5 rounded-md shrink-0">
                          {profiles.find(p => p.id === j.assigned_tech_id)?.full_name || 'Unassigned'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 lg:col-span-1">
            <h3 className="text-lg font-bold text-deep-forest mb-4">Top Performing Reps</h3>
            <div className="divide-y divide-deep-forest/5">
              {topReps.map(([name, stats]: [string, any], idx) => (
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
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5 lg:col-span-2">
            <h3 className="text-lg font-bold text-deep-forest mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-amber-porch" /> 7-Day Performance</h3>
            {(() => {
              const last7Days = Array.from({length: 7}).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
              });
              const chartData = last7Days.map(date => ({
                date: date.substring(5),
                leads: leads.filter(l => l.created_at.startsWith(date)).length,
                inspections: inspections.filter(ins => ins.created_at.startsWith(date)).length
              }));
              return (
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
              );
            })()}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-deep-forest/5">
          <h3 className="text-lg font-bold text-deep-forest mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-amber-porch" /> Technician Leaderboard</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const techStats = profiles.filter(p => p.role === 'technician').map(tech => {
                const techInspections = inspections.filter(i => i.technician_id === tech.id);
                const avgDuration = techInspections.length ? techInspections.reduce((acc, i) => acc + (i.duration_seconds || 0), 0) / techInspections.length : 0;
                return { name: tech.full_name, total: techInspections.length, avgDuration: Math.round(avgDuration / 60) };
              }).sort((a, b) => b.total - a.total);
              
              if (techStats.length === 0) return <p className="text-sm text-deep-forest/50 py-2">No technicians found.</p>;
              
              return techStats.map((t, idx) => (
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
              ));
            })()}
          </div>
        </div>
      </div>
    );
  };

  const filteredInspections = inspections.filter(i => 
    (i.client_name || '').toLowerCase().includes(inspectionSearch.toLowerCase()) || 
    (i.property_address || '').toLowerCase().includes(inspectionSearch.toLowerCase())
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
              value={inspectionSearch}
              onChange={e => setInspectionSearch(e.target.value)}
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

    </div>
  );

  const filteredLeads = leads.filter(l => 
    l.status !== 'scheduled' && (
      (l.contact_name || '').toLowerCase().includes(leadSearch.toLowerCase()) || 
      (l.address || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.rep_name || '').toLowerCase().includes(leadSearch.toLowerCase())
    )
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
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b border-deep-forest/10 flex items-center gap-4 bg-deep-forest text-white">
          <button onClick={() => setSelectedClient(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">{c.full_name}</h3>
              <p className="text-white/60 text-sm">Customer since {new Date(c.created_at).getFullYear()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Total Value (ARR)</p>
              <p className="text-2xl font-bold text-pathway-green">${c.totalArr.toLocaleString()}</p>
            </div>
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
                // Hack: store note on their first property for now, since notes currently tie to properties
                const address = c.properties[0]?.address || 'Unknown';
                const { error } = await supabase.from('client_notes').insert([{ property_address: address, content: input.value, author_name: adminName }]);
                if (!error) { toast.success('Note added'); input.value = ''; }
                else toast.error('Failed to add note');
              }}>
                <textarea name="note" className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white resize-none focus:outline-none mb-2" rows={3} placeholder="Type a note here..." required></textarea>
                <Button type="submit" className="w-full bg-pathway-green text-white hover:brightness-110 font-bold h-9">Save Note</Button>
              </form>
            </div>
          </div>

          {/* Right Column: Properties and Agreements */}
          <div className="lg:col-span-2">
            <h4 className="font-bold text-deep-forest mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-porch" /> Properties & Agreements</h4>
            <div className="space-y-4">
              {c.properties.length === 0 ? <p className="text-sm text-deep-forest/50">No properties linked.</p> : c.properties.map((p: any, i: number) => {
                const agreement = c.agreements.find((a: any) => a.property_id === p.id);
                const zone = territoryZones.find(z => z.id === p.territory_zone_id);
                const pTickets = serviceTickets.filter(t => t.agreement_id === agreement?.id);

                return (
                  <div key={i} className="bg-white p-5 rounded-xl border border-deep-forest/10 shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: zone?.color || '#1D3B34' }}></div>
                    <div className="flex items-center justify-between mb-4 pl-3">
                      <div>
                        <span className="font-bold text-lg text-deep-forest block leading-tight">{p.address}</span>
                        <span className="text-xs font-bold text-deep-forest/50 uppercase tracking-wider">{zone?.name || 'Unassigned Zone'}</span>
                      </div>
                      {agreement && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider block">Service Price</span>
                          <span className="font-bold text-deep-forest text-lg">${agreement.recurring_price} <span className="text-xs font-normal text-deep-forest/50 capitalize">/ {agreement.frequency.replace('-', ' ')}</span></span>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t border-deep-forest/5 pt-3 mt-3 pl-3">
                      <p className="text-xs font-bold text-deep-forest mb-2">Recent Service Tickets:</p>
                      {pTickets.length === 0 ? <p className="text-xs text-deep-forest/40 italic">No tickets generated yet.</p> : (
                        <div className="space-y-1">
                          {pTickets.slice(0,3).map((t: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-linen-white/30 p-2 rounded">
                              <span className="capitalize font-medium text-deep-forest">{t.type} Service</span>
                              <span className="font-bold text-deep-forest/60">
                                {t.scheduled_start ? new Date(t.scheduled_start).toLocaleDateString() : 'Unscheduled'}
                                {t.status === 'completed' && <span className="ml-2 text-pathway-green text-[10px] uppercase tracking-wider bg-pathway-green/10 px-1.5 py-0.5 rounded">Completed</span>}
                                {t.status === 'scheduled' && <span className="ml-2 text-amber-porch text-[10px] uppercase tracking-wider bg-amber-porch/10 px-1.5 py-0.5 rounded">Upcoming</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
    // Enrich customers with properties and agreements
    const enrichedCustomers = customers.map(c => {
      // Find properties associated with this customer
      const cProperties = properties.filter(p => p.customer_id === c.id || serviceAgreements.find(a => a.customer_id === c.id && a.property_id === p.id));
      const cAgreements = serviceAgreements.filter(a => a.customer_id === c.id);
      
      const totalArr = cAgreements.reduce((sum: number, a: any) => {
        let multiplier = 0;
        if (a.frequency === 'monthly') multiplier = 12;
        else if (a.frequency === 'bi-monthly') multiplier = 6;
        else if (a.frequency === 'quarterly') multiplier = 4;
        else if (a.frequency === 'annual') multiplier = 1;
        return sum + (a.recurring_price * multiplier);
      }, 0);

      return { ...c, properties: cProperties, agreements: cAgreements, totalArr };
    });

    const clientsList = enrichedCustomers
      .sort((a,b) => b.totalArr - a.totalArr) // Sort by most valuable
      .filter(c => c.full_name.toLowerCase().includes(clientSearch.toLowerCase()));

    if (selectedClient) {
      // Re-find latest state
      const currentClientState = clientsList.find(c => c.id === selectedClient.id) || selectedClient;
      return renderClientProfile(currentClientState);
    }

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-porch" /> Route Customers
            </h3>
            <span className="bg-deep-forest/5 text-deep-forest px-3 py-1 rounded-full text-xs font-bold uppercase">{clientsList.length} Total</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40" />
              <Input 
                placeholder="Search customers..." 
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="pl-9 h-9 bg-linen-white/50 border-deep-forest/10 rounded-lg text-sm"
              />
            </div>
            <Button 
              onClick={() => { setClientForm({ full_name: '', email: '', phone: '' }); setClientModalOpen(true); }}
              className="bg-pathway-green text-white hover:brightness-110 h-9 px-4 shrink-0"
            >
              Add Client
            </Button>
          </div>
        </div>
        <div className="divide-y divide-deep-forest/5">
          {clientsList.length === 0 ? (
            <div className="p-8 text-center text-deep-forest/50">No customers found. Convert leads on the Acquisition board!</div>
          ) : (
            clientsList.map((c, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedClient(c)}
                className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex-1">
                  <p className="font-bold text-deep-forest text-lg">{c.full_name}</p>
                  <p className="text-sm text-deep-forest/60">{c.properties[0]?.address || 'No property linked'}</p>
                </div>
                <div className="flex flex-col sm:items-end shrink-0 gap-1">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider">Properties</span>
                    <span className="font-bold text-deep-forest">{c.properties.length}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider">Account ARR</span>
                    <span className="font-bold text-pathway-green">${c.totalArr.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientForm({ id: c.id, full_name: c.full_name, email: c.email || '', phone: c.phone || '' });
                        setClientModalOpen(true);
                      }}
                      className="h-7 px-2 text-deep-forest/50 hover:text-deep-forest hover:bg-deep-forest/5"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteClient(c.id, e)}
                      className="h-7 px-2 text-red-500/50 hover:text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Client Modal */}
        {clientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-deep-forest/10 flex items-center justify-between">
                <h3 className="font-bold text-deep-forest text-lg">{clientForm.id ? 'Edit Client' : 'Add Client'}</h3>
                <button onClick={() => setClientModalOpen(false)} className="text-deep-forest/40 hover:text-deep-forest">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-deep-forest/50 mb-1 block">Full Name *</label>
                  <Input 
                    value={clientForm.full_name} 
                    onChange={e => setClientForm({...clientForm, full_name: e.target.value})}
                    placeholder="e.g. John Smith"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-deep-forest/50 mb-1 block">Email</label>
                  <Input 
                    type="email"
                    value={clientForm.email} 
                    onChange={e => setClientForm({...clientForm, email: e.target.value})}
                    placeholder="e.g. john@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-deep-forest/50 mb-1 block">Phone</label>
                  <Input 
                    type="tel"
                    value={clientForm.phone} 
                    onChange={e => setClientForm({...clientForm, phone: e.target.value})}
                    placeholder="e.g. 555-0123"
                  />
                </div>
                <Button 
                  onClick={handleSaveClient} 
                  className="w-full bg-pathway-green hover:bg-pathway-green/90 text-white font-bold py-6 rounded-xl mt-2"
                >
                  {clientForm.id ? 'Save Changes' : 'Create Client'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleRemoveFromZone = async (propertyId: string) => {
    const { error } = await supabase.from('properties').update({ territory_zone_id: null }).eq('id', propertyId);
    if (!error) {
      setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, territory_zone_id: null } : p));
      toast.success("Client removed from territory");
    } else {
      toast.error("Failed to remove client from territory");
    }
  };

  const renderTerritories = () => {
    const activeZones = territoryZones.filter(z => z.is_active);
    const inactiveZones = territoryZones.filter(z => !z.is_active);

    if (selectedZone) {
      const zoneProps = properties.filter(p => p.territory_zone_id === selectedZone.id);
      
      return (
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-deep-forest/10 flex items-center gap-4 bg-deep-forest text-white" style={{ borderBottomColor: selectedZone.color, borderBottomWidth: 4 }}>
            <button onClick={() => setSelectedZone(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: selectedZone.color }} />
                {selectedZone.name}
              </h3>
              <p className="text-white/60 text-sm">{zoneProps.length} Properties in this zone</p>
            </div>
          </div>
          
          <div className="divide-y divide-deep-forest/5">
            {zoneProps.length === 0 ? (
              <div className="p-8 text-center text-deep-forest/50">No properties in this zone yet.</div>
            ) : (
              zoneProps.map(p => {
                const agreement = serviceAgreements.find(a => a.property_id === p.id);
                const customer = customers.find(c => c.id === agreement?.customer_id);
                const tickets = serviceTickets.filter(t => t.agreement_id === agreement?.id);
                return (
                  <div key={p.id} className="p-6 hover:bg-linen-white/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-deep-forest text-lg">{p.address}</p>
                        <p className="text-sm text-deep-forest/60">Customer: <span className="font-medium text-deep-forest">{customer?.full_name || 'Unknown'}</span></p>
                      </div>
                      {agreement && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider block">Agreement Value</span>
                          <span className="font-bold text-pathway-green text-lg">${agreement.recurring_price} <span className="text-xs font-normal text-deep-forest/50 capitalize">/ {agreement.frequency.replace('-', ' ')}</span></span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-deep-forest/5">
                      {tickets.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tickets.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-deep-forest/5 text-deep-forest/70 px-2 py-1 rounded">
                              {t.type} {t.status}
                            </span>
                          ))}
                        </div>
                      ) : <div />}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromZone(p.id)}
                        className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50 text-xs px-3"
                      >
                        Remove from Zone
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-deep-forest flex items-center gap-2">
                <Map className="w-6 h-6 text-amber-porch" /> Territory Zones
              </h2>
              <p className="text-sm text-deep-forest/60 mt-1">Manage macro-zones for route optimization and D2D saturation.</p>
            </div>
            <Button onClick={() => setZoneModalOpen(true)} className="bg-pathway-green text-white hover:brightness-110 font-bold px-6 py-2 rounded-xl flex items-center gap-2">
              + Create Zone
            </Button>
          </div>
        </div>

        {territoryZones.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-deep-forest/20 text-center">
            <Map className="w-12 h-12 text-deep-forest/20 mb-4" />
            <h3 className="text-lg font-bold text-deep-forest">No Zones Configured</h3>
            <p className="text-sm text-deep-forest/60 max-w-sm mt-2 mb-6">Create your first Territory Zone to begin routing and dispatching properties efficiently.</p>
            <Button onClick={() => setZoneModalOpen(true)} className="bg-pathway-green text-white">Create First Zone</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeZones.map(zone => {
              const zonePropertiesCount = properties.filter(p => p.territory_zone_id === zone.id).length;
              return (
                <div key={zone.id} className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 hover:shadow-2xl transition-all flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-deep-forest">{zone.name}</h3>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleZone(zone.id, zone.is_active)} className="text-[10px] uppercase font-bold text-deep-forest/40 hover:text-red-500 transition-colors">
                        Deactivate
                      </button>
                      <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: zone.color }}></div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-end mt-4">
                    <div className="flex items-center justify-between pt-4 border-t border-deep-forest/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider">Density Index</span>
                        <span className="font-bold text-deep-forest">{zonePropertiesCount} Properties</span>
                      </div>
                      <button onClick={() => setSelectedZone(zone)} className="text-xs font-bold text-pathway-green bg-pathway-green/10 px-3 py-1.5 rounded-lg hover:bg-pathway-green/20 transition-colors">
                        View Zone
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {inactiveZones.map(zone => (
              <div key={zone.id} className="bg-linen-white opacity-60 rounded-2xl border border-deep-forest/10 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-deep-forest/60 line-through">{zone.name}</h3>
                  <button onClick={() => handleToggleZone(zone.id, zone.is_active)} className="text-[10px] uppercase font-bold text-deep-forest/60 hover:text-pathway-green transition-colors">
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Zone Modal */}
        {zoneModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-deep-forest/80 backdrop-blur-sm" onClick={() => setZoneModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden border border-deep-forest/5 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
                  <Map className="w-5 h-5 text-pathway-green" /> Create Territory Zone
                </h3>
                <button onClick={() => setZoneModalOpen(false)} className="w-8 h-8 rounded-full bg-deep-forest/5 hover:bg-deep-forest/10 flex items-center justify-center text-deep-forest/50 hover:text-deep-forest transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Zone Name <span className="text-red-500">*</span></label>
                  <Input 
                    placeholder="e.g. North County, 78704, Zone A"
                    value={zoneForm.name}
                    onChange={e => setZoneForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white border-deep-forest/10"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-2 block">Map Color Indicator</label>
                  <div className="flex gap-3">
                    {['#1D3B34', '#E6A355', '#4A6FA5', '#E65555', '#55C1E6', '#8F55E6'].map(color => (
                      <button
                        key={color}
                        onClick={() => setZoneForm(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full shadow-sm transition-all flex items-center justify-center ${zoneForm.color === color ? 'ring-2 ring-offset-2 ring-deep-forest scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setZoneModalOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-pathway-green text-white hover:brightness-110" onClick={handleCreateZone}>
                  Create Zone
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLeads = () => {
    const columns = [
      { id: 'new', label: 'New Leads', color: 'bg-deep-forest/5', border: 'border-deep-forest/10' },
      { id: 'not_home', label: 'Not Home', color: 'bg-amber-porch/5', border: 'border-amber-porch/20' },
      { id: 'not_interested', label: 'Not Interested', color: 'bg-red-50', border: 'border-red-200' },
      { id: 'interested', label: 'Interested', color: 'bg-blue-50', border: 'border-blue-200' },
    ];

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      const leadId = e.dataTransfer.getData('lead_id');
      if (!leadId) return;

      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      const { error } = await supabase.from('d2d_leads').update({ status: newStatus }).eq('id', leadId);
      if (error) toast.error('Failed to update status');
      else toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
    };

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
        <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-porch" /> Leads
            </h3>
            <div className="bg-deep-forest/5 rounded-lg p-1 flex items-center">
              <button 
                onClick={() => setLeadView('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${leadView === 'list' ? 'bg-white text-deep-forest shadow' : 'text-deep-forest/50 hover:text-deep-forest'}`}
              >
                List View
              </button>
              <button 
                onClick={() => setLeadView('board')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${leadView === 'board' ? 'bg-white text-deep-forest shadow' : 'text-deep-forest/50 hover:text-deep-forest'}`}
              >
                Board View
              </button>
            </div>
          </div>
          {leadView === 'list' && (
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40" />
                <Input 
                  placeholder="Search leads..." 
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  className="pl-9 h-9 bg-linen-white/50 border-deep-forest/10 rounded-lg text-sm"
                />
              </div>
              <Button onClick={exportLeadsCSV} variant="outline" className="border-deep-forest/20 text-deep-forest gap-2 rounded-xl">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
          )}
        </div>
        
        {leadView === 'list' ? (
          <div className="divide-y divide-deep-forest/5 overflow-y-auto">
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
                    {lead.status === 'interested' && (
                      <button
                        onClick={() => { setScheduleModal(lead); setScheduleForm({ start: '', end: '', techId: '', zoneId: '', price: '', frequency: 'bi-monthly' }); }}
                        className="px-3 py-1.5 rounded-xl bg-pathway-green text-white text-xs font-bold hover:brightness-110 transition-all flex items-center gap-1.5"
                      >
                        <CalendarIcon className="w-3 h-3" /> Schedule
                      </button>
                    )}
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
        ) : (
          <div className="flex-1 flex gap-4 overflow-x-auto p-6 items-stretch min-h-[600px] bg-linen-white/20">
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
                        onClick={() => setSelectedLead(l)}
                      >
                        <p className="font-bold text-sm text-deep-forest">{l.contact_name || 'Resident'}</p>
                        <p className="text-xs text-deep-forest/60 mt-1 truncate">{l.address}</p>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-[10px] uppercase font-bold text-deep-forest/40">{new Date(l.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] font-bold text-amber-porch bg-amber-porch/10 px-2 py-0.5 rounded">{l.rep_name}</p>
                        </div>
                        {col.id === 'interested' && (
                          <button
                            onClick={e => { e.stopPropagation(); setScheduleModal(l); setScheduleForm({ start: '', end: '', techId: '', zoneId: '', price: '', frequency: 'bi-monthly' }); }}
                            className="mt-2 w-full py-1.5 rounded-lg bg-pathway-green text-white text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-1"
                          >
                            <CalendarIcon className="w-3 h-3" /> Schedule
                          </button>
                        )}
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
        )}
      </div>
    );
  };

  const handleAssignTech = async (leadId: string, techId: string) => {
    const { error } = await supabase.from('d2d_leads').update({ assigned_tech_id: techId }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, assigned_tech_id: techId } : l));
      toast.success('Assigned technician');
    } else {
      toast.error('Failed to assign technician');
    }
  };

  const handleScheduleTime = async (leadId: string, start: string | null, end: string | null) => {
    const { error } = await supabase.from('d2d_leads').update({ scheduled_start: start, scheduled_end: end }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, scheduled_start: start, scheduled_end: end } : l));
      toast.success('Updated schedule');
    } else {
      toast.error('Failed to update schedule');
    }
  };

  const handleScheduleLead = async (lead: any) => {
    if (!scheduleForm.start) { toast.error('Please set a start date/time'); return; }
    if (!scheduleForm.zoneId) { toast.error('Please assign a Territory Zone'); return; }
    if (!scheduleForm.price) { toast.error('Please set a recurring price'); return; }

    toast.loading('Processing Service Agreement...', { id: 'handoff' });

    try {
      // 1. Create Customer
      const { data: customerData, error: customerError } = await supabase.from('customers').insert([{
        full_name: lead.contact_name || 'Resident',
      }]).select().single();
      if (customerError) throw customerError;

      // 2. Create Property
      const { data: propertyData, error: propertyError } = await supabase.from('properties').insert([{
        address: lead.address,
        lat: lead.lat,
        lng: lead.lng,
        territory_zone_id: scheduleForm.zoneId
      }]).select().single();
      if (propertyError) throw propertyError;

      // 3. Create Service Agreement
      const { data: agreementData, error: agreementError } = await supabase.from('service_agreements').insert([{
        property_id: propertyData.id,
        customer_id: customerData.id,
        originated_by_rep_id: lead.rep_id,
        recurring_price: parseFloat(scheduleForm.price),
        frequency: scheduleForm.frequency
      }]).select().single();
      if (agreementError) throw agreementError;

      // 4. Create Initial Ticket
      const { data: ticketData, error: ticketError } = await supabase.from('service_tickets').insert([{
        agreement_id: agreementData.id,
        scheduled_start: scheduleForm.start,
        scheduled_end: scheduleForm.end || null,
        assigned_tech_id: scheduleForm.techId || null,
        type: 'initial'
      }]).select().single();
      if (ticketError) throw ticketError;

      // 5. Close the Lead
      const updates: any = {
        status: 'scheduled',
        scheduled_start: scheduleForm.start,
        scheduled_end: scheduleForm.end || null,
        assigned_tech_id: scheduleForm.techId || null,
      };
      const { error: leadError } = await supabase.from('d2d_leads').update(updates).eq('id', lead.id);
      if (leadError) throw leadError;

      // Success cleanup
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l));
      setCustomers(prev => [...prev, customerData]);
      setProperties(prev => [...prev, propertyData]);
      setServiceAgreements(prev => [...prev, agreementData]);
      setServiceTickets(prev => [...prev, ticketData]);
      
      setScheduleModal(null);
      setScheduleForm({ start: '', end: '', techId: '', zoneId: '', price: '', frequency: 'bi-monthly' });
      toast.success(`${lead.contact_name || 'Lead'} converted to Route Customer! 🚀`, { id: 'handoff' });

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to complete handoff: ' + err.message, { id: 'handoff' });
    }
  };

  const handleUnscheduleLead = async (leadId: string) => {
    if (!confirm('Remove from schedule? They will return to "Interested" on the Leads board.')) return;
    const updates = { status: 'interested', scheduled_start: null, scheduled_end: null, assigned_tech_id: null };
    const { error } = await supabase.from('d2d_leads').update(updates).eq('id', leadId);
    if (error) { toast.error('Failed to remove from schedule'); return; }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    setSelectedClient(null);
    setSelectedCalDay(null);
    toast.success('Removed from schedule — lead is back in Interested.');
  };

  const handleCancelTicket = async (ticketId: string) => {
    if (!confirm('Cancel this service ticket?')) return;
    const { error } = await supabase.from('service_tickets').update({ status: 'cancelled' }).eq('id', ticketId);
    if (error) { toast.error('Failed to cancel ticket'); return; }
    setServiceTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'cancelled' } : t));
    setSelectedCalDay(null);
    toast.success('Service ticket cancelled.');
  };

  const renderScheduling = () => {
    const today = new Date();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const getEnrichedTickets = () => {
      return serviceTickets.map(ticket => {
        const agreement = serviceAgreements.find(a => a.id === ticket.agreement_id);
        const property = properties.find(p => p.id === agreement?.property_id);
        const customer = customers.find(c => c.id === agreement?.customer_id);
        const zone = territoryZones.find(z => z.id === property?.territory_zone_id);
        return { ...ticket, agreement, property, customer, zone };
      });
    };

    const enrichedTickets = getEnrichedTickets();

    const getEventsForDay = (day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTickets = enrichedTickets.filter(t => t.status !== 'cancelled' && t.status !== 'skipped' && (t.scheduled_start || '').startsWith(dateStr));
      const dayTouchpoints = touchpoints.filter(t => (t.scheduled_for || '').startsWith(dateStr));
      return { dayTickets, dayTouchpoints };
    };

    const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const selectedEvents = selectedCalDay !== null ? getEventsForDay(selectedCalDay) : null;

    // Group selected tickets by zone for the side panel
    const groupedTickets = selectedEvents?.dayTickets.reduce((acc, t) => {
      const zoneName = t.zone?.name || 'Unassigned Zone';
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(t);
      return acc;
    }, {} as Record<string, typeof enrichedTickets>);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Month Calendar ── */}
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden">
          <div className="p-6 border-b border-deep-forest/10 flex items-center justify-between">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-amber-porch" /> Route Dispatch Board
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCalendarDate(new Date(year, month - 1, 1)); setSelectedCalDay(null); }}
                className="w-9 h-9 rounded-xl bg-deep-forest/5 hover:bg-deep-forest/10 text-deep-forest flex items-center justify-center transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-deep-forest min-w-[150px] text-center text-sm">{format(calendarDate, 'MMMM yyyy')}</span>
              <button
                onClick={() => { setCalendarDate(new Date(year, month + 1, 1)); setSelectedCalDay(null); }}
                className="w-9 h-9 rounded-xl bg-deep-forest/5 hover:bg-deep-forest/10 text-deep-forest flex items-center justify-center transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-deep-forest/30 uppercase tracking-wider py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const { dayTickets, dayTouchpoints } = getEventsForDay(day);
                const hasEvents = dayTickets.length > 0 || dayTouchpoints.length > 0;
                const isSelected = selectedCalDay === day;
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedCalDay(isSelected ? null : day)}
                    className={[
                      'flex flex-col items-center justify-start gap-1 p-2 rounded-xl min-h-[56px] text-sm font-bold transition-all',
                      isSelected ? 'bg-pathway-green text-white shadow-lg shadow-pathway-green/30' : '',
                      !isSelected && isTodayDay ? 'bg-amber-porch/15 text-amber-porch ring-2 ring-amber-porch/40' : '',
                      !isSelected && !isTodayDay ? 'hover:bg-linen-white text-deep-forest' : '',
                    ].join(' ')}
                  >
                    <span>{day}</span>
                    {hasEvents && (
                      <div className="flex gap-0.5 flex-wrap justify-center">
                        {dayTickets.map((t, idx) => <div key={`t${idx}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : ''}`} style={{ backgroundColor: isSelected ? 'white' : (t.zone?.color || '#1D3B34') }} />)}
                        {dayTouchpoints.map((_, idx) => <div key={`tp${idx}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-amber-porch'}`} />)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-5 pt-4 border-t border-deep-forest/5 flex-wrap">
              <span className="text-xs font-semibold text-deep-forest/60 mr-2">Zones:</span>
              {territoryZones.filter(z => z.is_active).map(z => (
                <div key={z.id} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} /><span className="text-xs font-semibold text-deep-forest/60">{z.name}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Selected Day Panel (Zone Grouped) ── */}
        {selectedCalDay !== null && selectedEvents && (
          <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-deep-forest flex items-center gap-2 text-lg">
                <Clock className="w-4 h-4 text-amber-porch" />
                {format(new Date(year, month, selectedCalDay), 'EEEE, MMMM d')}
                <span className="text-sm font-normal text-deep-forest/40 ml-1">— {selectedEvents.dayTickets.length} job(s)</span>
              </h4>
              <button onClick={() => setSelectedCalDay(null)} className="w-8 h-8 rounded-lg bg-deep-forest/5 hover:bg-deep-forest/10 text-deep-forest/60 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedEvents.dayTickets.length === 0 && selectedEvents.dayTouchpoints.length === 0 && (
              <p className="text-sm text-deep-forest/50 italic">No events on this day. Schedule jobs via the Acquisition tab.</p>
            )}
            <div className="flex flex-col gap-6">
              {Object.entries(groupedTickets || {}).map(([zoneName, tickets]: [string, any]) => {
                const zoneColor = tickets[0]?.zone?.color || '#1D3B34';
                return (
                  <div key={zoneName} className="space-y-3">
                    <h5 className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-2" style={{ color: zoneColor }}>
                      <Map className="w-3 h-3" /> {zoneName} ({tickets.length} jobs)
                    </h5>
                    {tickets.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all" style={{ borderColor: `${zoneColor}20` }}>
                        <div>
                          <p className="font-bold text-sm text-deep-forest">{t.customer?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-deep-forest/60 mt-0.5">{t.property?.address || 'No address'}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {t.scheduled_start && (
                              <p className="text-xs font-bold" style={{ color: zoneColor }}>
                                {new Date(t.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {t.scheduled_end && ` – ${new Date(t.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                            )}
                            <span className="text-[9px] uppercase font-bold bg-deep-forest/5 text-deep-forest/50 px-1.5 py-0.5 rounded">{t.type} ticket</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <button
                            onClick={() => handleCancelTicket(t.id)}
                            className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors"
                          >
                            Cancel Ticket
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              
              {/* Keeping CRM touchpoints distinct at the bottom */}
              {selectedEvents.dayTouchpoints.length > 0 && (
                <div className="space-y-3 mt-4 pt-4 border-t border-deep-forest/5">
                   <h5 className="text-[10px] uppercase font-bold tracking-wider text-deep-forest/50 flex items-center gap-2">
                    CRM Touchpoints
                  </h5>
                  {selectedEvents.dayTouchpoints.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-amber-porch/5 border border-amber-porch/20 rounded-xl">
                      <div>
                        <p className="font-bold text-sm text-deep-forest">{t.client_name}</p>
                        <p className="text-xs text-deep-forest/60 mt-0.5 capitalize">{(t.campaign_type || 'nurture').replace(/_/g, ' ')} touchpoint</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${t.status === 'sent' ? 'bg-pathway-green/10 text-pathway-green' : 'bg-amber-porch/10 text-amber-porch'}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Route Map ── */}
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden">
          <div className="p-5 border-b border-deep-forest/10">
            <h4 className="font-bold text-deep-forest flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-porch" /> Route-Based Dispatch Map
            </h4>
          </div>
          <div className="p-4">
            <DispatchMap leads={leads} profiles={profiles} onAssignTech={handleAssignTech} onScheduleTime={handleScheduleTime} />
          </div>
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'technician' | 'rep' | 'admin'>('technician');
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      // Option A: Create account with a temp password — user resets via "Forgot Password"
      const tempPassword = `Ws${Math.random().toString(36).slice(2, 8)}!${Math.random().toString(36).slice(2, 5)}`;
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: tempPassword,
        options: { data: { role: inviteRole, full_name: '' } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert(
          { id: data.user.id, email: inviteEmail, role: inviteRole, is_active: true },
          { onConflict: 'id' }
        );
        setProfiles(prev =>
          prev.some(p => p.id === data.user!.id)
            ? prev
            : [...prev, { id: data.user!.id, email: inviteEmail, role: inviteRole, is_active: true, full_name: '', created_at: new Date().toISOString() }]
        );
      }
      toast.success(
        `✅ Account created for ${inviteEmail}!\nTemp password: ${tempPassword}\nTell them to use "Forgot Password" after first login.`,
        { duration: 12000 }
      );
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setInviteLoading(false);
    }
  };

  const renderTeam = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Invite Card ── */}
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-pathway-green/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-pathway-green" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-deep-forest leading-none">Invite Team Member</h3>
            <p className="text-xs text-deep-forest/50 mt-0.5">They'll receive an email to set their password and log in.</p>
          </div>
        </div>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
            <input
              type="email"
              required
              placeholder="teammate@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
            />
          </div>
          <div className="relative">
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as any)}
              className="h-full pl-4 pr-10 py-3 appearance-none rounded-xl border border-deep-forest/10 text-deep-forest text-sm font-bold focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
            >
              <option value="technician">Technician</option>
              <option value="rep">Sales Rep</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40 pointer-events-none" />
          </div>
          <button
            type="submit"
            disabled={inviteLoading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-pathway-green text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-pathway-green/20 disabled:opacity-50 shrink-0"
          >
            {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Invite
          </button>
        </form>
      </div>

      {/* ── Team Members List ── */}
      <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden">
        <div className="p-6 border-b border-deep-forest/10">
          <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
            <Users className="w-5 h-5 text-deep-forest" /> Team Members
            <span className="ml-2 bg-deep-forest/5 text-deep-forest px-3 py-1 rounded-full text-xs font-bold uppercase">{profiles.length} Total</span>
          </h3>
        </div>
        <div className="divide-y divide-deep-forest/5">
          {profiles.length === 0 && (
            <div className="p-8 text-center text-deep-forest/50">No team members yet. Invite one above.</div>
          )}
          {profiles.map(profile => (
            <div key={profile.id} className={`p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${profile.is_active === false ? 'opacity-50 grayscale' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-deep-forest text-lg">{profile.full_name || 'Unnamed Member'}</p>
                  {profile.is_active === false && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider">Deactivated</span>
                  )}
                </div>
                {profile.email && <p className="text-sm text-deep-forest/60 mt-0.5">{profile.email}</p>}
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

      {/* ── Timesheets ── */}
      <div className="mt-8">
        <TimesheetDashboard profiles={profiles} />
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
    { id: 'clients' as AdminTab, label: 'Clients', icon: Users },
    { id: 'scheduling' as AdminTab, label: 'Scheduling', icon: CalendarIcon },
    { id: 'action_center' as AdminTab, label: 'Action Center', icon: Inbox },
    { id: 'inspections' as AdminTab, label: 'Inspections', icon: ClipboardList },
    { id: 'leads' as AdminTab, label: 'Acquisition (D2D)', icon: MapPin },
    { id: 'territories' as AdminTab, label: 'Territories', icon: Map },
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
          <Logo />
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
          <Logo />
          
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
            {activeTab === 'clients' && renderClients()}
            {activeTab === 'scheduling' && renderScheduling()}
            {activeTab === 'action_center' && renderActionCenter()}
            {activeTab === 'inspections' && renderInspections()}
            {activeTab === 'leads' && renderLeads()}
            {activeTab === 'territories' && renderTerritories()}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
      </main>
      {/* ── Schedule Modal ── */}
      {scheduleModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-deep-forest/80 backdrop-blur-sm" onClick={() => setScheduleModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden border border-deep-forest/5 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-amber-porch" /> Schedule Job
              </h3>
              <button onClick={() => setScheduleModal(null)} className="w-8 h-8 rounded-full bg-deep-forest/5 hover:bg-deep-forest/10 flex items-center justify-center text-deep-forest/50 hover:text-deep-forest transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-linen-white p-4 rounded-xl mb-6">
              <p className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider">Client</p>
              <p className="font-bold text-deep-forest text-base">{scheduleModal.contact_name || 'Resident'}</p>
              <p className="text-xs text-deep-forest/70 mt-0.5">{scheduleModal.address}</p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-4 -mx-1">
              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Territory Zone <span className="text-red-500">*</span></label>
                <select 
                  className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-porch/50"
                  value={scheduleForm.zoneId}
                  onChange={e => setScheduleForm(prev => ({ ...prev, zoneId: e.target.value }))}
                >
                  <option value="">Select a Route Zone...</option>
                  {territoryZones.filter(z => z.is_active).map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Recurring Price <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-deep-forest/50 font-bold">$</span>
                    <Input 
                      type="number"
                      placeholder="150"
                      value={scheduleForm.price}
                      onChange={e => setScheduleForm(prev => ({ ...prev, price: e.target.value }))}
                      className="bg-white border-deep-forest/10 pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Frequency <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-porch/50"
                    value={scheduleForm.frequency}
                    onChange={e => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi-monthly">Bi-Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <hr className="border-deep-forest/5 my-4" />

              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Initial Service Start Time <span className="text-red-500">*</span></label>
                <Input 
                  type="datetime-local" 
                  value={scheduleForm.start}
                  onChange={e => setScheduleForm(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-white border-deep-forest/10"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Initial Service End Time (Optional)</label>
                <Input 
                  type="datetime-local" 
                  value={scheduleForm.end}
                  onChange={e => setScheduleForm(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-white border-deep-forest/10"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Assign Technician (Optional)</label>
                <select 
                  className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-porch/50"
                  value={scheduleForm.techId}
                  onChange={e => setScheduleForm(prev => ({ ...prev, techId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {profiles.filter(p => p.role === 'technician').map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setScheduleModal(null)}>Cancel</Button>
              <Button className="flex-1 bg-pathway-green text-white hover:brightness-110" onClick={() => handleScheduleLead(scheduleModal)}>
                Confirm Schedule
              </Button>
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
                {/* Pipeline Status Bar */}
                <div className="col-span-2 md:col-span-4 bg-white p-4 rounded-2xl shadow-sm border border-deep-forest/5">
                  <span className="text-[10px] uppercase font-bold text-deep-forest/50 tracking-wider mb-3 block">Pipeline Stage</span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'new', label: 'New' },
                      { id: 'not_home', label: 'Not Home' },
                      { id: 'interested', label: 'Interested' },
                      { id: 'scheduled', label: 'Scheduled' },
                    ].map((stage, idx, arr) => {
                      const isActive = selectedLead.status === stage.id;
                      const isPast = arr.findIndex(s => s.id === selectedLead.status) > idx;
                      return (
                        <div key={stage.id} className="flex items-center flex-1">
                          <button
                            onClick={async () => {
                              if (stage.id === selectedLead.status) return;
                              const { error } = await supabase.from('d2d_leads').update({ status: stage.id }).eq('id', selectedLead.id);
                              if (!error) {
                                setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: stage.id } : l));
                                setSelectedLead((prev: any) => ({ ...prev, status: stage.id }));
                                toast.success(`Moved to ${stage.label}`);
                              }
                            }}
                            className={`flex-1 text-center py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                              isActive ? 'bg-pathway-green text-white shadow-sm' :
                              isPast ? 'bg-deep-forest/10 text-deep-forest/50' :
                              'bg-deep-forest/5 text-deep-forest/30 hover:bg-deep-forest/10 hover:text-deep-forest/60'
                            }`}
                          >
                            {stage.label}
                          </button>
                          {idx < arr.length - 1 && <div className={`w-3 h-0.5 shrink-0 ${isPast || isActive ? 'bg-pathway-green' : 'bg-deep-forest/10'}`} />}
                        </div>
                      );
                    })}
                  </div>
                  {selectedLead.status === 'interested' && (
                    <button
                      onClick={() => { setScheduleModal(selectedLead); setSelectedLead(null); setScheduleForm({ start: '', end: '', techId: '', zoneId: '', price: '', frequency: 'bi-monthly' }); }}
                      className="mt-3 w-full py-2 bg-pathway-green text-white rounded-xl text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" /> Schedule This Job
                    </button>
                  )}
                </div>

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
}
