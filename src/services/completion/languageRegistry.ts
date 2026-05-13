import { Extension } from '@codemirror/state';
import { CompletionSource, CompletionContext } from '@codemirror/autocomplete';
import { html, htmlCompletionSource } from '@codemirror/lang-html';
import { css, cssCompletionSource } from '@codemirror/lang-css';
import { javascript, scopeCompletionSource, localCompletionSource, snippets as jsKeywordSnippets } from '@codemirror/lang-javascript';
import { less } from '@codemirror/lang-less';
import { vue } from '@codemirror/lang-vue';
import { htmlCustomSnippetSource } from '../autocompleteService';

export type EditorLanguage =
  | 'html'
  | 'css' | 'scss' | 'less'
  | 'js' | 'react' | 'vue' | 'ts';

export interface LanguageConfig {
  id: EditorLanguage;
  cmLanguage: () => Extension;
  baseCompletionSources: CompletionSource[];
  snippetLanguageId: string;
  snippetFallbackIds: string[];
  enableLSP: boolean;
}

const cssBaseSources: CompletionSource[] = [cssCompletionSource];
const htmlCustomCompletionSource: CompletionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/\w*/);
  const from = word ? word.from : context.pos;
  return { from, options: [htmlCustomSnippetSource], validFor: /\w*/ };
};
const htmlBaseSources: CompletionSource[] = [htmlCompletionSource, htmlCustomCompletionSource];

// JS 关键字 snippet 补全源
const jsKeywordCompletionSource: CompletionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/\w*/);
  if (!word || word.from === word.to) return null;
  return { from: word.from, options: jsKeywordSnippets, validFor: /\w*/ };
};

const jsBaseSources: CompletionSource[] = [localCompletionSource, scopeCompletionSource(globalThis), jsKeywordCompletionSource];

export const languageRegistry = new Map<EditorLanguage, LanguageConfig>([
  [
    'html',
    {
      id: 'html',
      cmLanguage: html,
      baseCompletionSources: htmlBaseSources,
      snippetLanguageId: 'html',
      snippetFallbackIds: [],
      enableLSP: false,
    },
  ],
  [
    'css',
    {
      id: 'css',
      cmLanguage: css,
      baseCompletionSources: cssBaseSources,
      snippetLanguageId: 'css',
      snippetFallbackIds: [],
      enableLSP: false,
    },
  ],
  [
    'scss',
    {
      id: 'scss',
      cmLanguage: css,
      baseCompletionSources: cssBaseSources,
      snippetLanguageId: 'css',
      snippetFallbackIds: [],
      enableLSP: false,
    },
  ],
  [
    'less',
    {
      id: 'less',
      cmLanguage: less,
      baseCompletionSources: cssBaseSources,
      snippetLanguageId: 'css',
      snippetFallbackIds: [],
      enableLSP: false,
    },
  ],
  [
    'js',
    {
      id: 'js',
      cmLanguage: () => javascript(),
      baseCompletionSources: jsBaseSources,
      snippetLanguageId: 'js',
      snippetFallbackIds: [],
      enableLSP: true,
    },
  ],
  [
    'react',
    {
      id: 'react',
      cmLanguage: () => javascript({ jsx: true, typescript: true }),
      baseCompletionSources: jsBaseSources,
      snippetLanguageId: 'react',
      snippetFallbackIds: ['js'],
      enableLSP: true,
    },
  ],
  [
    'vue',
    {
      id: 'vue',
      cmLanguage: vue,
      baseCompletionSources: jsBaseSources,
      snippetLanguageId: 'vue',
      snippetFallbackIds: ['js'],
      enableLSP: true,
    },
  ],
  [
    'ts',
    {
      id: 'ts',
      cmLanguage: () => javascript({ typescript: true }),
      baseCompletionSources: jsBaseSources,
      snippetLanguageId: 'ts',
      snippetFallbackIds: ['js'],
      enableLSP: true,
    },
  ],
]);
