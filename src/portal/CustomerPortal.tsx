import { useState, useEffect } from 'react';
import { supabase } from '../d2d/supabaseClient';
import { Toaster, toast } from 'sonner';
import { Loader2, Mail, FileText, CheckCircle2, LogOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CustomerPortal() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  
  const [session, setSession] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchInspections();
    }
  }, [session]);

  const fetchInspections = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load your reports.');
    } else {
      setInspections(data || []);
    }
    setLoadingData(false);
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // We use OTP with Email Link (Magic Link)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/portal'
      }
    });

    if (error) {
      toast.error(error.message);
    } else {
      setOtpSent(true);
      toast.success('Secure login link sent to your email!');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setInspections([]);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-linen-white text-deep-forest font-sans flex flex-col items-center justify-center p-4">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-deep-forest/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center mb-8">
            <svg viewBox="0 0 48 48" className="w-12 h-12 mb-4 drop-shadow-[0_0_10px_rgba(29,158,117,0.3)]" fill="none">
              <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
              <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
              <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
              <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-2xl font-bold text-deep-forest tracking-tight">Wayside Customer Portal</h1>
            <p className="text-deep-forest/60 text-sm mt-1 text-center">Securely view your past inspection reports.</p>
          </div>

          {!otpSent ? (
            <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-deep-forest/40" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-deep-forest/10 text-deep-forest focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50 font-medium"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-pathway-green hover:brightness-110 text-white font-bold h-12 rounded-xl shadow-lg shadow-pathway-green/20">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Secure Login Link'}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center p-6 bg-pathway-green/5 border border-pathway-green/20 rounded-2xl">
              <div className="w-12 h-12 bg-pathway-green text-white rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-deep-forest text-lg mb-2">Check your email</h3>
              <p className="text-sm text-deep-forest/70 mb-4">
                We sent a secure login link to <strong className="text-deep-forest">{email}</strong>. Click the link in the email to instantly sign in.
              </p>
              <Button variant="ghost" onClick={() => setOtpSent(false)} className="text-sm font-bold text-deep-forest/60 hover:text-deep-forest">
                Use a different email
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest font-sans flex flex-col">
      <Toaster position="top-center" richColors />
      <header className="bg-deep-forest text-white shadow-lg p-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" className="w-8 h-8 drop-shadow-[0_0_10px_rgba(29,158,117,0.3)]" fill="none">
              <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
              <path d="M4 24L24 6L44 24" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
              <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" strokeWidth="2.5"/>
              <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-bold text-lg tracking-tight">Customer Portal</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-white hover:bg-white/10 px-3 py-1.5 h-auto rounded-lg text-sm font-bold flex gap-2 items-center">
            <LogOut className="w-4 h-4 opacity-70" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <h2 className="text-3xl font-bold tracking-tight">Your Service History</h2>
          <p className="text-deep-forest/60 mt-1">Logged in as {session.user.email}</p>
        </div>

        {loadingData ? (
          <div className="py-20 flex flex-col items-center justify-center text-deep-forest/40">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-pathway-green" />
            <span className="text-sm font-bold uppercase tracking-wider">Loading Reports...</span>
          </div>
        ) : inspections.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl border border-deep-forest/5 p-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="w-16 h-16 bg-linen-white rounded-full flex items-center justify-center mx-auto mb-4 border border-deep-forest/10">
              <FileText className="w-8 h-8 text-deep-forest/30" />
            </div>
            <h3 className="text-xl font-bold text-deep-forest mb-2">No Reports Found</h3>
            <p className="text-deep-forest/60 max-w-md mx-auto">
              We couldn't find any completed inspections associated with this email address. 
              If you believe this is a mistake, please verify the email you provided to your technician.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            {inspections.map((insp) => (
              <div key={insp.id} className="bg-white rounded-2xl shadow-md border border-deep-forest/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-pathway-green/30 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-pathway-green/10 text-pathway-green flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-deep-forest">{insp.property_address}</h4>
                    <p className="text-sm text-deep-forest/60 mb-2">
                      Inspection on {new Date(insp.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pathway-green/10 text-pathway-green text-[10px] font-bold uppercase tracking-wide">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  </div>
                </div>
                
                {insp.pdf_url ? (
                  <a 
                    href={insp.pdf_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full md:w-auto bg-linen-white hover:bg-pathway-green hover:text-white border border-deep-forest/10 text-deep-forest font-bold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF Report
                  </a>
                ) : (
                  <div className="text-xs font-bold text-deep-forest/40 uppercase tracking-wider px-4 py-3 bg-linen-white rounded-xl border border-deep-forest/5 text-center">
                    PDF Not Available
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
