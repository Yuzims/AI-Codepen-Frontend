import React from 'react';
import { DegradationState } from '../../services/perfMonitor';

interface DegradationStatusProps {
  state: DegradationState;
}

const LEVEL_CONFIG = {
  normal: { label: '正常', color: '#28a745', bg: '#dcffe4' },
  degraded: { label: '已降级', color: '#e36209', bg: '#fff8e1' },
  severely_degraded: { label: '严重降级', color: '#d73a49', bg: '#ffeef0' },
};

const STRATEGY_LABELS: Record<string, string> = {
  increased_debounce: '防抖延长至 800ms',
  skip_lint: '跳过实时 Lint',
  disable_ts_completions: '禁用 TS 语义补全',
  suggest_simplified: '建议简化模式',
};

const DegradationStatus: React.FC<DegradationStatusProps> = ({ state }) => {
  const config = LEVEL_CONFIG[state.level];
  const elapsed = Math.round((Date.now() - state.since) / 1000);

  return (
    <div style={styles.container}>
      <div style={{ ...styles.badge, background: config.bg, color: config.color }}>
        {config.label}
      </div>
      {state.level !== 'normal' && (
        <>
          <div style={styles.duration}>持续 {elapsed}s</div>
          <div style={styles.strategies}>
            {state.activeStrategies.map(s => (
              <div key={s} style={styles.strategy}>
                {STRATEGY_LABELS[s] || s}
              </div>
            ))}
          </div>
        </>
      )}
      {state.level === 'normal' && (
        <div style={styles.hint}>所有指标正常，无降级策略激活</div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 8 },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, alignSelf: 'flex-start' },
  duration: { fontSize: 11, color: '#586069' },
  strategies: { display: 'flex', flexDirection: 'column', gap: 4 },
  strategy: { fontSize: 11, color: '#24292e', padding: '3px 8px', background: '#f6f8fa', borderRadius: 3, border: '1px solid #e1e4e8' },
  hint: { fontSize: 11, color: '#6a737d' },
};

export default DegradationStatus;
