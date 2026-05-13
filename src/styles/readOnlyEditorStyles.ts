import styled from '@emotion/styled';

export const EditorContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-right: 1px solid #e1e4e8;
  position: relative;
`;

export const TabContainer = styled.div`
  display: flex;
  background-color: #f8f9ff;
  border-bottom: 1px solid #e1e8ff;
  height: 32px;
  flex-shrink: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  width: 100%;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #c1c8ff #f8f9ff;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: #f8f9ff;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c8ff;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #a8b3ff;
  }
`;

export const TabButton = styled.button<{ active: boolean }>`
  flex-shrink: 0;
  border: none;
  background-color: ${props => props.active ? '#ffffff' : 'transparent'};
  color: ${props => props.active ? '#3b82f6' : '#6b7280'};
  font-size: 12px;
  font-weight: ${props => props.active ? '600' : '500'};
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid ${props => props.active ? '#3b82f6' : 'transparent'};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 80px;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background-color: ${props => props.active ? '#ffffff' : '#f1f5ff'};
    color: ${props => props.active ? '#3b82f6' : '#374151'};
  }

  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px #93c5fd;
  }

  &:first-child {
    border-radius: 0 0 0 8px;
  }

  &:last-child {
    border-radius: 0 0 8px 0;
  }
`;

export const EditorContent = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
  margin-top: 32px;
`;

export const CodeEditor = styled.div`
  height: 100%;
  width: 100%;
  overflow: auto;
  
  .cm-editor {
    height: 100%;
    max-height: 100%;
    overflow: auto;
    transform: translateZ(0);
    font-family: "Consolas", "Monaco", "Lucida Console", "Liberation Mono",
      "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important;
    font-size: 13px !important;
    font-weight: normal !important;
    line-height: 1.3 !important;
    font-variant-ligatures: none !important;
    text-rendering: auto !important;
    -webkit-font-smoothing: auto !important;
    -moz-osx-font-smoothing: auto !important;
    letter-spacing: 0 !important;
    will-change: transform;
  }

  .cm-scroller {
    overflow: auto !important;
    max-height: 100% !important;
  }

  .cm-gutters {
    background-color: #f8f8f8;
    border-right: 1px solid #e8e8e8;
    color: #858585;
  }

  .cm-lineNumbers {
    min-width: 3ch;
    text-align: right;
    padding-right: 16px;
    font-size: 12px !important;
    font-family: "Consolas", "Monaco", "Lucida Console", "Liberation Mono",
      "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important;
    font-weight: normal !important;
    letter-spacing: 0 !important;
  }

  .cm-content {
    background-color: #ffffff;
    caret-color: #3b82f6;
    padding: 12px 16px;
    font-family: "Consolas", "Monaco", "Lucida Console", "Liberation Mono",
      "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important;
    font-size: 13px !important;
    font-weight: normal !important;
    line-height: 1.3 !important;
    letter-spacing: 0 !important;
    text-rendering: auto !important;
    -webkit-font-smoothing: auto !important;
    -moz-osx-font-smoothing: auto !important;
    font-variant-ligatures: none !important;
  }

  /* 改善文本选中效果 */
  .cm-editor .cm-selectionBackground {
    background-color: #dbeafe !important;
    opacity: 0.8 !important;
  }

  .cm-editor.cm-focused .cm-selectionBackground {
    background-color: #bfdbfe !important;
    opacity: 1 !important;
  }

  /* 强制覆盖 CodeMirror 默认选中样式 */
  .cm-editor .cm-content ::selection {
    background-color: #bfdbfe !important;
    color: inherit !important;
  }

  .cm-editor .cm-content ::-moz-selection {
    background-color: #bfdbfe !important;
    color: inherit !important;
  }

  /* 确保选中层在正确的层级 */
  .cm-editor .cm-selectionLayer {
    z-index: -1 !important;
  }

  /* 改善拖拽选择的视觉效果 */
  .cm-editor .cm-selectionMatch {
    background-color: #fef3c7 !important;
  }

  /* 改善当前行高亮 */
  .cm-activeLine {
    background-color: #f8fafc !important;
  }

  /* 改善光标线 */
  .cm-cursor {
    border-left-color: #3b82f6 !important;
    border-left-width: 2px !important;
  }

  /* 改善搜索匹配高亮 */
  .cm-searchMatch {
    background-color: #fef3c7;
    border: 1px solid #f59e0b;
  }

  .cm-searchMatch.cm-searchMatch-selected {
    background-color: #fbbf24;
    border: 1px solid #d97706;
  }

  /* 改善括号匹配 */
  .cm-matchingBracket {
    background-color: #dbeafe;
    border: 1px solid #3b82f6;
    border-radius: 2px;
  }

  /* 强制应用等宽字体到所有CodeMirror元素 */
  .cm-editor * {
    font-family: "Consolas", "Monaco", "Lucida Console", "Liberation Mono",
      "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important;
  }

  .cm-editor .cm-line,
  .cm-editor .cm-content,
  .cm-editor .cm-gutters,
  .cm-editor .cm-lineNumbers,
  .cm-editor .cm-gutterElement {
    font-family: "Consolas", "Monaco", "Lucida Console", "Liberation Mono",
      "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace !important;
    font-size: 13px !important;
    font-weight: normal !important;
    line-height: 1.3 !important;
    letter-spacing: 0 !important;
    font-variant-ligatures: none !important;
  }
`;

export const NoContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #586069;
  font-size: 14px;
  background-color: #f8f9fa;
`;

export const ImportCount = styled.span`
  font-size: 10px;
  opacity: 0.7;
`; 