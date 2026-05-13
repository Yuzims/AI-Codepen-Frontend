import React, { useEffect, useState } from 'react';
import { getUserPens, Pen } from '../services/penService';
import { getCurrentUser } from '../services/authStorage';
import UserNavbar from '../components/UserNavbar';
import AIGenerateModal from '../components/AIGenerateModal';
import {
    PageContainer,
    Container,
    Header,
    Title,
    CreateButton,
    HeaderActions,
    SecondaryActionButton,
    PenGrid,
    PenCard,
    ShareButton,
    Toast,
    PenTitle,
    PenDescription,
    PenMeta,
    PenDate,
    PenStatus,
    EmptyState,
    EmptyIcon,
    EmptyTitle,
    EmptyText,
    EmptyActions
} from '../styles/pensPageStyles';

const getPensCacheKey = () => {
    const currentUser = getCurrentUser() as { id?: string; username?: string } | null;
    const userKey = currentUser?.id || currentUser?.username || 'anonymous';
    return `pens_cache_v1:${userKey}`;
};

const readCachedPens = (): Pen[] => {
    try {
        const raw = localStorage.getItem(getPensCacheKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.pens) ? parsed.pens : [];
    } catch {
        return [];
    }
};

const writeCachedPens = (pens: Pen[]) => {
    try {
        localStorage.setItem(getPensCacheKey(), JSON.stringify({ pens, updatedAt: Date.now() }));
    } catch {
        // ignore cache write failures
    }
};

const LoadingCard: React.FC = () => (
    <div
        style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            height: '200px',
            overflow: 'hidden'
        }}
    >
        <div style={{ width: '72px', height: '24px', borderRadius: '999px', background: '#edf0f7', marginBottom: '18px' }} />
        <div style={{ width: '68%', height: '18px', borderRadius: '8px', background: '#edf0f7', marginBottom: '12px' }} />
        <div style={{ width: '92%', height: '14px', borderRadius: '8px', background: '#edf0f7', marginBottom: '8px' }} />
        <div style={{ width: '78%', height: '14px', borderRadius: '8px', background: '#edf0f7', marginBottom: 'auto' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
            <div style={{ width: '96px', height: '12px', borderRadius: '999px', background: '#edf0f7' }} />
            <div style={{ width: '48px', height: '20px', borderRadius: '999px', background: '#edf0f7' }} />
        </div>
    </div>
);

const PensPage: React.FC = () => {
    const [pens, setPens] = useState<Pen[]>(() => readCachedPens());
    const [loading, setLoading] = useState(() => readCachedPens().length === 0);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
    const [hasMore, setHasMore] = useState(() => readCachedPens().length >= 20);

    useEffect(() => {
        const loadPens = async () => {
            try {
                // 首屏只加载20条，显著改善LCP
                const userPens = await getUserPens(20, 0);
                setPens(userPens);
                setHasMore(userPens.length >= 20);
                writeCachedPens(userPens);
            } catch (error) {
                console.error('Error loading pens:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPens();
    }, []);

    const loadMore = async () => {
        try {
            const nextPens = await getUserPens(20, pens.length);
            if (nextPens.length > 0) {
                const mergedPens = [...pens, ...nextPens];
                setPens(mergedPens);
                setHasMore(nextPens.length >= 20);
                writeCachedPens(mergedPens);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more pens:', error);
        }
    };

    const handleShare = (e: React.MouseEvent, penId: string) => {
        e.preventDefault();
        const shareUrl = `${window.location.origin}/p/${penId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setToastMessage('分享链接已复制到剪贴板！');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            setToastMessage('复制失败，请手动复制链接');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        });
    };

    if (loading) {
        return (
            <PageContainer>
                <UserNavbar />
                <Container>
                    <Header>
                        <Title>我的代码片段</Title>
                        <HeaderActions>
                            <SecondaryActionButton disabled>
                                AI 生成
                            </SecondaryActionButton>
                            <CreateButton to="/editor">
                                ✨ 创建新项目
                            </CreateButton>
                        </HeaderActions>
                    </Header>
                    <PenGrid aria-busy="true">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <LoadingCard key={index} />
                        ))}
                    </PenGrid>
                </Container>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <UserNavbar />
            <Container>
                <Header>
                    <Title>我的代码片段</Title>
                    <HeaderActions>
                        <SecondaryActionButton onClick={() => setShowAIGenerateModal(true)}>
                            AI 生成
                        </SecondaryActionButton>
                        <CreateButton to="/editor">
                            ✨ 创建新项目
                        </CreateButton>
                    </HeaderActions>
                </Header>

                {pens.length === 0 ? (
                    <EmptyState>
                        <EmptyIcon>📝</EmptyIcon>
                        <EmptyTitle>还没有代码片段</EmptyTitle>
                        <EmptyText>创建你的第一个代码片段，开始编程之旅吧！</EmptyText>
                        <EmptyActions>
                            <SecondaryActionButton onClick={() => setShowAIGenerateModal(true)}>
                                AI 生成项目
                            </SecondaryActionButton>
                            <CreateButton to="/editor">
                                创建第一个项目
                            </CreateButton>
                        </EmptyActions>
                    </EmptyState>
                ) : (
                    <>
                        <PenGrid style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}>
                            {pens.map((pen) => (
                                <PenCard key={pen.id} to={`/editor/${pen.id}`}>
                                    <ShareButton onClick={(e) => handleShare(e, pen.id)}>
                                        🔗 分享
                                    </ShareButton>
                                    <PenTitle>{pen.title}</PenTitle>
                                    <PenDescription>
                                        {pen.description || '暂无描述'}
                                    </PenDescription>
                                    <PenMeta>
                                        <PenDate>
                                            {new Date(pen.updatedAt).toLocaleDateString('zh-CN')}
                                        </PenDate>
                                        <PenStatus isPublic={pen.isPublic}>
                                            {pen.isPublic ? '公开' : '私有'}
                                        </PenStatus>
                                    </PenMeta>
                                </PenCard>
                            ))}
                        </PenGrid>
                        {hasMore && (
                            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                                <SecondaryActionButton onClick={loadMore}>
                                    加载更多
                                </SecondaryActionButton>
                            </div>
                        )}
                    </>
                )}
            </Container>
            {showToast && <Toast>{toastMessage}</Toast>}
            {showAIGenerateModal && (
                <AIGenerateModal onClose={() => setShowAIGenerateModal(false)} />
            )}
        </PageContainer>
    );
};

export default PensPage;
