import React, { useState } from 'react';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, setHours, setMinutes, addMinutes, parseISO } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, User, MapPin, Clock, List, X, Check, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SmartDispatchCenterProps {
  leads: any[];
  profiles: any[];
  territoryZones: any[];
  onUpdateSchedule: (jobId: string, type: 'lead', techId: string | null, start: string | null, end: string | null) => Promise<void>;
  onCreateJob: (jobData: any) => Promise<void>;
  onCancelJob?: (jobId: string) => Promise<void>;
}

type ViewMode = 'month' | 'day';

export function SmartDispatchCenter({ leads, profiles, territoryZones, onUpdateSchedule, onCreateJob, onCancelJob }: SmartDispatchCenterProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [draggedJob, setDraggedJob] = useState<any | null>(null);
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Quick Assign Modal: clicking a ticket in the left panel
  const [quickAssignJob, setQuickAssignJob] = useState<any | null>(null);
  const [quickAssignTech, setQuickAssignTech] = useState('');
  const [quickAssignDate, setQuickAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quickAssignTime, setQuickAssignTime] = useState('08:00');

  // Bulk Assign Modal: assign entire zone to a tech on a date
  const [bulkZone, setBulkZone] = useState<any | null>(null);
  const [bulkTech, setBulkTech] = useState('');
  const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const START_HOUR = 7;
  const END_HOUR = 19;
  const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const activeTechs = profiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'owner');

  // ALL tickets pending dispatch (scheduled status, no tech or no date)
  const unassignedJobs = leads.filter(l => l.status === 'scheduled' && (!l.assigned_tech_id || !l.scheduled_start));
  // Fully dispatched: has tech AND a date
  const scheduledJobs = leads.filter(l => l.status === 'scheduled' && l.scheduled_start && l.assigned_tech_id);

  const dayOfMonth = currentDate.getDate();
  const activeZonesForDay = territoryZones.filter(z => dayOfMonth >= (z.service_block_start || 1) && dayOfMonth <= (z.service_block_end || 31));

  // Navigation
  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const jumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setCurrentDate(new Date(e.target.value + 'T12:00:00'));
      setSelectedDateFilter(e.target.value);
    }
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, job: any) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5'; }, 0);
  };
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedJob(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-pathway-green/10', 'border-pathway-green');
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-pathway-green/10', 'border-pathway-green');
  };

  const handleDropOnDay = async (e: React.DragEvent, dayDate: Date) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-pathway-green/10', 'border-pathway-green');
    if (!draggedJob) return;
    let newStart = setHours(dayDate, 8);
    if (draggedJob.scheduled_start) {
      const oldD = new Date(draggedJob.scheduled_start);
      newStart = setMinutes(setHours(dayDate, oldD.getHours()), oldD.getMinutes());
    }
    const newEnd = addMinutes(newStart, 60);
    await onUpdateSchedule(draggedJob.id, 'lead', draggedJob.assigned_tech_id, newStart.toISOString(), newEnd.toISOString());
  };

  const handleDropOnSlot = async (e: React.DragEvent, dayDate: Date, hour: number, techId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-pathway-green/10', 'border-pathway-green');
    if (!draggedJob) return;
    const newStart = setHours(dayDate, hour);
    const newEnd = addMinutes(newStart, 60);
    await onUpdateSchedule(draggedJob.id, 'lead', techId || draggedJob.assigned_tech_id, newStart.toISOString(), newEnd.toISOString());
  };

  const handleDropToUnassigned = async (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-pathway-green/10', 'border-pathway-green');
    if (!draggedJob) return;
    await onUpdateSchedule(draggedJob.id, 'lead', null, null, null);
  };

  // Quick Assign Submit
  const submitQuickAssign = async () => {
    if (!quickAssignJob || !quickAssignTech) return toast.error('Please select a technician');
    const [h, m] = quickAssignTime.split(':').map(Number);
    const dateObj = new Date(quickAssignDate + 'T12:00:00');
    const newStart = setMinutes(setHours(dateObj, h), m);
    const newEnd = addMinutes(newStart, 60);
    await onUpdateSchedule(quickAssignJob.id, 'lead', quickAssignTech, newStart.toISOString(), newEnd.toISOString());
    toast.success(`Dispatched to ${activeTechs.find(t => t.id === quickAssignTech)?.full_name}!`);
    setQuickAssignJob(null);
  };

  // Bulk Assign Zone
  const submitBulkAssign = async () => {
    if (!bulkZone || !bulkTech) return toast.error('Please select a technician');
    const zoneJobs = unassignedJobs.filter(j => j.territory_zone_id === bulkZone.id);
    if (zoneJobs.length === 0) return toast.error('No unassigned jobs in this zone');
    
    const dateObj = new Date(bulkDate + 'T12:00:00');
    let startHour = 8;

    for (const job of zoneJobs) {
      const newStart = setHours(dateObj, startHour);
      const newEnd = addMinutes(newStart, 60);
      await onUpdateSchedule(job.id, 'lead', bulkTech, newStart.toISOString(), newEnd.toISOString());
      startHour++; // stagger by 1 hour each
    }

    toast.success(`Dispatched ${zoneJobs.length} jobs from ${bulkZone.name} to ${activeTechs.find(t => t.id === bulkTech)?.full_name}!`);
    setBulkZone(null);
  };

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

    return (
      <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
        <div className="grid grid-cols-7 border-b border-deep-forest/10">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-black uppercase text-deep-forest/40 tracking-wider bg-linen-white/30">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-hidden">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const dayJobs = scheduledJobs.filter(j => isSameDay(new Date(j.scheduled_start), day));

            return (
              <div
                key={idx}
                className={`border-r border-b border-deep-forest/5 p-1 flex flex-col transition-colors min-h-[100px] cursor-pointer
                  ${!isCurrentMonth ? 'bg-gray-50/50 opacity-40' : 'bg-white hover:bg-gray-50'}
                  ${isToday ? 'bg-amber-porch/5 border-amber-porch/20' : ''}
                  ${draggedJob ? 'hover:bg-pathway-green/5' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnDay(e, day)}
                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className={`text-xs font-bold ${isToday ? 'bg-amber-porch text-white px-1.5 py-0.5 rounded-full' : 'text-deep-forest/60'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayJobs.length > 0 && <span className="text-[9px] text-deep-forest/40 font-bold">{dayJobs.length} jobs</span>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 p-0.5">
                  {dayJobs.slice(0, 3).map(job => {
                    const tech = activeTechs.find(t => t.id === job.assigned_tech_id);
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, job); }}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => setHoveredJobId(job.id)}
                        onMouseLeave={() => setHoveredJobId(null)}
                        className={`text-[10px] p-1.5 rounded truncate cursor-grab active:cursor-grabbing border
                          ${hoveredJobId === job.id ? 'bg-amber-porch border-amber-500 text-white shadow' : 'bg-pathway-green text-white border-pathway-green/20'}`}
                      >
                        <span className="font-bold opacity-75 mr-1">{format(new Date(job.scheduled_start), 'h:mma')}</span>
                        {job.contact_name || job.address?.split(',')[0]}
                        {tech && <span className="opacity-60 ml-1">· {tech.full_name.split(' ')[0]}</span>}
                      </div>
                    );
                  })}
                  {dayJobs.length > 3 && <div className="text-[9px] text-deep-forest/40 text-center font-bold">+{dayJobs.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day/Tech View
  const renderDayView = () => (
    <div className="flex-1 overflow-y-auto bg-white custom-scrollbar relative animate-in fade-in duration-300">
      <div className="flex">
        {/* Time Gutter */}
        <div className="w-20 shrink-0 border-r border-deep-forest/10 bg-linen-white/30 sticky left-0 z-20">
          {HOURS.map(hour => (
            <div key={hour} className="h-20 border-b border-deep-forest/10 relative">
              <span className="absolute -top-3 right-2 text-[10px] font-bold text-deep-forest/40 uppercase">
                {format(setHours(new Date(), hour), 'ha')}
              </span>
            </div>
          ))}
        </div>

        {/* Tech Columns */}
        <div className="flex flex-1 min-w-[600px]">
          {activeTechs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-deep-forest/30 text-sm font-bold">No technicians found</div>
          ) : activeTechs.map((tech, tIdx) => {
            const techJobs = scheduledJobs.filter(j => isSameDay(new Date(j.scheduled_start), currentDate) && j.assigned_tech_id === tech.id);
            return (
              <div key={tech.id} className={`flex-1 border-r border-deep-forest/5 relative ${tIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                {/* Tech Header */}
                <div className="h-10 bg-white border-b border-deep-forest/10 flex items-center justify-center sticky top-0 z-10 shadow-sm">
                  <span className="text-xs font-black text-deep-forest flex items-center gap-1.5">
                    <User className="w-3 h-3 text-pathway-green" /> {tech.full_name.split(' ')[0]}
                  </span>
                </div>
                {/* Hour Slots */}
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="h-20 border-b border-dashed border-deep-forest/5 relative transition-colors cursor-pointer hover:bg-deep-forest/5"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnSlot(e, currentDate, hour, tech.id)}
                  />
                ))}
                {/* Positioned Jobs */}
                {techJobs.map(job => {
                  const d = new Date(job.scheduled_start);
                  const jobHour = d.getHours();
                  const jobMin = d.getMinutes();
                  if (jobHour < START_HOUR || jobHour > END_HOUR) return null;
                  const topPx = ((jobHour - START_HOUR) * 80) + ((jobMin / 60) * 80) + 40;
                  return (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => setHoveredJobId(job.id)}
                      onMouseLeave={() => setHoveredJobId(null)}
                      className={`absolute left-1 right-1 h-16 rounded-lg p-2 cursor-grab shadow-sm border transition-all z-10 overflow-hidden
                        ${hoveredJobId === job.id ? 'bg-amber-porch border-amber-500 scale-[1.02] z-20' : 'bg-pathway-green text-white border-pathway-green/20'}`}
                      style={{ top: `${topPx}px` }}
                    >
                      <p className={`text-[10px] font-black truncate leading-tight ${hoveredJobId === job.id ? 'text-deep-forest' : 'text-white'}`}>
                        {format(d, 'h:mm a')}
                      </p>
                      <p className={`text-[10px] truncate leading-tight mt-0.5 ${hoveredJobId === job.id ? 'text-deep-forest/80' : 'text-white/90'}`}>
                        {job.contact_name || job.address}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[700px] bg-gray-50 animate-in fade-in zoom-in-95 duration-500">

      {/* ── Toolbar ── */}
      <div className="bg-white rounded-t-2xl shadow-sm border border-deep-forest/10 p-3 flex flex-wrap gap-4 items-center justify-between z-10 relative">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-black text-deep-forest flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-porch" /> Smart Routing Calendar
          </h3>
          <div className="h-6 w-px bg-deep-forest/10" />
          <button onClick={() => { setCurrentDate(new Date()); setViewMode('day'); }} className="text-sm font-bold text-deep-forest/60 hover:text-deep-forest">
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-linen-white px-1.5 py-1 rounded-xl border border-deep-forest/5">
            <button onClick={navigatePrev} className="p-1.5 rounded hover:bg-white hover:shadow text-deep-forest/70"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-black text-deep-forest min-w-[140px] text-center">
              {viewMode === 'month' ? format(currentDate, 'MMMM yyyy') : format(currentDate, 'EEE, MMM d')}
            </span>
            <button onClick={navigateNext} className="p-1.5 rounded hover:bg-white hover:shadow text-deep-forest/70"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <Input type="date" value={selectedDateFilter} onChange={jumpToDate} className="w-36 h-9 text-xs font-bold border-deep-forest/10 bg-white" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-linen-white p-1 rounded-lg border border-deep-forest/10">
            <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white shadow text-deep-forest' : 'text-deep-forest/50 hover:text-deep-forest'}`}>Month</button>
            <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white shadow text-deep-forest' : 'text-deep-forest/50 hover:text-deep-forest'}`}>Day/Tech</button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden rounded-b-2xl shadow-xl border border-t-0 border-deep-forest/10">

        {/* COL 1: Unassigned Pool */}
        <div
          className="w-64 bg-white border-r border-deep-forest/10 flex flex-col shrink-0"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropToUnassigned}
        >
          <div className="p-4 border-b border-deep-forest/10 bg-linen-white/50">
            <h4 className="text-xs font-black uppercase tracking-widest text-deep-forest/60 flex items-center gap-2">
              <List className="w-4 h-4" /> Unscheduled ({unassignedJobs.length})
            </h4>
            <p className="text-[10px] text-deep-forest/40 mt-1 italic">Click a job to assign, or drag to calendar</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {/* Zones with unassigned jobs */}
            {territoryZones.map(zone => {
              const zoneJobs = unassignedJobs.filter(j => j.territory_zone_id === zone.id);
              if (zoneJobs.length === 0) return null;
              return (
                <div key={zone.id} className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color || '#1D3B34' }} />
                      <span className="text-[10px] font-black uppercase tracking-wider text-deep-forest/60">{zone.name}</span>
                    </div>
                    {/* Bulk Assign Button */}
                    <button
                      onClick={() => { setBulkZone(zone); setBulkTech(''); setBulkDate(format(new Date(), 'yyyy-MM-dd')); }}
                      className="text-[9px] font-black uppercase tracking-wider text-pathway-green hover:bg-pathway-green/10 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Layers className="w-3 h-3" /> Assign All
                    </button>
                  </div>
                  {zoneJobs.map(job => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        setQuickAssignJob(job);
                        setQuickAssignTech('');
                        setQuickAssignDate(format(new Date(), 'yyyy-MM-dd'));
                        setQuickAssignTime('08:00');
                      }}
                      className="p-3 rounded-xl bg-white border border-deep-forest/10 shadow-sm cursor-pointer hover:border-amber-porch hover:shadow-md transition-all group"
                    >
                      <p className="text-xs font-bold text-deep-forest line-clamp-1">{job.contact_name || 'Unknown'}</p>
                      <p className="text-[10px] text-deep-forest/60 line-clamp-1 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-porch shrink-0" /> {job.address}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Jobs with no zone */}
            {unassignedJobs.filter(j => !j.territory_zone_id).map(job => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleDragStart(e, job)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  setQuickAssignJob(job);
                  setQuickAssignTech('');
                  setQuickAssignDate(format(new Date(), 'yyyy-MM-dd'));
                  setQuickAssignTime('08:00');
                }}
                className="p-3 rounded-xl bg-red-50 border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
              >
                <p className="text-xs font-bold text-deep-forest line-clamp-1">{job.contact_name || 'Unknown'}</p>
                <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider mt-1">No zone assigned</p>
              </div>
            ))}

            {unassignedJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-deep-forest/30">
                <Check className="w-8 h-8 mb-2" />
                <p className="text-xs font-bold">All jobs dispatched!</p>
              </div>
            )}
          </div>
        </div>

        {/* COL 2: Calendar */}
        <div className="flex-1 flex flex-col min-w-[500px] z-0">
          {viewMode === 'month' ? renderMonthView() : renderDayView()}
        </div>
      </div>

      {/* ── Quick Assign Modal (single job) ── */}
      {quickAssignJob && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-deep-forest/60 backdrop-blur-sm" onClick={() => setQuickAssignJob(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-deep-forest text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Dispatch Job</h3>
                <p className="text-white/70 text-xs font-bold mt-1 truncate">{quickAssignJob.contact_name} · {quickAssignJob.address?.split(',')[0]}</p>
              </div>
              <button onClick={() => setQuickAssignJob(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Assign Technician <span className="text-red-400">*</span></label>
                <select
                  className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pathway-green/50"
                  value={quickAssignTech}
                  onChange={e => setQuickAssignTech(e.target.value)}
                >
                  <option value="">Select a tech...</option>
                  {activeTechs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Date <span className="text-red-400">*</span></label>
                  <Input type="date" value={quickAssignDate} onChange={e => setQuickAssignDate(e.target.value)} className="border-deep-forest/10" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Start Time</label>
                  <Input type="time" value={quickAssignTime} onChange={e => setQuickAssignTime(e.target.value)} className="border-deep-forest/10" />
                </div>
              </div>
              <div className="flex gap-2">
                {onCancelJob && (
                  <button
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to completely cancel this ticket?")) {
                        await onCancelJob(quickAssignJob.id);
                        setQuickAssignJob(null);
                      }
                    }}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 border border-red-200 text-[10px] uppercase tracking-wider"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                )}
                <button
                  onClick={submitQuickAssign}
                  disabled={!quickAssignTech || !quickAssignDate}
                  className="flex-[2] bg-pathway-green hover:brightness-110 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-pathway-green/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Confirm Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Zone Assign Modal ── */}
      {bulkZone && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-deep-forest/60 backdrop-blur-sm" onClick={() => setBulkZone(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="text-white p-5 flex items-center justify-between" style={{ backgroundColor: bulkZone.color || '#1D3B34' }}>
              <div>
                <h3 className="font-black text-lg">Assign Entire Zone</h3>
                <p className="text-white/70 text-xs font-bold mt-1">
                  {unassignedJobs.filter(j => j.territory_zone_id === bulkZone.id).length} jobs in {bulkZone.name}
                </p>
              </div>
              <button onClick={() => setBulkZone(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Assign Technician <span className="text-red-400">*</span></label>
                <select
                  className="w-full text-sm p-3 border border-deep-forest/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pathway-green/50"
                  value={bulkTech}
                  onChange={e => setBulkTech(e.target.value)}
                >
                  <option value="">Select a tech...</option>
                  {activeTechs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-deep-forest/60 uppercase tracking-widest mb-1.5 block">Service Date <span className="text-red-400">*</span></label>
                <Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="border-deep-forest/10" />
              </div>
              <p className="text-[10px] text-deep-forest/50 italic">Jobs will be staggered 1 hour apart starting at 8:00 AM.</p>
              <button
                onClick={submitBulkAssign}
                disabled={!bulkTech || !bulkDate}
                className="w-full bg-pathway-green hover:brightness-110 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-pathway-green/20 flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4" /> Dispatch {unassignedJobs.filter(j => j.territory_zone_id === bulkZone.id).length} Jobs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
