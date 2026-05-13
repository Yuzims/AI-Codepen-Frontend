jest.mock('@codemirror/lang-html', () => ({ html: {}, htmlCompletionSource: jest.fn() }));
jest.mock('@codemirror/lang-css', () => ({ css: {}, cssCompletionSource: jest.fn() }));
jest.mock('@codemirror/lang-javascript', () => ({
  javascript: jest.fn(() => ({})),
  localCompletionSource: jest.fn(),
  scopeCompletionSource: jest.fn(() => jest.fn()),
  snippets: [],
}));
jest.mock('@codemirror/lang-less', () => ({ less: {} }));
jest.mock('@codemirror/lang-vue', () => ({ vue: {} }));
jest.mock('@codemirror/autocomplete', () => ({}));
jest.mock('@codemirror/state', () => ({}));
jest.mock('../../autocompleteService', () => ({ htmlCustomSnippetSource: {} }));

import { languageRegistry, EditorLanguage } from '../languageRegistry';

describe('languageRegistry', () => {
  it('should contain all supported languages', () => {
    const expectedLanguages: EditorLanguage[] = [
      'html', 'css', 'scss', 'less',
      'js', 'react', 'vue', 'ts',
    ];
    expectedLanguages.forEach((lang) => {
      expect(languageRegistry.has(lang)).toBe(true);
    });
  });

  it('should have correct baseCompletionSources for html', () => {
    const config = languageRegistry.get('html')!;
    expect(config.id).toBe('html');
    expect(config.snippetLanguageId).toBe('html');
    expect(config.enableLSP).toBe(false);
    expect(config.baseCompletionSources.length).toBeGreaterThanOrEqual(1);
  });

  it('should have correct baseCompletionSources for css', () => {
    const config = languageRegistry.get('css')!;
    expect(config.id).toBe('css');
    expect(config.snippetLanguageId).toBe('css');
    expect(config.enableLSP).toBe(false);
  });

  it('should enable LSP for js, react, vue, ts', () => {
    const lspLanguages: EditorLanguage[] = ['js', 'react', 'vue', 'ts'];
    lspLanguages.forEach((lang) => {
      const config = languageRegistry.get(lang)!;
      expect(config.enableLSP).toBe(true);
      expect(config.baseCompletionSources).toBeDefined();
    });
  });

  it('should map scss and less to css snippets', () => {
    expect(languageRegistry.get('scss')!.snippetLanguageId).toBe('css');
    expect(languageRegistry.get('less')!.snippetLanguageId).toBe('css');
  });
});
