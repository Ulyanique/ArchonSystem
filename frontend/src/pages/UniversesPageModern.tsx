import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { universesApi, uploadsUrl } from '../api';
import { Universe } from '../types';
import { Terminal, LayoutDashboard, Globe, BarChart3, Settings, Search, Bell, Plus, ChevronLeft, ChevronRight, HardDrive, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { validateUniverse } from '../utils/validation';
import { useAppStore } from '../store';

export default function UniversesPageModern() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUniversesPageView: _setUniversesPageView } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmUniverseId, setDeleteConfirmUniverseId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);

  // Обновление времени
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${year}.${month}.${day}.${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: universes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['universes'],
    queryFn: universesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: universesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      setShowCreateModal(false);
      toast.success('Вселенная успешно создана');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Неизвестная ошибка';
      toast.error('Ошибка: ' + errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: universesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      setDeleteConfirmUniverseId(null);
      toast.success('Вселенная удалена');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Неизвестная ошибка';
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

  const getStatus = (universe: Universe) => {
    const count = (universe.characters_count ?? 0) + (universe.chapters_count ?? 0) + (universe.locations_count ?? 0);
    if (count === 0) return { label: 'OFFLINE', color: 'bg-red-500/10 border-red-500/30 text-red-400' };
    if (count < 5) return { label: 'FLUX_DET', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' };
    return { label: 'STABLE', color: 'bg-green-500/10 border-green-500/30 text-green-400' };
  };

  const getFluxCapacity = (universe: Universe) => {
    const count = (universe.characters_count ?? 0) + (universe.chapters_count ?? 0) + (universe.locations_count ?? 0);
    if (count === 0) return 0;
    return Math.min(100, Math.round((count / 20) * 100));
  };

  const getEntropyLevel = (universe: Universe) => {
    const count = (universe.characters_count ?? 0) + (universe.chapters_count ?? 0) + (universe.locations_count ?? 0);
    if (count === 0) return 'N/A';
    return `${(count * 0.001).toFixed(4)}%`;
  };

  const formatId = (id: number) => {
    return id.toString(16).toUpperCase().padStart(4, '0') + "-XRT-7";
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 360;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="font-display bg-v3-bg-dark text-white w-full h-full overflow-x-hidden selection:bg-v3-primary/30" style={{
      backgroundImage: `
        linear-gradient(rgba(244, 140, 37, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(244, 140, 37, 0.03) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px'
    }}>
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-v3-primary/20 bg-v3-bg-dark/80 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Terminal className="text-v3-primary text-3xl" />
            <h1 className="text-xl font-bold tracking-widest glow-text-v3 uppercase">
              Archon Terminal <span className="text-v3-primary/60 font-light">v2.0</span>
            </h1>
          </div>
          <div className="h-8 w-px bg-v3-primary/20 mx-2"></div>
          <div className="hidden lg:flex gap-8 text-[10px] uppercase tracking-widest font-bold text-white/60">
            <button onClick={() => navigate('/universes')} className="text-v3-primary flex items-center gap-1 hover:text-v3-primary transition-colors">
              <Globe size={14} />
              Вселенные
            </button>
            <button onClick={() => navigate('/universes/classic')} className="hover:text-v3-primary transition-colors flex items-center gap-1">
              <LayoutDashboard size={14} />
              Классический вид
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-v3-primary/50 text-xl" size={20} />
            <input
              className="bg-v3-primary/5 border border-v3-primary/20 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-v3-primary focus:border-v3-primary outline-none w-64 placeholder:text-v3-primary/30 font-mono"
              placeholder="ПОИСК_ВСЕЛЕННОЙ..."
              type="text"
            />
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full border border-v3-primary/20 flex items-center justify-center hover:bg-v3-primary/10 transition-colors">
              <Bell className="text-v3-primary/80" size={20} />
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-v3-primary overflow-hidden p-0.5">
              <div className="w-full h-full bg-gradient-to-br from-v3-primary to-orange-200 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-v3-primary text-[10px] font-bold tracking-[0.2em] uppercase">
              <span className="w-2 h-2 rounded-full bg-v3-primary animate-pulse"></span>
              Система онлайн // Пользователь: ARCHON_ADMIN
            </div>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-white leading-none">
              УПРАВЛЕНИЕ <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-v3-primary to-orange-200">ВСЕЛЕННЫМИ</span>
            </h2>
          </div>
          {/* Holographic Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="hologram-btn group relative w-32 h-32 rounded-full bg-v3-primary/20 border-2 border-v3-primary flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 rounded-full bg-v3-primary/10 animate-ping opacity-20"></div>
            <Plus className="text-5xl text-v3-primary group-hover:rotate-90 transition-transform duration-500" size={48} />
            <span className="text-[10px] font-bold tracking-widest text-v3-primary/80 mt-1 uppercase">Создать</span>
          </button>
        </div>

        {/* Carousel Section */}
        <div className="relative group">
          <div ref={carouselRef} className="flex overflow-x-auto gap-8 pb-12 pt-4 px-2 custom-scrollbar-v3">
            {error ? (
              <div className="min-w-[340px] text-center py-12 text-red-400/90">
                <p className="uppercase tracking-widest mb-2">Ошибка загрузки</p>
                <p className="text-sm opacity-80 mb-4">{(error as Error)?.message || 'Не удалось загрузить список вселенных'}</p>
                <button type="button" onClick={() => refetch()} className="px-4 py-2 border border-v3-primary/50 rounded text-v3-primary hover:bg-v3-primary/10">
                  Повторить
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex gap-8 pb-12 pt-4 px-2 min-w-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[340px] rounded-xl border border-v3-primary/20 bg-v3-bg-dark/40 p-6 animate-pulse">
                    <div className="h-32 bg-v3-primary/10 rounded-lg mb-4" />
                    <div className="h-6 bg-v3-primary/20 rounded w-3/4 mb-3" />
                    <div className="h-4 bg-v3-primary/10 rounded w-full mb-2" />
                    <div className="h-4 bg-v3-primary/10 rounded w-5/6" />
                  </div>
                ))}
              </div>
            ) : universes.length === 0 ? (
              <div className="min-w-[340px]">
                <EmptyState
                  variant="onDark"
                  icon={Globe}
                  title="Вселенные не обнаружены"
                  description="Нажмите «Создать» для инициализации нового мира"
                  actionLabel="Создать"
                  onAction={() => setShowCreateModal(true)}
                />
              </div>
            ) : (
              universes.map((universe: Universe) => {
                const status = getStatus(universe);
                const fluxCapacity = getFluxCapacity(universe);
                const entropyLevel = getEntropyLevel(universe);
                const coverUrl = universe.cover_image_path ? uploadsUrl(universe.cover_image_path) : null;
                const isOffline = (universe.characters_count ?? 0) + (universe.chapters_count ?? 0) + (universe.locations_count ?? 0) === 0;
                
                return (
                  <div
                    key={universe.id}
                    className={`card-3d min-w-[340px] bg-v3-bg-dark/60 border border-v3-primary/20 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group/card ${isOffline ? 'opacity-70' : ''}`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-40 group-hover/card:opacity-100 transition-opacity flex flex-col gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/universes/${universe.id}`);
                        }}
                        className="text-v3-primary hover:scale-110 transition-transform"
                        title="Управление"
                      >
                        <HardDrive size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmUniverseId(universe.id);
                        }}
                        className="text-red-500/70 hover:scale-110 transition-transform"
                        title="Удалить"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/universes/${universe.id}/settings`);
                        }}
                        className="text-blue-400/70 hover:scale-110 transition-transform"
                        title="Настройки"
                      >
                        <Settings size={20} />
                      </button>
                    </div>
                    <div className="wireframe-sphere w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={universe.title}
                          className="w-full h-full object-cover rounded-full opacity-60 grayscale group-hover/card:grayscale-0 transition-all duration-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Globe className="text-v3-primary/40 text-7xl animate-pulse" size={56} />
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="max-w-[200px]">
                          <p className="text-[10px] text-v3-primary/60 font-mono tracking-widest uppercase">ID: {formatId(universe.id)}</p>
                          <h3 className="text-2xl font-bold tracking-tight truncate">{universe.title.toUpperCase()}</h3>
                        </div>
                        <span className={`px-2 py-0.5 ${status.color} text-[10px] font-bold rounded uppercase tracking-wider`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-v3-primary/10">
                        <div className="space-y-1">
                          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Наполненность</p>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isOffline ? 'bg-red-400' : fluxCapacity < 50 ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-v3-primary shadow-[0_0_8px_#f48c25]'}`}
                              style={{ width: `${fluxCapacity}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Энтропия</p>
                          <p className={`text-xs font-mono ${isOffline ? 'text-red-400' : fluxCapacity < 50 ? 'text-yellow-400' : 'text-v3-primary'}`}>
                            {entropyLevel}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/universes/${universe.id}`)}
                        className={`w-full mt-4 py-2.5 border ${isOffline ? 'border-v3-primary/50 bg-v3-primary/10' : 'border-v3-primary/30 bg-v3-primary/5'} hover:bg-v3-primary hover:text-v3-bg-dark transition-all rounded font-bold text-[10px] tracking-[0.2em] uppercase`}
                      >
                        Войти в терминал
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Carousel Nav */}
          <button
            onClick={() => scrollCarousel('left')}
            className="absolute -left-6 top-1/2 -translate-y-1/2 bg-v3-primary/10 border border-v3-primary/30 p-3 rounded-full hover:bg-v3-primary/20 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="text-v3-primary" size={20} />
          </button>
          <button
            onClick={() => scrollCarousel('right')}
            className="absolute -right-6 top-1/2 -translate-y-1/2 bg-v3-primary/10 border border-v3-primary/30 p-3 rounded-full hover:bg-v3-primary/20 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="text-v3-primary" size={20} />
          </button>
        </div>

        {/* System Readouts */}
        <section className="mt-20 border-t border-v3-primary/20 pt-10 pb-20">
          <h2 className="text-xl font-bold tracking-[0.3em] mb-8 flex items-center gap-3 uppercase">
            <BarChart3 className="text-v3-primary" size={24} />
            Статус системы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-v3-primary/5 border-l-2 border-v3-primary p-4 rounded-r-lg">
              <p className="text-[10px] text-v3-primary/60 font-mono mb-1 uppercase tracking-widest font-bold">Синхронизация</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">14.2</span>
                <span className="text-xs text-v3-primary/80 pb-1 font-mono">ms</span>
                <div className="flex-1 flex justify-end gap-1 pb-1">
                  <div className="w-1 h-3 bg-accent/30"></div>
                  <div className="w-1 h-4 bg-accent/30"></div>
                  <div className="w-1 h-2 bg-accent"></div>
                  <div className="w-1 h-5 bg-accent/30"></div>
                </div>
              </div>
            </div>
            <div className="bg-v3-primary/5 border-l-2 border-v3-primary p-4 rounded-r-lg">
              <p className="text-[10px] text-v3-primary/60 font-mono mb-1 uppercase tracking-widest font-bold">Uptime симуляции</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">99.98</span>
                <span className="text-xs text-accent pb-1">%</span>
              </div>
            </div>
            <div className="bg-v3-primary/5 border-l-2 border-v3-primary p-4 rounded-r-lg">
              <p className="text-[10px] text-v3-primary/60 font-mono mb-1 uppercase tracking-widest font-bold">Матрица памяти</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">4,102</span>
                <span className="text-xs text-v3-primary/80 pb-1 font-mono">PETA</span>
              </div>
            </div>
            <div className="bg-v3-primary/5 border-l-2 border-v3-primary p-4 rounded-r-lg">
              <p className="text-[10px] text-v3-primary/60 font-mono mb-1 uppercase tracking-widest font-bold">Активные узлы</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-green-400">{universes.length}</span>
                <span className="text-xs text-v3-primary/80 pb-1 font-mono">NODES</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Stats Overlay */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-v3-bg-dark/90 backdrop-blur border-t border-v3-primary/30 flex items-center justify-between px-8 text-[10px] font-mono text-v3-primary/60 z-50">
        <div className="flex gap-6">
          <span>TERMINAL_ID: ARCHON_X24</span>
          <span className="hidden sm:inline">LOC: SECTOR_7G</span>
          <span>TS: {currentTime}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            SYSTEM_STABLE
          </span>
          <span className="hidden md:inline">ENCRYPTION: AES_TERMINAL_256</span>
        </div>
      </footer>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-v3-bg-dark border-2 border-v3-primary w-full max-w-lg rounded-xl">
            <div className="border-b-2 border-v3-primary bg-v3-bg-dark px-4 py-3 flex items-center justify-between rounded-t-xl">
              <div className="text-v3-primary font-bold font-display text-xs uppercase tracking-widest">Инициализация вселенной</div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-2xl flex-shrink-0"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-v3-primary text-[10px] mb-1.5 font-bold uppercase tracking-widest">Название</label>
                <input
                  name="title"
                  type="text"
                  required
                  className="w-full bg-v3-bg-dark border border-v3-primary/30 text-white px-3 py-2 focus:outline-none focus:border-v3-primary font-display text-sm rounded shadow-inner"
                  placeholder="Введите название"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-v3-primary text-[10px] mb-1.5 font-bold uppercase tracking-widest">Жанр</label>
                  <input
                    name="genre"
                    type="text"
                    className="w-full bg-v3-bg-dark border border-v3-primary/30 text-white px-3 py-2 focus:outline-none focus:border-v3-primary font-display text-sm rounded shadow-inner"
                    placeholder="Фэнтези, ЛитРПГ и т.д."
                  />
                </div>
                <div>
                  <label className="block text-v3-primary text-[10px] mb-1.5 font-bold uppercase tracking-widest">Тип</label>
                  <select
                    name="universe_type"
                    className="w-full bg-v3-bg-dark border border-v3-primary/30 text-white px-3 py-2 focus:outline-none focus:border-v3-primary font-display text-sm rounded shadow-inner"
                  >
                    <option value="">Не выбран</option>
                    <option value="Фэнтези">Фэнтези</option>
                    <option value="Научная фантастика">Научная фантастика</option>
                    <option value="Реализм">Реализм</option>
                    <option value="Мистика">Мистика</option>
                    <option value="Другое">Другое</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-v3-primary text-[10px] mb-1.5 font-bold uppercase tracking-widest">Описание</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full bg-v3-bg-dark border border-v3-primary/30 text-white px-3 py-2 focus:outline-none focus:border-v3-primary font-display resize-none text-sm rounded shadow-inner"
                  placeholder="Краткое описание мира"
                />
              </div>
              <div>
                <label className="block text-v3-primary text-[10px] mb-1.5 font-bold uppercase tracking-widest">Направление / Премиса</label>
                <textarea
                  name="direction"
                  rows={2}
                  className="w-full bg-v3-bg-dark border border-v3-primary/30 text-white px-3 py-2 focus:outline-none focus:border-v3-primary font-display resize-none text-sm rounded shadow-inner"
                  placeholder="Идея или сюжетная линия для ИИ"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-v3-primary/20">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-v3-primary/30 text-slate-400 hover:text-white hover:border-v3-primary/50 transition-all font-bold text-[10px] uppercase tracking-widest rounded"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-v3-primary text-v3-bg-dark font-black transition-all hover:bg-v3-primary/90 hover:scale-105 active:scale-95 font-display text-[10px] uppercase tracking-[0.2em] rounded"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'СОЗДАНИЕ...' : 'ИНИЦИАЛИЗИРОВАТЬ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmUniverseId !== null && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-v3-bg-dark border-2 border-red-500 w-full max-w-sm rounded-xl shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <div className="border-b-2 border-red-500/30 bg-v3-bg-dark px-4 py-3 rounded-t-xl">
              <div className="text-red-500 font-black font-display text-[10px] uppercase tracking-[0.2em]">УДАЛЕНИЕ ВСЕЛЕННОЙ</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-white text-xs font-display leading-relaxed">
                Вы собираетесь окончательно удалить вселенную <span className="text-red-400 font-bold">«{universes.find(u => u.id === deleteConfirmUniverseId)?.title}»</span>. Все связанные данные будут уничтожены. Подтвердить операцию?
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-red-500/20">
                <button
                  onClick={() => setDeleteConfirmUniverseId(null)}
                  className="px-4 py-2 border border-v3-primary/30 text-slate-400 hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest rounded"
                >
                  ОТМЕНА
                </button>
                <button
                  onClick={() => { deleteMutation.mutate(deleteConfirmUniverseId); }}
                  className="px-6 py-2 bg-red-600 text-white font-black transition-all hover:bg-red-700 hover:scale-105 active:scale-95 font-display text-[10px] uppercase tracking-[0.2em] rounded"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'УДАЛЕНИЕ...' : 'УДАЛИТЬ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
