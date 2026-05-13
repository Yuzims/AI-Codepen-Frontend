// perfSDK 单元测试（兼容 Jest 27 / CRA）
// 运行方式：cd FeiShu-Codepen-Frontend && npx react-scripts test --testPathPattern=perfSDK --watchAll=false

import { perf } from '../perfSDK';

// ---- fetch mock ----
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
beforeAll(() => {
  (global as any).fetch = mockFetch;
});

// ---- performance.now mock ----
// jsdom 的 performance 是只读 getter，需要用 defineProperty 覆盖
let nowValue = 0;
beforeAll(() => {
  Object.defineProperty(global, 'performance', {
    configurable: true,
    writable: true,
    value: { now: () => ++nowValue },
  });
});

// ---- 每个 test 前重置 SDK 状态 ----
beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockClear();
  nowValue = 0;
  (perf as any)._reset();
});

afterEach(() => {
  jest.useRealTimers();
});

// 推进定时器并等待所有 Promise 微任务完成（Jest 27 兼容写法）
async function flushTimersAndPromises() {
  jest.runAllTimers();
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

// ─────────────────────────────────────────────
// 1. record / getSummary
// ─────────────────────────────────────────────
describe('record & getSummary', () => {
  it('未记录时 getSummary 返回 null', () => {
    expect(perf.getSummary('compile_babel_ms')).toBeNull();
  });

  it('记录单条后 count=1，avg/p95/max 均等于该值', () => {
    perf.record('compile_babel_ms', 42);
    const s = perf.getSummary('compile_babel_ms')!;
    expect(s.count).toBe(1);
    expect(s.avg).toBe(42);
    expect(s.p95).toBe(42);
    expect(s.max).toBe(42);
  });

  it('多条记录 avg/p95/max 计算正确', () => {
    for (let i = 1; i <= 10; i++) perf.record('compile_ts_ms', i);
    const s = perf.getSummary('compile_ts_ms')!;
    expect(s.count).toBe(10);
    expect(s.avg).toBeCloseTo(5.5);
    expect(s.max).toBe(10);
    // p95 = values[floor(10 * 0.95)] = values[9] = 10
    expect(s.p95).toBe(10);
  });

  it('p95 在 20 条数据时取第 19 位（0-based）', () => {
    for (let i = 1; i <= 20; i++) perf.record('preview_full_rebuild_ms', i);
    const s = perf.getSummary('preview_full_rebuild_ms')!;
    // floor(20 * 0.95) = 19，排序后 values[19] = 20
    expect(s.p95).toBe(20);
  });
});

// ─────────────────────────────────────────────
// 2. measure（同步）
// ─────────────────────────────────────────────
describe('measure', () => {
  it('返回 fn 的返回值', () => {
    const result = perf.measure('compile_babel_ms', () => 'hello');
    expect(result).toBe('hello');
  });

  it('记录耗时 >= 0（空函数执行时间可能为 0）', () => {
    perf.measure('compile_sass_ms', () => {});
    const s = perf.getSummary('compile_sass_ms')!;
    expect(s.count).toBe(1);
    expect(s.avg).toBeGreaterThanOrEqual(0);
  });

  it('fn 抛出异常时异常向上传播，不记录指标', () => {
    expect(() =>
      perf.measure('compile_less_ms', () => { throw new Error('boom'); })
    ).toThrow('boom');
    expect(perf.getSummary('compile_less_ms')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// 3. measureAsync（异步）
// ─────────────────────────────────────────────
describe('measureAsync', () => {
  it('返回 Promise 解析值', async () => {
    const result = await perf.measureAsync('compile_ts_ms', async () => 99);
    expect(result).toBe(99);
  });

  it('记录耗时 >= 0', async () => {
    await perf.measureAsync('compile_vue_sfc_ms', async () => {});
    const s = perf.getSummary('compile_vue_sfc_ms')!;
    expect(s.count).toBe(1);
    expect(s.avg).toBeGreaterThanOrEqual(0);
  });

  it('fn reject 时异常向上传播，不记录指标', async () => {
    await expect(
      perf.measureAsync('sse_ttfb_ms', async () => { throw new Error('async boom'); })
    ).rejects.toThrow('async boom');
    expect(perf.getSummary('sse_ttfb_ms')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// 4. getAllSummaries
// ─────────────────────────────────────────────
describe('getAllSummaries', () => {
  it('返回所有已记录指标的摘要', () => {
    perf.record('completion_snippet_ms', 5);
    perf.record('completion_ts_worker_ms', 10);
    const all = perf.getAllSummaries();
    expect(all['completion_snippet_ms']).not.toBeNull();
    expect(all['completion_ts_worker_ms']).not.toBeNull();
  });

  it('无记录时返回空对象', () => {
    expect(perf.getAllSummaries()).toEqual({});
  });
});

// ─────────────────────────────────────────────
// 5. 自动 flush（10s 定时器）
// ─────────────────────────────────────────────
describe('flush', () => {
  it('10s 后自动调用 fetch 上报', async () => {
    perf.record('preview_incremental_update_ms', 30);
    expect(mockFetch).not.toHaveBeenCalled();
    await flushTimersAndPromises();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/metrics');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.metrics['preview_incremental_update_ms']).toBeDefined();
  });

  it('无数据时不发请求', async () => {
    await flushTimersAndPromises();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetch 失败时不抛出异常（静默处理）', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    perf.record('compile_babel_ms', 1);
    await expect(flushTimersAndPromises()).resolves.toBeUndefined();
  });

  it('flush 后 metrics 被清空，再次 getSummary 返回 null', async () => {
    perf.record('compile_sass_ms', 50);
    await flushTimersAndPromises();
    expect(perf.getSummary('compile_sass_ms')).toBeNull();
  });

  it('多次 record 只注册一个定时器，flush 只触发一次', async () => {
    perf.record('compile_less_ms', 1);
    perf.record('compile_less_ms', 2);
    perf.record('compile_less_ms', 3);
    await flushTimersAndPromises();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
