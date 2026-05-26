import React, { useState, useEffect } from 'react';
import { supabase } from '../../d2d/supabaseClient';
import { TimeEntry } from '../../types';
import { Clock, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { toast } from 'sonner';

export function TimesheetDashboard({ profiles, auditLogs = [] }: { profiles: any[], auditLogs?: any[] }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week'>('week');
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({ clock_out_time: '', duration_minutes: 0, admin_notes: '' });

  useEffect(() => {
    fetchTimesheets();
  }, [timeframe]);

  const fetchTimesheets = async () => {
    setLoading(true);
    const startDate = new Date();
    if (timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Last 7 days
      startDate.setDate(startDate.getDate() - 7);
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in_time', startDate.toISOString())
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
      return toast.error("Admin notes are required to override a time card.");
    }
    
    // Parse the new clock_out_time if provided
    let updatedClockOut = null;
    if (editForm.clock_out_time) {
      // Create a Date object from the local time string, keeping the same date but updating time
      const dateStr = new Date(selectedEntry.clock_in_time).toISOString().split('T')[0];
      updatedClockOut = new Date(`${dateStr}T${editForm.clock_out_time}`).toISOString();
    }
    
    // Recalculate duration if clock_out is set
    let newDuration = editForm.duration_minutes;
    if (updatedClockOut && !newDuration) {
      const ms = new Date(updatedClockOut).getTime() - new Date(selectedEntry.clock_in_time).getTime();
      newDuration = Math.round(ms / 60000);
    }

    const { error } = await supabase.from('time_entries').update({
      clock_out_time: updatedClockOut,
      duration_minutes: newDuration,
      status: updatedClockOut ? 'clocked_out' : 'clocked_in',
      edited_by_admin: true,
      admin_notes: editForm.admin_notes
    }).eq('id', selectedEntry.id);

    if (error) {
      toast.error("Failed to update time entry.");
    } else {
      toast.success("Time entry updated (Audit Log generated).");
      setEditModalOpen(false);
      fetchTimesheets();
    }
  };

  const openEditModal = (entry: any) => {
    setSelectedEntry(entry);
    setEditForm({
      clock_out_time: entry.clock_out_time ? new Date(entry.clock_out_time).toTimeString().slice(0, 5) : '',
      duration_minutes: entry.duration_minutes || 0,
      admin_notes: entry.admin_notes || ''
    });
    setEditModalOpen(true);
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
      <div className="p-6 border-b border-deep-forest/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-deep-forest flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-porch" /> Timesheets
        </h3>
        <div className="flex bg-linen-white rounded-lg p-1 border border-deep-forest/10 w-full sm:w-auto">
          <button
            onClick={() => setTimeframe('today')}
            className={`flex-1 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${timeframe === 'today' ? 'bg-white shadow text-deep-forest' : 'text-deep-forest/50 hover:text-deep-forest'}`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeframe('week')}
            className={`flex-1 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${timeframe === 'week' ? 'bg-white shadow text-deep-forest' : 'text-deep-forest/50 hover:text-deep-forest'}`}
          >
            Past 7 Days
          </button>
        </div>
      </div>

      <div className="divide-y divide-deep-forest/5">
        {Object.entries(groupedEntries).length === 0 ? (
          <div className="p-8 text-center text-deep-forest/50 italic">No time entries found for this period.</div>
        ) : (
          Object.entries(groupedEntries).map(([userId, userEntries]: [string, any]) => {
            const totalMins = calculateTotalMinutes(userEntries);
            const activeEntry = userEntries.find((e: any) => e.status === 'clocked_in');

            return (
              <div key={userId} className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-lg text-deep-forest">{getProfileName(userId)}</h4>
                    {activeEntry && (
                      <span className="bg-pathway-green/10 text-pathway-green px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        Clocked In
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-deep-forest/50">Total Time</p>
                    <p className="text-xl font-black text-amber-porch">{formatHours(totalMins)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {userEntries.map((entry: any) => (
                    <div key={entry.id} className="bg-linen-white/30 rounded-xl p-4 border border-deep-forest/5 flex flex-col gap-2 relative group">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-deep-forest/60 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(entry.clock_in_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-sm font-bold text-deep-forest flex items-center gap-2">
                            {new Date(entry.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="text-deep-forest/30">→</span>
                            {entry.clock_out_time ? new Date(entry.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-amber-porch italic">Active</span>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {entry.duration_minutes !== undefined && entry.duration_minutes !== null && (
                            <p className="text-sm font-bold text-pathway-green">{formatHours(entry.duration_minutes)}</p>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditModal(entry)}
                            className="h-7 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 md:static md:opacity-100"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                      
                      {/* Edited By Admin Badge */}
                      {entry.edited_by_admin && (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded text-xs text-deep-forest">
                          <p className="font-bold text-amber-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Edited by Admin
                          </p>
                          <p className="text-deep-forest/70 mt-0.5">"{entry.admin_notes}"</p>
                        </div>
                      )}
                      
                      {/* Audit Log Trail */}
                      {auditLogs.filter(log => log.record_id === entry.id && log.action === 'UPDATE').length > 0 && (
                        <div className="mt-1 pt-2 border-t border-deep-forest/5 text-[10px] text-deep-forest/40">
                          {auditLogs.filter(log => log.record_id === entry.id && log.action === 'UPDATE').length} previous versions in Audit Log
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Admin Edit Modal ── */}
      {editModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-deep-forest/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-2xl font-black text-deep-forest mb-4">Override Time Card</h3>
            
            <div className="space-y-4">
              <div className="bg-linen-white p-3 rounded-lg border border-deep-forest/5 text-sm text-deep-forest/70">
                <p><strong>Employee:</strong> {getProfileName(selectedEntry.user_id)}</p>
                <p><strong>Clocked In:</strong> {new Date(selectedEntry.clock_in_time).toLocaleString()}</p>
                <p><strong>Original Out:</strong> {selectedEntry.clock_out_time ? new Date(selectedEntry.clock_out_time).toLocaleString() : 'Active'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-forest/70 mb-1">
                  Corrected Clock Out Time
                </label>
                <input 
                  type="time" 
                  value={editForm.clock_out_time}
                  onChange={e => setEditForm({ ...editForm, clock_out_time: e.target.value })}
                  className="w-full bg-linen-white border-0 rounded-xl px-4 py-3 text-deep-forest focus:ring-2 focus:ring-pathway-green transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-forest/70 mb-1">
                  Adjusted Total Minutes (Optional)
                </label>
                <input 
                  type="number" 
                  value={editForm.duration_minutes}
                  onChange={e => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) })}
                  className="w-full bg-linen-white border-0 rounded-xl px-4 py-3 text-deep-forest focus:ring-2 focus:ring-pathway-green transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-forest/70 mb-1">
                  Admin Audit Reason (Required)
                </label>
                <textarea 
                  value={editForm.admin_notes}
                  onChange={e => setEditForm({ ...editForm, admin_notes: e.target.value })}
                  className="w-full bg-linen-white border-0 rounded-xl px-4 py-3 text-deep-forest focus:ring-2 focus:ring-pathway-green transition-all h-24 resize-none"
                  placeholder="e.g. Technician forgot to clock out, manually adjusted time."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleEditSubmit} className="bg-amber-porch text-deep-forest font-bold hover:bg-amber-porch/90">
                  Force Override
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
