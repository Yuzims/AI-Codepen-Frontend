import React, { useState, useEffect, useCallback } from 'react';
import { perfMonitor, alertEngine, DegradationState, RollingStats, MetricName, Alert } from '../../services/perfMonitor';
import { DEFAULT_THRESHOLDS } from '../../services/perfMonitor/thresholds';
import { useDegradation } from '../../hooks/useDegradation';
import SparklineChart from './SparklineChart';
import AlertHistory from './AlertHistory';
import DegradationStatus from './DegradationStatus';

type Tab = 'metrics' | 'alerts' | 'degradation';

const METRIC_GROUPS: { label: string; metrics: MetricName[] }[] = [
  { label: '编译', metrics: ['compile_babel_ms', 'compile_ts_ms', 'compile_sass_ms', 'compile_less_ms', 'compile_vue_sfc_ms'] },
  { label: '预览', metrics: ['preview_full_rebuild_ms', 'preview_incremental_update_ms'] },
  { label: '补全', metrics: ['completion_snippet_ms', 'completion_ts_worker_ms', 'completion_total_ms'] },
  { label: 'SSE', metrics: ['sse_ttfb_ms', 'sse_render_lag_ms', 'sse_total_ms'] },
  { label: 'Agent', metrics: ['agent_plan_ms', 'agent_run_ms', 'agent_patch_apply_ms', 'agent_rollback_ms'] },
  { label: 'Web Vitals', metrics: ['web_vitals_lcp_ms', 'web_vitals_fcp_ms', 'web_vitals_ttfb_ms', 'web_vitals_cls', 'web_vitals_inp_ms'] },
];

function getThreshold(metric: MetricName): number | undefined {
  return DEFAULT_THRESHOLDS.find(t => t.metric === metric)?.warn;
}

const PerfPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('metrics');
  const [stats, setStats] = useState<Partial<Record<MetricName, RollingStats>>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const degradation = useDegradation();

  const refresh = useCallback(() => {
    setStats(perfMonitor.getAllStats());
    setAlerts(alertEngine.getHistory());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    return perfMonitor.subscribe((event) => {
      if (event.type === 'alert') {
        setAlerts(alertEngine.getHistory());
      }
    });
  }, []);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Perf Monitor</span>
        <div style={styles.tabs}>
          {(['metrics', 'alerts', 'degradation'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={t === tab ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            >
              {t === 'metrics' ? '指标' : t === 'alerts' ? `告警(${alerts.length})` : '降级'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.body}>
        {tab === 'metrics' && (
          <div style={styles.metricsContainer}>
            {METRIC_GROUPS.map(group => {
              const activeMetrics = group.metrics.filter(m => stats[m]);
              if (activeMetrics.length === 0) return null;
              return (
                <div key={group.label} style={styles.group}>
                  <div style={styles.groupLabel}>{group.label}</div>
                  {activeMetrics.map(metric => {
                    const s = stats[metric]!;
                    const threshold = getThreshold(metric);
                    const isOver = threshold ? s.p95 > threshold : false;
                    return (
                      <div key={metric} style={styles.metricRow}>
                        <div style={styles.metricInfo}>
                          <span style={{ ...styles.metricName, color: isOver ? '#d73a49' : '#24292e' }}>
                            {metric.replace(/_ms$/, '')}
                          </span>
                          <span style={styles.metricStats}>
                            avg:{s.avg.toFixed(0)} p95:{s.p95.toFixed(0)} n:{s.count}
                          </span>
                        </div>
                        <SparklineChart
                          data={s.recent.map(r => r.value)}
                          width={100}
                          height={24}
                          color={isOver ? '#d73a49' : '#0366d6'}
                          threshold={threshold}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {Object.keys(stats).length === 0 && (
              <div style={styles.empty}>暂无指标数据，操作编辑器后将自动采集</div>
            )}
          </div>
        )}

        {tab === 'alerts' && <AlertHistory alerts={alerts} />}
        {tab === 'degradation' && <DegradationStatus state={degradation} />}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    width: 340,
    maxHeight: 420,
    background: '#fff',
    border: '1px solid #d1d5da',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    fontSize: 12,
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e1e4e8',
    background: '#f6f8fa',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontWeight: 600, fontSize: 12, color: '#24292e' },
  tabs: { display: 'flex', gap: 2 },
  tab: {
    padding: '3px 8px',
    border: 'none',
    background: 'transparent',
    borderRadius: 3,
    fontSize: 11,
    cursor: 'pointer',
    color: '#586069',
  },
  tabActive: { background: '#0366d6', color: '#fff' },
  body: { padding: 12, overflowY: 'auto', flex: 1, maxHeight: 350 },
  metricsContainer: { display: 'flex', flexDirection: 'column', gap: 12 },
  group: { display: 'flex', flexDirection: 'column', gap: 4 },
  groupLabel: { fontSize: 10, fontWeight: 600, color: '#6a737d', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 0' },
  metricInfo: { display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 },
  metricName: { fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  metricStats: { fontSize: 9, color: '#959da5', fontFamily: 'monospace' },
  empty: { color: '#6a737d', fontSize: 11, textAlign: 'center', padding: 24 },
};

export default PerfPanel;
