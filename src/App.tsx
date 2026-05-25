import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClientData, ChecklistItemData, InspectionReport, InspectionDraft } from './types';
import { ChecklistItemCard } from './components/ChecklistItemCard';
import { TimerBadge } from './components/TimerBadge';
import { HistoryDashboard } from './components/HistoryDashboard';
import { SettingsPage } from './components/SettingsPage';
import { TimeClockWidget } from './components/TimeClockWidget';
import { generateAndDownloadPDF } from './pdfGenerator';
import { AuthLogin } from './components/AuthLogin';
import { supabase } from './d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { SignaturePad } from './components/SignaturePad';
import {
  saveDraft, loadDraft, clearDraft,
  saveCompletedInspection, loadHistory, loadTemplate, syncOfflineInspections
} from './storage';
import { useTimer } from './hooks/useTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, History, ClipboardList, Menu, X, LogOut, Settings, User, Lock, Mail, MapPin, Calendar } from 'lucide-react';
import { Logo } from './components/Logo';

type Step = 'dashboard' | 'client_info' | 'checklist' | 'history' | 'settings' | 'generating' | 'success' | 'error';

const EMPTY_CLIENT: ClientData = {
  clientName: '',
  clientEmail: '',
  propertyAddress: '',
  date: new Date().toISOString().split('T')[0],
  technicianName: '',
  technicianId: '',
};

export default function App({ session, profile }: { session: any, profile: any }) {
  const [step, setStep] = useState<Step>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [templateItems, setTemplateItems] = useState<string[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [loginError, setLoginError] = useState('');

  // ── Inspection data ───────────────────────────────────────────────────────
  const [clientData, setClientData] = useState<ClientData>(EMPTY_CLIENT);
  const [checklistData, setChecklistData] = useState<Record<number, ChecklistItemData>>({});
  const [clientSignature, setClientSignature] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Draft / resume ────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<InspectionDraft | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const draftSeedSeconds = useRef(0);

  // ── Timer (only active on checklist step) ─────────────────────────────────
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedOnComplete, setElapsedOnComplete] = useState(0);
  const [formattedTime, setFormattedTime] = useState('0:00');

  // Track elapsed in a ref (not re-rendered state) for perf
  const timerRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scheduled Jobs ────────────────────────────────────────────────────────
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const fetchScheduledJobs = useCallback(async (techId: string) => {
    setLoadingJobs(true);
    const { data, error } = await supabase
      .from('d2d_leads')
      .select('*')
      .eq('assigned_tech_id', techId)
      .eq('status', 'scheduled')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setScheduledJobs(data);
    }
    setLoadingJobs(false);
  }, []);
  const displayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatSeconds = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [
      h > 0 ? String(h).padStart(2, '0') : null,
      String(m).padStart(2, '0'),
      String(sec).padStart(2, '0'),
    ].filter(Boolean).join(':');
  };

  const startTimer = useCallback((seed = 0) => {
    timerRef.current = seed;
    setFormattedTime(formatSeconds(seed));
    setTimerActive(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (displayRef.current) clearInterval(displayRef.current);
    intervalRef.current = setInterval(() => {
      timerRef.current += 1;
    }, 1000);
    displayRef.current = setInterval(() => {
      setFormattedTime(formatSeconds(timerRef.current));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (displayRef.current) { clearInterval(displayRef.current); displayRef.current = null; }
    setTimerActive(false);
    return timerRef.current;
  }, []);

  // Pause/resume timer when tab visibility changes
  useEffect(() => {
    if (!timerActive) return;
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        intervalRef.current = setInterval(() => { timerRef.current += 1; }, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [timerActive]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (displayRef.current) clearInterval(displayRef.current);
  }, []);

  // ── On mount: restore auth, check for draft ───────────────────────────────
  useEffect(() => {
    if (profile) {
      setClientData(prev => ({ ...prev, technicianName: profile.full_name, technicianId: profile.id }));
      fetchScheduledJobs(profile.id);
      loadDraft().then(saved => {
        if (saved) {
          setDraft(saved);
          setShowResumeBanner(true);
        }
      });
    }
    loadTemplate().then(setTemplateItems);
    loadHistory().then(history => setHistoryCount(history.length));

    // Try offline sync on mount and every 30s
    syncOfflineInspections();
    const syncInterval = setInterval(syncOfflineInspections, 30000);

    // Request notification permissions
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    return () => clearInterval(syncInterval);
  }, [profile]);

  // ── Supabase Realtime Subscriptions ────────────────────────────────────────
  useEffect(() => {
    if (!clientData.technicianId || step !== 'dashboard') return;

    const channel = supabase.channel('tech_jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'd2d_leads',
          filter: `assigned_tech_id=eq.${clientData.technicianId}`
        },
        (payload) => {
          // A job was assigned to this tech
          const lead = payload.new as any;
          if (lead.status === 'scheduled') {
            toast.success(`New job assigned: ${lead.address}`);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Job Assigned!', {
                body: `You've been assigned a new job at ${lead.address}`,
                icon: '/vite.svg'
              });
            }
            setScheduledJobs(prev => {
              const exists = prev.find(j => j.id === lead.id);
              if (exists) return prev.map(j => j.id === lead.id ? lead : j);
              return [lead, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientData.technicianId, step, fetchScheduledJobs]);

  // ── Auto-save draft while on checklist step ───────────────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step !== 'checklist') return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const existing = await loadDraft();
      const updated: InspectionDraft = {
        id: existing?.id ?? crypto.randomUUID(),
        clientInfo: clientData,
        checklistData,
        clientSignature,
        technicianSignature,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        elapsedSeconds: timerRef.current,
      };
      await saveDraft(updated);
    }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [checklistData, clientData, step, clientSignature, technicianSignature]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const updateClientInfo = (field: keyof ClientData, value: string) => {
    setClientData(prev => ({ ...prev, [field]: value }));
  };

  const updateChecklistItem = (index: number, field: string, value: any) => {
    setChecklistData(prev => ({
      ...prev,
      [index]: { ...(prev[index] || { status: '', notes: '' }), [field]: value },
    }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('wayside_technician_name');
    localStorage.removeItem('wayside_technician_id');
    stopTimer();
    setClientData(EMPTY_CLIENT);
    setChecklistData({});
    setClientSignature('');
    setTechnicianSignature('');
    setDraft(null);
    setScheduledJobs([]);
    setShowResumeBanner(false);
    setStep('login');
  };

  const handleStartChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.clientName || !clientData.clientEmail) return;
    setShowResumeBanner(false);
    startTimer(0);
    setStep('checklist');
  };

  const handleResumeDraft = () => {
    if (!draft) return;
    setClientData(draft.clientInfo);
    setChecklistData(draft.checklistData);
    if (draft.clientSignature) setClientSignature(draft.clientSignature);
    if (draft.technicianSignature) setTechnicianSignature(draft.technicianSignature);
    setShowResumeBanner(false);
    startTimer(draft.elapsedSeconds);
    setStep('checklist');
    toast.success('Draft restored');
  };

  const handleDismissDraft = async () => {
    await clearDraft();
    setDraft(null);
    setShowResumeBanner(false);
  };

  const handleComplete = async () => {
    for (let i = 0; i < templateItems.length; i++) {
      const item = checklistData[i];
      if (!item || !item.status) {
        toast.error(`Please complete item #${i + 1}: ${templateItems[i]}`);
        return;
      }
    }

    if (!technicianSignature) {
      toast.error('Technician signature is required');
      return;
    }
    
    if (!clientSignature) {
      toast.error('Client signature is required');
      return;
    }

    const elapsed = stopTimer();
    setElapsedOnComplete(elapsed);
    setStep('generating');

    try {
      const report: InspectionReport = { 
        clientInfo: clientData, 
        checklist: checklistData,
        clientSignature,
        technicianSignature
      };
      const pdfBlob = await generateAndDownloadPDF(report, templateItems);
      await saveCompletedInspection(report, elapsed, clientData.technicianId || '', pdfBlob);
      await clearDraft();
      
      const history = await loadHistory();
      setHistoryCount(history.length);
      
      setDraft(null);
      setStep('success');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An unknown error occurred');
      setStep('error');
    }
  };

  const handleStartAnother = () => {
    setClientData(prev => ({ 
      ...EMPTY_CLIENT, 
      technicianName: prev.technicianName,
      technicianId: prev.technicianId 
    }));
    setChecklistData({});
    setClientSignature('');
    setTechnicianSignature('');
    stopTimer();
    setStep('dashboard');
    if (clientData.technicianId) fetchScheduledJobs(clientData.technicianId);
  };

  const handleStartWalkIn = () => {
    setClientData(prev => ({ 
      ...EMPTY_CLIENT, 
      technicianName: prev.technicianName,
      technicianId: prev.technicianId 
    }));
    setStep('client_info');
  };

  const handleStartScheduledJob = (job: any) => {
    setClientData(prev => ({
      ...EMPTY_CLIENT,
      technicianName: prev.technicianName,
      technicianId: prev.technicianId,
      clientName: job.contact_name || '',
      propertyAddress: job.address || '',
    }));
    setStep('client_info');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 font-sans">
      <Toaster position="top-center" richColors />
      {/* ── Mobile Menu Overlay ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex"
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
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Signed in as</span>
                <span className="text-base font-bold text-amber-porch">{clientData.technicianName || 'Technician'}</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-1 px-3 py-4 flex-1">
              <button
                onClick={() => { setStep('client_info'); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm font-semibold text-left"
              >
                <ClipboardList className="w-4 h-4 text-pathway-green shrink-0" />
                New Inspection
              </button>

              <button
                onClick={() => { setStep('history'); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm font-semibold text-left relative"
              >
                <History className="w-4 h-4 text-pathway-green shrink-0" />
                History
                {historyCount > 0 && (
                  <span className="ml-auto bg-amber-porch text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {historyCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { loadTemplate().then(setTemplateItems); setStep('settings'); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm font-semibold text-left"
              >
                <Settings className="w-4 h-4 text-pathway-green shrink-0" />
                Settings
              </button>
            </div>

            {/* Timer (pinned to bottom, checklist only) */}
            {step === 'checklist' && (
              <div className="px-5 py-6 border-t border-white/10 flex justify-center">
                <TimerBadge formatted={formattedTime} />
              </div>
            )}

            {/* Time Clock */}
            {profile?.id && (
              <div className="px-5 pt-4 pb-2 border-t border-white/10">
                <TimeClockWidget userId={profile.id} />
              </div>
            )}

            {/* Logout */}
            <div className="px-5 pb-8 pt-2">
              <button
                onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-sm font-bold"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="h-20 bg-deep-forest text-linen-white flex items-center px-4 md:px-8 shadow-md sticky top-0 z-10 w-full">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Logo />
          </div>

          {/* Right side */}
          {step !== 'login' && (
            <div className="flex items-center gap-3">

              {/* Mobile: progress pill (checklist) + hamburger */}
              <div className="flex items-center gap-2 md:hidden">
                {step === 'checklist' && (
                  <div className="flex flex-col items-center bg-pathway-green px-3 py-1 rounded-xl shadow-inner">
                    <span className="text-[10px] uppercase font-bold text-white/80">Progress</span>
                    <span className="text-base font-bold leading-none text-white">
                      {Math.round((Object.values(checklistData).filter((i: any) => i && i.status).length / templateItems.length) * 100)}%
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setMenuOpen(true)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                  {historyCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-porch text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {historyCount > 9 ? '9+' : historyCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Desktop: settings button */}
              {step !== 'settings' && (
                <button
                  onClick={() => { loadTemplate().then(setTemplateItems); setStep('settings'); }}
                  className="hidden md:flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-xs font-bold uppercase relative"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              )}

              {/* Desktop: history button */}
              {step !== 'history' && (
                <button
                  onClick={() => {
                    loadHistory().then(h => setHistoryCount(h.length));
                    setStep('history');
                  }}
                  className="hidden md:flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-xs font-bold uppercase relative"
                >
                  <History className="w-4 h-4" />
                  History
                  {historyCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-amber-porch text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {historyCount > 9 ? '9+' : historyCount}
                    </span>
                  )}
                </button>
              )}

              <div className="hidden md:block h-8 w-[1px] bg-white/20" />

              {/* Desktop: Technician + logout */}
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <p className="text-xs opacity-70 uppercase font-semibold">Technician</p>
                    <button onClick={handleLogout} className="text-[9px] uppercase font-bold text-white/40 hover:text-white transition-colors underline">Logout</button>
                  </div>
                  <p className="text-sm font-medium text-amber-porch">{clientData.technicianName || 'Technician'}</p>
                </div>
              </div>

              {/* Desktop: Progress + timer (checklist only) */}
              {step === 'checklist' && (
                <>
                  <div className="hidden md:block h-8 w-[1px] bg-white/20" />
                  <div className="hidden md:flex items-center gap-2">
                    <div className="flex flex-col items-center bg-pathway-green px-3 py-1 rounded-xl shadow-inner">
                      <span className="text-[10px] uppercase font-bold text-white/80">Progress</span>
                      <span className="text-base font-bold leading-none text-white">
                        {Math.round((Object.values(checklistData).filter((i: any) => i && i.status).length / templateItems.length) * 100)}%
                      </span>
                    </div>
                    <TimerBadge formatted={formattedTime} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">

        {/* ── Dashboard ── */}
        {step === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
            
            {/* Resume Draft Banner */}
            {showResumeBanner && draft && (
              <div className="bg-amber-porch/10 border border-amber-porch/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-amber-porch shrink-0" />
                    <h3 className="font-bold text-amber-porch text-sm md:text-base truncate">Unfinished Inspection</h3>
                  </div>
                  <p className="text-xs md:text-sm text-deep-forest/70 truncate">
                    {draft.clientInfo.clientName ? draft.clientInfo.clientName : 'Unknown Client'} 
                    {draft.clientInfo.propertyAddress ? ` • ${draft.clientInfo.propertyAddress}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => { clearDraft(); setDraft(null); setShowResumeBanner(false); }} className="flex-1 sm:flex-none border-amber-porch/20 text-deep-forest hover:bg-amber-porch/10">Discard</Button>
                  <Button onClick={() => {
                    setClientData(draft.clientInfo);
                    setChecklistData(draft.checklistData);
                    setClientSignature(draft.clientSignature);
                    setTechnicianSignature(draft.technicianSignature);
                    setShowResumeBanner(false);
                    setStep('checklist');
                    startTimer(draft.elapsedSeconds || 0);
                  }} className="flex-1 sm:flex-none bg-amber-porch hover:bg-amber-porch/90 text-white font-bold border-none">Resume</Button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-deep-forest">Welcome back, {clientData.technicianName.split(' ')[0]}</h2>
                  <p className="text-deep-forest/60 text-sm mt-1">Here are your scheduled jobs for today.</p>
                </div>
                <Button onClick={handleStartWalkIn} className="bg-pathway-green hover:brightness-110 text-white font-bold rounded-xl h-12 shadow-lg shadow-pathway-green/20">
                  Start Walk-In Inspection
                </Button>
              </div>

              {loadingJobs ? (
                <div className="py-12 flex flex-col items-center justify-center text-deep-forest/40">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-pathway-green" />
                  <span className="text-sm font-bold uppercase tracking-wider">Loading Jobs...</span>
                </div>
              ) : scheduledJobs.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-linen-white/50 rounded-xl border border-dashed border-deep-forest/10">
                  <ClipboardList className="w-12 h-12 text-deep-forest/20 mb-3" />
                  <p className="text-deep-forest/50 font-bold">No jobs scheduled right now.</p>
                  <p className="text-deep-forest/40 text-sm mt-1">Enjoy the downtime or start a walk-in!</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {scheduledJobs.map(job => (
                    <div key={job.id} onClick={() => handleStartScheduledJob(job)} className="group bg-linen-white hover:bg-pathway-green/5 border border-deep-forest/10 hover:border-pathway-green/30 p-4 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pathway-green text-white">Scheduled</span>
                          <h3 className="font-bold text-deep-forest text-lg group-hover:text-pathway-green transition-colors">{job.contact_name}</h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-deep-forest/60">
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.address}</span>
                        </div>
                        {job.notes && (
                          <p className="text-xs text-deep-forest/50 mt-2 bg-white/50 px-3 py-2 rounded-lg border border-deep-forest/5 italic">"{job.notes}"</p>
                        )}
                      </div>
                      <Button variant="ghost" className="shrink-0 text-pathway-green group-hover:bg-pathway-green group-hover:text-white transition-all rounded-lg font-bold">
                        Start Job
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Client Info ── */}
        {step === 'client_info' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Resume Draft Banner */}
            {showResumeBanner && draft && (
              <div className="mb-4 bg-amber-porch/10 border border-amber-porch/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-deep-forest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-porch shrink-0" />
                    Unfinished inspection found
                  </p>
                  <p className="text-xs text-deep-forest/60 mt-0.5 truncate">
                    <strong>{draft.clientInfo.clientName}</strong> · {draft.clientInfo.propertyAddress}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleResumeDraft}
                    className="bg-amber-porch text-white px-4 py-2 rounded-xl text-xs font-bold hover:brightness-110 transition-all"
                  >
                    Resume
                  </button>
                  <button
                    onClick={handleDismissDraft}
                    className="bg-deep-forest/5 text-deep-forest/60 px-4 py-2 rounded-xl text-xs font-bold hover:bg-deep-forest/10 transition-all"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleStartChecklist} className="flex flex-col gap-5">
                <div className="border-b border-deep-forest/10 pb-4">
                  <h2 className="text-sm font-bold text-pathway-green uppercase tracking-wider">Client &amp; Property Info</h2>
                  <p className="text-[11px] italic text-deep-forest/70 mt-1">Enter the property and client information to begin.</p>
                </div>
                <div>
                  <Label htmlFor="clientName" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Client Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                    <Input id="clientName" required placeholder="John Doe" value={clientData.clientName} onChange={(e) => updateClientInfo('clientName', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="clientEmail" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Client Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                    <Input id="clientEmail" type="email" placeholder="john@example.com" required value={clientData.clientEmail} onChange={(e) => updateClientInfo('clientEmail', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="propertyAddress" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Property Address *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                    <Input id="propertyAddress" required placeholder="123 Main St" value={clientData.propertyAddress} onChange={(e) => updateClientInfo('propertyAddress', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="date" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                    <Input id="date" type="date" required value={clientData.date} onChange={(e) => updateClientInfo('date', e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-pathway-green text-white py-4 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 mt-2 flex items-center justify-center gap-2">
                  Begin Inspection
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Checklist ── */}
        {step === 'checklist' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-deep-forest">
                  <span className="text-amber-porch">10-Point</span> Vital Checklist
                </h2>
                <p className="text-deep-forest/70 text-xs mt-1 font-medium">{clientData.clientName} &bull; {clientData.propertyAddress}</p>
              </div>
            </div>

            <div className="space-y-6">
              {templateItems.map((item, index) => {
                const data = checklistData[index] || { status: '', notes: '' };
                return (
                  <ChecklistItemCard
                    key={index}
                    itemTitle={`${index + 1}. ${item}`}
                    isSeasonalTask={index === templateItems.length - 1}
                    status={data.status}
                    notes={data.notes}
                    photoUrls={data.photoUrls}
                    rooms={data.rooms}
                    seasonalTaskName={data.seasonalTaskName}
                    onUpdate={(field, value) => updateChecklistItem(index, field, value)}
                  />
                );
              })}
            </div>

            <div className="mt-10 pt-6 border-t border-deep-forest/10 flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SignaturePad 
                  label="Technician Signature *" 
                  onSign={setTechnicianSignature} 
                  initialSignature={technicianSignature} 
                />
                <SignaturePad 
                  label="Client Signature *" 
                  onSign={setClientSignature} 
                  initialSignature={clientSignature} 
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleComplete}
                  className="w-full sm:w-auto bg-pathway-green text-white py-4 px-10 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 flex items-center justify-center gap-2"
                >
                  Complete Inspection
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── History ── */}
        {step === 'history' && (
          <HistoryDashboard onBack={() => setStep('client_info')} />
        )}

        {/* ── Settings ── */}
        {step === 'settings' && (
          <SettingsPage onBack={() => { loadTemplate().then(setTemplateItems); setStep('client_info'); }} />
        )}

        {/* ── Generating ── */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
            <Loader2 className="w-16 h-16 text-pathway-green animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-deep-forest mb-2">Generating Files...</h2>
            <p className="text-slate-500 text-center max-w-xs">Preparing your PDF report and downloading files.</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-pathway-green rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-deep-forest mb-3">Inspection Complete</h2>
            <p className="text-slate-600 text-center max-w-sm mb-2 text-lg">
              The PDF report has been downloaded to your device.
            </p>
            {elapsedOnComplete > 0 && (
              <p className="text-sm text-deep-forest/50 mb-8">
                Total time on-site: <strong>{Math.floor(elapsedOnComplete / 60)}m {elapsedOnComplete % 60}s</strong>
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleStartAnother} className="h-12 px-6">
                Start Another
              </Button>
              <button
                onClick={() => setStep('history')}
                className="h-12 px-6 rounded-xl bg-deep-forest text-white font-bold text-sm flex items-center gap-2 hover:brightness-110 transition-all"
              >
                <History className="w-4 h-4" /> View History
              </button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500 text-center">
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-deep-forest mb-3">Failed to Generate</h2>
            <p className="text-red-600 max-w-sm mb-4 font-mono text-sm bg-red-50 p-3 rounded border border-red-100">{errorMsg}</p>
            <Button variant="ghost" onClick={() => setStep('dashboard')} className="w-full h-12 font-bold text-deep-forest hover:bg-deep-forest/5">
              Back to Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
