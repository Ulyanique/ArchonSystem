import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timelineApi, charactersApi, locationsApi, chaptersApi, universesApi, aiGeneratorApi } from '../api';
import { CalendarDays, Plus, Trash2, Edit2, Filter, Calendar, MapPin, BookOpen, Users, X, Clock, Sparkles } from 'lucide-react';
import { TimelineEvent, Character, Location, Chapter } from '../types';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';

const eventTypes = {
  general: { label: 'Общее', color: 'bg-gray-500', icon: '📌' },
  battle: { label: 'Битва', color: 'bg-red-500', icon: '⚔️' },
  meeting: { label: 'Встреча', color: 'bg-blue-500', icon: '🤝' },
  journey: { label: 'Путешествие', color: 'bg-green-500', icon: '🚶' },
  death: { label: 'Смерть', color: 'bg-purple-500', icon: '💀' },
  birth: { label: 'Рождение', color: 'bg-pink-500', icon: '👶' },
  discovery: { label: 'Открытие', color: 'bg-yellow-500', icon: '💡' },
  conflict: { label: 'Конфликт', color: 'bg-orange-500', icon: '🔥' },
  romance: { label: 'Романтика', color: 'bg-rose-500', icon: '💕' },
  act: { label: 'Акт', color: 'bg-indigo-600', icon: '🎭' },
  chapter: { label: 'Глава', color: 'bg-amber-600', icon: '📖' },
  other: { label: 'Другое', color: 'bg-slate-500', icon: '📝' },
};

type UniverseTime = { year: number; day: number };

function pluralYears(n: number): string {
  if (n === 0) return '0 лет';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} лет`;
  if (mod10 === 1) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} года`;
  return `${n} лет`;
}

function pluralDays(n: number): string {
  if (n === 0) return '0 дней';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

function formatRelativeToNow(
  event: TimelineEvent,
  now: UniverseTime,
  daysPerYear: number
): string | null {
  const y = event.universe_year;
  const d = event.universe_day;
  if (y == null || d == null) return null;
  const nowTotal = now.year * daysPerYear + now.day;
  const eventTotal = y * daysPerYear + d;
  const diff = nowTotal - eventTotal;
  if (diff === 0) return 'В настоящем';
  if (diff > 0) {
    const years = Math.floor(diff / daysPerYear);
    const days = diff % daysPerYear;
    const parts = [];
    if (years > 0) parts.push(pluralYears(years));
    if (days > 0) parts.push(pluralDays(days));
    return parts.length ? `${parts.join(', ')} до настоящего` : 'В настоящем';
  }
  const absDiff = -diff;
  const years = Math.floor(absDiff / daysPerYear);
  const days = absDiff % daysPerYear;
  const parts = [];
  if (years > 0) parts.push(pluralYears(years));
  if (days > 0) parts.push(pluralDays(days));
  return parts.length ? `${parts.join(', ')} после` : 'В настоящем';
}

export default function TimelinePage() {
  const { universeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [generatedEvents, setGeneratedEvents] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['timeline', universeId, filterType, filterId],
    queryFn: () => timelineApi.getAll(parseInt(universeId!), filterType || undefined, filterId ? parseInt(filterId) : undefined),
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

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => chaptersApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: universeTime } = useQuery({
    queryKey: ['universe-clock', universeId],
    queryFn: () => universesApi.getClock(parseInt(universeId!)),
    enabled: !!universeId,
    refetchInterval: 60_000,
  });

  const { data: universe } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const daysPerYear = universe?.universe_days_per_year ?? 365;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => timelineApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', universeId] });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm('Удалить событие?')) {
      deleteMutation.mutate(id);
    }
  };

  // Определяет URL для перехода к источнику события
  const getEventSourceUrl = (event: TimelineEvent): string | null => {
    // Для виртуальных событий (рождение/смерть) - переход на страницу персонажа
    if (event.id < 0 && event.character_ids && event.character_ids.length > 0) {
      return `/universes/${universeId}/characters/${event.character_ids[0]}`;
    }
    
    // Для обычных событий - приоритет: персонаж > локация > глава
    if (event.character_ids && event.character_ids.length > 0) {
      return `/universes/${universeId}/characters/${event.character_ids[0]}`;
    }
    if (event.location_id) {
      return `/universes/${universeId}/locations`;
    }
    if (event.chapter_id) {
      return `/universes/${universeId}/chapters`;
    }
    
    return null;
  };

  const handleEventClick = (event: TimelineEvent, e: React.MouseEvent) => {
    // Не переходим, если клик был на кнопку или ссылку
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    
    const url = getEventSourceUrl(event);
    if (url) {
      navigate(url);
    }
  };

  // Позиция разделителя «Сейчас»: перед первым событием, дата которого строго после текущего времени вселенной
  const nowInsertIndex =
    universeTime && events.length > 0
      ? events.findIndex(
          (e) =>
            e.universe_year != null &&
            e.universe_day != null &&
            (e.universe_year > universeTime.year ||
              (e.universe_year === universeTime.year && e.universe_day > universeTime.day))
        )
      : -1;
  type TimelineItem = { type: 'event'; event: TimelineEvent } | { type: 'now' };
  const timelineItems: TimelineItem[] = [];
  events.forEach((event, i) => {
    if (universeTime && nowInsertIndex >= 0 && i === nowInsertIndex) {
      timelineItems.push({ type: 'now' });
    }
    timelineItems.push({ type: 'event', event });
  });
  if (universeTime && events.length > 0 && nowInsertIndex < 0) {
    timelineItems.push({ type: 'now' });
  }

  if (isLoading) {
    return <div className="text-center py-12">Загрузка таймлайна...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
            <CalendarDays size={24} />
            Таймлайн событий
          </h2>
          <p className="text-sm text-dark-500 mt-1">
            Хронология событий вашей вселенной
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!universeId) return;
              setIsGeneratingSingle(true);
              try {
                const event = await aiGeneratorApi.singleTimelineEvent(parseInt(universeId));
                setEditingEvent({
                  ...(event as object),
                  universe_id: parseInt(universeId),
                  character_ids: [],
                  location_id: undefined,
                  chapter_id: undefined,
                  sort_order: 0,
                } as unknown as TimelineEvent);
                setShowModal(true);
                toast.success('Событие сгенерировано');
              } catch (error: any) {
                toast.error('Ошибка генерации: ' + (error.response?.data?.detail || error.message));
              } finally {
                setIsGeneratingSingle(false);
              }
            }}
            disabled={isGeneratingSingle || isGenerating}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={20} />
            {isGeneratingSingle ? 'Генерация...' : 'Сгенерировать событие'}
          </button>
          <button
            onClick={async () => {
              if (!universeId) return;
              setIsGenerating(true);
              try {
                const events = await aiGeneratorApi.timelineEvents(parseInt(universeId), 5);
                setGeneratedEvents(events);
              } catch (error: any) {
                toast.error('Ошибка генерации: ' + (error.response?.data?.detail || error.message));
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating || isGeneratingSingle}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={20} />
            {isGenerating ? 'Генерация...' : 'Сгенерировать события'}
          </button>
          <button
            onClick={() => {
              setEditingEvent(null);
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Добавить событие
          </button>
        </div>
      </div>

      {/* Сгенерированные события */}
      {generatedEvents && generatedEvents.length > 0 && (
        <div className="card p-4 mb-6 border-2 border-primary-200">
          <h3 className="font-bold text-dark-800 mb-2">Сгенерированные события — применить?</h3>
          <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {generatedEvents.map((event, i) => (
              <li key={i} className="text-sm p-2 bg-dark-50 rounded">
                <div className="flex items-start gap-2">
                  <span className={`text-xs text-white px-2 py-1 rounded ${eventTypes[event.event_type as keyof typeof eventTypes]?.color || 'bg-gray-500'}`}>
                    {eventTypes[event.event_type as keyof typeof eventTypes]?.label || event.event_type}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-dark-800">{event.title}</span>
                    {event.description && (
                      <p className="text-dark-600 text-xs mt-1">{event.description}</p>
                    )}
                    {event.date_value && (
                      <p className="text-dark-500 text-xs mt-1">{event.date_value}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!universeId || !generatedEvents) return;
                try {
                  for (const event of generatedEvents) {
                    await timelineApi.create(parseInt(universeId), {
                      ...event,
                      universe_id: parseInt(universeId),
                      character_ids: [],
                      sort_order: 0,
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ['timeline', universeId] });
                  setGeneratedEvents(null);
                  toast.success(`Добавлено ${generatedEvents.length} событий`);
                } catch (error: any) {
                  toast.error('Ошибка добавления: ' + (error.response?.data?.detail || error.message));
                }
              }}
              className="btn btn-primary"
            >
              Применить все события
            </button>
            <button
              onClick={() => setGeneratedEvents(null)}
              className="btn btn-secondary"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-dark-500" />
          <span className="font-medium text-dark-700">Фильтры</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Тип фильтра
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setFilterId('');
              }}
              className="input"
            >
              <option value="">Без фильтра</option>
              <option value="character">Персонаж</option>
              <option value="location">Локация</option>
              <option value="chapter">Глава</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Значение
            </label>
            <select
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              className="input"
              disabled={!filterType}
            >
              <option value="">Все</option>
              {filterType === 'character' && characters.map((c: Character) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {filterType === 'location' && locations.map((l: Location) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
              {filterType === 'chapter' && chapters.map((ch: Chapter) => (
                <option key={ch.id} value={ch.id}>Глава {ch.chapter_number}: {ch.title}</option>
              ))}
            </select>
          </div>
          {(filterType || filterId) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterType('');
                  setFilterId('');
                }}
                className="btn btn-secondary text-sm"
              >
                <X size={16} className="mr-1" />
                Сбросить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Таймлайн */}
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Пока нет событий"
          actionLabel="Добавить первое событие"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="relative">
          {/* Линия таймлайна */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary-300"></div>

          <div className="space-y-6">
            {timelineItems.map((item, _index) => {
              if (item.type === 'now') {
                return (
                  <div key="timeline-now" className="relative flex gap-4">
                    <div className="relative z-10 w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Clock size={28} className="text-white" />
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="card border-2 border-primary-400 bg-primary-50/50 py-3 px-4 w-full">
                        <div className="flex items-center gap-2 text-primary-800">
                          <Clock size={18} className="text-primary-600" />
                          <span className="font-semibold">Сейчас в вселенной</span>
                        </div>
                        <p className="text-sm text-primary-700 mt-1 font-mono">
                          {universeTime!.display}
                        </p>
                        <p className="text-xs text-primary-600 mt-0.5">
                          {universeTime!.year} {universeTime!.epoch} · День {universeTime!.day} ·{' '}
                          {String(universeTime!.hour).padStart(2, '0')}:
                          {String(universeTime!.minute).padStart(2, '0')}:
                          {String(universeTime!.second).padStart(2, '0')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              const event = item.event;
              const eventType = eventTypes[event.event_type as keyof typeof eventTypes] || eventTypes.general;
              const eventChapter = chapters.find((c: Chapter) => c.id === event.chapter_id);
              const eventLocation = locations.find((l: Location) => l.id === event.location_id);
              const eventCharacters = characters.filter((c: Character) => event.character_ids?.includes(c.id));
              const isAutoGenerated = event.id < 0;
              const sourceUrl = getEventSourceUrl(event);
              const isClickable = sourceUrl !== null;
              
              // Определяем, является ли событие актом или главой для визуального выделения
              const isAct = event.event_type === 'act';
              const isChapterEvent = event.chapter_id !== null && event.chapter_id !== undefined;
              
              // Специальные стили для актов и глав
              const cardBorderClass = isAct 
                ? 'border-2 border-indigo-400 shadow-indigo-200' 
                : isChapterEvent 
                  ? 'border-2 border-amber-400 shadow-amber-200' 
                  : '';
              const cardBgClass = isAct 
                ? 'bg-indigo-50' 
                : isChapterEvent 
                  ? 'bg-amber-50' 
                  : isAutoGenerated 
                    ? 'bg-gray-50' 
                    : '';

              return (
                <div key={event.id} className="relative flex gap-4">
                  <div className={`relative z-10 w-16 h-16 rounded-full ${eventType.color} flex items-center justify-center text-2xl shadow-lg flex-shrink-0 ${isAct ? 'ring-2 ring-indigo-300 ring-offset-2' : isChapterEvent ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}>
                    {eventType.icon}
                  </div>
                  <div
                    className={`flex-1 card transition-shadow ${cardBgClass} ${cardBorderClass} ${isClickable ? 'hover:shadow-md cursor-pointer' : ''}`}
                    onClick={(e) => handleEventClick(event, e)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-lg font-semibold ${isAct ? 'text-indigo-900' : isChapterEvent ? 'text-amber-900' : 'text-dark-800'}`}>
                            {event.title}
                          </h3>
                          <span className={`text-xs text-white px-2 py-1 rounded ${eventType.color}`}>
                            {eventType.label}
                          </span>
                          {isAct && (
                            <span className="text-xs text-indigo-700 px-2 py-1 rounded bg-indigo-100 font-semibold border border-indigo-300">
                              АКТ
                            </span>
                          )}
                          {isChapterEvent && !isAct && (
                            <span className="text-xs text-amber-700 px-2 py-1 rounded bg-amber-100 font-semibold border border-amber-300">
                              ГЛАВА
                            </span>
                          )}
                          {isAutoGenerated && (
                            <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-200">
                              Автоматически
                            </span>
                          )}
                        </div>
                        {event.date_value && (
                          <div className="flex items-center gap-1 text-sm text-dark-500">
                            <Calendar size={14} />
                            <span>{event.date_value}</span>
                          </div>
                        )}
                        {universeTime && (() => {
                          const relative = formatRelativeToNow(event, universeTime, daysPerYear);
                          return relative ? (
                            <div className="text-xs text-dark-400 mt-0.5">
                              {relative}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      {!isAutoGenerated && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setShowModal(true);
                            }}
                            className="p-1 hover:bg-dark-100 rounded"
                          >
                            <Edit2 size={16} className="text-dark-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-dark-600 mb-3 whitespace-pre-wrap">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {eventChapter && (
                        <Link
                          to={`/universes/${universeId}/chapters`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                        >
                          <BookOpen size={12} />
                          Глава {eventChapter.chapter_number}
                        </Link>
                      )}
                      {eventLocation && (
                        <Link
                          to={`/universes/${universeId}/locations`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          <MapPin size={12} />
                          {eventLocation.name}
                        </Link>
                      )}
                      {eventCharacters.map((char: Character) => (
                        <Link
                          key={char.id}
                          to={`/universes/${universeId}/characters`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <Users size={12} />
                          {char.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <TimelineEventModal
          universeId={parseInt(universeId!)}
          event={editingEvent}
          characters={characters}
          locations={locations}
          chapters={chapters}
          onClose={() => {
            setShowModal(false);
            setEditingEvent(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['timeline', universeId] });
            setShowModal(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}

// Компонент модального окна
function TimelineEventModal({ universeId, event, characters, locations, chapters, onClose, onSuccess }: any) {
  const createMutation = useMutation({
    mutationFn: (data: any) => timelineApi.create(universeId, data),
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => timelineApi.update(universeId, id, data),
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      date_value: formData.get('date_value') as string,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      event_type: formData.get('event_type') as string,
      universe_year: formData.get('universe_year') ? parseInt(formData.get('universe_year') as string) : null,
      universe_day: formData.get('universe_day') ? parseInt(formData.get('universe_day') as string) : null,
      chapter_id: formData.get('chapter_id') ? parseInt(formData.get('chapter_id') as string) : null,
      location_id: formData.get('location_id') ? parseInt(formData.get('location_id') as string) : null,
      character_ids: formData.getAll('character_ids').map((id) => parseInt(String(id), 10)),
      universe_id: universeId, // Добавляем universe_id
    };

    // Добавляем witness/heard/read только при обновлении (update поддерживает эти поля)
    if (event) {
      data.witness_character_ids = formData.getAll('witness_character_ids').map((id) => parseInt(String(id), 10));
      data.heard_by_character_ids = formData.getAll('heard_by_character_ids').map((id) => parseInt(String(id), 10));
      data.read_by_character_ids = formData.getAll('read_by_character_ids').map((id) => parseInt(String(id), 10));
      updateMutation.mutate({ id: event.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {event ? 'Редактировать событие' : 'Новое событие'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Название *
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={event?.title}
              className="input"
              placeholder="Например: Битва за Север"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Тип события
              </label>
              <select name="event_type" defaultValue={event?.event_type || 'general'} className="input">
                {Object.entries(eventTypes).map(([key, value]) => (
                  <option key={key} value={key}>{value.icon} {value.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Дата/Время
              </label>
              <input
                name="date_value"
                type="text"
                defaultValue={event?.date_value}
                className="input"
                placeholder="1234 год, День 5, Глава 3..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Год во вселенной
              </label>
              <input
                name="universe_year"
                type="number"
                defaultValue={event?.universe_year || ''}
                className="input"
                placeholder="1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                День во вселенной
              </label>
              <input
                name="universe_day"
                type="number"
                defaultValue={event?.universe_day || ''}
                className="input"
                placeholder="5"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Описание
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event?.description}
              className="input"
              placeholder="Описание события..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Глава
              </label>
              <select name="chapter_id" defaultValue={event?.chapter_id || ''} className="input">
                <option value="">Не выбрано</option>
                {chapters.map((ch: Chapter) => (
                  <option key={ch.id} value={ch.id}>Глава {ch.chapter_number}: {ch.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Локация
              </label>
              <select name="location_id" defaultValue={event?.location_id || ''} className="input">
                <option value="">Не выбрано</option>
                {locations.map((l: Location) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-2">
              Персонажи (участники)
            </label>
            <div className="border border-dark-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {characters.map((char: Character) => (
                <label key={char.id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    name="character_ids"
                    value={char.id}
                    defaultChecked={event?.character_ids?.includes(char.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{char.name}</span>
                </label>
              ))}
            </div>
            {(() => {
              const year = event?.universe_year;
              const day = event?.universe_day;
              if (year !== null && year !== undefined && day !== null && day !== undefined) {
                return (
                  <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>Участники будут знать об этом событии в диалогах до {day} дня {year} года</span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-2">
              Очевидцы (видели событие)
            </label>
            <div className="border border-dark-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {characters.map((char: Character) => (
                <label key={char.id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    name="witness_character_ids"
                    value={char.id}
                    defaultChecked={event?.witness_character_ids?.includes(char.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{char.name}</span>
                </label>
              ))}
            </div>
            {(() => {
              const year = event?.universe_year;
              const day = event?.universe_day;
              if (year !== null && year !== undefined && day !== null && day !== undefined) {
                return (
                  <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>Очевидцы будут знать об этом событии в диалогах до {day} дня {year} года</span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-2">
              Услышали о событии
            </label>
            <div className="border border-dark-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {characters.map((char: Character) => (
                <label key={char.id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    name="heard_by_character_ids"
                    value={char.id}
                    defaultChecked={event?.heard_by_character_ids?.includes(char.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{char.name}</span>
                </label>
              ))}
            </div>
            {(() => {
              const year = event?.universe_year;
              const day = event?.universe_day;
              if (year !== null && year !== undefined && day !== null && day !== undefined) {
                return (
                  <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>Эти персонажи будут знать об этом событии (по слухам) в диалогах до {day} дня {year} года</span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-2">
              Прочитали о событии
            </label>
            <div className="border border-dark-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {characters.map((char: Character) => (
                <label key={char.id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    name="read_by_character_ids"
                    value={char.id}
                    defaultChecked={event?.read_by_character_ids?.includes(char.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{char.name}</span>
                </label>
              ))}
            </div>
            {(() => {
              const year = event?.universe_year;
              const day = event?.universe_day;
              if (year !== null && year !== undefined && day !== null && day !== undefined) {
                return (
                  <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>Эти персонажи будут знать об этом событии (из прочитанного) в диалогах до {day} дня {year} года</span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
