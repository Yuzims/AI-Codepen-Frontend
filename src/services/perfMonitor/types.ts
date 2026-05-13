export type MetricName =
  | 'compile_babel_ms'
  | 'compile_ts_ms'
  | 'compile_sass_ms'
  | 'compile_less_ms'
  | 'compile_vue_sfc_ms'
  | 'preview_full_rebuild_ms'
  | 'preview_incremental_update_ms'
  | 'completion_snippet_ms'
  | 'completion_ts_worker_ms'
  | 'completion_total_ms'
  | 'sse_ttfb_ms'
  | 'sse_render_lag_ms'
  | 'sse_total_ms'
  | 'web_vitals_lcp_ms'
  | 'web_vitals_fcp_ms'
  | 'web_vitals_ttfb_ms'
  | 'web_vitals_cls'
  | 'web_vitals_inp_ms'
  | 'agent_plan_ms'
  | 'agent_run_ms'
  | 'agent_patch_apply_ms'
  | 'agent_rollback_ms';

export interface MetricSample {
  value: number;
  timestamp: number;
}

export interface RollingStats {
  count: number;
  avg: number;
  p95: number;
  max: number;
  recent: MetricSample[];
}

export interface ThresholdConfig {
  metric: MetricName;
  warn: number;
  critical?: number;
  window?: number;
  minSamples?: number;
}

export interface Alert {
  id: string;
  metric: MetricName;
  level: 'warn' | 'critical';
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

export type DegradationLevel = 'normal' | 'degraded' | 'severely_degraded';

export type DegradationStrategy =
  | 'increased_debounce'
  | 'skip_lint'
  | 'disable_ts_completions'
  | 'suggest_simplified';

export interface DegradationState {
  level: DegradationLevel;
  activeStrategies: DegradationStrategy[];
  since: number;
}

export type PerfEvent =
  | { type: 'sample'; metric: MetricName; value: number }
  | { type: 'alert'; alert: Alert }
  | { type: 'degradation_change'; state: DegradationState };

export type PerfEventListener = (event: PerfEvent) => void;
