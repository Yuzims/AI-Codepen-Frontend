import { requestAgentPatch, AgentPatchRequest, PatchResponse } from '../services/patchService';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; }
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock api module
jest.mock('../services/api', () => ({
    defaults: { baseURL: 'http://localhost:3001/api' }
}));

const mockPayload: AgentPatchRequest = {
    html: '<div>hi</div>',
    css: 'body {}',
    js: 'console.log(1)',
    userInstruction: '加个按钮',
    plan: {
        summary: '添加按钮',
        goal: '在页面中添加交互按钮',
        targets: ['html', 'js'],
        steps: ['创建按钮', '绑定事件'],
        risks: ['可能影响布局']
    }
};

const mockResponse: PatchResponse = {
    traceId: 'agent-patch-123-abc',
    proposal: {
        summary: '添加了按钮',
        operations: [
            {
                target: 'html',
                type: 'replace_full',
                after: '<div><button>Click</button></div>',
                reason: '添加按钮元素'
            }
        ],
        expectedOutcome: '页面出现按钮',
        warnings: []
    }
};

describe('patchService', () => {
    beforeEach(() => {
        localStorageMock.clear();
        (global as any).fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('成功请求返回 PatchResponse', async () => {
        localStorageMock.setItem('token', 'test-token');

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const result = await requestAgentPatch(mockPayload);

        expect(result.traceId).toBe('agent-patch-123-abc');
        expect(result.proposal.summary).toBe('添加了按钮');
        expect(result.proposal.operations).toHaveLength(1);
        expect(result.proposal.operations[0].target).toBe('html');
        expect(result.proposal.operations[0].type).toBe('replace_full');

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        expect(fetchCall[0]).toBe('http://localhost:3001/api/ai/agent/patch');
        expect(fetchCall[1].method).toBe('POST');
        expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-token');
        expect(JSON.parse(fetchCall[1].body)).toEqual(mockPayload);
    });

    it('无 token 时不发送 Authorization header', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        await requestAgentPatch(mockPayload);

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });

    it('非 2xx 响应抛出错误，提取 message 字段', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ message: '指令长度不能超过 1000 字符', traceId: 'xxx' })
        });

        await expect(requestAgentPatch(mockPayload))
            .rejects.toThrow('指令长度不能超过 1000 字符');
    });

    it('非 2xx 且 JSON 解析失败时使用默认错误信息', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => { throw new Error('not json'); }
        });

        await expect(requestAgentPatch(mockPayload))
            .rejects.toThrow('Patch 提案生成失败');
    });

    it('支持 AbortSignal 取消请求', async () => {
        const controller = new AbortController();

        (global.fetch as jest.Mock).mockImplementationOnce(() => {
            return new Promise((_, reject) => {
                controller.signal.addEventListener('abort', () => {
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            });
        });

        const promise = requestAgentPatch(mockPayload, controller.signal);
        controller.abort();

        await expect(promise).rejects.toThrow();
    });

    it('请求体包含完整的 plan 信息', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        await requestAgentPatch(mockPayload);

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.plan.summary).toBe('添加按钮');
        expect(body.plan.goal).toBe('在页面中添加交互按钮');
        expect(body.plan.targets).toEqual(['html', 'js']);
        expect(body.plan.steps).toEqual(['创建按钮', '绑定事件']);
    });
});
