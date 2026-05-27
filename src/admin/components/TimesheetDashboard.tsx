import React, { useState, useEffect } from 'react';
import { supabase } from '../../d2d/supabaseClient';
import { TimeEntry } from '../../types';
import { Clock, Calendar as CalendarIcon, Loader2, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function TimesheetDashboard({ profiles, auditLogs = [] }: { profiles: any[], auditLogs?: any[] }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<string>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({ 
    clock_in_date: '', 
    clock_in_time: '', 
    clock_out_date: '', 
    clock_out_time: '', 
    duration_minutes: 0, 
    admin_notes: '' 
  });

  useEffect(() => {
    fetchTimesheets();
  }, [timeframe, customStart, customEnd]);

  const fetchTimesheets = async () => {
    setLoading(true);
    let startD = new Date();
    let endD = new Date();
    endD.setHours(23, 59, 59, 999);

    if (timeframe === 'today') {
      startD.setHours(0, 0, 0, 0);
    } else if (timeframe === 'week') {
      startD.setDate(startD.getDate() - 7);
    } else {
      if (customStart) startD = new Date(customStart);
      if (customEnd) {
        endD = new Date(customEnd);
        endD.setHours(23, 59, 59, 999);
      }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in_time', startD.toISOString())
      .lte('clock_in_time', endD.toISOString())
      .order('clock_in_time', { ascending: false });

    if (!error && data) {
      setEntries(data);
    }
    setLoading(false);
  };

  const getProfileName = (id: string) => {
    return profiles.find(p => p.id === id)?.full_name || 'Unknown Employee';
  };

  const calculateTotalMinutes = (userEntries: TimeEntry[]) => {
    return userEntries.reduce((total, entry) => {
      if (entry.duration_minutes) return total + entry.duration_minutes;
      if (entry.status === 'clocked_in') {
        const now = new Date().getTime();
        const start = new Date(entry.clock_in_time).getTime();
        return total + Math.floor((now - start) / 60000);
      }
      return total;
    }, 0);
  };

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // Group entries by user
  const groupedEntries = entries.reduce((acc, entry) => {
    acc[entry.user_id] = acc[entry.user_id] || [];
    acc[entry.user_id].push(entry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  const handleEditSubmit = async () => {
    if (!selectedEntry) return;
    if (!editForm.admin_notes.trim()) {
      return toast.error("Admin notes are required to override a time card (Legal Requirement).");
    }
    
    let updatedClockIn = selectedEntry.clock_in_time;
    if (editForm.clock_in_date && editForm.clock_in_time) {
      updatedClockIn = new Date(`${editForm.clock_in_date}T${editForm.clock_in_time}`).toISOString();
    }

    let updatedClockOut = selectedEntry.clock_out_time;
    if (editForm.clock_out_date && editForm.clock_out_time) {
      updatedClockOut = new Date(`${editForm.clock_out_date}T${editForm.clock_out_time}`).toISOString();
    } else if (!editForm.clock_out_time) {
      updatedClockOut = null; // Revert to clocked in if cleared
    }
    
    // Recalculate duration if both in and out are present
    let newDuration = editForm.duration_minutes;
    if (updatedClockIn && updatedClockOut) {
      const ms = new Date(updatedClockOut).getTime() - new Date(updatedClockIn).getTime();
      newDuration = Math.round(ms / 60000);
    }

    const { error } = await supabase.from('time_entries').update({
      clock_in_time: updatedClockIn,
      clock_out_time: updatedClockOut,
      duration_minutes: newDuration > 0 ? newDuration : null,
      status: updatedClockOut ? 'clocked_out' : 'clocked_in',
      edited_by_admin: true,
      admin_notes: editForm.admin_notes
    }).eq('id', selectedEntry.id);

    if (error) {
      toast.error("Failed to update time entry.");
    } else {
      toast.success("Time entry updated and securely logged in Audit Trail.");
      setEditModalOpen(false);
      fetchTimesheets();
    }
  };

  const openEditModal = (entry: any) => {
    setSelectedEntry(entry);
    const inDate = new Date(entry.clock_in_time);
    const outDate = entry.clock_out_time ? new Date(entry.clock_out_time) : null;
    
    setEditForm({
      clock_in_date: inDate.toISOString().split('T')[0],
      clock_in_time: inDate.toTimeString().slice(0, 5),
      clock_out_date: outDate ? outDate.toISOString().split('T')[0] : inDate.toISOString().split('T')[0],
      clock_out_time: outDate ? outDate.toTimeString().slice(0, 5) : '',
      duration_minutes: entry.duration_minutes || 0,
      admin_notes: entry.admin_notes || ''
    });
    setEditModalOpen(true);
  };

  const exportCSV = () => {
    if (entries.length === 0) return toast.error("No entries to export.");
    
    let csv = "Employee,Clock In,Clock Out,Duration (Mins),Total Hours,Status,Admin Override,Audit Notes\n";
    
    entries.forEach(entry => {
      const employee = getProfileName(entry.user_id).replace(/,/g, '');
      const clockIn = new Date(entry.clock_in_time).toLocaleString().replace(/,/g, '');
      const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time).toLocaleString().replace(/,/g, '') : 'Active';
      const duration = entry.duration_minutes || 0;
      const formattedHr = formatHours(duration);
      const status = entry.status;
      const edited = entry.edited_by_admin ? 'Yes' : 'No';
      const notes = (entry.admin_notes || '').replace(/,/g, ';');
      
      csv += `${employee},${clockIn},${clockOut},${duration},${formattedHr},${status},${edited},${notes}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Wayside_Timesheets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-pathway-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 overflow-hidden">
      <div className="p-6 border-b border-deep-forest/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linen-white/30">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-porch" /> Company Timecards
        </h3>
        
        <div className="flex flex-wrap items-center gap-3">
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in mr-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs px-2 py-1.5 rounded border border-deep-forest/20" />
              <span className="text-deep-forest/50 text-xs">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs px-2 py-1.5 rounded border border-deep-forest/20" />
            </div>
          )}
          
          <div className="flex bg-white rounded-lg p-1 border border-deep-forest/10 shadow-sm">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${timeframe === 'today' ? 'bg-pathway-green text-white' : 'text-deep-forest/50 hover:text-deep-forest'}`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${timeframe === 'week' ? 'bg-pathway-green text-white' : 'text-deep-forest/50 hover:text-deep-forest'}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('custom')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${timeframe === 'custom' ? 'bg-pathway-green text-white' : 'text-deep-forest/50 hover:text-deep-forest'}`}
            >
              Custom
            </button>
          </div>
          
          <Button onClick={exportCSV} variant="outline" className="h-8 bg-white border-deep-forest/20 text-deep-forest gap-2 shadow-sm">
            <Download className="w-3.5 h-3.5" /> CSV Export
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-linen-white/80 border-b border-deep-forest/10">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50">Employee</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50">Date</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50">Clock In</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50">Clock Out</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50 text-right">Hours</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-forest/50 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedEntries).length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-deep-forest/50 italic">
                  No time entries found for this period.
                </td>
              </tr>
            ) : (
              Object.entries(groupedEntries).map(([userId, userEntries]: [string, any]) => {
                const totalMins = calculateTotalMinutes(userEntries);
                
                return (
                  <React.Fragment key={userId}>
                    {/* User Header Row */}
                    <tr className="bg-deep-forest/5 border-b border-deep-forest/10">
                      <td colSpan={4} className="px-6 py-3 font-bold text-deep-forest">
                        {getProfileName(userId)}
                      </td>
                      <td className="px-6 py-3 font-black text-amber-porch text-right">
                        {formatHours(totalMins)}
                      </td>
                      <td></td>
                    </tr>
                    
                    {/* Time Entries */}
                    {userEntries.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-deep-forest/5 hover:bg-linen-white/30 transition-colors group">
                        <td className="px-6 py-4">
                          {entry.status === 'clocked_in' && (
                            <span className="bg-pathway-green/10 text-pathway-green px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                              Active
                            </span>
                          )}
                          {entry.edited_by_admin && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider" title={entry.admin_notes}>
                              <AlertTriangle className="w-3 h-3" /> Edited
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-deep-forest/80 font-medium">
                          {new Date(entry.clock_in_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-sm text-deep-forest">
                          {new Date(entry.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-sm text-deep-forest">
                          {entry.clock_out_time ? (
                            new Date(entry.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            <span className="text-amber-porch italic text-xs font-bold">Still working...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-pathway-green text-right">
                          {entry.duration_minutes ? formatHours(entry.duration_minutes) : '--'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditModal(entry)}
                            className="h-8 text-xs text-deep-forest/50 hover:text-deep-forest hover:bg-deep-forest/5"
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Admin Edit Modal ── */}
      {editModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-deep-forest/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="mb-6">
              <h3 className="text-2xl font-black text-deep-forest">Modify Timecard</h3>
              <p className="text-sm text-deep-forest/60 mt-1">Changes are legally logged in the database audit trail.</p>
            </div>
            
            <div className="space-y-5">
              <div className="bg-amber-porch/10 p-3 rounded-lg border border-amber-porch/20 text-sm text-deep-forest/80 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p><strong>Employee:</strong> {getProfileName(selectedEntry.user_id)}</p>
                  <p className="mt-1 text-xs opacity-70">
                    Previous modifications: {auditLogs.filter(log => log.record_id === selectedEntry.id && log.action === 'UPDATE').length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5">Clock-In Date</label>
                  <input type="date" value={editForm.clock_in_date} onChange={e => setEditForm({...editForm, clock_in_date: e.target.value})} className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-3 py-2.5 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5">Clock-In Time</label>
                  <input type="time" value={editForm.clock_in_time} onChange={e => setEditForm({...editForm, clock_in_time: e.target.value})} className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-3 py-2.5 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5">Clock-Out Date</label>
                  <input type="date" value={editForm.clock_out_date} onChange={e => setEditForm({...editForm, clock_out_date: e.target.value})} className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-3 py-2.5 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5">Clock-Out Time</label>
                  <input type="time" value={editForm.clock_out_time} onChange={e => setEditForm({...editForm, clock_out_time: e.target.value})} className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-3 py-2.5 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5 flex justify-between">
                  <span>Override Total Duration (Mins)</span>
                  <span className="text-deep-forest/40">Optional</span>
                </label>
                <input type="number" value={editForm.duration_minutes} onChange={e => setEditForm({...editForm, duration_minutes: parseInt(e.target.value)})} placeholder="Auto-calculated if left at 0" className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-3 py-2.5 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-deep-forest/70 mb-1.5 flex items-center gap-1.5">
                  Reason for Override <span className="text-red-500">*</span>
                </label>
                <textarea 
                  value={editForm.admin_notes}
                  onChange={e => setEditForm({ ...editForm, admin_notes: e.target.value })}
                  className="w-full bg-linen-white border border-deep-forest/10 rounded-xl px-4 py-3 text-sm text-deep-forest focus:ring-2 focus:ring-pathway-green outline-none transition-all h-20 resize-none"
                  placeholder="Required for FLSA Compliance (e.g., 'Employee forgot to clock out at EOD')"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleEditSubmit} className="bg-pathway-green text-white font-bold hover:brightness-110 shadow-lg shadow-pathway-green/20">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
