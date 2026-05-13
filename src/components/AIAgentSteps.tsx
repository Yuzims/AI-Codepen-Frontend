import React, { useState } from 'react';
import styled from '@emotion/styled';
import { AgentStep } from '../services/agentRunService';

const TOOL_LABELS: Record<string, string> = {
    get_current_pen: '读取代码',
    get_pen_errors: '检查错误',
    get_user_selection: '读取选区',
    get_pen_languages: '读取语言配置',
    propose_patch: '提交修改提案',
};

interface AIAgentStepsProps {
    steps: AgentStep[];
    status: 'running' | 'completed' | 'max_steps_reached' | 'error';
}

const AIAgentSteps: React.FC<AIAgentStepsProps> = ({ steps, status }) => {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    return (
        <StepsContainer>
            <StepsTitle>执行步骤</StepsTitle>
            <Timeline>
                {steps.map((step) => (
                    <TimelineItem key={step.stepIndex}>
                        <TimelineDot terminal={step.tool === 'propose_patch'} />
                        <TimelineContent>
                            <StepHeader onClick={() => setExpandedStep(
                                expandedStep === step.stepIndex ? null : step.stepIndex
                            )}>
                                <StepLabel>{TOOL_LABELS[step.tool] || step.tool}</StepLabel>
                                <StepDuration>{step.durationMs}ms</StepDuration>
                            </StepHeader>
                            {expandedStep === step.stepIndex && (
                                <StepOutput>{step.output}</StepOutput>
                            )}
                        </TimelineContent>
                    </TimelineItem>
                ))}
                {status === 'running' && (
                    <TimelineItem>
                        <TimelineDotLoading />
                        <TimelineContent>
                            <StepLabel style={{ color: '#6a737d' }}>思考中...</StepLabel>
                        </TimelineContent>
                    </TimelineItem>
                )}
            </Timeline>
            {status === 'max_steps_reached' && (
                <WarningBanner>已达最大步数限制，Agent 已停止执行</WarningBanner>
            )}
        </StepsContainer>
    );
};

export default AIAgentSteps;

const StepsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
`;

const StepsTitle = styled.div`
    font-size: 11px;
    font-weight: 600;
    color: #586069;
    text-transform: uppercase;
    letter-spacing: 0.3px;
`;

const Timeline = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-left: 4px;
`;

const TimelineItem = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
    border-left: 2px solid #e1e4e8;
    margin-left: 5px;
    padding-left: 12px;
    position: relative;
`;

const TimelineDot = styled.div<{ terminal?: boolean }>`
    position: absolute;
    left: -5px;
    top: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${p => p.terminal ? '#28a745' : '#0366d6'};
    flex-shrink: 0;
`;

const TimelineDotLoading = styled.div`
    position: absolute;
    left: -5px;
    top: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f9c513;
    animation: pulse 1s ease-in-out infinite;
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
`;

const TimelineContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const StepHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    &:hover { background: #eaecef; }
`;

const StepLabel = styled.span`
    font-size: 12px;
    font-weight: 500;
    color: #24292e;
`;

const StepDuration = styled.span`
    font-size: 10px;
    color: #6a737d;
    font-family: monospace;
`;

const StepOutput = styled.pre`
    margin: 4px 0 0 0;
    padding: 6px 8px;
    background: #fff;
    border: 1px solid #e1e4e8;
    border-radius: 4px;
    font-size: 11px;
    color: #444;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
    font-family: 'SFMono-Regular', Consolas, monospace;
`;

const WarningBanner = styled.div`
    padding: 6px 10px;
    background: #fffbdd;
    border: 1px solid #f9c513;
    border-radius: 4px;
    font-size: 11px;
    color: #735c0f;
    text-align: center;
`;
