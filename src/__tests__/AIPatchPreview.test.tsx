import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AIPatchPreview from '../components/AIPatchPreview';
import { PatchProposal } from '../services/patchService';

const mockProposal: PatchProposal = {
    summary: '添加了一个计数器按钮',
    operations: [
        {
            target: 'html',
            type: 'replace_full',
            after: '<div><button id="counter">Count: 0</button></div>',
            reason: '添加计数器按钮元素'
        },
        {
            target: 'js',
            type: 'replace_full',
            after: 'let count = 0;\ndocument.getElementById("counter").onclick = () => {\n  count++;\n  document.getElementById("counter").textContent = `Count: ${count}`;\n};',
            reason: '添加计数逻辑'
        }
    ],
    expectedOutcome: '页面上出现一个点击后数字递增的按钮',
    warnings: ['按钮没有添加样式，可能需要后续美化']
};

const mockCurrentCode = {
    html: '<div>Hello World</div>',
    css: 'body { color: blue; }',
    js: 'console.log("Hello");'
};

describe('AIPatchPreview', () => {
    const defaultProps = {
        proposal: mockProposal,
        currentCode: mockCurrentCode,
        onConfirm: jest.fn(),
        onReject: jest.fn(),
        loading: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders summary and expected outcome', () => {
        render(<AIPatchPreview {...defaultProps} />);

        expect(screen.getByText('添加了一个计数器按钮')).toBeInTheDocument();
        expect(screen.getByText('页面上出现一个点击后数字递增的按钮')).toBeInTheDocument();
    });

    it('renders all operations with target tags and reasons', () => {
        render(<AIPatchPreview {...defaultProps} />);

        expect(screen.getByText('HTML')).toBeInTheDocument();
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
        expect(screen.getByText('添加计数器按钮元素')).toBeInTheDocument();
        expect(screen.getByText('添加计数逻辑')).toBeInTheDocument();
    });

    it('renders warnings when present', () => {
        render(<AIPatchPreview {...defaultProps} />);

        expect(screen.getByText(/按钮没有添加样式/)).toBeInTheDocument();
    });

    it('does not render warnings section when empty', () => {
        const noWarnings = { ...mockProposal, warnings: [] };
        render(<AIPatchPreview {...defaultProps} proposal={noWarnings} />);

        expect(screen.queryByText('注意事项')).not.toBeInTheDocument();
    });

    it('renders confirm and reject buttons', () => {
        render(<AIPatchPreview {...defaultProps} />);

        expect(screen.getByText('应用改动')).toBeInTheDocument();
        expect(screen.getByText('放弃')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button clicked', () => {
        render(<AIPatchPreview {...defaultProps} />);

        fireEvent.click(screen.getByText('应用改动'));
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onReject when reject button clicked', () => {
        render(<AIPatchPreview {...defaultProps} />);

        fireEvent.click(screen.getByText('放弃'));
        expect(defaultProps.onReject).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when loading', () => {
        render(<AIPatchPreview {...defaultProps} loading={true} />);

        expect(screen.getByText('应用中...')).toBeDisabled();
        expect(screen.getByText('放弃')).toBeDisabled();
    });

    it('shows Before/After labels for each operation', () => {
        render(<AIPatchPreview {...defaultProps} />);

        const beforeLabels = screen.getAllByText('Before');
        const afterLabels = screen.getAllByText('After');
        expect(beforeLabels).toHaveLength(2);
        expect(afterLabels).toHaveLength(2);
    });

    it('shows expand button for long code and toggles on click', () => {
        const longCode = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
        const longProposal: PatchProposal = {
            ...mockProposal,
            operations: [{
                target: 'js',
                type: 'replace_full',
                after: longCode,
                reason: '大量代码改动'
            }]
        };
        const longCurrentCode = { ...mockCurrentCode, js: longCode };

        render(<AIPatchPreview {...defaultProps} proposal={longProposal} currentCode={longCurrentCode} />);

        const expandBtn = screen.getByText('展开完整内容');
        expect(expandBtn).toBeInTheDocument();

        fireEvent.click(expandBtn);
        expect(screen.getByText('收起')).toBeInTheDocument();
    });

    it('renders single operation correctly', () => {
        const singleOp: PatchProposal = {
            summary: '修改样式',
            operations: [{
                target: 'css',
                type: 'replace_full',
                after: 'body { color: red; font-size: 16px; }',
                reason: '更改文字颜色和大小'
            }],
            expectedOutcome: '文字变为红色且更大',
            warnings: []
        };

        render(<AIPatchPreview {...defaultProps} proposal={singleOp} />);

        expect(screen.getByText('CSS')).toBeInTheDocument();
        expect(screen.getByText('更改文字颜色和大小')).toBeInTheDocument();
        expect(screen.queryByText('HTML')).not.toBeInTheDocument();
        expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
    });
});
