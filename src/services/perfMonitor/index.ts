export { perfMonitor } from './perfMonitor';
export { alertEngine } from './alertEngine';
export { degradationController } from './degradationController';
export { DEFAULT_THRESHOLDS } from './thresholds';
export type {
  MetricName,
  MetricSample,
  RollingStats,
  ThresholdConfig,
  Alert,
  DegradationLevel,
  DegradationStrategy,
  DegradationState,
  PerfEvent,
  PerfEventListener,
} from './types';

import { perfMonitor } from './perfMonitor';
import { alertEngine } from './alertEngine';
import { degradationController } from './degradationController';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__perfMonitor = perfMonitor;
  (window as any).__alertEngine = alertEngine;
  (window as any).__degradation = degradationController;
}
