import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import D2DApp from './d2d/D2DApp.tsx';
import './index.css';

// Register the service worker for PWA offline capabilities
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/d2d" element={<D2DApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
