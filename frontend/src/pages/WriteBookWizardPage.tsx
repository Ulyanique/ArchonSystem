import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  universesApi, outlineApi, charactersApi, locationsApi, chaptersApi, 
  exportApi 
} from '../api';
import { 
  BookOpen, CheckCircle2, Circle, ArrowRight, ArrowLeft, Sparkles, 
  User, MapPin, ListOrdered, FileText, Download 
} from 'lucide-react';

const STEPS = [
  { id: 'plan', label: 'План', icon: ListOrdered, description: 'Создайте план книги' },
  { id: 'characters', label: 'Персонажи', icon: User, description: 'Добавьте главных персонажей' },
  { id: 'locations', label: 'Локации', icon: MapPin, description: 'Добавьте ключевые локации' },
  { id: 'chapters', label: 'Главы', icon: FileText, description: 'Создайте структуру глав' },
  { id: 'draft', label: 'Черновик', icon: BookOpen, description: 'Напишите текст глав' },
  { id: 'export', label: 'Экспорт', icon: Download, description: 'Экспортируйте книгу' },
];

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export default function WriteBookWizardPage() {
  const { universeId } = useParams();
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    plan: 'pending',
    characters: 'pending',
    locations: 'pending',
    chapters: 'pending',
    draft: 'pending',
    export: 'pending',
  });

  const uId = parseInt(universeId!);

  const { data: universe } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(uId),
    enabled: !!universeId,
  });

  const { data: outlineItems = [] } = useQuery({
    queryKey: ['outline', universeId],
    queryFn: () => outlineApi.getAll(uId),
    enabled: !!universeId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(uId),
    enabled: !!universeId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(uId),
    enabled: !!universeId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => chaptersApi.getAll(uId),
    enabled: !!universeId,
  });

  // Обновляем статусы шагов на основе данных
  useEffect(() => {
    const newStatuses: Record<string, StepStatus> = { ...stepStatuses };
    
    // План: есть хотя бы один элемент плана
    if (outlineItems.length > 0) {
      newStatuses.plan = 'completed';
    } else if (currentStepIndex === 0) {
      newStatuses.plan = 'in_progress';
    }
    
    // Персонажи: есть хотя бы один персонаж
    if (characters.length > 0) {
      newStatuses.characters = 'completed';
    } else if (currentStepIndex === 1) {
      newStatuses.characters = 'in_progress';
    }
    
    // Локации: есть хотя бы одна локация
    if (locations.length > 0) {
      newStatuses.locations = 'completed';
    } else if (currentStepIndex === 2) {
      newStatuses.locations = 'in_progress';
    }
    
    // Главы: есть хотя бы одна глава
    if (chapters.length > 0) {
      newStatuses.chapters = 'completed';
    } else if (currentStepIndex === 3) {
      newStatuses.chapters = 'in_progress';
    }
    
    // Черновик: есть хотя бы одна глава с контентом
    const chaptersWithContent = chapters.filter(ch => ch.content && ch.content.trim().length > 0);
    if (chaptersWithContent.length > 0) {
      newStatuses.draft = 'completed';
    } else if (currentStepIndex === 4) {
      newStatuses.draft = 'in_progress';
    }
    
    // Экспорт: всегда доступен
    if (currentStepIndex === 5) {
      newStatuses.export = 'in_progress';
    }
    
    setStepStatuses(newStatuses);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stepStatuses excluded to avoid loop
  }, [outlineItems.length, characters.length, locations.length, chapters.length, currentStepIndex, chapters]);

  const currentStep = STEPS[currentStepIndex];
  const canGoNext = () => {
    switch (currentStep.id) {
      case 'plan': return outlineItems.length > 0;
      case 'characters': return characters.length > 0;
      case 'locations': return locations.length > 0;
      case 'chapters': return chapters.length > 0;
      case 'draft': return chapters.some(ch => ch.content && ch.content.trim().length > 0);
      case 'export': return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleExport = () => {
    const url = exportApi.markdown(uId, {});
    window.open(url, '_blank');
    toast.success('Экспорт начат');
  };

  const getStepIcon = (stepId: string, status: StepStatus) => {
    const step = STEPS.find(s => s.id === stepId);
    if (!step) return null;
    
    if (status === 'completed') {
      return <CheckCircle2 size={20} className="text-green-600" />;
    } else if (status === 'in_progress') {
      return <step.icon size={20} className="text-primary-600" />;
    } else {
      return <Circle size={20} className="text-gray-400" />;
    }
  };

  if (!universe) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-800 mb-2">Мастер «Написать книгу»</h1>
        <p className="text-dark-600">Пошаговый процесс создания книги: от идеи до экспорта</p>
      </div>

      {/* Прогресс-бар */}
      <div className="bg-white rounded-2xl border border-dark-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => setCurrentStepIndex(index)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    index === currentStepIndex
                      ? 'bg-primary-100 text-primary-700'
                      : 'hover:bg-dark-50'
                  }`}
                >
                  {getStepIcon(step.id, stepStatuses[step.id])}
                  <span className="text-sm font-medium">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 w-full mt-2 ${
                    stepStatuses[step.id] === 'completed' ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Контент текущего шага */}
      <div className="bg-white rounded-2xl border border-dark-200 p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
            <currentStep.icon size={24} className="text-primary-600" />
            {currentStep.label}
          </h2>
          <p className="text-dark-600 text-sm mt-1">{currentStep.description}</p>
        </div>

        {/* Шаг 1: План */}
        {currentStep.id === 'plan' && (
          <div>
            <div className="mb-4">
              {outlineItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-600 mb-4">План книги ещё не создан</p>
                  <Link
                    to={`/universes/${universeId}/outline`}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    Создать план
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-dark-600 mb-2">
                    ✅ План создан: {outlineItems.length} {outlineItems.length === 1 ? 'элемент' : 'элементов'}
                  </p>
                  <Link
                    to={`/universes/${universeId}/outline`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Редактировать план →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 2: Персонажи */}
        {currentStep.id === 'characters' && (
          <div>
            <div className="mb-4">
              {characters.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-600 mb-4">Персонажи ещё не добавлены</p>
                  <Link
                    to={`/universes/${universeId}/characters`}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <User size={16} />
                    Добавить персонажей
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-dark-600 mb-2">
                    ✅ Персонажей добавлено: {characters.length}
                  </p>
                  <Link
                    to={`/universes/${universeId}/characters`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Управлять персонажами →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 3: Локации */}
        {currentStep.id === 'locations' && (
          <div>
            <div className="mb-4">
              {locations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-600 mb-4">Локации ещё не добавлены</p>
                  <Link
                    to={`/universes/${universeId}/locations`}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <MapPin size={16} />
                    Добавить локации
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-dark-600 mb-2">
                    ✅ Локаций добавлено: {locations.length}
                  </p>
                  <Link
                    to={`/universes/${universeId}/locations`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Управлять локациями →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 4: Главы */}
        {currentStep.id === 'chapters' && (
          <div>
            <div className="mb-4">
              {chapters.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-600 mb-4">Главы ещё не созданы</p>
                  <div className="flex gap-2 justify-center">
                    <Link
                      to={`/universes/${universeId}/chapters`}
                      className="btn btn-primary inline-flex items-center gap-2"
                    >
                      <FileText size={16} />
                      Создать главы
                    </Link>
                    {outlineItems.length > 0 && (
                      <Link
                        to={`/universes/${universeId}/outline`}
                        className="btn btn-secondary inline-flex items-center gap-2"
                      >
                        <Sparkles size={16} />
                        Применить план
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-dark-600 mb-2">
                    ✅ Глав создано: {chapters.length}
                  </p>
                  <Link
                    to={`/universes/${universeId}/chapters`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Управлять главами →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 5: Черновик */}
        {currentStep.id === 'draft' && (
          <div>
            <div className="mb-4">
              {chapters.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark-600 mb-4">Сначала создайте главы</p>
                  <Link
                    to={`/universes/${universeId}/chapters`}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <FileText size={16} />
                    Создать главы
                  </Link>
                </div>
              ) : (
                <div>
                  {(() => {
                    const chaptersWithContent = chapters.filter(ch => ch.content && ch.content.trim().length > 0);
                    const totalWords = chapters.reduce((sum, ch) => {
                      const words = (ch.content || '').split(/\s+/).filter(w => w.length > 0);
                      return sum + words.length;
                    }, 0);
                    
                    return (
                      <>
                        <p className="text-dark-600 mb-2">
                          ✅ Написано глав: {chaptersWithContent.length} из {chapters.length}
                        </p>
                        <p className="text-dark-500 text-sm mb-4">
                          Всего слов: {totalWords.toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <Link
                            to={`/universes/${universeId}/chapters`}
                            className="btn btn-primary inline-flex items-center gap-2"
                          >
                            <BookOpen size={16} />
                            Продолжить написание
                          </Link>
                          <Link
                            to={`/universes/${universeId}/book-view`}
                            className="btn btn-secondary inline-flex items-center gap-2"
                          >
                            <FileText size={16} />
                            Просмотр книги
                          </Link>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Шаг 6: Экспорт */}
        {currentStep.id === 'export' && (
          <div>
            <div className="mb-4">
              <p className="text-dark-600 mb-4">
                Экспортируйте готовую книгу в формате Markdown
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Download size={16} />
                  Экспортировать в Markdown
                </button>
                <Link
                  to={`/universes/${universeId}/book-view`}
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <BookOpen size={16} />
                  Просмотр перед экспортом
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Навигация */}
        <div className="flex justify-between items-center pt-4 border-t border-dark-200 mt-6">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Назад
          </button>
          
          <div className="text-sm text-dark-500">
            Шаг {currentStepIndex + 1} из {STEPS.length}
          </div>
          
          {currentStepIndex < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              Дальше
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate(`/universes/${universeId}`)}
              className="btn btn-secondary"
            >
              Завершить
            </button>
          )}
        </div>
      </div>

      {/* Чек-лист */}
      <div className="bg-primary-50 rounded-2xl border border-primary-200 p-6">
        <h3 className="font-bold text-dark-800 mb-4">Чек-лист прогресса</h3>
        <ul className="space-y-2">
          {STEPS.map((step, index) => {
            const status = stepStatuses[step.id];
            const isCompleted = status === 'completed';
            const isCurrent = index === currentStepIndex;
            
            return (
              <li key={step.id} className="flex items-center gap-3">
                {isCompleted ? (
                  <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                ) : (
                  <Circle size={20} className={`shrink-0 ${isCurrent ? 'text-primary-600' : 'text-gray-400'}`} />
                )}
                <span className={isCompleted ? 'text-dark-600 line-through' : isCurrent ? 'text-dark-800 font-medium' : 'text-dark-500'}>
                  {step.label}
                </span>
                {isCurrent && !isCompleted && (
                  <span className="text-xs text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                    Текущий шаг
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
