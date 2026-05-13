import { perfMonitor } from './perfMonitor';
import { MetricName, Alert, ThresholdConfig, PerfEvent } from './types';
import { DEFAULT_THRESHOLDS } from './thresholds';

const COOLDOWN_MS = 10_000;
const MAX_HISTORY = 50;

class AlertEngine {
  private thresholds: ThresholdConfig[];
  private lastAlertTime = new Map<MetricName, number>();
  private history: Alert[] = [];
  private idCounter = 0;

  constructor(thresholds: ThresholdConfig[] = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
    perfMonitor.subscribe((event) => this.onEvent(event));
  }

  private onEvent(event: PerfEvent) {
    if (event.type !== 'sample') return;
    this.check(event.metric);
  }

  private check(metric: MetricName) {
    const config = this.thresholds.find(t => t.metric === metric);
    if (!config) return;

    const stats = perfMonitor.getStats(metric);
    if (!stats) return;

    const minSamples = config.minSamples ?? 3;
    if (stats.count < minSamples) return;

    const now = Date.now();
    const lastTime = this.lastAlertTime.get(metric) ?? 0;
    if (now - lastTime < COOLDOWN_MS) return;

    let alert: Alert | null = null;

    if (config.critical && stats.p95 >= config.critical) {
      alert = this.createAlert(metric, 'critical', stats.p95, config.critical);
    } else if (stats.p95 >= config.warn) {
      alert = this.createAlert(metric, 'warn', stats.p95, config.warn);
    }

    if (alert) {
      this.lastAlertTime.set(metric, now);
      this.history.push(alert);
      if (this.history.length > MAX_HISTORY) {
        this.history.shift();
      }

      if (process.env.NODE_ENV === 'development') {
        const prefix = alert.level === 'critical' ? '🔴' : '🟡';
        console.warn(`${prefix} [PerfAlert] ${alert.metric}: p95=${alert.value.toFixed(1)}ms (threshold: ${alert.threshold}ms)`);
      }

      perfMonitor.emit({ type: 'alert', alert });
    }
  }

  private createAlert(metric: MetricName, level: 'warn' | 'critical', value: number, threshold: number): Alert {
    return {
      id: `alert_${++this.idCounter}`,
      metric,
      level,
      value,
      threshold,
      timestamp: Date.now(),
      message: `${metric} p95 (${value.toFixed(1)}ms) exceeds ${level} threshold (${threshold}ms)`,
    };
  }

  getHistory(): Alert[] {
    return this.history;
  }

  getRecentAlerts(windowMs: number = 30_000): Alert[] {
    const cutoff = Date.now() - windowMs;
    return this.history.filter(a => a.timestamp >= cutoff);
  }

  _reset() {
    this.history = [];
    this.lastAlertTime.clear();
    this.idCounter = 0;
  }
}

export const alertEngine = new AlertEngine();
export { AlertEngine };
