import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, EditorState } from '@codemirror/state';
import { Range } from '@codemirror/state';

// 定义编译错误接口
export interface CompilationError {
    line: number;
    column?: number;
    message: string;
    type: 'error' | 'warning';
}

// 添加错误的状态效果
export const addErrorEffect = StateEffect.define<CompilationError[]>();

// 清除错误的状态效果
export const clearErrorsEffect = StateEffect.define();

// 错误装饰
const errorLineDecoration = Decoration.line({
    attributes: { class: 'cm-error-line' }
});

const errorMarkDecoration = Decoration.mark({
    attributes: { class: 'cm-error-mark' }
});

// 创建错误消息装饰
function createErrorMessageDecoration(error: CompilationError): Decoration {
    return Decoration.widget({
        widget: new ErrorMessageWidget(error.message),
        side: 1,
        block: true
    });
}

// 错误消息小部件
class ErrorMessageWidget extends WidgetType {
    constructor(private message: string) {
        super();
    }

    toDOM(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'cm-error-widget';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'cm-error-message';

        const icon = document.createElement('span');
        icon.className = 'cm-error-icon';
        icon.textContent = '⚠';

        const text = document.createElement('span');
        text.className = 'cm-error-text';
        text.textContent = this.message;

        messageDiv.appendChild(icon);
        messageDiv.appendChild(text);
        wrapper.appendChild(messageDiv);

        return wrapper;
    }

    eq(other: WidgetType): boolean {
        return other instanceof ErrorMessageWidget && other.message === this.message;
    }

    updateDOM(dom: HTMLElement): boolean {
        return false; // 不支持更新，直接重新创建
    }

    get estimatedHeight(): number {
        return 25; // 估计高度
    }

    ignoreEvent(): boolean {
        return false;
    }
}

// 错误状态字段
export const errorStateField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },

    update(decorations, tr) {
        decorations = decorations.map(tr.changes);

        for (let effect of tr.effects) {
            if (effect.is(addErrorEffect)) {
                const errors = effect.value;
                const newDecorations: Range<Decoration>[] = [];

                for (const error of errors) {
                    try {
                        // 确保行号在有效范围内
                        const line = Math.max(1, Math.min(error.line, tr.state.doc.lines));
                        const lineObj = tr.state.doc.line(line);

                        // 添加行高亮
                        newDecorations.push(errorLineDecoration.range(lineObj.from, lineObj.from));

                        // 添加错误消息小部件（在行的末尾，显示为块级元素）
                        newDecorations.push(createErrorMessageDecoration(error).range(lineObj.to, lineObj.to));

                        // 如果有列信息，添加标记装饰
                        if (error.column !== undefined) {
                            const pos = Math.min(lineObj.from + error.column, lineObj.to);
                            newDecorations.push(errorMarkDecoration.range(pos, Math.min(pos + 1, lineObj.to)));
                        }
                    } catch (e) {
                        console.warn('Error creating decoration for line', error.line, e);
                    }
                }

                decorations = decorations.update({
                    add: newDecorations,
                    sort: true
                });
            } else if (effect.is(clearErrorsEffect)) {
                decorations = Decoration.none;
            }
        }

        return decorations;
    },

    provide: f => EditorView.decorations.from(f)
});

// 错误高亮主题
export const errorHighlightTheme = EditorView.theme({
    '.cm-error-line': {
        backgroundColor: 'rgba(255, 99, 71, 0.15) !important',
        borderLeft: '4px solid #ff6347 !important',
        paddingLeft: '4px !important',
        position: 'relative'
    },

    '.cm-error-mark': {
        backgroundColor: 'rgba(255, 99, 71, 0.4) !important',
        textDecoration: 'underline wavy #ff6347 !important',
        textUnderlineOffset: '2px !important'
    },

    '.cm-error-widget': {
        display: 'block !important',
        margin: '0 !important',
        padding: '0 !important',
        overflow: 'visible !important',
        zIndex: '1000 !important',
        width: '100% !important'
    },

    '.cm-error-message': {
        display: 'flex !important',
        alignItems: 'center !important',
        backgroundColor: '#fff5f5 !important',
        border: '1px solid #feb2b2 !important',
        borderLeft: '4px solid #f56565 !important',
        borderRadius: '0 4px 4px 0 !important',
        padding: '6px 8px !important',
        margin: '2px 0 2px 4px !important',
        fontSize: '11px !important',
        color: '#c53030 !important',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1) !important',
        maxWidth: 'calc(100% - 8px) !important',
        wordBreak: 'break-word !important',
        position: 'relative !important',
        zIndex: '1000 !important',
        fontFamily: 'inherit !important',
        lineHeight: '1.4 !important'
    },

    '.cm-error-icon': {
        marginRight: '6px !important',
        fontSize: '12px !important',
        color: '#e53e3e !important',
        flexShrink: '0 !important'
    },

    '.cm-error-text': {
        flex: '1 !important',
        lineHeight: '1.4 !important',
        fontSize: '11px !important'
    },

    // 确保错误消息不被其他样式覆盖
    '.cm-editor .cm-error-message': {
        fontFamily: '"Consolas", "Monaco", "Lucida Console", monospace !important',
        fontSize: '11px !important'
    },

    // 让错误行更明显
    '.cm-line.cm-error-line': {
        backgroundColor: 'rgba(255, 99, 71, 0.08) !important'
    }
});

// 更新编辑器错误的辅助函数
export function updateEditorErrors(view: EditorView, errors: CompilationError[]): void {
    view.dispatch({
        effects: [
            clearErrorsEffect.of(null),
            addErrorEffect.of(errors)
        ]
    });
}

// 清除编辑器错误的辅助函数
export function clearEditorErrors(view: EditorView): void {
    view.dispatch({
        effects: clearErrorsEffect.of(null)
    });
}

// 错误高亮扩展
export const errorHighlightExtension = [
    errorStateField,
    errorHighlightTheme
]; 