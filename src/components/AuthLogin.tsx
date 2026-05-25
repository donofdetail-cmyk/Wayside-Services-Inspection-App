import { useState, useEffect } from 'react';
import { Mail, Lock, User, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../d2d/supabaseClient';

export type PortalType = 'technician' | 'rep' | 'admin';

interface Props {
  onLogin: (session: any, profile: any, portal: PortalType) => void;
}

export function AuthLogin({ onLogin }: Props) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedPortal, setSelectedPortal] = useState<PortalType>('technician');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: selectedPortal,
            },
          },
        });
        
        if (signUpError) throw signUpError;
        
        if (data.session) {
          // Immediately fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user!.id)
            .single();
          if (profile.is_active === false) {
            await supabase.auth.signOut();
            throw new Error(`Your account has been deactivated. Please contact an administrator.`);
          }
          onLogin(data.session, profile, selectedPortal);
        } else {
          setError('Account created. Check your email to verify (if enabled), or try logging in.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        if (data.session) {
          // Fetch profile to verify role
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user!.id)
            .single();

          if (profileError) throw profileError;

          if (profile.is_active === false) {
            await supabase.auth.signOut();
            throw new Error(`Your account has been deactivated. Please contact an administrator.`);
          }

          if (profile.role !== selectedPortal && profile.role !== 'admin') {
            await supabase.auth.signOut();
            throw new Error(`Unauthorized. This portal requires ${selectedPortal} access.`);
          }

          onLogin(data.session, profile, selectedPortal);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 font-sans flex flex-col">
      <header className="h-20 bg-deep-forest text-linen-white flex items-center px-4 md:px-8 shadow-md w-full shrink-0">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
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
      </header>

      <main className="max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 flex-1">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto w-full mt-10 md:mt-20">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold text-deep-forest">{isSignUp ? 'Create Account' : 'Welcome to Wayside'}</h2>
                <p className="text-xs text-deep-forest/70 mt-1">{isSignUp ? 'Sign up to continue.' : 'Please sign in to access your portal.'}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Select Portal</label>
                <div className="relative">
                  <select
                    value={selectedPortal}
                    onChange={(e) => setSelectedPortal(e.target.value as PortalType)}
                    className="w-full pl-4 pr-10 py-3 appearance-none rounded-xl border border-deep-forest/10 text-deep-forest text-sm font-bold focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  >
                    <option value="technician">Technician Portal</option>
                    <option value="rep">Sales Rep Portal</option>
                    <option value="admin">Admin Dashboard</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/40 pointer-events-none" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold border border-red-100">
                  {error}
                </div>
              )}

              {isSignUp && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                    <input
                      required
                      placeholder="John Doe"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pathway-green text-white py-4 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSignUp ? 'Sign Up' : 'Log In'}
              </button>

              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                className="text-xs text-deep-forest/50 hover:text-deep-forest font-semibold"
              >
                {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
