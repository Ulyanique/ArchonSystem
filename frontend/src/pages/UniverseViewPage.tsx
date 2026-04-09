import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { autolinkEntityNames, type EntityLink } from '../utils/autolinkEntities';
import { stripAuthorNotes } from '../utils/authorNotes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { universeViewApi, chaptersApi, notesApi, charactersApi, locationsApi, exportApi } from '../api';
import { BookOpen, Loader2, Sparkles, Edit3, Link2, Download, Slash, PenLine, Type, FileText, Eye, Columns, FilePen, Copy, ArrowRightToLine } from 'lucide-react';

type ChapterInfo = { id: number; title: string; chapter_number: number; content: string };

function buildBoundaries(
  chapters: ChapterInfo[]
): { chapterId: number; contentStart: number; contentEnd: number }[] {
  const boundaries: { chapterId: number; contentStart: number; contentEnd: number }[] = [];
  let pos = 0;
  for (const ch of chapters) {
    const header = `# Глава ${ch.chapter_number}: ${ch.title}\n\n`;
    const contentStart = pos + header.length;
    const contentEnd = contentStart + (ch.content || '').length;
    boundaries.push({ chapterId: ch.id, contentStart, contentEnd });
    pos = contentEnd + 2;
  }
  return boundaries;
}

function findChapterForRange(
  boundaries: { chapterId: number; contentStart: number; contentEnd: number }[],
  start: number,
  end: number
): number | null {
  for (const b of boundaries) {
    if (start >= b.contentStart && end <= b.contentEnd) return b.chapterId;
    if (start < b.contentEnd && end > b.contentStart) return b.chapterId;
  }
  return null;
}

function findChapterAtPosition(
  boundaries: { chapterId: number; contentStart: number; contentEnd: number }[],
  pos: number
): { chapterId: number; contentStart: number; contentEnd: number } | null {
  for (const b of boundaries) {
    if (pos >= b.contentStart && pos <= b.contentEnd) return b;
  }
  return null;
}

function replaceInChapterContent(
  chapterContent: string,
  rangeStart: number,
  rangeEnd: number,
  contentStart: number,
  replacement: string
): string {
  const localStart = rangeStart - contentStart;
  const localEnd = rangeEnd - contentStart;
  return chapterContent.slice(0, localStart) + replacement + chapterContent.slice(localEnd);
}

export default function UniverseViewPage() {
  const { universeId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [fullText, setFullText] = useState('');
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [expandModal, setExpandModal] = useState<{ fragment: string; expanded: string } | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [rewriteModal, setRewriteModal] = useState<{ fragment: string; replacement: string } | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteDraft, setRewriteDraft] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [showResolvedPreview, setShowResolvedPreview] = useState(false);
  const [slashMenuAt, setSlashMenuAt] = useState<number | null>(null);
  const [showBeatInstruction, setShowBeatInstruction] = useState(false);
  const [beatInstruction, setBeatInstruction] = useState('');
  const [isGeneratingBeat, setIsGeneratingBeat] = useState(false);
  const [generatedBeatText, setGeneratedBeatText] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'split'>('preview');
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [draftPanelContent, setDraftPanelContent] = useState('');
  const [moveToChapterModal, setMoveToChapterModal] = useState<{ open: boolean; selectedChapterId: number | null }>({ open: false, selectedChapterId: null });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const syncingScrollRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['book-view', universeId],
    queryFn: () => universeViewApi.getText(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['notes', universeId],
    queryFn: () => notesApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const draftNotes = useMemo(
    () => (notes as { id: number; title: string; content?: string; note_type?: string }[]).filter((n) => (n.note_type || '').toLowerCase() === 'draft'),
    [notes]
  );
  const selectedDraft = useMemo(() => draftNotes.find((n) => n.id === selectedDraftId), [draftNotes, selectedDraftId]);

  const draftIdFromUrl = searchParams.get('draftId');
  useEffect(() => {
    if (!draftIdFromUrl || !draftNotes.length) return;
    const id = parseInt(draftIdFromUrl, 10);
    if (!Number.isNaN(id) && draftNotes.some((n) => n.id === id)) {
      setShowDraftPanel(true);
      setSelectedDraftId(id);
    }
  }, [draftIdFromUrl, draftNotes]);

  const { data: resolvedData } = useQuery({
    queryKey: ['book-view', universeId, 'resolved'],
    queryFn: () => universeViewApi.getText(parseInt(universeId!), { resolveLinks: true }),
    enabled: !!universeId && showResolvedPreview,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      chaptersApi.update(parseInt(universeId!), id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      notesApi.update(parseInt(universeId!), id, { content, note_type: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      toast.success('Сохранено');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  useEffect(() => {
    if (data) {
      setFullText(data.fullText);
      setChapters(data.chapters || []);
    }
  }, [data]);

  useEffect(() => {
    if (selectedDraft) {
      setDraftPanelContent(selectedDraft.content || '');
    } else {
      setDraftPanelContent('');
    }
  }, [selectedDraftId]);

  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftUserEditedRef = useRef(false);
  useEffect(() => {
    draftUserEditedRef.current = false;
  }, [selectedDraftId]);
  useEffect(() => {
    if (!selectedDraftId || !universeId || !draftUserEditedRef.current) return;
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      draftSaveTimeoutRef.current = null;
      updateDraftMutation.mutate({ id: selectedDraftId, content: draftPanelContent });
    }, 2500);
    return () => {
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    };
  }, [draftPanelContent, selectedDraftId, universeId]);

  const boundaries = useMemo(() => buildBoundaries(chapters), [chapters]);

  const entityLinks = useMemo((): EntityLink[] => {
    if (!universeId) return [];
    const u = parseInt(universeId, 10);
    const list: EntityLink[] = [];
    (characters as { id: number; name: string }[]).forEach((c) => {
      if (c.name?.trim()) list.push({ name: c.name.trim(), url: `/universes/${u}/characters/${c.id}` });
    });
    (locations as { id: number; name: string }[]).forEach((loc) => {
      if (loc.name?.trim()) list.push({ name: loc.name.trim(), url: `/universes/${u}/locations/${loc.id}` });
    });
    (notes as { id: number; title: string }[]).forEach((n) => {
      if (n.title?.trim()) list.push({ name: n.title.trim(), url: `/universes/${u}/notes` });
    });
    return list;
  }, [universeId, characters, locations, notes]);

  const previewTextWithLinks = useMemo(() => {
    const raw = showResolvedPreview && resolvedData?.fullText != null ? resolvedData.fullText : fullText;
    const forPreview = stripAuthorNotes(raw);
    if (entityLinks.length === 0) return forPreview;
    return autolinkEntityNames(forPreview, entityLinks);
  }, [fullText, showResolvedPreview, resolvedData?.fullText, entityLinks]);

  const handleSelect = useCallback(() => {
    const ta = document.getElementById('book-view-textarea') as HTMLTextAreaElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value.slice(start, end).trim();
    if (text) setSelection({ start, end, text });
    else setSelection(null);
  }, []);

  const handleExpand = useCallback(async () => {
    if (!selection?.text || !universeId) return;
    setExpandLoading(true);
    try {
      const res = await universeViewApi.expand(parseInt(universeId), selection.text);
      setExpandModal({ fragment: selection.text, expanded: res.expanded || '' });
      setDraftContent(res.expanded || '');
    } catch (e: any) {
      toast.error('Ошибка расширения: ' + (e?.message || 'Не удалось'));
    } finally {
      setExpandLoading(false);
    }
  }, [selection, universeId]);

  const handleRewrite = useCallback(async () => {
    if (!selection?.text || !universeId) return;
    const chId = findChapterForRange(boundaries, selection.start, selection.end);
    if (chId == null) {
      toast.error('Выделение должно быть внутри одной главы');
      return;
    }
    const b = boundaries.find((x) => x.chapterId === chId)!;
    const startOffset = selection.start - b.contentStart;
    const endOffset = selection.end - b.contentStart;
    setRewriteLoading(true);
    try {
      const res = await universeViewApi.rewrite(parseInt(universeId), {
        chapter_id: chId,
        start_offset: startOffset,
        end_offset: endOffset,
        fragment: selection.text,
      });
      setRewriteModal({ fragment: selection.text, replacement: res.replacement || '' });
      setRewriteDraft(res.replacement || '');
    } catch (e: any) {
      toast.error('Ошибка перезаписи: ' + (e?.message || 'Не удалось'));
    } finally {
      setRewriteLoading(false);
    }
  }, [selection, universeId, boundaries]);

  const applyRewritten = useCallback(() => {
    if (!rewriteModal || !selection || !universeId) return;
    const newText = fullText.slice(0, selection.start) + rewriteDraft + fullText.slice(selection.end);
    setFullText(newText);
    const chapterId = findChapterForRange(boundaries, selection.start, selection.end);
    if (chapterId != null) {
      const ch = chapters.find((c) => c.id === chapterId);
      if (ch) {
        const b = boundaries.find((x) => x.chapterId === chapterId)!;
        const newContent = replaceInChapterContent(ch.content, selection.start, selection.end, b.contentStart, rewriteDraft);
        updateMutation.mutate({ id: chapterId, content: newContent });
      }
    }
    setRewriteModal(null);
    setSelection(null);
    toast.success('Текст подставлен. Сохранение главы…');
  }, [rewriteModal, selection, fullText, rewriteDraft, boundaries, chapters, universeId, updateMutation]);

  const linkMutation = useMutation({
    mutationFn: (body: { chapter_id: number; start_offset: number; end_offset: number; entity_type: string; entity_id: number }) =>
      universeViewApi.link(parseInt(universeId!), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      setLinkModalOpen(false);
      setSelection(null);
      toast.success('Связь добавлена');
    },
    onError: (e: any) => toast.error('Ошибка: ' + (e?.message || '')),
  });

  const handleLinkTo = useCallback(
    (entityType: 'character' | 'location' | 'note', entityId: number) => {
      if (!selection || !universeId) return;
      const chId = findChapterForRange(boundaries, selection.start, selection.end);
      if (chId == null) {
        toast.error('Выделение должно быть внутри одной главы');
        return;
      }
      const b = boundaries.find((x) => x.chapterId === chId)!;
      const startOffset = selection.start - b.contentStart;
      const endOffset = selection.end - b.contentStart;
      setLinkLoading(true);
      linkMutation.mutate(
        { chapter_id: chId, start_offset: startOffset, end_offset: endOffset, entity_type: entityType, entity_id: entityId },
        {
          onSettled: () => setLinkLoading(false),
        }
      );
    },
    [selection, universeId, boundaries, linkMutation]
  );

  const applyExpanded = useCallback(() => {
    if (!expandModal || !selection || !universeId) return;
    const newText = fullText.slice(0, selection.start) + draftContent + fullText.slice(selection.end);
    setFullText(newText);
    const chapterId = findChapterForRange(boundaries, selection.start, selection.end);
    if (chapterId != null) {
      const ch = chapters.find((c) => c.id === chapterId);
      if (ch) {
        const b = boundaries.find((x) => x.chapterId === chapterId)!;
        const newContent = replaceInChapterContent(
          ch.content,
          selection.start,
          selection.end,
          b.contentStart,
          draftContent
        );
        updateMutation.mutate({ id: chapterId, content: newContent });
      }
    }
    setExpandModal(null);
    setSelection(null);
    toast.success('Текст подставлен. Сохранение главы…');
  }, [expandModal, selection, fullText, draftContent, boundaries, chapters, universeId, updateMutation]);

  const saveAsNote = useCallback(() => {
    if (!expandModal || !universeId) return;
    notesApi
      .create(parseInt(universeId), { title: 'Черновик (расширение)', content: draftContent, note_type: 'draft' })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
        toast.success('Сохранено в заметки как черновик');
        setExpandModal(null);
        setSelection(null);
      })
      .catch(() => toast.error('Не удалось сохранить в заметки'));
  }, [expandModal, draftContent, universeId, queryClient]);

  const runBeat = useCallback(
    async (instruction: string) => {
      if (slashMenuAt == null || !universeId || !boundaries.length) return;
      const b = findChapterAtPosition(boundaries, slashMenuAt);
      if (!b) {
        toast.error('Курсор должен быть внутри главы');
        setSlashMenuAt(null);
        return;
      }
      const textBefore = fullText.slice(b.contentStart, slashMenuAt);
      setIsGeneratingBeat(true);
      setGeneratedBeatText('');
      try {
        for await (const chunk of chaptersApi.writeBeatStream(parseInt(universeId), b.chapterId, {
          instruction: instruction.trim() || undefined,
          text_before_cursor: textBefore || undefined,
        })) {
          setGeneratedBeatText((prev) => prev + chunk);
        }
      } catch (e: unknown) {
        toast.error('Ошибка генерации: ' + (e as Error)?.message);
      } finally {
        setIsGeneratingBeat(false);
        setShowBeatInstruction(false);
        setBeatInstruction('');
      }
    },
    [slashMenuAt, universeId, boundaries, fullText]
  );

  const insertBeatAndClose = useCallback(() => {
    if (slashMenuAt == null || !generatedBeatText.trim()) return;
    const b = findChapterAtPosition(boundaries, slashMenuAt);
    if (!b) {
      setSlashMenuAt(null);
      setGeneratedBeatText('');
      return;
    }
    const newFullText = fullText.slice(0, slashMenuAt) + generatedBeatText.trim() + fullText.slice(slashMenuAt);
    setFullText(newFullText);
    const newChapterContent = newFullText.slice(b.contentStart, b.contentEnd + generatedBeatText.trim().length);
    updateMutation.mutate({ id: b.chapterId, content: newChapterContent });
    setSlashMenuAt(null);
    setGeneratedBeatText('');
    toast.success('Текст вставлен в главу');
  }, [slashMenuAt, generatedBeatText, boundaries, fullText, updateMutation]);

  const cancelBeat = useCallback(() => {
    setSlashMenuAt(null);
    setShowBeatInstruction(false);
    setBeatInstruction('');
    setGeneratedBeatText('');
  }, []);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === '/') {
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const prev = ta.value[start - 1];
        if (prev === undefined || prev === ' ' || prev === '\n') {
          e.preventDefault();
          setSlashMenuAt(start);
          setShowBeatInstruction(false);
          setBeatInstruction('');
        }
        return;
      }
      if (slashMenuAt != null && e.key === 'Escape') {
        e.preventDefault();
        cancelBeat();
      }
    },
    [slashMenuAt, cancelBeat]
  );

  const handleEditorScroll = useCallback(() => {
    const ta = editorRef.current;
    const preview = previewScrollRef.current;
    if (syncingScrollRef.current || !ta || !preview) return;
    syncingScrollRef.current = true;
    const ratio = ta.scrollHeight > 0 ? ta.scrollTop / ta.scrollHeight : 0;
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  }, []);

  const handlePreviewScroll = useCallback(() => {
    const ta = editorRef.current;
    const preview = previewScrollRef.current;
    if (syncingScrollRef.current || !ta || !preview) return;
    syncingScrollRef.current = true;
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    const ratio = maxPreview > 0 ? preview.scrollTop / maxPreview : 0;
    ta.scrollTop = ratio * (ta.scrollHeight - ta.clientHeight);
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  }, []);

  const copyDraftSelection = useCallback(() => {
    const ta = draftTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value.slice(start, end).trim();
    if (!text) {
      toast.error('Выделите фрагмент в черновике');
      return;
    }
    navigator.clipboard.writeText(text).then(() => toast.success('Скопировано в буфер')).catch(() => toast.error('Не удалось скопировать'));
  }, []);

  const saveDraftPanel = useCallback(() => {
    if (selectedDraftId == null || !universeId) return;
    updateDraftMutation.mutate({ id: selectedDraftId, content: draftPanelContent });
  }, [selectedDraftId, universeId, draftPanelContent, updateDraftMutation]);

  const openMoveToChapterModal = useCallback(() => {
    const ta = draftTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value.slice(start, end).trim();
    if (!text) {
      toast.error('Выделите фрагмент в черновике для переноса');
      return;
    }
    const cursorPos = editorRef.current?.selectionStart ?? 0;
    const chapterAtCursor = findChapterAtPosition(boundaries, cursorPos);
    const preselectedId = chapterAtCursor?.chapterId ?? chapters[0]?.id ?? null;
    setMoveToChapterModal({ open: true, selectedChapterId: preselectedId });
  }, [chapters, boundaries]);

  const confirmMoveToChapter = useCallback(() => {
    const { selectedChapterId } = moveToChapterModal;
    if (selectedChapterId == null || !universeId) return;
    const ta = draftTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value.slice(start, end).trim();
    if (!text) {
      setMoveToChapterModal((m) => ({ ...m, open: false }));
      return;
    }
    const ch = chapters.find((c) => c.id === selectedChapterId);
    if (!ch) {
      setMoveToChapterModal((m) => ({ ...m, open: false }));
      return;
    }
    const newContent = (ch.content || '').trimEnd() + '\n\n' + text;
    updateMutation.mutate(
      { id: selectedChapterId, content: newContent },
      {
        onSuccess: () => {
          setMoveToChapterModal({ open: false, selectedChapterId: null });
          toast.success('Фрагмент добавлен в конец главы');
        },
      }
    );
  }, [moveToChapterModal, universeId, chapters, updateMutation]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
          <BookOpen size={24} />
          Вселенная целиком
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const url = exportApi.markdown(parseInt(universeId!), {});
              window.open(url, '_blank');
            }}
            className="btn btn-primary flex items-center gap-2"
            title="Экспортировать книгу в Markdown"
          >
            <Download size={18} />
            Экспорт
          </button>
          {selection && (
            <>
              <button
                type="button"
                onClick={handleExpand}
                disabled={expandLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {expandLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Расширить
              </button>
              <button
                type="button"
                onClick={handleRewrite}
                disabled={rewriteLoading}
                className="btn btn-secondary flex items-center gap-2"
              >
                {rewriteLoading ? <Loader2 size={18} className="animate-spin" /> : <Edit3 size={18} />}
                Переписать
              </button>
              <button
                type="button"
                onClick={() => setLinkModalOpen(true)}
                disabled={linkLoading}
                className="btn btn-secondary flex items-center gap-2"
              >
                {linkLoading ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
                Связать с…
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-dark-500 mb-2">
        Введите <kbd className="px-1.5 py-0.5 rounded bg-dark-200 text-dark-700 font-mono text-xs">/</kbd> для сцены (Scene beat или Продолжить). Выделите фрагмент для «Расширить», «Переписать», «Связать с…».
      </p>
      <div className="mb-2 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-dark-600">Режим как в Obsidian:</span>
        <div className="flex rounded-lg border border-dark-200 p-0.5 bg-dark-50">
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'preview' ? 'bg-white shadow text-primary-700 font-medium' : 'text-dark-600 hover:text-dark-800'}`}
          >
            <Eye size={16} />
            Превью
          </button>
          <button
            type="button"
            onClick={() => setViewMode('source')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'source' ? 'bg-white shadow text-primary-700 font-medium' : 'text-dark-600 hover:text-dark-800'}`}
          >
            <FileText size={16} />
            Исходник
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'split' ? 'bg-white shadow text-primary-700 font-medium' : 'text-dark-600 hover:text-dark-800'}`}
          >
            <Columns size={16} />
            Оба
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dark-600">
          <input
            type="checkbox"
            checked={showResolvedPreview}
            onChange={(e) => setShowResolvedPreview(e.target.checked)}
          />
          Имена вместо [[тип:id]] в превью
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-600">
          <input
            type="checkbox"
            checked={showDraftPanel}
            onChange={(e) => {
              setShowDraftPanel(e.target.checked);
              if (!e.target.checked) setSelectedDraftId(null);
              else if (draftNotes.length > 0 && !selectedDraftId) setSelectedDraftId(draftNotes[0].id);
            }}
          />
          <FilePen size={16} />
          Черновик рядом
        </label>
        {showDraftPanel && draftNotes.length > 0 && (
          <select
            value={selectedDraftId ?? ''}
            onChange={(e) => setSelectedDraftId(e.target.value ? Number(e.target.value) : null)}
            className="input text-sm py-1.5 max-w-[220px]"
          >
            <option value="">— Выберите черновик —</option>
            {draftNotes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={showDraftPanel ? 'grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-4' : ''}>
      <div className={`grid gap-4 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : ''} ${showDraftPanel ? 'min-w-0' : ''}`}>
        {(viewMode === 'source' || viewMode === 'split') && (
        <div className="flex flex-col min-h-[50vh]">
          {slashMenuAt != null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary-50 border border-primary-200 mb-2 flex-wrap">
              <span className="text-sm font-medium text-primary-800 flex items-center gap-1">
                <Slash size={16} />
                Scene beat
              </span>
              {!showBeatInstruction ? (
                <>
                  <button
                    type="button"
                    onClick={() => runBeat('')}
                    disabled={isGeneratingBeat}
                    className="btn btn-primary text-sm py-1 px-2 inline-flex items-center gap-1"
                  >
                    {isGeneratingBeat ? <Loader2 size={14} className="animate-spin" /> : <Type size={14} />}
                    Продолжить с этого места
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBeatInstruction(true)}
                    disabled={isGeneratingBeat}
                    className="btn btn-secondary text-sm py-1 px-2 inline-flex items-center gap-1"
                  >
                    <PenLine size={14} />
                    Написать по инструкции
                  </button>
                </>
              ) : (
                <div className="flex-1 flex gap-2 flex-wrap items-center">
                  <input
                    type="text"
                    value={beatInstruction}
                    onChange={(e) => setBeatInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runBeat(beatInstruction);
                      if (e.key === 'Escape') { setShowBeatInstruction(false); setBeatInstruction(''); }
                    }}
                    placeholder="Например: Опиши приезд в замок"
                    className="input flex-1 min-w-[200px] text-sm py-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => runBeat(beatInstruction)}
                    disabled={isGeneratingBeat || !beatInstruction.trim()}
                    className="btn btn-primary text-sm py-1 px-2"
                  >
                    {isGeneratingBeat ? <Loader2 size={14} className="animate-spin" /> : 'Сгенерировать'}
                  </button>
                </div>
              )}
              <button type="button" onClick={cancelBeat} className="text-dark-500 hover:text-dark-700 ml-auto" title="Отмена">
                ×
              </button>
            </div>
          )}
          {(generatedBeatText || isGeneratingBeat) && (
            <div className="mb-2 p-3 rounded-lg border border-primary-200 bg-primary-50/50 max-h-48 overflow-y-auto">
              <p className="text-sm text-dark-700 whitespace-pre-wrap font-serif">
                {generatedBeatText}
                {isGeneratingBeat && <span className="animate-pulse">▌</span>}
              </p>
              {!isGeneratingBeat && generatedBeatText && (
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={insertBeatAndClose} className="btn btn-primary text-sm">
                    Вставить в текст
                  </button>
                  <button type="button" onClick={cancelBeat} className="btn btn-secondary text-sm">
                    Отмена
                  </button>
                </div>
              )}
            </div>
          )}
          <textarea
            ref={editorRef}
            id="book-view-textarea"
            className="input w-full flex-1 font-mono text-sm min-h-[40vh] whitespace-pre-wrap"
            value={fullText}
            onChange={(e) => setFullText(e.target.value)}
            onSelect={handleSelect}
            onKeyDown={handleEditorKeyDown}
            onScroll={handleEditorScroll}
            spellCheck={false}
            placeholder="Текст книги в Markdown. Введите / для генерации сцены. Комментарий только для ИИ: %% ваш текст %% — в превью и экспорте не показывается."
          />
        </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            ref={previewScrollRef}
            onScroll={handlePreviewScroll}
            className={`border border-dark-200 rounded-lg bg-white overflow-y-auto ${viewMode === 'split' ? 'min-h-[50vh] p-4' : 'min-h-[60vh] p-6'}`}
          >
            {viewMode === 'preview' && (
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className="btn btn-secondary text-sm inline-flex items-center gap-1"
                >
                  <Edit3 size={14} />
                  Редактировать
                </button>
              </div>
            )}
            <div className={`prose prose-sm max-w-none font-serif text-dark-800 ${viewMode === 'preview' ? 'prose-lg' : ''}`}>
              <ReactMarkdown
                components={{
                  a: ({ href, children, ...props }) => {
                    if (href?.startsWith('/')) {
                      return <Link to={href} {...props}>{children}</Link>;
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                  },
                }}
              >
                {previewTextWithLinks}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {showDraftPanel && (
        <div className="flex flex-col min-h-[50vh] border border-dark-200 rounded-lg bg-white dark:bg-dark-100 overflow-hidden">
          <div className="p-2 border-b border-dark-200 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-dark-700">Черновик</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={saveDraftPanel} disabled={updateDraftMutation.isPending || selectedDraftId == null} className="btn btn-secondary text-sm py-1 px-2" title="Сохранить черновик" aria-label="Сохранить черновик">
                {updateDraftMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Сохранить'}
              </button>
              <button type="button" onClick={copyDraftSelection} className="btn btn-secondary text-sm py-1 px-2 inline-flex items-center gap-1" title="Копировать выделение в буфер" aria-label="Копировать выделение">
                <Copy size={14} />
                Копировать
              </button>
              <button type="button" onClick={openMoveToChapterModal} className="btn btn-primary text-sm py-1 px-2 inline-flex items-center gap-1" title="Перенести выделение в конец выбранной главы" aria-label="Перенести выделение в главу">
                <ArrowRightToLine size={14} />
                В главу
              </button>
            </div>
          </div>
          {selectedDraft ? (
            <>
              <div className="px-2 py-1 text-xs text-dark-500 border-b border-dark-100">{selectedDraft.title}</div>
              <textarea
                ref={draftTextareaRef}
                className="input w-full flex-1 min-h-[300px] font-mono text-sm resize-none border-0 rounded-none focus:ring-0"
                value={draftPanelContent}
                onChange={(e) => { draftUserEditedRef.current = true; setDraftPanelContent(e.target.value); }}
                placeholder="Текст черновика. Выделите фрагмент и нажмите «Копировать» или «В главу»."
                spellCheck={false}
              />
            </>
          ) : (
            <div className="p-4 text-sm text-dark-500 flex-1 flex items-center justify-center">
              {draftNotes.length === 0 ? 'Нет черновиков. Создайте черновик в разделе «Черновики».' : 'Выберите черновик выше.'}
            </div>
          )}
        </div>
      )}
      </div>

      {showResolvedPreview && resolvedData?.fullText != null && viewMode === 'source' && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-dark-700 mb-2">Превью с именами</h3>
          <pre className="input w-full font-mono text-sm min-h-[200px] whitespace-pre-wrap bg-dark-50" style={{ whiteSpace: 'pre-wrap' }}>
            {resolvedData.fullText}
          </pre>
        </div>
      )}

      {/* Модалка черновика расширения */}
      {expandModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-dark-200">
              <h3 className="text-lg font-bold text-dark-800">Расширенный текст</h3>
              <p className="text-xs text-dark-500 mt-1">Отредактируйте при необходимости, затем «Одобрить» или «В черновик».</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                className="input w-full min-h-[200px] font-mono text-sm"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-dark-200 flex gap-2 justify-end flex-wrap">
              <button type="button" onClick={() => setExpandModal(null)} className="btn btn-secondary">
                Отмена
              </button>
              <button type="button" onClick={saveAsNote} className="btn btn-secondary">
                В черновик (заметка)
              </button>
              <button type="button" onClick={applyExpanded} className="btn btn-primary">
                Одобрить (подставить в текст)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка перезаписи */}
      {rewriteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-dark-200">
              <h3 className="text-lg font-bold text-dark-800">Переписанный текст</h3>
              <p className="text-xs text-dark-500 mt-1">Отредактируйте при необходимости и нажмите «Подставить».</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                className="input w-full min-h-[200px] font-mono text-sm"
                value={rewriteDraft}
                onChange={(e) => setRewriteDraft(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-dark-200 flex gap-2 justify-end flex-wrap">
              <button type="button" onClick={() => setRewriteModal(null)} className="btn btn-secondary">
                Отмена
              </button>
              <button type="button" onClick={applyRewritten} className="btn btn-primary">
                Подставить в текст
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Связать с…» */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-dark-200">
              <h3 className="text-lg font-bold text-dark-800">Связать выделение с</h3>
              <p className="text-xs text-dark-500 mt-1">Выберите персонажа, локацию или заметку. В текст будет подставлен маркер [[тип:id]].</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div>
                <h4 className="text-sm font-medium text-dark-700 mb-2">Персонажи</h4>
                <ul className="space-y-1">
                  {characters.map((c: { id: number; name: string }) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleLinkTo('character', c.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-primary-50 text-dark-800"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                  {characters.length === 0 && <p className="text-sm text-dark-500">Нет персонажей</p>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-dark-700 mb-2">Локации</h4>
                <ul className="space-y-1">
                  {locations.map((loc: { id: number; name: string }) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => handleLinkTo('location', loc.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-primary-50 text-dark-800"
                      >
                        {loc.name}
                      </button>
                    </li>
                  ))}
                  {locations.length === 0 && <p className="text-sm text-dark-500">Нет локаций</p>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-dark-700 mb-2">Заметки</h4>
                <ul className="space-y-1">
                  {notes.map((n: { id: number; title: string }) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleLinkTo('note', n.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-primary-50 text-dark-800"
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                  {notes.length === 0 && <p className="text-sm text-dark-500">Нет заметок</p>}
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-dark-200">
              <button type="button" onClick={() => setLinkModalOpen(false)} className="btn btn-secondary w-full">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Перенести в главу» (из черновика) */}
      {moveToChapterModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-100 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-dark-200">
              <h3 className="text-lg font-bold text-dark-800">Перенести в главу</h3>
              <p className="text-xs text-dark-500 mt-1">Выделенный фрагмент из черновика будет добавлен в конец выбранной главы.</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <ul className="space-y-1">
                {chapters.map((ch) => (
                  <li key={ch.id}>
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded hover:bg-primary-50">
                      <input
                        type="radio"
                        name="moveChapter"
                        checked={moveToChapterModal.selectedChapterId === ch.id}
                        onChange={() => setMoveToChapterModal((m) => ({ ...m, selectedChapterId: ch.id }))}
                        className="text-primary-600"
                      />
                      <span className="text-dark-800">Глава {ch.chapter_number}: {ch.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {chapters.length === 0 && <p className="text-sm text-dark-500">Нет глав</p>}
            </div>
            <div className="p-4 border-t border-dark-200 flex gap-2 justify-end">
              <button type="button" onClick={() => setMoveToChapterModal({ open: false, selectedChapterId: null })} className="btn btn-secondary">
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmMoveToChapter}
                disabled={moveToChapterModal.selectedChapterId == null || updateMutation.isPending}
                className="btn btn-primary"
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin inline" /> : 'Вставить в главу'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
