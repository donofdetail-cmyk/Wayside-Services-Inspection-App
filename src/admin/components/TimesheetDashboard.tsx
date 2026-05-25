import React, { useState, useEffect } from 'react';
import { supabase } from '../../d2d/supabaseClient';
import { TimeEntry } from '../../types';
import { Clock, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TimesheetDashboard({ profiles }: { profiles: any[] }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week'>('week');

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
                    <div key={entry.id} className="bg-linen-white/30 rounded-xl p-4 border border-deep-forest/5 flex items-center justify-between gap-2">
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
                      {entry.duration_minutes !== undefined && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-pathway-green">{formatHours(entry.duration_minutes)}</p>
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
    </div>
  );
}
