import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi, aiCriticApi } from '../api';
import { FileText, Plus, Trash2, Edit2, Brain, Eye, EyeOff, ScrollText, ArrowLeft } from 'lucide-react';
import { Note, AIAnalysis } from '../types';
import AICriticPanel from '../components/AICriticPanel';
import EmptyState from '../components/EmptyState';
import { validateNote } from '../utils/validation';

const NOTE_TYPE_DRAFT = 'draft';

export default function DraftsPage() {
  const { universeId, draftId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({ title: '', content: '', note_type: NOTE_TYPE_DRAFT });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', universeId],
    queryFn: () => notesApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const drafts = notes.filter((n: Note) => (n.note_type || '').toLowerCase() === NOTE_TYPE_DRAFT);
  const displayedDrafts = showDisabled ? drafts : drafts.filter((n: Note) => n.enabled !== false);

  const isEditorView = draftId !== undefined;
  const isNewDraft = draftId === 'new';
  const editingDraft: Note | null = isNewDraft ? null : (drafts.find((n: Note) => n.id === parseInt(draftId!, 10)) ?? null);

  useEffect(() => {
    if (!isEditorView) return;
    if (isNewDraft) {
      setFormState({ title: '', content: '', note_type: NOTE_TYPE_DRAFT });
      return;
    }
    if (editingDraft) {
      setFormState({ title: editingDraft.title, content: editingDraft.content || '', note_type: NOTE_TYPE_DRAFT });
    }
  }, [isEditorView, isNewDraft, editingDraft?.id, editingDraft?.title, editingDraft?.content]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; note_type: string }) =>
      notesApi.create(parseInt(universeId!), { ...data, note_type: NOTE_TYPE_DRAFT }),
    onSuccess: (created: Note) => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      if (created?.id) navigate(`/universes/${universeId}/drafts/${created.id}`, { replace: true });
      else navigate(`/universes/${universeId}/drafts`, { replace: true });
      toast.success('Черновик создан');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Note> }) =>
      notesApi.update(parseInt(universeId!), id, { ...data, note_type: NOTE_TYPE_DRAFT }),
    onMutate: async ({ id, data }) => {
      const isOnlyEnabled = data && Object.keys(data).length === 1 && 'enabled' in data;
      if (!isOnlyEnabled || universeId == null) return undefined;
      await queryClient.cancelQueries({ queryKey: ['notes', universeId] });
      const prev = queryClient.getQueryData<Note[]>(['notes', universeId]);
      queryClient.setQueryData<Note[]>(['notes', universeId], (old) =>
        old?.map((n) => (n.id === id ? { ...n, enabled: data.enabled } : n)) ?? old ?? []
      );
      return { prev, isOnlyEnabled };
    },
    onError: (err, vars, context) => {
      const wasOnlyEnabled = context && 'isOnlyEnabled' in context && context.isOnlyEnabled;
      if (wasOnlyEnabled) {
        // Не откатываем UI — состояние «скрыт/показан» остаётся. Сервер мог не успеть.
        toast.error(
          'Сервер не успел сохранить. Изменения видны у вас; при обновлении страницы они могут сброситься. Можно нажать ещё раз позже.',
          { duration: 5000 }
        );
        return;
      }
      if (context?.prev != null && universeId != null) {
        queryClient.setQueryData(['notes', universeId], context.prev);
      }
      toast.error('Не удалось обновить черновик');
    },
    onSuccess: (_data, { data }) => {
      const wasOnlyEnabled = data && Object.keys(data).length === 1 && 'enabled' in data;
      if (wasOnlyEnabled) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      toast.success('Черновик сохранён');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notesApi.delete(parseInt(universeId!), id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      if (draftId === String(id)) navigate(`/universes/${universeId}/drafts`, { replace: true });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = { title: formState.title, content: formState.content, note_type: NOTE_TYPE_DRAFT };
    const validation = validateNote(data);
    if (!validation.isValid) {
      validation.errors.forEach((err) => toast.error(err.message));
      return;
    }
    if (editingDraft) {
      updateMutation.mutate({ id: editingDraft.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAnalyze = async (note: Note) => {
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeNote(parseInt(universeId!), note.id);
      setAiAnalysis(result);
    } catch (error: any) {
      toast.error('Ошибка анализа: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const goToList = () => navigate(`/universes/${universeId}/drafts`);
  const goToEditor = (note: Note | null) => navigate(note ? `/universes/${universeId}/drafts/${note.id}` : `/universes/${universeId}/drafts/new`);

  const toggleEnabled = (note: Note) => {
    const newEnabled = !(note.enabled ?? true);
    updateMutation.mutate(
      { id: note.id, data: { enabled: newEnabled } },
      { onSuccess: () => toast.success(newEnabled ? 'Черновик включён в контекст ИИ' : 'Черновик выключен из контекста ИИ') }
    );
  };

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  // Редактор на отдельной странице
  if (isEditorView) {
    const draftNotFound = !isNewDraft && drafts.length > 0 && !editingDraft;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            to={`/universes/${universeId}/drafts`}
            className="inline-flex items-center gap-2 text-dark-600 dark:text-dark-400 hover:text-primary-600 mb-4"
          >
            <ArrowLeft size={20} />
            Назад к списку
          </Link>
        </div>
        {draftNotFound ? (
          <div className="card p-6 text-center">
            <p className="text-dark-500 mb-4">Черновик не найден</p>
            <Link to={`/universes/${universeId}/drafts`} className="btn btn-primary">К списку черновиков</Link>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="text-xl font-bold text-dark-800 dark:text-dark-200 mb-4">
              {isNewDraft ? 'Новый черновик' : 'Редактировать черновик'}
            </h2>
            {editingDraft?.id && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => handleAnalyze(editingDraft)} className="btn btn-secondary text-sm flex items-center gap-1">
                  <Brain size={16} />
                  AI анализ
                </button>
                <Link
                  to={`/universes/${universeId}/book-view?draftId=${editingDraft.id}`}
                  className="btn btn-secondary text-sm inline-flex items-center gap-1"
                >
                  <ScrollText size={16} />
                  Рядом с текстом книги
                </Link>
                <button type="button" onClick={() => confirm('Удалить черновик?') && deleteMutation.mutate(editingDraft.id)} className="btn btn-secondary text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={16} />
                  Удалить
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Заголовок *</label>
                <input
                  name="title"
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
                  className="input w-full"
                  placeholder="Тема или название идеи"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Содержание</label>
                <textarea
                  name="content"
                  rows={14}
                  value={formState.content}
                  onChange={(e) => setFormState((s) => ({ ...s, content: e.target.value }))}
                  className="input w-full"
                  placeholder="Текст черновика — идеи, сцены, заметки. ИИ-помощник в чате будет видеть это и сможет предлагать или критиковать."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={goToList} className="btn btn-secondary">Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Список черновиков
  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-dark-800 dark:text-dark-200 flex items-center gap-2">
            <FileText size={24} className="text-primary-600" />
            Черновики
          </h2>
          <p className="text-sm text-dark-500 mt-1">
            Идеи на любую тему. Они участвуют в контексте чата с ИИ — помощник может предлагать или критиковать идеи из черновиков.
          </p>
          <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-dark-300" />
            Показать отключённые
          </label>
        </div>
        <div className="flex gap-2 items-center">
          <Link to={`/universes/${universeId}/book-view`} className="btn btn-secondary inline-flex items-center gap-2">
            <ScrollText size={18} />
            Вселенная целиком (черновик рядом)
          </Link>
          <button onClick={() => goToEditor(null)} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            Новый черновик
          </button>
        </div>
      </div>

      {displayedDrafts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={drafts.length === 0 ? 'Черновиков пока нет' : 'Нет включённых черновиков. Включите «Показать отключённые».'}
          description={drafts.length === 0 ? 'Создайте черновик на любую тему — он будет участвовать в контексте для ИИ.' : undefined}
          actionLabel="Новый черновик"
          onAction={() => goToEditor(null)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedDrafts.map((note: Note) => (
            <div key={note.id} className={`card border-primary-200 ${note.enabled === false ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/universes/${universeId}/drafts/${note.id}`} className="block">
                    <h3 className="text-lg font-semibold text-dark-800 dark:text-dark-200 truncate hover:text-primary-600">{note.title}</h3>
                  </Link>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => toggleEnabled(note)} className="p-1 hover:bg-dark-100 rounded" title={note.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить'} aria-label={note.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}>
                    {note.enabled !== false ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                  </button>
                  <button type="button" onClick={() => handleAnalyze(note)} className="p-1 hover:bg-primary-100 rounded" title="AI анализ" aria-label="AI анализ черновика">
                    <Brain size={16} className="text-primary-600" />
                  </button>
                  <Link to={`/universes/${universeId}/drafts/${note.id}`} className="p-1 hover:bg-dark-100 rounded inline-flex" title="Редактировать" aria-label="Редактировать черновик">
                    <Edit2 size={16} className="text-dark-500" />
                  </Link>
                  <button type="button" onClick={() => confirm('Удалить черновик?') && deleteMutation.mutate(note.id)} className="p-1 hover:bg-red-100 rounded" title="Удалить черновик" aria-label="Удалить черновик">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <Link to={`/universes/${universeId}/book-view?draftId=${note.id}`} className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                  <ScrollText size={14} />
                  Редактировать рядом с текстом книги
                </Link>
              </div>
              {note.content && <p className="text-sm text-dark-600 dark:text-dark-400 line-clamp-4 whitespace-pre-wrap mt-2">{note.content}</p>}
            </div>
          ))}
        </div>
      )}

      {(isAnalyzing || aiAnalysis) && (
        <AICriticPanel analysis={aiAnalysis} isLoading={isAnalyzing} universeId={parseInt(universeId!)} onClose={() => setAiAnalysis(null)} />
      )}
    </div>
  );
}
