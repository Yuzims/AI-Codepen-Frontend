import { snippetCompletion, CompletionContext } from '@codemirror/autocomplete';

export interface SnippetDefinition {
  prefix: string;
  body: string;
  description?: string;
}

export async function loadSnippets(
  languageId: string
): Promise<ReturnType<typeof snippetCompletion>[]> {
  try {
    const module = await import(`../../snippets/${languageId}.json`);
    const snippets: Record<string, SnippetDefinition> = module.default || module;

    return Object.entries(snippets).map(([name, data]) =>
      snippetCompletion(data.body, {
        label: data.prefix,
        detail: data.description || name,
        type: 'snippet',
      })
    );
  } catch {
    return [];
  }
}

export function createSnippetCompletionSource(languageId: string) {
  let cached: ReturnType<typeof snippetCompletion>[] | null = null;

  return async (context: CompletionContext) => {
    if (!cached) {
      cached = await loadSnippets(languageId);
      if (cached.length === 0) return null;
    }
    const word = context.matchBefore(/\w*/);
    const from = word ? word.from : context.pos;
    return { from, options: cached, validFor: /\w*/ };
  };
}
