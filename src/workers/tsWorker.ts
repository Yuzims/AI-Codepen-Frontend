/* eslint-disable no-restricted-globals */
import * as ts from 'typescript';

interface WorkerRequest {
  type: 'updateCode' | 'getCompletions';
  requestId: number;
  code: string;
  fileName: string;
  position?: number;
  language?: 'js' | 'ts' | 'tsx';
  triggerCharacter?: string;
}

interface WorkerResponse {
  type: 'completionsResult';
  requestId: number;
  entries: Array<{
    name: string;
    kind: string;
    kindModifiers?: string;
    detail?: string;
    insertText?: string;
  }>;
}

const fileCache = new Map<string, string>();
const libCache = new Map<string, string>();
const fileVersions = new Map<string, number>();

async function fetchLib(fileName: string): Promise<string | undefined> {
  if (libCache.has(fileName)) return libCache.get(fileName);
  const base = fileName.replace(/^.*[\\/]/, '');
  const url = `https://cdn.jsdelivr.net/npm/typescript@4.9.5/lib/${base}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const text = await res.text();
    libCache.set(fileName, text);
    return text;
  } catch {
    return undefined;
  }
}

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.React,
  allowJs: true,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
};

const host: ts.LanguageServiceHost = {
  getCompilationSettings: () => compilerOptions,
  getScriptFileNames: () => Array.from(fileCache.keys()),
  getScriptVersion: (name) => String(fileVersions.get(name) ?? 0),
  getScriptSnapshot: (name) => {
    if (fileCache.has(name)) {
      return ts.ScriptSnapshot.fromString(fileCache.get(name)!);
    }
    if (libCache.has(name)) {
      return ts.ScriptSnapshot.fromString(libCache.get(name)!);
    }
    const base = name.replace(/^.*[\\/]/, '');
    if (libCache.has(base)) {
      return ts.ScriptSnapshot.fromString(libCache.get(base)!);
    }
    return undefined;
  },
  getCurrentDirectory: () => '/',
  getDefaultLibFileName: (opts) => ts.getDefaultLibFileName(opts),
  fileExists: (name) => fileCache.has(name) || libCache.has(name) || libCache.has(name.replace(/^.*[\\/]/, '')),
  readFile: (name) => fileCache.get(name) || libCache.get(name) || libCache.get(name.replace(/^.*[\\/]/, '')),
  directoryExists: () => true,
  getDirectories: () => [],
};

const ls = ts.createLanguageService(host, ts.createDocumentRegistry());

// 启动时立即预加载默认 lib 文件，避免首次补全请求时的冷启动延迟
ensureDefaultLibs();

const ataMapping: Record<string, string> = {
  react: 'https://cdn.jsdelivr.net/npm/@types/react@18/index.d.ts',
  'react-dom': 'https://cdn.jsdelivr.net/npm/@types/react-dom@18/index.d.ts',
  vue: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.d.ts',
};

let pendingLibs = new Set<string>();
let defaultLibsPromise: Promise<void> | null = null;

const referencePathRegex = /\/\/\/\s*<reference\s+path="([^"]+)"\s*\/>/g;
const referenceLibRegex = /\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g;

async function fetchLibFile(baseName: string): Promise<string | undefined> {
  if (libCache.has(baseName)) return libCache.get(baseName);
  const url = `https://cdn.jsdelivr.net/npm/typescript@4.9.5/lib/${baseName}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const text = await res.text();
    libCache.set(baseName, text);
    return text;
  } catch {
    return undefined;
  }
}

function ensureDefaultLibs() {
  if (!defaultLibsPromise) {
    defaultLibsPromise = (async () => {
      const toFetch = [ts.getDefaultLibFileName(compilerOptions)];
      while (toFetch.length > 0) {
        const name = toFetch.shift()!;
        if (libCache.has(name)) continue;
        const text = await fetchLibFile(name);
        if (!text) continue;
        // 处理 /// <reference path="..." />
        referencePathRegex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = referencePathRegex.exec(text)) !== null) {
          if (!libCache.has(match[1])) toFetch.push(match[1]);
        }
        // 处理 /// <reference lib="..." />（lib.es2020.full.d.ts 用这种格式）
        referenceLibRegex.lastIndex = 0;
        while ((match = referenceLibRegex.exec(text)) !== null) {
          const libFile = `lib.${match[1]}.d.ts`;
          if (!libCache.has(libFile)) toFetch.push(libFile);
        }
      }
    })();
  }
  return defaultLibsPromise;
}

async function ensureLibFiles(fileName: string) {
  const program = ls.getProgram();
  if (!program) return;
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) return;

  ts.forEachChild(sourceFile, function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        return;
      }
      if (ataMapping[moduleName] && !libCache.has(`/node_modules/${moduleName}/index.d.ts`)) {
        pendingLibs.add(moduleName);
      }
    }
    ts.forEachChild(node, visit);
  });

  if (pendingLibs.size === 0) return;
  const tasks = Array.from(pendingLibs).map(async (mod) => {
    const url = ataMapping[mod];
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        libCache.set(`/node_modules/${mod}/index.d.ts`, text);
      }
    } catch {
      // ignore
    }
  });
  await Promise.all(tasks);
  pendingLibs.clear();
}

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, requestId, code, fileName, position, language, triggerCharacter } = event.data;

  const ext =
    language === 'tsx' ? '.tsx' : language === 'ts' ? '.ts' : '.js';
  const actualFileName = fileName.endsWith(ext) ? fileName : fileName + ext;

  fileCache.set(actualFileName, code);
  fileVersions.set(actualFileName, (fileVersions.get(actualFileName) ?? 0) + 1);
  // Trigger program update
  ls.getSyntacticDiagnostics(actualFileName);

  if (type === 'getCompletions' && position !== undefined) {
    await ensureDefaultLibs();
    await ensureLibFiles(actualFileName);
    const completions = ls.getCompletionsAtPosition(
      actualFileName,
      position,
      triggerCharacter ? { triggerCharacter: triggerCharacter as ts.CompletionsTriggerCharacter } : undefined
    );
    const entries =
      completions?.entries.map((e) => ({
        name: e.name,
        kind: mapKind(e.kind),
        kindModifiers: e.kindModifiers,
        detail: e.kindModifiers,
      })) || [];
    ctx.postMessage({
      type: 'completionsResult',
      requestId,
      entries,
    } as WorkerResponse);
  }
};

function mapKind(kind: ts.ScriptElementKind): string {
  switch (kind) {
    case ts.ScriptElementKind.variableElement:
    case ts.ScriptElementKind.localVariableElement:
      return 'variable';
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.localFunctionElement:
      return 'function';
    case ts.ScriptElementKind.classElement:
      return 'class';
    case ts.ScriptElementKind.interfaceElement:
      return 'interface';
    case ts.ScriptElementKind.enumElement:
      return 'enum';
    case ts.ScriptElementKind.moduleElement:
    case ts.ScriptElementKind.alias:
      return 'module';
    case ts.ScriptElementKind.memberVariableElement:
      return 'property';
    case ts.ScriptElementKind.memberFunctionElement:
    case ts.ScriptElementKind.constructSignatureElement:
    case ts.ScriptElementKind.callSignatureElement:
    case ts.ScriptElementKind.indexSignatureElement:
      return 'method';
    case ts.ScriptElementKind.enumMemberElement:
      return 'enum';
    case ts.ScriptElementKind.string:
      return 'text';
    case ts.ScriptElementKind.keyword:
      return 'keyword';
    case ts.ScriptElementKind.typeElement:
      return 'type';
    default:
      return 'property';
  }
}
