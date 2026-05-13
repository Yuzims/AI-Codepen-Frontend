import api from './api';
import { PatchProposal } from './patchService';
import { perf } from './perfSDK';

export interface AgentRunRequest {
    penId?: string;
    title?: string;
    html: string;
    css: string;
    js: string;
    cssLanguage?: 'css' | 'scss' | 'less';
    jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
    selection?: {
        target: 'html' | 'css' | 'js';
        from: number;
        to: number;
        text: string;
    } | null;
    errors?: Array<{
        target: 'html' | 'css' | 'js';
        severity: 'error' | 'warning';
        message: string;
        line?: number;
        column?: number;
    }>;
    userInstruction: string;
}

export interface AgentStep {
    stepIndex: number;
    tool: string;
    input: Record<string, unknown>;
    output: string;
    durationMs: number;
}

export interface AgentRunResponse {
    traceId: string;
    steps: AgentStep[];
    proposal: PatchProposal | null;
    status: 'completed' | 'max_steps_reached' | 'error';
    error?: string;
}

const getApiBaseUrl = () => {
    const baseURL = api.defaults.baseURL;
    if (typeof baseURL === 'string' && baseURL.length > 0) {
        return baseURL.replace(/\/$/, '');
    }
    return '/api';
};

export async function requestAgentRun(
    payload: AgentRunRequest,
    signal?: AbortSignal
): Promise<AgentRunResponse> {
    const start = performance.now();
    const token = localStorage.getItem('token');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 95000);

    const effectiveSignal = signal || controller.signal;

    try {
        const response = await fetch(`${getApiBaseUrl()}/ai/agent/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload),
            signal: effectiveSignal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let message = 'Agent 执行失败';
            try {
                const errorData = await response.json();
                if (typeof errorData?.message === 'string' && errorData.message) {
                    message = errorData.message;
                }
            } catch {
                // ignore JSON parse failure
            }
            const err = new Error(message);
            (err as any).status = response.status;
            throw err;
        }

        let data: AgentRunResponse;
        try {
            data = await response.json();
        } catch {
            throw new Error('响应解析失败，请重试');
        }

        perf.record('agent_run_ms', performance.now() - start);
        return data;
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            if (signal?.aborted) {
                throw error;
            }
            throw new Error('Agent 请求超时（95秒）');
        }
        throw error;
    }
}
