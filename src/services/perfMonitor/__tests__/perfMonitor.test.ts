/**
 * perfMonitor 闭环系统测试
 * 运行方式：cd FeiShu-Codepen-Frontend && npx react-scripts test --testPathPattern="perfMonitor" --watchAll=false
 */

import { perf } from '../../perfSDK';

// 需要在 perfMonitor 之前 import perf，确保 monkey-patch 生效
import { perfMonitor } from '../perfMonitor';
import { AlertEngine } from '../alertEngine';
import { DegradationController } from '../degradationController';
import { ThresholdConfig, PerfEvent, Alert } from '../types';

// ---- performance.now mock ----
let nowValue = 0;
beforeAll(() => {
  Object.defineProperty(global, 'performance', {
    configurable: true,
    writable: true,
    value: { now: () => ++nowValue },
  });
});

beforeEach(() => {
  nowValue = 0;
  perfMonitor._reset();
  (perf as any)._reset();
});

// ─────────────────────────────────────────────
// PerfMonitor 核心
// ─────────────────────────────────────────────

describe('PerfMonitor', () => {
  it('拦截 perf.record 并保留样本', () => {
    perf.record('compile_babel_ms', 100);
    perf.record('compile_babel_ms', 200);

    const stats = perfMonitor.getStats('compile_babel_ms');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(2);
    expect(stats!.avg).toBe(150);
    expect(stats!.max).toBe(200);
  });

  it('getAllStats 返回所有有数据的指标', () => {
    perf.record('compile_ts_ms', 50);
    perf.record('preview_full_rebuild_ms', 10);

    const all = perfMonitor.getAllStats();
    expect(all['compile_ts_ms']).toBeDefined();
    expect(all['preview_full_rebuild_ms']).toBeDefined();
    expect(all['compile_babel_ms']).toBeUndefined();
  });

  it('subscribe 接收 sample 事件', () => {
    const events: PerfEvent[] = [];
    const unsub = perfMonitor.subscribe(e => events.push(e));

    perf.record('compile_sass_ms', 300);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('sample');
    if (events[0].type === 'sample') {
      expect(events[0].metric).toBe('compile_sass_ms');
      expect(events[0].value).toBe(300);
    }

    unsub();
    perf.record('compile_sass_ms', 400);
    expect(events.length).toBe(1);
  });

  it('recent 数组最多保留 60 条', () => {
    for (let i = 0; i < 80; i++) {
      perf.record('completion_total_ms', i);
    }
    const stats = perfMonitor.getStats('completion_total_ms');
    expect(stats!.recent.length).toBeLessThanOrEqual(60);
  });
});

// ─────────────────────────────────────────────
// AlertEngine
// ─────────────────────────────────────────────

describe('AlertEngine', () => {
  let engine: AlertEngine;
  let alerts: Alert[];

  beforeEach(() => {
    const thresholds: ThresholdConfig[] = [
      { metric: 'compile_babel_ms', warn: 100, critical: 200, minSamples: 3 },
    ];
    engine = new AlertEngine(thresholds);
    alerts = [];
    perfMonitor.subscribe(e => {
      if (e.type === 'alert') alerts.push(e.alert);
    });
  });

  it('样本不足 minSamples 时不触发告警', () => {
    perf.record('compile_babel_ms', 150);
    perf.record('compile_babel_ms', 150);
    expect(alerts.length).toBe(0);
  });

  it('p95 超过 warn 阈值时触发 warn 告警', () => {
    perf.record('compile_babel_ms', 150);
    perf.record('compile_babel_ms', 150);
    perf.record('compile_babel_ms', 150);

    expect(alerts.length).toBe(1);
    expect(alerts[0].level).toBe('warn');
    expect(alerts[0].metric).toBe('compile_babel_ms');
  });

  it('p95 超过 critical 阈值时触发 critical 告警', () => {
    perf.record('compile_babel_ms', 250);
    perf.record('compile_babel_ms', 250);
    perf.record('compile_babel_ms', 250);

    expect(alerts.length).toBe(1);
    expect(alerts[0].level).toBe('critical');
  });

  it('冷却期内不重复告警', () => {
    for (let i = 0; i < 6; i++) {
      perf.record('compile_babel_ms', 150);
    }
    // 只应触发一次（冷却期 10s 内）
    expect(alerts.length).toBe(1);
  });

  it('getHistory 返回告警历史', () => {
    perf.record('compile_babel_ms', 150);
    perf.record('compile_babel_ms', 150);
    perf.record('compile_babel_ms', 150);

    expect(engine.getHistory().length).toBe(1);
  });
});

// ─────────────────────────────────────────────
// DegradationController
// ─────────────────────────────────────────────

describe('DegradationController', () => {
  it('初始状态为 normal', () => {
    const controller = new DegradationController();
    expect(controller.getState().level).toBe('normal');
    expect(controller.getState().activeStrategies).toEqual([]);
    controller._destroy();
  });

  it('isStrategyActive 在 normal 状态下返回 false', () => {
    const controller = new DegradationController();
    expect(controller.isStrategyActive('increased_debounce')).toBe(false);
    expect(controller.isStrategyActive('skip_lint')).toBe(false);
    expect(controller.isStrategyActive('disable_ts_completions')).toBe(false);
    controller._destroy();
  });

  it('收到多次告警后转为 degraded', () => {
    const controller = new DegradationController();

    // 直接通过事件总线发射 alert 事件模拟告警
    const fakeAlert: Alert = {
      id: 'test_1', metric: 'compile_babel_ms', level: 'warn',
      value: 150, threshold: 100, timestamp: Date.now(), message: 'test'
    };
    perfMonitor.emit({ type: 'alert', alert: fakeAlert });
    perfMonitor.emit({ type: 'alert', alert: { ...fakeAlert, id: 'test_2' } });

    expect(controller.getState().level).toBe('degraded');
    expect(controller.isStrategyActive('increased_debounce')).toBe(true);
    expect(controller.isStrategyActive('skip_lint')).toBe(true);

    controller._destroy();
  });
});
