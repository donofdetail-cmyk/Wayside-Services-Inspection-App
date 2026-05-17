import { useState, useEffect, useRef, useCallback } from 'react';
import { CHECKLIST_ITEMS, ClientData, ChecklistItemData, InspectionReport, InspectionDraft } from './types';
import { ChecklistItemCard } from './components/ChecklistItemCard';
import { TimerBadge } from './components/TimerBadge';
import { HistoryDashboard } from './components/HistoryDashboard';
import { generateAndDownloadPDF } from './pdfGenerator';
import {
  saveDraft, loadDraft, clearDraft,
  saveCompletedInspection, loadHistory,
} from './storage';
import { useTimer } from './hooks/useTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, History, ClipboardList, Menu, X, LogOut } from 'lucide-react';

type Step = 'login' | 'client_info' | 'checklist' | 'history' | 'generating' | 'success' | 'error';

const EMPTY_CLIENT: ClientData = {
  clientName: '',
  clientEmail: '',
  propertyAddress: '',
  date: new Date().toISOString().split('T')[0],
  technicianName: '',
};

export default function App() {
  const [step, setStep] = useState<Step>('login');
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // ── Inspection data ───────────────────────────────────────────────────────
  const [clientData, setClientData] = useState<ClientData>(EMPTY_CLIENT);
  const [checklistData, setChecklistData] = useState<Record<number, ChecklistItemData>>({});
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
    const storedName = localStorage.getItem('wayside_technician_name');
    if (storedName) {
      setClientData(prev => ({ ...prev, technicianName: storedName }));
      setStep('client_info');
      // Check for an existing draft
      const saved = loadDraft();
      if (saved) {
        setDraft(saved);
        setShowResumeBanner(true);
      }
    }
  }, []);

  // ── Auto-save draft while on checklist step ───────────────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step !== 'checklist') return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      const existing = loadDraft();
      const updated: InspectionDraft = {
        id: existing?.id ?? crypto.randomUUID(),
        clientInfo: clientData,
        checklistData,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        elapsedSeconds: timerRef.current,
      };
      saveDraft(updated);
    }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [checklistData, clientData, step]);

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = import.meta.env.VITE_TECHNICIAN_PIN || '2468';
    if (loginPin === correctPin) {
      localStorage.setItem('wayside_technician_name', loginName);
      setClientData(prev => ({ ...prev, technicianName: loginName }));
      setLoginError('');
      const saved = loadDraft();
      if (saved) { setDraft(saved); setShowResumeBanner(true); }
      setStep('client_info');
    } else {
      setLoginError('Invalid PIN');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wayside_technician_name');
    stopTimer();
    setClientData(EMPTY_CLIENT);
    setChecklistData({});
    setLoginPin('');
    setDraft(null);
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
    setShowResumeBanner(false);
    startTimer(draft.elapsedSeconds);
    setStep('checklist');
  };

  const handleDismissDraft = () => {
    clearDraft();
    setDraft(null);
    setShowResumeBanner(false);
  };

  const handleComplete = async () => {
    for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
      const item = checklistData[i];
      if (!item || !item.status) {
        alert(`Please complete item #${i + 1}: ${CHECKLIST_ITEMS[i]}`);
        return;
      }
    }

    const elapsed = stopTimer();
    setElapsedOnComplete(elapsed);
    setStep('generating');

    try {
      const report: InspectionReport = { clientInfo: clientData, checklist: checklistData };
      await generateAndDownloadPDF(report);
      saveCompletedInspection(report, elapsed);
      clearDraft();
      setDraft(null);
      setStep('success');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An unknown error occurred');
      setStep('error');
    }
  };

  const handleStartAnother = () => {
    setClientData(prev => ({ ...prev, clientName: '', clientEmail: '', propertyAddress: '' }));
    setChecklistData({});
    stopTimer();
    setStep('client_info');
  };

  const historyCount = loadHistory().length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 font-sans">
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
                Inspection History
                {historyCount > 0 && (
                  <span className="ml-auto bg-amber-porch text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {historyCount}
                  </span>
                )}
              </button>
            </div>

            {/* Timer (pinned to bottom, checklist only) */}
            {step === 'checklist' && (
              <div className="px-5 py-4 border-t border-white/10">
                <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">Time On-Site</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-pathway-green animate-pulse shrink-0" />
                  <TimerBadge formatted={formattedTime} />
                </div>
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
                <span className="font-bold text-[9px] text-pathway-green tracking-[0.25em] uppercase">Services</span>
              </div>
            </div>
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
                      {Math.round((Object.values(checklistData).filter(i => i && i.status).length / CHECKLIST_ITEMS.length) * 100)}%
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

              {/* Desktop: history button */}
              {step !== 'history' && (
                <button
                  onClick={() => setStep('history')}
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
                        {Math.round((Object.values(checklistData).filter(i => i && i.status).length / CHECKLIST_ITEMS.length) * 100)}%
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

        {/* ── Login ── */}
        {step === 'login' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto w-full mt-10 md:mt-20">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-deep-forest">Technician Login</h2>
                  <p className="text-xs text-deep-forest/70 mt-1">Enter your name and PIN to access the inspection app.</p>
                </div>
                {loginError && <p className="text-red-500 text-xs font-bold -mb-2">{loginError}</p>}
                <div>
                  <Label htmlFor="loginName" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Your Name *</Label>
                  <Input id="loginName" required value={loginName} onChange={(e) => setLoginName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <div>
                  <Label htmlFor="loginPin" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Technician PIN *</Label>
                  <Input id="loginPin" type="password" required value={loginPin} onChange={(e) => setLoginPin(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <button type="submit" className="w-full bg-pathway-green text-white py-4 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 mt-2">
                  Log In
                </button>
              </form>
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
                  <Input id="clientName" required value={clientData.clientName} onChange={(e) => updateClientInfo('clientName', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <div>
                  <Label htmlFor="clientEmail" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Client Email *</Label>
                  <Input id="clientEmail" type="email" required value={clientData.clientEmail} onChange={(e) => updateClientInfo('clientEmail', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <div>
                  <Label htmlFor="propertyAddress" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Property Address *</Label>
                  <Input id="propertyAddress" required value={clientData.propertyAddress} onChange={(e) => updateClientInfo('propertyAddress', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <div>
                  <Label htmlFor="date" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Date *</Label>
                  <Input id="date" type="date" required value={clientData.date} onChange={(e) => updateClientInfo('date', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 h-auto shadow-none" />
                </div>
                <button type="submit" className="w-full bg-pathway-green text-white py-4 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 mt-2 flex items-center justify-center gap-2">
                  Begin Inspection <ArrowRight className="w-4 h-4" />
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
              {CHECKLIST_ITEMS.map((item, index) => {
                const data = checklistData[index] || { status: '', notes: '' };
                return (
                  <ChecklistItemCard
                    key={index}
                    itemTitle={`${index + 1}. ${item}`}
                    isSeasonalTask={index === 9}
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

            <div className="mt-10 pt-6 border-t border-deep-forest/10 flex justify-end">
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
        )}

        {/* ── History ── */}
        {step === 'history' && (
          <HistoryDashboard onBack={() => setStep('client_info')} />
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
            <Button onClick={() => setStep('checklist')} className="h-12 px-6 bg-deep-forest text-white">
              Return to Checklist
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
