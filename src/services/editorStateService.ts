interface EditorState {
    code: string;
    language: string;
    path: string;
    timestamp: number;
}

interface CodeState {
    html: string;
    css: string;
    js: string;
    language: string;
}

class EditorStateService {
    private static readonly STORAGE_KEY = 'codepen_editor_state';
    private static readonly CODE_STATE_KEY = 'codepen_code_state';

    // 保存编辑器状态
    static saveEditorState(state: EditorState): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    // 获取编辑器状态
    static getEditorState(): EditorState | null {
        const savedState = localStorage.getItem(this.STORAGE_KEY);
        if (savedState) {
            return JSON.parse(savedState);
        }
        return null;
    }

    // 保存代码状态
    static saveCodeState(state: CodeState): void {
        localStorage.setItem(this.CODE_STATE_KEY, JSON.stringify(state));
    }

    // 获取代码状态
    static getCodeState(): CodeState | null {
        const savedState = localStorage.getItem(this.CODE_STATE_KEY);
        if (savedState) {
            return JSON.parse(savedState);
        }
        return null;
    }

    // 清除特定路径的状态
    static clearPathState(path: string): void {
        const state = this.getEditorState();
        if (state && state.path === path) {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }

    // 处理语言切换
    static processCodeForLanguage(code: string, oldLang: string, newLang: string): string {
        if (oldLang === newLang) return code;

        // Vue 特殊处理
        if (newLang === 'vue' && !code.includes('<template>')) {
            return `<template>\n${code}\n</template>`;
        }

        // React 特殊处理
        if (newLang === 'react' && !code.includes('React.')) {
            return `import React from 'react';\n\n${code}`;
        }

        // 从 Vue 转换到其他语言
        if (oldLang === 'vue') {
            const templateMatch = code.match(/<template>([\s\S]*)<\/template>/);
            if (templateMatch) {
                return templateMatch[1].trim();
            }
        }

        // 从 React 转换到其他语言
        if (oldLang === 'react') {
            return code.replace(/import React from ['"]react['"];?\n?/, '');
        }

        return code;
    }

    // 获取语言的初始模板
    static getTemplateForLanguage(language: string): string {
        switch (language) {
            case 'vue':
                return `<template>
  <div>
    <!-- 你的 Vue 代码 -->
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  data() {
    return {
      // 数据
    }
  }
}
</script>

<style>
/* 样式 */
</style>`;

            case 'react':
                return `import React from 'react';

function MyComponent() {
  return (
    <div>
      {/* 你的 React 代码 */}
    </div>
  );
}

export default MyComponent;`;

            default:
                return '';
        }
    }

    // 验证代码格式
    static validateCodeFormat(code: string, language: string): boolean {
        switch (language) {
            case 'vue':
                return code.includes('<template>') && code.includes('</template>');
            case 'react':
                return code.includes('React');
            default:
                return true;
        }
    }
}

export default EditorStateService; 