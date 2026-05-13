import React from 'react';
import { Alert } from '../../services/perfMonitor';

interface AlertHistoryProps {
  alerts: Alert[];
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return <div style={styles.empty}>暂无告警</div>;
  }

  return (
    <div style={styles.container}>
      {alerts.slice().reverse().map(alert => (
        <div key={alert.id} style={styles.item}>
          <span style={alert.level === 'critical' ? styles.critical : styles.warn}>
            {alert.level === 'critical' ? '●' : '▲'}
          </span>
          <span style={styles.metric}>{alert.metric}</span>
          <span style={styles.value}>{alert.value.toFixed(0)}ms</span>
          <span style={styles.time}>{formatTime(alert.timestamp)}</span>
        </div>
      ))}
    </div>
  );
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' },
  empty: { color: '#6a737d', fontSize: 11, textAlign: 'center', padding: 16 },
  item: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f0f0f0' },
  critical: { color: '#d73a49', fontWeight: 'bold' },
  warn: { color: '#e36209', fontWeight: 'bold' },
  metric: { flex: 1, color: '#24292e', fontFamily: 'monospace', fontSize: 10 },
  value: { color: '#586069', fontFamily: 'monospace', fontSize: 10 },
  time: { color: '#959da5', fontFamily: 'monospace', fontSize: 10 },
};

export default AlertHistory;
