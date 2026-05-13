import React, { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import { createPen } from '../services/penService';
import {
    generateCode,
    GenerateResult,
    resolveGeneratedCssLanguage,
    resolveGeneratedJsLanguage
} from '../services/aiService';

interface AIGenerateModalProps {
    onClose: () => void;
}

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({ onClose }) => {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const previewRef = useRef<HTMLPreElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (previewRef.current) {
            previewRef.current.scrollTop = previewRef.current.scrollHeight;
        }
    }, [previewText]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const handleClose = () => {
        abortControllerRef.current?.abort();
        onClose();
    };

    const handleGenerate = async () => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isGenerating) {
            if (!trimmedPrompt) {
                setErrorMessage('请输入你想生成的效果描述');
            }
            return;
        }

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);
        setGeneratedResult(null);
        setPreviewText('');
        setErrorMessage('');

        try {
            const result = await generateCode(
                trimmedPrompt,
                (chunk) => {
                    setPreviewText((prev) => prev + chunk);
                },
                controller.signal
            );

            setGeneratedResult(result);
        } catch (error) {
            if (controller.signal.aborted) {
                return;
            }

            setErrorMessage(error instanceof Error ? error.message : 'AI 生成失败');
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
            setIsGenerating(false);
        }
    };

    const handleCreate = async () => {
        if (!generatedResult || isCreating) {
            return;
        }

        setIsCreating(true);
        setErrorMessage('');

        try {
            const cssLanguage = resolveGeneratedCssLanguage(prompt, generatedResult.cssLanguage);
            const jsLanguage = resolveGeneratedJsLanguage(prompt, generatedResult.jsLanguage);

            const newPen = await createPen({
                title: generatedResult.title,
                html: generatedResult.html,
                css: generatedResult.css,
                js: generatedResult.js,
                cssLanguage,
                jsLanguage
            });

            navigate(`/editor/${newPen.id}`, { replace: true });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '创建 Pen 失败');
            setIsCreating(false);
        }
    };

    const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(event.target.value);
        setGeneratedResult(null);
        setPreviewText('');
        setErrorMessage('');
    };

    return (
        <Overlay onClick={handleClose}>
            <Modal onClick={(event) => event.stopPropagation()}>
                <Header>
                    <Title>AI 生成代码</Title>
                    <CloseButton onClick={handleClose} disabled={isCreating}>
                        ×
                    </CloseButton>
                </Header>

                <FieldLabel htmlFor="ai-generate-prompt">描述你想要的效果</FieldLabel>
                <PromptInput
                    id="ai-generate-prompt"
                    value={prompt}
                    onChange={handlePromptChange}
                    placeholder="例如：做一个可切换明暗主题的待办事项应用，支持添加、删除和筛选任务。"
                    disabled={isGenerating || isCreating}
                />

                <ActionsRow>
                    <ActionButton
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating || isCreating}
                    >
                        {isGenerating ? '生成中...' : generatedResult ? '重新生成' : '开始生成'}
                    </ActionButton>
                    <SecondaryButton
                        type="button"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        取消
                    </SecondaryButton>
                </ActionsRow>

                {errorMessage && <ErrorBanner>{errorMessage}</ErrorBanner>}

                <PreviewCard>
                    <PreviewTitle>代码预览</PreviewTitle>
                    {generatedResult ? (
                        <PreviewSections>
                            <PreviewMeta>
                                <PreviewMetaLabel>标题</PreviewMetaLabel>
                                <PreviewMetaValue>{generatedResult.title}</PreviewMetaValue>
                            </PreviewMeta>
                            <PreviewSection>
                                <SectionTitle>HTML</SectionTitle>
                                <CodeBlock>{generatedResult.html}</CodeBlock>
                            </PreviewSection>
                            <PreviewSection>
                                <SectionTitle>CSS</SectionTitle>
                                <CodeBlock>{generatedResult.css}</CodeBlock>
                            </PreviewSection>
                            <PreviewSection>
                                <SectionTitle>JavaScript</SectionTitle>
                                <CodeBlock>{generatedResult.js}</CodeBlock>
                            </PreviewSection>
                        </PreviewSections>
                    ) : previewText ? (
                        <StreamingPreview ref={previewRef}>{previewText}</StreamingPreview>
                    ) : (
                        <EmptyPreview>
                            生成结果会实时显示在这里，确认无误后可直接创建为新的 Pen。
                        </EmptyPreview>
                    )}
                </PreviewCard>

                <Footer>
                    <FooterHint>
                        {generatedResult ? '确认后会创建一个新的 Pen 并跳转到编辑器。' : '先输入需求并生成，再确认创建。'}
                    </FooterHint>
                    <ConfirmButton
                        type="button"
                        onClick={handleCreate}
                        disabled={!generatedResult || isGenerating || isCreating}
                    >
                        {isCreating ? '创建中...' : '确认创建'}
                    </ConfirmButton>
                </Footer>
            </Modal>
        </Overlay>
    );
};

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 1100;
`;

const Modal = styled.div`
    width: min(960px, 100%);
    max-height: calc(100vh - 48px);
    overflow: hidden;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const Title = styled.h2`
    margin: 0;
    color: #1f2937;
    font-size: 20px;
    font-weight: 700;
`;

const CloseButton = styled.button`
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: #f3f4f6;
    color: #4b5563;
    font-size: 24px;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

const FieldLabel = styled.label`
    color: #374151;
    font-size: 14px;
    font-weight: 600;
`;

const PromptInput = styled.textarea`
    width: 100%;
    min-height: 120px;
    resize: vertical;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    line-height: 1.6;
    color: #1f2937;
    background: #ffffff;

    &:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }

    &:disabled {
        background: #f9fafb;
        cursor: not-allowed;
    }
`;

const ActionsRow = styled.div`
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
`;

const ActionButton = styled.button`
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

const SecondaryButton = styled.button`
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 12px 18px;
    background: #ffffff;
    color: #374151;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }
`;

const ErrorBanner = styled.div`
    border-radius: 10px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 12px 14px;
    font-size: 14px;
`;

const PreviewCard = styled.div`
    flex: 1;
    min-height: 0;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #f8fafc;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const PreviewTitle = styled.h3`
    margin: 0;
    color: #111827;
    font-size: 16px;
    font-weight: 700;
`;

const EmptyPreview = styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
    line-height: 1.7;
    padding: 24px;
    background: #ffffff;
    border-radius: 12px;
    border: 1px dashed #d1d5db;
`;

const StreamingPreview = styled.pre`
    flex: 1;
    min-height: 260px;
    margin: 0;
    overflow: auto;
    padding: 16px;
    border-radius: 12px;
    background: #111827;
    color: #f9fafb;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
`;

const PreviewSections = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow: auto;
`;

const PreviewMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 14px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
`;

const PreviewMetaLabel = styled.span`
    color: #6b7280;
    font-size: 13px;
    font-weight: 600;
`;

const PreviewMetaValue = styled.span`
    color: #111827;
    font-size: 14px;
    font-weight: 600;
`;

const PreviewSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SectionTitle = styled.h4`
    margin: 0;
    color: #374151;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

const CodeBlock = styled.pre`
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 14px;
    border-radius: 12px;
    background: #111827;
    color: #f9fafb;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
`;

const Footer = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
`;

const FooterHint = styled.p`
    margin: 0;
    color: #6b7280;
    font-size: 13px;
`;

const ConfirmButton = styled.button`
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    background: #111827;
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

export default AIGenerateModal;
