import { autocompletion, CompletionSource, CompletionResult } from '@codemirror/autocomplete';
import { EditorLanguage, languageRegistry } from './languageRegistry';
import { createSnippetCompletionSource } from './snippetLoader';
import { createTsCompletionSource } from './tsWorkerAdapter';
import { perf } from '../perfSDK';

function wrapWithTiming<T extends CompletionSource>(source: T, metricName: 'completion_snippet_ms' | 'completion_ts_worker_ms'): CompletionSource {
  return async (context) => {
    const start = performance.now();
    const result = await source(context);
    perf.record(metricName, performance.now() - start);
    return result;
  };
}

function wrapAllWithTotal(sources: CompletionSource[]): CompletionSource[] {
  if (sources.length === 0) return sources;
  const aggregated: CompletionSource = async (context) => {
    const start = performance.now();
    const results = await Promise.all(sources.map(s => s(context)));
    perf.record('completion_total_ms', performance.now() - start);
    const options = results.flatMap(r => r?.options ?? []);
    if (options.length === 0) return null;
    const from = Math.min(...results.filter((r): r is CompletionResult => r != null).map(r => r.from));
    return { from, options };
  };
  return [aggregated];
}

export interface TSOptions {
  fileName: string;
  language: 'js' | 'ts' | 'tsx';
}

/**
 * 为指定语言构建完整的 CodeMirror 补全配置。
 * 组合顺序：
 * 1. 语言包原生补全 (baseCompletionSources) — 含关键字 snippet
 * 2. Snippet 补全 (动态 JSON 加载) — 含 fallback 语言
 * 3. TS Language Service 语义补全 (Web Worker)
 */
export function createAutocompleteConfig(languageId: EditorLanguage, tsOptions?: TSOptions) {
  const config = languageRegistry.get(languageId);
  if (!config) {
    return autocompletion({
      override: [],
      defaultKeymap: true,
      maxRenderedOptions: 50,
      activateOnTyping: true,
    });
  }

  const sources: CompletionSource[] = [
    ...config.baseCompletionSources,
    wrapWithTiming(createSnippetCompletionSource(config.snippetLanguageId), 'completion_snippet_ms'),
    ...config.snippetFallbackIds.map(id =>
      wrapWithTiming(createSnippetCompletionSource(id), 'completion_snippet_ms')
    ),
  ];

  if (config.enableLSP && tsOptions) {
    sources.push(wrapWithTiming(createTsCompletionSource(tsOptions.fileName, tsOptions.language), 'completion_ts_worker_ms'));
  }

  return autocompletion({
    override: wrapAllWithTotal(sources),
    defaultKeymap: true,
    maxRenderedOptions: 50,
    activateOnTyping: true,
  });
}

/**
 * 直接返回 CompletionSource 数组，供需要手动组合的场景使用。
 */
export function getCompletionSources(languageId: EditorLanguage): CompletionSource[] {
  const config = languageRegistry.get(languageId);
  if (!config) return [];

  return [
    ...config.baseCompletionSources,
    createSnippetCompletionSource(config.snippetLanguageId),
    ...config.snippetFallbackIds.map(id => createSnippetCompletionSource(id)),
  ];
}
