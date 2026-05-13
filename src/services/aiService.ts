import api from './api';
import { perf } from './perfSDK';

export interface GenerateResult {
    title: string;
    html: string;
    css: string;
    cssLanguage?: 'css' | 'scss' | 'less';
    js: string;
    jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
}

type CssLanguage = 'css' | 'scss' | 'less';
type JsLanguage = 'js' | 'react' | 'vue' | 'ts';

const VALID_CSS_LANGUAGES = ['css', 'scss', 'less'] as const;
const VALID_JS_LANGUAGES = ['js', 'react', 'vue', 'ts'] as const;

const isValidJsLanguage = (
    value: unknown
): value is JsLanguage => (
    typeof value === 'string' && VALID_JS_LANGUAGES.includes(value as typeof VALID_JS_LANGUAGES[number])
);

const isValidCssLanguage = (
    value: unknown
): value is CssLanguage => (
    typeof value === 'string' && VALID_CSS_LANGUAGES.includes(value as typeof VALID_CSS_LANGUAGES[number])
);

const getApiBaseUrl = () => {
    const baseURL = api.defaults.baseURL;

    if (typeof baseURL === 'string' && baseURL.length > 0) {
        return baseURL.replace(/\/$/, '');
    }

    return '/api';
};

const parseGenerateResult = (rawText: string): GenerateResult => {
    const trimmed = rawText.trim();
    const startIndex = trimmed.indexOf('{');
    const endIndex = trimmed.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error('AI 返回结果不是有效的 JSON');
    }

    const parsed = JSON.parse(trimmed.slice(startIndex, endIndex + 1));

    if (
        typeof parsed.title !== 'string' ||
        typeof parsed.html !== 'string' ||
        typeof parsed.css !== 'string' ||
        typeof parsed.js !== 'string'
    ) {
        throw new Error('AI 返回结果缺少必要字段');
    }

    return {
        title: parsed.title.trim() || 'Untitled AI Pen',
        html: parsed.html,
        css: parsed.css,
        cssLanguage: isValidCssLanguage(parsed.cssLanguage) ? parsed.cssLanguage : undefined,
        js: parsed.js,
        jsLanguage: isValidJsLanguage(parsed.jsLanguage) ? parsed.jsLanguage : undefined
    };
};

export const resolveGeneratedCssLanguage = (
    prompt: string,
    cssLanguage?: CssLanguage
): CssLanguage => {
    if (isValidCssLanguage(cssLanguage)) {
        return cssLanguage;
    }

    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('scss') || normalizedPrompt.includes('sass')) {
        return 'scss';
    }

    if (normalizedPrompt.includes('less')) {
        return 'less';
    }

    return 'css';
};

export const resolveGeneratedJsLanguage = (
    prompt: string,
    jsLanguage?: JsLanguage
): JsLanguage => {
    if (isValidJsLanguage(jsLanguage)) {
        return jsLanguage;
    }

    const normalizedPrompt = prompt.toLowerCase();
    const hasWord = (word: string) => new RegExp(`\\b${word}\\b`, 'i').test(normalizedPrompt);

    if (hasWord('react') || hasWord('jsx')) {
        return 'react';
    }

    if (hasWord('vue')) {
        return 'vue';
    }

    if (hasWord('typescript') || hasWord('tsx') || hasWord('ts')) {
        return 'ts';
    }

    return 'js';
};

export const generateCode = async (
    prompt: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal
): Promise<GenerateResult> => {
    const token = localStorage.getItem('token');
    const sseStart = performance.now();
    let firstChunkReceived = false;

    const response = await fetch(`${getApiBaseUrl()}/ai/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt }),
        signal
    });

    if (!response.ok) {
        let message = 'AI 生成失败';

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

    if (!response.body) {
        throw new Error('AI 生成连接失败');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let eventBuffer = '';
    let generatedText = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        if (!firstChunkReceived) {
            firstChunkReceived = true;
            perf.record('sse_ttfb_ms', performance.now() - sseStart);
        }

        eventBuffer += decoder.decode(value, { stream: true });

        while (true) {
            const boundaryIndex = eventBuffer.indexOf('\n\n');
            if (boundaryIndex === -1) {
                break;
            }

            const rawEvent = eventBuffer.slice(0, boundaryIndex);
            eventBuffer = eventBuffer.slice(boundaryIndex + 2);

            const data = rawEvent
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim())
                .join('\n');

            if (!data) {
                continue;
            }

            if (data === '[DONE]') {
                perf.record('sse_total_ms', performance.now() - sseStart);
                return parseGenerateResult(generatedText);
            }

            const payload = JSON.parse(data);

            if (typeof payload.error === 'string' && payload.error) {
                throw new Error(payload.error);
            }

            if (typeof payload.delta === 'string' && payload.delta) {
                generatedText += payload.delta;
                const renderStart = performance.now();
                onChunk(payload.delta);
                perf.record('sse_render_lag_ms', performance.now() - renderStart);
            }
        }
    }

    perf.record('sse_total_ms', performance.now() - sseStart);
    return parseGenerateResult(generatedText);
};
