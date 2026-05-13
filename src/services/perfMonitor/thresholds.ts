import { ThresholdConfig } from './types';

export const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
  { metric: 'compile_babel_ms', warn: 3000, critical: 5000, minSamples: 3 },
  { metric: 'compile_ts_ms', warn: 2000, critical: 4000, minSamples: 3 },
  { metric: 'compile_sass_ms', warn: 2000, minSamples: 2 },
  { metric: 'compile_less_ms', warn: 2000, minSamples: 2 },
  { metric: 'compile_vue_sfc_ms', warn: 2000, minSamples: 2 },
  { metric: 'preview_full_rebuild_ms', warn: 500, critical: 1000, minSamples: 3 },
  { metric: 'completion_total_ms', warn: 800, critical: 1500, minSamples: 3 },
  { metric: 'completion_ts_worker_ms', warn: 600, critical: 1200, minSamples: 3 },
  { metric: 'agent_run_ms', warn: 10000, critical: 20000 },
  { metric: 'web_vitals_inp_ms', warn: 200, critical: 500 },
];
