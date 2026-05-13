import { perf } from '../perfSDK';
import { MetricName, MetricSample, RollingStats, PerfEvent, PerfEventListener } from './types';

const WINDOW_MS = 60_000;
const MAX_SAMPLES_PER_METRIC = 200;

class PerfMonitor {
  private samples = new Map<MetricName, MetricSample[]>();
  private listeners: PerfEventListener[] = [];
  private installed = false;

  constructor() {
    this.install();
  }

  private install() {
    if (this.installed) return;
    this.installed = true;

    const originalRecord = perf.record.bind(perf);
    perf.record = (name: MetricName, value: number) => {
      originalRecord(name, value);
      this.onSample(name, value);
    };
  }

  private onSample(metric: MetricName, value: number) {
    const sample: MetricSample = { value, timestamp: Date.now() };

    if (!this.samples.has(metric)) {
      this.samples.set(metric, []);
    }
    const arr = this.samples.get(metric)!;
    arr.push(sample);

    if (arr.length > MAX_SAMPLES_PER_METRIC) {
      arr.splice(0, arr.length - MAX_SAMPLES_PER_METRIC);
    }

    this.evictOld(arr);
    this.emit({ type: 'sample', metric, value });
  }

  private evictOld(arr: MetricSample[]) {
    const cutoff = Date.now() - WINDOW_MS;
    while (arr.length > 0 && arr[0].timestamp < cutoff) {
      arr.shift();
    }
  }

  getStats(metric: MetricName): RollingStats | null {
    const arr = this.samples.get(metric);
    if (!arr || arr.length === 0) return null;

    this.evictOld(arr);
    if (arr.length === 0) return null;

    const values = arr.map(s => s.value).sort((a, b) => a - b);
    return {
      count: values.length,
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      p95: values[Math.floor(values.length * 0.95)],
      max: values[values.length - 1],
      recent: arr.slice(-60),
    };
  }

  getAllStats(): Partial<Record<MetricName, RollingStats>> {
    const result: Partial<Record<MetricName, RollingStats>> = {};
    for (const [metric] of this.samples) {
      const stats = this.getStats(metric);
      if (stats) result[metric] = stats;
    }
    return result;
  }

  subscribe(listener: PerfEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  emit(event: PerfEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  _reset() {
    this.samples.clear();
    this.listeners = [];
  }
}

export const perfMonitor = new PerfMonitor();
export { PerfMonitor };
