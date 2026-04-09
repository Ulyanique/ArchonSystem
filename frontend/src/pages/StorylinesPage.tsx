import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storylinesApi, charactersApi } from '../api';
import { Layers, Plus, Trash2, Edit2, X } from 'lucide-react';
import type { Storyline, StorylineCreate } from '../types';
import EmptyState from '../components/EmptyState';

export default function StorylinesPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const uId = parseInt(universeId!);
  const [showModal, setShowModal] = useState(false);
  const [editingStoryline, setEditingStoryline] = useState<Storyline | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formMainCharacterId, setFormMainCharacterId] = useState<number | ''>('');

  const { data: storylines = [], isLoading } = useQuery({
    queryKey: ['storylines', universeId],
    queryFn: () => storylinesApi.getAll(uId),
    enabled: !!universeId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(uId),
    enabled: !!universeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: StorylineCreate) => storylinesApi.create(uId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storylines', universeId] });
      setShowModal(false);
      setEditingStoryline(null);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StorylineCreate> }) =>
      storylinesApi.update(uId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storylines', universeId] });
      setShowModal(false);
      setEditingStoryline(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => storylinesApi.delete(uId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storylines', universeId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
    },
  });

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormSortOrder(0);
    setFormMainCharacterId('');
  };

  const openCreate = () => {
    setEditingStoryline(null);
    resetForm();
    setFormSortOrder(storylines.length);
    setShowModal(true);
  };

  const openEdit = (sl: Storyline) => {
    setEditingStoryline(sl);
    setFormTitle(sl.title);
    setFormDescription(sl.description || '');
    setFormSortOrder(sl.sort_order);
    setFormMainCharacterId(sl.main_character_id ?? '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Введите название линии');
      return;
    }
    const data: StorylineCreate = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      sort_order: formSortOrder,
      main_character_id: formMainCharacterId === '' ? null : (formMainCharacterId as number),
    };
    if (editingStoryline) {
      updateMutation.mutate({ id: editingStoryline.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm('Удалить сюжетную линию? Главы этой линии станут без линии.')) return;
    deleteMutation.mutate(id);
    toast.success('Линия удалена');
  };

  if (!universeId) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Сюжетные линии</h1>
          <p className="text-dark-500 text-sm mt-1">
            Параллельные сюжеты для глав. Свяжите главы с линией на странице <Link to={`/universes/${universeId}/chapters`} className="text-primary-600 hover:underline">Главы</Link>.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          Добавить линию
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">Загрузка...</div>
      ) : storylines.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Нет сюжетных линий"
          description="Создайте линии (например, по персонажам или аркам), затем на странице «Главы» привяжите главы к линиям."
          actionLabel="Добавить линию"
          onAction={openCreate}
        />
      ) : (
        <ul className="space-y-2">
          {storylines.map((sl) => (
            <li
              key={sl.id}
              className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-dark-100 rounded-xl border border-dark-200 hover:border-dark-300"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-dark-800">{sl.title}</div>
                {sl.description && (
                  <p className="text-sm text-dark-500 mt-0.5 line-clamp-1">{sl.description}</p>
                )}
                {sl.main_character_id != null && (
                  <p className="text-xs text-dark-400 mt-1">
                    Персонаж: {characters.find((c) => c.id === sl.main_character_id)?.name ?? `#${sl.main_character_id}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/universes/${universeId}/chapters?storyline=${sl.id}`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Главы
                </Link>
                <button
                  type="button"
                  onClick={() => openEdit(sl)}
                  className="p-2 text-dark-500 hover:text-dark-800 rounded-lg hover:bg-dark-200"
                  title="Редактировать"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sl.id)}
                  className="p-2 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Удалить"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-100 rounded-3xl shadow-2xl w-full max-w-md animate-zoomIn">
            <div className="p-6 border-b border-dark-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-dark-800">
                {editingStoryline ? 'Редактировать линию' : 'Новая сюжетная линия'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-dark-200 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Название</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="input w-full"
                  placeholder="Например: Линия Алисы"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Описание (необязательно)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="input w-full min-h-[80px]"
                  placeholder="Кратко о линии сюжета"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Порядок отображения</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="input w-full"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Главный персонаж (необязательно)</label>
                <select
                  value={formMainCharacterId === '' ? '' : formMainCharacterId}
                  onChange={(e) => setFormMainCharacterId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="input w-full"
                >
                  <option value="">— Без привязки —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStoryline ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
