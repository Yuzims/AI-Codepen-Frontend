import { TextDecoder } from 'util';
import {
  generateCode,
  resolveGeneratedCssLanguage,
  resolveGeneratedJsLanguage
} from '../aiService';
import api from '../api';

(global as any).TextDecoder = TextDecoder;

const createSseEvent = (payload: unknown) => {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return `data: ${data}\n\n`;
};

const createReader = (chunks: string[]) => {
  let index = 0;

  return {
    read: jest.fn().mockImplementation(async () => {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }

      const value = Buffer.from(chunks[index], 'utf8');
      index += 1;
      return { done: false, value };
    }),
  };
};

describe('generateCode', () => {
  beforeEach(() => {
    localStorage.clear();
    (global as any).fetch = jest.fn();
  });

  it('解析 SSE 流并返回最终代码结果', async () => {
    localStorage.setItem('token', 'token-123');

    const eventText = [
      createSseEvent({ delta: '{"title":"Todo Demo",' }),
      createSseEvent({ delta: '"html":"<div>demo</div>","css":"body{}","cssLanguage":"scss","js":"console.log(1)","jsLanguage":"react"}' }),
      createSseEvent('[DONE]'),
    ].join('');

    const reader = createReader([
      eventText.slice(0, 20),
      eventText.slice(20, 73),
      eventText.slice(73),
    ]);

    (global as any).fetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => reader,
      },
    });

    const onChunk = jest.fn();
    const result = await generateCode('生成一个待办应用', onChunk);

    expect(result).toEqual({
      title: 'Todo Demo',
      html: '<div>demo</div>',
      css: 'body{}',
      cssLanguage: 'scss',
      js: 'console.log(1)',
      jsLanguage: 'react',
    });
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect((global as any).fetch).toHaveBeenCalledWith(
      `${api.defaults.baseURL}/ai/generate`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ prompt: '生成一个待办应用' }),
      })
    );
  });

  it('接口返回非 200 时抛出服务端错误信息', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: '服务端未配置 ANTHROPIC_API_KEY' }),
    });

    await expect(generateCode('生成一个待办应用', jest.fn())).rejects.toThrow('服务端未配置 ANTHROPIC_API_KEY');
  });

  it('SSE 返回 error 事件时抛出错误', async () => {
    const reader = createReader([
      createSseEvent({ error: 'AI 生成失败' }),
    ]);

    (global as any).fetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => reader,
      },
    });

    await expect(generateCode('生成一个待办应用', jest.fn())).rejects.toThrow('AI 生成失败');
  });

  it('DONE 后如果不是合法 JSON 则抛出解析错误', async () => {
    const reader = createReader([
      createSseEvent({ delta: 'not json' }),
      createSseEvent('[DONE]'),
    ]);

    (global as any).fetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => reader,
      },
    });

    await expect(generateCode('生成一个待办应用', jest.fn())).rejects.toThrow('AI 返回结果不是有效的 JSON');
  });

  it('根据提示词或模型返回值解析生成语言', () => {
    expect(resolveGeneratedCssLanguage('用 SCSS 写一个卡片')).toBe('scss');
    expect(resolveGeneratedCssLanguage('用 Less 写一个卡片')).toBe('less');
    expect(resolveGeneratedCssLanguage('普通 CSS')).toBe('css');
    expect(resolveGeneratedCssLanguage('普通 CSS', 'less')).toBe('less');

    expect(resolveGeneratedJsLanguage('用 React 做一个表单')).toBe('react');
    expect(resolveGeneratedJsLanguage('写一个 TypeScript 工具')).toBe('ts');
    expect(resolveGeneratedJsLanguage('做一个 Vue 页面')).toBe('vue');
    expect(resolveGeneratedJsLanguage('普通 HTML/CSS/JS')).toBe('js');
    expect(resolveGeneratedJsLanguage('普通 HTML/CSS/JS', 'vue')).toBe('vue');
  });
});
