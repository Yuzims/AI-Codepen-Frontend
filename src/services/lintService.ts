import { Diagnostic } from '@codemirror/lint';
import { Extension, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, WidgetType, GutterMarker, gutter, hoverTooltip } from '@codemirror/view';
import { debounce } from 'lodash';
import * as BabelParser from '@babel/parser';
import { degradationController } from './perfMonitor';
import { formatErrorMessage } from './errorFormatter';

// 快速修复接口
interface LintFix {
    message: string;
    apply: () => void;
}

// 增强的诊断接口
interface EnhancedDiagnostic extends Diagnostic {
    fixes?: LintFix[];
    source?: 'static' | 'runtime';
}

// 错误信息存储结构（用于 tooltip 查询）
interface ErrorInfo {
    line: number;
    message: string;
    type: 'error' | 'warning';
    source: 'static' | 'runtime';
    from: number;
    to: number;
}

// Gutter marker：行号左侧的红点/黄三角
class ErrorGutterMarker extends GutterMarker {
    constructor(
        private type: 'error' | 'warning',
        private source: 'static' | 'runtime'
    ) {
        super();
    }

    toDOM(): HTMLElement {
        const marker = document.createElement('div');
        marker.className = `cm-error-gutter-marker cm-error-gutter-${this.type} cm-error-gutter-${this.source}`;
        marker.title = this.type === 'error' ? '错误' : '警告';
        return marker;
    }

    eq(other: GutterMarker): boolean {
        return other instanceof ErrorGutterMarker &&
            other.type === this.type &&
            other.source === this.source;
    }
}

// 添加错误装饰的状态效果
export const addStaticErrorDecorations = StateEffect.define<{
    line: number;
    message: string;
    type: 'error' | 'warning';
    fixes?: LintFix[];
    source: 'static';
    from: number;
    to: number;
}[]>();
export const addRuntimeErrorDecorations = StateEffect.define<{
    line: number;
    message: string;
    type: 'error' | 'warning';
    fixes?: LintFix[];
    source: 'runtime';
    from: number;
    to: number;
}[]>();
export const clearStaticErrorDecorations = StateEffect.define();
export const clearRuntimeErrorDecorations = StateEffect.define();
export const clearAllErrorDecorations = StateEffect.define();

// 错误信息状态字段（存储 ErrorInfo 列表，供 gutter/tooltip/statusbar 使用）
export const errorInfoField = StateField.define<ErrorInfo[]>({
    create() { return []; },
    update(errors, tr) {
        let next = errors;
        for (const effect of tr.effects) {
            if (effect.is(addStaticErrorDecorations)) {
                // 替换所有静态错误，保留运行时错误
                const runtime = next.filter(e => e.source === 'runtime');
                next = [...runtime, ...effect.value.map(e => ({
                    line: e.line, message: e.message, type: e.type,
                    source: e.source as 'static', from: e.from, to: e.to
                }))];
            } else if (effect.is(addRuntimeErrorDecorations)) {
                const hasStatic = next.some(e => e.source === 'static');
                if (!hasStatic) {
                    const staticErrors = next.filter(e => e.source === 'static');
                    next = [...staticErrors, ...effect.value.map(e => ({
                        line: e.line, message: e.message, type: e.type,
                        source: e.source as 'runtime', from: e.from, to: e.to
                    }))];
                }
            } else if (effect.is(clearStaticErrorDecorations)) {
                next = next.filter(e => e.source === 'runtime');
            } else if (effect.is(clearRuntimeErrorDecorations)) {
                next = next.filter(e => e.source === 'static');
            } else if (effect.is(clearAllErrorDecorations)) {
                next = [];
            }
        }
        return next;
    }
});

// 波浪线下划线 decoration 字段（从 errorInfoField 派生）
export const errorDecorationField = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        const hasErrorEffect = tr.effects.some(e =>
            e.is(addStaticErrorDecorations) || e.is(addRuntimeErrorDecorations) ||
            e.is(clearStaticErrorDecorations) || e.is(clearRuntimeErrorDecorations) ||
            e.is(clearAllErrorDecorations)
        );
        if (!hasErrorEffect) return decorations;

        const errors = tr.state.field(errorInfoField);
        const builder = new RangeSetBuilder<Decoration>();
        const sorted = [...errors].sort((a, b) => a.from - b.from);
        for (const err of sorted) {
            const from = Math.max(0, Math.min(err.from, tr.state.doc.length));
            const to = Math.max(from, Math.min(err.to, tr.state.doc.length));
            if (from < to) {
                const cls = err.type === 'error' ? 'cm-error-underline' : 'cm-warning-underline';
                builder.add(from, to, Decoration.mark({ class: cls, inclusive: false }));
            }
        }
        return builder.finish();
    },
    provide: f => EditorView.decorations.from(f)
});

// Gutter 扩展：在行号左侧显示错误/警告标记
export const errorGutterExtension = gutter({
    class: 'cm-error-gutter',
    markers(view) {
        const errors = view.state.field(errorInfoField, false) ?? [];
        const builder = new RangeSetBuilder<GutterMarker>();
        // 按行去重，每行只显示最高级别的 marker
        const lineMap = new Map<number, ErrorInfo>();
        for (const err of errors) {
            const linePos = view.state.doc.line(
                Math.max(1, Math.min(err.line, view.state.doc.lines))
            ).from;
            const existing = lineMap.get(linePos);
            if (!existing || (err.type === 'error' && existing.type === 'warning')) {
                lineMap.set(linePos, err);
            }
        }
        const sorted = Array.from(lineMap.entries()).sort((a, b) => a[0] - b[0]);
        for (const [pos, err] of sorted) {
            builder.add(pos, pos, new ErrorGutterMarker(err.type, err.source));
        }
        return builder.finish();
    },
    initialSpacer: () => new ErrorGutterMarker('warning', 'static')
});

// Hover tooltip：鼠标悬停在错误行时显示错误信息
export const errorTooltipExtension = hoverTooltip((view, pos) => {
    const errors = view.state.field(errorInfoField, false) ?? [];
    const line = view.state.doc.lineAt(pos).number;
    const lineErrors = errors.filter(e => e.line === line);
    if (lineErrors.length === 0) return null;

    return {
        pos,
        above: true,
        create() {
            const dom = document.createElement('div');
            dom.className = 'cm-error-tooltip';
            lineErrors.forEach(err => {
                const item = document.createElement('div');
                item.className = `cm-error-tooltip-item cm-error-tooltip-${err.type}`;
                const icon = err.type === 'error' ? '✗' : '⚠';
                const sourceLabel = err.source === 'runtime' ? ' (运行时)' : '';
                item.textContent = `${icon} ${err.message}${sourceLabel}`;
                dom.appendChild(item);
            });
            return { dom };
        }
    };
});

// 错误样式主题（gutter marker + tooltip + 波浪线）
export const errorMessageTheme = EditorView.theme({
    // Gutter 区域
    '.cm-error-gutter': {
        width: '16px',
        minWidth: '16px'
    },
    '.cm-error-gutter-marker': {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        display: 'inline-block',
        margin: '2px 3px',
        cursor: 'pointer',
        flexShrink: '0'
    },
    '.cm-error-gutter-error': {
        backgroundColor: '#f44336'
    },
    '.cm-error-gutter-warning': {
        backgroundColor: '#ff9800',
        borderRadius: '0 !important',
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
    },
    // Tooltip
    '.cm-error-tooltip': {
        padding: '6px 10px',
        maxWidth: '400px',
        fontSize: '12px',
        lineHeight: '1.5',
        fontFamily: '"Consolas", "Monaco", monospace'
    },
    '.cm-error-tooltip-item': {
        padding: '2px 0',
        wordBreak: 'break-word'
    },
    '.cm-error-tooltip-error': {
        color: '#c62828'
    },
    '.cm-error-tooltip-warning': {
        color: '#e65100'
    }
});

// HTML 辅助函数：排除脚本、样式标签内容和注释
function excludeScriptAndStyleContent(html: string): string {
    try {
        return html
            // 替换 HTML 注释为空，避免注释中的标签被误检测
            .replace(/<!--[\s\S]*?-->/g, '')
            // 替换 script 标签内容为空，保留标签结构
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
                const openTag = match.match(/<script[^>]*>/i)?.[0] || '<script>';
                return openTag + '</script>';
            })
            // 替换 style 标签内容为空，保留标签结构
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
                const openTag = match.match(/<style[^>]*>/i)?.[0] || '<style>';
                return openTag + '</style>';
            });
    } catch (error) {
        // 如果处理失败，返回原始内容
        return html;
    }
}

// HTML Lint 函数
// HTML Lint 缓存
const htmlLintCache = new Map<string, EnhancedDiagnostic[]>();

function htmlLinter(view: EditorView): EnhancedDiagnostic[] {
    const diagnostics: EnhancedDiagnostic[] = [];
    const doc = view.state.doc;
    const code = doc.toString();

    // 检查缓存
    const cacheKey = code;
    if (htmlLintCache.has(cacheKey)) {
        return htmlLintCache.get(cacheKey)!;
    }

    // --- 1. 使用 DOMParser 进行专业的 HTML 语法检查 ---
    try {
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(code, 'text/html');

        // 检查解析错误（parsererror 元素）
        const parserErrors = htmlDoc.querySelectorAll('parsererror');
        if (parserErrors.length > 0) {
            parserErrors.forEach(errorElement => {
                const errorText = errorElement.textContent || 'HTML 解析错误';

                // 尝试从错误信息中提取行号
                const lineMatch = errorText.match(/line (\d+)/i);
                if (lineMatch) {
                    const lineNumber = parseInt(lineMatch[1], 10);
                    try {
                        const lineObj = doc.line(lineNumber);
                        diagnostics.push({
                            from: lineObj.from,
                            to: lineObj.to,
                            severity: 'error',
                            message: errorText,
                            source: 'static'
                        });
                    } catch (lineError) {
                        // 如果获取行失败，使用默认位置
                        diagnostics.push({
                            from: 0,
                            to: code.length,
                            severity: 'error',
                            message: errorText,
                            source: 'static'
                        });
                    }
                } else {
                    // 没有行号信息，标记整个文档
                    diagnostics.push({
                        from: 0,
                        to: code.length,
                        severity: 'error',
                        message: errorText,
                        source: 'static'
                    });
                }
            });
        }
    } catch (parsingError) {
        console.warn('HTML parsing error:', parsingError);
    }

    // --- 2. 自定义 HTML 标签匹配检查 ---
    try {
        // 预处理：排除脚本和样式标签内容，避免误检测
        const processedCode = excludeScriptAndStyleContent(code);

        const lines = processedCode.split('\n');
        const tagStack: Array<{ tag: string, line: number, pos: number }> = [];
        const selfClosingTags = new Set([
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ]);

        let currentPos = 0;

        lines.forEach((line, lineIndex) => {
            const lineStart = currentPos;

            // 更精确的标签匹配正则表达式
            const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
            let match;

            while ((match = tagRegex.exec(line)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const tagStart = lineStart + match.index;
                const tagEnd = tagStart + fullTag.length;
                const lineNumber = lineIndex + 1;

                if (fullTag.startsWith('</')) {
                    // 结束标签
                    if (tagStack.length === 0) {
                        try {
                            const lineObj = doc.line(lineNumber);
                            const from = lineObj.from + match.index;
                            const to = lineObj.from + match.index + fullTag.length;

                            diagnostics.push({
                                from,
                                to,
                                severity: 'error',
                                message: `意外的结束标签 </${tagName}>`,
                                source: 'static'
                            });
                        } catch (lineError) {
                            // 忽略行获取错误
                        }
                    } else {
                        const lastTag = tagStack[tagStack.length - 1];
                        // 支持大小写不敏感的标签匹配
                        if (lastTag.tag.toLowerCase() === tagName.toLowerCase()) {
                            tagStack.pop();
                        } else {
                            try {
                                const lineObj = doc.line(lineNumber);
                                const from = lineObj.from + match.index;
                                const to = lineObj.from + match.index + fullTag.length;

                                diagnostics.push({
                                    from,
                                    to,
                                    severity: 'error',
                                    message: `标签不匹配：</${tagName}> 应为 </${lastTag.tag}>`,
                                    source: 'static'
                                });
                            } catch (lineError) {
                                // 忽略行获取错误
                            }
                        }
                    }
                } else if (!fullTag.endsWith('/>') && !selfClosingTags.has(tagName)) {
                    // 开始标签（非自闭合）
                    tagStack.push({
                        tag: tagName,
                        line: lineNumber,
                        pos: tagStart
                    });
                }
            }

            currentPos += line.length + 1; // +1 for newline
        });

        // 检查未闭合的标签
        tagStack.forEach(tag => {
            try {
                const lineObj = doc.line(tag.line);
                const relativePos = tag.pos - lineObj.from;
                const from = lineObj.from + Math.max(0, Math.min(relativePos, lineObj.length));
                const to = Math.min(from + tag.tag.length + 2, lineObj.to);

                diagnostics.push({
                    from,
                    to,
                    severity: 'error',
                    message: `未闭合的标签 <${tag.tag}>`,
                    source: 'static'
                });
            } catch (lineError) {
                // 忽略行获取错误
            }
        });

    } catch (error) {
        console.warn('Error in HTML linting:', error);
    }

    // 更新缓存
    htmlLintCache.set(cacheKey, diagnostics);
    if (htmlLintCache.size > 100) {
        const firstKey = htmlLintCache.keys().next().value;
        htmlLintCache.delete(firstKey);
    }

    return diagnostics;
}

// CSS Lint 函数
// CSS Lint 缓存
const cssLintCache = new Map<string, EnhancedDiagnostic[]>();

function cssLinter(view: EditorView): EnhancedDiagnostic[] {
    const diagnostics: EnhancedDiagnostic[] = [];
    const doc = view.state.doc;
    const code = doc.toString();

    // 检查缓存
    const cacheKey = code;
    if (cssLintCache.has(cacheKey)) {
        return cssLintCache.get(cacheKey)!;
    }

    // --- 使用浏览器原生 CSS 解析（模仿 CodePen） ---
    try {
        // 创建一个临时的 style 元素来测试 CSS 语法
        const tempStyle = document.createElement('style');
        tempStyle.textContent = code;

        // 将元素添加到 document head 中进行解析
        document.head.appendChild(tempStyle);

        // 检查是否有 CSS 解析错误
        const sheet = tempStyle.sheet;
        if (sheet) {
            // 如果能成功创建样式表，说明语法基本正确
            // 检查每个规则是否有效
            try {
                for (let i = 0; i < sheet.cssRules.length; i++) {
                    const rule = sheet.cssRules[i];
                    // 基本的规则验证
                    if (!rule.cssText) {
                        console.warn('Invalid CSS rule found');
                    }
                }
            } catch (ruleError) {
                console.warn('CSS rule access error:', ruleError);
            }
        }

        // 清理临时元素
        document.head.removeChild(tempStyle);

        // 额外的基本语法检查
        const basicSyntaxCheck = (cssCode: string) => {
            const lines = cssCode.split('\n');
            let braceLevel = 0;
            let inComment = false;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                let inString = false;
                let stringChar = '';

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const nextChar = line[i + 1];

                    // 处理注释
                    if (!inString && char === '/' && nextChar === '*') {
                        inComment = true;
                        i++; // 跳过下一个字符
                        continue;
                    }

                    if (inComment && char === '*' && nextChar === '/') {
                        inComment = false;
                        i++; // 跳过下一个字符
                        continue;
                    }

                    if (inComment) continue;

                    // 处理字符串
                    if ((char === '"' || char === "'") && !inString) {
                        inString = true;
                        stringChar = char;
                        continue;
                    }

                    if (inString && char === stringChar) {
                        inString = false;
                        stringChar = '';
                        continue;
                    }

                    if (inString) continue;

                    // 检查括号匹配
                    if (char === '{') {
                        braceLevel++;
                    } else if (char === '}') {
                        braceLevel--;

                        if (braceLevel < 0) {
                            const lineObj = doc.line(lineIndex + 1);
                            const charPos = lineObj.from + i;
                            diagnostics.push({
                                from: charPos,
                                to: charPos + 1,
                                severity: 'error',
                                message: '意外的右花括号 "}"',
                                source: 'static'
                            });
                            braceLevel = 0; // 重置
                        }
                    }
                }
            }

            // 检查未闭合的括号
            if (braceLevel > 0) {
                diagnostics.push({
                    from: cssCode.length - 1,
                    to: cssCode.length,
                    severity: 'error',
                    message: `缺少 ${braceLevel} 个右花括号 "}"`,
                    source: 'static'
                });
            }

            // 检查未闭合的注释
            if (inComment) {
                diagnostics.push({
                    from: cssCode.length - 1,
                    to: cssCode.length,
                    severity: 'error',
                    message: '未闭合的注释 /* ... */',
                    source: 'static'
                });
            }
        };

        basicSyntaxCheck(code);

    } catch (error: any) {
        // 浏览器 CSS 解析错误
        console.warn('CSS 解析错误:', error);

        // 简单的错误处理，不尝试解析复杂的错误信息
        diagnostics.push({
            from: 0,
            to: Math.min(50, code.length),
            severity: 'error',
            message: 'CSS 语法错误',
            source: 'static'
        });
    }

    // 更新缓存
    cssLintCache.set(cacheKey, diagnostics);
    if (cssLintCache.size > 100) {
        const firstKey = cssLintCache.keys().next().value;
        cssLintCache.delete(firstKey);
    }

    return diagnostics;
}

// 辅助函数：检查指定行是否在字符串或注释中
function isLineInStringOrComment(lines: string[], lineIndex: number, fullCode: string): boolean {
    try {
        // 简单的启发式检查
        const line = lines[lineIndex];

        // 检查是否在单行注释中
        if (line.trim().startsWith('//')) {
            return true;
        }

        // 检查是否在多行注释或字符串中
        // 计算到当前行的字符位置
        let position = 0;
        for (let i = 0; i < lineIndex; i++) {
            position += lines[i].length + 1; // +1 for newline
        }

        // 检查从开头到当前位置的代码
        const codeUpToLine = fullCode.substring(0, position);

        // 简单的状态跟踪
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inTemplate = false;
        let inBlockComment = false;
        let inLineComment = false;

        for (let i = 0; i < codeUpToLine.length; i++) {
            const char = codeUpToLine[i];
            const nextChar = codeUpToLine[i + 1];
            const prevChar = codeUpToLine[i - 1];

            // 处理换行（重置行注释状态）
            if (char === '\n') {
                inLineComment = false;
                continue;
            }

            // 如果在行注释中，跳过
            if (inLineComment) continue;

            // 如果在块注释中
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    i++; // 跳过 '/'
                }
                continue;
            }

            // 如果在字符串中
            if (inSingleQuote) {
                if (char === "'" && prevChar !== '\\') {
                    inSingleQuote = false;
                }
                continue;
            }

            if (inDoubleQuote) {
                if (char === '"' && prevChar !== '\\') {
                    inDoubleQuote = false;
                }
                continue;
            }

            if (inTemplate) {
                if (char === '`' && prevChar !== '\\') {
                    inTemplate = false;
                }
                continue;
            }

            // 检查注释开始
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                i++; // 跳过第二个 '/'
                continue;
            }

            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++; // 跳过 '*'
                continue;
            }

            // 检查字符串开始
            if (char === "'") {
                inSingleQuote = true;
                continue;
            }

            if (char === '"') {
                inDoubleQuote = true;
                continue;
            }

            if (char === '`') {
                inTemplate = true;
                continue;
            }
        }

        // 如果到达目标行时仍在字符串或注释中，返回 true
        return inSingleQuote || inDoubleQuote || inTemplate || inBlockComment || inLineComment;

    } catch (error) {
        // 如果检测失败，保守返回 false
        return false;
    }
}

// JavaScript/TypeScript Lint 函数
function jsLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;
    const code = doc.toString();

    // 如果代码为空或只是注释，不进行检查
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
    if (!cleanCode) {
        return diagnostics;
    }

    try {
        // --- 1. 使用 Babel 进行基本语法检查 ---
        try {
            BabelParser.parse(code, {
                strictMode: false,
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true,
                allowAwaitOutsideFunction: true,
                allowUndeclaredExports: true,
                plugins: ['jsx', 'typescript']
            });
        } catch (error: any) {
            // 只报告真正的语法错误
            if (error && error.loc && error.message) {
                let lineNumber = error.loc.line;
                let columnNumber = error.loc.column || 0;

                // 特殊处理：检查是否是关键字拼写错误
                const lines = code.split('\n');
                const errorLine = lines[lineNumber - 1] || '';

                // 关键字拼写错误检测：当报"Missing semicolon"或"Unexpected identifier"时
                // 检查错误位置附近是否有疑似拼错的关键字
                const KEYWORD_TYPO_MAP: Record<string, string> = {
                    'cosnt': 'const', 'conts': 'const', 'ocnst': 'const', 'cnst': 'const', 'consat': 'const', 'constt': 'const',
                    'lte': 'let', 'elt': 'let', 'leet': 'let',
                    'vra': 'var', 'avr': 'var', 'varr': 'var',
                    'fucntion': 'function', 'funtion': 'function', 'funciton': 'function', 'functoin': 'function', 'funtcion': 'function',
                    'retrun': 'return', 'reutrn': 'return', 'retrn': 'return', 'retunr': 'return', 'retur': 'return',
                    'calss': 'class', 'clss': 'class', 'classs': 'class',
                    'improt': 'import', 'ipmort': 'import', 'imoprt': 'import',
                    'exoprt': 'export', 'exprot': 'export', 'exort': 'export',
                    'awiat': 'await', 'awit': 'await', 'awawit': 'await',
                    'asnyc': 'async', 'aysnc': 'async', 'asnc': 'async',
                    'trhow': 'throw', 'thow': 'throw', 'thorw': 'throw',
                    'breka': 'break', 'brek': 'break',
                    'contniue': 'continue', 'contiue': 'continue', 'contineu': 'continue',
                    'whiel': 'while', 'whle': 'while',
                    'esle': 'else', 'els': 'else',
                    'interfce': 'interface', 'inteface': 'interface', 'interafce': 'interface',
                    'tyep': 'type', 'tpye': 'type',
                };

                let typoDetected = false;
                let typoMessage = '';

                if (error.message.includes('Missing semicolon') ||
                    error.message.includes('Unexpected identifier') ||
                    error.message.includes('Unexpected token')) {
                    // 提取错误位置前面的单词
                    const beforeError = errorLine.slice(0, columnNumber).trim();
                    const words = errorLine.trim().split(/\s+/);
                    const firstWord = words[0]?.toLowerCase();

                    // 检查行首单词是否是拼错的关键字
                    if (firstWord && KEYWORD_TYPO_MAP[firstWord]) {
                        typoDetected = true;
                        const correctKeyword = KEYWORD_TYPO_MAP[firstWord];
                        typoMessage = `拼写错误："${words[0]}" 应为 "${correctKeyword}"`;
                        // 调整错误位置到拼错的单词
                        columnNumber = errorLine.indexOf(words[0]);
                    } else if (beforeError && KEYWORD_TYPO_MAP[beforeError.toLowerCase()]) {
                        typoDetected = true;
                        const correctKeyword = KEYWORD_TYPO_MAP[beforeError.toLowerCase()];
                        typoMessage = `拼写错误："${beforeError}" 应为 "${correctKeyword}"`;
                        columnNumber = errorLine.indexOf(beforeError);
                    }
                }

                // 检查当前错误行是否看起来像是由于前面不完整的声明导致的
                const looksLikeDeclarationError = !typoDetected && (
                    // 错误消息包含声明相关的关键词
                    error.message.includes('Missing initialiser') ||
                    error.message.includes('Missing semicolon') ||
                    error.message.includes('Unexpected identifier') ||
                    error.message.includes('Unexpected token') ||
                    error.message.includes('expected') ||
                    // 或者错误行看起来像是正常的代码（不是声明）
                    (errorLine.trim().startsWith('console.') ||
                        errorLine.trim().startsWith('return') ||
                        errorLine.trim().match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/))
                );

                if (looksLikeDeclarationError) {
                    // 查找前面的不完整声明关键字
                    const keywords = ['const', 'let', 'var', 'function', 'class', 'interface', 'type'];

                    let found = false;
                    for (let i = lineNumber - 2; i >= Math.max(0, lineNumber - 3) && !found; i--) {
                        const line = lines[i];
                        const trimmedLine = line.trim();

                        // 检查这一行是否在字符串或注释中
                        if (isLineInStringOrComment(lines, i, code)) {
                            continue;
                        }

                        for (const keyword of keywords) {
                            // 检查是否是独立的关键字（不完整的声明）
                            if (trimmedLine === keyword) {
                                lineNumber = i + 1;
                                columnNumber = line.indexOf(keyword);
                                found = true;
                                break;
                            }
                        }
                    }
                }

                try {
                    const lineObj = doc.line(lineNumber);
                    const from = lineObj.from + Math.min(columnNumber, lineObj.length);
                    const to = Math.min(from + 10, lineObj.to);

                    // 如果检测到拼写错误，直接使用拼写错误提示
                    let message: string;
                    if (typoDetected) {
                        message = typoMessage;
                    } else {
                        // 清理错误信息，提供更友好的中文提示
                        message = error.message
                            .replace(/^SyntaxError:\s*/, '')
                            .replace(/\s*\(\d+:\d+\)$/, '')
                            // 声明相关错误
                            .replace(/Missing initialiser in const declaration.*/, 'const 声明缺少变量名和初始化值')
                            .replace(/Missing initialiser in let declaration.*/, 'let 声明缺少变量名')
                            .replace(/Missing initialiser in var declaration.*/, 'var 声明缺少变量名')
                            .replace(/Unexpected identifier.*/, '语法错误：意外的标识符')
                            .replace(/Unexpected reserved word.*/, '语法错误：意外的保留字')
                            // 函数相关错误
                            .replace(/Unexpected token, expected.*/, '语法错误：缺少必要的语法元素')
                            .replace(/Missing function name.*/, '函数声明缺少函数名')
                            // 通用语法错误
                            .replace(/^Unexpected token.*/, '语法错误：意外的标记')
                            .replace(/^Missing semicolon.*/, '语法错误：缺少分号')
                            .replace(/^Unterminated string constant.*/, '语法错误：未闭合的字符串')
                            .replace(/^Unterminated comment.*/, '语法错误：未闭合的注释')
                            .replace(/Unexpected end of input.*/, '语法错误：代码意外结束')
                            // 括号相关错误
                            .replace(/Expected.*but found.*/, '语法错误：括号或标点符号不匹配')
                            .replace(/Missing closing.*/, '语法错误：缺少闭合符号');
                    }

                    diagnostics.push({
                        from,
                        to,
                        severity: 'error',
                        message
                    });
                } catch (lineError) {
                    // 忽略行获取错误
                }
            }
        }

        // 只进行基本的语法检查，不做复杂的静态分析或危险函数检测
    } catch (error: any) {
        // 捕获 linting 工具本身可能抛出的其他错误
        diagnostics.push({
            from: 0,
            to: code.length,
            severity: 'error',
            message: `JavaScript linting 错误: ${error.message}`
        });
    }

    return diagnostics;
}

// 安全的错误检测包装器
function safeErrorDetection<T extends Diagnostic[]>(
    linterFn: (view: EditorView) => T,
    fallbackMessage: string = '错误检测器暂时不可用，请稍后重试'
): (view: EditorView) => T {
    return (view: EditorView) => {
        try {
            const start = performance.now();
            const result = linterFn(view);
            const end = performance.now();

            // 性能监控
            if (end - start > 1000) {
                console.warn(`Slow error detection (${linterFn.name}):`, end - start, 'ms');
            }

            return result;
        } catch (error) {
            console.warn('Error detection failed:', error);
            return [{
                from: 0,
                to: 0,
                severity: 'warning',
                message: fallbackMessage
            }] as T;
        }
    };
}

// 创建增强的 linter，结合 CodeMirror 原生 lint 和自定义错误消息
function createEnhancedLinter(linterFn: (view: EditorView) => Diagnostic[], lang: 'js' | 'css' | 'html' = 'js') {
    const debouncedLinter = debounce((view: EditorView) => {
        try {
            const diagnostics = linterFn(view);
            const errors = diagnostics.map(d => {
                try {
                    const line = view.state.doc.lineAt(d.from).number;
                    const message = formatErrorMessage(d.message, lang);
                    return {
                        line,
                        message,
                        type: d.severity as 'error' | 'warning',
                        fixes: (d as EnhancedDiagnostic).fixes,
                        source: 'static' as const,
                        from: d.from,
                        to: d.to
                    };
                } catch (e) {
                    console.warn('Error processing diagnostic:', e);
                    return null;
                }
            }).filter((error): error is NonNullable<typeof error> => error !== null);

            if (errors.length > 0) {
                view.dispatch({
                    effects: [
                        clearAllErrorDecorations.of(null),
                        addStaticErrorDecorations.of(errors)
                    ]
                });
            } else {
                view.dispatch({
                    effects: [clearStaticErrorDecorations.of(null)]
                });
            }
        } catch (error) {
            console.warn('Error in debounced linter:', error);
        }
    }, 300);

    return [
        errorInfoField,
        errorDecorationField,
        errorMessageTheme,
        errorGutterExtension,
        errorTooltipExtension,
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                // 代码变化时立即清除运行时错误（旧的运行时错误已失效）
                const currentErrors = update.state.field(errorInfoField, false) ?? [];
                if (currentErrors.some(e => e.source === 'runtime')) {
                    update.view.dispatch({
                        effects: [clearRuntimeErrorDecorations.of(null)]
                    });
                }
                if (!degradationController.isStrategyActive('skip_lint')) {
                    debouncedLinter(update.view);
                }
            }
        })
    ];
}

// 运行时错误处理函数
export function addRuntimeErrorsToEditor(
    view: EditorView,
    errors: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }>
) {
    if (!view) return;

    try {
        const currentErrors = view.state.field(errorInfoField, false) ?? [];
        const hasStaticErrors = currentErrors.some(e => e.source === 'static');
        if (hasStaticErrors) return;

        const runtimeErrors = errors.map(error => {
            try {
                const lineNum = Math.max(1, Math.min(error.line, view.state.doc.lines));
                const lineObj = view.state.doc.line(lineNum);
                const col = Math.min(error.column || 0, lineObj.length);
                return {
                    line: lineNum,
                    message: error.message,
                    type: error.severity,
                    source: 'runtime' as const,
                    from: lineObj.from + col,
                    to: lineObj.to
                };
            } catch (e) {
                console.warn('Error processing runtime error:', e);
                return null;
            }
        }).filter((error): error is NonNullable<typeof error> => error !== null);

        // 按 line+message 去重，防止 iframe 多个错误处理器重复上报同一错误
        const seen = new Set<string>();
        const dedupedErrors = runtimeErrors.filter(e => {
            const key = `${e.line}:${e.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        view.dispatch({
            effects: [
                clearRuntimeErrorDecorations.of(null),
                addRuntimeErrorDecorations.of(dedupedErrors)
            ]
        });
    } catch (error) {
        console.error('Failed to add runtime errors to editor:', error);
    }
}

// 清空运行时错误的工具函数
export function clearRuntimeErrorsFromEditor(view: EditorView) {
    if (!view) return;

    try {
        view.dispatch({
            effects: [clearRuntimeErrorDecorations.of(null)]
        });
    } catch (error) {
        console.warn('Failed to clear runtime errors from editor:', error);
    }
}

// 导出增强的 lint 扩展
export const htmlLint = createEnhancedLinter(safeErrorDetection(htmlLinter), 'html');
export const cssLint = createEnhancedLinter(safeErrorDetection(cssLinter), 'css');
export const jsLint = createEnhancedLinter(safeErrorDetection(jsLinter), 'js');

// 导出运行时错误扩展（保持向后兼容）
export const runtimeErrorExtension = [
    errorInfoField,
    errorDecorationField,
    errorMessageTheme,
    errorGutterExtension,
    errorTooltipExtension
];