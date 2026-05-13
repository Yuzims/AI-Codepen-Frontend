import React from 'react';
import Split from 'react-split';
import { Global } from '@emotion/react';
import Preview from '../Preview';
import DebugPreview from '../DebugPreview';
import UserNavbar from '../UserNavbar';
import ImportPanel from '../ImportPanel';
import AIAgentPanel, { AgentPanelState, PatchStatus } from '../AIAgentPanel';
import ErrorStatusBar from '../ErrorStatusBar';
import {
    PageContainer,
    PreviewContainer,
    EditorHeader,
    EditorTitle,
    EditorActions,
    Button,
    BackButton,
    Select,
    DeleteButton,
    LanguageSelect,
    ShareButton,
    ShareModal,
    ShareInput,
    ShareTitle,
    ShareClose,
    Overlay,
    Toast,
    DebugToggleButton
} from '../../styles/editorStyles';
import { errorInfoField } from '../../services/lintService';
import { Pen, PenData } from '../../services/penService';
import { PatchProposal, PatchOperation } from '../../services/patchService';
import { PenSnapshot } from '../../services/snapshotService';
import { EditorView } from '@codemirror/view';

interface EditorShellProps {
    title: string;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
    currentPen: Pen | null;
    userPens: Pen[];
    isSaving: boolean;
    saveSuccess: boolean;
    isDeleting: boolean;
    debugEnabled: boolean;
    isAgentPanelOpen: boolean;
    setIsAgentPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleBackToHome: () => void;
    handleLoadPen: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    handleSave: () => void;
    handleDelete: () => void;
    handleShare: () => void;
    handleCopyShareLink: () => void;
    handleToggleDebug: () => void;
    cssLanguage: 'css' | 'scss' | 'less';
    jsLanguage: 'js' | 'react' | 'vue' | 'ts';
    handleCssLanguageChange: (language: 'css' | 'scss' | 'less') => void;
    handleJsLanguageChange: (language: 'js' | 'react' | 'vue' | 'ts') => void;
    htmlEditor: EditorView | null;
    cssEditor: EditorView | null;
    jsEditor: EditorView | null;
    debouncedHtml: string;
    debouncedMergedCss: string;
    debouncedMergedJs: string;
    importedCssPenIds: string[];
    setImportedCssPenIds: React.Dispatch<React.SetStateAction<string[]>>;
    showCssImportPanel: boolean;
    setShowCssImportPanel: React.Dispatch<React.SetStateAction<boolean>>;
    importedJsPenIds: string[];
    setImportedJsPenIds: React.Dispatch<React.SetStateAction<string[]>>;
    showJsImportPanel: boolean;
    setShowJsImportPanel: React.Dispatch<React.SetStateAction<boolean>>;
    userPensForImport: Pen[];
    draggedCssIndex: number | null;
    setDraggedCssIndex: React.Dispatch<React.SetStateAction<number | null>>;
    draggedJsIndex: number | null;
    setDraggedJsIndex: React.Dispatch<React.SetStateAction<number | null>>;
    errorCount: number;
    warningCount: number;
    onNavigateNextError: () => void;
    onRuntimeError: (errors: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }>) => void;
    agentPlanState: AgentPanelState;
    handleAgentSubmit: (instruction: string) => void;
    handleRequestPatch: (instruction: string) => void;
    patchStatus: PatchStatus;
    patchProposal: PatchProposal | null;
    patchError: string;
    htmlCode: string;
    cssCode: string;
    jsCode: string;
    handleApplyPatch: (operations: PatchOperation[], summary?: string) => void;
    handleRejectPatch: () => void;
    lastSnapshot: PenSnapshot | null;
    handleRollback: () => void;
    currentErrors: Array<{
        target: 'html' | 'css' | 'js';
        severity: 'error' | 'warning';
        message: string;
        line?: number;
        column?: number;
    }>;
    onJumpToError: (target: 'html' | 'css' | 'js', line: number) => void;
    agentContext: {
        penId?: string;
        title?: string;
        cssLanguage?: 'css' | 'scss' | 'less';
        jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
        selection?: {
            target: 'html' | 'css' | 'js';
            from: number;
            to: number;
            text: string;
        } | null;
    };
    showShareModal: boolean;
    setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
    shareUrl: string;
    showToast: boolean;
    toastMessage: string;
}

const EditorShell: React.FC<EditorShellProps> = ({
    title,
    setTitle,
    currentPen,
    userPens,
    isSaving,
    saveSuccess,
    isDeleting,
    debugEnabled,
    isAgentPanelOpen,
    setIsAgentPanelOpen,
    handleBackToHome,
    handleLoadPen,
    handleSave,
    handleDelete,
    handleShare,
    handleCopyShareLink,
    handleToggleDebug,
    cssLanguage,
    jsLanguage,
    handleCssLanguageChange,
    handleJsLanguageChange,
    htmlEditor,
    cssEditor,
    jsEditor,
    debouncedHtml,
    debouncedMergedCss,
    debouncedMergedJs,
    importedCssPenIds,
    setImportedCssPenIds,
    showCssImportPanel,
    setShowCssImportPanel,
    importedJsPenIds,
    setImportedJsPenIds,
    showJsImportPanel,
    setShowJsImportPanel,
    userPensForImport,
    draggedCssIndex,
    setDraggedCssIndex,
    draggedJsIndex,
    setDraggedJsIndex,
    errorCount,
    warningCount,
    onNavigateNextError,
    onRuntimeError,
    agentPlanState,
    handleAgentSubmit,
    handleRequestPatch,
    patchStatus,
    patchProposal,
    patchError,
    htmlCode,
    cssCode,
    jsCode,
    handleApplyPatch,
    handleRejectPatch,
    lastSnapshot,
    handleRollback,
    currentErrors,
    onJumpToError,
    agentContext,
    showShareModal,
    setShowShareModal,
    shareUrl,
    showToast,
    toastMessage
}) => {
    return (
        <PageContainer style={{ height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Global styles={`
               .gutter {
                 background-color: #e1e4e8;
                 background-clip: padding-box;
                 transition: background 0.2s;
                 z-index: 10;
               }
               .gutter.gutter-horizontal {
                 cursor: col-resize;
                 width: 6px;
               }
               .gutter.gutter-vertical {
                 cursor: row-resize;
                 height: 6px;
               }
               .gutter:hover {
                 background-color: #b3d4fc;
               }
            `} />
            <UserNavbar />
            <EditorHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0, marginRight: '32px' }}>
                    <BackButton onClick={handleBackToHome}>
                        <span style={{ fontSize: '16px' }}>←</span>
                        My Pens
                    </BackButton>
                    <EditorTitle value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
                </div>
                <EditorActions>
                    <Select onChange={handleLoadPen} value={currentPen?.id || ''}>
                        <option value="">📁 New Pen</option>
                        {(userPens || []).filter(Boolean).map(pen => pen && pen.id ? (
                            <option key={pen.id.toString()} value={pen.id.toString()}>{pen.title}</option>
                        ) : null)}
                    </Select>
                    <Button onClick={handleSave} disabled={isSaving || saveSuccess}>
                        {isSaving ? '💾 Saving...' : saveSuccess ? '✅ Saved!' : '💾 Save'}
                    </Button>
                    {currentPen && <ShareButton onClick={handleShare}>🔗 Share</ShareButton>}
                    <DeleteButton onClick={handleDelete} disabled={isDeleting || !currentPen} style={{ visibility: currentPen ? 'visible' : 'hidden', opacity: currentPen ? 1 : 0, transition: 'opacity 0.3s ease, visibility 0.3s ease' }}>
                        {isDeleting ? '🗑️ Deleting...' : '🗑️ Delete'}
                    </DeleteButton>
                    <DebugToggleButton active={debugEnabled} onClick={handleToggleDebug} title={debugEnabled ? '关闭调试模式' : '开启调试模式'}>
                        🐛 {debugEnabled ? 'ON' : 'OFF'}
                    </DebugToggleButton>
                    <Button onClick={() => setIsAgentPanelOpen(!isAgentPanelOpen)} style={{ background: isAgentPanelOpen ? '#0366d6' : undefined, color: isAgentPanelOpen ? 'white' : undefined }}>
                        🤖 Agent
                    </Button>
                </EditorActions>
            </EditorHeader>
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <Split direction="horizontal" sizes={[50, 50]} minSize={150} gutterSize={6} style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
                    <Split direction="vertical" sizes={[33, 33, 34]} minSize={36} gutterSize={6} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '8px 12px', height: '32px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e1e4e8', fontSize: '12px', fontWeight: '600', color: '#586069', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>HTML</div>
                            <div id="html-editor" style={{ flex: 1, minHeight: 0, overflow: 'auto' }} />
                        </div>
                        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '8px 12px', height: '32px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e1e4e8', borderTop: '1px solid #e4e4e4', fontSize: '12px', fontWeight: '600', color: '#586069', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                                <span>CSS</span>
                                <LanguageSelect value={cssLanguage} onChange={(e) => handleCssLanguageChange(e.target.value as 'css' | 'scss' | 'less')}>
                                    <option value="css">CSS</option>
                                    <option value="scss">SCSS</option>
                                    <option value="less">LESS</option>
                                </LanguageSelect>
                            </div>
                            <div id="css-editor" style={{ flex: 1, minHeight: 0, overflow: 'auto' }} />
                        </div>
                        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '8px 12px', height: '32px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e1e4e8', borderTop: '1px solid #e4e4e4', fontSize: '12px', fontWeight: '600', color: '#586069', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                                <span>JavaScript</span>
                                <LanguageSelect value={jsLanguage} onChange={(e) => handleJsLanguageChange(e.target.value as 'js' | 'react' | 'vue' | 'ts')}>
                                    <option value="js">JavaScript</option>
                                    <option value="react">React</option>
                                    <option value="vue">Vue</option>
                                    <option value="ts">TS</option>
                                </LanguageSelect>
                            </div>
                            <div id="js-editor" style={{ flex: 1, minHeight: 0, overflow: 'auto' }} />
                            <ErrorStatusBar errorCount={errorCount} warningCount={warningCount} onNavigateNext={onNavigateNextError} />
                        </div>
                        <ImportPanel
                            importedCssPenIds={importedCssPenIds}
                            setImportedCssPenIds={setImportedCssPenIds}
                            showCssImportPanel={showCssImportPanel}
                            setShowCssImportPanel={setShowCssImportPanel}
                            importedJsPenIds={importedJsPenIds}
                            setImportedJsPenIds={setImportedJsPenIds}
                            showJsImportPanel={showJsImportPanel}
                            setShowJsImportPanel={setShowJsImportPanel}
                            userPens={userPensForImport}
                            currentPenId={currentPen?.id || null}
                            draggedCssIndex={draggedCssIndex}
                            setDraggedCssIndex={setDraggedCssIndex}
                            draggedJsIndex={draggedJsIndex}
                            setDraggedJsIndex={setDraggedJsIndex}
                        />
                    </Split>
                    <PreviewContainer>
                        {debugEnabled ? (
                            <DebugPreview html={debouncedHtml} css={debouncedMergedCss} js={debouncedMergedJs} jsLanguage={jsLanguage} debugEnabled={debugEnabled} />
                        ) : (
                            <Preview html={debouncedHtml} css={debouncedMergedCss} js={debouncedMergedJs} jsLanguage={jsLanguage} onRuntimeError={onRuntimeError} />
                        )}
                    </PreviewContainer>
                </Split>
                {isAgentPanelOpen && (
                    <div style={{ width: '320px', flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                        <AIAgentPanel
                            state={agentPlanState}
                            onSubmit={handleAgentSubmit}
                            onClose={() => setIsAgentPanelOpen(false)}
                            onRequestPatch={handleRequestPatch}
                            patchStatus={patchStatus}
                            patchProposal={patchProposal}
                            patchError={patchError}
                            currentCode={{ html: htmlCode, css: cssCode, js: jsCode }}
                            onApplyPatch={handleApplyPatch}
                            onRejectPatch={handleRejectPatch}
                            lastSnapshot={lastSnapshot}
                            onRollback={handleRollback}
                            currentErrors={currentErrors}
                            onJumpToError={onJumpToError}
                            agentContext={agentContext}
                        />
                    </div>
                )}
            </div>
            {showShareModal && (
                <>
                    <Overlay onClick={() => setShowShareModal(false)} />
                    <ShareModal>
                        <ShareClose onClick={() => setShowShareModal(false)}>×</ShareClose>
                        <ShareTitle>分享代码片段</ShareTitle>
                        <ShareInput value={shareUrl} readOnly onClick={(e) => e.currentTarget.select()} />
                        <Button onClick={handleCopyShareLink}>📋 复制链接</Button>
                    </ShareModal>
                </>
            )}
            {showToast && <Toast>{toastMessage}</Toast>}
        </PageContainer>
    );
};

export default EditorShell;