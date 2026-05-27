import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import D2DApp from './d2d/D2DApp.tsx';
import AdminApp from './admin/AdminApp.tsx';
import CustomerPortal from './portal/CustomerPortal.tsx';
import WebReport from './portal/WebReport.tsx';
import './index.css';

import { useEffect, useState } from 'react';
import { AuthLogin, PortalType } from './components/AuthLogin';
import { supabase } from './d2d/supabaseClient';
import { Loader2 } from 'lucide-react';

// Register the service worker for PWA offline capabilities
registerSW({ immediate: true });

function RootApp() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [portal, setPortal] = useState<PortalType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single()
          .then(({ data: p }) => {
            if (p) {
              setSession(data.session);
              setProfile(p);
              // Infer portal based on last saved or default role if they just refreshed
              const savedPortal = localStorage.getItem('wayside_last_portal') as PortalType;
              setPortal(savedPortal || p.role);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setPortal(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Check if it's the customer portal (no auth required)
  if (window.location.pathname.startsWith('/portal')) {
    return <CustomerPortal />;
  }

  if (window.location.pathname.startsWith('/report/')) {
    const reportId = window.location.pathname.split('/')[2];
    return <WebReport reportId={reportId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linen-white flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pathway-green" />
      </div>
    );
  }

  if (!session || !profile || !portal) {
    return (
      <AuthLogin
        onLogin={(s, p, pt) => {
          setSession(s);
          setProfile(p);
          setPortal(pt);
          localStorage.setItem('wayside_last_portal', pt);
        }}
      />
    );
  }

  if (portal === 'admin' || portal === 'owner') return <AdminApp session={session} profile={profile} />;
  if (portal === 'rep') return <D2DApp session={session} profile={profile} />;
  return <App session={session} profile={profile} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
