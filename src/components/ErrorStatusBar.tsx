import React from 'react';

interface ErrorStatusBarProps {
    errorCount: number;
    warningCount: number;
    onNavigateNext: () => void;
}

const ErrorStatusBar: React.FC<ErrorStatusBarProps> = ({ errorCount, warningCount, onNavigateNext }) => {
    if (errorCount === 0 && warningCount === 0) return null;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '2px 10px',
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #e1e4e8',
                fontSize: '12px',
                fontFamily: '"Consolas", "Monaco", monospace',
                flexShrink: 0,
                height: '22px',
                cursor: errorCount + warningCount > 0 ? 'pointer' : 'default',
                userSelect: 'none'
            }}
            onClick={onNavigateNext}
            title="点击跳转到下一个错误"
        >
            {errorCount > 0 && (
                <span style={{ color: '#c62828', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>✗</span>
                    <span>{errorCount}</span>
                </span>
            )}
            {warningCount > 0 && (
                <span style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>⚠</span>
                    <span>{warningCount}</span>
                </span>
            )}
        </div>
    );
};

export default ErrorStatusBar;
