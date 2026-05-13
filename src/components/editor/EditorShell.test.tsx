import React from 'react';
import { render, screen } from '@testing-library/react';
import EditorShell from './EditorShell';
import { Pen } from '../../services/penService';

jest.mock('../Preview', () => () => <div>Preview Mock</div>);
jest.mock('../DebugPreview', () => () => <div>DebugPreview Mock</div>);
jest.mock('../UserNavbar', () => () => <div>UserNavbar Mock</div>);
jest.mock('../ImportPanel', () => () => <div>ImportPanel Mock</div>);
jest.mock('../AIAgentPanel', () => () => <div>AIAgentPanel Mock</div>);
jest.mock('../ErrorStatusBar', () => () => <div>ErrorStatusBar Mock</div>);

const mockPens: Pen[] = [
  {
    id: '1',
    title: 'One',
    description: '',
    html: '<div>1</div>',
    css: 'body {}',
    js: 'console.log(1)',
    jsLanguage: 'js',
    isPublic: false,
    userId: 'user1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

describe('EditorShell', () => {
  it('renders the page shell and editor placeholders', () => {
    render(
      <EditorShell
        title="Untitled"
        setTitle={jest.fn()}
        currentPen={null}
        userPens={mockPens}
        isSaving={false}
        saveSuccess={false}
        isDeleting={false}
        debugEnabled={false}
        isAgentPanelOpen={false}
        setIsAgentPanelOpen={jest.fn()}
        handleBackToHome={jest.fn()}
        handleLoadPen={jest.fn()}
        handleSave={jest.fn()}
        handleDelete={jest.fn()}
        handleShare={jest.fn()}
        handleCopyShareLink={jest.fn()}
        handleToggleDebug={jest.fn()}
        cssLanguage="css"
        jsLanguage="js"
        handleCssLanguageChange={jest.fn()}
        handleJsLanguageChange={jest.fn()}
        htmlEditor={null}
        cssEditor={null}
        jsEditor={null}
        debouncedHtml="<div>Hello</div>"
        debouncedMergedCss="body {}"
        debouncedMergedJs="console.log(1)"
        importedCssPenIds={[]}
        setImportedCssPenIds={jest.fn()}
        showCssImportPanel={false}
        setShowCssImportPanel={jest.fn()}
        importedJsPenIds={[]}
        setImportedJsPenIds={jest.fn()}
        showJsImportPanel={false}
        setShowJsImportPanel={jest.fn()}
        userPensForImport={mockPens}
        draggedCssIndex={null}
        setDraggedCssIndex={jest.fn()}
        draggedJsIndex={null}
        setDraggedJsIndex={jest.fn()}
        errorCount={0}
        warningCount={0}
        onNavigateNextError={jest.fn()}
        onRuntimeError={jest.fn()}
        agentPlanState={{ status: 'idle' }}
        handleAgentSubmit={jest.fn()}
        handleRequestPatch={jest.fn()}
        patchStatus="idle"
        patchProposal={null}
        patchError=""
        htmlCode="<div>Hello</div>"
        cssCode="body {}"
        jsCode="console.log(1)"
        handleApplyPatch={jest.fn()}
        handleRejectPatch={jest.fn()}
        lastSnapshot={null}
        handleRollback={jest.fn()}
        currentErrors={[]}
        onJumpToError={jest.fn()}
        agentContext={{ penId: '1', title: 'Untitled' }}
        showShareModal={false}
        setShowShareModal={jest.fn()}
        shareUrl="https://example.com"
        showToast={false}
        toastMessage=""
      />
    );

    expect(screen.getByText('My Pens')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getAllByText('CSS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JavaScript').length).toBeGreaterThan(0);
    expect(screen.getByText('Preview Mock')).toBeInTheDocument();
  });
});
