import React, { useState, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { AgentPlanResponse } from '../services/agentService';
import { PatchProposal, PatchOperation } from '../services/patchService';
import { PenSnapshot, formatSnapshotTime } from '../services/snapshotService';
import { requestAgentRun, AgentStep, AgentRunResponse } from '../services/agentRunService';
import { perf } from '../services/perfSDK';
import AIPatchPreview from './AIPatchPreview';
import AIAgentSteps from './AIAgentSteps';

type PatchStatus = 'idle' | 'loading' | 'success' | 'error';

type AgentPanelState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: AgentPlanResponse }
    | { status: 'error'; message: string };

type AgentRunStatus = 'idle' | 'running' | 'completed' | 'max_steps_reached' | 'error';

interface AIAgentPanelProps {
    state: AgentPanelState;
    onSubmit: (instruction: string) => void;
    onClose: () => void;
    onRequestPatch: (instruction: string) => void;
    patchStatus: PatchStatus;
    patchProposal: PatchProposal | null;
    patchError: string;
    currentCode: { html: string; css: string; js: string };
    onApplyPatch: (operations: PatchOperation[], summary?: string) => void;
    onRejectPatch: () => void;
    lastSnapshot: PenSnapshot | null;
    onRollback: () => void;
    currentErrors: Array<{
        target: 'html' | 'css' | 'js';
        severity: 'error' | 'warning';
        message: string;
        line?: number;
        column?: number;
    }>;
    onJumpToError?: (target: 'html' | 'css' | 'js', line: number) => void;
    agentContext?: {
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
}

const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
    state,
    onSubmit,
    onClose,
    onRequestPatch,
    patchStatus,
    patchProposal,
    patchError,
    currentCode,
    onApplyPatch,
    onRejectPatch,
    lastSnapshot,
    onRollback,
    currentErrors,
    onJumpToError,
    agentContext
}) => {
    const [instruction, setInstruction] = useState('');
    const [showErrorList, setShowErrorList] = useState(false);

    const [runStatus, setRunStatus] = useState<AgentRunStatus>('idle');
    const [runSteps, setRunSteps] = useState<AgentStep[]>([]);
    const [runProposal, setRunProposal] = useState<PatchProposal | null>(null);
    const [runError, setRunError] = useState<string>('');
    const [runTraceId, setRunTraceId] = useState<string>('');
    const runAbortRef = useRef<AbortController | null>(null);
    const [useLegacy, setUseLegacy] = useState(false);

    const isRunning = runStatus === 'running';
    const isLegacyLoading = state.status === 'loading' || patchStatus === 'loading';
    const isBusy = isRunning || isLegacyLoading;

    const resetRunState = useCallback(() => {
        setRunStatus('idle');
        setRunSteps([]);
        setRunProposal(null);
        setRunError('');
        setRunTraceId('');
    }, []);

    const handleRunMode = useCallback(async (trimmed: string) => {
        if (runAbortRef.current) {
            runAbortRef.current.abort();
        }
        const controller = new AbortController();
        runAbortRef.current = controller;

        resetRunState();
        setRunStatus('running');

        try {
            const payload = {
                penId: agentContext?.penId,
                title: agentContext?.title,
                html: currentCode.html,
                css: currentCode.css,
                js: currentCode.js,
                cssLanguage: agentContext?.cssLanguage,
                jsLanguage: agentContext?.jsLanguage,
                selection: agentContext?.selection || null,
                errors: currentErrors.length > 0 ? currentErrors : undefined,
                userInstruction: trimmed
            };

            const result: AgentRunResponse = await requestAgentRun(payload, controller.signal);

            setRunSteps(result.steps);
            setRunTraceId(result.traceId);

            if (result.status === 'completed') {
                setRunStatus('completed');
                if (result.proposal) {
                    setRunProposal(result.proposal);
                }
            } else if (result.status === 'max_steps_reached') {
                setRunStatus('max_steps_reached');
                if (result.proposal) {
                    setRunProposal(result.proposal);
                }
            } else {
                setRunStatus('error');
                setRunError(result.error || 'Agent 执行失败');
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') return;
            const msg = error instanceof Error ? error.message : 'Agent 执行失败';
            const status = (error as any)?.status;
            if (status === 404 && !useLegacy) {
                console.log('[Agent] Falling back to legacy plan+patch mode');
                setUseLegacy(true);
                resetRunState();
                onSubmit(trimmed);
                return;
            }
            setRunStatus('error');
            setRunError(msg);
        }
    }, [agentContext, currentCode, currentErrors, resetRunState, useLegacy, onSubmit]);

    const handleSubmit = useCallback(() => {
        const trimmed = instruction.trim();
        if (!trimmed) return;

        if (useLegacy) {
            onSubmit(trimmed);
        } else {
            handleRunMode(trimmed);
        }
    }, [instruction, useLegacy, onSubmit, handleRunMode]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    const handleGeneratePatch = useCallback(() => {
        const trimmed = instruction.trim();
        if (!trimmed) return;
        onRequestPatch(trimmed);
    }, [instruction, onRequestPatch]);

    const handleConfirmRunPatch = useCallback(() => {
        if (runProposal) {
            const start = performance.now();
            onApplyPatch(runProposal.operations, runProposal.summary);
            perf.record('agent_patch_apply_ms', performance.now() - start);
            resetRunState();
        }
    }, [runProposal, onApplyPatch, resetRunState]);

    const handleConfirmLegacyPatch = useCallback(() => {
        if (patchProposal) {
            const start = performance.now();
            onApplyPatch(patchProposal.operations, patchProposal.summary);
            perf.record('agent_patch_apply_ms', performance.now() - start);
        }
    }, [patchProposal, onApplyPatch]);

    const handleRejectRunPatch = useCallback(() => {
        resetRunState();
    }, [resetRunState]);

    const handleFixErrors = useCallback(() => {
        if (currentErrors.length === 0) return;

        const lines = currentErrors.map(e => {
            const loc = e.line ? `${e.target}:${e.line}` : e.target;
            return `[${e.severity}] ${loc} - ${e.message}`;
        });
        const autoInstruction = `修复以下代码错误：\n${lines.join('\n')}`;
        setInstruction(autoInstruction);

        if (useLegacy) {
            onSubmit(autoInstruction);
        } else {
            handleRunMode(autoInstruction);
        }
    }, [currentErrors, useLegacy, onSubmit, handleRunMode]);

    const handleErrorClick = useCallback((error: typeof currentErrors[0]) => {
        if (onJumpToError && error.line) {
            onJumpToError(error.target, error.line);
        }
    }, [onJumpToError]);

    const showRunResult = runStatus !== 'idle' && !useLegacy;
    const showLegacyResult = useLegacy || runStatus === 'idle';

    return (
        <PanelContainer>
            <PanelHeader>
                <PanelTitle>AI Agent</PanelTitle>
                <CloseButton onClick={onClose}>&times;</CloseButton>
            </PanelHeader>

            <PanelBody>
                <Notice>
                    {isRunning
                        ? 'Agent 正在分析代码并生成修改方案...'
                        : runStatus === 'completed' && runProposal
                            ? '请确认以下改动提案，确认后将应用到编辑器'
                            : patchStatus === 'success'
                                ? '请确认以下改动提案，确认后将应用到编辑器'
                                : '输入修改目标，Agent 会自动分析代码并生成改动提案'}
                </Notice>

                {lastSnapshot && (
                    <SnapshotCard>
                        <SnapshotSummary>{lastSnapshot.patchSummary}</SnapshotSummary>
                        <SnapshotMeta>
                            <SnapshotTargets>
                                {lastSnapshot.patchTargets.map(t => (
                                    <SnapshotTag key={t}>{t.toUpperCase()}</SnapshotTag>
                                ))}
                            </SnapshotTargets>
                            <SnapshotTime>{formatSnapshotTime(lastSnapshot.timestamp)}</SnapshotTime>
                        </SnapshotMeta>
                        <RollbackButton onClick={() => {
                            const start = performance.now();
                            onRollback();
                            perf.record('agent_rollback_ms', performance.now() - start);
                        }}>
                            撤销此次改动
                        </RollbackButton>
                    </SnapshotCard>
                )}

                {currentErrors.length > 0 && !isBusy && runStatus === 'idle' && state.status === 'idle' && patchStatus === 'idle' && (
                    <ErrorSection>
                        <ErrorHeader onClick={() => setShowErrorList(!showErrorList)}>
                            <ErrorCount>{currentErrors.length} 个错误</ErrorCount>
                            <ErrorToggle>{showErrorList ? '▼' : '▶'}</ErrorToggle>
                        </ErrorHeader>
                        {showErrorList && (
                            <ErrorList>
                                {currentErrors.map((e, i) => (
                                    <ErrorItem key={i} onClick={() => handleErrorClick(e)}>
                                        <ErrorSeverity severity={e.severity}>
                                            {e.severity === 'error' ? '✕' : '⚠'}
                                        </ErrorSeverity>
                                        <ErrorMessage>
                                            <span>{e.target}{e.line ? `:${e.line}` : ''}</span>
                                            {' '}{e.message}
                                        </ErrorMessage>
                                    </ErrorItem>
                                ))}
                            </ErrorList>
                        )}
                        <ErrorActions>
                            <FixWithAgentButton onClick={handleFixErrors}>
                                AI 修复
                            </FixWithAgentButton>
                        </ErrorActions>
                    </ErrorSection>
                )}

                <InputArea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你想对当前 Pen 做的修改..."
                    disabled={isBusy}
                    rows={3}
                />

                <SubmitButton
                    onClick={handleSubmit}
                    disabled={isBusy || !instruction.trim()}
                >
                    {isRunning ? '正在执行...' : state.status === 'loading' ? '正在生成计划...' : '执行'}
                </SubmitButton>

                {/* Run 模式结果 */}
                {showRunResult && (
                    <>
                        {runSteps.length > 0 && (
                            <AIAgentSteps
                                steps={runSteps}
                                status={isRunning ? 'running' : runStatus === 'max_steps_reached'
                                    ? 'max_steps_reached'
                                    : runStatus === 'error' ? 'error' : 'completed'}
                            />
                        )}

                        {runStatus === 'error' && (
                            <ErrorBlock>{runError}</ErrorBlock>
                        )}

                        {runStatus === 'completed' && !runProposal && (
                            <InfoBlock>Agent 分析后认为无需修改当前代码。</InfoBlock>
                        )}

                        {runStatus === 'max_steps_reached' && !runProposal && (
                            <ErrorBlock>已达最大步数限制，Agent 未能完成任务。</ErrorBlock>
                        )}

                        {runTraceId && (
                            <TraceId>traceId: {runTraceId}</TraceId>
                        )}

                        {runProposal && (
                            <AIPatchPreview
                                proposal={runProposal}
                                currentCode={currentCode}
                                onConfirm={handleConfirmRunPatch}
                                onReject={handleRejectRunPatch}
                            />
                        )}
                    </>
                )}

                {/* Legacy 模式结果 */}
                {showLegacyResult && (
                    <>
                        {state.status === 'error' && (
                            <ErrorBlock>{state.message}</ErrorBlock>
                        )}

                        {state.status === 'success' && patchStatus !== 'success' && (
                            <PlanResult>
                                <PlanSection>
                                    <PlanLabel>概要</PlanLabel>
                                    <PlanText>{state.data.plan.summary}</PlanText>
                                </PlanSection>

                                <PlanSection>
                                    <PlanLabel>目标</PlanLabel>
                                    <PlanText>{state.data.plan.goal}</PlanText>
                                </PlanSection>

                                <PlanSection>
                                    <PlanLabel>影响区块</PlanLabel>
                                    <TagList>
                                        {state.data.plan.targets.map(t => (
                                            <Tag key={t}>{t.toUpperCase()}</Tag>
                                        ))}
                                    </TagList>
                                </PlanSection>

                                <PlanSection>
                                    <PlanLabel>执行步骤</PlanLabel>
                                    <StepList>
                                        {state.data.plan.steps.map((step, i) => (
                                            <StepItem key={i}>{step}</StepItem>
                                        ))}
                                    </StepList>
                                </PlanSection>

                                {state.data.plan.risks.length > 0 && (
                                    <PlanSection>
                                        <PlanLabel>风险提示</PlanLabel>
                                        <RiskList>
                                            {state.data.plan.risks.map((risk, i) => (
                                                <RiskItem key={i}>{risk}</RiskItem>
                                            ))}
                                        </RiskList>
                                    </PlanSection>
                                )}

                                <TraceId>traceId: {state.data.traceId}</TraceId>

                                <PatchButton
                                    onClick={handleGeneratePatch}
                                    disabled={patchStatus === 'loading' || !instruction.trim()}
                                >
                                    {patchStatus === 'loading' ? '正在生成改动提案...' : '生成改动提案'}
                                </PatchButton>

                                {patchStatus === 'error' && (
                                    <ErrorBlock>{patchError}</ErrorBlock>
                                )}
                            </PlanResult>
                        )}

                        {patchStatus === 'success' && patchProposal && (
                            <AIPatchPreview
                                proposal={patchProposal}
                                currentCode={currentCode}
                                onConfirm={handleConfirmLegacyPatch}
                                onReject={onRejectPatch}
                            />
                        )}
                    </>
                )}

                {runStatus === 'idle' && state.status === 'idle' && (
                    <IdleHint>输入修改目标，Agent 会自动分析代码并生成改动提案。</IdleHint>
                )}
            </PanelBody>
        </PanelContainer>
    );
};

export default AIAgentPanel;
export type { AgentPanelState, PatchStatus };

// --- Styles ---

const PanelContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border-left: 1px solid #e1e4e8;
    font-size: 13px;
`;

const PanelHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid #e1e4e8;
    background: #f6f8fa;
    flex-shrink: 0;
`;

const PanelTitle = styled.span`
    font-weight: 600;
    font-size: 13px;
    color: #24292e;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    font-size: 18px;
    color: #586069;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    &:hover { color: #d73a49; }
`;

const PanelBody = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const Notice = styled.div`
    padding: 8px 10px;
    background: #fffbdd;
    border: 1px solid #f9c513;
    border-radius: 4px;
    font-size: 11px;
    color: #735c0f;
`;

const InputArea = styled.textarea`
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5da;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    &:focus {
        outline: none;
        border-color: #0366d6;
        box-shadow: 0 0 0 2px rgba(3, 102, 214, 0.15);
    }
    &:disabled {
        background: #f6f8fa;
        cursor: not-allowed;
    }
`;

const SubmitButton = styled.button`
    padding: 8px 14px;
    background: #0366d6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    &:hover:not(:disabled) { background: #0256b9; }
    &:disabled {
        background: #94d3a2;
        cursor: not-allowed;
    }
`;

const ErrorBlock = styled.div`
    padding: 8px 10px;
    background: #ffeef0;
    border: 1px solid #fdaeb7;
    border-radius: 4px;
    color: #86181d;
    font-size: 12px;
`;

const InfoBlock = styled.div`
    padding: 8px 10px;
    background: #f0f7ff;
    border: 1px solid #79b8ff;
    border-radius: 4px;
    color: #0366d6;
    font-size: 12px;
`;

const PlanResult = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
`;

const PlanSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const PlanLabel = styled.span`
    font-size: 11px;
    font-weight: 600;
    color: #586069;
    text-transform: uppercase;
    letter-spacing: 0.3px;
`;

const PlanText = styled.span`
    font-size: 13px;
    color: #24292e;
    line-height: 1.5;
`;

const TagList = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
`;

const Tag = styled.span`
    padding: 2px 8px;
    background: #e1e4e8;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    color: #24292e;
`;

const StepList = styled.ol`
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const StepItem = styled.li`
    font-size: 12px;
    color: #24292e;
    line-height: 1.5;
`;

const RiskList = styled.ul`
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const RiskItem = styled.li`
    font-size: 12px;
    color: #b08800;
    line-height: 1.5;
`;

const TraceId = styled.div`
    font-size: 10px;
    color: #959da5;
    margin-top: 4px;
    font-family: monospace;
`;

const IdleHint = styled.div`
    font-size: 12px;
    color: #6a737d;
    text-align: center;
    padding: 20px 10px;
`;

const PatchButton = styled.button`
    padding: 8px 14px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 6px;
    &:hover:not(:disabled) { background: #22863a; }
    &:disabled {
        background: #94d3a2;
        cursor: not-allowed;
    }
`;

const SnapshotCard = styled.div`
    padding: 10px 12px;
    background: #f0f7ff;
    border: 1px solid #79b8ff;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SnapshotSummary = styled.div`
    font-size: 12px;
    color: #24292e;
    line-height: 1.4;
`;

const SnapshotMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const SnapshotTargets = styled.div`
    display: flex;
    gap: 4px;
`;

const SnapshotTag = styled.span`
    padding: 1px 6px;
    background: #dbedff;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    color: #0366d6;
`;

const SnapshotTime = styled.span`
    font-size: 10px;
    color: #6a737d;
    font-family: monospace;
`;

const RollbackButton = styled.button`
    padding: 6px 10px;
    background: #e36209;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    &:hover { background: #c24e00; }
`;

const ErrorSection = styled.div`
    background: #fff8f8;
    border: 1px solid #fdd;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
`;

const ErrorHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    &:hover { background: #fee; }
`;

const ErrorCount = styled.span`
    font-size: 13px;
    font-weight: 500;
    color: #d73a49;
`;

const ErrorToggle = styled.span`
    font-size: 11px;
    color: #999;
`;

const ErrorList = styled.div`
    margin-top: 6px;
    max-height: 150px;
    overflow-y: auto;
`;

const ErrorItem = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    &:hover { background: #fee; }
`;

const ErrorSeverity = styled.span<{ severity: 'error' | 'warning' }>`
    color: ${p => p.severity === 'error' ? '#d73a49' : '#e36209'};
    font-weight: bold;
    flex-shrink: 0;
`;

const ErrorMessage = styled.span`
    color: #333;
    word-break: break-word;
    span { color: #6a737d; font-family: monospace; font-size: 11px; }
`;

const ErrorActions = styled.div`
    margin-top: 8px;
    display: flex;
    gap: 8px;
`;

const FixWithAgentButton = styled.button`
    padding: 4px 10px;
    background: #f6f8fa;
    color: #d73a49;
    border: 1px solid #d73a49;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    &:hover { background: #d73a49; color: white; }
`;
