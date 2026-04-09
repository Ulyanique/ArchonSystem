import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { chaptersApi, aiCriticApi, outlineApi, coverageApi, storylinesApi } from '../api';
import { BookOpen, Plus, Trash2, Edit2, Brain, PenLine, Eye, EyeOff, Lightbulb, ListOrdered, Layers } from 'lucide-react';
import { Chapter } from '../types';
import AICriticPanel from '../components/AICriticPanel';
import EmptyState from '../components/EmptyState';
import { validateChapter } from '../utils/validation';

export default function ChaptersPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [writingChapter, setWritingChapter] = useState<Chapter | null>(null);
  const [writingMode, setWritingMode] = useState<'from_summary' | 'continue'>('from_summary');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsChapterId, setSuggestionsChapterId] = useState<number | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const filterStorylineId = useMemo(() => {
    const s = searchParams.get('storyline');
    if (s == null || s === '') return undefined;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? undefined : n;
  }, [searchParams]);

  const uId = parseInt(universeId!);

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', universeId],
    queryFn: () => storylinesApi.getAll(uId),
    enabled: !!universeId,
  });

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['chapters', universeId, filterStorylineId],
    queryFn: () => chaptersApi.getAll(uId, filterStorylineId),
    enabled: !!universeId,
  });

  const { data: outlineItems = [] } = useQuery({
    queryKey: ['outline', universeId],
    queryFn: () => outlineApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: coverageStats } = useQuery({
    queryKey: ['coverage', universeId],
    queryFn: () => coverageApi.getStats(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => chaptersApi.create(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      setShowModal(false);
      setEditingChapter(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      chaptersApi.update(parseInt(universeId!), id, data),
    onSuccess: (updatedChapter, variables) => {
      // Обновляем кэш оптимистично - используем данные с сервера если есть, иначе данные из variables
      queryClient.setQueryData(['chapters', universeId], (old: Chapter[] | undefined) => {
        if (!old) return old;
        return old.map(ch => {
          if (ch.id === variables.id) {
            // Приоритет: данные с сервера > данные из variables > старые данные
            const updated = updatedChapter || { ...ch, ...variables.data };
            // Явно устанавливаем enabled из variables.data если оно было передано
            if ('enabled' in variables.data) {
              updated.enabled = variables.data.enabled;
            }
            return updated;
          }
          return ch;
        });
      });
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      setShowModal(false);
      setEditingChapter(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chaptersApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const storylineIdRaw = formData.get('storyline_id');
    const storylineId = storylineIdRaw === '' || storylineIdRaw === null ? null : parseInt(String(storylineIdRaw), 10);
    const data: Record<string, unknown> = {
      title: formData.get('title') as string,
      chapter_number: parseInt(formData.get('chapter_number') as string) || chapters.length + 1,
      content: formData.get('content') as string,
      summary: formData.get('summary') as string,
      notes: formData.get('notes') as string,
      storyline_id: Number.isNaN(storylineId) ? null : storylineId,
      storyline_order: parseInt(formData.get('storyline_order') as string, 10) || 0,
    };

    const validation = validateChapter(data);
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        toast.error(error.message);
      });
      return;
    }

    if (editingChapter) {
      updateMutation.mutate({ id: editingChapter.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAnalyze = async (chapter: Chapter) => {
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeChapter(parseInt(universeId!), chapter.id);
      setAiAnalysis(result);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error('Ошибка анализа: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetSuggestions = async (chapter: Chapter) => {
    setIsLoadingSuggestions(true);
    setSuggestionsChapterId(chapter.id);
    try {
      const result = await chaptersApi.getSuggestions(parseInt(universeId!), chapter.id);
      setSuggestions(result);
    } catch (error: any) {
      console.error('AI suggestions error:', error);
      toast.error('Ошибка получения подсказок: ' + (error.response?.data?.detail || error.message));
      setSuggestions(null);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const startWrite = async (chapter: Chapter, mode: 'from_summary' | 'continue') => {
    if (!universeId) return;
    setWritingChapter(chapter);
    setWritingMode(mode);
    setGeneratedContent('');
    setWriteError(null);
    setIsWriting(true);
    try {
      for await (const chunk of chaptersApi.writeStream(parseInt(universeId), chapter.id, { mode })) {
        setGeneratedContent((prev) => prev + chunk);
      }
    } catch (e: any) {
      const msg = e?.message || 'Ошибка генерации';
      setWriteError(msg);
      toast.error(`${msg}. Попробуйте повторить.`);
    } finally {
      setIsWriting(false);
    }
  };

  const applyGeneratedContent = () => {
    if (!writingChapter || !universeId) return;
    updateMutation.mutate({
      id: writingChapter.id,
      data: { content: generatedContent },
    });
    setWritingChapter(null);
    setGeneratedContent('');
  };

  const openEdit = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setShowModal(true);
  };

  const toggleEnabled = (chapter: Chapter) => {
    const current = chapter.enabled ?? false;
    const newEnabled = !current;
    updateMutation.mutate(
      { id: chapter.id, data: { enabled: newEnabled } },
      {
        onSuccess: () => {
          toast.success(newEnabled ? 'Глава включена в контекст ИИ' : 'Глава выключена из контекста ИИ');
        },
        onError: (error: any) => {
          toast.error('Ошибка обновения: ' + (error?.message || 'Не удалось обновить'));
        },
      }
    );
  };

  const displayedChapters = showDisabled
    ? chapters
    : chapters.filter((ch: Chapter) => ch.enabled === true);

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <div className="h-8 w-48 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
          <div className="h-10 w-32 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-24 bg-dark-200 dark:bg-dark-600 rounded mb-2" />
              <div className="h-6 w-2/3 bg-dark-200 dark:bg-dark-600 rounded mb-3" />
              <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-full mb-2" />
              <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-dark-800">Главы</h2>
          <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-dark-300" />
            Показать отключённые
          </label>
        </div>
        <button
          onClick={() => {
            setEditingChapter(null);
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Добавить
        </button>
      </div>

      {storylines.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-dark-500">Сюжетная линия:</span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterStorylineId == null ? 'bg-primary-600 text-white' : 'bg-dark-200 text-dark-700 hover:bg-dark-300'}`}
          >
            Все
          </button>
          {storylines.map((sl) => (
            <button
              key={sl.id}
              type="button"
              onClick={() => setSearchParams({ storyline: String(sl.id) })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${filterStorylineId === sl.id ? 'bg-primary-600 text-white' : 'bg-dark-200 text-dark-700 hover:bg-dark-300'}`}
            >
              <Layers size={14} />
              {sl.title}
            </button>
          ))}
          <Link to={`/universes/${universeId}/storylines`} className="text-sm text-primary-600 hover:underline ml-2">
            Управление линиями
          </Link>
        </div>
      )}

      {displayedChapters.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={chapters.length === 0 ? 'Пока нет глав' : 'Нет включённых глав. Включите «Показать отключённые».'}
          actionLabel="Добавить главу"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {displayedChapters.map((chapter: Chapter) => (
            <div 
              key={chapter.id} 
              className={`card ${chapter.enabled === false ? 'opacity-50 grayscale' : ''}`}
              style={chapter.enabled === false ? { borderColor: '#f59e0b', borderWidth: '1px', borderStyle: 'solid' } : {}}
            >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-primary-600 font-medium">
                      Глава {chapter.chapter_number}
                      {chapter.storyline_id != null && (
                        <> · {storylines.find((s) => s.id === chapter.storyline_id)?.title ?? 'Линия'}</>
                      )}
                    </span>
                    <h3 className="text-lg font-semibold text-dark-800">{chapter.title}</h3>
                    {chapter.enabled === false && <span className="text-xs text-amber-600">Выключена</span>}
                    {outlineItems.filter((o: { chapter_id?: number | null }) => o.chapter_id === chapter.id).length > 0 && (
                      <Link
                        to={`/universes/${universeId}/outline`}
                        className="inline-flex items-center gap-1 text-xs text-dark-500 hover:text-primary-600"
                      >
                        <ListOrdered size={12} />
                        План: {outlineItems.filter((o: { chapter_id?: number | null }) => o.chapter_id === chapter.id).map((o: { title: string }) => o.title).join(', ')}
                      </Link>
                    )}
                  </div>
                </div>
                {coverageStats?.chapters?.find((cc: { id: number }) => cc.id === chapter.id)?.mentions?.length > 0 && (
                  <div className="mb-2 text-xs text-dark-500">
                    <Link to={`/universes/${universeId}/coverage`} className="hover:text-primary-600">
                      Упоминания: {coverageStats.chapters.find((cc: { id: number }) => cc.id === chapter.id).mentions.length} сущностей
                    </Link>
                  </div>
                )}
                <div className="flex gap-2">
                    <button type="button" onClick={() => toggleEnabled(chapter)} className="p-1 hover:bg-dark-100 rounded" title={chapter.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}>
                      {chapter.enabled !== false ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                    </button>
                    <button
                      onClick={() => startWrite(chapter, 'from_summary')}
                      className="p-1 hover:bg-primary-100 rounded"
                      title="Написать по описанию"
                    >
                      <PenLine size={16} className="text-primary-600" />
                    </button>
                    <button
                      onClick={() => startWrite(chapter, 'continue')}
                      className="p-1 hover:bg-primary-100 rounded text-xs"
                      title="Продолжить историю"
                    >
                      Продолжить
                    </button>
                    <button
                      onClick={() => handleGetSuggestions(chapter)}
                      className="p-1 hover:bg-primary-100 rounded"
                      title="Подсказки ИИ"
                      disabled={isLoadingSuggestions && suggestionsChapterId === chapter.id}
                    >
                      <Lightbulb size={16} className="text-primary-600" />
                    </button>
                    <button
                      onClick={() => handleAnalyze(chapter)}
                      className="p-1 hover:bg-primary-100 rounded"
                      title="AI анализ"
                    >
                      <Brain size={16} className="text-primary-600" />
                    </button>
                    <button
                      onClick={() => openEdit(chapter)}
                      className="p-1 hover:bg-dark-100 rounded"
                    >
                      <Edit2 size={16} className="text-dark-500" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Удалить главу?')) {
                          deleteMutation.mutate(chapter.id);
                        }
                      }}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingChapter ? 'Редактировать главу' : 'Новая глава'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Название *
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingChapter?.title}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Номер главы
                  </label>
                  <input
                    name="chapter_number"
                    type="number"
                    defaultValue={editingChapter?.chapter_number || chapters.length + 1}
                    className="input"
                  />
                </div>
              </div>
              {storylines.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 mb-1">
                      Сюжетная линия
                    </label>
                    <select
                      name="storyline_id"
                      className="input w-full"
                      defaultValue={editingChapter?.storyline_id ?? filterStorylineId ?? ''}
                    >
                      <option value="">— Без линии —</option>
                      {storylines.map((sl) => (
                        <option key={sl.id} value={sl.id}>
                          {sl.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 mb-1">
                      Порядок в линии
                    </label>
                    <input
                      name="storyline_order"
                      type="number"
                      min={0}
                      defaultValue={editingChapter?.storyline_order ?? (chapters.length + 1)}
                      className="input"
                    />
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Краткое содержание
                </label>
                <textarea
                  name="summary"
                  rows={2}
                  defaultValue={editingChapter?.summary}
                  className="input"
                  placeholder="О чём эта глава?"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Содержание
                </label>
                <textarea
                  name="content"
                  rows={10}
                  defaultValue={editingChapter?.content}
                  className="input font-mono text-sm"
                  placeholder="Текст главы..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Заметки
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingChapter?.notes}
                  className="input"
                  placeholder="Заметки для себя..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingChapter(null);
                  }}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending 
                    ? 'Сохранение...' 
                    : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Write Chapter Panel */}
      {writingChapter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">
                {writingMode === 'from_summary' ? 'Написать по описанию' : 'Продолжить историю'}: {writingChapter.title}
              </h3>
              <button onClick={() => { setWritingChapter(null); setGeneratedContent(''); setWriteError(null); }} className="text-dark-500 hover:text-dark-700">×</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {writeError && <p className="text-red-600 mb-2">{writeError}</p>}
              <textarea
                readOnly
                value={generatedContent}
                className="input font-mono text-sm w-full min-h-[300px]"
                placeholder={isWriting ? 'ИИ печатает...' : ''}
              />
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              {!isWriting && (
                <>
                  <button onClick={() => setWritingChapter(null)} className="btn btn-secondary">Отклонить</button>
                  <button onClick={() => startWrite(writingChapter, writingMode)} className="btn btn-secondary">Повторить</button>
                  <button onClick={applyGeneratedContent} className="btn btn-primary" disabled={!generatedContent.trim()}>Сохранить в главу</button>
                </>
              )}
              {isWriting && <span className="text-sm text-dark-500">Генерация...</span>}
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestions Panel */}
      {suggestions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <Lightbulb size={20} className="text-primary-600" />
                Подсказки ИИ для главы: {chapters.find(ch => ch.id === suggestionsChapterId)?.title}
              </h3>
              <button 
                onClick={() => { setSuggestions(null); setSuggestionsChapterId(null); }} 
                className="text-dark-500 hover:text-dark-700"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {isLoadingSuggestions ? (
                <div className="text-center py-8">Загрузка подсказок...</div>
              ) : suggestions.error ? (
                <div className="text-red-600">{suggestions.error}</div>
              ) : (
                <div className="space-y-4">
                  {suggestions.characters && suggestions.characters.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-800 mb-2">Персонажи</h4>
                      <ul className="list-disc list-inside space-y-1 text-dark-600">
                        {suggestions.characters.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suggestions.locations && suggestions.locations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-800 mb-2">Локации</h4>
                      <ul className="list-disc list-inside space-y-1 text-dark-600">
                        {suggestions.locations.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suggestions.events && suggestions.events.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-800 mb-2">События</h4>
                      <ul className="list-disc list-inside space-y-1 text-dark-600">
                        {suggestions.events.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suggestions.style_tips && suggestions.style_tips.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-800 mb-2">Советы по стилю</h4>
                      <ul className="list-disc list-inside space-y-1 text-dark-600">
                        {suggestions.style_tips.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suggestions.plot_ideas && suggestions.plot_ideas.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark-800 mb-2">Идеи для сюжета</h4>
                      <ul className="list-disc list-inside space-y-1 text-dark-600">
                        {suggestions.plot_ideas.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suggestions.warnings && suggestions.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <h4 className="font-semibold text-amber-800 mb-2">Предупреждения</h4>
                      <ul className="list-disc list-inside space-y-1 text-amber-700">
                        {suggestions.warnings.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => { setSuggestions(null); setSuggestionsChapterId(null); }} className="btn btn-secondary">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Critic Panel */}
      {(isAnalyzing || aiAnalysis) && (
        <AICriticPanel
          analysis={aiAnalysis}
          isLoading={isAnalyzing}
          universeId={parseInt(universeId!)}
          onClose={() => setAiAnalysis(null)}
        />
      )}
    </div>
  );
}
