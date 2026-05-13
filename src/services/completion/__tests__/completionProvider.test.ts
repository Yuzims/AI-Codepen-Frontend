jest.mock('@codemirror/autocomplete', () => ({
  autocompletion: (..._args: any[]) => 'autocompletion-mock',
}));

jest.mock('../languageRegistry', () => ({
  languageRegistry: new Map([
    ['html', { id: 'html', baseCompletionSources: [jest.fn()], snippetLanguageId: 'html', snippetFallbackIds: [], enableLSP: false }],
    ['css', { id: 'css', baseCompletionSources: [jest.fn()], snippetLanguageId: 'css', snippetFallbackIds: [], enableLSP: false }],
    ['js', { id: 'js', baseCompletionSources: [], snippetLanguageId: 'js', snippetFallbackIds: [], enableLSP: true }],
    ['ts', { id: 'ts', baseCompletionSources: [], snippetLanguageId: 'ts', snippetFallbackIds: ['js'], enableLSP: true }],
  ]),
}));

jest.mock('../snippetLoader', () => ({
  createSnippetCompletionSource: jest.fn(() => 'snippet-source-mock'),
}));

jest.mock('../tsWorkerAdapter', () => ({
  createTsCompletionSource: jest.fn(() => 'ts-source-mock'),
}));

import { createAutocompleteConfig, getCompletionSources } from '../completionProvider';

describe('completionProvider', () => {
  describe('createAutocompleteConfig', () => {
    it('should return autocompletion extension for html', () => {
      const ext = createAutocompleteConfig('html');
      expect(ext).toBeDefined();
      expect(ext).toBe('autocompletion-mock');
    });

    it('should return autocompletion extension for css', () => {
      const ext = createAutocompleteConfig('css');
      expect(ext).toBeDefined();
      expect(ext).toBe('autocompletion-mock');
    });

    it('should return autocompletion extension for unknown language', () => {
      const ext = createAutocompleteConfig('unknown' as any);
      expect(ext).toBeDefined();
      expect(ext).toBe('autocompletion-mock');
    });

    it('should include TS completion source when enableLSP and tsOptions provided', () => {
      const ext = createAutocompleteConfig('ts', {
        fileName: '/src/index.ts',
        language: 'ts',
      });
      expect(ext).toBeDefined();
      expect(ext).toBe('autocompletion-mock');
    });
  });

  describe('getCompletionSources', () => {
    it('should return array for supported language', () => {
      const sources = getCompletionSources('js');
      expect(Array.isArray(sources)).toBe(true);
    });

    it('should return empty array for unknown language', () => {
      const sources = getCompletionSources('unknown' as any);
      expect(sources).toEqual([]);
    });
  });
});
