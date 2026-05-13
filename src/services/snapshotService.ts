export interface PenSnapshot {
    html: string;
    css: string;
    js: string;
    cssLanguage: 'css' | 'scss' | 'less';
    jsLanguage: 'js' | 'react' | 'vue' | 'ts';
    timestamp: number;
    patchSummary: string;
    patchTargets: Array<'html' | 'css' | 'js'>;
    traceId?: string;
}

export function createSnapshot(params: {
    html: string;
    css: string;
    js: string;
    cssLanguage: 'css' | 'scss' | 'less';
    jsLanguage: 'js' | 'react' | 'vue' | 'ts';
    patchSummary: string;
    patchTargets: Array<'html' | 'css' | 'js'>;
    traceId?: string;
}): PenSnapshot {
    return {
        html: params.html,
        css: params.css,
        js: params.js,
        cssLanguage: params.cssLanguage,
        jsLanguage: params.jsLanguage,
        timestamp: Date.now(),
        patchSummary: params.patchSummary,
        patchTargets: params.patchTargets,
        traceId: params.traceId
    };
}

export function formatSnapshotTime(timestamp: number): string {
    const date = new Date(timestamp);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}
