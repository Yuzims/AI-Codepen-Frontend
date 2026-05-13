import api from './api';
import { perf } from './perfSDK';

export interface AgentPlanRequest {
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

export interface AgentPlan {
    summary: string;
    goal: string;
    targets: Array<'html' | 'css' | 'js'>;
    steps: string[];
    risks: string[];
}

export interface AgentPlanResponse {
    traceId: string;
    plan: AgentPlan;
}

const getApiBaseUrl = () => {
    const baseURL = api.defaults.baseURL;
    if (typeof baseURL === 'string' && baseURL.length > 0) {
        return baseURL.replace(/\/$/, '');
    }
    return '/api';
};

export const requestAgentPlan = async (
    payload: AgentPlanRequest,
    signal?: AbortSignal
): Promise<AgentPlanResponse> => {
    const start = performance.now();
    const token = localStorage.getItem('token');

    const response = await fetch(`${getApiBaseUrl()}/ai/agent/plan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        let message = 'Agent 计划生成失败';
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

    const data: AgentPlanResponse = await response.json();
    perf.record('agent_plan_ms', performance.now() - start);
    return data;
};
