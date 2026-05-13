import React, { useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { loadTypeScriptCompiler } from '../services/compilerService';
import { perf } from '../services/perfSDK';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Diagnostic } from '@codemirror/lint';

const PreviewContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: white;
`;

const PreviewIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

interface PreviewProps {
  html: string;
  css: string;
  js: string;
  jsLanguage?: 'js' | 'react' | 'vue' | 'ts';
  onRuntimeError?: (errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
  }>) => void;
  hasStaticErrors?: boolean; // 添加静态错误标志
}

// HTML Lint 函数 - 复制自 lintService.ts
function htmlLinter(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc;
  const code = doc.toString();

  try {
    // 使用 DOMParser 检测 HTML 语法错误
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(code, 'text/html');

    // 检查解析错误
    const parserErrors = htmlDoc.querySelector('parsererror');
    if (parserErrors) {
      diagnostics.push({
        from: 0,
        to: code.length,
        severity: 'error',
        message: 'HTML syntax error detected'
      });
    }

    // 检查基本的标签匹配
    const lines = code.split('\n');
    const tagStack: Array<{ tag: string, line: number, from: number }> = [];
    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    let currentPos = 0;

    lines.forEach((line, lineIndex) => {
      const lineStart = currentPos;

      // 查找标签
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
      let match;

      while ((match = tagRegex.exec(line)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const tagStart = lineStart + match.index;
        const tagEnd = tagStart + fullTag.length;

        if (fullTag.startsWith('</')) {
          // 结束标签
          if (tagStack.length === 0) {
            diagnostics.push({
              from: tagStart,
              to: tagEnd,
              severity: 'error',
              message: `Unexpected closing tag </${tagName}>`
            });
          } else {
            const lastTag = tagStack[tagStack.length - 1];
            if (lastTag.tag === tagName) {
              tagStack.pop();
            } else {
              diagnostics.push({
                from: tagStart,
                to: tagEnd,
                severity: 'error',
                message: `Mismatched closing tag </${tagName}>, expected </${lastTag.tag}>`
              });
            }
          }
        } else if (!fullTag.endsWith('/>') && !selfClosingTags.has(tagName)) {
          // 开始标签（非自闭合）
          tagStack.push({
            tag: tagName,
            line: lineIndex + 1,
            from: tagStart
          });
        }
      }

      currentPos += line.length + 1; // +1 for newline
    });

    // 检查未闭合的标签
    tagStack.forEach(tag => {
      diagnostics.push({
        from: tag.from,
        to: tag.from + tag.tag.length + 2, // <tagname
        severity: 'error',
        message: `Unclosed tag <${tag.tag}>`
      });
    });

  } catch (error) {
    console.warn('Error in HTML linting:', error);
  }

  return diagnostics;
}

const Preview: React.FC<PreviewProps> = ({ html, css, js, jsLanguage = 'js', onRuntimeError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 监听来自 iframe 的运行时错误消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'runtime-error') {
        if (onRuntimeError) {
          onRuntimeError(event.data.errors);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRuntimeError]);



  // 用 ref 跟踪当前代码，避免不必要的重建
  const currentCodeRef = useRef({ html: '', css: '', js: '', jsLanguage: 'js' });
  const iframeInitializedRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // 检查是否真的需要重建 iframe
    const needsRebuild = !iframeInitializedRef.current ||
      currentCodeRef.current.html !== html ||
      currentCodeRef.current.css !== css ||
      currentCodeRef.current.jsLanguage !== jsLanguage;

    // 如果只是 JS 代码改变且 iframe 已经初始化，使用增量更新
    if (iframeInitializedRef.current &&
      currentCodeRef.current.html === html &&
      currentCodeRef.current.css === css &&
      currentCodeRef.current.jsLanguage === jsLanguage &&
      currentCodeRef.current.js !== js) {

      // 直接执行新的 JS 代码，不重建整个 iframe
      try {
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow && (iframeWindow as any).executeUserCode) {
          // 清理 JavaScript 代码（与完整重建时相同的清理逻辑）
          const cleanJs = js
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => {
              const trimmed = line.trim();
              return !trimmed.includes('错误：') &&
                !trimmed.includes('// 错误') &&
                !trimmed.includes('/* 错误') &&
                !trimmed.includes('setTimeout("alert') &&
                !trimmed.includes('setInterval("alert') &&
                !trimmed.includes('eval("') &&
                !trimmed.includes("eval('") &&
                !trimmed.includes('document.write(') &&
                !trimmed.includes('检测到危险函数') &&
                !trimmed.includes('检测到限制的函数');
            })
            .join('\n')
            .replace(/eval\s*\([^)]*\)\s*;?/g, '')
            .replace(/new\s+Function\s*\([^)]*\)\s*;?/g, '')
            .replace(/document\.write\s*\([^)]*\)\s*;?/g, '')
            .replace(/setTimeout\s*\(\s*["'][^"']*["']\s*,\s*\d+\s*\)\s*;?/g, '')
            .replace(/setInterval\s*\(\s*["'][^"']*["']\s*,\s*\d+\s*\)\s*;?/g, '')
            .replace(/alert\s*\([^)]*\)\s*;?/g, '')
            .trim();

          currentCodeRef.current.js = js;
          const incrStart = performance.now();
          (iframeWindow as any).executeUserCode(cleanJs);
          perf.record('preview_incremental_update_ms', performance.now() - incrStart);
          return;
        }
      } catch (error) {
        console.warn('Failed incremental update, falling back to full rebuild:', error);
      }
    }

    if (!needsRebuild) {
      return;
    }
    currentCodeRef.current = { html, css, js, jsLanguage };

    try {
      // 使用更严格的HTML错误检测
      let hasHtmlError = false;
      const trimmedHtml = html.trim();

      if (trimmedHtml !== '') {
        try {
          // 首先尝试使用htmlLinter进行专业检测
          const tempState = EditorState.create({
            doc: html
          });
          const tempView = new EditorView({
            state: tempState,
            parent: document.createElement('div')
          });

          const diagnostics = htmlLinter(tempView);
          hasHtmlError = diagnostics.length > 0;

          tempView.destroy();
        } catch (error) {
          console.warn('Error running HTML linter:', error);
        }

        // 如果htmlLinter没有检测到错误，使用更严格的后备检测
        if (!hasHtmlError) {
          // 检查标签匹配
          const openTags = (trimmedHtml.match(/</g) || []).length;
          const closeTags = (trimmedHtml.match(/>/g) || []).length;

          // 检查是否有不匹配的标签
          if (openTags !== closeTags) {
            hasHtmlError = true;
          } else {
            // 检查是否有不完整的标签（以<开头但不以>结尾的行）
            const lines = trimmedHtml.split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('<') && !trimmedLine.includes('>')) {
                hasHtmlError = true;
                break;
              }
            }
          }
        }

        // 额外的严格检查：检查属性引号是否匹配
        if (!hasHtmlError) {
          // 检查是否有不匹配的属性引号
          const singleQuotes = (trimmedHtml.match(/'/g) || []).length;
          const doubleQuotes = (trimmedHtml.match(/"/g) || []).length;

          // 如果引号数量不匹配，可能是HTML错误
          if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
            hasHtmlError = true;
          }
        }

        // 检查是否有明显的HTML语法错误
        if (!hasHtmlError) {
          // 检查是否有未闭合的属性值
          const attributePattern = /\s+[a-zA-Z-]+=\s*["'][^"']*$/;
          if (attributePattern.test(trimmedHtml)) {
            hasHtmlError = true;
          }
        }
      }

      // 如果HTML有错误，只渲染基本的HTML和CSS
      if (hasHtmlError) {
        // 创建一个临时的div来解析HTML内容
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // 移除所有script标签
        const scripts = tempDiv.getElementsByTagName('script');
        while (scripts.length > 0) {
          scripts[0].parentNode?.removeChild(scripts[0]);
        }

        const content = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  overflow-x: hidden;
                }
                ${css}
              </style>
            </head>
            <body>
              ${tempDiv.innerHTML}
            </body>
          </html>
        `;

        const rebuildStart = performance.now();
        doc.open();
        doc.write(content);
        doc.close();
        perf.record('preview_full_rebuild_ms', performance.now() - rebuildStart);
        iframeInitializedRef.current = true;
        return;
      }

      // 如果没有静态错误，正常加载所有内容
      let libraryScripts = '';
      if (jsLanguage === 'react') {
        libraryScripts = `
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js"></script>
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
        `;
      } else if (jsLanguage === 'vue') {
        libraryScripts = `
          <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js"></script>
        `;
      } else if (jsLanguage === 'ts') {
        // TypeScript需要加载TypeScript编译器和React库（因为TypeScript代码可能包含React）
        libraryScripts = `
          <script src="https://cdnjs.cloudflare.com/ajax/libs/typescript/5.3.3/typescript.min.js"></script>
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js"></script>
          <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js"></script>
        `;
      }

      // 为所有语言都加载 Babel，用于编译导入的代码
      if (jsLanguage !== 'react') {
        libraryScripts += `
          <script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js"></script>
        `;
      }

      // 清理 JavaScript 代码，移除测试用的注释和危险代码
      const cleanJs = js
        // 首先移除多行注释块
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // 移除包含特定内容的行
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return !trimmed.includes('错误：') &&
            !trimmed.includes('// 错误') &&
            !trimmed.includes('/* 错误') &&
            !trimmed.includes('setTimeout("alert') &&
            !trimmed.includes('setInterval("alert') &&
            !trimmed.includes('eval("') &&
            !trimmed.includes("eval('") &&
            !trimmed.includes('document.write(') &&
            !trimmed.includes('检测到危险函数') &&
            !trimmed.includes('检测到限制的函数');
        })
        .join('\n')
        // 移除危险函数调用（在实际执行前先过滤）
        .replace(/eval\s*\([^)]*\)\s*;?/g, '')
        .replace(/new\s+Function\s*\([^)]*\)\s*;?/g, '')
        .replace(/document\.write\s*\([^)]*\)\s*;?/g, '')
        .replace(/setTimeout\s*\(\s*["'][^"']*["']\s*,\s*\d+\s*\)\s*;?/g, '')
        .replace(/setInterval\s*\(\s*["'][^"']*["']\s*,\s*\d+\s*\)\s*;?/g, '')
        .replace(/alert\s*\([^)]*\)\s*;?/g, '')
        .trim();

      // 计算JavaScript代码在HTML文档中的起始行号
      const htmlLines = html.split('\n');
      const cssLines = css.split('\n');
      const libraryScriptsLines = libraryScripts ? libraryScripts.split('\n') : [];

      // 计算偏移量：DOCTYPE(1) + html(1) + head(1) + meta(2) + style(1) + cssLines + style(1) + libraryScripts + head(1) + body(1) + htmlLines + script(1)
      const jsStartLine = 1 + 1 + 1 + 2 + 1 + cssLines.length + 1 + libraryScriptsLines.length + 1 + 1 + htmlLines.length + 1;

      // 转义JavaScript代码，避免模板字符串中的特殊字符问题
      const escapedJs = cleanJs
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      const content = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        ${css}
      </style>
      ${libraryScripts}
    </head>
    <body>
      ${html}
      <script>
        (function() {
          // 运行时错误捕获系统 - 使用 IIFE 避免变量冲突
          let runtimeErrors = [];
          var jsStartLine = ${jsStartLine}; // JavaScript代码在HTML文档中的起始行号
          var handledByTryCatch = false; // 防止 catch 和 window.onerror 重复上报

          // 计算用户代码的实际行号
          function calculateUserCodeLine(htmlLineNumber) {
            return Math.max(1, htmlLineNumber - jsStartLine + 1);
          }
          
          // 捕获全局 JavaScript 错误
          window.onerror = function(message, source, lineno, colno, error) {

            // 如果已被 try/catch 处理过，跳过
            if (handledByTryCatch) {
              handledByTryCatch = false;
              return true;
            }
            
            // 计算用户代码的实际行号
            var userCodeLine = calculateUserCodeLine(lineno || 1);
            
            // 解析错误信息
            let errorMessage = message;
            if (typeof message === 'string') {
              // 清理错误消息
              errorMessage = message
                .replace(/Uncaught\\s+/i, '')
                .replace(/ReferenceError:\\s*/i, '未定义错误: ')
                .replace(/TypeError:\\s*/i, '类型错误: ')
                .replace(/SyntaxError:\\s*/i, '语法错误: ')
                .replace(/RangeError:\\s*/i, '范围错误: ')
                .replace(/Error:\\s*/i, '错误: ')
                .replace(/is not defined/i, '未定义')
                .replace(/is not a function/i, '不是一个函数')
                .replace(/Cannot read propert(y|ies) of undefined/i, '无法读取未定义的属性')
                .replace(/Cannot read propert(y|ies) of null/i, '无法读取null的属性')
                .replace(/Cannot set propert(y|ies) of undefined/i, '无法设置未定义的属性')
                .replace(/Cannot set propert(y|ies) of null/i, '无法设置null的属性');
            }
            
            var errorObj = {
              line: userCodeLine,
              column: colno || 0,
              message: 'Runtime error: ' + errorMessage,
              severity: 'error'
            };
            
            runtimeErrors.push(errorObj);
            
            // 发送错误到父窗口
            try {
              var messageData = {
                type: 'runtime-error',
                errors: runtimeErrors
              };
              window.parent.postMessage(messageData, '*');
            } catch (e) {
              console.error('Failed to send runtime error to parent:', e);
            }
            
            return true; // 阻止默认错误处理
          };
          
          // 提供增量更新函数
          window.executeUserCode = function(newCode) {

            // 清空之前的错误但不发送清除消息（保持错误显示的连续性）
            var previousErrorCount = runtimeErrors.length;
            runtimeErrors = [];
            var executionSuccessful = false;

            try {
              // 清理之前的 React 根节点（如果存在）
              if (window.reactRoot) {
                try {
                  window.reactRoot.unmount();
                } catch (e) {
                  // 忽略卸载错误
                }
                window.reactRoot = null;
              }

              // 清理之前的 Vue 应用（如果存在）
              if (window.vueApp) {
                try {
                  window.vueApp.unmount();
                } catch (e) {
                  // 忽略卸载错误
                }
                window.vueApp = null;
              }

              // 保底清理：仅 React/Vue 模式清空挂载容器，防止未通过 window 引用的实例残留
              if ('${jsLanguage}' === 'react' || '${jsLanguage}' === 'vue') {
                var appContainer = document.getElementById('app');
                if (appContainer) {
                  appContainer.innerHTML = '';
                }
              }
              
              // 编译代码（如果需要）
              let codeToExecute = newCode;
              
              // 如果是 React 代码，需要编译 JSX
              if ('${jsLanguage}' === 'react') {
                try {
                  if (window.Babel) {
                    const result = window.Babel.transform(codeToExecute, {
                      presets: [
                        ["env", { targets: "defaults" }],
                        ["react", { runtime: "classic" }]
                      ],
                      plugins: [],
                    });
                    codeToExecute = result.code || codeToExecute;
                  }
                } catch (compileError) {
                  console.warn('Failed to compile React code:', compileError);
                }
              }
              
              // 如果是 TypeScript 代码，需要编译
              if ('${jsLanguage}' === 'ts') {
                try {
                  if (window.ts) {
                    const result = window.ts.transpileModule(codeToExecute, {
                      compilerOptions: {
                        module: window.ts.ModuleKind.ESNext,
                        target: window.ts.ScriptTarget.ES2020,
                        jsx: window.ts.JsxEmit.Preserve,
                        strict: false,
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true,
                        skipLibCheck: true
                      }
                    });
                    codeToExecute = result.outputText || codeToExecute;
                    
                    // TypeScript编译后可能还包含JSX，需要进一步用Babel编译
                    if (window.Babel && codeToExecute.includes('React.createElement') || codeToExecute.includes('<')) {
                      try {
                        const babelResult = window.Babel.transform(codeToExecute, {
                          presets: [
                            ["env", { targets: "defaults" }],
                            ["react", { runtime: "classic" }]
                          ],
                          plugins: [],
                        });
                        codeToExecute = babelResult.code || codeToExecute;
                      } catch (babelError) {
                        console.warn('Failed to compile TypeScript JSX with Babel:', babelError);
                      }
                    }
                  }
                } catch (compileError) {
                  console.warn('Failed to compile TypeScript code:', compileError);
                }
              }
              
              eval(codeToExecute);
              executionSuccessful = true;
              
              // 延迟检查是否需要清除错误，避免时序竞争
              setTimeout(function() {
                if (executionSuccessful && previousErrorCount > 0 && runtimeErrors.length === 0) {
                  try {
                    window.parent.postMessage({
                      type: 'runtime-error',
                      errors: []
                    }, '*');
                  } catch (e) {
                    console.warn('Failed to send clear message:', e);
                  }
                }
              }, 50); // 给 window.onerror 足够时间处理
              
            } catch (error) {
              handledByTryCatch = true;
              // 直接处理eval错误，解析正确的行号
              var errorLine = 1; // 默认第1行              
              // 尝试从错误堆栈中解析行号
              if (error.stack) {
                var stackLines = error.stack.split('\\n');
                for (var i = 0; i < stackLines.length; i++) {
                  var line = stackLines[i];
                  // 查找eval中的行号信息：<anonymous>:行号:列号
                  var match = line.match(/<anonymous>:(\\d+):(\\d+)/);
                  if (match) {
                    // 对于eval错误，行号已经是相对于eval代码的，所以直接使用
                    errorLine = parseInt(match[1], 10);
                    break;
                  }
                }
              }
              
              // 直接创建错误对象并发送
              var errorObj = {
                line: errorLine,
                column: 0,
                message: 'Runtime error: ' + (error.message || '未知错误'),
                severity: 'error'
              };
              
              runtimeErrors.push(errorObj);
              
              try {
                window.parent.postMessage({
                  type: 'runtime-error',
                  errors: runtimeErrors
                }, '*');
              } catch (e) {
                console.warn('Failed to send eval error:', e);
              }
            }
          };
          
          // 捕获 Promise 拒绝错误
          window.addEventListener('unhandledrejection', function(event) {
            console.error('Unhandled promise rejection:', event.reason);
            
            let errorMessage = 'Unhandled Promise error';
            if (event.reason && event.reason.message) {
              errorMessage = event.reason.message;
            } else if (typeof event.reason === 'string') {
              errorMessage = event.reason;
            }
            
            runtimeErrors.push({
              line: 1,
              column: 0,
              message: 'Promise error: ' + errorMessage,
              severity: 'error'
            });
            
            try {
              window.parent.postMessage({
                type: 'runtime-error',
                errors: runtimeErrors
              }, '*');
            } catch (e) {
              console.warn('Failed to send promise error to parent:', e);
            }
            
            event.preventDefault();
          });
          
          // 初始代码执行 - 编译并执行
          runtimeErrors = []; // 重置错误数组
          
          try {
            // 清理之前的 React 根节点（如果存在）
            if (window.reactRoot) {
              try {
                window.reactRoot.unmount();
              } catch (e) {
                // 忽略卸载错误
              }
              window.reactRoot = null;
            }

            // 清理之前的 Vue 应用（如果存在）
            if (window.vueApp) {
              try {
                window.vueApp.unmount();
              } catch (e) {
                // 忽略卸载错误
              }
              window.vueApp = null;
            }

            // 保底清理：仅 React/Vue 模式清空挂载容器
            if ('${jsLanguage}' === 'react' || '${jsLanguage}' === 'vue') {
              var appContainer = document.getElementById('app');
              if (appContainer) {
                appContainer.innerHTML = '';
              }
            }

            // 编译代码（如果需要）
            let codeToExecute = \`${escapedJs}\`;
            
            // 如果是 React 代码，需要编译 JSX
            if ('${jsLanguage}' === 'react') {
              try {
                if (window.Babel) {
                  const result = window.Babel.transform(codeToExecute, {
                    presets: [
                      ["env", { targets: "defaults" }],
                      ["react", { runtime: "classic" }]
                    ],
                    plugins: [],
                  });
                  codeToExecute = result.code || codeToExecute;
                }
              } catch (compileError) {
                console.warn('Failed to compile React code:', compileError);
              }
            }
            
            // 如果是 TypeScript 代码，需要编译
            if ('${jsLanguage}' === 'ts') {
              try {
                if (window.ts) {
                  const result = window.ts.transpileModule(codeToExecute, {
                    compilerOptions: {
                      module: window.ts.ModuleKind.ESNext,
                      target: window.ts.ScriptTarget.ES2020,
                      jsx: window.ts.JsxEmit.Preserve,
                      strict: false,
                      esModuleInterop: true,
                      allowSyntheticDefaultImports: true,
                      skipLibCheck: true
                    }
                  });
                  codeToExecute = result.outputText || codeToExecute;
                  
                  // TypeScript编译后可能还包含JSX，需要进一步用Babel编译
                  if (window.Babel && (codeToExecute.includes('React.createElement') || codeToExecute.includes('<'))) {
                    try {
                      const babelResult = window.Babel.transform(codeToExecute, {
                        presets: [
                          ["env", { targets: "defaults" }],
                          ["react", { runtime: "classic" }]
                        ],
                        plugins: [],
                      });
                      codeToExecute = babelResult.code || codeToExecute;
                    } catch (babelError) {
                      console.warn('Failed to compile TypeScript JSX with Babel:', babelError);
                    }
                  }
                }
              } catch (compileError) {
                console.warn('Failed to compile TypeScript code:', compileError);
              }
            }
            
            // 执行编译后的代码
            eval(codeToExecute);
            
          } catch (error) {
            handledByTryCatch = true;
            // 直接处理eval错误，解析正确的行号
            var errorLine = 1; // 默认第1行
            
            // 尝试从错误堆栈中解析行号
            if (error.stack) {
              var stackLines = error.stack.split('\\n');
              for (var i = 0; i < stackLines.length; i++) {
                var line = stackLines[i];
                // 查找eval中的行号信息：<anonymous>:行号:列号
                var match = line.match(/<anonymous>:(\\d+):(\\d+)/);
                if (match) {
                  // 对于eval错误，行号已经是相对于eval代码的，所以直接使用
                  errorLine = parseInt(match[1], 10);
                  break;
                }
              }
            }
            
            // 直接创建错误对象并发送
            var errorObj = {
              line: errorLine,
              column: 0,
              message: 'Runtime error: ' + (error.message || '未知错误'),
              severity: 'error'
            };
            
            runtimeErrors.push(errorObj);
            
            try {
              window.parent.postMessage({
                type: 'runtime-error',
                errors: runtimeErrors
              }, '*');
            } catch (e) {
              console.warn('Failed to send eval error:', e);
            }
          }
          
        })(); // 结束 IIFE
      </script>
    </body>
  </html>
`;
      const rebuildStart = performance.now();
      doc.open();
      doc.write(content);
      doc.close();
      perf.record('preview_full_rebuild_ms', performance.now() - rebuildStart);
      iframeInitializedRef.current = true;
    } catch (error) {
      console.error('Preview rendering error:', error);
    }
  }, [html, css, js, jsLanguage]);

  return (
    <PreviewContainer>
      <iframe
        ref={iframeRef}
        title="preview"
        sandbox="allow-scripts allow-same-origin allow-modals allow-pointer-lock allow-downloads"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </PreviewContainer>
  );
};

export default Preview;