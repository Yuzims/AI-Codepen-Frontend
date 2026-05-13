export {
  createAutocompleteConfig,
  getCompletionSources,
} from './completionProvider';

export type { TSOptions } from './completionProvider';

export {
  languageRegistry,
} from './languageRegistry';

export type {
  EditorLanguage,
  LanguageConfig,
} from './languageRegistry';

export {
  loadSnippets,
  createSnippetCompletionSource,
} from './snippetLoader';

export type {
  SnippetDefinition,
} from './snippetLoader';
