import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createPen, updatePen, getUserPens, getPen, deletePen, Pen } from '../services/penService';

interface UsePenBootstrapState {
  currentPen: Pen | null;
  userPens: Pen[];
  isPenLoaded: boolean;
  isSaving: boolean;
  isSavingPen: boolean;
  isDeleting: boolean;
  saveSuccess: boolean;
  hasUnsavedChanges: boolean;
  title: string;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  cssLanguage: 'css' | 'scss' | 'less';
  jsLanguage: 'js' | 'react' | 'vue' | 'ts';
  importedCssPenIds: string[];
  importedJsPenIds: string[];
}

interface UsePenBootstrapActions {
  fetchUserPens: () => Promise<void>;
  initializeNewPen: () => void;
  loadPenById: (penId: string, updateCode?: boolean) => Promise<void>;
  handleSave: () => Promise<void>;
  handleNew: () => void;
  handleDelete: () => Promise<void>;
  handleLoadPen: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setHtmlCode: React.Dispatch<React.SetStateAction<string>>;
  setCssCode: React.Dispatch<React.SetStateAction<string>>;
  setJsCode: React.Dispatch<React.SetStateAction<string>>;
  setCssLanguage: React.Dispatch<React.SetStateAction<'css' | 'scss' | 'less'>>;
  setJsLanguage: React.Dispatch<React.SetStateAction<'js' | 'react' | 'vue' | 'ts'>>;
  setImportedCssPenIds: React.Dispatch<React.SetStateAction<string[]>>;
  setImportedJsPenIds: React.Dispatch<React.SetStateAction<string[]>>;
  checkForChanges: () => void;
  setSaveSuccess: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Pen 启动和引导 hook
 * 处理 Pen 的加载、初始化、保存、删除等生命周期
 */
export function usePenBootstrap(): [UsePenBootstrapState, UsePenBootstrapActions] {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const params = useParams();

  // Pen 管理状态
  const [currentPen, setCurrentPen] = useState<Pen | null>(null);
  const [userPens, setUserPens] = useState<Pen[]>([]);
  const [isPenLoaded, setIsPenLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPen, setIsSavingPen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 代码内容状态
  const [title, setTitle] = useState('Untitled');
  const [htmlCode, setHtmlCode] = useState('<div id="app">Hello World</div>');
  const [cssCode, setCssCode] = useState('body { color: blue; }');
  const [jsCode, setJsCode] = useState('console.log("Hello World");');
  const [cssLanguage, setCssLanguage] = useState<'css' | 'scss' | 'less'>('css');
  const [jsLanguage, setJsLanguage] = useState<'js' | 'react' | 'vue' | 'ts'>('js');

  // 导入状态
  const [importedCssPenIds, setImportedCssPenIds] = useState<string[]>([]);
  const [importedJsPenIds, setImportedJsPenIds] = useState<string[]>([]);

  // 获取用户的 Pen 列表
  const fetchUserPens = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const pens = await getUserPens();
      setUserPens(pens);
    } catch (error) {
      console.error('Failed to fetch user pens:', error);
    }
  }, [isAuthenticated]);

  // 初始化新 Pen
  const initializeNewPen = useCallback(() => {
    setCurrentPen(null);
    setTitle('Untitled');
    setHtmlCode('<div id="app">Hello World</div>');
    setCssCode('body { color: blue; }');
    setJsCode('console.log("Hello World");');
    setCssLanguage('css');
    setJsLanguage('js');
    setImportedCssPenIds([]);
    setImportedJsPenIds([]);
    setIsPenLoaded(true);
  }, []);

  // 加载指定的 Pen
  const loadPenById = useCallback(
    async (penId: string, updateCode: boolean = true) => {
      try {
        const pen = await getPen(penId);
        setCurrentPen(pen);
        setTitle(pen.title);
        if (updateCode) {
          setHtmlCode(pen.html);
          setCssCode(pen.css);
          setJsCode(pen.js);
          setCssLanguage((pen.cssLanguage as 'css' | 'scss' | 'less') || 'css');
          setJsLanguage((pen.jsLanguage as 'js' | 'react' | 'vue' | 'ts') || 'js');
          setImportedCssPenIds(pen.importedCssPenIds || []);
          setImportedJsPenIds(pen.importedJsPenIds || []);
        }
        setIsPenLoaded(true);
      } catch (error) {
        console.error('Failed to load pen:', error);
      }
    },
    []
  );

  // 检测变更
  const checkForChanges = useCallback(() => {
    if (!currentPen) {
      const defaultHtml = '<div id="app">Hello World</div>';
      const defaultCss = 'body { color: blue; }';
      const defaultJs = 'console.log("Hello World");';

      const hasChanges =
        htmlCode !== defaultHtml ||
        cssCode !== defaultCss ||
        jsCode !== defaultJs ||
        title !== 'Untitled' ||
        cssLanguage !== 'css' ||
        jsLanguage !== 'js';
      setHasUnsavedChanges(hasChanges);
    } else {
      const hasChanges =
        htmlCode !== currentPen.html ||
        cssCode !== currentPen.css ||
        jsCode !== currentPen.js ||
        title !== currentPen.title ||
        cssLanguage !== (currentPen.cssLanguage || 'css') ||
        jsLanguage !== (currentPen.jsLanguage || 'js');
      setHasUnsavedChanges(hasChanges);
    }
  }, [htmlCode, cssCode, jsCode, title, cssLanguage, jsLanguage, currentPen]);

  // 保存 Pen
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setIsSavingPen(true);
    try {
      const penData = {
        title,
        html: htmlCode,
        css: cssCode,
        js: jsCode,
        cssLanguage,
        jsLanguage,
        importedCssPenIds,
        importedJsPenIds
      };

      if (currentPen) {
        await updatePen(currentPen.id, penData);
        setCurrentPen(prev => (prev ? { ...prev, ...penData } : null));
      } else {
        const newPen = await createPen(penData);
        setCurrentPen(newPen);
        navigate(`/editor/${newPen.id}`, { replace: true });
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      setTimeout(async () => {
        try {
          const pens = await getUserPens();
          setUserPens(pens);
        } catch (error) {
          console.error('Failed to fetch user pens after save:', error);
        } finally {
          setIsSavingPen(false);
        }
      }, 100);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Save failed:', error);
      setIsSavingPen(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    title,
    htmlCode,
    cssCode,
    jsCode,
    cssLanguage,
    jsLanguage,
    importedCssPenIds,
    importedJsPenIds,
    currentPen,
    navigate
  ]);

  // 创建新 Pen
  const handleNew = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('您有未保存的更改，确定要创建新的 Pen 吗？');
      if (!confirmLeave) return;
    }
    setIsPenLoaded(false);
    initializeNewPen();
    setHasUnsavedChanges(false);
  }, [initializeNewPen, hasUnsavedChanges]);

  // 删除 Pen
  const handleDelete = useCallback(async () => {
    if (!currentPen || isDeleting) return;

    const confirmDelete = window.confirm(
      `确定要删除 "${currentPen.title}" 吗？此操作无法撤销。`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deletePen(currentPen.id);
      const pens = await getUserPens();
      setUserPens(pens);
      initializeNewPen();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [currentPen, isDeleting, initializeNewPen]);

  // 加载 Pen
  const handleLoadPen = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm('您有未保存的更改，确定要切换 Pen 吗？');
        if (!confirmLeave) {
          e.target.value = currentPen?.id || '';
          return;
        }
      }

      const penId = e.target.value;
      if (!penId) {
        setIsPenLoaded(false);
        initializeNewPen();
      } else {
        navigate(`/editor/${penId}`, { replace: true });
      }
    },
    [hasUnsavedChanges, currentPen, initializeNewPen, navigate]
  );

  // 初始化和加载 Pen 的 effect
  useEffect(() => {
    fetchUserPens();
  }, [isAuthenticated, navigate, fetchUserPens]);

  // 处理 URL 参数变化，加载对应的 Pen
  useEffect(() => {
    if (isSavingPen) return;

    const penId = params.id;
    if (penId && userPens.length > 0) {
      if (!currentPen || currentPen.id !== penId) {
        loadPenById(penId, true);
      }
    } else if (!penId) {
      initializeNewPen();
    }
  }, [params.id, userPens.length, loadPenById, initializeNewPen, isSavingPen, currentPen]);

  // 检测变更
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // 页面卸载前提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return '您有未保存的更改，确定要离开吗？';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const state: UsePenBootstrapState = {
    currentPen,
    userPens,
    isPenLoaded,
    isSaving,
    isSavingPen,
    isDeleting,
    saveSuccess,
    hasUnsavedChanges,
    title,
    htmlCode,
    cssCode,
    jsCode,
    cssLanguage,
    jsLanguage,
    importedCssPenIds,
    importedJsPenIds
  };

  const actions: UsePenBootstrapActions = {
    fetchUserPens,
    initializeNewPen,
    loadPenById,
    handleSave,
    handleNew,
    handleDelete,
    handleLoadPen,
    setTitle,
    setHtmlCode,
    setCssCode,
    setJsCode,
    setCssLanguage,
    setJsLanguage,
    setImportedCssPenIds,
    setImportedJsPenIds,
    checkForChanges,
    setSaveSuccess
  };

  return [state, actions];
}
