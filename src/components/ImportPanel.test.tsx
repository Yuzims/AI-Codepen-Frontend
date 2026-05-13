import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportPanel from './ImportPanel';
import { Pen } from '../services/penService';

const mockPens: Pen[] = [
  {
    id: '1',
    title: 'CSS Pen',
    description: '',
    html: '<div>css</div>',
    css: 'body { color: red; }',
    js: '',
    jsLanguage: 'js',
    isPublic: false,
    userId: 'user1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: '2',
    title: 'JS Pen',
    description: '',
    html: '<div>js</div>',
    css: '',
    js: 'console.log("hello");',
    jsLanguage: 'js',
    isPublic: false,
    userId: 'user1',
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02'
  },
  {
    id: '3',
    title: 'Current Pen',
    description: '',
    html: '<div>current</div>',
    css: 'body { color: blue; }',
    js: 'console.log("current");',
    jsLanguage: 'js',
    isPublic: false,
    userId: 'user1',
    createdAt: '2024-01-03',
    updatedAt: '2024-01-03'
  }
];

describe('ImportPanel', () => {
  const setImportedCssPenIds = jest.fn();
  const setImportedJsPenIds = jest.fn();
  const setShowCssImportPanel = jest.fn();
  const setShowJsImportPanel = jest.fn();
  const setDraggedCssIndex = jest.fn();
  const setDraggedJsIndex = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('excludes the current pen from the selectable list', () => {
    render(
      <ImportPanel
        importedCssPenIds={[]}
        setImportedCssPenIds={setImportedCssPenIds}
        showCssImportPanel={true}
        setShowCssImportPanel={setShowCssImportPanel}
        importedJsPenIds={[]}
        setImportedJsPenIds={setImportedJsPenIds}
        showJsImportPanel={true}
        setShowJsImportPanel={setShowJsImportPanel}
        userPens={mockPens}
        currentPenId="3"
        draggedCssIndex={null}
        setDraggedCssIndex={setDraggedCssIndex}
        draggedJsIndex={null}
        setDraggedJsIndex={setDraggedJsIndex}
      />
    );

    expect(screen.getByText(/CSS Pen/)).toBeInTheDocument();
    expect(screen.getByText(/JS Pen/)).toBeInTheDocument();
    expect(screen.queryByText('Current Pen')).not.toBeInTheDocument();
  });

  it('imports all available CSS and JS pens without including the current pen', () => {
    render(
      <ImportPanel
        importedCssPenIds={[]}
        setImportedCssPenIds={setImportedCssPenIds}
        showCssImportPanel={true}
        setShowCssImportPanel={setShowCssImportPanel}
        importedJsPenIds={[]}
        setImportedJsPenIds={setImportedJsPenIds}
        showJsImportPanel={true}
        setShowJsImportPanel={setShowJsImportPanel}
        userPens={mockPens}
        currentPenId="3"
        draggedCssIndex={null}
        setDraggedCssIndex={setDraggedCssIndex}
        draggedJsIndex={null}
        setDraggedJsIndex={setDraggedJsIndex}
      />
    );

    fireEvent.click(screen.getAllByText('全选')[0]);
    fireEvent.click(screen.getAllByText('全选')[1]);

    expect(setImportedCssPenIds).toHaveBeenCalledWith(['1']);
    expect(setImportedJsPenIds).toHaveBeenCalledWith(['2']);
  });
});
