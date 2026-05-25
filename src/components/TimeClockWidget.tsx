import React, { useState, useEffect } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { TimeEntry } from '../types';
import { Clock, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TimeClockWidgetProps {
  userId: string;
}

export function TimeClockWidget({ userId }: TimeClockWidgetProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState('0:00:00');

  useEffect(() => {
    if (!userId) return;
    
    // Check for an active clocked_in session
    const fetchActiveSession = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'clocked_in')
        .order('clock_in_time', { ascending: false })
        .limit(1);
        
      if (!error && data && data.length > 0) {
        setActiveEntry(data[0]);
      }
      setLoading(false);
    };

    fetchActiveSession();
  }, [userId]);

  // Update timer every second if active
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeEntry) {
      const startTime = new Date(activeEntry.clock_in_time).getTime();
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        
        setElapsed(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }, 1000);
    } else {
      setElapsed('0:00:00');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const getGPSLocation = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
        (err) => resolve(null),
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  };

  const handleClockToggle = async () => {
    if (actionLoading || !userId) return;
    setActionLoading(true);
    
    try {
      const location = await getGPSLocation();

      if (activeEntry) {
        // CLOCK OUT
        const outTime = new Date();
        const durationMins = Math.round((outTime.getTime() - new Date(activeEntry.clock_in_time).getTime()) / 60000);
        
        const updates = {
          clock_out_time: outTime.toISOString(),
          duration_minutes: durationMins,
          location_out: location || 'No GPS',
          status: 'clocked_out' as const
        };

        const { error } = await supabase
          .from('time_entries')
          .update(updates)
          .eq('id', activeEntry.id);

        if (error) throw error;
        
        setActiveEntry(null);
        toast.success(`Clocked out successfully! (${Math.floor(durationMins / 60)}h ${durationMins % 60}m)`);
      } else {
        // CLOCK IN
        const inTime = new Date().toISOString();
        const { data, error } = await supabase
          .from('time_entries')
          .insert([{
            user_id: userId,
            clock_in_time: inTime,
            location_in: location || 'No GPS',
            status: 'clocked_in'
          }])
          .select()
          .single();

        if (error) throw error;
        
        setActiveEntry(data);
        toast.success('Clocked in successfully!');
      }
    } catch (err: any) {
      toast.error('Failed to update time clock: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${activeEntry ? 'text-amber-porch' : 'text-white/40'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">
            Time Clock
          </span>
        </div>
        {activeEntry && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-porch opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-porch"></span>
          </span>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-2">
        <span className={`text-2xl font-black font-mono tracking-wider ${activeEntry ? 'text-white' : 'text-white/20'}`}>
          {elapsed}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${activeEntry ? 'text-amber-porch' : 'text-white/40'}`}>
          {activeEntry ? 'On the Clock' : 'Off the Clock'}
        </span>
      </div>

      <button
        onClick={handleClockToggle}
        disabled={actionLoading}
        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg
          ${actionLoading ? 'opacity-50 cursor-not-allowed' : ''}
          ${activeEntry 
            ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50' 
            : 'bg-pathway-green text-white hover:brightness-110 shadow-pathway-green/20'
          }
        `}
      >
        {actionLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : activeEntry ? (
          'Clock Out'
        ) : (
          'Clock In'
        )}
      </button>

      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-white/30 font-bold mt-1">
        <MapPin className="w-3 h-3" />
        GPS Tracking Enabled
      </div>
    </div>
  );
}
