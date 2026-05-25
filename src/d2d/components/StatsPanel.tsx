import React from 'react';
import { useEffect, useState, useRef } from 'react';
import { D2DLead, STATUS_COLORS, STATUS_LABELS } from '../types';
import { DoorOpen, ThumbsUp, TrendingUp, PhoneCall, CalendarCheck, Clock } from 'lucide-react';

interface Props {
  leads: D2DLead[];
  sessionStart: Date;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-deep-forest/10 p-4 flex flex-col gap-2">
      <div className="text-pathway-green">
        <Icon className="w-4 h-4" />
      </div>
      <p className={`text-2xl font-bold leading-none ${accent ? 'text-pathway-green' : 'text-deep-forest'}`}>{value}</p>
      <p className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wide leading-tight">{label}</p>
      {sub && <p className="text-[10px] italic text-deep-forest/30">{sub}</p>}
    </div>
  );
}

export function StatsPanel({ leads, sessionStart }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sessionStart]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${sec}s`;
  };

  const doorsKnocked = leads.length;
  const interested = leads.filter(l => l.status === 'interested').length;
  const scheduled = leads.filter(l => l.status === 'scheduled').length;
  const notHome = leads.filter(l => l.status === 'not_home').length;
  const totalLeads = interested + scheduled;
  const conversionRate = doorsKnocked > 0 ? Math.round((totalLeads / doorsKnocked) * 100) : 0;
  const estimatedRevenue = leads.reduce((sum, l) => {
    if (l.status === 'interested' || l.status === 'scheduled') {
      return sum + (l.tier === 'under2000' ? 99 : 129);
    }
    return sum;
  }, 0);

  const breakdownItems = [
    { status: 'interested' as const, count: interested },
    { status: 'scheduled' as const, count: scheduled },
    { status: 'not_home' as const, count: notHome },
    { status: 'not_interested' as const, count: leads.filter(l => l.status === 'not_interested').length },
  ];

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Session timer — amber card like the app's highlighted elements */}
      <div className="bg-amber-porch/10 border border-amber-porch/20 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-porch/20 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-porch" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-deep-forest/50 tracking-wider">Session Time</p>
          <p className="text-3xl font-black text-deep-forest tabular-nums leading-tight">{formatElapsed(elapsed)}</p>
          <p className="text-deep-forest/40 text-xs mt-0.5">Started {sessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={DoorOpen} label="Doors Knocked" value={doorsKnocked} />
        <StatCard icon={ThumbsUp} label="Leads" value={totalLeads} sub="Interested + Scheduled" accent />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={`${conversionRate}%`} />
        <StatCard icon={PhoneCall} label="Follow-Ups" value={notHome} sub="Not Home" />
        <StatCard icon={CalendarCheck} label="Appts Set" value={scheduled} />
        <StatCard icon={TrendingUp} label="Est. Monthly Rev." value={`$${estimatedRevenue}`} sub="From today's leads" accent />
      </div>

      {/* Breakdown bar */}
      {doorsKnocked > 0 && (
        <div className="bg-white rounded-2xl border border-deep-forest/10 p-4">
          <p className="text-[10px] font-bold uppercase text-deep-forest/40 tracking-wider mb-3">Today's Breakdown</p>
          <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
            {breakdownItems.filter(b => b.count > 0).map(b => (
              <div
                key={b.status}
                style={{ flex: b.count, background: STATUS_COLORS[b.status] }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {breakdownItems.map(b => (
              <div key={b.status} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[b.status] }} />
                <span className="text-xs text-deep-forest/60">
                  {STATUS_LABELS[b.status]}: <strong className="text-deep-forest">{b.count}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {doorsKnocked === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-deep-forest/5 flex items-center justify-center mb-4">
            <DoorOpen className="w-9 h-9 text-deep-forest/20" />
          </div>
          <h3 className="text-lg font-bold text-deep-forest mb-1">No doors logged yet</h3>
          <p className="text-sm text-deep-forest/50 max-w-xs">Go to the Map tab and tap "Log This Door" to start tracking your shift.</p>
        </div>
      )}
    </div>
  );
}
