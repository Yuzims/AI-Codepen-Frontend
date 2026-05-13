import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPen, Pen, getUserPens } from '../services/penService';
import Preview from '../components/Preview';
import ReadOnlyEditor from '../components/ReadOnlyEditor';
import { compileJsFramework, loadTypeScriptCompiler, compileCssFramework } from '../services/compilerService';
import Split from 'react-split';
import { Global } from '@emotion/react';
import {
    PageContainer,
    Header,
    Container,
    Title,
    Description,
    PreviewContainer,
    PreviewHeader,
    PreviewTitle,
    PreviewContent
} from '../styles/previewPageStyles';

const PreviewPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [pen, setPen] = useState<Pen | null>(null);
    const [allPens, setAllPens] = useState<Pen[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [compiledCss, setCompiledCss] = useState('');
    const [compiledJs, setCompiledJs] = useState('');
    const [mergedCss, setMergedCss] = useState('');
    const [mergedJs, setMergedJs] = useState('');
    const [tsCompilerLoaded, setTSCompilerLoaded] = useState(false);

    // 编译 JavaScript 框架代码，使用compilerService中共享的编译服务
    const compileJs = async (code: string, language: 'js' | 'react' | 'vue' | 'ts') => {
        try {
            const result = await compileJsFramework(code, language);
            return result.code;
        } catch (error) {
            console.error(`Error compiling ${language}:`, error);
            return code;
        }
    };

    // 编译CSS、SCSS、LESS，使用complierService中共享的编译服务
    const compileCss = async (code: string, language: 'css' | 'scss' | 'less') => {
        try {
            const result = await compileCssFramework(code, language);
            return result.code;
        } catch (error) {
            console.error(`Error compiling ${language}:`, error);
            return code;
        }
    };

    // 加载 TypeScript 编译器
    useEffect(() => {
        loadTypeScriptCompiler()
            .then(() => {
                setTSCompilerLoaded(true);
            })
            .catch(error => {
                console.error('Failed to load TypeScript compiler:', error);
                // 即使加载失败，也设置为true，避免无限等待
                setTSCompilerLoaded(true);
            });
    }, []);

    // 获取所有用户的 Pen（用于解析导入依赖）
    const fetchAllPens = useCallback(async () => {
        try {
            const pens = await getUserPens();
            setAllPens(pens);
        } catch (error) {
            console.error('Failed to fetch all pens:', error);
            setAllPens([]);
        }
    }, []);

    // 合并导入的 CSS/JS
    const mergeDependencies = useCallback((penData: Pen, allPensData: Pen[]) => {
        // 合并 CSS
        const importedCss = (penData.importedCssPenIds || [])
            .map(penId => allPensData.find(p => p.id === penId))
            .filter(Boolean)
            .map(p => p!.css)
            .join('\n\n');

        // 合并 JS
        const importedJs = (penData.importedJsPenIds || [])
            .map(penId => allPensData.find(p => p.id === penId))
            .filter(Boolean)
            .map(p => p!.js)
            .join('\n\n');

        const finalCss = [importedCss, compiledCss].filter(Boolean).join('\n\n');
        const finalJs = [importedJs, compiledJs].filter(Boolean).join('\n\n');

        setMergedCss(finalCss);
        setMergedJs(finalJs);
    }, [compiledCss, compiledJs]);

    // 处理代码编译的函数
    const processCodeCompilation = useCallback(async (penData: Pen) => {
        try {
            const cssLanguage = penData.cssLanguage || 'css';
            const jsLanguage = penData.jsLanguage || 'js';

            // 编译CSS（不需要等待TypeScript编译器）
            const compiledCssResult = await compileCss(penData.css, cssLanguage);
            setCompiledCss(compiledCssResult);

            // 对于TypeScript，需要等待编译器加载完成
            if (jsLanguage === 'ts' && !tsCompilerLoaded) {
                return; // 等待编译器加载
            }

            // 编译JavaScript/TypeScript
            const compiledJsResult = await compileJs(penData.js, jsLanguage);
            setCompiledJs(compiledJsResult);
        } catch (error) {
            console.error('Error during code compilation:', error);
            setError('代码编译失败');
        }
    }, [tsCompilerLoaded]);

    // 获取Pen数据
    useEffect(() => {
        const fetchPen = async () => {
            if (!id) return;

            try {
                setLoading(true);
                setError(null);

                // 并行获取 Pen 数据和所有 Pen 列表
                const [data, allPensData] = await Promise.all([
                    getPen(id),
                    getUserPens().catch(() => []) // 如果获取失败，使用空数组
                ]);

                setPen(data);
                setAllPens(allPensData);

                // 处理代码编译
                await processCodeCompilation(data);
            } catch (err) {
                setError('无法加载代码片段');
                console.error('Error fetching pen:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPen();
    }, [id, processCodeCompilation]);

    // 当编译完成或依赖数据准备好时，合并依赖
    useEffect(() => {
        if (pen && allPens.length >= 0 && (compiledCss || compiledJs)) {
            mergeDependencies(pen, allPens);
        }
    }, [pen, allPens, compiledCss, compiledJs, mergeDependencies]);

    // 当TypeScript编译器加载完成后，重新处理代码编译
    useEffect(() => {
        if (tsCompilerLoaded && pen) {
            processCodeCompilation(pen);
        }
    }, [tsCompilerLoaded, pen, processCodeCompilation]);

    if (loading) {
        return (
            <PageContainer>
                <Container>
                    <div>加载中...</div>
                </Container>
            </PageContainer>
        );
    }

    if (error || !pen) {
        return (
            <PageContainer>
                <Container>
                    <div>{error || '代码片段不存在'}</div>
                </Container>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <Global styles={`
               .gutter {
                 background-color: #e1e4e8;
                 background-clip: padding-box;
                 transition: background 0.2s;
                 z-index: 10;
               }
               .gutter.gutter-horizontal {
                 cursor: col-resize;
                 width: 6px;
               }
               .gutter.gutter-vertical {
                 cursor: row-resize;
                 height: 6px;
               }
               .gutter:hover {
                 background-color: #b3d4fc;
               }
            `} />
            <Header>
                <Container>
                    <Title>{pen.title}</Title>
                    {pen.description && <Description>{pen.description}</Description>}
                    {/* 显示导入依赖信息 */}
                    {((pen.importedCssPenIds && pen.importedCssPenIds.length > 0) ||
                        (pen.importedJsPenIds && pen.importedJsPenIds.length > 0)) && (
                            <div style={{
                                marginTop: '8px',
                                fontSize: '12px',
                                color: '#6a737d',
                                display: 'flex',
                                gap: '16px'
                            }}>
                                {pen.importedCssPenIds && pen.importedCssPenIds.length > 0 && (
                                    <span>
                                        🎨 导入了 {pen.importedCssPenIds.length} 个 CSS
                                    </span>
                                )}
                                {pen.importedJsPenIds && pen.importedJsPenIds.length > 0 && (
                                    <span>
                                        ⚡ 导入了 {pen.importedJsPenIds.length} 个 JS
                                    </span>
                                )}
                            </div>
                        )}
                </Container>
            </Header>
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <Split
                    direction="horizontal"
                    sizes={[50, 50]}
                    minSize={200}
                    gutterSize={6}
                    style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}
                >
                    {/* 左侧只读代码编辑器 */}
                    <ReadOnlyEditor
                        html={pen.html}
                        css={pen.css}
                        js={pen.js}
                        jsLanguage={pen.jsLanguage || 'js'}
                        importedCssPens={
                            (pen.importedCssPenIds || [])
                                .map(penId => allPens.find(p => p.id === penId))
                                .filter(Boolean)
                                .map(p => ({
                                    id: p!.id,
                                    title: p!.title,
                                    css: p!.css,
                                    js: p!.js
                                }))
                        }
                        importedJsPens={
                            (pen.importedJsPenIds || [])
                                .map(penId => allPens.find(p => p.id === penId))
                                .filter(Boolean)
                                .map(p => ({
                                    id: p!.id,
                                    title: p!.title,
                                    css: p!.css,
                                    js: p!.js
                                }))
                        }
                        currentPenTitle={pen.title}
                    />
                    {/* 右侧预览区域 */}
                    <PreviewContainer>
                        <PreviewHeader>
                            <PreviewTitle>预览</PreviewTitle>
                        </PreviewHeader>
                        <PreviewContent>
                            <Preview
                                html={pen.html}
                                css={mergedCss || compiledCss}
                                js={mergedJs || compiledJs}
                                jsLanguage={pen.jsLanguage || 'js'}
                            />
                        </PreviewContent>
                    </PreviewContainer>
                </Split>
            </div>
        </PageContainer>
    );
};

export default PreviewPage;