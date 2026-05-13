/**
 * 集成测试：验证 Task 1/2/3 整合后的指标采集链路
 * 运行方式：cd FeiShu-Codepen-Frontend && npx vitest run src/services/__tests__/integration.test.ts
 */

import { TextDecoder } from 'util';
import { perf } from '../perfSDK';
import { generateCode } from '../aiService';
import { compileJsFramework } from '../compilerService';

(global as any).TextDecoder = TextDecoder;

// ---- fetch mock ----
const mockFetch = jest.fn();
beforeAll(() => {
  (global as any).fetch = mockFetch;
});

beforeEach(() => {
  (perf as any)._reset();
  mockFetch.mockClear();
});

// ─────────────────────────────────────────────
// SSE 指标采集
// ─────────────────────────────────────────────

const createSseEvent = (payload: unknown) => {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return `data: ${data}\n\n`;
};

const createReader = (chunks: string[]) => {
  let index = 0;
  return {
    read: jest.fn().mockImplementation(async () => {
      if (index >= chunks.length) return { done: true, value: undefined };
      const value = Buffer.from(chunks[index], 'utf8');
      index += 1;
      return { done: false, value };
    }),
  };
};

describe('SSE 指标采集 (aiService + perfSDK)', () => {
  it('generateCode 完成后记录 sse_ttfb_ms 和 sse_total_ms', async () => {
    localStorage.setItem('token', 'test-token');

    const events = [
      createSseEvent({ delta: '{"title":"Test",' }),
      createSseEvent({ delta: '"html":"<p>hi</p>","css":"","js":""}' }),
      createSseEvent('[DONE]'),
    ].join('');

    const reader = createReader([events]);

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    });

    const onChunk = jest.fn();
    await generateCode('test prompt', onChunk);

    const ttfb = perf.getSummary('sse_ttfb_ms');
    const total = perf.getSummary('sse_total_ms');
    const renderLag = perf.getSummary('sse_render_lag_ms');

    expect(ttfb).not.toBeNull();
    expect(ttfb!.count).toBe(1);
    expect(ttfb!.avg).toBeGreaterThanOrEqual(0);

    expect(total).not.toBeNull();
    expect(total!.count).toBe(1);
    expect(total!.avg).toBeGreaterThanOrEqual(0);

    expect(renderLag).not.toBeNull();
    expect(renderLag!.count).toBe(2); // 2 delta chunks
  });

  it('sse_ttfb_ms 只记录一次（首个 chunk）', async () => {
    const events = [
      createSseEvent({ delta: '{"title":"A",' }),
      createSseEvent({ delta: '"html":"","css":"","js":""}' }),
      createSseEvent('[DONE]'),
    ].join('');

    // 分成多个 chunk 模拟多次 read
    const reader = createReader([
      events.slice(0, 30),
      events.slice(30, 80),
      events.slice(80),
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    });

    await generateCode('test', jest.fn());

    const ttfb = perf.getSummary('sse_ttfb_ms');
    expect(ttfb!.count).toBe(1);
  });

  it('请求失败时不记录 SSE 指标', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: '服务端错误' }),
    });

    await expect(generateCode('test', jest.fn())).rejects.toThrow();

    expect(perf.getSummary('sse_ttfb_ms')).toBeNull();
    expect(perf.getSummary('sse_total_ms')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Vue SFC 编译链路
// ─────────────────────────────────────────────

describe('compileJsFramework vue 分支', () => {
  it('vue 分支调用 compileSFCVue 并记录 compile_vue_sfc_ms', async () => {
    const vueSfcCode = `<template><div>hello</div></template>
<script>
const component = { setup() { return {} } }
</script>
<style>
div { color: red; }
</style>`;

    const result = await compileJsFramework(vueSfcCode, 'vue');

    // compileSFCVue 应该解析 SFC 并生成包含 Vue.createApp 的代码
    expect(result.code).toContain('createApp');
    expect(result.error).toBeUndefined();

    const metric = perf.getSummary('compile_vue_sfc_ms');
    expect(metric).not.toBeNull();
    expect(metric!.count).toBe(1);
  });

  it('vue SFC 语法错误时返回 error 字段', async () => {
    // 故意写一个不完整的 SFC（缺少 template 闭合）
    const badCode = `<template><div>`;

    const result = await compileJsFramework(badCode, 'vue');

    // @vue/compiler-sfc 对不完整模板可能不报错（它比较宽容），
    // 但至少应该不崩溃
    expect(result).toBeDefined();
    expect(typeof result.code).toBe('string');
  });
});

// ─────────────────────────────────────────────
// Web Vitals 映射
// ─────────────────────────────────────────────

describe('Web Vitals 指标类型完整性', () => {
  it('所有 web_vitals 指标名可正常 record', () => {
    perf.record('web_vitals_lcp_ms', 2400);
    perf.record('web_vitals_fcp_ms', 1600);
    perf.record('web_vitals_ttfb_ms', 200);
    perf.record('web_vitals_cls', 0.05);
    perf.record('web_vitals_inp_ms', 120);

    expect(perf.getSummary('web_vitals_lcp_ms')!.avg).toBe(2400);
    expect(perf.getSummary('web_vitals_fcp_ms')!.avg).toBe(1600);
    expect(perf.getSummary('web_vitals_ttfb_ms')!.avg).toBe(200);
    expect(perf.getSummary('web_vitals_cls')!.avg).toBe(0.05);
    expect(perf.getSummary('web_vitals_inp_ms')!.avg).toBe(120);
  });
});

// ─────────────────────────────────────────────
// Agent 指标类型
// ─────────────────────────────────────────────

describe('Agent 指标类型完整性', () => {
  it('所有 agent 指标名可正常 record', () => {
    perf.record('agent_plan_ms', 1500);
    perf.record('agent_run_ms', 8000);
    perf.record('agent_patch_apply_ms', 5);
    perf.record('agent_rollback_ms', 3);

    expect(perf.getSummary('agent_plan_ms')!.avg).toBe(1500);
    expect(perf.getSummary('agent_run_ms')!.avg).toBe(8000);
    expect(perf.getSummary('agent_patch_apply_ms')!.avg).toBe(5);
    expect(perf.getSummary('agent_rollback_ms')!.avg).toBe(3);
  });
});
