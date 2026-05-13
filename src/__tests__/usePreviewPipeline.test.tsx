import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { usePreviewPipeline } from '../hooks/usePreviewPipeline';

const userPens = [
  {
    id: 'imported-css',
    css: '.imported { color: green; }',
    js: 'console.log("imported js");',
    jsLanguage: 'js'
  },
  {
    id: 'ignored',
    css: '.ignored { color: red; }',
    js: 'console.log("ignored");',
    jsLanguage: 'js'
  }
] as any;

function Probe({ onState }: { onState: (state: any) => void }) {
  const [state] = usePreviewPipeline(
    '<div>Hello</div>',
    'body { color: blue; }',
    'console.log("Hello World");',
    'css',
    'js',
    userPens,
    ['imported-css'],
    ['imported-css']
  );

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return null;
}

describe('usePreviewPipeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (window as any).ts = {};
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (window as any).ts;
  });

  it('merges imported code and emits debounced preview state', async () => {
    let latestState: any = null;

    render(<Probe onState={(state) => {
      latestState = state;
    }} />);

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestState).not.toBeNull();
    expect(latestState.compiledCss).toBe('body { color: blue; }');
    expect(latestState.compiledJs).toBe('console.log("Hello World");');
    expect(latestState.debouncedHtml).toBe('<div>Hello</div>');
    expect(latestState.debouncedMergedCss).toBe('.imported { color: green; }\n\nbody { color: blue; }');
    expect(latestState.debouncedMergedJs).toBe('console.log("imported js");\n\nconsole.log("Hello World");');
  });
});
