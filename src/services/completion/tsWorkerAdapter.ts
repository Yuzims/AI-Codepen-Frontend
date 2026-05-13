import { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { degradationController } from '../perfMonitor';

let worker: Worker | null = null;
let workerFailed = false;
let requestId = 0;
const pending = new Map<
  number,
  { resolve: (value: Array<{ name: string; kind: string; kindModifiers?: string; detail?: string }>) => void; timer: ReturnType<typeof setTimeout> }
>();

const TIMEOUT_MS = 3000;

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('../../workers/tsWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const { type, requestId: id, entries } = event.data;
        if (type === 'completionsResult') {
          const p = pending.get(id);
          if (p) {
            clearTimeout(p.timer);
            p.resolve(entries);
            pending.delete(id);
          }
        }
      };
      worker.onerror = (e) => {
        console.warn('[TS Worker] Error:', e.message);
        workerFailed = true;
        worker = null;
        for (const [id, p] of pending) {
          clearTimeout(p.timer);
          p.resolve([]);
        }
        pending.clear();
      };
    } catch (e) {
      console.warn('[TS Worker] Failed to create:', e);
      workerFailed = true;
      return null;
    }
  }
  return worker;
}

export async function requestTsCompletions(
  code: string,
  fileName: string,
  position: number,
  language: 'js' | 'ts' | 'tsx',
  triggerCharacter?: string
): Promise<Completion[]> {
  const w = getWorker();
  if (!w) return [];

  const id = ++requestId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve([]);
    }, TIMEOUT_MS);

    pending.set(id, {
      resolve: (entries) => {
        resolve(
          entries.map((e) => ({
            label: e.name,
            type: mapTsKindToCmType(e.kind),
            detail: e.detail || e.kind,
          }))
        );
      },
      timer,
    });
    w.postMessage({ type: 'getCompletions', requestId: id, code, fileName, position, language, triggerCharacter });
  });
}

export function createTsCompletionSource(
  fileName: string,
  language: 'js' | 'ts' | 'tsx'
): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (degradationController.isStrategyActive('disable_ts_completions')) {
      return null;
    }

    const { state, pos } = context;
    const code = state.doc.toString();
    const charBefore = pos > 0 ? state.doc.sliceString(pos - 1, pos) : '';
    const isDotTrigger = charBefore === '.';

    // 非显式触发且不是 . 触发时，需要有输入中的单词才激活
    if (!context.explicit && !isDotTrigger) {
      const word = context.matchBefore(/[\w$]+$/);
      if (!word || word.to - word.from < 2) return null;
    }

    const word = context.matchBefore(/[\w$]*$/);
    const from = word && word.from < pos ? word.from : pos;

    const completions = await requestTsCompletions(
      code,
      fileName,
      pos,
      language,
      isDotTrigger ? '.' : undefined
    );
    if (!completions.length) return null;

    return {
      from,
      options: completions,
      validFor: /^[\w$]*$/,
    };
  };
}

function mapTsKindToCmType(kind: string): string {
  switch (kind) {
    case 'function':
      return 'function';
    case 'method':
      return 'method';
    case 'class':
      return 'class';
    case 'interface':
    case 'type':
      return 'type';
    case 'variable':
      return 'variable';
    case 'property':
      return 'property';
    case 'enum':
      return 'enum';
    case 'module':
      return 'namespace';
    case 'keyword':
      return 'keyword';
    case 'text':
      return 'text';
    default:
      return 'property';
  }
}
