import React, { useEffect, useState } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { Loader2, CheckCircle2, AlertCircle, FileText, Camera } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function WebReport({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      try {
        const { data, error } = await supabase
          .from('inspections')
          .select('*, technician:profiles!technician_id(full_name)')
          .eq('id', reportId)
          .single();

        if (error || !data) {
          throw new Error('Report not found or unavailable.');
        }

        setReport(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linen-white flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pathway-green" />
        <p className="mt-4 font-bold text-deep-forest uppercase tracking-wider text-sm">Loading Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-linen-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-deep-forest mb-2">Report Not Found</h2>
        <p className="text-deep-forest/60">{error}</p>
      </div>
    );
  }

  const checklistValues = Object.values(report.checklist_data) as any[];

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest font-sans">
      <header className="bg-deep-forest text-linen-white py-6 px-6 sm:px-10 shadow-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <Logo />
          <div className="text-left sm:text-right">
            <h1 className="font-black text-xl tracking-tight text-white">Inspection Report</h1>
            <p className="text-sm font-bold text-pathway-green uppercase tracking-wider mt-1">{new Date(report.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-10 flex flex-col gap-8">
        
        {/* Summary Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 sm:p-8 flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <h2 className="text-[10px] font-black uppercase text-deep-forest/40 tracking-widest mb-1">Customer</h2>
            <p className="font-bold text-lg text-deep-forest">{report.client_name}</p>
            <p className="text-sm text-deep-forest/60">{report.property_address}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase text-deep-forest/40 tracking-widest mb-1">Inspector</h2>
            <p className="font-bold text-lg text-deep-forest">{report.technician?.full_name || 'Wayside Technician'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-pathway-green/10 flex items-center justify-center text-pathway-green">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase text-deep-forest/40 tracking-widest mb-1">Status</h2>
              <p className="font-bold text-lg text-deep-forest">Completed</p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <h2 className="text-xl font-black text-deep-forest mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-porch" /> Full Inspection Details
          </h2>
          <div className="flex flex-col gap-4">
            {checklistValues.map((item: any, idx: number) => {
              if (!item.status) return null;
              
              const isGood = item.status === 'Good';
              const isAttention = item.status === 'Attention';
              
              return (
                <div key={idx} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${isAttention ? 'border-amber-porch/50 bg-amber-porch/5' : 'border-deep-forest/10'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isGood ? 'bg-pathway-green/10 text-pathway-green' : isAttention ? 'bg-amber-porch text-white' : 'bg-deep-forest/10 text-deep-forest'}`}>
                          {item.status}
                        </span>
                        <h3 className="font-bold text-deep-forest">{item.title || `Item #${idx + 1}`}</h3>
                      </div>
                      
                      {item.notes && (
                        <p className="text-sm text-deep-forest/80 italic mt-3 bg-white/50 p-3 rounded-xl border border-deep-forest/5">"{item.notes}"</p>
                      )}

                      {/* Rooms */}
                      {item.rooms && item.rooms.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2">
                          {item.rooms.map((room: any, rIdx: number) => (
                            <div key={rIdx} className="bg-linen-white/50 rounded-lg p-3 text-sm">
                              <span className="font-bold text-deep-forest text-xs uppercase">{room.name || 'Room'}</span>
                              {room.notes && <p className="text-deep-forest/70 mt-1">{room.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Photos */}
                    {item.photoUrls && item.photoUrls.length > 0 && (
                      <div className="shrink-0 sm:w-48 grid grid-cols-2 gap-2">
                        {item.photoUrls.map((url: string, pIdx: number) => (
                          <div key={pIdx} className="relative aspect-square rounded-lg overflow-hidden border border-deep-forest/10 shadow-sm group">
                            <img src={url} alt="Inspection proof" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                              <Camera className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signatures */}
        {(report.client_signature || report.technician_signature) && (
          <div className="bg-white rounded-2xl shadow-xl border border-deep-forest/5 p-6 sm:p-8 mt-4">
            <h2 className="text-xl font-black text-deep-forest mb-6">Authorization Signatures</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {report.client_signature && (
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 border-b-2 border-deep-forest/20 relative flex items-end justify-center mb-2">
                    <img src={report.client_signature} alt="Client Signature" className="h-full object-contain mix-blend-multiply" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-deep-forest/40 tracking-widest">Client Signature</span>
                </div>
              )}
              {report.technician_signature && (
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 border-b-2 border-deep-forest/20 relative flex items-end justify-center mb-2">
                    <img src={report.technician_signature} alt="Technician Signature" className="h-full object-contain mix-blend-multiply" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-deep-forest/40 tracking-widest">Technician Signature</span>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <footer className="bg-deep-forest py-8 text-center text-linen-white/40 text-xs font-bold uppercase tracking-wider">
        &copy; {new Date().getFullYear()} Wayside Services. All rights reserved.
      </footer>
    </div>
  );
}
