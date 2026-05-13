import React, { useEffect, useState, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import {
    EditorContainer,
    TabContainer,
    TabButton,
    EditorContent,
    CodeEditor,
    NoContent,
    ImportCount
} from '../styles/readOnlyEditorStyles';

type TabType = 'html' | 'css' | 'js';

interface ImportedPen {
    id: string;
    title: string;
    css: string;
    js: string;
}

interface ReadOnlyEditorProps {
    html: string;
    css: string;
    js: string;
    jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
    importedCssPens?: ImportedPen[];
    importedJsPens?: ImportedPen[];
    currentPenTitle?: string;
}

const ReadOnlyEditor: React.FC<ReadOnlyEditorProps> = ({
    html: htmlContent,
    css: cssContent,
    js: jsContent,
    jsLanguage = 'js',
    importedCssPens = [],
    importedJsPens = [],
    currentPenTitle = '当前 Pen'
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('html');
    const [editor, setEditor] = useState<EditorView | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    // 创建只读编辑器的辅助函数
    const createReadOnlyEditor = (
        element: HTMLElement,
        langExtension: Extension,
        content: string
    ) => {
        const commonExtensions = [
            lineNumbers({
                formatNumber: (lineNo) => lineNo.toString()
            }),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            drawSelection({
                drawRangeCursor: true
            }),
            dropCursor(),
            rectangularSelection(),
            crosshairCursor(),
            highlightActiveLine(),
            keymap.of([
                indentWithTab,
                ...defaultKeymap,
                ...historyKeymap
            ]),
            history(),
            syntaxHighlighting(defaultHighlightStyle),
            // 设置为只读模式
            EditorView.editable.of(false),
            // 确保选择功能正常工作和字体优化
            EditorView.theme({
                '&.cm-focused .cm-selectionBackground': {
                    backgroundColor: '#b3d4fc !important'
                },
                '.cm-selectionBackground': {
                    backgroundColor: '#c8e1ff !important'
                },
                '.cm-content': {
                    fontFamily: '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
                    fontSize: '13px !important',
                    fontWeight: 'normal !important',
                    lineHeight: '1.3 !important',
                    letterSpacing: '0 !important',
                    textRendering: 'auto !important',
                    WebkitFontSmoothing: 'auto !important',
                    MozOsxFontSmoothing: 'auto !important',
                    fontVariantLigatures: 'none !important'
                },
                '.cm-editor .cm-line': {
                    fontFamily: '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
                    fontSize: '13px !important',
                    fontWeight: 'normal !important',
                    lineHeight: '1.3 !important',
                    letterSpacing: '0 !important'
                },
                '.cm-editor': {
                    fontFamily: '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important'
                },
                '.cm-gutters': {
                    fontFamily: '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
                    fontSize: '12px !important'
                }
            })
        ];

        const state = EditorState.create({
            doc: content,
            extensions: [
                ...commonExtensions,
                langExtension
            ]
        });

        const view = new EditorView({
            state,
            parent: element
        });

        setEditor(view);
        return view;
    };

    // 生成合并的 CSS 代码，包含导入的代码和注释
    const getMergedCssContent = (): string => {
        const parts: string[] = [];

        // 添加导入的 CSS
        importedCssPens.forEach((pen, index) => {
            if (pen.css.trim()) {
                parts.push(`/* ==========================================`);
                parts.push(` * 导入的 CSS #${index + 1}: ${pen.title}`);
                parts.push(` * ========================================== */`);
                parts.push(pen.css.trim());
                parts.push('');
            }
        });

        // 添加当前 Pen 的 CSS
        if (cssContent.trim()) {
            if (parts.length > 0) {
                parts.push(`/* ==========================================`);
                parts.push(` * ${currentPenTitle} (当前编辑)`);
                parts.push(` * ========================================== */`);
            }
            parts.push(cssContent.trim());
        }

        return parts.join('\n');
    };

    // 生成合并的 JS 代码，包含导入的代码和注释
    const getMergedJsContent = (): string => {
        const parts: string[] = [];

        // 添加导入的 JS
        importedJsPens.forEach((pen, index) => {
            if (pen.js.trim()) {
                parts.push(`/* ==========================================`);
                parts.push(` * 导入的 JS #${index + 1}: ${pen.title}`);
                parts.push(` * ========================================== */`);
                parts.push(pen.js.trim());
                parts.push('');
            }
        });

        // 添加当前 Pen 的 JS
        if (jsContent.trim()) {
            if (parts.length > 0) {
                parts.push(`/* ==========================================`);
                parts.push(` * ${currentPenTitle} (当前编辑)`);
                parts.push(` * ========================================== */`);
            }
            parts.push(jsContent.trim());
        }

        return parts.join('\n');
    };

    // 根据当前标签页获取内容和语言扩展
    const getCurrentContent = (): { content: string; extension: Extension } => {
        switch (activeTab) {
            case 'html':
                return { content: htmlContent, extension: html() };
            case 'css':
                const mergedCss = getMergedCssContent();
                return { content: mergedCss, extension: css() };
            case 'js':
                const mergedJs = getMergedJsContent();
                const jsExtension = jsLanguage === 'ts'
                    ? javascript({ typescript: true })
                    : javascript();
                return { content: mergedJs, extension: jsExtension };
            default:
                return { content: htmlContent, extension: html() };
        }
    };

    // 当标签页改变时重新创建编辑器
    useEffect(() => {
        if (!editorRef.current) return;

        // 销毁现有编辑器
        if (editor) {
            editor.destroy();
            setEditor(null);
        }

        // 清空容器
        editorRef.current.innerHTML = '';

        // 获取当前内容
        const { content, extension } = getCurrentContent();

        // 创建新编辑器
        if (editorRef.current) {
            createReadOnlyEditor(editorRef.current, extension, content);
        }

        return () => {
            if (editor) {
                editor.destroy();
            }
        };
    }, [activeTab, htmlContent, cssContent, jsContent, jsLanguage, importedCssPens, importedJsPens, currentPenTitle]);

    const handleTabClick = (tab: TabType) => {
        setActiveTab(tab);
    };

    // 计算导入数量用于标签显示
    const cssImportCount = importedCssPens.length;
    const jsImportCount = importedJsPens.length;

    return (
        <EditorContainer>
            <TabContainer>
                <TabButton
                    active={activeTab === 'html'}
                    onClick={() => handleTabClick('html')}
                >
                    HTML
                </TabButton>
                <TabButton
                    active={activeTab === 'css'}
                    onClick={() => handleTabClick('css')}
                >
                    CSS {cssImportCount > 0 && <ImportCount>({cssImportCount + 1})</ImportCount>}
                </TabButton>
                <TabButton
                    active={activeTab === 'js'}
                    onClick={() => handleTabClick('js')}
                >
                    {jsLanguage === 'ts' ? 'TS' : 'JS'} {jsImportCount > 0 && <ImportCount>({jsImportCount + 1})</ImportCount>}
                </TabButton>
            </TabContainer>
            <EditorContent>
                <CodeEditor ref={editorRef} />
            </EditorContent>
        </EditorContainer>
    );
};

export default ReadOnlyEditor; 