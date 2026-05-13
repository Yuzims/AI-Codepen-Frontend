import { perf } from './perfSDK';

// 懒加载大包，避免打包进主 bundle
let _babel: typeof import('@babel/standalone') | null = null;
let _vueParse: typeof import('@vue/compiler-sfc')['parse'] | null = null;

async function getBabel() {
  if (!_babel) _babel = await import('@babel/standalone');
  return _babel;
}

async function getVueParser() {
  if (!_vueParse) {
    const mod = await import('@vue/compiler-sfc');
    _vueParse = mod.parse;
  }
  return _vueParse;
}

export interface CompilationResult {
  code: string;
  error?: string;
  errorDetails?: any;
}

const compileCache = new Map<string, CompilationResult>();

function getCached(key: string): CompilationResult | undefined {
  return compileCache.get(key);
}

function setCache(key: string, result: CompilationResult): void {
  compileCache.set(key, result);
  if (compileCache.size > 50) {
    const firstKey = compileCache.keys().next().value;
    if (firstKey !== undefined) compileCache.delete(firstKey);
  }
}

export const compileTypeScript = async (code: string): Promise<CompilationResult> => {
  return perf.measureAsync('compile_ts_ms', async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ts) {
        const ts = (window as any).ts;
        const result = ts.transpileModule(code, {
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
        return { code: result.outputText };
      }
      return { code };
    } catch (error) {
      console.error('TypeScript compilation error:', error);
      return {
        code,
        error: error instanceof Error ? error.message : 'Unknown TypeScript compilation error',
        errorDetails: error
      };
    }
  });
};

export const loadTypeScriptCompiler = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).ts) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/typescript/5.3.3/typescript.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.error('Failed to load TypeScript compiler');
      reject(new Error('Failed to load TypeScript compiler'));
    };
    document.head.appendChild(script);
  });
};

export const compileReact = async (code: string): Promise<CompilationResult> => {
  const cacheKey = `babel:${code}`;
  const cached = getCached(cacheKey);
  if (cached) {
    perf.record('compile_babel_ms', 0);
    return cached;
  }
  const Babel = await getBabel();
  const result = perf.measure('compile_babel_ms', () => {
    try {
      const transformed = Babel.transform(code, {
        presets: [["react", { runtime: "classic" }]],
        plugins: [],
      });
      return { code: transformed.code || "" };
    } catch (error) {
      console.error("React compilation error:", error);
      return {
        code: "",
        error: error instanceof Error ? error.message : "Unknown compilation error",
        errorDetails: error
      };
    }
  });
  setCache(cacheKey, result);
  return result;
};

export const compileSFCVue = async (code: string): Promise<CompilationResult> => {
  const parse = await getVueParser();
  return perf.measure('compile_vue_sfc_ms', () => {
    try {
      const { descriptor, errors } = parse(code, { filename: "component.vue" });

      if (errors.length > 0) {
        return {
          code: "",
          error: (errors as { message: string }[]).map(e => e.message).join("\n"),
          errorDetails: errors
        };
      }

      const template = descriptor.template?.content || "";
      const script = descriptor.script?.content || descriptor.scriptSetup?.content || "";

      interface StyleBlock {
        type: string;
        content: string;
        scoped?: boolean;
        module?: boolean | string;
        lang?: string;
        [key: string]: any;
      }

      const styles: string = (descriptor.styles as StyleBlock[])
        .map((style: StyleBlock) => style.content)
        .join("\n");

      const compiledCode = `
      const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;

      ${script}

      const template = \`${template}\`;

      if (typeof component === 'undefined') {
        window.component = {
          template: template,
          setup() {
            return {};
          }
        };
      } else {
        component.template = template;
      }

      // Add styles
      if (template) {
        const styleEl = document.createElement('style');
        styleEl.textContent = \`${styles}\`;
        document.head.appendChild(styleEl);
      }
    `;

      return { code: compiledCode };
    } catch (error) {
      console.error("Vue compilation error:", error);
      return {
        code: "",
        error: error instanceof Error ? error.message : "Unknown compilation error",
        errorDetails: error
      };
    }
  });
};

export const compileVue = (code: string): CompilationResult => {
  return { code };
};

export const compileJavaScript = (code: string): CompilationResult => {
  return { code };
};

export const compileJsFramework = async (code: string, language: 'js' | 'react' | 'vue' | 'ts'): Promise<CompilationResult> => {
  try {
    switch (language) {
      case 'react': return await compileReact(code);
      case 'vue':   return await compileSFCVue(code);
      case 'ts':    return await compileTypeScript(code);
      default:      return compileJavaScript(code);
    }
  } catch (error) {
    console.error(`Error compiling ${language}:`, error);
    return {
      code,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error
    };
  }
};

export const compileCssFramework = async (code: string, language: 'css' | 'scss' | 'less'): Promise<CompilationResult> => {
  if (language === 'css') return { code };

  const metricName = language === 'scss' ? 'compile_sass_ms' : 'compile_less_ms';
  return perf.measureAsync(metricName, async () => {
    try {
      let compiledCode: string;
      if (language === 'scss') {
        const { default: sass } = await import('sass');
        const result = sass.compileString(code);
        compiledCode = result.css;
      } else {
        const { default: less } = await import('less');
        const result = await less.render(code);
        compiledCode = result.css;
      }
      return { code: compiledCode };
    } catch (error) {
      console.error(`Error compiling ${language}:`, error);
      return {
        code,
        error: error instanceof Error ? error.message : 'Unknown CSS compilation error',
        errorDetails: error
      };
    }
  });
};
