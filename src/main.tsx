import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import D2DApp from './d2d/D2DApp.tsx';
import './index.css';

// Register the service worker for PWA offline capabilities
registerSW({ immediate: true });

// Simple pathname-based routing — no external router dependency needed
const isD2D = window.location.pathname.startsWith('/d2d');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isD2D ? <D2DApp /> : <App />}
  </StrictMode>,
);
