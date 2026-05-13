import { useEffect, useState, useCallback, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { EditorState, Extension, StateEffect } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { vue } from '@codemirror/lang-vue';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import {
  bracketMatchingExtension,
  closeBracketsExtension,
  completionKeymap,
  closeBracketsKeymap
} from '../services/autocompleteService';
import { createAutocompleteConfig, EditorLanguage } from '../services/completion';
import { htmlLint, cssLint, jsLint, errorInfoField } from '../services/lintService';

interface UseEditorInitializationState {
  htmlEditor: EditorView | null;
  cssEditor: EditorView | null;
  jsEditor: EditorView | null;
  isUpdatingFromState: boolean;
}

interface UseEditorInitializationActions {
  setShouldReinitializeEditors: (should: boolean) => void;
}

/**
 * CodeMirror 编辑器初始化 hook
 * 处理三个编辑器的创建、更新和销毁
 */
export function useEditorInitialization(
  htmlCode: string,
  cssCode: string,
  jsCode: string,
  cssLanguage: 'css' | 'scss' | 'less',
  jsLanguage: 'js' | 'react' | 'vue' | 'ts',
  isPenLoaded: boolean,
  isSavingPen: boolean,
  onHtmlCodeChange: (code: string) => void,
  onCssCodeChange: (code: string) => void,
  onJsCodeChange: (code: string) => void
): [UseEditorInitializationState, UseEditorInitializationActions] {
  const [htmlEditor, setHtmlEditor] = useState<EditorView | null>(null);
  const [cssEditor, setCssEditor] = useState<EditorView | null>(null);
  const [jsEditor, setJsEditor] = useState<EditorView | null>(null);
  const [isUpdatingFromState, setIsUpdatingFromState] = useState(false);
  const [shouldReinitializeEditors, setShouldReinitializeEditors] = useState(false);

  const htmlCodeRef = useRef(htmlCode);
  const cssCodeRef = useRef(cssCode);
  const jsCodeRef = useRef(jsCode);
  const onHtmlCodeChangeRef = useRef(onHtmlCodeChange);
  const onCssCodeChangeRef = useRef(onCssCodeChange);
  const onJsCodeChangeRef = useRef(onJsCodeChange);

  useEffect(() => { htmlCodeRef.current = htmlCode; }, [htmlCode]);
  useEffect(() => { cssCodeRef.current = cssCode; }, [cssCode]);
  useEffect(() => { jsCodeRef.current = jsCode; }, [jsCode]);
  useEffect(() => { onHtmlCodeChangeRef.current = onHtmlCodeChange; }, [onHtmlCodeChange]);
  useEffect(() => { onCssCodeChangeRef.current = onCssCodeChange; }, [onCssCodeChange]);
  useEffect(() => { onJsCodeChangeRef.current = onJsCodeChange; }, [onJsCodeChange]);

  // 创建编辑器的辅助函数
  const createEditor = useCallback(
    (
      element: HTMLElement,
      langExtension: Extension,
      setEditor: React.Dispatch<React.SetStateAction<EditorView | null>>,
      setCode: (code: string) => void,
      initialContent: string,
      autocompleteExt?: Extension,
      lintExtension?: Extension | Extension[]
    ) => {
      const commonExtensions = [
        lineNumbers({
          formatNumber: (lineNo) => lineNo.toString()
        }),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        drawSelection({
          drawRangeCursor: true
        }),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
          indentWithTab,
          ...completionKeymap,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap
        ]),
        history(),
        syntaxHighlighting(defaultHighlightStyle),
        bracketMatchingExtension,
        closeBracketsExtension,
        EditorView.theme({
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: '#b3d4fc !important'
          },
          '.cm-selectionBackground': {
            backgroundColor: '#c8e1ff !important'
          },
          '.cm-content': {
            fontFamily:
              '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
            fontSize: '13px !important',
            fontWeight: 'normal !important',
            lineHeight: '1.3 !important',
            letterSpacing: '0 !important',
            textRendering: 'auto !important',
            WebkitFontSmoothing: 'auto !important',
            MozOsxFontSmoothing: 'auto !important',
            fontVariantLigatures: 'none !important'
          },
          '.cm-editor .cm-line': {
            fontFamily:
              '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
            fontSize: '13px !important',
            fontWeight: 'normal !important',
            lineHeight: '1.3 !important',
            letterSpacing: '0 !important'
          },
          '.cm-editor': {
            fontFamily:
              '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important'
          },
          '.cm-gutters': {
            fontFamily:
              '"Consolas", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important',
            fontSize: '12px !important'
          }
        })
      ];

      const state = EditorState.create({
        doc: initialContent,
        extensions: [
          ...commonExtensions,
          langExtension,
          autocompleteExt || [],
          ...(Array.isArray(lintExtension) ? lintExtension : [lintExtension || []]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setTimeout(() => {
                const newContent = update.state.doc.toString();
                setCode(newContent);
              }, 0);
            }
          })
        ]
      });

      const view = new EditorView({
        state,
        parent: element
      });

      setEditor(view);
      return view;
    },
    []
  );

  // 编辑器初始化
  useEffect(() => {
    if (isSavingPen) return;
    if (!isPenLoaded && !shouldReinitializeEditors) return;

    const htmlElement = document.getElementById('html-editor');
    const cssElement = document.getElementById('css-editor');
    const jsElement = document.getElementById('js-editor');

    if (!htmlElement || !cssElement || !jsElement) return;

    // 清理现有编辑器
    if (htmlEditor) {
      htmlEditor.destroy();
      setHtmlEditor(null);
    }
    if (cssEditor) {
      cssEditor.destroy();
      setCssEditor(null);
    }
    if (jsEditor) {
      jsEditor.destroy();
      setJsEditor(null);
    }

    // 清空容器
    htmlElement.innerHTML = '';
    cssElement.innerHTML = '';
    jsElement.innerHTML = '';

    // 设置标志，表示即将进行程序性更新
    setIsUpdatingFromState(true);

    // 创建新编辑器
    createEditor(
      htmlElement,
      html(),
      setHtmlEditor,
      (code: string) => onHtmlCodeChangeRef.current(code),
      htmlCodeRef.current,
      createAutocompleteConfig('html'),
      htmlLint
    );

    createEditor(
      cssElement,
      css(),
      setCssEditor,
      (code: string) => onCssCodeChangeRef.current(code),
      cssCodeRef.current,
      createAutocompleteConfig(cssLanguage as EditorLanguage),
      cssLint
    );

    let jsExtension;
    switch (jsLanguage) {
      case 'react':
        jsExtension = javascript({ jsx: true, typescript: true });
        break;
      case 'vue':
        jsExtension = vue();
        break;
      case 'ts':
        jsExtension = javascript({ typescript: true });
        break;
      case 'js':
      default:
        jsExtension = javascript();
        break;
    }

    const tsLanguageMap: Record<string, 'js' | 'ts' | 'tsx'> = {
      js: 'js',
      react: 'tsx',
      vue: 'ts',
      ts: 'ts'
    };
    const tsLang = tsLanguageMap[jsLanguage] || 'js';

    createEditor(
      jsElement,
      jsExtension,
      setJsEditor,
      (code: string) => onJsCodeChangeRef.current(code),
      jsCodeRef.current,
      createAutocompleteConfig(jsLanguage as EditorLanguage, {
        fileName: '/src/index.' + (tsLang === 'tsx' ? 'tsx' : tsLang === 'ts' ? 'ts' : 'js'),
        language: tsLang
      }),
      jsLint
    );

    // 延迟重置 isUpdatingFromState 标志
    setTimeout(() => {
      setIsUpdatingFromState(false);
    }, 100);

    // 重置重新初始化标志
    if (shouldReinitializeEditors) {
      setShouldReinitializeEditors(false);
    }

    return () => {
      if (htmlEditor) htmlEditor.destroy();
      if (cssEditor) cssEditor.destroy();
      if (jsEditor) jsEditor.destroy();
    };
  }, [shouldReinitializeEditors, jsLanguage, cssLanguage, isPenLoaded, isSavingPen, createEditor]);

  // 同步 React state 变化到编辑器内容
  useEffect(() => {
    if (htmlEditor && cssEditor && jsEditor && !isUpdatingFromState) {
      const currentHtml = htmlEditor.state.doc.toString();
      const currentCss = cssEditor.state.doc.toString();
      const currentJs = jsEditor.state.doc.toString();

      if (currentHtml !== htmlCode) {
        htmlEditor.dispatch({
          changes: {
            from: 0,
            to: htmlEditor.state.doc.length,
            insert: htmlCode
          }
        });
      }

      if (currentCss !== cssCode) {
        cssEditor.dispatch({
          changes: {
            from: 0,
            to: cssEditor.state.doc.length,
            insert: cssCode
          }
        });
      }

      if (currentJs !== jsCode) {
        jsEditor.dispatch({
          changes: {
            from: 0,
            to: jsEditor.state.doc.length,
            insert: jsCode
          }
        });
      }
    }
  }, [htmlCode, cssCode, jsCode, htmlEditor, cssEditor, jsEditor, isUpdatingFromState]);

  const state: UseEditorInitializationState = {
    htmlEditor,
    cssEditor,
    jsEditor,
    isUpdatingFromState
  };

  const actions: UseEditorInitializationActions = {
    setShouldReinitializeEditors
  };

  return [state, actions];
}
