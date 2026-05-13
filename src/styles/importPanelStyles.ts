import styled from '@emotion/styled';

// 导入面板的容器
export const ImportPanelContainer = styled.div`
  padding: 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e4e8;
  border-top: 1px solid #e4e4e4;
`;

// 导入面板标题
export const ImportPanelTitle = styled.div`
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: #24292e;
  display: flex;
  align-items: center;
  gap: 8px;
`;

// 导入计数器
export const ImportCounter = styled.div`
  font-size: 11px;
  color: #6a737d;
`;

// 导入区域容器
export const ImportSection = styled.div`
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

// 导入区域头部
export const ImportSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

// 导入类型标签
export const ImportTypeLabel = styled.span<{ $type: 'css' | 'js' }>`
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.$type === 'css' ? '#0366d6' : '#f1c40f'};
`;

// 按钮组
export const ButtonGroup = styled.div`
  display: flex;
  gap: 4px;
`;

// 切换按钮
export const ToggleButton = styled.button<{ active?: boolean; $type?: 'css' | 'js' }>`
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid #d1d5da;
  border-radius: 3px;
  background: ${props => props.active
        ? (props.$type === 'css' ? '#0366d6' : '#f1c40f')
        : 'white'};
  color: ${props => props.active ? 'white' : '#586069'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

// 清空按钮
export const ClearButton = styled.button`
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid #d73a49;
  border-radius: 3px;
  background: white;
  color: #d73a49;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f6f8fa;
  }
`;

// 已选项容器
export const SelectedItemsContainer = styled.div`
  margin-bottom: 6px;
`;

// 优先级提示
export const PriorityHint = styled.div`
  font-size: 11px;
  color: #6a737d;
  margin-bottom: 4px;
`;

// 拖拽列表
export const DragList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

// 拖拽项
export const DragItem = styled.div<{ isDragging?: boolean }>`
  padding: 4px 8px;
  font-size: 11px;
  background: ${props => props.isDragging ? '#e3f2fd' : '#f8f9fa'};
  color: #24292e;
  border-radius: 4px;
  border: 1px solid #d1d5da;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
  transition: all 0.2s ease;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    background: ${props => props.isDragging ? '#e3f2fd' : '#e9ecef'};
  }
`;

// 拖拽项信息
export const DragItemInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// 索引标签
export const IndexLabel = styled.span`
  color: #6a737d;
  font-size: 10px;
`;

// 项目标题
export const ItemTitle = styled.span<{ $type: 'css' | 'js' }>`
  color: ${props => props.$type === 'css' ? '#0366d6' : '#f1c40f'};
  font-weight: 500;
`;

// 拖拽项控制按钮
export const DragItemControls = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

// 方向控制按钮
export const DirectionButton = styled.button<{ disabled?: boolean }>`
  background: none;
  border: none;
  color: ${props => props.disabled ? '#d1d5da' : '#586069'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 12px;
  padding: 2px 4px;
  transition: color 0.2s ease;

  &:hover:not(:disabled) {
    color: #24292e;
  }
`;

// 移除按钮
export const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #d73a49;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  transition: color 0.2s ease;

  &:hover {
    color: #cb2431;
  }
`;

// 选择面板
export const SelectPanel = styled.div`
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid #d1d5da;
  border-radius: 4px;
  background: white;
  padding: 6px;
`;

// 选择面板头部
export const SelectPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
`;

// 全选按钮
export const SelectAllButton = styled.button`
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid #28a745;
  border-radius: 2px;
  background: white;
  color: #28a745;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f6f8fa;
  }
`;

// 全不选按钮
export const UnselectAllButton = styled.button`
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid #dc3545;
  border-radius: 2px;
  background: white;
  color: #dc3545;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f6f8fa;
  }
`;

// 选择项
export const SelectItem = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.2s ease;

  &:hover {
    background: #f6f8fa;
  }
`;

// 选择项复选框
export const SelectCheckbox = styled.input`
  margin: 0;
`;

// 选择项文本
export const SelectItemText = styled.span<{ selected?: boolean }>`
  color: ${props => props.selected ? '#0366d6' : '#586069'};
  font-weight: ${props => props.selected ? 500 : 400};
`;

// 编辑器区域样式
export const EditorAreaContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

export const EditorsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

export const EditorPanel = styled.div`
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const EditorHeader = styled.div`
  padding: 8px 12px;
  height: 32px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e1e4e8;
  border-top: 1px solid #e4e4e4;
  font-size: 12px;
  font-weight: 600;
  color: #586069;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:first-of-type {
    border-top: none;
  }
`;

export const EditorContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`; 