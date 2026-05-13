import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { perf } from './services/perfSDK';
import './services/perfMonitor';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const webVitalsMap: Record<string, Parameters<typeof perf.record>[0]> = {
  LCP: 'web_vitals_lcp_ms',
  FCP: 'web_vitals_fcp_ms',
  TTFB: 'web_vitals_ttfb_ms',
  CLS: 'web_vitals_cls',
  INP: 'web_vitals_inp_ms',
};

reportWebVitals((metric) => {
  const mapped = webVitalsMap[metric.name];
  if (mapped) {
    perf.record(mapped, metric.value);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[WebVitals] ${metric.name}: ${metric.value.toFixed(1)}ms`);
  }
});
