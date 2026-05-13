import { bracketMatching } from '@codemirror/language';
import { completionKeymap, closeBracketsKeymap, snippetCompletion, closeBrackets } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';

export const htmlCustomSnippetSource = snippetCompletion(
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n</head>\n<body>\n\t${2}\n</body>\n</html>',
  { label: 'html5', type: 'snippet' }
);

export const bracketMatchingExtension = bracketMatching();

export const closeBracketsExtension = closeBrackets();

export { completionKeymap, closeBracketsKeymap };
