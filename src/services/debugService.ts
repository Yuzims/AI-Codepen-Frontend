// 调试服务 - 简化版，只支持iframe模式


// 创建调试友好的HTML文档 - 只支持iframe模式
export function createDebugDocument(html: string, css: string, js: string, options: {
    enableDebug: boolean;
    jsLanguage?: string;
    libraryScripts?: string;
}): string {
    const { enableDebug, jsLanguage = 'js', libraryScripts = '' } = options;

    if (!enableDebug) {
        // 普通模式
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <style>
        body { margin: 0; padding: 0; overflow-x: hidden; }
        ${css}
    </style>
    ${libraryScripts}
</head>
<body>
    ${html}
    <script>${js}</script>
</body>
</html>`;
    }

    // 调试模式 - iframe模式

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug View - user-code.js</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            overflow-x: hidden; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        /* 调试控制面板样式 */
        .debug-controls {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 8px;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .debug-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin: 2px;
            transition: background 0.2s;
        }
        
        .debug-btn:hover {
            background: #005a9e;
        }
        
        .debug-info {
            font-size: 11px;
            color: #ccc;
            margin-top: 5px;
        }
        
        /* 用户CSS */
        ${css}
    </style>
    ${libraryScripts}
</head>
<body>
    <!-- 调试控制面板 -->
    <div class="debug-controls">
        <div style="margin-bottom: 8px;">
            <strong>🎯 Debug Controls</strong>
        </div>
        <button class="debug-btn" onclick="rerunUserCode()">🔄 重新运行</button>
        <button class="debug-btn" onclick="clearConsole()">🧹 清空控制台</button>
        <div class="debug-info">
            快捷键: Ctrl+Shift+R 重新运行<br>
            调试文件: user-code.js
        </div>
    </div>

    <!-- 用户HTML -->
    ${html}
    
    <!-- 用户代码脚本 -->
    <script id="user-code-script">
${js}
//# sourceURL=user-code.js
    </script>
    
    <!-- 调试系统脚本 -->
    <script>
        // 调试控制功能
        
        // 重新运行用户代码 - iframe模式
        function rerunUserCode() {
            try {
                // 请求父窗口重新加载iframe
                window.parent.postMessage({ type: 'rerun-debug' }, '*');
            } catch (error) {
                console.error('重新运行失败:', error);
            }
        }
        
        // 清空控制台
        function clearConsole() {
            console.clear();
        }
        
        // 快捷键支持
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                rerunUserCode();
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                clearConsole();
            }
        });
        
        // 页面加载时初始化
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Debug View loaded');
        });
        
        // 如果DOMContentLoaded已经触发，立即执行
        if (document.readyState !== 'loading') {
            console.log('Debug View loaded');
        }
    </script>
</body>
</html>`;
}

// 简化的调试管理器
export class DebugManager {
    private _enabled: boolean = false;

    get enabled(): boolean {
        return this._enabled;
    }

    enable(): void {
        this._enabled = true;
    }

    disable(): void {
        this._enabled = false;
    }

    toggle(): boolean {
        this._enabled = !this._enabled;
        return this._enabled;
    }
}

// 导出默认调试管理器实例
export const debugManager = new DebugManager();

// 为了向后兼容，保留这些函数但简化实现
export function generateInlineSourceMap(code: string, filename: string, isCSS: boolean = false): string {
    // 调试模式下不需要源码映射
    return '';
}

export function addDebugSupport(code: string, filename: string, enableSourceMap: boolean = true): string {
    // 调试模式下直接返回原始代码
    return code;
} 