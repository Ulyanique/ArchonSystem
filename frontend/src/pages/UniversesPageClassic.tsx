import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { universesApi, exportApi, uploadsUrl } from '../api';
import { Universe } from '../types';
import { Globe, Plus, Trash2, Edit2, Download, Bot, Users, BookOpen, MapPin } from 'lucide-react';
import { validateUniverse } from '../utils/validation';

export default function UniversesPageClassic() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmUniverseId, setDeleteConfirmUniverseId] = useState<number | null>(null);

  const { data: universes = [], isLoading } = useQuery({
    queryKey: ['universes'],
    queryFn: universesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: universesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      queryClient.invalidateQueries({ queryKey: ['universes'] }); // для обратной совместимости
      setShowCreateModal(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Неизвестная ошибка';
      console.error('Ошибка создания вселенной:', error);
      toast.error('Ошибка: ' + errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: universesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      queryClient.invalidateQueries({ queryKey: ['universes'] }); // для обратной совместимости
      setDeleteConfirmUniverseId(null);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Неизвестная ошибка';
      console.error('Ошибка удаления:', error);
      toast.error('Ошибка: ' + errorMessage);
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      genre: formData.get('genre') as string,
      universe_type: (formData.get('universe_type') as string) || undefined,
      direction: (formData.get('direction') as string) || undefined,
    };
    
    const validation = validateUniverse(data);
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        toast.error(error.message);
      });
      return;
    }
    
    createMutation.mutate(data);
  };

  const handleExport = (universeId: number, title: string) => {
    const url = exportApi.markdown(universeId, {
      include_characters: true,
      include_locations: true,
      include_chapters: true,
      include_notes: true,
      include_timeline: true,
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUniverseTypeColor = (type?: string) => {
    if (!type) return 'bg-gray-100 text-gray-700';
    const colors: Record<string, string> = {
      'Фэнтези': 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200',
      'Научная фантастика': 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white shadow-lg shadow-blue-200',
      'Реализм': 'bg-gradient-to-r from-gray-400 to-slate-500 text-white shadow-lg',
      'Мистика': 'bg-gradient-to-r from-purple-400 to-pink-500 text-white shadow-lg shadow-purple-200',
      'Другое': 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-dark-800 mb-2">Мои вселенные</h1>
          <p className="text-dark-500 text-sm">Управляйте своими вселенными и создавайте новые миры</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
        >
          <Plus size={20} />
          Новая вселенная
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Загрузка...</div>
      ) : universes.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary-100 via-primary-200 to-primary-300 mb-6 animate-pulse">
            <Globe size={64} className="text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-dark-800 mb-2">Создайте свою первую вселенную</h2>
          <p className="text-dark-500 mb-6 max-w-md mx-auto">
            Начните создавать уникальные миры, наполненные персонажами, локациями и захватывающими историями
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary shadow-lg hover:shadow-xl transition-shadow text-lg px-6 py-3"
          >
            <Plus size={20} className="inline mr-2" />
            Создать первую вселенную
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {universes.map((universe: Universe, index: number) => (
            <div
              key={universe.id}
              className="card group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-200 border-2 border-transparent transition-all duration-300 cursor-pointer animate-fadeIn"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/universes/${universe.id}`)}
            >
              {/* Обложка сверху */}
              <div className="w-full h-48 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center relative overflow-hidden group/cover">
                {universe.cover_image_path ? (
                  <>
                    <img
                      src={uploadsUrl(universe.cover_image_path) || ''}
                      alt={universe.title}
                      className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-200 via-primary-300 to-primary-400 animate-pulse">
                    <Globe size={64} className="text-primary-600 relative z-10" />
                  </div>
                )}
              </div>

              {/* Контент под обложкой */}
              <div className="p-5">
                <h3 className="text-3xl font-bold text-dark-800 line-clamp-1 mb-3">{universe.title}</h3>
                
                {/* Бейджи: тип вселенной и жанр */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {universe.universe_type && (
                    <span className={`inline-block px-3 py-1.5 text-sm rounded-lg font-semibold ${getUniverseTypeColor(universe.universe_type)}`}>
                      {universe.universe_type}
                    </span>
                  )}
                  {universe.genre && (
                    <span className="inline-block px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium">
                      {universe.genre}
                    </span>
                  )}
                </div>

                {/* Описание */}
                <p className="text-dark-500 text-sm line-clamp-2 mb-4 leading-relaxed">{universe.description}</p>
                
                {/* Статистика */}
                <div className="flex items-center gap-4 text-sm text-dark-600 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-blue-500" />
                    <span className="font-medium">{universe.characters_count ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={14} className="text-amber-500" />
                    <span className="font-medium">{universe.chapters_count ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-green-500" />
                    <span className="font-medium">{universe.locations_count ?? '—'}</span>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex justify-end gap-2 pt-3 border-t border-dark-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/universes/${universe.id}/chat`);
                    }}
                    className="p-1.5 hover:bg-primary-100 hover:scale-110 rounded transition-all duration-200"
                    title="Терминал связи"
                  >
                    <Bot size={16} className="text-primary-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(universe.id, universe.title);
                    }}
                    className="p-1.5 hover:bg-primary-100 hover:scale-110 rounded transition-all duration-200"
                    title="Экспорт в Markdown"
                  >
                    <Download size={16} className="text-primary-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/universes/${universe.id}`);
                    }}
                    className="p-1.5 hover:bg-dark-100 hover:scale-110 rounded transition-all duration-200"
                    title="Редактировать"
                  >
                    <Edit2 size={16} className="text-dark-500" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmUniverseId(universe.id);
                    }}
                    className="p-1.5 hover:bg-red-100 hover:scale-110 rounded transition-all duration-200"
                    title="Удалить"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Новая вселенная</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Название
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  className="input"
                  placeholder="Введите название вселенной"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Жанр
                </label>
                <input
                  name="genre"
                  type="text"
                  className="input"
                  placeholder="Фэнтези, Романтика и т.д."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Тип вселенной
                </label>
                <select
                  name="universe_type"
                  className="input"
                >
                  <option value="">Не выбран</option>
                  <option value="Фэнтези">Фэнтези</option>
                  <option value="Научная фантастика">Научная фантастика</option>
                  <option value="Реализм">Реализм</option>
                  <option value="Мистика">Мистика</option>
                  <option value="Другое">Другое</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Описание
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="input"
                  placeholder="Краткое описание вселенной"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Направление / премиса
                </label>
                <textarea
                  name="direction"
                  rows={2}
                  className="input"
                  placeholder="Идея, направление сюжета для ИИ"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmUniverseId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-dark-800 mb-2">Удалить вселенную?</h3>
            <p className="text-dark-600 text-sm mb-4">
              Вселенная «{universes.find(u => u.id === deleteConfirmUniverseId)?.title}» и все связанные данные будут удалены.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirmUniverseId(null)} className="btn btn-secondary">Отмена</button>
              <button
                onClick={() => { deleteMutation.mutate(deleteConfirmUniverseId); }}
                className="btn bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
