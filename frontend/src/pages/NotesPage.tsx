import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi, aiCriticApi, aiGeneratorApi } from '../api';
import { FileText, Plus, Trash2, Edit2, Brain, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Note, AIAnalysis } from '../types';
import AICriticPanel from '../components/AICriticPanel';
import AIGenerateButton, { AIGenerationModal } from '../components/AIGenerateButton';
import EmptyState from '../components/EmptyState';
import { validateNote } from '../utils/validation';

export default function NotesPage() {
  const { universeId, noteId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<{ title: string; content: string; note_type: string }[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({ title: '', content: '', note_type: 'idea' });
  const [autofillLoading, setAutofillLoading] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', universeId],
    queryFn: () => notesApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const isEditorView = noteId !== undefined;
  const isNewNote = noteId === 'new';
  const editingNote: Note | null = isNewNote ? null : (notes.find((n: Note) => n.id === parseInt(noteId!, 10)) ?? null);

  useEffect(() => {
    if (!isEditorView) return;
    if (isNewNote) {
      setFormState({ title: '', content: '', note_type: 'idea' });
      return;
    }
    if (editingNote) {
      setFormState({ title: editingNote.title, content: editingNote.content || '', note_type: editingNote.note_type || 'idea' });
    }
  }, [isEditorView, isNewNote, editingNote?.id, editingNote?.title, editingNote?.content, editingNote?.note_type]);

  const createMutation = useMutation({
    mutationFn: (data: any) => notesApi.create(parseInt(universeId!), data),
    onSuccess: (created: Note) => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      if (created?.id) navigate(`/universes/${universeId}/notes/${created.id}`, { replace: true });
      else navigate(`/universes/${universeId}/notes`, { replace: true });
      toast.success('Заметка создана');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      notesApi.update(parseInt(universeId!), id, data),
    onSuccess: (updatedNote, variables) => {
      queryClient.setQueryData(['notes', universeId], (old: Note[] | undefined) => {
        if (!old) return old;
        return old.map(note =>
          note.id === variables.id ? (updatedNote || { ...note, ...variables.data }) : note
        );
      });
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      toast.success('Заметка сохранена');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notesApi.delete(parseInt(universeId!), id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      if (noteId === String(id)) navigate(`/universes/${universeId}/notes`, { replace: true });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = { title: formState.title, content: formState.content, note_type: formState.note_type };
    const validation = validateNote(data);
    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error.message));
      return;
    }
    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, data });
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

  const goToList = () => navigate(`/universes/${universeId}/notes`);
  const goToEditor = (note: Note | null) => navigate(note ? `/universes/${universeId}/notes/${note.id}` : `/universes/${universeId}/notes/new`);

  const handleAutofillNote = async () => {
    if (!editingNote?.id || !universeId) return;
    setAutofillLoading(true);
    try {
      const result = await notesApi.autofill(parseInt(universeId), editingNote.id);
      setFormState((prev) => ({ ...prev, ...result }));
      toast.success('Содержание заполнено по контексту.');
    } catch (e: any) {
      toast.error('Ошибка автозаполнения: ' + (e?.message || 'Не удалось'));
    } finally {
      setAutofillLoading(false);
    }
  };

  const handleGenerateNotes = async () => {
    const result = await aiGeneratorApi.notes(parseInt(universeId!), undefined, undefined, 6);
    return Array.isArray(result) ? result : [];
  };

  const toNoteData = (n: { title: string; content: string; note_type: string }) => ({
    title: n.title,
    content: n.content || '',
    note_type: n.note_type || 'idea',
  });

  const handleAddSelectedNotes = async (items: { title: string; content: string; note_type: string }[]) => {
    for (const n of items) {
      await notesApi.create(parseInt(universeId!), toNoteData(n));
    }
    queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
    setShowGenerated(false);
    setGeneratedNotes([]);
  };

  const toggleEnabled = (note: Note) => {
    const current = note.enabled ?? false;
    const newEnabled = !current;
    updateMutation.mutate(
      { id: note.id, data: { enabled: newEnabled } },
      {
        onSuccess: () => {
          toast.success(newEnabled ? 'Заметка включена в контекст ИИ' : 'Заметка выключена из контекста ИИ');
        },
        onError: (error: any) => {
          toast.error('Ошибка обновения: ' + (error?.message || 'Не удалось обновить'));
        },
      }
    );
  };

  const displayedNotes = showDisabled
    ? notes
    : notes.filter((n: Note) => n.enabled === true);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      idea: '💡 Идея',
      research: '📚 Исследование',
      draft: '✏️ Черновик',
      avoid: '🚫 Чего избегать',
      other: '📝 Другое',
      technology: '⚙️ Технология',
      event: '📅 Событие',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  // Редактор на отдельной странице
  if (isEditorView) {
    const noteNotFound = !isNewNote && notes.length > 0 && !editingNote;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            to={`/universes/${universeId}/notes`}
            className="inline-flex items-center gap-2 text-dark-600 dark:text-dark-400 hover:text-accent mb-4"
          >
            <ArrowLeft size={20} />
            Назад к списку
          </Link>
        </div>
        {noteNotFound ? (
          <div className="card p-6 text-center">
            <p className="text-dark-500 mb-4">Заметка не найдена</p>
            <Link to={`/universes/${universeId}/notes`} className="btn btn-primary">К списку заметок</Link>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="text-xl font-bold text-dark-800 dark:text-dark-200 mb-4">
              {isNewNote ? 'Новая заметка' : 'Редактировать заметку'}
            </h2>
            {editingNote?.id && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={handleAutofillNote} disabled={autofillLoading} className="btn btn-secondary text-sm">
                  {autofillLoading ? 'Загрузка...' : 'Заполнить по контексту'}
                </button>
                <button type="button" onClick={() => handleAnalyze(editingNote)} className="btn btn-secondary text-sm flex items-center gap-1">
                  <Brain size={16} />
                  AI анализ
                </button>
                <button type="button" onClick={() => confirm('Удалить заметку?') && deleteMutation.mutate(editingNote.id)} className="btn btn-secondary text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={16} />
                  Удалить
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Заголовок *</label>
                  <input name="title" type="text" required value={formState.title} onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Тип</label>
                  <select name="note_type" value={formState.note_type} onChange={(e) => setFormState((s) => ({ ...s, note_type: e.target.value }))} className="input w-full">
                    <option value="idea">💡 Идея</option>
                    <option value="technology">⚙️ Технология</option>
                    <option value="event">📅 Событие</option>
                    <option value="research">📚 Исследование</option>
                    <option value="draft">✏️ Черновик</option>
                    <option value="avoid">🚫 Чего избегать</option>
                    <option value="other">📝 Другое</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Содержание</label>
                <textarea name="content" rows={12} value={formState.content} onChange={(e) => setFormState((s) => ({ ...s, content: e.target.value }))} className="input w-full" />
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

  // Список заметок
  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-dark-800 dark:text-dark-200">Заметки</h2>
          <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-dark-300" />
            Показать отключённые
          </label>
        </div>
        <div className="flex gap-2">
          <AIGenerateButton
            onGenerate={handleGenerateNotes}
            onResult={(result) => {
              setGeneratedNotes(Array.isArray(result) ? result : []);
              setShowGenerated(true);
            }}
            tooltip="Сгенерировать идеи заметок"
            variant="primary"
          />
          <button onClick={() => goToEditor(null)} className="bg-accent text-white hover:brightness-110 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all">
            <Plus size={20} />
            Добавить
          </button>
        </div>
      </div>

      {displayedNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={notes.length === 0 ? 'Пока нет заметок' : 'Нет включённых заметок. Включите «Показать отключённые».'}
          actionLabel="Добавить заметку"
          onAction={() => goToEditor(null)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedNotes.map((note: Note) => (
            <div
              key={note.id}
              className={`card border-accent-dim ${note.enabled === false ? 'opacity-50 grayscale' : ''}`}
              style={note.enabled === false ? { borderColor: 'var(--color-accent-dim)', borderWidth: '1px', borderStyle: 'solid' } : {}}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-accent">{getTypeLabel(note.note_type)}</span>
                  </div>
                  <Link to={`/universes/${universeId}/notes/${note.id}`} className="block">
                    <h3 className="text-lg font-semibold text-dark-800 dark:text-dark-200 truncate hover:text-accent">{note.title}</h3>
                  </Link>
                  {note.enabled === false && <span className="block text-xs text-accent">Выключена</span>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => toggleEnabled(note)} className="p-1 hover:bg-accent-subtle rounded" title={note.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить'} aria-label={note.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}>
                    {note.enabled !== false ? <Eye size={16} className="text-accent" /> : <EyeOff size={16} className="text-accent" />}
                  </button>
                  <button type="button" onClick={() => handleAnalyze(note)} className="p-1 hover:bg-accent-subtle rounded" title="AI анализ" aria-label="AI анализ заметки">
                    <Brain size={16} className="text-accent" />
                  </button>
                  <Link to={`/universes/${universeId}/notes/${note.id}`} className="p-1 hover:bg-accent-subtle rounded inline-flex" title="Редактировать" aria-label="Редактировать заметку">
                    <Edit2 size={16} className="text-dark-500 dark:text-dark-400 hover:text-accent" />
                  </Link>
                  <button type="button" onClick={() => { if (confirm('Удалить заметку?')) deleteMutation.mutate(note.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Удалить" aria-label="Удалить заметку">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              {note.content && (
                <p className="text-sm text-dark-500 line-clamp-3">{note.content}</p>
              )}
            </div>
          ))}
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

      {/* Generated notes modal */}
      {showGenerated && (
        <AIGenerationModal
          results={generatedNotes}
          onClose={() => { setShowGenerated(false); setGeneratedNotes([]); }}
          title="Сгенерированные заметки"
          multiSelect
          onAddSelected={(items) => handleAddSelectedNotes(items as { title: string; content: string; note_type: string }[])}
          renderItem={(item) => {
            const note = item as { title: string; content: string; note_type: string };
            return (
            <div className="card p-4 border-accent-dim">
              <div className="text-xs text-accent mb-1">{getTypeLabel(note.note_type)}</div>
              <h3 className="font-semibold text-dark-800 dark:text-dark-200">{note.title}</h3>
              {note.content && <p className="text-sm text-dark-600 dark:text-dark-400 mt-2 line-clamp-3">{note.content}</p>}
            </div>
            );
          }}
        />
      )}
    </div>
  );
}
