import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initAnalytics } from './utils/analytics';
import { initAttribution } from './utils/attribution';
import { initHubspotTracking } from './utils/hubspotTracking';

initAnalytics();
initAttribution();
initHubspotTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
