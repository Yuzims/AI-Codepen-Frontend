type MetricName =
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

interface MetricEntry {
  value: number;
  timestamp: number;
}

class PerfSDK {
  private metrics = new Map<MetricName, MetricEntry[]>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 10_000;

  record(name: MetricName, value: number): void {
    if (!this.metrics.has(name)) this.metrics.set(name, []);
    this.metrics.get(name)!.push({ value, timestamp: Date.now() });
    this.scheduleFlush();
  }

  measure<T>(name: MetricName, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    this.record(name, performance.now() - start);
    return result;
  }

  async measureAsync<T>(name: MetricName, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    this.record(name, performance.now() - start);
    return result;
  }

  getSummary(name: MetricName): { count: number; avg: number; p95: number; max: number } | null {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) return null;
    const values = entries.map(e => e.value).sort((a, b) => a - b);
    return {
      count: values.length,
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      p95: values[Math.floor(values.length * 0.95)],
      max: values[values.length - 1],
    };
  }

  getAllSummaries() {
    const result: Record<string, ReturnType<PerfSDK['getSummary']>> = {};
    for (const [name] of Array.from(this.metrics)) {
      result[name] = this.getSummary(name);
    }
    return result;
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, this.FLUSH_INTERVAL);
  }

  private async flush() {
    const summaries = this.getAllSummaries();
    if (Object.keys(summaries).length === 0) return;
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: summaries, userAgent: navigator.userAgent }),
        keepalive: true,
      });
    } catch {
      // 上报失败静默处理，不影响主流程
    }
    this.metrics.clear();
  }
  /** 仅供测试使用：清空所有已记录指标和待发定时器 */
  _reset(): void {
    this.metrics.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export const perf = new PerfSDK();

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__perf = perf;
}
