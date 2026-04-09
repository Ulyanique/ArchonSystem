import { useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { outlineApi, universesApi, chaptersApi } from '../api';
import { ListOrdered, Plus, Trash2, Edit2, Sparkles, Eye, EyeOff, Theater, BookOpen, ExternalLink } from 'lucide-react';
import { OutlineItem } from '../types';
import EmptyState from '../components/EmptyState';

type GeneratedItem = { title: string; summary: string; outline_type: string; sort_order: number };

export default function OutlinePage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OutlineItem | null>(null);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateDirection, setGenerateDirection] = useState('');
  const [numChapters, setNumChapters] = useState(12);
  const [showDisabled, setShowDisabled] = useState(false);

  const { data: book } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['outline', universeId],
    queryFn: () => outlineApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => chaptersApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => outlineApi.create(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      outlineApi.update(parseInt(universeId!), id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => outlineApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (items: GeneratedItem[]) => outlineApi.apply(parseInt(universeId!), items, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      setGeneratedItems(null);
    },
    onError: (err: any) => toast.error('Ошибка: ' + (err.response?.data?.detail || err.message)),
  });

  const handleGenerate = async () => {
    if (!universeId) return;
    setIsGenerating(true);
    setGeneratedItems(null);
    try {
      const res = await outlineApi.generate(parseInt(universeId), {
        direction: generateDirection || undefined,
        genre: book?.genre,
        num_chapters: numChapters,
      });
      setGeneratedItems(res.items || []);
    } catch (e: any) {
      toast.error('Ошибка генерации: ' + (e.response?.data?.detail || e.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      summary: (formData.get('summary') as string) || '',
      outline_type: (formData.get('outline_type') as string) || 'chapter',
      sort_order: parseInt((formData.get('sort_order') as string) || '0', 10),
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      act: 'Акт',
      chapter: 'Глава',
      beat: 'Сцена',
    };
    return labels[type] || type;
  };

  const toggleEnabled = (item: OutlineItem) => {
    const current = item.enabled ?? false;
    const newEnabled = !current;
    updateMutation.mutate({ id: item.id, data: { enabled: newEnabled } });
  };

  const displayedItems = showDisabled ? items : items.filter((o: OutlineItem) => o.enabled === true);

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark-800">План вселенной</h2>
          <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-dark-300" />
            Показать отключённые
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Добавить пункт
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={20} />
            {isGenerating ? 'Генерация...' : 'Сгенерировать план'}
          </button>
        </div>
      </div>

      {book && (
        <div className="card p-4 mb-6">
          <p className="text-sm text-dark-600 mb-2">Направление вселенной (для генерации плана):</p>
          <textarea
            value={generateDirection !== '' ? generateDirection : (book.direction ?? '')}
            onChange={(e) => setGenerateDirection(e.target.value)}
            placeholder="Идея, премиса, направление сюжета..."
            className="input mb-2"
            rows={2}
          />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-dark-600">Число глав:</label>
              <input
                type="number"
                min={3}
                max={50}
                value={numChapters}
                onChange={(e) => setNumChapters(parseInt(e.target.value, 10) || 12)}
                className="input w-20"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const dir = generateDirection !== '' ? generateDirection : (book.direction ?? '');
                universesApi.update(parseInt(universeId!), { direction: dir }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ['universe', universeId] });
                });
              }}
              className="btn btn-secondary text-sm"
            >
              Сохранить направление в вселенную
            </button>
          </div>
        </div>
      )}

      {generatedItems && generatedItems.length > 0 && (
        <div className="card p-4 mb-6 border-2 border-primary-200">
          <h3 className="font-bold text-dark-800 mb-2">Сгенерированный план — применить?</h3>
          <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {generatedItems.map((item, i) => {
              const isAct = item.outline_type === 'act';
              const isChapter = item.outline_type === 'chapter';
              const labelColorClass = isAct 
                ? 'text-indigo-600 font-semibold' 
                : isChapter 
                  ? 'text-amber-600 font-semibold' 
                  : 'text-dark-400';
              return (
                <li key={i} className="text-sm flex items-start gap-2">
                  {isAct && <Theater size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />}
                  {isChapter && <BookOpen size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <span className={labelColorClass}>[{getTypeLabel(item.outline_type)}]</span>{' '}
                    <span className="font-semibold text-dark-900 dark:text-dark-100" style={{ color: 'var(--color-accent)' }}>
                      {item.title}
                    </span>
                    {item.summary && <span className="text-dark-800 dark:text-dark-200 block mt-1 ml-4">{item.summary.slice(0, 80)}...</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button onClick={() => applyMutation.mutate(generatedItems)} className="btn btn-primary" disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Применяю...' : 'Применить план'}
            </button>
            <button onClick={() => setGeneratedItems(null)} className="btn btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      {displayedItems.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={items.length === 0 ? 'План пока пуст' : 'Нет включённых пунктов. Включите «Показать отключённые».'}
          description={items.length === 0 ? 'Добавьте пункты или сгенерируйте план по направлению.' : undefined}
          actionLabel="Добавить пункт"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item: OutlineItem, _index: number) => {
            const isAct = item.outline_type === 'act';
            const isChapter = item.outline_type === 'chapter';
            
            // Визуальные стили для актов и глав - различие через размер и стиль, а не цвет заголовка
            const cardBorderClass = isAct 
              ? 'border-l-4 border-indigo-500' 
              : isChapter 
                ? 'border-l-4 border-amber-500' 
                : '';
            const cardBgClass = isAct 
              ? 'bg-indigo-50/30' 
              : isChapter 
                ? 'bg-amber-50/30' 
                : '';
            const labelColorClass = isAct 
              ? 'text-indigo-600 font-semibold' 
              : isChapter 
                ? 'text-amber-600 font-semibold' 
                : 'text-dark-400';
            // Заголовок использует акцентный цвет из настроек через CSS переменную
            const titleSizeClass = isAct 
              ? 'text-xl font-bold' 
              : isChapter 
                ? 'text-lg font-semibold' 
                : 'text-base font-medium';
            
            return (
            <div
              key={item.id}
              className={`card p-4 flex justify-between items-start gap-4 ${cardBgClass} ${cardBorderClass} ${item.enabled === false ? 'opacity-50 grayscale' : ''}`}
              style={item.enabled === false ? { borderColor: '#f59e0b', borderWidth: '1px', borderStyle: 'solid' } : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isAct && <Theater size={18} className="text-indigo-600 flex-shrink-0" />}
                  {isChapter && <BookOpen size={18} className="text-amber-600 flex-shrink-0" />}
                  <span className={`text-xs font-semibold ${labelColorClass}`}>[{getTypeLabel(item.outline_type)}]</span>
                  <span className={`${titleSizeClass} font-bold`} style={{ color: 'var(--color-accent)' }}>
                    {item.title}
                  </span>
                </div>
                {item.enabled === false && <span className="ml-2 text-xs text-amber-600">Выключен</span>}
                {item.summary && (
                  <p className="mt-1 text-sm line-clamp-2 text-dark-900 dark:text-dark-100">
                    {item.summary}
                  </p>
                )}
                {item.chapter_id != null && (
                  <Link
                    to={`/universes/${universeId}/chapters`}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                  >
                    <ExternalLink size={12} />
                    {(() => {
                      const ch = chapters.find((c: { id: number }) => c.id === item.chapter_id);
                      return ch ? `Глава ${ch.chapter_number ?? ''}: ${ch.title}` : 'Глава';
                    })()}
                  </Link>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleEnabled(item)}
                  className="btn btn-secondary p-2"
                  title={item.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}
                >
                  {item.enabled !== false ? <Eye size={18} /> : <EyeOff size={18} className="text-amber-600" />}
                </button>
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setShowModal(true);
                  }}
                  className="btn btn-secondary p-2"
                  title="Редактировать"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => window.confirm('Удалить пункт?') && deleteMutation.mutate(item.id)}
                  className="btn btn-secondary p-2 text-red-600 hover:bg-red-50"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">
                {editingItem ? 'Редактировать пункт' : 'Новый пункт плана'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Тип</label>
                  <select
                    name="outline_type"
                    defaultValue={editingItem?.outline_type || 'chapter'}
                    className="input"
                  >
                    <option value="act">Акт</option>
                    <option value="chapter">Глава</option>
                    <option value="beat">Сцена</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Заголовок *</label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingItem?.title}
                    className="input"
                    placeholder="Название главы или сцены"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Краткое описание</label>
                  <textarea
                    name="summary"
                    rows={3}
                    defaultValue={editingItem?.summary}
                    className="input"
                    placeholder="О чём эта часть"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Порядок</label>
                  <input
                    name="sort_order"
                    type="number"
                    min={0}
                    defaultValue={editingItem?.sort_order ?? items.length}
                    className="input"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Сохранить' : 'Добавить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
