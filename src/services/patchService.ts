import api from './api';

export interface PatchOperation {
    target: 'html' | 'css' | 'js';
    type: 'replace_full';
    after: string;
    reason: string;
}

export interface PatchProposal {
    summary: string;
    operations: PatchOperation[];
    expectedOutcome: string;
    warnings: string[];
    languages?: {
        cssLanguage?: 'css' | 'scss' | 'less';
        jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
    };
}

export interface PatchResponse {
    traceId: string;
    proposal: PatchProposal;
}

export interface AgentPatchRequest {
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
    plan: {
        summary: string;
        goal: string;
        targets: Array<'html' | 'css' | 'js'>;
        steps: string[];
        risks: string[];
    };
}

const getApiBaseUrl = () => {
    const baseURL = api.defaults.baseURL;
    if (typeof baseURL === 'string' && baseURL.length > 0) {
        return baseURL.replace(/\/$/, '');
    }
    return '/api';
};

export const requestAgentPatch = async (
    payload: AgentPatchRequest,
    signal?: AbortSignal
): Promise<PatchResponse> => {
    const token = localStorage.getItem('token');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const combinedSignal = signal || controller.signal;

    try {
        const response = await fetch(`${getApiBaseUrl()}/ai/agent/patch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload),
            signal: combinedSignal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let message = 'Patch 提案生成失败';
            try {
                const errorData = await response.json();
                if (typeof errorData?.message === 'string' && errorData.message) {
                    message = errorData.message;
                }
            } catch {
                // ignore JSON parse failure
            }
            throw new Error(message);
        }

        const data: PatchResponse = await response.json();
        return data;
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            if (signal?.aborted) {
                throw error;
            }
            throw new Error('Patch 请求超时（30秒）');
        }
        throw error;
    }
};
