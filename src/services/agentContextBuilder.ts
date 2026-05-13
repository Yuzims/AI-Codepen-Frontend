import { AgentPlanRequest } from './agentService';
import { EditorView } from '@codemirror/view';

export interface AgentContextInput {
    penId?: string;
    title?: string;
    htmlCode: string;
    cssCode: string;
    jsCode: string;
    cssLanguage?: 'css' | 'scss' | 'less';
    jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
    jsEditor?: EditorView | null;
    errors?: Array<{
        target: 'html' | 'css' | 'js';
        severity: 'error' | 'warning';
        message: string;
        line?: number;
        column?: number;
    }>;
    userInstruction: string;
}

const MAX_ERRORS = 20;
const MAX_CODE_LENGTH = 15000;

const getSelection = (editor: EditorView | null | undefined): AgentPlanRequest['selection'] => {
    if (!editor) return null;

    try {
        const { from, to } = editor.state.selection.main;
        if (from === to) return null;

        const text = editor.state.sliceDoc(from, to);
        if (!text.trim()) return null;

        return { target: 'js', from, to, text };
    } catch {
        return null;
    }
};

const truncate = (code: string, max: number): string => {
    if (code.length <= max) return code;
    return code.slice(0, max);
};

export const buildAgentPlanRequest = (input: AgentContextInput): AgentPlanRequest => {
    const selection = getSelection(input.jsEditor);

    const errors = (input.errors || [])
        .slice(0, MAX_ERRORS)
        .map(e => ({
            target: e.target,
            severity: e.severity,
            message: e.message,
            ...(e.line !== undefined ? { line: e.line } : {}),
            ...(e.column !== undefined ? { column: e.column } : {})
        }));

    return {
        penId: input.penId || undefined,
        title: input.title || undefined,
        html: truncate(input.htmlCode, MAX_CODE_LENGTH),
        css: truncate(input.cssCode, MAX_CODE_LENGTH),
        js: truncate(input.jsCode, MAX_CODE_LENGTH),
        cssLanguage: input.cssLanguage,
        jsLanguage: input.jsLanguage,
        selection,
        errors: errors.length > 0 ? errors : undefined,
        userInstruction: input.userInstruction
    };
};
