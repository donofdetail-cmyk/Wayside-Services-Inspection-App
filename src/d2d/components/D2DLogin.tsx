import { useState } from 'react';
import { Lock, User } from 'lucide-react';

interface Props {
  onLogin: (repName: string) => void;
}

export function D2DLogin({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = import.meta.env.VITE_D2D_PIN || '1357';
    if (pin === correctPin) {
      localStorage.setItem('d2d_rep_name', name);
      onLogin(name);
    } else {
      setError('Invalid PIN. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-linen-white text-deep-forest pb-20 font-sans flex flex-col">
      {/* Header — identical to inspection app */}
      <header className="h-20 bg-deep-forest text-linen-white flex items-center px-4 md:px-8 shadow-md w-full">
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
              <span className="font-bold text-[9px] text-pathway-green tracking-[0.25em] uppercase">D2D Sales</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 flex-1">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto w-full mt-10 md:mt-20">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold text-deep-forest">Sales Rep Login</h2>
                <p className="text-xs text-deep-forest/70 mt-1">Enter your name and D2D PIN to begin your shift.</p>
              </div>

              {error && <p className="text-red-500 text-xs font-bold -mb-2">{error}</p>}

              <div>
                <label htmlFor="d2d-rep-name" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">
                  Your Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                  <input
                    id="d2d-rep-name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="d2d-pin" className="text-[10px] font-bold uppercase text-deep-forest/50 block mb-1.5">
                  D2D PIN *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
                  <input
                    id="d2d-pin"
                    type="password"
                    required
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 text-deep-forest text-sm focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all bg-linen-white/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-pathway-green text-white py-4 rounded-xl font-bold text-[15px] hover:brightness-110 transition-all shadow-lg shadow-pathway-green/20 mt-2"
              >
                Start My Shift
              </button>
            </form>
          </div>

          <p className="text-center mt-5 text-deep-forest/40 text-xs">
            Looking for inspections?{' '}
            <a href="/" className="text-pathway-green hover:underline font-semibold">
              Switch to Inspection App
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
