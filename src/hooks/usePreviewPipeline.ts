import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { compileJsFramework, loadTypeScriptCompiler, compileCssFramework } from '../services/compilerService';
import { Pen } from '../services/penService';

interface UsePreviewPipelineState {
  debouncedHtml: string;
  debouncedMergedCss: string;
  debouncedMergedJs: string;
  compiledCss: string;
  compiledJs: string;
  jsCompilationError: string;
  tsCompilerLoaded: boolean;
}

interface UsePreviewPipelineActions {
  compileJs: (code: string, language: 'js' | 'react' | 'vue' | 'ts') => Promise<string>;
}

/**
 * 预览管道 hook
 * 处理代码编译、防抖、预览更新等
 */
export function usePreviewPipeline(
  htmlCode: string,
  cssCode: string,
  jsCode: string,
  cssLanguage: 'css' | 'scss' | 'less',
  jsLanguage: 'js' | 'react' | 'vue' | 'ts',
  userPens: Pen[],
  importedCssPenIds: string[],
  importedJsPenIds: string[],
  debounceMs: number = 300
): [UsePreviewPipelineState, UsePreviewPipelineActions] {
  // 编译结果状态
  const [compiledCss, setCompiledCss] = useState('body { color: blue; }');
  const [compiledJs, setCompiledJs] = useState('console.log("Hello World");');
  const [jsCompilationError, setJsCompilationError] = useState<string>('');
  const [tsCompilerLoaded, setTSCompilerLoaded] = useState(false);

  // 防抖状态
  const [debouncedHtml, setDebouncedHtml] = useState(htmlCode);
  const [debouncedMergedCss, setDebouncedMergedCss] = useState('body { color: blue; }');
  const [debouncedMergedJs, setDebouncedMergedJs] = useState('console.log("Hello World");');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 编译 JS 框架代码
  const compileJs = useCallback(
    async (code: string, language: 'js' | 'react' | 'vue' | 'ts') => {
      try {
        // 对于 TypeScript，需要等待编译器加载完成
        if (language === 'ts' && !tsCompilerLoaded) {
          console.log('Waiting for TypeScript compiler to load...');
          return code; // 返回原始代码，等待编译器加载
        }

        const result = await compileJsFramework(code, language);

        if (result.error) {
          console.error('Compilation error:', result.error);
          return code; // Return original code if compilation fails
        }
        return result.code;
      } catch (error) {
        console.error(`Error compiling ${language}:`, error);
        return code;
      }
    },
    [tsCompilerLoaded]
  );

  // 编译 CSS
  useEffect(() => {
    if (cssLanguage !== 'css') {
      compileCssFramework(cssCode, cssLanguage).then(result => {
        if (result.error) {
          console.error('CSS compilation error:', result.error);
          setCompiledCss(cssCode);
        } else {
          setCompiledCss(result.code);
        }
      });
    } else {
      setCompiledCss(cssCode);
    }
  }, [cssCode, cssLanguage]);

  // 编译 JS
  useEffect(() => {
    compileJs(jsCode, jsLanguage).then(result => {
      setCompiledJs(result);
    });
  }, [jsCode, jsLanguage, compileJs]);

  // 当 TypeScript 编译器加载完成后，重新编译代码
  useEffect(() => {
    if (tsCompilerLoaded && jsLanguage === 'ts') {
      compileJs(jsCode, jsLanguage).then(setCompiledJs);
    }
  }, [tsCompilerLoaded, jsCode, jsLanguage, compileJs]);

  const mergedCss = useMemo(() => {
    const compiledImportedCss = (userPens || [])
      .filter(pen => pen && importedCssPenIds.includes(pen.id))
      .sort((a, b) => importedCssPenIds.indexOf(a.id) - importedCssPenIds.indexOf(b.id))
      .map(pen => pen.css);

    return [...compiledImportedCss, compiledCss].join('\n\n');
  }, [userPens, importedCssPenIds, compiledCss]);

  const mergedJs = useMemo(() => {
    const compiledImportedJs = (userPens || [])
      .filter(pen => pen && importedJsPenIds.includes(pen.id))
      .sort((a, b) => importedJsPenIds.indexOf(a.id) - importedJsPenIds.indexOf(b.id))
      .map(pen => {
        const penJsLanguage = pen.jsLanguage || 'js';

        if (penJsLanguage === 'react') {
          try {
            const Babel = (window as any).Babel;
            if (Babel) {
              const result = Babel.transform(pen.js, {
                presets: [
                  ["env", { targets: "defaults" }],
                  ["react", { runtime: "classic" }]
                ],
                plugins: [],
              });
              return result.code || pen.js;
            }
          } catch (error) {
            console.warn('Failed to compile imported React code:', error);
          }
        }

        if (penJsLanguage === 'ts') {
          try {
            const ts = (window as any).ts;
            if (ts) {
              const result = ts.transpileModule(pen.js, {
                compilerOptions: {
                  module: ts.ModuleKind.ESNext,
                  target: ts.ScriptTarget.ES2020,
                  jsx: ts.JsxEmit.Preserve,
                  strict: false,
                  esModuleInterop: true,
                  allowSyntheticDefaultImports: true,
                  skipLibCheck: true
                }
              });
              return result.outputText || pen.js;
            }
          } catch (error) {
            console.warn('Failed to compile imported TypeScript code:', error);
          }
        }

        return pen.js;
      });

    return [...compiledImportedJs, compiledJs].join('\n\n');
  }, [userPens, importedJsPenIds, compiledJs]);

  // 加载 TypeScript 编译器
  useEffect(() => {
    loadTypeScriptCompiler()
      .then(() => {
        console.log('TypeScript compiler loaded successfully');
        setTSCompilerLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load TypeScript compiler:', error);
        setTSCompilerLoaded(true);
      });
  }, []);

  // 防抖：300ms 内连续输入只触发一次预览更新
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedHtml(htmlCode);
      setDebouncedMergedCss(mergedCss);
      setDebouncedMergedJs(mergedJs);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [htmlCode, mergedCss, mergedJs, debounceMs]);

  const state: UsePreviewPipelineState = {
    debouncedHtml,
    debouncedMergedCss,
    debouncedMergedJs,
    compiledCss,
    compiledJs,
    jsCompilationError,
    tsCompilerLoaded
  };

  const actions: UsePreviewPipelineActions = {
    compileJs
  };

  return [state, actions];
}
