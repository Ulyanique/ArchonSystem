import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  Trash2,
  Loader2,
  Theater,
  ListOrdered,
  Play,
  Eraser,
  LayoutTemplate,
  Layers,
  Check,
  AlertCircle,
  FileText,
  X,
  Brain,
  Eye,
  EyeOff,
  PenLine,
  MessageSquare,
} from 'lucide-react';
import { chaptersApi, outlineApi, universeViewApi, aiCriticApi } from '../api';
import type { Chapter, OutlineItem, SceneBeat } from '../types';
import { ContentWithInlineComments, type ContentWithInlineCommentsHandle } from '../components/ContentWithInlineComments';
import { SlashCommandMenu, type SlashCommandItem } from '../components/SlashCommandMenu';
import AICriticPanel from '../components/AICriticPanel';

type TreeAct = { type: 'act'; item: OutlineItem };
type TreeChapter = { type: 'chapter'; item: OutlineItem; chapter: Chapter; actId: number | null };
type TreeNode = TreeAct | TreeChapter;

function buildTree(outline: OutlineItem[], chapters: Chapter[]): TreeNode[] {
  const byChapterId = new Map(chapters.map((c) => [c.id, c]));
  const tree: TreeNode[] = [];
  let currentActId: number | null = null;
  const sorted = [...outline].sort((a, b) => a.sort_order - b.sort_order);
  for (const item of sorted) {
    if (item.outline_type === 'act') {
      currentActId = item.id;
      tree.push({ type: 'act', item });
    } else if (item.outline_type === 'chapter' && item.chapter_id) {
      const chapter = byChapterId.get(item.chapter_id);
      if (chapter) tree.push({ type: 'chapter', item, chapter, actId: currentActId });
    }
  }
  return tree;
}

function chaptersNotInOutline(outline: OutlineItem[], chapters: Chapter[]): Chapter[] {
  const linked = new Set(outline.filter((o) => o.outline_type === 'chapter' && o.chapter_id).map((o) => o.chapter_id!));
  return chapters.filter((c) => !linked.has(c.id));
}

const MIN_TEXTAREA_HEIGHT = 88;
const CANVAS_SAVE_DEBOUNCE_MS = 400;

/** Поле с сохранением по debounce (для полотна: акт, глава, бит) */
function DebouncedField({
  value,
  onSave,
  as: El = 'input',
  className,
  placeholder,
  title,
}: {
  value: string;
  onSave: (v: string) => void;
  as?: 'input' | 'textarea';
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  const [local, setLocal] = useState(value);
  const savedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === savedRef.current) setLocal(value);
    else {
      setLocal(value);
      savedRef.current = value;
    }
  }, [value]);

  const scheduleSave = useCallback(
    (newVal: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        savedRef.current = newVal;
        onSave(newVal);
      }, CANVAS_SAVE_DEBOUNCE_MS);
    },
    [onSave]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      const v = e.target.value;
      setLocal(v);
      scheduleSave(v);
    },
    [scheduleSave]
  );

  const common = {
    value: local,
    onChange: handleChange,
    className: [
      'bg-transparent dark:bg-transparent border-0 w-full focus:ring-0 focus:outline-none',
      'text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-500',
      className,
    ].filter(Boolean).join(' '),
    placeholder,
    title,
  };

  if (El === 'textarea') {
    return <textarea {...common} rows={2} className={(className ?? '') + ' resize-y'} />;
  }
  return <input type="text" {...common} />;
}

type ChapterBlockProps = {
  chapter: Chapter;
  beats: SceneBeat[];
  isBeatsLoading: boolean | undefined;
  isSelected: boolean;
  onSelectChapter: () => void;
  onToggleChapter: (id: number) => void;
  expandedChapters: Set<number>;
  collapsedBeats: Set<number>;
  toggleBeatCollapse: (id: number) => void;
  editingBeat: { id: number; title: string; description: string; content: string } | null;
  setEditingBeat: React.Dispatch<React.SetStateAction<{ id: number; title: string; description: string; content: string } | null>>;
  updateBeatMutation: (args: { chapterId: number; beatId: number; data: { title?: string; description?: string; content?: string; enabled?: boolean; collapsed?: boolean } }) => void;
  deleteBeatMutation: (args: { chapterId: number; beatId: number }) => void;
  createBeatMutation: (chapterId: number) => void;
  createFirstBeatFromChapterContent: (chapterId: number) => void;
  beatWords: Record<number, number>;
  setBeatWords: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  handleGenerateBeat: (beat: { id: number; title: string; description?: string; content: string }, chapterId: number) => Promise<void>;
  handleGenerateBeatDescription: (beat: { id: number; title: string; description?: string }, chapterId: number) => Promise<void>;
  handleClearBeat: (chapterId: number, beatId: number) => void;
  generatingBeatId: number | null;
  generatingDescriptionBeatId: number | null;
  streamingBase: Record<number, string>;
  streamingChunk: Record<number, string>;
  draggedBeatId: number | null;
  draggedBeatChapterId: number | null;
  dropTargetChapterId: number | null;
  dropTargetIndex: number | null;
  setDropTargetChapterId: (v: number | null) => void;
  setDropTargetIndex: (v: number | null) => void;
  handleBeatDragStart: (e: React.DragEvent, beatId: number, chapterId: number) => void;
  handleBeatDragOver: (e: React.DragEvent) => void;
  handleBeatDragEnd: () => void;
  handleDropAt: (chapterId: number, index: number) => void;
  bookData: { chapters?: { id: number; content?: string }[] } | undefined;
  createBeatPending?: boolean;
  onAnalyzeChapter?: (chapterId: number) => void;
  onAnalyzeBeat?: (chapterId: number, beatId: number) => void;
  isAnalyzingChapter?: boolean;
  isAnalyzingBeatId?: number | null;
  /** Настройка принадлежности к акту: список актов, текущий акт (id пункта плана), id пункта плана главы, обработчик смены */
  actList?: { id: number; title: string }[];
  currentActId?: number | null;
  outlineItemId?: number | null;
  onActChange?: (chapterId: number, outlineItemId: number | null, newActOutlineId: number | null) => void;
  /** Скрыть/показать главу в контексте ИИ (enabled) */
  onToggleChapterEnabled?: (chapterId: number, enabled: boolean) => void;
};

function ChapterBlock({
  chapter,
  beats,
  isBeatsLoading,
  isSelected,
  onSelectChapter,
  onToggleChapter,
  expandedChapters,
  collapsedBeats,
  toggleBeatCollapse,
  editingBeat,
  setEditingBeat,
  updateBeatMutation,
  deleteBeatMutation,
  createBeatMutation,
  createFirstBeatFromChapterContent,
  beatWords,
  setBeatWords,
  handleGenerateBeat,
  handleGenerateBeatDescription,
  handleClearBeat,
  generatingBeatId,
  generatingDescriptionBeatId,
  streamingBase,
  streamingChunk,
  draggedBeatId,
  draggedBeatChapterId,
  dropTargetChapterId,
  dropTargetIndex,
  setDropTargetChapterId,
  setDropTargetIndex,
  handleBeatDragStart,
  handleBeatDragOver,
  handleBeatDragEnd,
  handleDropAt,
  bookData,
  createBeatPending,
  onAnalyzeChapter,
  onAnalyzeBeat,
  isAnalyzingChapter,
  isAnalyzingBeatId,
  actList,
  currentActId = null,
  outlineItemId = null,
  onActChange,
  onToggleChapterEnabled,
}: ChapterBlockProps) {
  const chapterId = chapter.id;
  const expanded = expandedChapters.has(chapterId);
  const fromBook = bookData?.chapters?.find((c) => c.id === chapterId);
  const hasChapterContent = (fromBook?.content ?? chapter.content ?? '').trim().length > 0;
  const chapterEnabled = chapter.enabled !== false;

  return (
    <div
      className={`rounded-lg border overflow-hidden ${chapterEnabled ? 'border-dark-200 bg-white dark:bg-dark-700' : 'opacity-60 border-amber-500/70 bg-dark-50 dark:bg-dark-800'}`}
      style={!chapterEnabled ? { borderWidth: '1px', borderStyle: 'solid' } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-100 flex-wrap">
        <button
          type="button"
          onClick={() => onToggleChapter(chapterId)}
          className="p-1 rounded hover:bg-dark-100"
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {onToggleChapterEnabled && (
          <button
            type="button"
            onClick={() => onToggleChapterEnabled(chapterId, !chapterEnabled)}
            className="p-1 rounded hover:bg-dark-100"
            title={chapterEnabled ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
          >
            {chapterEnabled ? <Eye size={18} className="text-dark-500" /> : <EyeOff size={18} className="text-amber-600" />}
          </button>
        )}
        <button
          type="button"
          onClick={onSelectChapter}
          className={`flex-1 min-w-0 text-left font-medium text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-dark-800 dark:text-dark-200'}`}
        >
          Глава {chapter.chapter_number}: {chapter.title}
        </button>
        {!chapterEnabled && <span className="text-xs text-amber-600">Выключена</span>}
        {actList != null && actList.length > 0 && onActChange && (
          <select
            value={currentActId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onActChange(chapterId, outlineItemId ?? null, v === '' ? null : parseInt(v, 10));
            }}
            className="text-xs rounded border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-700 dark:text-dark-300 py-1 px-2 max-w-[140px]"
            title="Принадлежность к акту"
          >
            <option value="">Без раздела</option>
            {actList.map((act) => (
              <option key={act.id} value={act.id}>
                {act.title}
              </option>
            ))}
          </select>
        )}
        {onAnalyzeChapter && (
          <button
            type="button"
            onClick={() => onAnalyzeChapter(chapterId)}
            disabled={isAnalyzingChapter}
            className="p-1.5 rounded hover:bg-dark-100 text-primary-600 dark:text-primary-400"
            title="Анализ ИИ"
          >
            {isAnalyzingChapter ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => createBeatMutation(chapterId)}
          disabled={createBeatPending}
          className="btn btn-primary text-xs py-1 px-2 inline-flex items-center gap-1"
        >
          <Plus size={14} />
          Сцена
        </button>
      </div>
      {expanded && (
        <div className="p-3 space-y-3">
          {isBeatsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-primary-500" />
            </div>
          ) : beats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-dark-300 p-4 text-center text-dark-500 text-sm">
              <p className="mb-2">В этой главе пока нет сцен.</p>
              {hasChapterContent && (
                <button
                  type="button"
                  onClick={() => createFirstBeatFromChapterContent(chapterId)}
                  className="btn btn-secondary text-sm"
                >
                  Использовать текст главы как первую сцену
                </button>
              )}
              <p className="mt-2">Или нажмите «Сцена» выше.</p>
            </div>
          ) : (
            <>
              {beats.map((beat, index) => (
                <div key={beat.id} className="contents">
                  <div
                    role="button"
                    tabIndex={0}
                    className={`min-h-[24px] transition-colors ${
                      dropTargetChapterId === chapterId && dropTargetIndex === index
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-t-2 border-primary-500 rounded'
                        : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                    } ${draggedBeatId ? 'pointer-events-auto cursor-copy' : 'pointer-events-none'}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedBeatId !== beat.id) {
                        setDropTargetChapterId(chapterId);
                        setDropTargetIndex(index);
                      }
                    }}
                    onDragLeave={() => { setDropTargetChapterId(null); setDropTargetIndex(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropAt(chapterId, index);
                    }}
                  />
                  <div
                    onDragOver={handleBeatDragOver}
                    onDragEnd={handleBeatDragEnd}
                    className={draggedBeatId === beat.id ? 'opacity-50' : ''}
                  >
                    <div
                      className={`rounded-lg border overflow-hidden ${beat.enabled === false ? 'opacity-50 grayscale border-amber-500/70' : 'border-dark-200'} bg-dark-50 dark:bg-dark-800/70`}
                      style={beat.enabled === false ? { borderWidth: '1px', borderStyle: 'solid' } : undefined}
                    >
                      <div className="flex items-center gap-2 p-2">
                        <span
                          draggable
                          role="button"
                          tabIndex={0}
                          className="cursor-grab active:cursor-grabbing touch-none text-dark-400 select-none"
                          title="Перетащите для изменения порядка"
                          onDragStart={(e) => {
                            handleBeatDragStart(e, beat.id, chapterId);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(beat.id));
                          }}
                        >
                          <GripVertical size={18} />
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            toggleBeatCollapse(beat.id);
                            updateBeatMutation({ chapterId, beatId: beat.id, data: { collapsed: !collapsedBeats.has(beat.id) } });
                          }}
                          className="p-1 rounded hover:bg-dark-100"
                          title={collapsedBeats.has(beat.id) ? 'Развернуть сцену' : 'Свернуть сцену (вместе с текстом)'}
                        >
                          {collapsedBeats.has(beat.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBeatMutation({ chapterId, beatId: beat.id, data: { enabled: beat.enabled !== false ? false : true } })}
                          className="p-1 rounded hover:bg-dark-100"
                          title={beat.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
                        >
                          {beat.enabled !== false ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                        </button>
                        <span className="text-xs font-medium text-dark-500 uppercase tracking-wide">Scene Beat</span>
                        <input
                          type="text"
                          value={editingBeat?.id === beat.id ? editingBeat.title : beat.title}
                          onFocus={() => setEditingBeat({ id: beat.id, title: beat.title, description: beat.description ?? '', content: beat.content })}
                          onChange={(e) => setEditingBeat((p) => (p?.id === beat.id ? { ...p, title: e.target.value } : p))}
                          onBlur={(e) => {
                            if (e.target.value !== beat.title) updateBeatMutation({ chapterId, beatId: beat.id, data: { title: e.target.value } });
                            setEditingBeat(null);
                          }}
                          placeholder="Название сцены"
                          className="flex-1 min-w-0 bg-transparent border-0 text-sm font-semibold text-dark-800 dark:text-dark-200 focus:ring-0"
                        />
                        {beat.enabled === false && <span className="text-xs text-amber-600">Выключена</span>}
                        {onAnalyzeBeat && (
                          <button
                            type="button"
                            onClick={() => onAnalyzeBeat(chapterId, beat.id)}
                            disabled={isAnalyzingBeatId === beat.id}
                            className="p-1 rounded hover:bg-dark-100 text-primary-600 dark:text-primary-400"
                            title="Анализ ИИ сцены"
                          >
                            {isAnalyzingBeatId === beat.id ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                          </button>
                        )}
                        <button type="button" onClick={() => confirm('Удалить сцену?') && deleteBeatMutation({ chapterId, beatId: beat.id })} className="p-1 rounded hover:bg-red-100 text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {!collapsedBeats.has(beat.id) && (
                        <>
                        <div className="px-2 py-1.5 border-t border-dark-100 bg-white/30 dark:bg-dark-700/30">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-dark-500">Описание сцены</span>
                            <button type="button" onClick={() => handleGenerateBeatDescription(beat, chapterId)} disabled={generatingDescriptionBeatId === beat.id}
                              className="text-xs px-2 py-0.5 rounded bg-dark-200 dark:bg-dark-600 hover:bg-dark-300 text-dark-700 dark:text-dark-200 disabled:opacity-50">
                              {generatingDescriptionBeatId === beat.id ? <Loader2 size={12} className="animate-spin inline" /> : null}
                              Сгенерировать описание
                            </button>
                          </div>
                          <textarea
                            value={editingBeat?.id === beat.id ? editingBeat.description : beat.description ?? ''}
                            onFocus={() => setEditingBeat((p) => (p?.id === beat.id ? p : { id: beat.id, title: beat.title, description: beat.description ?? '', content: beat.content }))}
                            onChange={(e) => setEditingBeat((p) => (p?.id === beat.id ? { ...p, description: e.target.value } : p))}
                            onBlur={(e) => {
                              const desc = e.target.value;
                              const cur = beat.description ?? '';
                              if (desc !== cur) updateBeatMutation({ chapterId, beatId: beat.id, data: { description: desc } });
                              setEditingBeat(null);
                            }}
                            placeholder="Кратко: что происходит в сцене (для ИИ и плана)"
                            className="input w-full text-sm border-0 rounded py-1.5 px-2 min-h-[60px] resize-y bg-transparent"
                            rows={2}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-t border-dark-100 bg-white/50 dark:bg-dark-700/50">
                          {[200, 400, 600].map((w) => (
                            <button key={w} type="button" onClick={() => setBeatWords((prev) => ({ ...prev, [beat.id]: w }))}
                              className={`px-2 py-0.5 rounded text-sm font-medium ${(beatWords[beat.id] ?? 400) === w ? 'bg-primary-500 text-white' : 'bg-dark-200 dark:bg-dark-600 text-dark-700 dark:text-dark-300'}`}>
                              {w}
                            </button>
                          ))}
                          <button type="button" onClick={() => handleGenerateBeat(beat, chapterId)} disabled={generatingBeatId === beat.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                            {generatingBeatId === beat.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                            Сгенерировать
                          </button>
                          <button type="button" onClick={() => handleClearBeat(chapterId, beat.id)} className="p-1 rounded hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-500">
                            <Eraser size={14} />
                          </button>
                        </div>
                        <div className="mt-1 rounded-lg border border-dark-200 bg-white dark:bg-dark-700">
                          <div className="text-xs text-dark-500 px-2 pt-1">Текст сцены</div>
                          <AutoResizeTextarea
                            value={streamingChunk[beat.id] !== undefined ? (streamingBase[beat.id] ?? '') + (streamingChunk[beat.id] ?? '') : editingBeat?.id === beat.id ? editingBeat.content : beat.content}
                            readOnly={generatingBeatId === beat.id}
                            onFocus={() => !generatingBeatId && setEditingBeat((p) => (p?.id === beat.id ? p : { id: beat.id, title: beat.title, description: beat.description ?? '', content: beat.content }))}
                            onChange={(e) => setEditingBeat((p) => (p?.id === beat.id ? { ...p, content: e.target.value } : p))}
                            onBlur={(e) => {
                              if (generatingBeatId === beat.id) return;
                              if (e.target.value !== beat.content) updateBeatMutation({ chapterId, beatId: beat.id, data: { content: e.target.value } });
                              setEditingBeat(null);
                            }}
                            className="input w-full font-mono text-sm border-0 rounded-lg focus:ring-1 focus:ring-primary-500 bg-transparent py-2 px-3"
                            placeholder="Текст сцены. [[character:1]], [[location:2]], [[note:3]]. %% комментарий для ИИ %%"
                            spellCheck={false}
                          />
                          <div className="text-xs text-dark-400 px-2 pb-1.5 pt-0.5">Комментарии только для ИИ: <code className="bg-dark-100 dark:bg-dark-700 px-1 rounded">%% ваш текст %%</code></div>
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div
                role="button"
                tabIndex={0}
                className={`min-h-[24px] transition-colors ${dropTargetChapterId === chapterId && dropTargetIndex === beats.length ? 'bg-primary-100 dark:bg-primary-900/40 border-t-2 border-primary-500 rounded' : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'} ${draggedBeatId ? 'pointer-events-auto cursor-copy' : 'pointer-events-none'}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTargetChapterId(chapterId); setDropTargetIndex(beats.length); }}
                onDragLeave={() => { setDropTargetChapterId(null); setDropTargetIndex(null); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropAt(chapterId, beats.length); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  readOnly,
  className,
  spellCheck,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  spellCheck?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(MIN_TEXTAREA_HEIGHT, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      readOnly={readOnly}
      className={className}
      spellCheck={spellCheck}
      rows={1}
      style={{ minHeight: MIN_TEXTAREA_HEIGHT, overflow: 'hidden' }}
    />
  );
}

export default function BookEditorPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const uId = parseInt(universeId!, 10);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [expandedActs, setExpandedActs] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [collapsedBeats, setCollapsedBeats] = useState<Set<number>>(new Set());
  const [draggedBeatId, setDraggedBeatId] = useState<number | null>(null);
  const [draggedBeatChapterId, setDraggedBeatChapterId] = useState<number | null>(null);
  /** Слот вставки: глава и индекс (0 = в начало главы) */
  const [dropTargetChapterId, setDropTargetChapterId] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [editingBeat, setEditingBeat] = useState<{ id: number; title: string; description: string; content: string } | null>(null);
  const [generatingBeatId, setGeneratingBeatId] = useState<number | null>(null);
  const [generatingDescriptionBeatId, setGeneratingDescriptionBeatId] = useState<number | null>(null);
  const [beatWords, setBeatWords] = useState<Record<number, number>>({});
  /** При стриминге: базовый текст на момент старта и накапливаемый чанк */
  const [streamingBase, setStreamingBase] = useState<Record<number, string>>({});
  const [streamingChunk, setStreamingChunk] = useState<Record<number, string>>({});
  /** Режим отображения: структура, полотно или написание (текстовый редактор как в Novelcrafter) */
  const [viewMode, setViewMode] = useState<'structure' | 'canvas' | 'write'>('write');
  /** В полотне: какие блоки показывать */
  const [canvasShowActs, setCanvasShowActs] = useState(true);
  const [canvasShowChapters, setCanvasShowChapters] = useState(true);
  const [canvasShowBeats, setCanvasShowBeats] = useState(true);
  const [canvasShowAuthorComments, setCanvasShowAuthorComments] = useState(true);
  /** По умолчанию скрытые (выключенные) акты/главы/сцены не показываем; опция «Показать скрытое» включает их */
  const [showHidden, setShowHidden] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewText, setPreviewText] = useState<string>('');
  /** В полотне: подсветить блок (акт/глава) при навигации из дерева. Сбрасывается через 2 с. */
  const [highlightCanvasBlock, setHighlightCanvasBlock] = useState<{ type: 'act' | 'chapter'; id: number } | null>(null);
  const [highlightStructureBlock, setHighlightStructureBlock] = useState<{ type: 'act' | 'chapter'; id: number } | null>(null);
  /** Перетаскивание главы между актами: id пункта плана (outline item) и зона сброса */
  const [draggedChapterOutlineId, setDraggedChapterOutlineId] = useState<number | null>(null);
  const [dropTargetOutlineId, setDropTargetOutlineId] = useState<number | null>(null);
  const [dropTargetAtStart, setDropTargetAtStart] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingBeatId, setAnalyzingBeatId] = useState<number | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  /** Меню команд по "/" в режиме Написание: якорь, глава, сцена (null = текст главы) */
  const [slashMenu, setSlashMenu] = useState<{ anchor: HTMLElement; chapterId: number; beatId: number | null } | null>(null);
  const beatInsertRefs = useRef<Record<number, ContentWithInlineCommentsHandle | null>>({});
  const chapterContentInsertRefs = useRef<Record<number, ContentWithInlineCommentsHandle | null>>({});

  const { data: outline = [] } = useQuery({
    queryKey: ['outline', universeId],
    queryFn: () => outlineApi.getAll(uId),
    enabled: !!universeId,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => chaptersApi.getAll(uId),
    enabled: !!universeId,
  });
  const { data: bookData } = useQuery({
    queryKey: ['book-view', universeId],
    queryFn: () => universeViewApi.getText(uId),
    enabled: !!universeId,
  });
  const tree = buildTree(outline, chapters);
  const chaptersOrphan = chaptersNotInOutline(outline, chapters);
  const chapterIds = useMemo(() => {
    const ids: number[] = [];
    tree.forEach((n) => { if (n.type === 'chapter') ids.push(n.chapter.id); });
    chaptersOrphan.forEach((c) => ids.push(c.id));
    return ids;
  }, [tree, chaptersOrphan]);

  // Тяжёлый контент монтируем после первого кадра, чтобы меню успело отрисоваться и реагировать на клики
  const [heavyReady, setHeavyReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeavyReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Биты не грузим сразу — даём время отрисоваться меню и не блокировать поток
  const [beatsFetchLimit, setBeatsFetchLimit] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setBeatsFetchLimit(6), 200);
    const t2 = setTimeout(() => setBeatsFetchLimit(Number.MAX_SAFE_INTEGER), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const beatsQueries = useQueries({
    queries: chapterIds.map((cid, index) => ({
      queryKey: ['beats', universeId, cid] as const,
      queryFn: () => chaptersApi.getBeats(uId, cid),
      enabled: !!universeId && !!cid && index < beatsFetchLimit,
    })),
  });
  const beatsByChapterId = useMemo(() => {
    const m: Record<number, SceneBeat[]> = {};
    chapterIds.forEach((cid, i) => {
      m[cid] = beatsQueries[i]?.data ?? [];
    });
    return m;
  }, [chapterIds, beatsQueries]);

  // Отложенное обновление UI по битам — клики по меню обрабатываются без задержки
  const beatsByChapterIdDeferred = useDeferredValue(beatsByChapterId);

  // Синхронизация свёрнутых сцен с сервером (collapsed сохраняется в БД)
  useEffect(() => {
    const fromServer = new Set<number>();
    Object.values(beatsByChapterId).flat().forEach((b) => {
      if (b.collapsed) fromServer.add(b.id);
    });
    setCollapsedBeats(fromServer);
  }, [beatsByChapterId]);

  const actsWithChapters = useMemo(() => {
    const list: { act: TreeAct; chapters: TreeChapter[] }[] = [];
    tree.forEach((n) => {
      if (n.type === 'act') {
        const actChapters = tree.filter((m): m is TreeChapter => m.type === 'chapter' && m.actId === n.item.id);
        actChapters.sort((a, b) => a.chapter.chapter_number - b.chapter.chapter_number);
        list.push({ act: n, chapters: actChapters });
      }
    });
    return list;
  }, [tree]);

  /** Для отображения: при showHidden === false скрытые акты/главы/сцены не показываем */
  const actsWithChaptersFiltered = useMemo(() => {
    if (showHidden) return actsWithChapters;
    return actsWithChapters
      .filter(({ act }) => act.item.enabled !== false)
      .map(({ act, chapters }) => ({
        act,
        chapters: chapters.filter((n) => n.item.enabled !== false && n.chapter.enabled !== false),
      }));
  }, [actsWithChapters, showHidden]);
  const chaptersOrphanFiltered = useMemo(
    () => (showHidden ? chaptersOrphan : chaptersOrphan.filter((c) => c.enabled !== false)),
    [chaptersOrphan, showHidden]
  );

  /** Список актов для выбора принадлежности главы (в настройках главы) */
  const actListForChapters = useMemo(
    () => actsWithChapters.map(({ act }) => ({ id: act.item.id, title: act.item.title })),
    [actsWithChapters]
  );

  /** Число рядов в полотне (акты + один блок «Без раздела») для виртуализации — по отфильтрованным данным */
  const canvasRowCount = actsWithChaptersFiltered.length + (chaptersOrphanFiltered.length > 0 ? 1 : 0);

  /** Плоский порядок «по книге» для дерева и вида структуры — только видимое при «не показывать скрытое» */
  const structureFlatList = useMemo(() => {
    const list: { type: 'act'; act: TreeAct } | { type: 'chapter'; node: TreeChapter; actId: number | null } | { type: 'orphan-header' } | { type: 'orphan-chapter'; chapter: Chapter }[] = [];
    actsWithChaptersFiltered.forEach(({ act, chapters }) => {
      list.push({ type: 'act', act });
      chapters.forEach((node) => list.push({ type: 'chapter', node, actId: act.item.id }));
    });
    if (chaptersOrphanFiltered.length > 0) {
      list.push({ type: 'orphan-header' });
      chaptersOrphanFiltered.forEach((chapter) => list.push({ type: 'orphan-chapter', chapter }));
    }
    return list;
  }, [actsWithChaptersFiltered, chaptersOrphanFiltered]);

  /** При первой загрузке плана — развернуть все акты */
  const expandedActsInitialized = useRef(false);
  useEffect(() => {
    if (expandedActsInitialized.current || actsWithChapters.length === 0) return;
    expandedActsInitialized.current = true;
    setExpandedActs(new Set(actsWithChapters.map(({ act }) => act.item.id)));
  }, [actsWithChapters]);

  const createBeatMutation = useMutation({
    mutationFn: (chapterId: number) => chaptersApi.createBeat(uId, chapterId, { title: '', content: '' }),
    onSuccess: (data, chapterId) => {
      // Сразу добавляем сцену в кэш; не инвалидируем beats — иначе refetch может перезаписать кэш до ответа сервера
      queryClient.setQueryData<SceneBeat[]>(['beats', universeId, chapterId], (old) => [...(old ?? []), data]);
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      toast.success('Сцена добавлена');
    },
    onError: () => toast.error('Не удалось добавить сцену'),
  });

  const updateBeatMutation = useMutation({
    mutationFn: ({ chapterId, beatId, data }: { chapterId: number; beatId: number; data: { title?: string; description?: string; content?: string; enabled?: boolean; collapsed?: boolean } }) =>
      chaptersApi.updateBeat(uId, chapterId, beatId, data),
    onSuccess: (_, { chapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['beats', universeId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  const deleteBeatMutation = useMutation({
    mutationFn: ({ chapterId, beatId }: { chapterId: number; beatId: number }) =>
      chaptersApi.deleteBeat(uId, chapterId, beatId),
    onSuccess: (_, { chapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['beats', universeId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      toast.success('Сцена удалена');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  const reorderBeatsMutation = useMutation({
    mutationFn: ({ chapterId, beatIds }: { chapterId: number; beatIds: number[] }) =>
      chaptersApi.reorderBeats(uId, chapterId, beatIds),
    onSuccess: (_, { chapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['beats', universeId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
    },
    onError: () => toast.error('Не удалось изменить порядок'),
  });

  const moveBeatMutation = useMutation({
    mutationFn: ({
      sourceChapterId,
      beatId,
      targetChapterId,
      insertIndex,
    }: {
      sourceChapterId: number;
      beatId: number;
      targetChapterId: number;
      insertIndex: number;
    }) => chaptersApi.moveBeat(uId, sourceChapterId, beatId, { target_chapter_id: targetChapterId, insert_index: insertIndex }),
    onSuccess: (_, { sourceChapterId, targetChapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['beats', universeId, sourceChapterId] });
      queryClient.invalidateQueries({ queryKey: ['beats', universeId, targetChapterId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      toast.success('Сцена перенесена в другую главу');
    },
    onError: () => toast.error('Не удалось перенести сцену'),
  });

  const updateOutlineMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; enabled?: boolean } }) => outlineApi.update(uId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  const moveOutlineMutation = useMutation({
    mutationFn: ({ itemId, afterItemId }: { itemId: number; afterItemId: number | null }) =>
      outlineApi.move(uId, itemId, afterItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      setDraggedChapterOutlineId(null);
      setDropTargetOutlineId(null);
      setDropTargetAtStart(false);
      toast.success('Глава перенесена');
    },
    onError: () => {
      toast.error('Не удалось перенести главу');
      setDraggedChapterOutlineId(null);
      setDropTargetOutlineId(null);
      setDropTargetAtStart(false);
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; enabled?: boolean; content?: string } }) => chaptersApi.update(uId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
    },
    onError: () => toast.error('Не удалось сохранить главу'),
  });

  const createChapterMutation = useMutation({
    mutationFn: (data: { title: string; chapter_number: number }) => chaptersApi.create(uId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
    },
    onError: () => toast.error('Не удалось создать главу'),
  });

  const createOutlineMutation = useMutation({
    mutationFn: (data: { title: string; outline_type: string; sort_order?: number; chapter_id?: number | null }) =>
      outlineApi.create(uId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
    },
    onError: () => toast.error('Не удалось добавить в план'),
  });

  const deleteOutlineMutation = useMutation({
    mutationFn: (itemId: number) => outlineApi.delete(uId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      toast.success('Удалено из плана');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async ({ chapterId, outlineItemId }: { chapterId: number; outlineItemId?: number | null }) => {
      if (outlineItemId != null) await outlineApi.delete(uId, outlineItemId);
      await chaptersApi.delete(uId, chapterId);
    },
    onSuccess: (_, { chapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
      queryClient.invalidateQueries({ queryKey: ['beats', universeId] });
      if (selectedChapterId === chapterId) setSelectedChapterId(null);
      toast.success('Глава удалена');
    },
    onError: () => toast.error('Не удалось удалить главу'),
  });

  const handleGenerateBeat = useCallback(
    async (beat: { id: number; title: string; content: string }, chapterId: number) => {
      const existing = (editingBeat?.id === beat.id ? editingBeat.content : beat.content) ?? '';
      const base = existing.trim() ? existing.trimEnd() + '\n\n' : '';
      setStreamingBase((prev) => ({ ...prev, [beat.id]: base }));
      setStreamingChunk((prev) => ({ ...prev, [beat.id]: '' }));
      setGeneratingBeatId(beat.id);
      try {
        const desc = beat.description ?? '';
        let fullChunk = '';
        for await (const chunk of universeViewApi.generateBeatStream(
          uId,
          {
            chapter_id: chapterId,
            beat_id: beat.id,
            beat_title: beat.title,
            beat_description: desc || undefined,
            words: beatWords[beat.id] ?? 400,
          }
        )) {
          fullChunk += chunk;
          setStreamingChunk((prev) => ({ ...prev, [beat.id]: fullChunk }));
        }
        const newContent = base + fullChunk;
        updateBeatMutation.mutate({ chapterId, beatId: beat.id, data: { content: newContent } });
        setEditingBeat((p) => (p?.id === beat.id ? { ...p, content: newContent } : p));
        toast.success('Текст добавлен под сцену');
      } catch {
        toast.error('Не удалось сгенерировать текст');
      } finally {
        setGeneratingBeatId(null);
        setStreamingBase((prev) => {
          const next = { ...prev };
          delete next[beat.id];
          return next;
        });
        setStreamingChunk((prev) => {
          const next = { ...prev };
          delete next[beat.id];
          return next;
        });
      }
    },
    [uId, beatWords, updateBeatMutation, editingBeat]
  );

  const handleClearBeat = useCallback(
    (chapterId: number, beatId: number) => {
      if (confirm('Очистить текст сцены?')) updateBeatMutation.mutate({ chapterId, beatId, data: { content: '' } });
    },
    [updateBeatMutation]
  );

  const handleGenerateBeatDescription = useCallback(
    async (beat: { id: number; title: string; description?: string; content?: string }, chapterId: number) => {
      setGeneratingDescriptionBeatId(beat.id);
      try {
        const res = await universeViewApi.generateBeatDescription(uId, {
          chapter_id: chapterId,
          beat_id: beat.id,
          beat_title: beat.title,
        });
        updateBeatMutation.mutate({ chapterId, beatId: beat.id, data: { description: res.description } });
        setEditingBeat((p) => (p?.id === beat.id ? { ...p, description: res.description } : p));
        toast.success('Описание сцены сгенерировано');
      } catch {
        toast.error('Не удалось сгенерировать описание');
      } finally {
        setGeneratingDescriptionBeatId(null);
      }
    },
    [uId, updateBeatMutation]
  );

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const chapterFromBook = bookData?.chapters?.find((c) => c.id === selectedChapterId);

  /** При клике на главу в дереве: в режиме «Структура» — развернуть и прокрутить к главе; в режиме «Полотно» — прокрутить и подсветить */
  const handleSelectChapterInTree = useCallback((chapterId: number, actId: number | null) => {
    setSelectedChapterId(chapterId);
    if (actId != null) setExpandedActs((prev) => new Set(prev).add(actId));
    setExpandedChapters((prev) => new Set(prev).add(chapterId));
    if (viewMode === 'canvas') {
      setHighlightCanvasBlock({ type: 'chapter', id: chapterId });
    } else {
      setViewMode('structure');
      setHighlightStructureBlock({ type: 'chapter', id: chapterId });
    }
  }, [viewMode]);

  /** В полотне: прокрутить к акту и подсветить (вызывается при клике на акт в дереве) */
  const scrollToActInCanvas = useCallback((actId: number) => {
    setViewMode('canvas');
    setHighlightCanvasBlock({ type: 'act', id: actId });
  }, []);

  /** В структуре: прокрутить к акту и подсветить (при клике на акт в дереве) */
  const scrollToActInStructure = useCallback((actId: number) => {
    setViewMode('structure');
    setHighlightStructureBlock({ type: 'act', id: actId });
  }, []);

  /** Добавить акт в план (в конец) */
  const handleAddAct = useCallback(() => {
    const sortOrder = outline.length > 0 ? Math.max(...outline.map((o) => o.sort_order), 0) + 1 : 0;
    createOutlineMutation.mutate({ title: 'Новый акт', outline_type: 'act', sort_order: sortOrder });
    toast.success('Акт добавлен');
  }, [outline, createOutlineMutation]);

  /** Добавить главу в акт: создать главу, пункт плана с chapter_id, переместить после акта */
  const handleAddChapterToAct = useCallback(
    async (actOutlineId: number) => {
      const nextNum = chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapter_number), 0) + 1 : 1;
      try {
        const chapter = await createChapterMutation.mutateAsync({
          title: 'Новая глава',
          chapter_number: nextNum,
        });
        const item = await createOutlineMutation.mutateAsync({
          title: chapter.title,
          outline_type: 'chapter',
          chapter_id: chapter.id,
        });
        await moveOutlineMutation.mutateAsync({ itemId: item.id, afterItemId: actOutlineId });
        setExpandedActs((prev) => new Set(prev).add(actOutlineId));
        setSelectedChapterId(chapter.id);
        setExpandedChapters((prev) => new Set(prev).add(chapter.id));
        toast.success('Глава добавлена в акт');
      } catch {
        toast.error('Не удалось добавить главу');
      }
    },
    [chapters, createChapterMutation, createOutlineMutation, moveOutlineMutation]
  );

  /** Изменить принадлежность главы к акту (или «Без раздела») */
  const handleChapterActChange = useCallback(
    async (chapterId: number, outlineItemId: number | null, newActOutlineId: number | null) => {
      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) return;
      try {
        if (newActOutlineId === null) {
          if (outlineItemId != null) await deleteOutlineMutation.mutateAsync(outlineItemId);
          return;
        }
        if (outlineItemId != null) {
          await moveOutlineMutation.mutateAsync({ itemId: outlineItemId, afterItemId: newActOutlineId });
        } else {
          const item = await createOutlineMutation.mutateAsync({
            title: chapter.title,
            outline_type: 'chapter',
            chapter_id: chapterId,
          });
          await moveOutlineMutation.mutateAsync({ itemId: item.id, afterItemId: newActOutlineId });
          setExpandedActs((prev) => new Set(prev).add(newActOutlineId));
        }
        toast.success('Раздел обновлён');
      } catch {
        toast.error('Не удалось изменить раздел');
      }
    },
    [chapters, createOutlineMutation, deleteOutlineMutation, moveOutlineMutation]
  );

  const canvasVirtualizer = useVirtualizer({
    count: canvasRowCount,
    getScrollElement: () => canvasScrollRef.current,
    estimateSize: () => 320,
    overscan: 2,
    enabled: viewMode === 'canvas',
  });

  /** Индекс ряда в полотне по id акта или главы (для scrollToIndex) — по отфильтрованному списку */
  const getCanvasRowIndex = useCallback(
    (type: 'act' | 'chapter', id: number) => {
      if (type === 'act') {
        const idx = actsWithChaptersFiltered.findIndex(({ act }) => act.item.id === id);
        return idx >= 0 ? idx : 0;
      }
      for (let i = 0; i < actsWithChaptersFiltered.length; i++) {
        if (actsWithChaptersFiltered[i].chapters.some((n) => n.chapter.id === id)) return i;
      }
      if (chaptersOrphanFiltered.some((ch) => ch.id === id)) return actsWithChaptersFiltered.length;
      return 0;
    },
    [actsWithChaptersFiltered, chaptersOrphanFiltered]
  );

  /** Эффект: прокрутка к блоку в полотне и сброс подсветки через 2 с */
  useEffect(() => {
    if (viewMode !== 'canvas' || !highlightCanvasBlock) return;
    const rowIndex = getCanvasRowIndex(highlightCanvasBlock.type, highlightCanvasBlock.id);
    canvasVirtualizer.scrollToIndex(rowIndex, { align: 'start', behavior: 'smooth' });
    const t = setTimeout(() => setHighlightCanvasBlock(null), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasVirtualizer stable, avoid extra runs
  }, [viewMode, highlightCanvasBlock, getCanvasRowIndex]);

  /** Эффект: прокрутка к блоку в структуре и сброс подсветки через 2 с */
  useEffect(() => {
    if (viewMode !== 'structure' || !highlightStructureBlock) return;
    const id = highlightStructureBlock.type === 'act' ? `structure-act-${highlightStructureBlock.id}` : `structure-chapter-${highlightStructureBlock.id}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const t = setTimeout(() => setHighlightStructureBlock(null), 2000);
    return () => clearTimeout(t);
  }, [viewMode, highlightStructureBlock]);

  const toggleAct = useCallback((id: number) => {
    setExpandedActs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleChapter = useCallback((id: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBeatCollapse = useCallback((id: number) => {
    setCollapsedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBeatDragStart = (e: React.DragEvent, beatId: number, chapterId: number) => {
    setDraggedBeatId(beatId);
    setDraggedBeatChapterId(chapterId);
    setDropTargetIndex(null);
    setDropTargetChapterId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(beatId));
  };
  const handleBeatDragOver = (e: React.DragEvent) => e.preventDefault();
  /** Вставка перетаскиваемого блока в главе chapterId на позицию insertIndex. */
  const handleDropAt = useCallback(
    (chapterId: number, insertIndex: number) => {
      const beatId = draggedBeatId;
      const sourceChapterId = draggedBeatChapterId;
      if (beatId == null || sourceChapterId == null) return;
      setDraggedBeatId(null);
      setDraggedBeatChapterId(null);
      setDropTargetIndex(null);
      setDropTargetChapterId(null);
      if (sourceChapterId === chapterId) {
        const beats = beatsByChapterId[chapterId] ?? [];
        const ids = beats.map((b) => b.id);
        const fromIdx = ids.indexOf(beatId);
        if (fromIdx === -1) return;
        const next = ids.filter((id) => id !== beatId);
        const toIdx = Math.min(insertIndex, next.length);
        next.splice(toIdx, 0, beatId);
        reorderBeatsMutation.mutate({ chapterId, beatIds: next });
      } else {
        moveBeatMutation.mutate({
          sourceChapterId,
          beatId,
          targetChapterId: chapterId,
          insertIndex,
        });
      }
    },
    [beatsByChapterId, draggedBeatId, draggedBeatChapterId, reorderBeatsMutation, moveBeatMutation]
  );
  const handleBeatDragEnd = () => {
    setDraggedBeatId(null);
    setDraggedBeatChapterId(null);
    setDropTargetIndex(null);
    setDropTargetChapterId(null);
  };

  const createFirstBeatFromChapterContent = useCallback(
    (chapterId: number) => {
      const ch = chapters.find((c) => c.id === chapterId);
      const fromBook = bookData?.chapters?.find((c) => c.id === chapterId);
      const content = (fromBook?.content ?? ch?.content ?? '').trim();
      if (!content) {
        createBeatMutation.mutate(chapterId);
        return;
      }
      chaptersApi.createBeat(uId, chapterId, { title: 'Сцена 1', content }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['beats', universeId, chapterId] });
        queryClient.invalidateQueries({ queryKey: ['book-view', universeId] });
        toast.success('Текст главы сохранён как первая сцена');
      }).catch(() => toast.error('Не удалось создать сцену'));
    },
    [chapters, bookData, uId, universeId, createBeatMutation]
  );

  const handleAnalyzeBook = useCallback(async () => {
    if (!uId) return;
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeConsistency(uId);
      const raw = result as { contradictions?: any[]; unused_elements?: { element?: string; suggestion?: string }[]; gaps?: string[]; timeline_issues?: string[]; suggestions?: any[] };
      setAiAnalysis({
        ...result,
        suggestions: [
          ...(raw.gaps || []).map((g: string) => ({ title: 'Пробел в сюжете', description: g })),
          ...(raw.unused_elements || []).map((u) => ({ title: 'Не использовано: ' + (u.element || ''), description: (u.suggestion || '').toString() })),
          ...(raw.timeline_issues || []).map((t: string) => ({ title: 'Хронология', description: t })),
          ...(raw.suggestions || []),
        ],
      });
    } catch (e: any) {
      toast.error('Ошибка анализа: ' + (e?.response?.data?.detail || e?.message || 'Не удалось'));
    } finally {
      setIsAnalyzing(false);
    }
  }, [uId]);

  const handleAnalyzeAct = useCallback(async (actOutlineId: number) => {
    if (!uId) return;
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeAct(uId, actOutlineId);
      setAiAnalysis(result);
    } catch (e: any) {
      toast.error('Ошибка анализа: ' + (e?.response?.data?.detail || e?.message || 'Не удалось'));
    } finally {
      setIsAnalyzing(false);
    }
  }, [uId]);

  const handleAnalyzeChapter = useCallback(async (chapterId: number) => {
    if (!uId) return;
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeChapter(uId, chapterId);
      setAiAnalysis(result);
    } catch (e: any) {
      toast.error('Ошибка анализа: ' + (e?.response?.data?.detail || e?.message || 'Не удалось'));
    } finally {
      setIsAnalyzing(false);
    }
  }, [uId]);

  const handleAnalyzeBeat = useCallback(async (chapterId: number, beatId: number) => {
    if (!uId) return;
    setAnalyzingBeatId(beatId);
    try {
      const result = await aiCriticApi.analyzeBeat(uId, chapterId, beatId);
      setAiAnalysis(result);
    } catch (e: any) {
      toast.error('Ошибка анализа: ' + (e?.response?.data?.detail || e?.message || 'Не удалось'));
    } finally {
      setAnalyzingBeatId(null);
    }
  }, [uId]);

  if (!universeId) return null;

  if (!heavyReady) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center gap-4 text-dark-500">
        <Loader2 size={24} className="animate-spin" />
        <span>Книга загружается…</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Дерево: акты и главы */}
      <div className="w-72 shrink-0 border border-dark-200 rounded-lg bg-white dark:bg-dark-100 overflow-y-auto">
        <div className="p-3 border-b border-dark-200 font-semibold text-dark-800 dark:text-dark-200 flex items-center gap-2">
          <BookOpen size={18} />
          Структура книги
        </div>
        <div className="p-2">
          <button
            type="button"
            onClick={handleAddAct}
            disabled={createOutlineMutation.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 mb-1.5 rounded border border-dashed border-dark-300 text-dark-600 dark:text-dark-400 hover:border-primary-400 hover:text-primary-600 text-sm"
          >
            {createOutlineMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Добавить акт
          </button>
          {draggedChapterOutlineId != null && (
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetAtStart(true); setDropTargetOutlineId(null); }}
              onDragLeave={() => setDropTargetAtStart(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                moveOutlineMutation.mutate({ itemId: draggedChapterOutlineId, afterItemId: null });
                setDropTargetAtStart(false);
              }}
              className={`rounded border border-dashed py-1.5 px-2 mb-1 text-xs text-center transition-colors ${
                dropTargetAtStart ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-dark-200 text-dark-500'
              }`}
            >
              В начало плана
            </div>
          )}
          {structureFlatList.map((item, index) => {
            if (item.type === 'act') {
              const actOutlineId = item.act.item.id;
              const isDropTarget = draggedChapterOutlineId != null && dropTargetOutlineId === actOutlineId;
              const actEnabled = item.act.item.enabled !== false;
              return (
                <div
                  key={`act-${item.act.item.id}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedChapterOutlineId != null) {
                      setDropTargetOutlineId(actOutlineId);
                      setDropTargetAtStart(false);
                    }
                  }}
                  onDragLeave={() => { setDropTargetOutlineId((prev) => (prev === actOutlineId ? null : prev)); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedChapterOutlineId != null && draggedChapterOutlineId !== actOutlineId) {
                      moveOutlineMutation.mutate({ itemId: draggedChapterOutlineId, afterItemId: actOutlineId });
                    }
                    setDropTargetOutlineId(null);
                    setDropTargetAtStart(false);
                  }}
                  className={`rounded transition-colors ${!actEnabled ? 'opacity-60' : ''} ${isDropTarget ? 'ring-2 ring-primary-500 ring-offset-1 bg-primary-50 dark:bg-primary-900/20' : ''}`}
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (viewMode === 'canvas') scrollToActInCanvas(item.act.item.id);
                        else { toggleAct(item.act.item.id); scrollToActInStructure(item.act.item.id); }
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left px-2 py-1.5 rounded hover:bg-dark-100 text-indigo-700 dark:text-indigo-300 font-medium"
                    >
                      {expandedActs.has(item.act.item.id) ? (
                        <ChevronDown size={16} className="shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="shrink-0" />
                      )}
                      <Theater size={16} />
                      <span className="truncate">{item.act.item.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOutlineMutation.mutate({ id: item.act.item.id, data: { enabled: !actEnabled } })}
                      className="p-1.5 rounded hover:bg-dark-100 shrink-0"
                      title={actEnabled ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
                    >
                      {actEnabled ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddChapterToAct(item.act.item.id)}
                      disabled={createChapterMutation.isPending || createOutlineMutation.isPending}
                      className="p-1.5 rounded hover:bg-dark-100 text-green-600 dark:text-green-400 shrink-0"
                      title="Добавить главу в акт"
                    >
                      {(createChapterMutation.isPending || createOutlineMutation.isPending) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeAct(item.act.item.id)}
                      disabled={isAnalyzing}
                      className="p-1.5 rounded hover:bg-dark-100 text-primary-600 dark:text-primary-400 shrink-0"
                      title="Анализ ИИ акта"
                    >
                      {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Удалить акт «${item.act.item.title}»? Главы останутся в плане.`)) {
                          deleteOutlineMutation.mutate(item.act.item.id);
                        }
                      }}
                      disabled={deleteOutlineMutation.isPending}
                      className="p-1.5 rounded hover:bg-red-100 text-red-500 shrink-0"
                      title="Удалить акт"
                    >
                      {deleteOutlineMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            }
            if (item.type === 'chapter') {
              if (!expandedActs.has(item.actId!)) return null;
              const outlineId = item.node.item.id;
              const isDragging = draggedChapterOutlineId === outlineId;
              const isDropTarget = draggedChapterOutlineId != null && draggedChapterOutlineId !== outlineId && dropTargetOutlineId === outlineId;
              return (
                <div
                  key={`ch-${item.node.chapter.id}`}
                  className={`ml-4 border-l border-dark-200 pl-2 flex items-center gap-1 ${isDropTarget ? 'ring-2 ring-primary-500 ring-offset-1 rounded bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedChapterOutlineId != null && draggedChapterOutlineId !== outlineId) {
                      setDropTargetOutlineId(outlineId);
                      setDropTargetAtStart(false);
                    }
                  }}
                  onDragLeave={() => setDropTargetOutlineId((prev) => (prev === outlineId ? null : prev))}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedChapterOutlineId != null && draggedChapterOutlineId !== outlineId) {
                      moveOutlineMutation.mutate({ itemId: draggedChapterOutlineId, afterItemId: outlineId });
                    }
                    setDropTargetOutlineId(null);
                    setDropTargetAtStart(false);
                  }}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      setDraggedChapterOutlineId(outlineId);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(outlineId));
                    }}
                    onDragEnd={() => setDraggedChapterOutlineId(null)}
                    onClick={() => handleSelectChapterInTree(item.node.chapter.id, item.actId)}
                    className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm ${
                      isDragging ? 'opacity-50' : ''
                    } ${
                      selectedChapterId === item.node.chapter.id
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-200 dark:text-primary-900'
                        : 'hover:bg-dark-100 text-dark-700 dark:text-dark-300'
                    }`}
                  >
                    <GripVertical size={14} className="shrink-0 cursor-grab active:cursor-grabbing text-dark-400" />
                    <BookOpen size={14} />
                    {item.node.chapter.chapter_number}. {item.node.chapter.title}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить главу «${item.node.chapter.title}»? Это действие нельзя отменить.`)) {
                        deleteChapterMutation.mutate({ chapterId: item.node.chapter.id, outlineItemId: outlineId });
                      }
                    }}
                    disabled={deleteChapterMutation.isPending}
                    className="p-1.5 rounded hover:bg-red-100 text-red-500 shrink-0"
                    title="Удалить главу"
                  >
                    {deleteChapterMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              );
            }
            if (item.type === 'orphan-header') {
              return (
                <div key="orphan-header" className="mt-2 pt-2 border-t border-dark-200 text-xs text-dark-500 font-medium px-2">
                  Без раздела
                </div>
              );
            }
            return (
              <div key={`ch-${item.chapter.id}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectChapterInTree(item.chapter.id, null)}
                  className={`flex items-center gap-2 flex-1 min-w-0 text-left px-2 py-1.5 rounded text-sm ${
                    selectedChapterId === item.chapter.id
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-200 dark:text-primary-900'
                      : 'hover:bg-dark-100 text-dark-700 dark:text-dark-300'
                  }`}
                >
                  <BookOpen size={14} />
                  {item.chapter.chapter_number}. {item.chapter.title}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Удалить главу «${item.chapter.title}»? Это действие нельзя отменить.`)) {
                      deleteChapterMutation.mutate({ chapterId: item.chapter.id });
                    }
                  }}
                  disabled={deleteChapterMutation.isPending}
                  className="p-1.5 rounded hover:bg-red-100 text-red-500 shrink-0"
                  title="Удалить главу"
                >
                  {deleteChapterMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Контент: структура или полотно */}
      <div className="flex-1 min-w-0 border border-dark-200 rounded-lg bg-white dark:bg-dark-100 flex flex-col">
        <div className="p-3 border-b border-dark-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-dark-800 dark:text-dark-200">Книга</span>
            <div className="flex rounded-lg border border-dark-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('write')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${viewMode === 'write' ? 'bg-primary-500 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200'}`}
                title="Режим написания: текст + добавление актов, глав и сцен"
              >
                <PenLine size={16} />
                Написание
              </button>
              <button
                type="button"
                onClick={() => setViewMode('structure')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${viewMode === 'structure' ? 'bg-primary-500 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200'}`}
              >
                <Layers size={16} />
                Структура
              </button>
              <button
                type="button"
                onClick={() => setViewMode('canvas')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${viewMode === 'canvas' ? 'bg-primary-500 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200'}`}
              >
                <LayoutTemplate size={16} />
                Полотно
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-dark-600 dark:text-dark-400 cursor-pointer" title="Показывать выключенные акты, главы и сцены">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="rounded" />
              <Eye size={16} className={showHidden ? 'text-amber-600' : ''} />
              <span>Показать скрытое</span>
            </label>
            {viewMode === 'canvas' && (
              <div className="flex items-center gap-2 text-xs text-dark-600 dark:text-dark-400">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={canvasShowActs} onChange={(e) => setCanvasShowActs(e.target.checked)} className="rounded" />
                  Акт
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={canvasShowChapters} onChange={(e) => setCanvasShowChapters(e.target.checked)} className="rounded" />
                  Глава
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={canvasShowBeats} onChange={(e) => setCanvasShowBeats(e.target.checked)} className="rounded" />
                  Scene beat
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={canvasShowAuthorComments} onChange={(e) => setCanvasShowAuthorComments(e.target.checked)} className="rounded" />
                  Комментарии автора
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(() => {
              const isSaving =
                updateBeatMutation.isPending ||
                updateChapterMutation.isPending ||
                updateOutlineMutation.isPending;
              const hasError =
                updateBeatMutation.isError ||
                updateChapterMutation.isError ||
                updateOutlineMutation.isError;
              return (
                <span
                  className={`flex items-center gap-1.5 text-xs ${
                    hasError ? 'text-red-600 dark:text-red-400' : isSaving ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                  }`}
                  title={hasError ? 'Ошибка сохранения' : isSaving ? 'Сохранение…' : 'Сохранено'}
                >
                  {hasError ? <AlertCircle size={14} /> : isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {hasError ? 'Ошибка' : isSaving ? 'Сохранение…' : 'Сохранено'}
                </span>
              );
            })()}
            <button
              type="button"
              onClick={handleAnalyzeBook}
              disabled={isAnalyzing}
              className="btn btn-secondary p-2"
              title="Анализ согласованности книги"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const data = await universeViewApi.getText(uId, { resolveLinks: true, stripAuthorNotes: true });
                  setPreviewText(data.fullText || '');
                  setShowPreviewModal(true);
                } catch {
                  toast.error('Не удалось загрузить текст');
                }
              }}
              className="btn btn-secondary p-2"
              title="Предпросмотр книги"
            >
              <FileText size={18} />
            </button>
          </div>
          <a href={`/universes/${universeId}/outline`} className="text-sm text-primary-600 hover:underline">
            Связать с планом
          </a>
        </div>
        <div ref={canvasScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
          {viewMode === 'write' ? (
            /* Режим написание: линейный документ с кнопками + Новая сцена / + Новая глава / + Новый акт */
            <div className="max-w-3xl mx-auto space-y-6 pb-12">
              {structureFlatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-dark-500 text-center">
                  <p className="mb-4">
                    {actsWithChapters.length > 0 || chaptersOrphan.length > 0
                      ? 'Все блоки скрыты. Включите «Показать скрытое».'
                      : 'Нет актов и глав. Добавьте структуру в плане (Outline) или начните с кнопки ниже.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAct}
                    disabled={createOutlineMutation.isPending}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    {createOutlineMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Новый акт
                  </button>
                </div>
              ) : (
                <>
                  {actsWithChaptersFiltered.map(({ act, chapters: actChapters }) => (
                    <section key={act.item.id} className="space-y-5 pt-6 first:pt-0 border-t border-dark-200 dark:border-dark-600 first:border-t-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-dark-500 dark:text-dark-400">Акт</span>
                        <DebouncedField
                          value={act.item.title}
                          onSave={(title) => updateOutlineMutation.mutate({ id: act.item.id, data: { title } })}
                          placeholder="Название акта"
                          className="text-lg font-bold text-dark-900 dark:text-white bg-transparent border-0 border-b border-transparent hover:border-dark-300 focus:border-primary-500 focus:outline-none focus:ring-0 rounded px-1 -mx-1 min-w-[160px] placeholder:text-dark-400 dark:placeholder:text-dark-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddChapterToAct(act.item.id)}
                          disabled={createChapterMutation.isPending || createOutlineMutation.isPending}
                          className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dark-300 dark:border-dark-500 text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 hover:border-primary-400 transition-colors"
                        >
                          {createChapterMutation.isPending || createOutlineMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Новая глава
                        </button>
                      </div>
                      {actChapters.map((node) => {
                        const ch = node.chapter;
                        // В режиме Написание используем актуальный кэш (без deferred), чтобы новая сцена появлялась сразу
                        const beats = (beatsByChapterId[ch.id] ?? []).filter((b) => showHidden || b.enabled !== false);
                        return (
                          <div key={ch.id} className="ml-5 pl-5 space-y-4 border-l-2 border-dark-200 dark:border-dark-600">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-dark-500 dark:text-dark-400 tabular-nums">Глава {ch.chapter_number}</span>
                              <DebouncedField
                                value={ch.title}
                                onSave={(title) => updateChapterMutation.mutate({ id: ch.id, data: { title } })}
                                placeholder="Название главы"
                                className="font-semibold text-dark-900 dark:text-white bg-transparent border-0 border-b border-transparent hover:border-dark-300 focus:border-primary-500 focus:outline-none focus:ring-0 rounded px-1 -mx-1 flex-1 min-w-[140px] placeholder:text-dark-400 dark:placeholder:text-dark-500"
                              />
                              <button
                                type="button"
                                onClick={() => createBeatMutation.mutate(ch.id)}
                                disabled={createBeatMutation.isPending}
                                className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dark-300 dark:border-dark-500 text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 hover:border-primary-400 transition-colors"
                              >
                                {createBeatMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Новая сцена
                              </button>
                            </div>
                            {/* Текст главы — можно писать без сцен */}
                            <div className="rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700/40 overflow-hidden shadow-sm">
                              <div className="px-3 py-1.5 border-b border-dark-100 dark:border-dark-600 text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                Текст главы
                              </div>
                              <div className="px-4 py-4 min-h-[180px]">
                                <ContentWithInlineComments
                                  ref={(r) => { if (r) chapterContentInsertRefs.current[ch.id] = r; else delete chapterContentInsertRefs.current[ch.id]; }}
                                  content={ch.content ?? ''}
                                  onSave={(content) => updateChapterMutation.mutate({ id: ch.id, data: { content } })}
                                  showCommentBlocks={true}
                                  placeholder="Начните писать. Сцены не обязательны. Нажмите / для команд."
                                  className="w-full text-sm min-h-[160px] leading-relaxed"
                                  onSlashCommand={(target) => setSlashMenu({ anchor: target, chapterId: ch.id, beatId: null })}
                                />
                              </div>
                            </div>
                            {beats.length > 0 && (
                            <div className="text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider mt-3">Сцены (опционально)</div>
                            )}
                            {beats.map((beat) => (
                              <div key={beat.id} className="rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700/40 overflow-hidden shadow-sm">
                                <div className="px-3 py-2 border-b border-dark-100 dark:border-dark-600 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Сцена</span>
                                  <DebouncedField
                                    value={beat.title}
                                    onSave={(title) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { title } })}
                                    placeholder="Название сцены"
                                    className="flex-1 min-w-[140px] text-sm font-medium bg-transparent border-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { enabled: beat.enabled === false } })}
                                    className="p-1 rounded hover:bg-dark-100"
                                    title={beat.enabled !== false ? 'Скрыть из контекста' : 'Показать'}
                                  >
                                    {beat.enabled !== false ? <Eye size={14} className="text-dark-500" /> : <EyeOff size={14} className="text-amber-600" />}
                                  </button>
                                  <button type="button" onClick={() => confirm('Удалить сцену?') && deleteBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id })} className="p-1 rounded hover:bg-red-100 text-red-500">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <div className="px-3 py-2 min-h-[120px]">
                                  <ContentWithInlineComments
                                    ref={(r) => { if (r) beatInsertRefs.current[beat.id] = r; else delete beatInsertRefs.current[beat.id]; }}
                                    content={beat.content ?? ''}
                                    onSave={(content) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { content } })}
                                    showCommentBlocks={true}
                                    placeholder="Начните писать или введите / для команд…"
                                    className="w-full text-sm min-h-[100px]"
                                    onSlashCommand={(target) => setSlashMenu({ anchor: target, chapterId: ch.id, beatId: beat.id })}
                                  />
                                </div>
                                <div className="px-3 py-2 border-t border-dark-100 dark:border-dark-600 flex justify-end bg-dark-50/50 dark:bg-dark-800/30">
                                  <button
                                    type="button"
                                    onClick={() => createBeatMutation.mutate(ch.id)}
                                    disabled={createBeatMutation.isPending}
                                    className="text-xs text-dark-500 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 transition-colors"
                                  >
                                    <Plus size={12} />
                                    Новая сцена
                                  </button>
                                </div>
                              </div>
                            ))}
                            {beats.length === 0 ? (
                              <div className="pt-3 mt-1 border-t border-dark-100 dark:border-dark-600">
                                <button
                                  type="button"
                                  onClick={() => createBeatMutation.mutate(ch.id)}
                                  disabled={createBeatMutation.isPending}
                                  className="text-xs text-dark-500 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 transition-colors"
                                >
                                  <Plus size={12} />
                                  Добавить сцену (разбить главу на сцены)
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </section>
                  ))}
                  {chaptersOrphanFiltered.length > 0 && (
                    <section className="space-y-4 pt-6 mt-6 border-t border-dark-200 dark:border-dark-600">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-dark-500 dark:text-dark-400">Без раздела</div>
                      {chaptersOrphanFiltered.map((ch) => {
                        const beats = (beatsByChapterId[ch.id] ?? []).filter((b) => showHidden || b.enabled !== false);
                        return (
                          <div key={ch.id} className="ml-5 pl-5 space-y-4 border-l-2 border-amber-500/50 dark:border-amber-500/30">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-dark-500 dark:text-dark-400 tabular-nums">Глава {ch.chapter_number}</span>
                              <DebouncedField value={ch.title} onSave={(title) => updateChapterMutation.mutate({ id: ch.id, data: { title } })} placeholder="Название главы" className="font-semibold text-dark-900 dark:text-white bg-transparent border-0 border-b border-transparent hover:border-dark-300 focus:border-primary-500 focus:outline-none focus:ring-0 rounded px-1 -mx-1 flex-1 min-w-[140px] placeholder:text-dark-400 dark:placeholder:text-dark-500" />
                              <button type="button" onClick={() => createBeatMutation.mutate(ch.id)} disabled={createBeatMutation.isPending} className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dark-300 dark:border-dark-500 text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 hover:border-primary-400 transition-colors">
                                <Plus size={12} /> Новая сцена
                              </button>
                            </div>
                            <div className="rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700/40 overflow-hidden shadow-sm">
                              <div className="px-3 py-1.5 border-b border-dark-100 dark:border-dark-600 text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Текст главы</div>
                              <div className="px-4 py-4 min-h-[180px]">
                                <ContentWithInlineComments
                                  ref={(r) => { if (r) chapterContentInsertRefs.current[ch.id] = r; else delete chapterContentInsertRefs.current[ch.id]; }}
                                  content={ch.content ?? ''}
                                  onSave={(content) => updateChapterMutation.mutate({ id: ch.id, data: { content } })}
                                  showCommentBlocks={true}
                                  placeholder="Начните писать. Введите / для команд."
                                  className="w-full text-sm min-h-[120px]"
                                  onSlashCommand={(target) => setSlashMenu({ anchor: target, chapterId: ch.id, beatId: null })}
                                />
                              </div>
                            </div>
                            {beats.length > 0 && <div className="text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider mt-3">Сцены (опционально)</div>}
                            {beats.map((beat) => (
                              <div key={beat.id} className="rounded-xl border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700/40 overflow-hidden shadow-sm">
                                <div className="px-3 py-2 border-b border-dark-100 dark:border-dark-600 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">Сцена</span>
                                  <DebouncedField value={beat.title} onSave={(title) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { title } })} placeholder="Название сцены" className="flex-1 min-w-[140px] text-sm font-medium bg-transparent border-0" />
                                  <button type="button" onClick={() => confirm('Удалить сцену?') && deleteBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id })} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                                </div>
                                <div className="px-4 py-3 min-h-[120px]">
                                  <ContentWithInlineComments
                                    ref={(r) => { if (r) beatInsertRefs.current[beat.id] = r; else delete beatInsertRefs.current[beat.id]; }}
                                    content={beat.content ?? ''}
                                    onSave={(content) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { content } })}
                                    showCommentBlocks={true}
                                    placeholder="Начните писать или введите / для команд…"
                                    className="w-full text-sm min-h-[100px]"
                                    onSlashCommand={(target) => setSlashMenu({ anchor: target, chapterId: ch.id, beatId: beat.id })}
                                  />
                                </div>
                              </div>
                            ))}
                            {beats.length === 0 ? (
                              <div className="pt-3 mt-1 border-t border-dark-100 dark:border-dark-600">
                                <button type="button" onClick={() => createBeatMutation.mutate(ch.id)} disabled={createBeatMutation.isPending} className="text-xs text-dark-500 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 transition-colors">
                                  <Plus size={12} /> Добавить сцену (разбить на сцены)
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </section>
                  )}
                  {slashMenu && (
                    <SlashCommandMenu
                      open={!!slashMenu}
                      anchorEl={slashMenu.anchor}
                      onClose={() => setSlashMenu(null)}
                      commands={[
                        {
                          id: 'new-scene',
                          label: 'Новая сцена',
                          description: 'Добавить сцену в текущую главу',
                          category: 'Структура',
                          icon: <Plus size={16} />,
                          onSelect: () => createBeatMutation.mutate(slashMenu.chapterId),
                        },
                        ...(slashMenu.beatId != null
                          ? [{
                              id: 'continue',
                              label: 'Продолжить писание',
                              description: 'Продолжить текст сцены с помощью ИИ',
                              category: 'ИИ',
                              icon: <Brain size={16} />,
                              onSelect: () => {
                                const beat = (beatsByChapterIdDeferred[slashMenu.chapterId] ?? []).find((b) => b.id === slashMenu.beatId);
                                if (beat) handleGenerateBeat(beat, slashMenu.chapterId);
                              },
                            }]
                          : []),
                        {
                          id: 'comment',
                          label: 'Комментарий для ИИ',
                          description: 'Вставить %% … %% — видно только ИИ',
                          category: 'Форматирование',
                          icon: <MessageSquare size={16} />,
                          onSelect: () => {
                            if (slashMenu.beatId != null) beatInsertRefs.current[slashMenu.beatId]?.insertAtCursor('%% %%');
                            else chapterContentInsertRefs.current[slashMenu.chapterId]?.insertAtCursor('%% %%');
                          },
                        },
                      ]}
                    />
                  )}
                  <div className="pt-8 mt-6 border-t border-dark-200 dark:border-dark-600 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleAddAct}
                      disabled={createOutlineMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-dark-300 dark:border-dark-500 text-dark-600 dark:text-dark-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors text-sm font-medium"
                    >
                      {createOutlineMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Новый акт
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : viewMode === 'canvas' ? (
            /* Полотно: виртуализированный поток акт → глава → бит → текст */
            canvasRowCount === 0 ? (
              <div className="flex justify-center py-8 text-dark-500">
                <p>
                  {actsWithChapters.length > 0 || chaptersOrphan.length > 0
                    ? 'Все блоки скрыты. Включите «Показать скрытое».'
                    : 'Нет актов и глав. Добавьте структуру в плане (Outline).'}
                </p>
              </div>
            ) : (
            <div className="max-w-4xl" style={{ height: `${canvasVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
              {canvasVirtualizer.getVirtualItems().map((virtualRow) => {
                const idx = virtualRow.index;
                const isOrphanRow = idx === actsWithChaptersFiltered.length;
                return (
                  <div
                    key={virtualRow.key}
                    ref={canvasVirtualizer.measureElement}
                    data-index={idx}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: idx < canvasRowCount - 1 ? 12 : 0,
                    }}
                  >
                    {isOrphanRow ? (
                      /* Блок «Без раздела» */
                      <div className="space-y-2 pt-2 border-t border-dark-200">
                        <div className="text-xs font-medium text-dark-500 px-1">Без раздела</div>
                        {chaptersOrphanFiltered.map((ch) => (
                          <div
                            key={ch.id}
                            id={`canvas-chapter-${ch.id}`}
                            className={`space-y-2 ml-2 transition-shadow ${highlightCanvasBlock?.type === 'chapter' && highlightCanvasBlock?.id === ch.id ? 'ring-2 ring-primary-500 ring-offset-2 rounded-lg' : ''}`}
                          >
                            {canvasShowChapters && (
                              <div className="rounded-lg border border-dark-200 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2">
                                <span className="text-xs font-medium text-dark-500 mr-2">Глава {ch.chapter_number}</span>
                                <DebouncedField
                                  value={ch.title}
                                  onSave={(title) => updateChapterMutation.mutate({ id: ch.id, data: { title } })}
                                  className="font-medium text-dark-800 dark:text-dark-200"
                                />
                              </div>
                            )}
                            {(beatsByChapterIdDeferred[ch.id] ?? []).filter((b) => showHidden || b.enabled !== false).map((beat) => (
                              <div key={beat.id} className="space-y-1 ml-2">
                                {canvasShowBeats && (
                                  <div className="rounded-lg border border-dark-200 bg-white dark:bg-dark-700/50 px-2 py-1.5 flex flex-wrap gap-2 items-start">
                                    <span className="text-xs font-medium text-dark-500 uppercase">Scene beat</span>
                                    <DebouncedField
                                      value={beat.title}
                                      onSave={(title) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { title } })}
                                      placeholder="Название сцены"
                                      className="flex-1 min-w-[120px] text-sm font-medium"
                                    />
                                    <DebouncedField
                                      as="textarea"
                                      value={beat.description ?? ''}
                                      onSave={(description) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { description } })}
                                      placeholder="Описание сцены"
                                      className="text-xs text-dark-600 dark:text-dark-400 w-full"
                                    />
                                  </div>
                                )}
                                <div className="rounded-lg border border-dark-200 bg-white dark:bg-dark-700 min-h-[80px] px-2 py-2">
                                  <ContentWithInlineComments
                                    content={beat.content ?? ''}
                                    onSave={(content) => updateBeatMutation.mutate({ chapterId: ch.id, beatId: beat.id, data: { content } })}
                                    showCommentBlocks={canvasShowAuthorComments}
                                    placeholder="Текст сцены. %% комментарий для ИИ %%"
                                    className="w-full text-sm"
                                  />
                                  <div className="text-xs text-dark-400 px-1 pt-0.5">Комментарии только для ИИ: <code className="bg-dark-100 dark:bg-dark-700 px-1 rounded">%% ваш текст %%</code></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (() => {
                      const { act, chapters: actChapters } = actsWithChaptersFiltered[idx];
                      return (
                <div
                  key={act.item.id}
                  id={`canvas-act-${act.item.id}`}
                  className={`space-y-2 transition-shadow ${highlightCanvasBlock?.type === 'act' && highlightCanvasBlock?.id === act.item.id ? 'ring-2 ring-primary-500 ring-offset-2 rounded-lg' : ''}`}
                >
                  {canvasShowActs && (
                    <div
                      className={`rounded-lg border-2 px-3 py-2 flex items-center gap-2 flex-wrap ${act.item.enabled !== false ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20' : 'opacity-60 border-amber-500/70 bg-amber-50/30 dark:bg-amber-900/10'}`}
                      style={act.item.enabled === false ? { borderStyle: 'solid' } : undefined}
                    >
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Акт</span>
                      <DebouncedField
                        value={act.item.title}
                        onSave={(title) => updateOutlineMutation.mutate({ id: act.item.id, data: { title } })}
                        className="font-semibold text-indigo-800 dark:text-indigo-200 flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => updateOutlineMutation.mutate({ id: act.item.id, data: { enabled: act.item.enabled !== false ? false : true } })}
                        className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700/50 shrink-0"
                        title={act.item.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
                      >
                        {act.item.enabled !== false ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                      </button>
                      {act.item.enabled === false && <span className="text-xs text-amber-600">Выключен</span>}
                    </div>
                  )}
                  {actChapters.map((node) => (
                    <div
                      key={node.chapter.id}
                      id={`canvas-chapter-${node.chapter.id}`}
                      className={`space-y-2 ml-2 transition-shadow ${highlightCanvasBlock?.type === 'chapter' && highlightCanvasBlock?.id === node.chapter.id ? 'ring-2 ring-primary-500 ring-offset-2 rounded-lg' : ''}`}
                    >
                      {canvasShowChapters && (
                        <div className="rounded-lg border border-dark-200 bg-dark-50 dark:bg-dark-800/50 px-3 py-2">
                          <span className="text-xs font-medium text-dark-500 mr-2">Глава {node.chapter.chapter_number}</span>
                          <DebouncedField
                            value={node.chapter.title}
                            onSave={(title) => updateChapterMutation.mutate({ id: node.chapter.id, data: { title } })}
                            className="font-medium text-dark-800 dark:text-dark-200"
                          />
                        </div>
                      )}
                      {(beatsByChapterIdDeferred[node.chapter.id] ?? []).filter((b) => showHidden || b.enabled !== false).map((beat) => (
                        <div key={beat.id} className="space-y-1 ml-2">
                          {canvasShowBeats && (
                            <div className="rounded-lg border border-dark-200 bg-white dark:bg-dark-700/50 px-2 py-1.5 flex flex-wrap gap-2 items-start">
                              <span className="text-xs font-medium text-dark-500 uppercase">Scene beat</span>
                              <DebouncedField
                                value={beat.title}
                                onSave={(title) => updateBeatMutation.mutate({ chapterId: node.chapter.id, beatId: beat.id, data: { title } })}
                                placeholder="Название сцены"
                                className="flex-1 min-w-[120px] text-sm font-medium"
                              />
                              <DebouncedField
                                as="textarea"
                                value={beat.description ?? ''}
                                onSave={(description) => updateBeatMutation.mutate({ chapterId: node.chapter.id, beatId: beat.id, data: { description } })}
                                placeholder="Описание сцены"
                                className="text-xs text-dark-600 dark:text-dark-400 w-full"
                              />
                            </div>
                          )}
                          <div className="rounded-lg border border-dark-200 bg-white dark:bg-dark-700 min-h-[80px] px-2 py-2">
                            <ContentWithInlineComments
                              content={beat.content ?? ''}
                              onSave={(content) => updateBeatMutation.mutate({ chapterId: node.chapter.id, beatId: beat.id, data: { content } })}
                              showCommentBlocks={canvasShowAuthorComments}
                              placeholder="Текст сцены. %% комментарий для ИИ %%"
                              className="w-full text-sm"
                            />
                            <div className="text-xs text-dark-400 px-1 pt-0.5">Комментарии только для ИИ: <code className="bg-dark-100 dark:bg-dark-700 px-1 rounded">%% ваш текст %%</code></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            )
          ) : (
            <div className="space-y-4">
              {structureFlatList.length === 0 ? (
                <div className="flex justify-center py-8 text-dark-500">
                  <div className="text-center">
                    <ListOrdered size={48} className="mx-auto mb-2 opacity-50" />
                    <p>
                      {actsWithChapters.length > 0 || chaptersOrphan.length > 0
                        ? 'Все блоки скрыты. Включите «Показать скрытое».'
                        : 'Нет актов и глав. Добавьте структуру в плане (Outline).'}
                    </p>
                  </div>
                </div>
              ) : (
            <>
              {structureFlatList.map((item) => {
                if (item.type === 'act') {
                  const actEnabled = item.act.item.enabled !== false;
                  return (
                    <div
                      key={`act-${item.act.item.id}`}
                      id={`structure-act-${item.act.item.id}`}
                      className={`rounded-xl border overflow-hidden transition-shadow ${actEnabled ? 'border-dark-200 bg-dark-50/50 dark:bg-dark-800/30' : 'opacity-60 border-amber-500/70 bg-amber-50/20 dark:bg-amber-900/10'} ${highlightStructureBlock?.type === 'act' && highlightStructureBlock?.id === item.act.item.id ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
                      style={!actEnabled ? { borderWidth: '1px', borderStyle: 'solid' } : undefined}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => toggleAct(item.act.item.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-dark-100 dark:hover:bg-dark-700/50"
                        >
                          {expandedActs.has(item.act.item.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          <Theater size={20} />
                          Акт: {item.act.item.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOutlineMutation.mutate({ id: item.act.item.id, data: { enabled: !actEnabled } })}
                          className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700/50"
                          title={actEnabled ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
                        >
                          {actEnabled ? <Eye size={18} className="text-dark-500" /> : <EyeOff size={18} className="text-amber-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnalyzeAct(item.act.item.id)}
                          disabled={isAnalyzing}
                          className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700/50 text-primary-600 dark:text-primary-400"
                          title="Анализ ИИ акта"
                        >
                          {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
                        </button>
                        {!actEnabled && <span className="text-xs text-amber-600 pr-2">Выключен</span>}
                      </div>
                    </div>
                  );
                }
                if (item.type === 'chapter') {
                  if (!expandedActs.has(item.actId!)) return null;
                  const node = item.node;
                  return (
                    <div
                      key={node.chapter.id}
                      id={`structure-chapter-${node.chapter.id}`}
                      className={`transition-shadow rounded-lg ${highlightStructureBlock?.type === 'chapter' && highlightStructureBlock?.id === node.chapter.id ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
                    >
                      <ChapterBlock
                        key={node.chapter.id}
                        chapter={node.chapter}
                        beats={(beatsByChapterIdDeferred[node.chapter.id] ?? []).filter((b) => showHidden || b.enabled !== false)}
                        isBeatsLoading={beatsQueries[chapterIds.indexOf(node.chapter.id)]?.isLoading}
                        isSelected={selectedChapterId === node.chapter.id}
                        onSelectChapter={() => setSelectedChapterId(node.chapter.id)}
                        onToggleChapter={toggleChapter}
                        expandedChapters={expandedChapters}
                        collapsedBeats={collapsedBeats}
                        toggleBeatCollapse={toggleBeatCollapse}
                        editingBeat={editingBeat}
                        setEditingBeat={setEditingBeat}
                        updateBeatMutation={(args) => updateBeatMutation.mutate(args)}
                        deleteBeatMutation={(args) => deleteBeatMutation.mutate(args)}
                        createBeatMutation={(chapterId) => createBeatMutation.mutate(chapterId)}
                        createFirstBeatFromChapterContent={createFirstBeatFromChapterContent}
                        beatWords={beatWords}
                        setBeatWords={setBeatWords}
                        handleGenerateBeat={handleGenerateBeat}
                        handleGenerateBeatDescription={handleGenerateBeatDescription}
                        handleClearBeat={handleClearBeat}
                        generatingBeatId={generatingBeatId}
                        generatingDescriptionBeatId={generatingDescriptionBeatId}
                        streamingBase={streamingBase}
                        streamingChunk={streamingChunk}
                        draggedBeatId={draggedBeatId}
                        draggedBeatChapterId={draggedBeatChapterId}
                        dropTargetChapterId={dropTargetChapterId}
                        dropTargetIndex={dropTargetIndex}
                        setDropTargetChapterId={setDropTargetChapterId}
                        setDropTargetIndex={setDropTargetIndex}
                        handleBeatDragStart={handleBeatDragStart}
                        handleBeatDragOver={handleBeatDragOver}
                        handleBeatDragEnd={handleBeatDragEnd}
                        handleDropAt={handleDropAt}
                          bookData={bookData}
                          createBeatPending={createBeatMutation.isPending}
                          onAnalyzeChapter={handleAnalyzeChapter}
                          onAnalyzeBeat={handleAnalyzeBeat}
                          isAnalyzingChapter={isAnalyzing}
                          isAnalyzingBeatId={analyzingBeatId}
                        actList={actListForChapters}
                        currentActId={item.actId ?? null}
                        outlineItemId={item.node.item.id}
                        onActChange={handleChapterActChange}
                        onToggleChapterEnabled={(chapterId, enabled) => updateChapterMutation.mutate({ id: chapterId, data: { enabled } })}
                      />
                    </div>
                  );
                }
                if (item.type === 'orphan-header') {
                  return (
                    <div key="orphan-header" className="rounded-xl border border-dark-200 bg-amber-50/30 dark:bg-amber-900/10 overflow-hidden">
                      <div className="px-4 py-3 font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200">
                        Без раздела
                      </div>
                      <div className="p-2 space-y-3">
                        {chaptersOrphanFiltered.map((ch) => (
                          <div
                            key={ch.id}
                            id={`structure-chapter-${ch.id}`}
                            className={`transition-shadow rounded-lg ${highlightStructureBlock?.type === 'chapter' && highlightStructureBlock?.id === ch.id ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
                          >
                            <ChapterBlock
                              key={ch.id}
                              chapter={ch}
                              beats={(beatsByChapterIdDeferred[ch.id] ?? []).filter((b) => showHidden || b.enabled !== false)}
                              isBeatsLoading={beatsQueries[chapterIds.indexOf(ch.id)]?.isLoading}
                              isSelected={selectedChapterId === ch.id}
                              onSelectChapter={() => setSelectedChapterId(ch.id)}
                              onToggleChapter={toggleChapter}
                              expandedChapters={expandedChapters}
                              collapsedBeats={collapsedBeats}
                              toggleBeatCollapse={toggleBeatCollapse}
                              editingBeat={editingBeat}
                              setEditingBeat={setEditingBeat}
                              updateBeatMutation={(args) => updateBeatMutation.mutate(args)}
                              deleteBeatMutation={(args) => deleteBeatMutation.mutate(args)}
                              createBeatMutation={(chapterId) => createBeatMutation.mutate(chapterId)}
                              createFirstBeatFromChapterContent={createFirstBeatFromChapterContent}
                              beatWords={beatWords}
                              setBeatWords={setBeatWords}
                              handleGenerateBeat={handleGenerateBeat}
                              handleGenerateBeatDescription={handleGenerateBeatDescription}
                              handleClearBeat={handleClearBeat}
                              generatingBeatId={generatingBeatId}
                              generatingDescriptionBeatId={generatingDescriptionBeatId}
                              streamingBase={streamingBase}
                              streamingChunk={streamingChunk}
                              draggedBeatId={draggedBeatId}
                              draggedBeatChapterId={draggedBeatChapterId}
                              dropTargetChapterId={dropTargetChapterId}
                              dropTargetIndex={dropTargetIndex}
                              setDropTargetChapterId={setDropTargetChapterId}
                              setDropTargetIndex={setDropTargetIndex}
                              handleBeatDragStart={handleBeatDragStart}
                              handleBeatDragOver={handleBeatDragOver}
                              handleBeatDragEnd={handleBeatDragEnd}
                              handleDropAt={handleDropAt}
                              bookData={bookData}
                              createBeatPending={createBeatMutation.isPending}
                              onAnalyzeChapter={handleAnalyzeChapter}
                              onAnalyzeBeat={handleAnalyzeBeat}
                              isAnalyzingChapter={isAnalyzing}
                              isAnalyzingBeatId={analyzingBeatId}
                              actList={actListForChapters}
                              currentActId={null}
                              outlineItemId={null}
                              onActChange={handleChapterActChange}
                              onToggleChapterEnabled={(chapterId, enabled) => updateChapterMutation.mutate({ id: chapterId, data: { enabled } })}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (item.type === 'orphan-chapter') return null;
                return null;
              })}
            </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модалка AI анализа книги / акта / главы / сцены */}
      {(isAnalyzing || aiAnalysis) && (
        <AICriticPanel
          analysis={aiAnalysis}
          onClose={() => setAiAnalysis(null)}
          isLoading={isAnalyzing}
          universeId={uId}
        />
      )}

      {/* Модалка предпросмотра книги */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-xl flex flex-col max-w-4xl w-full max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-dark-200">
              <h2 className="text-lg font-semibold text-dark-800 dark:text-dark-200 flex items-center gap-2">
                <FileText size={20} />
                Предпросмотр книги
              </h2>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap font-sans text-sm text-dark-800 dark:text-dark-200 leading-relaxed">
                {previewText || 'Нет текста.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
