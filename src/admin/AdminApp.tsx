import React, { useState, useEffect } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { TerritoryZone, Customer, Property, ServiceAgreement, ServiceTicket } from '../types';
import { Menu, LayoutDashboard, Users, ClipboardList, LogOut, Loader2, MapPin, Search, FileText, Download, X, Calendar, Calendar as CalendarIcon, BarChart3, Inbox, Clock, Send, Settings, Mail, ChevronDown, ChevronLeft, ChevronRight, Map, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Logo } from '../components/Logo';
import { DispatchMap } from './components/DispatchMap';

type AdminTab = 'dashboard' | 'clients' | 'scheduling' | 'action_center' | 'inspections' | 'leads' | 'territories' | 'team' | 'settings' | 'payroll' | 'subscriptions';
import { TimesheetDashboard } from './components/TimesheetDashboard';
import { AutomationRules } from './components/AutomationRules';
import { SmartDispatchCenter } from './components/SmartDispatchCenter';
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
  const [viewArchived, setViewArchived] = useState(false);
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
  const [conversionModal, setConversionModal] = useState<string | null>(null);
  const [conversionForm, setConversionForm] = useState({ zoneId: '', price: '99.00', frequency: 'monthly' });
  const [messageTemplates, setMessageTemplates] = useState<{id: string, name: string, type: 'sms'|'email', content: string}[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Phase 12: Route Optimization State
  const [territoryZones, setTerritoryZones] = useState<TerritoryZone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [serviceAgreements, setServiceAgreements] = useState<ServiceAgreement[]>([]);
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: '', color: '#1D3B34', startDay: 1, endDay: 7 });
  const [selectedZone, setSelectedZone] = useState<TerritoryZone | null>(null);

  // Phase 13: Time Tracking & Audit Logs
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<{
    id?: string, full_name: string, email: string, phone: string,
    address?: string, zoneId?: string, price?: string, frequency?: string, propertyId?: string, agreementId?: string
  }>({ full_name: '', email: '', phone: '', address: '', zoneId: '', price: '', frequency: 'monthly' });

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
        const [inspectionsRes, leadsRes, profilesRes, templatesRes, touchpointsRes, notesRes, commsRes, zonesRes, ticketsRes, agreementsRes, propertiesRes, customersRes, timeEntriesRes, auditLogsRes] = await Promise.all([
          supabase.from('inspections').select('*, customer:customers(full_name, email, phone), property:properties(address)').order('created_at', { ascending: false }),
          supabase.from('d2d_leads').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: true }),
          supabase.from('inspection_templates').select('*').order('order_index', { ascending: true }),
          supabase.from('client_touchpoints').select('*, customer:customers(full_name, email, phone)').order('scheduled_for', { ascending: true }),
          supabase.from('client_notes').select('*, property:properties(address)').order('created_at', { ascending: false }),
          supabase.from('communication_logs').select('*').order('created_at', { ascending: false }),
          supabase.from('territory_zones').select('*').order('created_at', { ascending: true }),
          supabase.from('service_tickets').select('*, customer:customers(full_name), property:properties(address, lat, lng), agreement:service_agreements(territory_zone_id)').order('created_at', { ascending: false }),
          supabase.from('service_agreements').select('*'),
          supabase.from('properties').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('time_entries').select('*').order('created_at', { ascending: false }),
          supabase.from('audit_logs').select('*').eq('table_name', 'time_entries').order('timestamp', { ascending: false })
        ]);
        
        if (inspectionsRes.error) throw inspectionsRes.error;
        if (leadsRes.error) throw leadsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        const mappedInspections = (inspectionsRes.data || []).map((i: any) => ({
          ...i,
          client_name: i.customer?.full_name || i.client_name,
          client_email: i.customer?.email || i.client_email,
          client_phone: i.customer?.phone || i.client_phone,
          property_address: i.property?.address || i.property_address
        }));

        const mappedTouchpoints = (touchpointsRes.data || []).map((t: any) => ({
          ...t,
          client_name: t.customer?.full_name || t.client_name,
          client_email: t.customer?.email || t.client_email,
          client_phone: t.customer?.phone || t.client_phone
        }));

        const mappedNotes = (notesRes.data || []).map((n: any) => ({
          ...n,
          property_address: n.property?.address || n.property_address
        }));

        setInspections(mappedInspections);
        setLeads(leadsRes.data || []);
        setProfiles(profilesRes.data || []);

        setTemplates(templatesRes.data || []);
        setTouchpoints(mappedTouchpoints);
        setClientNotes(mappedNotes);
        setCommunicationLogs(commsRes.data || []);
        setTerritoryZones(zonesRes.data || []);
        setServiceTickets(ticketsRes.data || []);
        setServiceAgreements(agreementsRes.data || []);
        setProperties(propertiesRes.data || []);
        setCustomers(customersRes.data || []);
        setTimeEntries(timeEntriesRes.data || []);
        setAuditLogs(auditLogsRes.data || []);
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
  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) return toast.error("Zone name required");
    
    if (selectedZone) {
      const { data, error } = await supabase.from('territory_zones').update({
        name: zoneForm.name,
        color: zoneForm.color,
        service_block_start: zoneForm.startDay,
        service_block_end: zoneForm.endDay
      }).eq('id', selectedZone.id).select().single();
      
      if (error) toast.error("Failed to update zone: " + error.message);
      else {
        toast.success("Zone updated");
        setTerritoryZones(prev => prev.map(z => z.id === selectedZone.id ? data : z));
        setZoneModalOpen(false);
        setSelectedZone(null);
      }
    } else {
      const { data, error } = await supabase.from('territory_zones').insert([{
        name: zoneForm.name,
        color: zoneForm.color,
        service_block_start: zoneForm.startDay,
        service_block_end: zoneForm.endDay
      }]).select().single();
      
      if (error) {
        toast.error("Failed to create zone: " + error.message);
      } else {
        toast.success("Zone created");
        setTerritoryZones(prev => [...prev, data]);
        setZoneModalOpen(false);
        setZoneForm({ name: '', color: '#1D3B34', startDay: 1, endDay: 7 });
      }
    }
  };

  const handleToggleZone = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('territory_zones').update({ is_active: !currentStatus }).eq('id', id);
    if (error) toast.error("Failed to update status");
    else setTerritoryZones(prev => prev.map(z => z.id === id ? { ...z, is_active: !currentStatus } : z));
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this zone?')) return;
    const { error } = await supabase.from('territory_zones').delete().eq('id', id);
    if (error) toast.error("Failed to delete zone: " + error.message);
    else {
      toast.success("Zone deleted");
      setTerritoryZones(prev => prev.filter(z => z.id !== id));
      // Optionally handle properties that were in this zone (they will have territory_zone_id set to NULL by the schema)
    }
  };


  const handleSaveClient = async () => {
    if (!clientForm.full_name.trim()) return toast.error("Full Name is required");
    if (!clientForm.address?.trim()) return toast.error("Address is required");
    if (!clientForm.zoneId) return toast.error("Territory Zone is required");
    if (!clientForm.price) return toast.error("Service Price is required");
    
    if (clientForm.id) {
      // Update Customer
      const { error: custErr } = await supabase.from('customers').update({
        full_name: clientForm.full_name,
        email: clientForm.email,
        phone: clientForm.phone
      }).eq('id', clientForm.id);
      
      if (custErr) return toast.error("Failed to update client profile");

      // Update Property
      if (clientForm.propertyId) {
        await supabase.from('properties').update({
          address: clientForm.address,
          territory_zone_id: clientForm.zoneId
        }).eq('id', clientForm.propertyId);
      }

      // Update Agreement
      if (clientForm.agreementId) {
        await supabase.from('service_agreements').update({
          recurring_price: parseFloat(clientForm.price || '0'),
          frequency: clientForm.frequency,
          territory_zone_id: clientForm.zoneId
        }).eq('id', clientForm.agreementId);
      }
      
      toast.success("Client updated successfully!");
      // To reflect changes, we can reload the page or optimistically update state
      // We will reload the page for safety since data is relational
      window.location.reload();
      
    } else {
      // Create Customer
      const { data: customerData, error: custErr } = await supabase.from('customers').insert([{
        full_name: clientForm.full_name,
        email: clientForm.email,
        phone: clientForm.phone
      }]).select().single();
      
      if (custErr || !customerData) return toast.error("Failed to create client");

      // Create Property
      const { data: propertyData, error: propErr } = await supabase.from('properties').insert([{
        customer_id: customerData.id,
        address: clientForm.address,
        territory_zone_id: clientForm.zoneId
      }]).select().single();

      if (propErr || !propertyData) return toast.error("Failed to create property");

      // Create Agreement
      const { error: agErr } = await supabase.from('service_agreements').insert([{
        property_id: propertyData.id,
        customer_id: customerData.id,
        recurring_price: parseFloat(clientForm.price || '0'),
        frequency: clientForm.frequency,
        territory_zone_id: clientForm.zoneId,
        status: 'active'
      }]);

      if (agErr) return toast.error("Failed to create service agreement");

      toast.success("Client added successfully!");
      window.location.reload();
    }
  };

  const handleArchiveClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Archive this client? It will be hidden from normal operations but preserved in the God-Mode database.")) return;
    
    const { error } = await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error("Failed to archive client");
    else {
      toast.success("Client archived");
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted_at: new Date().toISOString() } as any : c));
      if (selectedClient?.id === id) setSelectedClient(null);
    }
  };

  const handleRestoreClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('customers').update({ deleted_at: null }).eq('id', id);
    if (error) toast.error("Failed to restore client");
    else {
      toast.success("Client restored from archive");
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } as any : c));
    }
  };

  const renderDashboard = () => {
    // 1. Financial Snapshots
    const activeMRR = serviceAgreements.filter(a => a.status === 'active').reduce((sum, a) => sum + Number(a.recurring_price), 0);
    const activeContracts = serviceAgreements.filter(a => a.status === 'active').length;
    
    // 2. Logistics Snapshots
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysTickets = serviceTickets.filter(t => t.status === 'scheduled' && (t.scheduled_start || '').startsWith(todayStr));
    const unassignedTickets = serviceTickets.filter(t => t.status === 'scheduled' && !t.assigned_tech_id).length;
    
    // 3. Rep Performance
    const repStats = leads.reduce((acc, lead) => {
      acc[lead.rep_name] = acc[lead.rep_name] || { total: 0, appointments: 0 };
      acc[lead.rep_name].total++;
      if (lead.status === 'scheduled') acc[lead.rep_name].appointments++;
      return acc;
    }, {} as Record<string, { total: number, appointments: number }>);
    const topReps = Object.entries(repStats).sort((a, b) => (b[1] as any).appointments - (a[1] as any).appointments).slice(0, 3);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-deep-forest flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-pathway-green" /> Dashboard Overview
            </h2>
            <p className="text-sm text-deep-forest/60 mt-1">High-level metrics and daily dispatch status.</p>
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 flex flex-col justify-center relative overflow-hidden">
            <p className="text-deep-forest/50 text-xs font-bold uppercase tracking-wider mb-2">Total Active MRR</p>
            <h3 className="text-4xl font-bold text-deep-forest mb-1">${activeMRR.toLocaleString()}</h3>
            <p className="text-pathway-green text-sm font-medium">Across {activeContracts} Active Contracts</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 flex flex-col justify-center">
            <p className="text-deep-forest/50 text-xs font-bold uppercase tracking-wider mb-2">Today's Dispatch</p>
            <h3 className="text-4xl font-bold text-deep-forest mb-1">{todaysTickets.length} Stops</h3>
            <p className="text-amber-600 text-sm font-medium">{unassignedTickets} tickets unassigned</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 flex flex-col justify-center">
             <p className="text-deep-forest/50 text-xs font-bold uppercase tracking-wider mb-2">Lead Conversion</p>
             <h3 className="text-4xl font-bold text-deep-forest mb-1">
               {leads.length > 0 ? Math.round((leads.filter(l => l.stage === 'closed_won').length / leads.length) * 100) : 0}%
             </h3>
             <p className="text-deep-forest/60 text-sm font-medium">Knock to Contract Ratio</p>
          </div>
        </div>

        {/* Live Pulse Map Placeholder & Top Reps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-deep-forest/10 lg:col-span-2 overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-5 border-b border-deep-forest/5 flex justify-between items-center bg-white z-10">
              <h3 className="text-lg font-bold text-deep-forest flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pathway-green" /> Territory Map
              </h3>
            </div>
            <div className="flex-1 bg-gray-50 relative">
               <DispatchMap 
                 leads={serviceTickets as any} 
                 profiles={profiles} 
                 onAssignTech={async () => {}} 
                 onScheduleTime={async () => {}} 
                 hideSidebar={true}
                 territoryZones={territoryZones}
               />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 lg:col-span-1 flex flex-col">
            <h3 className="text-lg font-bold text-deep-forest mb-6">Top Sales Reps</h3>
            <div className="flex-1 flex flex-col gap-4">
              {topReps.map(([name, stats]: [string, any], idx) => (
                <div key={name} className="p-4 rounded-xl bg-linen-white border border-deep-forest/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-amber-porch text-white' :
                      idx === 1 ? 'bg-gray-300 text-gray-700' :
                      'bg-orange-200 text-orange-800'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <span className="font-bold text-deep-forest block">{name}</span>
                      <span className="text-xs text-deep-forest/50">{stats.appointments} Contracts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredInspections = inspections.filter(i => 
    (i.client_name || '').toLowerCase().includes(inspectionSearch.toLowerCase()) || 
    (i.property_address || '').toLowerCase().includes(inspectionSearch.toLowerCase())
  );

  const escapeCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

  const exportInspectionsCSV = () => {
    const headers = ['ID', 'Date', 'Client', 'Email', 'Phone', 'Address', 'Duration (s)', 'Technician ID', 'PDF URL'];
    const csvContent = [
      headers.join(','),
      ...inspections.map(i => [
        i.id, new Date(i.created_at).toISOString(), escapeCSV(i.client_name), escapeCSV(i.client_email), escapeCSV(i.client_phone), 
        escapeCSV(i.property_address), i.duration_seconds || '', i.technician_id, i.pdf_url || ''
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
                <button onClick={async () => {
                  let fileName = selectedInspection.pdf_url;
                  if (fileName.includes('/public/reports/')) {
                    fileName = fileName.split('/public/reports/')[1];
                  }
                  const { data, error } = await supabase.storage.from('reports').createSignedUrl(fileName, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                  else toast.error('Failed to generate secure PDF link');
                }} className="bg-amber-porch w-full text-white font-bold px-6 py-4 rounded-2xl flex items-center justify-between group hover:brightness-110 transition-all shadow-md shadow-amber-porch/20">
                  <span className="flex items-center gap-2"><FileText className="w-5 h-5" /> Official PDF Report (Secure Link)</span>
                  <Download className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
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
    l.status !== 'scheduled' && l.status !== 'contract' && (
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
    // Collect all history items for the timeline
    const timelineItems = [
      { date: c.created_at, title: 'Customer Acquired', desc: 'First registered in system', type: 'system', icon: Users, color: 'bg-blue-500' }
    ];

    if (c.agreements) {
      c.agreements.forEach((ag: any) => {
        timelineItems.push({ date: ag.created_at, title: 'Contract Signed', desc: `$${ag.recurring_price}/${ag.frequency}`, type: 'contract', icon: FileText, color: 'bg-amber-porch' });
      });
    }

    serviceTickets.filter(t => t.customer_id === c.id && t.status === 'completed').forEach(t => {
      timelineItems.push({ date: t.completed_at || t.created_at, title: 'Service Completed', desc: t.type + ' service performed', type: 'service', icon: MapPin, color: 'bg-pathway-green' });
    });
    
    // Sort timeline descending
    timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-deep-forest/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[calc(100vh-8rem)]">
        {/* Header Hero */}
        <div className="p-8 border-b border-deep-forest/10 flex items-start gap-6 bg-deep-forest text-white shrink-0 relative">
          <button onClick={() => setSelectedClient(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors z-10 shrink-0">
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 z-10">
            <h3 className="text-3xl font-bold mb-1">{c.full_name}</h3>
            <p className="text-white/80 text-sm flex items-center gap-4">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone || 'No Phone'}</span>
              <span className="flex items-center gap-1"><Inbox className="w-3 h-3" /> {c.email || 'No Email'}</span>
            </p>
          </div>
          <div className="text-right z-10 shrink-0 flex flex-col items-end justify-between h-full">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">Total ARR Value</p>
              <p className="text-3xl font-bold text-pathway-green">${c.totalArr ? c.totalArr.toLocaleString() : 0}</p>
            </div>
            <Button 
              onClick={() => {
                const prop = c.properties?.[0];
                const ag = c.agreements?.[0];
                setClientForm({
                  id: c.id,
                  full_name: c.full_name,
                  email: c.email || '',
                  phone: c.phone || '',
                  address: prop?.address || '',
                  zoneId: prop?.territory_zone_id || '',
                  price: ag?.recurring_price?.toString() || '',
                  frequency: ag?.frequency || 'monthly',
                  propertyId: prop?.id,
                  agreementId: ag?.id
                });
                setClientModalOpen(true);
              }}
              variant="outline"
              className="mt-4 border-white/20 text-white hover:bg-white/10 hover:text-white h-8 text-xs font-bold"
            >
              Edit Profile
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-linen-white/30">
          
          {/* Left Column: Properties & Notes */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            <div className="bg-white p-5 rounded-xl shadow-sm border border-deep-forest/5">
              <h4 className="font-bold text-deep-forest mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-pathway-green" /> Internal Notes</h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('note') as HTMLTextAreaElement;
                if (!input.value.trim()) return;
                const address = c.properties?.[0]?.address || 'Unknown';
                const { error } = await supabase.from('client_notes').insert([{ property_address: address, content: input.value, author_name: adminName }]);
                if (!error) { toast.success('Note added'); input.value = ''; }
                else toast.error('Failed to add note');
              }}>
                <textarea name="note" className="w-full text-sm p-3 border border-deep-forest/10 rounded-lg bg-linen-white/50 resize-none focus:outline-none focus:border-pathway-green mb-3 transition-colors" rows={3} placeholder="Add context..." required></textarea>
                <Button type="submit" className="w-full bg-deep-forest text-white hover:bg-deep-forest/90 font-bold">Save Note</Button>
              </form>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-deep-forest/5">
              <h4 className="font-bold text-deep-forest mb-3">Properties & Contracts</h4>
              <div className="flex flex-col gap-3">
                {!c.properties || c.properties.length === 0 ? <p className="text-xs text-deep-forest/40">No properties linked.</p> : c.properties.map((p: any, i: number) => {
                  const agreement = c.agreements?.find((a: any) => a.property_id === p.id);
                  const zone = territoryZones.find(z => z.id === p.territory_zone_id);
                  return (
                    <div key={i} className="p-3 rounded-lg border border-deep-forest/10 bg-linen-white/50 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: zone?.color || '#1D3B34' }}></div>
                      <p className="font-bold text-deep-forest text-sm leading-tight pl-2">{p.address}</p>
                      <p className="text-[10px] text-deep-forest/50 uppercase tracking-wider pl-2 mt-0.5">{zone?.name || 'Unassigned Zone'}</p>
                      {agreement && (
                        <div className="mt-2 pl-2 pt-2 border-t border-deep-forest/5 flex items-center justify-between">
                          <span className="text-xs text-deep-forest/60 capitalize">{agreement.frequency}</span>
                          <span className="text-sm font-bold text-pathway-green">${agreement.recurring_price}/mo</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Timeline */}
          <div className="lg:col-span-2">
            <h4 className="text-lg font-bold text-deep-forest mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-porch" /> Service Timeline</h4>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-deep-forest/5 relative">
               {timelineItems.length === 0 ? (
                 <p className="text-sm text-deep-forest/50 text-center py-8">No history found.</p>
               ) : (
                 <div className="relative border-l-2 border-deep-forest/10 ml-4 py-2 flex flex-col gap-6">
                   {timelineItems.map((item, i) => {
                     const Icon = item.icon;
                     return (
                       <div key={i} className="relative pl-6">
                         <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white ${item.color} shadow-sm`}>
                           <Icon className="w-3 h-3" />
                         </div>
                         <div className="bg-linen-white/50 p-3 rounded-lg border border-deep-forest/5">
                           <p className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50 mb-1">{new Date(item.date).toLocaleDateString()}</p>
                           <h5 className="font-bold text-deep-forest text-sm">{item.title}</h5>
                           <p className="text-xs text-deep-forest/70 mt-1">{item.desc}</p>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClients = () => {
    // Enrich customers with properties and agreements
    const enrichedCustomers = customers.map(c => {
      const cProperties = properties.filter(p => serviceAgreements.find(a => a.customer_id === c.id && a.property_id === p.id));
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
      .filter(c => {
        // Archive View Filter
        if (viewArchived) {
          if (!c.deleted_at) return false;
        } else {
          if (c.deleted_at) return false;
        }

        if (!clientSearch) return true;
        const search = clientSearch.toLowerCase();
        return c.full_name?.toLowerCase().includes(search) || 
               c.email?.toLowerCase().includes(search) ||
               c.phone?.includes(search);
      });

    if (selectedClient) {
      // Re-find latest state
      const currentClientState = enrichedCustomers.find(c => c.id === selectedClient.id) || selectedClient;
      return renderClientProfile(currentClientState);
    }

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-porch" /> Client Directory
              {viewArchived && <span className="ml-2 text-[10px] uppercase font-bold bg-amber-porch text-white px-2 py-0.5 rounded-full">Archive</span>}
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-deep-forest/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input 
                  placeholder="Search customers..." 
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-9 bg-linen-white border-deep-forest/10 w-full sm:w-64"
                />
              </div>
              <Button 
                variant={viewArchived ? "default" : "outline"}
                className={viewArchived ? "bg-amber-porch text-white font-bold border-0" : "font-bold text-deep-forest/60 hover:text-deep-forest"}
                onClick={() => setViewArchived(!viewArchived)}
              >
                {viewArchived ? "Exit Archive" : "View Archive"}
              </Button>
              <Button 
                onClick={() => {
                  setClientForm({ full_name: '', email: '', phone: '' });
                  setClientModalOpen(true);
                }}
                className="bg-pathway-green text-white hover:brightness-110 h-9 px-4 shrink-0"
              >
                Add Client
              </Button>
            </div>
          </div>
          <div className="divide-y divide-deep-forest/5 overflow-y-auto">
            {clientsList.length === 0 ? (
              <div className="p-8 text-center text-deep-forest/50">No customers found.</div>
            ) : (
              clientsList.map((c, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedClient(c)}
                  className="p-6 hover:bg-linen-white/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex-1">
                    <p className="font-bold text-deep-forest text-lg">{c.full_name}</p>
                    <div className="flex items-center gap-2">
                        {c.email && <span className="text-[10px] font-semibold text-deep-forest/40 uppercase tracking-wider">{c.email}</span>}
                        {c.phone && <span className="text-[10px] font-semibold text-deep-forest/40 uppercase tracking-wider ml-2">{c.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {viewArchived ? (
                      <button
                        onClick={(e) => handleRestoreClient(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 bg-amber-porch text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleArchiveClient(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 text-xs font-bold uppercase tracking-wider hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
      try {
      const zoneProps = properties.filter(p => p.territory_zone_id === selectedZone.id);

      return (
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-deep-forest/10 flex items-center justify-between gap-4 bg-deep-forest text-white" style={{ borderBottomColor: selectedZone.color || '#1D3B34', borderBottomWidth: 4 }}>
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedZone(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: selectedZone.color || '#4ade80' }} />
                  {selectedZone.name}
                </h3>
                <p className="text-white/60 text-sm">{zoneProps.length} Properties in this zone</p>
              </div>
            </div>
            <Button
              onClick={() => generateMonthlyTickets(selectedZone.id)}
              className="bg-pathway-green text-white hover:brightness-110 font-bold shrink-0 text-xs px-4"
            >
              <Calendar className="w-4 h-4 mr-2" /> Schedule Zone
            </Button>
          </div>

          <div className="divide-y divide-deep-forest/5">
            {zoneProps.length === 0 ? (
              <div className="p-8 text-center text-deep-forest/50">No properties in this zone yet.</div>
            ) : (
              zoneProps.map(p => {
                const agreement = serviceAgreements.find(a => a.property_id === p.id);
                const customer = customers.find(c => c.id === (agreement?.customer_id || p.customer_id));
                const tickets = agreement ? serviceTickets.filter(t => t.agreement_id === agreement.id) : [];
                return (
                  <div key={p.id} className="p-6 hover:bg-linen-white/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-deep-forest text-lg">{p.address || 'Unknown Address'}</p>
                        <p className="text-sm text-deep-forest/60">Customer: <span className="font-medium text-deep-forest">{customer?.full_name || 'Unknown'}</span></p>
                      </div>
                      {agreement && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider block">Agreement Value</span>
                          <span className="font-bold text-pathway-green text-lg">
                            ${agreement.recurring_price || 0}
                            <span className="text-xs font-normal text-deep-forest/50 capitalize">
                              {' '}/ {(agreement.frequency || 'monthly').replace('-', ' ')}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-deep-forest/5">
                      {tickets.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tickets.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-deep-forest/5 text-deep-forest/70 px-2 py-1 rounded">
                              {t.type || 'service'} · {t.status || 'pending'}
                            </span>
                          ))}
                        </div>
                      ) : <div />}

                      <div className="flex items-center gap-2">
                        {agreement && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateMonthlyTickets(undefined, p.id)}
                            className="h-7 border-deep-forest/10 text-deep-forest/60 hover:text-pathway-green text-xs px-3 font-bold"
                          >
                            Schedule Individual
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFromZone(p.id)}
                          className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50 text-xs px-3"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
      } catch (err: any) {
        console.error('Territory render error:', err);
        return (
          <div className="p-8 bg-white rounded-2xl border border-red-200 text-center">
            <p className="text-red-500 font-bold mb-2">Failed to render zone details</p>
            <p className="text-xs text-deep-forest/50 mb-4">{err?.message || 'Unknown error'}</p>
            <button onClick={() => setSelectedZone(null)} className="text-sm font-bold text-pathway-green underline">← Back to Zones</button>
          </div>
        );
      }
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
            <Button onClick={() => {
              setSelectedZone(null);
              setZoneForm({ name: '', color: '#1D3B34', startDay: 1, endDay: 7 });
              setZoneModalOpen(true);
            }} className="bg-pathway-green text-white hover:brightness-110 font-bold px-6 py-2 rounded-xl flex items-center gap-2">
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
                      <button onClick={() => handleToggleZone(zone.id, zone.is_active)} className="text-[10px] uppercase font-bold text-deep-forest/40 hover:text-amber-porch transition-colors">
                        Deactivate
                      </button>
                      <button onClick={() => handleDeleteZone(zone.id)} className="text-[10px] uppercase font-bold text-deep-forest/40 hover:text-red-500 transition-colors">
                        Delete
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
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wider">Service Days</span>
                        <span className="font-bold text-deep-forest">{zone.service_block_start === zone.service_block_end ? `Day ${zone.service_block_start || 1}` : `Days ${zone.service_block_start || 1}-${zone.service_block_end || 7}`}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <button onClick={() => {
                        setZoneModalOpen(false);
                        setTimeout(() => setSelectedZone(zone), 50);
                      }} className="text-xs font-bold text-deep-forest bg-deep-forest/5 px-3 py-1.5 rounded-lg hover:bg-deep-forest/10 transition-colors flex-1 text-center">
                        View Properties
                      </button>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setZoneForm({ 
                          name: zone.name, 
                          color: zone.color || '#1D3B34',
                          startDay: zone.service_block_start || 1,
                          endDay: zone.service_block_end || 7
                        });
                        setSelectedZone(zone);
                        setZoneModalOpen(true);
                      }} className="text-xs font-bold text-pathway-green bg-pathway-green/10 px-3 py-1.5 rounded-lg hover:bg-pathway-green/20 transition-colors flex-1 text-center">
                        Edit Zone
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
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleToggleZone(zone.id, zone.is_active)} className="text-[10px] uppercase font-bold text-deep-forest/60 hover:text-pathway-green transition-colors">
                      Reactivate
                    </button>
                    <button onClick={() => handleDeleteZone(zone.id)} className="text-[10px] uppercase font-bold text-deep-forest/60 hover:text-red-500 transition-colors">
                      Delete
                    </button>
                  </div>
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
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Start Day (1-31)</label>
                    <Input 
                      type="number"
                      min={1} max={31}
                      value={zoneForm.startDay}
                      onChange={e => setZoneForm(prev => ({ ...prev, startDay: parseInt(e.target.value) || 1 }))}
                      className="bg-white border-deep-forest/10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">End Day (1-31)</label>
                    <Input 
                      type="number"
                      min={1} max={31}
                      value={zoneForm.endDay}
                      onChange={e => setZoneForm(prev => ({ ...prev, endDay: parseInt(e.target.value) || 7 }))}
                      className="bg-white border-deep-forest/10"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setZoneModalOpen(false); setSelectedZone(null); }}>Cancel</Button>
                <Button className="flex-1 bg-pathway-green text-white hover:brightness-110 font-bold" onClick={handleSaveZone}>
                  {selectedZone ? 'Save Changes' : 'Create Zone'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const generateMonthlyTickets = async (zoneId?: string, propertyId?: string) => {
    // Find all active agreements
    let query = supabase.from('service_agreements').select(`
      *,
      customers ( full_name ),
      properties ( address, lat, lng, territory_zone_id )
    `).eq('status', 'active');

    if (propertyId) query = query.eq('property_id', propertyId);

    const { data: agreements, error: agreementsError } = await query;
    if (agreementsError) {
      console.error("Failed to fetch agreements:", agreementsError);
      toast.error("Failed to fetch service agreements.");
      return;
    }
    
    if (!agreements || agreements.length === 0) {
      if (propertyId) toast.error("No active service agreements found to schedule for this property.");
      else if (zoneId) toast.error("No active service agreements found to schedule for this zone.");
      else toast.error("No active service agreements found to schedule.");
      return;
    }

    // If filtering by zoneId, we need to filter in memory because Supabase nested filtering can be tricky
    // with outer joins, and we also need to get the zone details
    const { data: zones } = await supabase.from('territory_zones').select('*');
    
    let filteredAgreements = agreements;
    if (zoneId) {
      filteredAgreements = agreements.filter((ag: any) => ag.properties?.territory_zone_id === zoneId);
      if (filteredAgreements.length === 0) {
        toast.error("No active service agreements found in this zone.");
        return;
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Check existing tickets for this month
    const { data: existingTickets } = await supabase.from('service_tickets').select('*')
      .gte('scheduled_start', `${currentMonth}-01T00:00:00Z`)
      .lte('scheduled_start', `${currentMonth}-31T23:59:59Z`);

    let newTicketsCount = 0;

    for (const ag of filteredAgreements) {
      // If they already have a ticket this month, skip
      const hasTicket = existingTickets?.find(t => t.agreement_id === ag.id);
      if (hasTicket) continue;

      // Determine the scheduled start date based on the territory service block
      const propertyZoneId = ag.properties?.territory_zone_id;
      const zone = zones?.find(z => z.id === propertyZoneId);
      const blockStartDay = zone?.service_block_start || 1;
      const ticketDate = new Date();
      ticketDate.setDate(blockStartDay);
      ticketDate.setHours(8, 0, 0, 0); // Default 8 AM drop

      const { error: insertErr } = await supabase.from('service_tickets').insert([{
        agreement_id: ag.id,
        property_id: ag.property_id,
        customer_id: ag.customer_id,
        status: 'scheduled',
        scheduled_start: ticketDate.toISOString(),
        price: ag.recurring_price || 0,
        notes: `Auto-generated monthly ticket for 1-year contract.`
      }]);

      if (insertErr) {
        console.error("Insert Ticket Error:", insertErr);
        toast.error(`Failed to generate ticket: ${insertErr.message}`);
      } else {
        newTicketsCount++;
      }
    }

    if (newTicketsCount > 0) {
      toast.success(`Generated ${newTicketsCount} monthly tickets!`);
    } else {
      toast.info("All selected service agreements already have tickets scheduled for this month.");
    }

    // Always refresh tickets in state to ensure UI is in sync
    const ticketsRes = await supabase.from('service_tickets').select('*, customer:customers(full_name), property:properties(address, lat, lng), agreement:service_agreements(territory_zone_id)').order('created_at', { ascending: false });
    if (ticketsRes.data) setServiceTickets(ticketsRes.data);
  };

  const renderLeads = () => {
    const columns = [
      { id: 'not_home', label: 'Not Home', color: 'bg-gray-100', border: 'border-gray-200' },
      { id: 'not_interested', label: 'Not Interested', color: 'bg-red-50', border: 'border-red-200' },
      { id: 'interested', label: 'Interested', color: 'bg-blue-50', border: 'border-blue-200' },
      { id: 'contract', label: 'Ready for Contract', color: 'bg-amber-porch/10', border: 'border-amber-porch/30' },
    ];

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      const leadId = e.dataTransfer.getData('lead_id');
      if (!leadId) return;

      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      const { error } = await supabase.from('d2d_leads').update({ status: newStatus }).eq('id', leadId);
      if (error) toast.error('Failed to update status');
      else toast.success(newStatus === 'contract' ? 'Lead moved to Contracts Pipeline!' : `Moved to ${newStatus.replace('_', ' ')}`);
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
              // Only show leads in the 'contract' column if we want them to linger, but user wants them removed.
              // We'll filter them out completely so they vanish into the Contracts Pipeline tab.
              const colLeads = col.id === 'contract' ? [] : leads.filter(l => l.status === col.id);
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

  const handleOverrideTech = async (ticketId: string, newTechId: string) => {
    const { error } = await supabase.from('service_tickets').update({ assigned_tech_id: newTechId || null }).eq('id', ticketId);
    if (error) toast.error("Failed to reassign tech");
    else {
      toast.success("Technician manually overridden (Audit Log generated)");
      setServiceTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assigned_tech_id: newTechId || null } : t));
    }
  };

  const handleToggleTimeLock = async (ticketId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('service_tickets').update({ is_time_locked: !currentStatus }).eq('id', ticketId);
    if (error) toast.error("Failed to toggle time lock");
    else {
      toast.success(!currentStatus ? "Time Hard-Locked (Bypassing Optimization)" : "Time Unlocked");
      setServiceTickets(prev => prev.map(t => t.id === ticketId ? { ...t, is_time_locked: !currentStatus } : t));
    }
  };

  const handleUpdateSchedule = async (jobId: string, type: 'lead', techId: string | null, start: string | null, end: string | null) => {
    const updates: any = {};
    if (techId !== undefined) updates.assigned_tech_id = techId;
    if (start !== undefined) updates.scheduled_start = start;
    if (end !== undefined) updates.scheduled_end = end;

    const { error } = await supabase.from('service_tickets').update(updates).eq('id', jobId);
    if (!error) {
      setServiceTickets(serviceTickets.map(t => t.id === jobId ? { ...t, ...updates } : t));
      if (start) toast.success('Dispatched to Tech!');
      else toast.success('Moved to Unassigned Pool');
    } else {
      toast.error('Failed to dispatch job');
    }
  };

  const handleQuickBook = async (jobData: any) => {
    const { data, error } = await supabase.from('d2d_leads').insert([{
      ...jobData,
      status: 'scheduled',
      stage: 'closed_won',
      territory_zone_id: jobData.zoneId || territoryZones[0]?.id
    }]).select();

    if (!error && data) {
      setLeads([...leads, ...data]);
      toast.success('Job created and scheduled!');
    } else {
      toast.error('Failed to quick book job');
    }
  };
  const handleCancelJob = async (jobId: string) => {
    // Delete the ticket from the database entirely
    const { error } = await supabase.from('service_tickets').delete().eq('id', jobId);
    
    if (!error) {
      setServiceTickets(serviceTickets.filter(t => t.id !== jobId));
      toast.success('Ticket canceled and removed!');
    } else {
      toast.error('Failed to cancel ticket');
    }
  };

  const submitConversion = async () => {
    if (!conversionModal || !conversionForm.zoneId) return;
    
    const leadId = conversionModal;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const updates = { 
      status: 'closed_won',
      stage: 'closed_won',
      territory_zone_id: conversionForm.zoneId
    };
    setLeads(leads.map(l => l.id === leadId ? { ...l, ...updates } : l));
    await supabase.from('d2d_leads').update(updates).eq('id', leadId);
    
    const { data: customerData, error: custErr } = await supabase.from('customers').insert([{
      full_name: lead.contact_name || 'Resident',
      email: `customer_${leadId.substring(0, 8)}@example.com`,
      phone: lead.contact_phone || '0000000000'
    }]).select().single();
    
    if (custErr || !customerData) return toast.error('Failed to create customer record');

    const { data: propertyData, error: propErr } = await supabase.from('properties').insert([{
      customer_id: customerData.id,
      address: lead.address,
      lat: lead.lat,
      lng: lead.lng,
      territory_zone_id: conversionForm.zoneId
    }]).select().single();

    if (propErr || !propertyData) return toast.error('Failed to create property record');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const { data: agreementData, error: agErr } = await supabase.from('service_agreements').insert([{
      property_id: propertyData.id,
      customer_id: customerData.id,
      originated_by_rep_id: lead.rep_id,
      territory_zone_id: conversionForm.zoneId,
      recurring_price: parseFloat(conversionForm.price),
      frequency: conversionForm.frequency,
      contract_start_date: startDate.toISOString().split('T')[0],
      contract_end_date: endDate.toISOString().split('T')[0],
      status: 'active'
    }]).select().single();

    if (agErr || !agreementData) return toast.error('Failed to create 1-year contract');
    
    toast.success('Contract Signed! Generating first ticket...');
    await generateMonthlyTickets();
    
    setConversionModal(null);
    setConversionForm({ zoneId: '', price: '99.00', frequency: 'monthly' });
  };

  const renderScheduling = () => {
    // Map service tickets to the shape SmartDispatchCenter and DispatchMap expect
    const mappedTickets = serviceTickets.map(t => ({
      ...t,
      contact_name: t.customer?.full_name || 'Customer',
      address: t.property?.address || 'No Address',
      lat: t.property?.lat,
      lng: t.property?.lng,
      territory_zone_id: t.agreement?.territory_zone_id || t.property?.territory_zone_id
    }));

    return (
      <SmartDispatchCenter 
        leads={mappedTickets}
        profiles={profiles}
        territoryZones={territoryZones}
        onUpdateSchedule={handleUpdateSchedule}
        onCreateJob={handleQuickBook}
        onCancelJob={handleCancelJob}
      />
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
                    await supabase.from('client_touchpoints').update({ status: 'sent' }).eq('id', t.id);
                  }
                  toast.success(`Executed ${pendingTouchpoints.length} Nurture Actions!`);
                  setTouchpoints(touchpoints.map(t => pendingTouchpoints.find(p => p.id === t.id) ? { ...t, status: 'sent' } : t));
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
                              await supabase.from('client_touchpoints').update({ status: 'sent' }).eq('id', t.id);
                              toast.success('Touchpoint executed');
                              setTouchpoints(touchpoints.map(tp => tp.id === t.id ? { ...tp, status: 'sent' } : tp));
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
      // To prevent session hijacking on the client side, redirect admin to the Supabase dashboard
      // The proper fix requires a Supabase Edge Function to use auth.admin.createUser()
      toast.error('Client-side invites are disabled to prevent session hijacking. Please invite team members directly via the Supabase Dashboard.');
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setInviteLoading(false);
    }
  };

  const renderTeam = () => {
    // Sales Leaderboard
    const repPerformance = profiles.filter(p => p.role === 'rep' || p.role === 'admin').map(rep => {
      const repLeads = leads.filter(l => l.rep_name === rep.full_name && l.stage === 'closed_won');
      const mrr = repLeads.length * 159; // Simulated MRR 
      return { id: rep.id, name: rep.full_name, mrr, deals: repLeads.length };
    }).sort((a,b) => b.mrr - a.mrr).slice(0, 5);

    // Tech Efficiency Score
    const techStats = profiles.filter(p => p.role === 'technician' || p.role === 'admin').map(tech => {
      const techInspections = inspections.filter(i => i.technician_id === tech.id);
      const avgDuration = techInspections.length ? techInspections.reduce((acc, i) => acc + (i.duration_seconds || 0), 0) / techInspections.length : 0;
      let score = 98;
      if (avgDuration > 2400) score -= Math.min(40, (avgDuration - 2400) / 60);
      return { id: tech.id, name: tech.full_name, total: techInspections.length, avgDuration: Math.round(avgDuration / 60), score: Math.round(score) };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-deep-forest flex items-center gap-2">
              <Users className="w-6 h-6 text-pathway-green" /> Team Performance & Roster
            </h2>
            <p className="text-sm text-deep-forest/60 mt-1">Manage users and track performance metrics.</p>
          </div>
        </div>

        {/* Gamification Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Sales Leaderboard */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 relative overflow-hidden">
             <h3 className="text-lg font-bold text-deep-forest mb-6 flex items-center gap-2">
               <span className="w-6 h-6 rounded-md bg-amber-porch text-white flex items-center justify-center"><Users className="w-3 h-3" /></span>
               Sales Rep Leaderboard
             </h3>
             <div className="flex flex-col gap-3">
               {repPerformance.length === 0 ? <p className="text-deep-forest/50 text-sm font-medium">No sales data yet.</p> : repPerformance.map((rep, idx) => (
                 <div key={rep.id} className="bg-linen-white rounded-xl p-3 flex items-center justify-between border border-deep-forest/5">
                   <div className="flex items-center gap-3">
                     <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-porch text-white' : 'bg-gray-200 text-gray-700'}`}>
                       #{idx + 1}
                     </span>
                     <div>
                       <p className="font-bold text-deep-forest text-sm">{rep.name}</p>
                       <p className="text-xs text-deep-forest/50">{rep.deals} Contracts Closed</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="font-bold text-lg text-pathway-green">${rep.mrr.toLocaleString()}</p>
                     <p className="text-xs text-deep-forest/50">Added MRR</p>
                   </div>
                 </div>
               ))}
             </div>
          </div>

          {/* Tech Efficiency */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-deep-forest/10 relative overflow-hidden">
             <h3 className="text-lg font-bold text-deep-forest mb-6 flex items-center gap-2">
               <span className="w-6 h-6 rounded-md bg-pathway-green text-white flex items-center justify-center"><ClipboardList className="w-3 h-3" /></span>
               Tech Efficiency Scores
             </h3>
             <div className="flex flex-col gap-3">
               {techStats.length === 0 ? <p className="text-deep-forest/50 text-sm font-medium">No tech data yet.</p> : techStats.map((tech, idx) => (
                 <div key={tech.id} className="bg-linen-white rounded-xl p-3 flex items-center justify-between border border-deep-forest/5">
                   <div className="flex items-center gap-3">
                     <span className="w-6 h-6 rounded-md bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs">
                       #{idx + 1}
                     </span>
                     <div>
                       <p className="font-bold text-deep-forest text-sm">{tech.name}</p>
                       <p className="text-xs text-deep-forest/50">{tech.total} Jobs Completed</p>
                     </div>
                   </div>
                   <div className="text-right flex items-center gap-3">
                     <div className="text-right">
                       <p className="font-bold text-deep-forest text-sm">{tech.avgDuration}m</p>
                       <p className="text-xs text-deep-forest/50">Avg Time</p>
                     </div>
                     <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center border-2 ${tech.score >= 90 ? 'border-pathway-green text-pathway-green' : tech.score >= 70 ? 'border-amber-porch text-amber-porch' : 'border-red-500 text-red-500'}`}>
                       <span className="font-bold text-sm leading-none">{tech.score}</span>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
          
          {/* ── Invite Card ── */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-white rounded-3xl shadow-xl border border-deep-forest/5 p-6 h-full flex flex-col justify-center">
              <div className="flex flex-col mb-6">
                <div className="w-12 h-12 rounded-2xl bg-pathway-green/10 flex items-center justify-center mb-4">
                  <Send className="w-6 h-6 text-pathway-green" />
                </div>
                <h3 className="text-xl font-black text-deep-forest leading-none mb-2">Invite Teammate</h3>
                <p className="text-sm text-deep-forest/60 font-medium">Send an email invite to bring a new tech or rep onto the platform.</p>
              </div>
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 font-bold"
                  />
                </div>
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="w-full pl-4 pr-10 py-3.5 appearance-none rounded-xl border border-deep-forest/10 text-deep-forest text-sm font-bold focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  >
                    <option value="technician">Technician</option>
                    <option value="rep">Sales Rep</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40 pointer-events-none" />
                </div>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-deep-forest text-white rounded-xl font-bold text-sm hover:brightness-125 transition-all shadow-md disabled:opacity-50 mt-2"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Invite
                </button>
              </form>
            </div>
          </div>

          {/* ── Team Members List ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl border border-deep-forest/5 overflow-hidden h-full flex flex-col">
              <div className="p-6 border-b border-deep-forest/10 flex items-center justify-between bg-linen-white/30">
                <h3 className="text-lg font-black text-deep-forest flex items-center gap-2">
                  <Users className="w-5 h-5 text-deep-forest" /> Active Roster
                </h3>
                <span className="bg-pathway-green/10 text-pathway-green px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{profiles.length} Total</span>
              </div>
              <div className="divide-y divide-deep-forest/5 overflow-y-auto max-h-[400px]">
                {profiles.length === 0 && (
                  <div className="p-10 text-center text-deep-forest/50 font-bold uppercase tracking-widest text-xs">No team members yet.</div>
                )}
                {profiles.map(profile => (
                  <div key={profile.id} className={`p-5 hover:bg-linen-white/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${profile.is_active === false ? 'opacity-50 grayscale' : ''}`}>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-deep-forest text-base">{profile.full_name || 'Unnamed Member'}</p>
                        {profile.is_active === false && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest">Locked Out</span>
                        )}
                      </div>
                      {profile.email && <p className="text-xs font-bold text-deep-forest/50 mt-1">{profile.email}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <select
                        className="text-xs p-2 border border-deep-forest/10 rounded-lg bg-white font-black uppercase tracking-wider text-deep-forest focus:outline-none disabled:opacity-50 cursor-pointer hover:bg-linen-white transition-colors"
                        value={profile.role}
                        disabled={profile.is_active === false}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
                          if (error) toast.error('Failed to update role');
                          else {
                            toast.success('Role updated');
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
                        size="sm"
                        className={`text-xs font-black uppercase tracking-wider h-8 ${profile.is_active === false ? 'text-pathway-green border-pathway-green' : 'text-red-500 hover:bg-red-50'}`}
                        onClick={async () => {
                          const newStatus = profile.is_active === false ? true : false;
                          if (!newStatus && !confirm(`Lock out ${profile.full_name}? They will lose access instantly.`)) return;
                          
                          const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', profile.id);
                          if (error) toast.error('Failed to update status');
                          else {
                            toast.success(newStatus ? 'Account Reactivated' : 'Account Deactivated');
                            setProfiles(profiles.map(p => p.id === profile.id ? { ...p, is_active: newStatus } : p));
                          }
                        }}
                      >
                        {profile.is_active === false ? 'Reactivate' : 'Lock Out'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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

      <AutomationRules />

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
    { id: 'subscriptions' as AdminTab, label: 'Contracts Pipeline', icon: FileText },
    { id: 'scheduling' as AdminTab, label: 'Scheduling', icon: CalendarIcon },
    { id: 'action_center' as AdminTab, label: 'Action Center', icon: Inbox },
    { id: 'inspections' as AdminTab, label: 'Inspections', icon: ClipboardList },
    { id: 'leads' as AdminTab, label: 'Acquisition', icon: MapPin },
    { id: 'territories' as AdminTab, label: 'Territories', icon: Map },
    { id: 'team' as AdminTab, label: 'Team', icon: Users },
    { id: 'payroll' as AdminTab, label: 'Time & Payroll', icon: Clock },
    { id: 'settings' as AdminTab, label: 'Settings', icon: Settings }
  ];

  const renderPayroll = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <TimesheetDashboard profiles={profiles} auditLogs={auditLogs} />
      </div>
    );
  };

  const renderContractsPipeline = () => {
    const pendingContracts = leads.filter(l => l.status === 'contract');

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-deep-forest tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-pathway-green" /> Contracts Pipeline
            </h2>
            <p className="text-sm text-deep-forest/60 mt-1">Manage pending signatures and active recurring service agreements.</p>
          </div>
          <Button onClick={generateMonthlyTickets} className="bg-pathway-green text-white hover:brightness-110 font-bold px-6 py-2 rounded-xl flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Generate This Month's Tickets
          </Button>
        </div>

        {/* ── Pending Contracts (Leads) ── */}
        <div>
          <h3 className="text-lg font-bold text-deep-forest mb-4">Pending Signatures ({pendingContracts.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingContracts.map(lead => (
              <div key={lead.id} className="bg-amber-porch/5 border border-amber-porch/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <span className="bg-amber-porch text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">Pending</span>
                </div>
                <h4 className="font-bold text-lg text-deep-forest">{lead.contact_name || 'Resident'}</h4>
                <p className="text-sm text-deep-forest/60 mt-1">{lead.address}</p>
                <div className="mt-4 pt-4 border-t border-amber-porch/10 flex justify-end">
                  <button
                    onClick={() => {
                      setConversionModal(lead.id);
                      setConversionForm({ zoneId: '', price: '99.00', frequency: 'monthly' });
                    }}
                    className="bg-amber-porch hover:brightness-110 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
                  >
                    <FileText className="w-4 h-4" /> Sign Contract
                  </button>
                </div>
              </div>
            ))}
            {pendingContracts.length === 0 && (
              <div className="col-span-full bg-white border border-dashed border-deep-forest/10 rounded-2xl p-8 text-center text-deep-forest/40 font-bold">
                No pending contracts in the pipeline.
              </div>
            )}
          </div>
        </div>

        {/* ── Active Contracts ── */}
        <div>
          <h3 className="text-lg font-bold text-deep-forest mb-4">Active Service Agreements</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-deep-forest/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-linen-white/50 text-deep-forest/60 text-xs uppercase font-black tracking-wider border-b border-deep-forest/10">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Property</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Monthly Value</th>
                  <th className="p-4">Contract End Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deep-forest/5">
                {serviceAgreements.map(ag => {
                  const cust = customers.find(c => c.id === ag.customer_id);
                  const prop = properties.find(p => p.id === ag.property_id);
                  return (
                    <tr key={ag.id} className="hover:bg-linen-white/30 transition-colors">
                      <td className="p-4 font-bold text-deep-forest">{cust?.full_name || 'Unknown'}</td>
                      <td className="p-4 text-deep-forest/80">{prop?.address || 'Unknown'}</td>
                      <td className="p-4">
                        <span className="bg-pathway-green/10 text-pathway-green px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                          {ag.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-deep-forest">${ag.recurring_price}/mo</td>
                      <td className="p-4 text-deep-forest/60">{ag.contract_end_date ? new Date(ag.contract_end_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="p-4 text-right">
                        <select
                          className="text-xs p-1.5 border border-deep-forest/20 rounded-md bg-white font-bold text-deep-forest focus:outline-none cursor-pointer hover:bg-linen-white transition-colors"
                          value={ag.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            if (newStatus === 'cancelled' && !confirm('Are you sure you want to cancel this contract? This will prevent future tickets from being generated.')) return;
                            const { error } = await supabase.from('service_agreements').update({ status: newStatus }).eq('id', ag.id);
                            if (error) toast.error('Failed to update contract status');
                            else {
                              toast.success(`Contract ${newStatus}`);
                              setServiceAgreements(prev => prev.map(a => a.id === ag.id ? { ...a, status: newStatus } : a));
                            }
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {serviceAgreements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-deep-forest/50 font-bold">No active contracts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    );
  };

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
            {activeTab === 'subscriptions' && renderContractsPipeline()}
            {activeTab === 'territories' && renderTerritories()}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'payroll' && renderPayroll()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
      </main>

      {/* ── Client Modal ── */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-deep-forest/80 backdrop-blur-sm" onClick={() => setClientModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden border border-deep-forest/5 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
                <Users className="w-5 h-5 text-pathway-green" /> {(clientForm as any).id ? 'Edit Client' : 'Add Client'}
              </h3>
              <button onClick={() => setClientModalOpen(false)} className="w-8 h-8 rounded-full bg-deep-forest/5 hover:bg-deep-forest/10 flex items-center justify-center text-deep-forest/50 hover:text-deep-forest transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Full Name <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="e.g. John Doe"
                  value={clientForm.full_name}
                  onChange={e => setClientForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="bg-white border-deep-forest/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Email</label>
                  <Input 
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={clientForm.email}
                    onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white border-deep-forest/10"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Phone</label>
                  <Input 
                    type="tel"
                    placeholder="e.g. 555-0199"
                    value={clientForm.phone}
                    onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-white border-deep-forest/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Address <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="e.g. 123 Main St, City, ST"
                  value={clientForm.address}
                  onChange={e => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                  className="bg-white border-deep-forest/10"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Territory Zone <span className="text-red-500">*</span></label>
                <select 
                  className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pathway-green/50"
                  value={clientForm.zoneId}
                  onChange={e => setClientForm(prev => ({ ...prev, zoneId: e.target.value }))}
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
                      value={clientForm.price}
                      onChange={e => setClientForm(prev => ({ ...prev, price: e.target.value }))}
                      className="bg-white border-deep-forest/10 pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-deep-forest/60 tracking-wider mb-1.5 block">Frequency <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pathway-green/50"
                    value={clientForm.frequency}
                    onChange={e => setClientForm(prev => ({ ...prev, frequency: e.target.value }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi-monthly">Bi-Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setClientModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-pathway-green text-white hover:brightness-110 font-bold" onClick={handleSaveClient}>
                {(clientForm as any).id ? 'Save Changes' : 'Create Client'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                      { id: 'not_home', label: 'Not Home' },
                      { id: 'not_interested', label: 'Not Interested' },
                      { id: 'interested', label: 'Interested' },
                      { id: 'contract', label: 'Contract' },
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
                  {selectedLead.status === 'contract' && (
                    <button
                      onClick={() => { setConversionModal(selectedLead.id); setSelectedLead(null); setConversionForm({ zoneId: '', price: '99.00', frequency: 'monthly' }); }}
                      className="mt-4 w-full bg-amber-porch text-white font-bold py-2 rounded-xl text-sm flex justify-center items-center gap-2 hover:brightness-110 transition-all shadow-sm"
                    >
                      <FileText className="w-4 h-4" /> Sign Contract
                    </button>
                  )}
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
      {/* Conversion Modal */}
      {conversionModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-deep-forest/40 backdrop-blur-sm" onClick={() => setConversionModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-pathway-green text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Convert to Customer</h3>
                <p className="text-white/80 text-xs font-bold mt-1">Assign Territory to Route</p>
              </div>
              <button onClick={() => setConversionModal(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Assign Territory Zone</label>
                <select 
                  className="w-full text-sm p-2.5 border border-deep-forest/20 rounded-xl bg-white focus:outline-none focus:border-pathway-green focus:ring-1 focus:ring-pathway-green transition-all"
                  value={conversionForm.zoneId}
                  onChange={e => setConversionForm(f => ({ ...f, zoneId: e.target.value }))}
                >
                  <option value="">Select a Territory...</option>
                  {territoryZones.map(z => (
                    <option key={z.id} value={z.id}>{z.name} (Days {z.service_block_start}-{z.service_block_end})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Recurring Price ($)</label>
                  <Input 
                    type="number"
                    value={conversionForm.price}
                    onChange={e => setConversionForm(f => ({ ...f, price: e.target.value }))}
                    className="bg-white border-deep-forest/10"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Frequency</label>
                  <select 
                    className="w-full text-sm p-2.5 border border-deep-forest/20 rounded-xl bg-white focus:outline-none focus:border-pathway-green"
                    value={conversionForm.frequency}
                    onChange={e => setConversionForm(f => ({ ...f, frequency: e.target.value }))}
                  >
                    <option value="monthly">Monthly (1-Year)</option>
                    <option value="bi-monthly">Bi-Monthly (1-Year)</option>
                    <option value="quarterly">Quarterly (1-Year)</option>
                  </select>
                </div>
              </div>
              
              <button 
                onClick={submitConversion}
                disabled={!conversionForm.zoneId}
                className="w-full bg-amber-porch hover:bg-amber-porch/90 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50 mt-4 shadow-lg shadow-amber-porch/20"
              >
                Confirm & Send to Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
