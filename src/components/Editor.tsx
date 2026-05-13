import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorView } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { useAuth } from '../contexts/AuthContext';
import EditorShell from './editor/EditorShell';
import { usePenBootstrap } from '../hooks/usePenBootstrap';
import { useEditorInitialization } from '../hooks/useEditorInitialization';
import { usePreviewPipeline } from '../hooks/usePreviewPipeline';
import { useDegradation } from '../hooks/useDegradation';
import { DebugManager } from '../services/debugService';
import AIAgentPanel, { AgentPanelState, PatchStatus } from './AIAgentPanel';
import { requestAgentPlan } from '../services/agentService';
import { requestAgentPatch, PatchProposal, PatchOperation } from '../services/patchService';
import { buildAgentPlanRequest } from '../services/agentContextBuilder';
import { createSnapshot, PenSnapshot } from '../services/snapshotService';
import { addRuntimeErrorsToEditor, clearRuntimeErrorsFromEditor, errorInfoField, addStaticErrorDecorations, clearStaticErrorDecorations, clearAllErrorDecorations, addRuntimeErrorDecorations, clearRuntimeErrorDecorations } from '../services/lintService';

const PerfPanel = React.lazy(() => import('./PerfPanel/PerfPanel'));

const Editor: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const params = useParams();
    const [penState, penActions] = usePenBootstrap();
    const {
        currentPen,
        userPens,
        isPenLoaded,
        isSaving,
        isSavingPen,
        isDeleting,
        saveSuccess,
        hasUnsavedChanges,
        title,
        htmlCode,
        cssCode,
        jsCode,
        cssLanguage,
        jsLanguage,
        importedCssPenIds,
        importedJsPenIds
    } = penState;
    const {
        setTitle,
        setHtmlCode,
        setCssCode,
        setJsCode,
        setCssLanguage,
        setJsLanguage,
        setImportedCssPenIds,
        setImportedJsPenIds,
        handleSave,
        handleDelete,
        handleLoadPen,
        handleNew,
        checkForChanges
    } = penActions;
    const [editorState, editorActions] = useEditorInitialization(
        htmlCode,
        cssCode,
        jsCode,
        cssLanguage,
        jsLanguage,
        isPenLoaded,
        isSavingPen,
        setHtmlCode,
        setCssCode,
        setJsCode
    );
    const { htmlEditor, cssEditor, jsEditor, isUpdatingFromState } = editorState;
    const { setShouldReinitializeEditors } = editorActions;

    const degradation = useDegradation();
    const debounceMs = degradation.activeStrategies.includes('increased_debounce') ? 800 : 300;

    const [previewState] = usePreviewPipeline(
        htmlCode,
        cssCode,
        jsCode,
        cssLanguage,
        jsLanguage,
        userPens,
        importedCssPenIds,
        importedJsPenIds,
        debounceMs
    );
    const {
        compiledCss,
        compiledJs,
        debouncedHtml,
        debouncedMergedCss,
        debouncedMergedJs,
        jsCompilationError,
        tsCompilerLoaded
    } = previewState;

    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showCssImportPanel, setShowCssImportPanel] = useState(false);
    const [showJsImportPanel, setShowJsImportPanel] = useState(false);
    const [draggedCssIndex, setDraggedCssIndex] = useState<number | null>(null);
    const [draggedJsIndex, setDraggedJsIndex] = useState<number | null>(null);

    // Debug functionality
    const [debugEnabled, setDebugEnabled] = useState(false);
    const debugManagerRef = useRef<DebugManager>(new DebugManager());
    const [perfPanelVisible, setPerfPanelVisible] = useState(false);

    // 静态错误状态
    const [hasStaticErrors, setHasStaticErrors] = useState(false);
    const [jsErrorCount, setJsErrorCount] = useState(0);
    const [jsWarningCount, setJsWarningCount] = useState(0);

    // Agent 面板状态
    const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
    const [agentPlanState, setAgentPlanState] = useState<AgentPanelState>({ status: 'idle' });
    const agentAbortRef = useRef<AbortController | null>(null);

    // Patch 状态
    const [patchStatus, setPatchStatus] = useState<PatchStatus>('idle');
    const [patchProposal, setPatchProposal] = useState<PatchProposal | null>(null);
    const [patchError, setPatchError] = useState<string>('');
    const patchAbortRef = useRef<AbortController | null>(null);

    // 快照状态（Phase C 回滚）
    const [lastSnapshot, setLastSnapshot] = useState<PenSnapshot | null>(null);

    // 标记 patch 触发的语言切换，防止 useEffect 用默认代码覆盖 AI 生成的代码
    const patchLanguageSwitchRef = useRef(false);

    // 检查静态错误（如lint）— 由 errorSyncExtension 触发，不再依赖 jsCode 变化
    const checkStaticErrors = useCallback(() => {
        if (!jsEditor) return;
        try {
            const errors = jsEditor.state.field(errorInfoField, false) ?? [];
            const staticErrors = errors.filter(e => e.source === 'static');
            const hasError = staticErrors.length > 0;
            const previousHasStaticErrors = hasStaticErrors;
            setHasStaticErrors(hasError);
            setJsErrorCount(errors.filter(e => e.type === 'error').length);
            setJsWarningCount(errors.filter(e => e.type === 'warning').length);

            if (previousHasStaticErrors !== hasError) {
                clearRuntimeErrorsFromEditor(jsEditor);
            }
        } catch (e) {
            setHasStaticErrors(false);
        }
    }, [jsEditor, hasStaticErrors]);

    const currentErrorsForAgent = useMemo(() => {
        if (!jsEditor) return [];
        return (jsEditor.state.field(errorInfoField, false) ?? [])
            .filter((e: any) => e.source === 'static')
            .map((e: any) => ({
                target: 'js' as const,
                severity: e.type === 'error' ? 'error' as const : 'warning' as const,
                message: e.message,
                line: e.line,
                column: e.column
            }));
    }, [jsEditor]);

    const handleNavigateNextError = useCallback(() => {
        if (!jsEditor) return;
        const errors = jsEditor.state.field(errorInfoField, false) ?? [];
        if (errors.length === 0) return;
        const sorted = [...errors].sort((a, b) => a.from - b.from);
        const curPos = jsEditor.state.selection.main.head;
        const next = sorted.find(e => e.from > curPos) ?? sorted[0];
        jsEditor.dispatch({ selection: { anchor: next.from }, scrollIntoView: true });
        jsEditor.focus();
    }, [jsEditor]);

    // 运行时错误处理（静态错误优先）
    const handleRuntimeError = useCallback((errors: Array<{
        line: number;
        column: number;
        message: string;
        severity: 'error' | 'warning';
    }>) => {
        if (jsEditor) {
            if (!hasStaticErrors) {
                if (errors.length > 0) {
                    addRuntimeErrorsToEditor(jsEditor, errors);
                } else {
                    clearRuntimeErrorsFromEditor(jsEditor);
                }
            } else {
                // 有静态错误时，始终清除运行时错误高亮
                clearRuntimeErrorsFromEditor(jsEditor);
            }
        }
    }, [jsEditor, hasStaticErrors]);

    // 监听 errorInfoField 变化来同步错误状态（替代基于 jsCode 的即时读取）
    useEffect(() => {
        if (!jsEditor) return;
        const listener = EditorView.updateListener.of((update) => {
            const hasErrorEffect = update.transactions.some(tr =>
                tr.effects.some(e =>
                    e.is(addStaticErrorDecorations) || e.is(clearStaticErrorDecorations) ||
                    e.is(clearAllErrorDecorations) || e.is(addRuntimeErrorDecorations) ||
                    e.is(clearRuntimeErrorDecorations)
                )
            );
            if (hasErrorEffect) {
                checkStaticErrors();
            }
        });
        jsEditor.dispatch({ effects: StateEffect.appendConfig.of(listener) });
    }, [jsEditor]); // eslint-disable-line react-hooks/exhaustive-deps

    // 预览编译与防抖已下沉到 usePreviewPipeline

    // 监听 errorInfoField 变化来同步错误状态（替代基于 jsCode 的即时读取）
    useEffect(() => {
        if (!jsEditor) return;
        const listener = EditorView.updateListener.of((update) => {
            const hasErrorEffect = update.transactions.some(tr =>
                tr.effects.some(e =>
                    e.is(addStaticErrorDecorations) || e.is(clearStaticErrorDecorations) ||
                    e.is(clearAllErrorDecorations) || e.is(addRuntimeErrorDecorations) ||
                    e.is(clearRuntimeErrorDecorations)
                )
            );
            if (hasErrorEffect) {
                checkStaticErrors();
            }
        });
        jsEditor.dispatch({ effects: StateEffect.appendConfig.of(listener) });
    }, [jsEditor]); // eslint-disable-line react-hooks/exhaustive-deps

    // 页面关闭/刷新时的提示
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return '您有未保存的更改，确定要离开吗？';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleBackToHome = () => {
        if (hasUnsavedChanges) {
            const confirmLeave = window.confirm('您有未保存的更改，确定要离开吗？');
            if (!confirmLeave) return;
        }
        navigate('/pens');
    };

    const handleShare = () => {
        if (!currentPen) return;
        const url = `${window.location.origin}/p/${currentPen.id}`;
        setShareUrl(url);
        setShowShareModal(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setToastMessage('链接已复制到剪贴板！');
        setShowToast(true);
        setShowShareModal(false);
        setTimeout(() => {
            setShowToast(false);
        }, 2000);
    };

    // 处理CSS语言切换
    const handleCssLanguageChange = (newLanguage: 'css' | 'scss' | 'less') => {
        setCssLanguage(newLanguage);
        // 标记需要重新初始化编辑器
        setShouldReinitializeEditors(true);
    };

    // 处理JavaScript语言切换
    const handleJsLanguageChange = (newLanguage: 'js' | 'react' | 'vue' | 'ts') => {
        console.log('🔧 Language Change Debug - Switching to:', newLanguage);
        setJsLanguage(newLanguage);

        // 如果是新建状态且当前代码是默认代码，则更新默认代码
        if (!currentPen) {
            const currentHtml = htmlEditor?.state.doc.toString() || htmlCode;
            const currentCss = cssEditor?.state.doc.toString() || cssCode;
            const currentJs = jsEditor?.state.doc.toString() || jsCode;

            console.log('🔧 Language Change Debug - Current content:', {
                html: currentHtml,
                css: currentCss,
                js: currentJs
            });

            // 检查是否是默认代码
            const isDefaultHtml = currentHtml === '<div id="app">Hello World</div>' ||
                currentHtml === '<div id="app"></div>';
            const isDefaultCss = currentCss === 'body { color: blue; }' ||
                currentCss === 'body {\n  font-family: -apple-system, BlinkMacSystemFont, sans-serif;\n  margin: 0;\n  padding: 20px;\n}';
            const isDefaultJs = currentJs === 'console.log("Hello World");' ||
                currentJs === 'function App() {\n  return <h1>Hello React!</h1>;\n}\n\nconst root = ReactDOM.createRoot(document.getElementById("app"));\nroot.render(<App />);' ||
                currentJs === 'const { createApp } = Vue;\n\nconst component = {\n  setup() {\n    return {\n      message: "Hello Vue!"\n    };\n  },\n  template: `<h1>{{ message }}</h1>`\n};\n\ncreateApp(component).mount("#app");' ||
                currentJs === 'function App() {\n  return <h1>Hello React!</h1>;\n}\n\nconst root = ReactDOM.createRoot(document.getElementById("app"));\nwindow.reactRoot = root;\nroot.render(<App />);' ||
                currentJs === 'const { createApp } = Vue;\n\nconst component = {\n  setup() {\n    return {\n      message: "Hello Vue!"\n    };\n  },\n  template: `<h1>{{ message }}</h1>`\n};\n\nconst app = createApp(component);\nwindow.vueApp = app;\napp.mount("#app");' ||
                currentJs === 'console.log("Hello TypeScript!");';

            console.log('🔧 Language Change Debug - Is default code:', {
                isDefaultHtml,
                isDefaultCss,
                isDefaultJs
            });

            if (isDefaultJs) {
                const defaultJs = newLanguage === 'react'
                    ? 'function App() {\n  return <h1>Hello React!</h1>;\n}\n\nconst root = ReactDOM.createRoot(document.getElementById("app"));\nwindow.reactRoot = root;\nroot.render(<App />);'
                    : newLanguage === 'vue'
                        ? 'const { createApp } = Vue;\n\nconst component = {\n  setup() {\n    return {\n      message: "Hello Vue!"\n    };\n  },\n  template: `<h1>{{ message }}</h1>`\n};\n\nconst app = createApp(component);\nwindow.vueApp = app;\napp.mount("#app");'
                        : newLanguage === 'ts'
                            ? 'console.log("Hello TypeScript!");'
                            : 'console.log("Hello World");';

                console.log('🔧 Language Change Debug - Setting default JS code:', defaultJs);
                setJsCode(defaultJs);

                if (isDefaultJs || isDefaultHtml || isDefaultCss) {
                    // 获取新语言对应的默认代码
                    const getNewDefaultHtml = () => {
                        switch (newLanguage) {
                            case 'react':
                            case 'vue':
                                return '<div id="app"></div>';
                            default:
                                return '<div id="app">Hello World</div>';
                        }
                    };

                    const getNewDefaultCss = () => {
                        switch (newLanguage) {
                            case 'react':
                            case 'vue':
                                return 'body {\n  font-family: -apple-system, BlinkMacSystemFont, sans-serif;\n  margin: 0;\n  padding: 20px;\n}';
                            default:
                                return 'body { color: blue; }';
                        }
                    };

                    const getNewDefaultJs = () => {
                        switch (newLanguage) {
                            case 'react':
                                return 'function App() {\n  return <h1>Hello React!</h1>;\n}\n\nconst root = ReactDOM.createRoot(document.getElementById("app"));\nwindow.reactRoot = root;\nroot.render(<App />);';
                            case 'vue':
                                return 'const { createApp } = Vue;\n\nconst component = {\n  setup() {\n    return {\n      message: "Hello Vue!"\n    };\n  },\n  template: `<h1>{{ message }}</h1>`\n};\n\nconst app = createApp(component);\nwindow.vueApp = app;\napp.mount("#app");';
                            case 'ts':
                                return 'console.log("Hello TypeScript!");';
                            default:
                                return 'console.log("Hello World");';
                        }
                    };

                    const newDefaultHtml = getNewDefaultHtml();
                    const newDefaultCss = getNewDefaultCss();
                    const newDefaultJs = getNewDefaultJs();

                    console.log('🔧 Language Change Debug - Updating default content:', {
                        newDefaultHtml,
                        newDefaultCss,
                        newDefaultJs
                    });

                    // 只更新是默认内容的部分
                    if (isDefaultHtml) setHtmlCode(newDefaultHtml);
                    if (isDefaultCss) {
                        setCssCode(newDefaultCss);
                    }
                    if (isDefaultJs) {
                        setJsCode(newDefaultJs);
                    }
                }
            } else {
                // 如果不是默认代码，但语言切换到了React/Vue，需要确保HTML是空的容器
                if (newLanguage === 'react' || newLanguage === 'vue') {
                    const currentHtml = htmlEditor?.state.doc.toString() || htmlCode;
                    console.log('🔧 Language Change Debug - Non-default code, current HTML:', currentHtml);
                    // 如果HTML不是空的容器，则更新为空的容器
                    if (currentHtml !== '<div id="app"></div>') {
                        console.log('🔧 Language Change Debug - Updating HTML to empty container');
                        setHtmlCode('<div id="app"></div>');
                    } else {
                        console.log('🔧 Language Change Debug - HTML already empty container');
                    }
                }
            }

            // 标记需要重新初始化编辑器
            setShouldReinitializeEditors(true);
        }
    };

    // Debug toggle handler
    const handleToggleDebug = () => {
        const newState = debugManagerRef.current.toggle();
        setDebugEnabled(newState);
    };

    // Agent 提交处理
    const handleAgentSubmit = useCallback(async (instruction: string) => {
        if (agentAbortRef.current) {
            agentAbortRef.current.abort();
        }
        const controller = new AbortController();
        agentAbortRef.current = controller;

        setAgentPlanState({ status: 'loading' });
        setPatchStatus('idle');
        setPatchProposal(null);
        setPatchError('');

        try {
            const jsErrors = jsEditor
                ? (jsEditor.state.field(errorInfoField, false) ?? [])
                    .filter((e: any) => e.source === 'static')
                    .map((e: any) => ({
                        target: 'js' as const,
                        severity: e.type === 'error' ? 'error' as const : 'warning' as const,
                        message: e.message,
                        line: e.line,
                        column: e.column
                    }))
                : [];

            const payload = buildAgentPlanRequest({
                penId: currentPen?.id,
                title,
                htmlCode: htmlCode,
                cssCode: cssCode,
                jsCode: jsCode,
                cssLanguage,
                jsLanguage,
                jsEditor,
                errors: jsErrors,
                userInstruction: instruction
            });

            const data = await requestAgentPlan(payload, controller.signal);
            setAgentPlanState({ status: 'success', data });
        } catch (error: any) {
            if (error?.name === 'AbortError') return;
            setAgentPlanState({ status: 'error', message: error?.message || 'Agent 请求失败' });
        }
    }, [currentPen, title, htmlCode, cssCode, jsCode, cssLanguage, jsLanguage, jsEditor]);

    // Patch 请求处理
    const handleRequestPatch = useCallback(async (instruction: string) => {
        if (agentPlanState.status !== 'success') return;
        if (patchStatus === 'loading') return;

        if (patchAbortRef.current) {
            patchAbortRef.current.abort();
        }
        const controller = new AbortController();
        patchAbortRef.current = controller;

        setPatchStatus('loading');
        setPatchError('');

        try {
            const plan = agentPlanState.data.plan;

            const jsErrors = jsEditor
                ? (jsEditor.state.field(errorInfoField, false) ?? [])
                    .filter((e: any) => e.source === 'static')
                    .map((e: any) => ({
                        target: 'js' as const,
                        severity: e.type === 'error' ? 'error' as const : 'warning' as const,
                        message: e.message,
                        line: e.line,
                        column: e.column
                    }))
                : [];

            const data = await requestAgentPatch({
                penId: currentPen?.id,
                title,
                html: htmlCode,
                css: cssCode,
                js: jsCode,
                cssLanguage,
                jsLanguage,
                errors: jsErrors,
                userInstruction: instruction,
                plan
            }, controller.signal);

            setPatchStatus('success');
            setPatchProposal(data.proposal);
        } catch (error: any) {
            if (error?.name === 'AbortError') return;
            setPatchStatus('error');
            setPatchError(error?.message || 'Patch 生成失败');
        }
    }, [agentPlanState, patchStatus, currentPen, title, htmlCode, cssCode, jsCode, cssLanguage, jsLanguage, jsEditor]);

    // Patch 应用
    const handleApplyPatch = useCallback((operations: PatchOperation[], patchSummary?: string) => {
        // 应用前保存快照
        const targets = operations.map(op => op.target);
        const summary = patchSummary || patchProposal?.summary || '未知改动';
        const traceId = agentPlanState.status === 'success' ? agentPlanState.data.traceId : undefined;

        const snapshot = createSnapshot({
            html: htmlCode,
            css: cssCode,
            js: jsCode,
            cssLanguage,
            jsLanguage,
            patchSummary: summary,
            patchTargets: targets,
            traceId
        });
        setLastSnapshot(snapshot);

        // 应用代码变更
        operations.forEach(op => {
            if (op.target === 'html') setHtmlCode(op.after);
            if (op.target === 'css') setCssCode(op.after);
            if (op.target === 'js') setJsCode(op.after);
        });

        // 同步切换语言模式
        if (patchProposal?.languages) {
            const { cssLanguage: newCssLang, jsLanguage: newJsLang } = patchProposal.languages;
            if (newCssLang && newCssLang !== cssLanguage) {
                setCssLanguage(newCssLang);
                setShouldReinitializeEditors(true);
            }
            if (newJsLang && newJsLang !== jsLanguage) {
                patchLanguageSwitchRef.current = true;
                setJsLanguage(newJsLang);
                setShouldReinitializeEditors(true);
            }
        }

        setPatchStatus('idle');
        setPatchProposal(null);
        setAgentPlanState({ status: 'idle' });
    }, [patchProposal, cssLanguage, jsLanguage, htmlCode, cssCode, jsCode, agentPlanState]);

    // 撤销上一次 AI 改动
    const handleRollback = useCallback(() => {
        if (!lastSnapshot) return;
        console.log('[Agent] Rollback applied, traceId:', lastSnapshot.traceId);

        setHtmlCode(lastSnapshot.html);
        setCssCode(lastSnapshot.css);
        setJsCode(lastSnapshot.js);

        if (lastSnapshot.cssLanguage !== cssLanguage) {
            setCssLanguage(lastSnapshot.cssLanguage);
            setShouldReinitializeEditors(true);
        }
        if (lastSnapshot.jsLanguage !== jsLanguage) {
            patchLanguageSwitchRef.current = true;
            setJsLanguage(lastSnapshot.jsLanguage);
            setShouldReinitializeEditors(true);
        }

        setLastSnapshot(null);
        setAgentPlanState({ status: 'idle' });
        setPatchStatus('idle');
    }, [lastSnapshot, cssLanguage, jsLanguage]);

    // Patch 放弃
    const handleRejectPatch = useCallback(() => {
        setPatchStatus('idle');
        setPatchProposal(null);
        setPatchError('');
    }, []);

    useEffect(() => {
        console.log('🔧 isPenLoaded changed:', isPenLoaded);
    }, [isPenLoaded]);

    return (
    <>
        <EditorShell
            title={title}
            setTitle={setTitle}
            currentPen={currentPen}
            userPens={userPens}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            isDeleting={isDeleting}
            debugEnabled={debugEnabled}
            isAgentPanelOpen={isAgentPanelOpen}
            setIsAgentPanelOpen={setIsAgentPanelOpen}
            handleBackToHome={handleBackToHome}
            handleLoadPen={handleLoadPen}
            handleSave={handleSave}
            handleDelete={handleDelete}
            handleShare={handleShare}
            handleCopyShareLink={copyToClipboard}
            handleToggleDebug={handleToggleDebug}
            cssLanguage={cssLanguage}
            jsLanguage={jsLanguage}
            handleCssLanguageChange={handleCssLanguageChange}
            handleJsLanguageChange={handleJsLanguageChange}
            htmlEditor={htmlEditor}
            cssEditor={cssEditor}
            jsEditor={jsEditor}
            debouncedHtml={debouncedHtml}
            debouncedMergedCss={debouncedMergedCss}
            debouncedMergedJs={debouncedMergedJs}
            importedCssPenIds={importedCssPenIds}
            setImportedCssPenIds={setImportedCssPenIds}
            showCssImportPanel={showCssImportPanel}
            setShowCssImportPanel={setShowCssImportPanel}
            importedJsPenIds={importedJsPenIds}
            setImportedJsPenIds={setImportedJsPenIds}
            showJsImportPanel={showJsImportPanel}
            setShowJsImportPanel={setShowJsImportPanel}
            userPensForImport={userPens}
            draggedCssIndex={draggedCssIndex}
            setDraggedCssIndex={setDraggedCssIndex}
            draggedJsIndex={draggedJsIndex}
            setDraggedJsIndex={setDraggedJsIndex}
            errorCount={jsErrorCount}
            warningCount={jsWarningCount}
            onNavigateNextError={handleNavigateNextError}
            onRuntimeError={handleRuntimeError}
            agentPlanState={agentPlanState}
            handleAgentSubmit={handleAgentSubmit}
            handleRequestPatch={handleRequestPatch}
            patchStatus={patchStatus}
            patchProposal={patchProposal}
            patchError={patchError}
            htmlCode={htmlCode}
            cssCode={cssCode}
            jsCode={jsCode}
            handleApplyPatch={handleApplyPatch}
            handleRejectPatch={handleRejectPatch}
            lastSnapshot={lastSnapshot}
            handleRollback={handleRollback}
            currentErrors={currentErrorsForAgent}
            onJumpToError={(target, line) => {
                const editor = target === 'js' ? jsEditor : target === 'css' ? cssEditor : htmlEditor;
                if (!editor) return;
                const lineInfo = editor.state.doc.line(Math.min(line, editor.state.doc.lines));
                editor.dispatch({ selection: { anchor: lineInfo.from }, scrollIntoView: true });
                editor.focus();
            }}
            agentContext={{
                penId: currentPen?.id,
                title,
                cssLanguage,
                jsLanguage,
                selection: jsEditor ? (() => {
                    const sel = jsEditor.state.selection.main;
                    if (sel.from === sel.to) return null;
                    return {
                        target: 'js' as const,
                        from: sel.from,
                        to: sel.to,
                        text: jsEditor.state.sliceDoc(sel.from, sel.to)
                    };
                })() : null
            }}
            showShareModal={showShareModal}
            setShowShareModal={setShowShareModal}
            shareUrl={shareUrl}
            showToast={showToast}
            toastMessage={toastMessage}
        />
        {perfPanelVisible && (
            <React.Suspense fallback={null}>
                <PerfPanel />
            </React.Suspense>
        )}
        <button
            onClick={() => setPerfPanelVisible(v => !v)}
            style={{
                position: 'fixed',
                bottom: perfPanelVisible ? 440 : 16,
                right: 16,
                zIndex: 10000,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid #d1d5da',
                background: perfPanelVisible ? '#0366d6' : '#f6f8fa',
                color: perfPanelVisible ? '#fff' : '#24292e',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
            title="Performance Monitor"
        >
            ⚡
        </button>
    </>
    );
};

export default Editor;
