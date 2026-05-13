import React, { useState } from 'react';
import styled from '@emotion/styled';
import { PatchProposal } from '../services/patchService';

interface AIPatchPreviewProps {
    proposal: PatchProposal;
    currentCode: { html: string; css: string; js: string };
    onConfirm: () => void;
    onReject: () => void;
    loading?: boolean;
}

const PREVIEW_LINES = 8;

const truncateCode = (code: string, maxLines: number): { text: string; truncated: boolean } => {
    const lines = code.split('\n');
    if (lines.length <= maxLines) {
        return { text: code, truncated: false };
    }
    return { text: lines.slice(0, maxLines).join('\n'), truncated: true };
};

const TARGET_LABELS: Record<string, string> = {
    html: 'HTML',
    css: 'CSS',
    js: 'JavaScript'
};

const AIPatchPreview: React.FC<AIPatchPreviewProps> = ({
    proposal,
    currentCode,
    onConfirm,
    onReject,
    loading
}) => {
    const [expandedOps, setExpandedOps] = useState<Set<number>>(new Set());

    const toggleExpand = (index: number) => {
        setExpandedOps(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    return (
        <Container>
            <SummarySection>
                <SectionLabel>改动摘要</SectionLabel>
                <SummaryText>{proposal.summary}</SummaryText>
                {proposal.expectedOutcome && (
                    <OutcomeText>{proposal.expectedOutcome}</OutcomeText>
                )}
            </SummarySection>

            <OperationsSection>
                <SectionLabel>改动详情</SectionLabel>
                {proposal.operations.map((op, i) => {
                    const isExpanded = expandedOps.has(i);
                    const before = currentCode[op.target] || '';
                    const beforePreview = truncateCode(before, PREVIEW_LINES);
                    const afterPreview = truncateCode(op.after, PREVIEW_LINES);

                    return (
                        <OperationCard key={i}>
                            <OpHeader>
                                <TargetTag>{TARGET_LABELS[op.target]}</TargetTag>
                                <OpReason>{op.reason}</OpReason>
                            </OpHeader>
                            <DiffContainer>
                                <DiffColumn>
                                    <DiffLabel type="before">Before</DiffLabel>
                                    <CodeBlock>
                                        {isExpanded ? before : beforePreview.text}
                                        {!isExpanded && beforePreview.truncated && (
                                            <TruncatedHint>...</TruncatedHint>
                                        )}
                                    </CodeBlock>
                                </DiffColumn>
                                <DiffColumn>
                                    <DiffLabel type="after">After</DiffLabel>
                                    <CodeBlock>
                                        {isExpanded ? op.after : afterPreview.text}
                                        {!isExpanded && afterPreview.truncated && (
                                            <TruncatedHint>...</TruncatedHint>
                                        )}
                                    </CodeBlock>
                                </DiffColumn>
                            </DiffContainer>
                            {(beforePreview.truncated || afterPreview.truncated) && (
                                <ExpandButton onClick={() => toggleExpand(i)}>
                                    {isExpanded ? '收起' : '展开完整内容'}
                                </ExpandButton>
                            )}
                        </OperationCard>
                    );
                })}
            </OperationsSection>

            {proposal.warnings.length > 0 && (
                <WarningsSection>
                    <SectionLabel>注意事项</SectionLabel>
                    {proposal.warnings.map((w, i) => (
                        <WarningItem key={i}>{w}</WarningItem>
                    ))}
                </WarningsSection>
            )}

            {proposal.languages && (
                <LanguageNotice>
                    <SectionLabel>语言切换</SectionLabel>
                    {proposal.languages.jsLanguage && (
                        <LangTag>JS: {proposal.languages.jsLanguage}</LangTag>
                    )}
                    {proposal.languages.cssLanguage && (
                        <LangTag>CSS: {proposal.languages.cssLanguage}</LangTag>
                    )}
                </LanguageNotice>
            )}

            <ActionBar>
                <ConfirmButton onClick={onConfirm} disabled={loading}>
                    {loading ? '应用中...' : '应用改动'}
                </ConfirmButton>
                <RejectButton onClick={onReject} disabled={loading}>
                    放弃
                </RejectButton>
            </ActionBar>
        </Container>
    );
};

export default AIPatchPreview;

// --- Styles ---

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const SummarySection = styled.div`
    padding: 10px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
`;

const SectionLabel = styled.div`
    font-size: 11px;
    font-weight: 600;
    color: #586069;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 6px;
`;

const SummaryText = styled.div`
    font-size: 13px;
    color: #24292e;
    line-height: 1.5;
`;

const OutcomeText = styled.div`
    font-size: 12px;
    color: #0369a1;
    margin-top: 6px;
    line-height: 1.4;
`;

const OperationsSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const OperationCard = styled.div`
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    overflow: hidden;
`;

const OpHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #f6f8fa;
    border-bottom: 1px solid #e1e4e8;
`;

const TargetTag = styled.span`
    padding: 2px 6px;
    background: #0366d6;
    color: white;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
`;

const OpReason = styled.span`
    font-size: 12px;
    color: #24292e;
    line-height: 1.4;
`;

const DiffContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
`;

const DiffColumn = styled.div`
    display: flex;
    flex-direction: column;
`;

const DiffLabel = styled.div<{ type: 'before' | 'after' }>`
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    color: ${p => p.type === 'before' ? '#86181d' : '#165c26'};
    background: ${p => p.type === 'before' ? '#ffeef0' : '#e6ffed'};
    border-bottom: 1px solid ${p => p.type === 'before' ? '#fdaeb7' : '#b4e2b4'};
`;

const CodeBlock = styled.pre`
    margin: 0;
    padding: 8px 10px;
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    background: #fafbfc;
    max-height: 200px;
    overflow-y: auto;
`;

const TruncatedHint = styled.span`
    color: #959da5;
    font-style: italic;
`;

const ExpandButton = styled.button`
    width: 100%;
    padding: 4px;
    border: none;
    border-top: 1px solid #e1e4e8;
    background: #f6f8fa;
    color: #0366d6;
    font-size: 11px;
    cursor: pointer;
    &:hover {
        background: #e1e4e8;
    }
`;

const WarningsSection = styled.div`
    padding: 8px 10px;
    background: #fffbdd;
    border: 1px solid #f9c513;
    border-radius: 6px;
`;

const WarningItem = styled.div`
    font-size: 12px;
    color: #735c0f;
    line-height: 1.5;
    &::before {
        content: '⚠ ';
    }
    & + & {
        margin-top: 4px;
    }
`;

const LanguageNotice = styled.div`
    padding: 8px 10px;
    background: #f0f4ff;
    border: 1px solid #c8d6e5;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const LangTag = styled.span`
    padding: 2px 8px;
    background: #0366d6;
    color: white;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
`;

const ActionBar = styled.div`
    display: flex;
    gap: 8px;
    padding-top: 4px;
`;

const ConfirmButton = styled.button`
    flex: 1;
    padding: 8px 14px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    &:hover:not(:disabled) { background: #22863a; }
    &:disabled {
        background: #94d3a2;
        cursor: not-allowed;
    }
`;

const RejectButton = styled.button`
    padding: 8px 14px;
    background: white;
    color: #586069;
    border: 1px solid #d1d5da;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    &:hover:not(:disabled) {
        background: #f6f8fa;
        border-color: #959da5;
    }
    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;
