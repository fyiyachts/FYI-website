import './index.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initAnalytics } from './utils/analytics';
import { initAttribution } from './utils/attribution';
import { initHubspotTracking } from './utils/hubspotTracking';

initAnalytics();
initAttribution();
initHubspotTracking();

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
// The /lp landing pages are prerendered from the very components the app
// renders first (components/lp/LpChrome LpShell), so React adopts that markup
// instead of replacing it: their hero H1 is the largest paint and must only
// paint once. Every other page's static shell is a stand-in, replaced on mount.
if (root.querySelector('[data-lp-shell]')) hydrateRoot(root, app);
else createRoot(root).render(app);
