import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import D2DApp from './d2d/D2DApp.tsx';
import AdminApp from './admin/AdminApp.tsx';
import './index.css';

// Register the service worker for PWA offline capabilities
registerSW({ immediate: true });

// Simple pathname-based routing — no external router dependency needed
const path = window.location.pathname;
const isD2D = path.startsWith('/d2d');
const isAdmin = path.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <AdminApp /> : isD2D ? <D2DApp /> : <App />}
  </StrictMode>,
);
