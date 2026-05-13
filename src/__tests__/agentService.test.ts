/**
 * agentService 测试用例（手动验证 / 未来接入 vitest 后可直接运行）
 *
 * 测试点：
 * 1. requestAgentPlan 成功时返回 { traceId, plan }
 * 2. requestAgentPlan 4xx/5xx 时抛出 Error，message 来自响应体
 * 3. requestAgentPlan 网络错误时抛出 Error
 * 4. requestAgentPlan 支持 AbortSignal 取消
 */

import { requestAgentPlan, AgentPlanRequest } from '../services/agentService';

const mockPayload: AgentPlanRequest = {
    html: '<div>hi</div>',
    css: 'body {}',
    js: 'console.log(1)',
    userInstruction: '加个按钮'
};

// --- Test 1: 成功响应 ---
// 预期: 返回 { traceId: string, plan: { summary, goal, targets, steps, risks } }
// 验证方式: 启动后端 mock 或真实后端，调用 requestAgentPlan(mockPayload)

// --- Test 2: 400 错误 ---
// 预期: throw Error('请输入指令') 或类似后端返回的 message
// 验证方式: 发送 { ...mockPayload, userInstruction: '' }

// --- Test 3: 网络错误 ---
// 预期: throw Error (fetch 本身的错误)
// 验证方式: 断开网络或指向不存在的端口

// --- Test 4: AbortSignal ---
// 预期: throw AbortError
// 验证方式:
//   const controller = new AbortController();
//   const promise = requestAgentPlan(mockPayload, controller.signal);
//   controller.abort();
//   await expect(promise).rejects.toThrow();

export { mockPayload };

test('agentService mock payload shape', () => {
    expect(mockPayload.userInstruction).toBe('加个按钮');
    expect(mockPayload.html).toContain('<div>hi</div>');
});
