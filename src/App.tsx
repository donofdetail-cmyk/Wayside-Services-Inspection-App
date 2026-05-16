import { useState } from 'react';
import { CHECKLIST_ITEMS, ClientData, ChecklistItemData, InspectionReport } from './types';
import { ChecklistItemCard } from './components/ChecklistItemCard';
import { generateAndSendPDF } from './pdfGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ClipboardCheck, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type Step = 'client_info' | 'checklist' | 'generating' | 'success' | 'error';

export default function App() {
  const [step, setStep] = useState<Step>('client_info');
  
  const [clientData, setClientData] = useState<ClientData>({
    clientName: '',
    clientEmail: '',
    propertyAddress: '',
    date: new Date().toISOString().split('T')[0],
    technicianName: ''
  });

  const [checklistData, setChecklistData] = useState<Record<number, ChecklistItemData>>({});
  const [errorMsg, setErrorMsg] = useState<string>('');

  const updateClientInfo = (field: keyof ClientData, value: string) => {
    setClientData(prev => ({ ...prev, [field]: value }));
  };

  const updateChecklistItem = (index: number, field: string, value: any) => {
    setChecklistData(prev => ({
      ...prev,
      [index]: {
        ...(prev[index] || { status: '', notes: '' }),
        [field]: value
      }
    }));
  };

  const handleStartChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.clientName || !clientData.clientEmail) return;
    setStep('checklist');
  };

  const handleComplete = async () => {
    // Validate that all items have a status
    for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
        const item = checklistData[i];
        if (!item || !item.status) {
            alert(`Please complete item #${i + 1}: ${CHECKLIST_ITEMS[i]}`);
            return;
        }
    }

    setStep('generating');
    try {
      const report: InspectionReport = {
        clientInfo: clientData,
        checklist: checklistData
      };
      
      await generateAndSendPDF(report);
      setStep('success');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An unknown error occurred');
      setStep('error');
    }
  };

  return (
    <div className="min-h-screen bg-offwhite text-forest pb-20 font-sans">
      <header className="h-20 bg-forest text-offwhite flex items-center px-4 md:px-8 shadow-md sticky top-0 z-10 w-full">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 4L3 14V28H12V20H20V28H29V14L16 4Z" fill="#0f7959"/>
                  <path d="M16 4L22 8.6V28H29V14L16 4Z" fill="#1db283"/>
                  <circle cx="10" cy="10" r="4" fill="#1db283"/>
                  <path d="M8 10L9.5 11.5L12 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-xl font-bold tracking-tight text-white leading-none">Wayside</span>
                <span className="text-[9px] tracking-[0.2em] text-[#1db283] font-bold leading-none mt-1">SERVICES</span>
              </div>
            </div>
          </div>
          {step !== 'client_info' && (
            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs opacity-70 uppercase font-semibold">Current Technician</p>
                <p className="text-sm font-medium text-amber">{clientData.technicianName || 'Technician'}</p>
              </div>
              <div className="h-10 w-[1px] bg-white/20"></div>
              <div className="flex flex-col items-center bg-pathway px-4 py-1 rounded shadow-inner">
                <span className="text-[10px] uppercase font-bold text-white/80">Progress</span>
                <span className="text-lg font-bold leading-none text-white">
                  {Math.round((Object.values(checklistData).filter(item => item && item.status).length / CHECKLIST_ITEMS.length) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        {step === 'client_info' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-white rounded-xl shadow-sm border border-pathway/20 p-1 md:p-3">
              <form onSubmit={handleStartChecklist} className="flex flex-col h-full">
                <CardHeader className="border-b border-pathway/10 pb-4 mb-4">
                  <CardTitle className="text-sm font-bold text-pathway uppercase tracking-wider">Client & Property Info</CardTitle>
                  <CardDescription className="text-[11px] leading-relaxed italic text-forest/70 mt-1">
                    Enter the property and client information to begin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="clientName" className="text-[10px] font-bold uppercase text-forest/50 block mb-1">Client Name *</Label>
                    <Input id="clientName" required value={clientData.clientName} onChange={(e) => updateClientInfo('clientName', e.target.value)} className="w-full bg-offwhite border-0 rounded p-2 text-sm focus-visible:ring-2 focus-visible:ring-pathway shadow-none h-auto" />
                  </div>
                  <div>
                    <Label htmlFor="clientEmail" className="text-[10px] font-bold uppercase text-forest/50 block mb-1">Client Email *</Label>
                    <Input id="clientEmail" type="email" required value={clientData.clientEmail} onChange={(e) => updateClientInfo('clientEmail', e.target.value)} className="w-full bg-offwhite border-0 rounded p-2 text-sm focus-visible:ring-2 focus-visible:ring-pathway shadow-none h-auto" />
                  </div>
                  <div>
                    <Label htmlFor="propertyAddress" className="text-[10px] font-bold uppercase text-forest/50 block mb-1">Property Address *</Label>
                    <Input id="propertyAddress" required value={clientData.propertyAddress} onChange={(e) => updateClientInfo('propertyAddress', e.target.value)} className="w-full bg-offwhite border-0 rounded p-2 text-sm focus-visible:ring-2 focus-visible:ring-pathway shadow-none h-auto" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date" className="text-[10px] font-bold uppercase text-forest/50 block mb-1">Date *</Label>
                      <Input id="date" type="date" required value={clientData.date} onChange={(e) => updateClientInfo('date', e.target.value)} className="w-full bg-offwhite border-0 rounded p-2 text-sm focus-visible:ring-2 focus-visible:ring-pathway shadow-none h-auto" />
                    </div>
                    <div>
                      <Label htmlFor="technicianName" className="text-[10px] font-bold uppercase text-forest/50 block mb-1">Technician *</Label>
                      <Input id="technicianName" required value={clientData.technicianName} onChange={(e) => updateClientInfo('technicianName', e.target.value)} className="w-full bg-offwhite border-0 rounded p-2 text-sm focus-visible:ring-2 focus-visible:ring-pathway shadow-none h-auto" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4">
                  <Button type="submit" className="w-full px-8 py-6 bg-pathway text-offwhite rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg shadow-pathway/30 hover:bg-forest transition-colors h-auto flex items-center gap-2">
                    Start Checklist <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {step === 'checklist' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-forest">
                  <span className="text-amber">10-Point</span> Vital Checklist
                </h2>
                <p className="text-forest/70 text-xs mt-1 font-medium">{clientData.clientName} &bull; {clientData.propertyAddress}</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold uppercase text-forest">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-pathway"></div> Pass</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber"></div> Attention</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-600"></div> Fail</span>
              </div>
            </div>

            <div className="space-y-4">
              {CHECKLIST_ITEMS.map((item, index) => {
                const data = checklistData[index] || { status: '', notes: '' };
                return (
                  <ChecklistItemCard
                    key={index}
                    itemTitle={`${index + 1}. ${item}`}
                    isSeasonalTask={index === 9}
                    status={data.status}
                    notes={data.notes}
                    photoUrl={data.photoUrl}
                    seasonalTaskName={data.seasonalTaskName}
                    onUpdate={(field, value) => updateChecklistItem(index, field, value)}
                  />
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-forest/10 flex justify-end">
              <Button 
                onClick={handleComplete}
                className="w-full sm:w-auto px-8 py-6 bg-pathway text-offwhite rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg shadow-pathway/30 hover:bg-forest transition-colors h-auto flex items-center justify-center gap-2"
              >
                <span>Complete Inspection</span>
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
            <Loader2 className="w-16 h-16 text-pathway animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-forest mb-2">Generating Report...</h2>
            <p className="text-slate-500 text-center max-w-xs">Connecting to Resend to dispatch the PDF report to the client.</p>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-pathway rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-forest mb-3">Inspection Complete</h2>
            <p className="text-slate-600 text-center max-w-sm mb-8 text-lg">
              The PDF report has been generated and emailed to <strong className="text-slate-900">{clientData.clientEmail}</strong>.
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setClientData({ ...clientData, clientName: '', clientEmail: '', propertyAddress: '' });
                setChecklistData({});
                setStep('client_info');
              }}
              className="h-12 px-6"
            >
              Start Another Inspection
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500 text-center">
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-forest mb-3">Failed to Send</h2>
            <p className="text-red-600 max-w-sm mb-4 font-mono text-sm bg-red-50 p-3 rounded border border-red-100">
              {errorMsg}
            </p>
            <p className="text-slate-500 mb-8 max-w-sm">Please ensure your RESEND_API_KEY is properly configured in the application secrets.</p>
            <Button 
              onClick={() => setStep('checklist')}
              className="h-12 px-6 bg-forest text-white"
            >
              Return to Checklist
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

