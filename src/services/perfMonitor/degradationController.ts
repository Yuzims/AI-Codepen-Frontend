import { perfMonitor } from './perfMonitor';
import { DegradationLevel, DegradationState, DegradationStrategy, PerfEvent, Alert } from './types';

const DEGRADED_ALERT_COUNT = 2;
const SEVERE_CRITICAL_COUNT = 3;
const ALERT_WINDOW_MS = 30_000;
const RECOVERY_NORMAL_MS = 30_000;
const RECOVERY_DEGRADED_MS = 20_000;
const MIN_HOLD_MS = 10_000;

const STRATEGIES_BY_LEVEL: Record<DegradationLevel, DegradationStrategy[]> = {
  normal: [],
  degraded: ['increased_debounce', 'skip_lint'],
  severely_degraded: ['increased_debounce', 'skip_lint', 'disable_ts_completions', 'suggest_simplified'],
};

class DegradationController {
  private state: DegradationState = {
    level: 'normal',
    activeStrategies: [],
    since: Date.now(),
  };
  private lastAlertTime = 0;
  private recentAlerts: Alert[] = [];
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    perfMonitor.subscribe((event) => this.onEvent(event));
    this.startRecoveryCheck();
  }

  private onEvent(event: PerfEvent) {
    if (event.type !== 'alert') return;
    this.lastAlertTime = Date.now();
    this.recentAlerts.push(event.alert);
    this.evaluate();
  }

  private evaluate() {
    const cutoff = Date.now() - ALERT_WINDOW_MS;
    this.recentAlerts = this.recentAlerts.filter(a => a.timestamp >= cutoff);

    const criticalCount = this.recentAlerts.filter(a => a.level === 'critical').length;
    const totalCount = this.recentAlerts.length;

    let newLevel: DegradationLevel = this.state.level;

    if (criticalCount >= SEVERE_CRITICAL_COUNT) {
      newLevel = 'severely_degraded';
    } else if (totalCount >= DEGRADED_ALERT_COUNT) {
      newLevel = this.state.level === 'severely_degraded' ? 'severely_degraded' : 'degraded';
    }

    if (newLevel !== this.state.level) {
      this.transition(newLevel);
    }
  }

  private startRecoveryCheck() {
    this.recoveryTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastAlertTime;
      const holdTime = Date.now() - this.state.since;

      if (holdTime < MIN_HOLD_MS) return;

      if (this.state.level === 'severely_degraded' && elapsed >= RECOVERY_DEGRADED_MS) {
        this.transition('degraded');
      } else if (this.state.level === 'degraded' && elapsed >= RECOVERY_NORMAL_MS) {
        this.transition('normal');
      }
    }, 5_000);
  }

  private transition(level: DegradationLevel) {
    this.state = {
      level,
      activeStrategies: STRATEGIES_BY_LEVEL[level],
      since: Date.now(),
    };
    perfMonitor.emit({ type: 'degradation_change', state: this.state });

    if (process.env.NODE_ENV === 'development') {
      const icons: Record<DegradationLevel, string> = {
        normal: '🟢', degraded: '🟡', severely_degraded: '🔴'
      };
      console.log(`${icons[level]} [Degradation] Level: ${level}`, this.state.activeStrategies);
    }
  }

  getState(): DegradationState {
    return this.state;
  }

  isStrategyActive(strategy: DegradationStrategy): boolean {
    return this.state.activeStrategies.includes(strategy);
  }

  _reset() {
    this.state = { level: 'normal', activeStrategies: [], since: Date.now() };
    this.lastAlertTime = 0;
  }

  _destroy() {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }
}

export const degradationController = new DegradationController();
export { DegradationController };
