jest.mock('@codemirror/autocomplete', () => ({
  snippetCompletion: jest.fn((body: string, opts: any) => ({ body, ...opts })),
}));

export {};

const mockContext = { pos: 5, matchBefore: () => ({ from: 3, to: 5, text: 'di' }) } as any;

describe('snippetLoader', () => {
  describe('loadSnippets', () => {
    it('should return snippets for html', async () => {
      const { loadSnippets } = await import('../snippetLoader');
      const snippets = await loadSnippets('html');
      expect(snippets.length).toBeGreaterThan(0);
      expect(snippets[0]).toHaveProperty('label');
    });

    it('should return empty array for unknown language', async () => {
      const { loadSnippets } = await import('../snippetLoader');
      const snippets = await loadSnippets('unknown-language');
      expect(snippets).toEqual([]);
    });
  });

  describe('createSnippetCompletionSource', () => {
    it('should return cached snippets on second call', async () => {
      const { createSnippetCompletionSource } = await import('../snippetLoader');
      const source = createSnippetCompletionSource('html');
      const first = await source(mockContext);
      const second = await source(mockContext);
      expect(first).not.toBeNull();
      expect((second as any).options).toBe((first as any).options);
    });
  });
});
