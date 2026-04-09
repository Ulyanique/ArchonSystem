import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chaptersApi } from '../api';
import { Chapter } from '../types';
import { PenLine, Loader2, Check, X, RotateCcw, BookOpen, Sparkles, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

export default function WritePage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const uId = parseInt(universeId!);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [instruction, setInstruction] = useState('');
  const [generated, setGenerated] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{
    characters?: string[];
    locations?: string[];
    events?: string[];
    style_tips?: string[];
    plot_ideas?: string[];
    warnings?: string[];
    error?: string;
  } | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => chaptersApi.getAll(uId),
    enabled: !!universeId,
  });

  const sortedChapters = [...chapters].filter((ch: Chapter) => ch.enabled !== false).sort(
    (a: Chapter, b: Chapter) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
  );

  const selectedChapter = selectedChapterId != null
    ? sortedChapters.find((ch: Chapter) => ch.id === selectedChapterId)
    : null;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { content: string } }) =>
      chaptersApi.update(uId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
      toast.success('Текст добавлен в главу');
      setGenerated('');
    },
    onError: (e: unknown) => {
      toast.error('Ошибка сохранения: ' + (e as Error)?.message);
    },
  });

  const startGenerate = useCallback(async () => {
    if (!selectedChapterId || !instruction.trim()) {
      toast.error('Выберите главу и введите инструкцию');
      return;
    }
    setGenerateError(null);
    setGenerated('');
    setIsGenerating(true);
    try {
      for await (const chunk of chaptersApi.writeBeatStream(uId, selectedChapterId, {
        instruction: instruction.trim(),
      })) {
        setGenerated((prev) => prev + chunk);
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Ошибка генерации';
      setGenerateError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [uId, selectedChapterId, instruction]);

  const acceptGenerated = useCallback(() => {
    if (!selectedChapter || !generated.trim()) return;
    const newContent = ((selectedChapter.content || '').trim() ? (selectedChapter.content || '') + '\n\n' + generated.trim() : generated.trim()).trim();
    updateMutation.mutate({ id: selectedChapter.id, data: { content: newContent } });
  }, [selectedChapter, generated, updateMutation]);

  const discardGenerated = useCallback(() => {
    setGenerated('');
    setGenerateError(null);
  }, []);

  const retryGenerate = useCallback(() => {
    setGenerated('');
    setGenerateError(null);
    startGenerate();
  }, [startGenerate]);

  const loadSuggestions = useCallback(async () => {
    if (!selectedChapterId) return;
    setSuggestionsLoading(true);
    setSuggestions(null);
    try {
      const data = await chaptersApi.getSuggestions(uId, selectedChapterId);
      setSuggestions(data);
    } catch {
      setSuggestions({ error: 'Не удалось загрузить подсказки' });
    } finally {
      setSuggestionsLoading(false);
    }
  }, [uId, selectedChapterId]);

  // Сброс подсказок при смене главы
  const onChapterChange = useCallback((chapterId: number | null) => {
    setSelectedChapterId(chapterId);
    setGenerated('');
    setGenerateError(null);
    setSuggestions(null);
  }, []);

  if (chaptersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (sortedChapters.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-dark-800 mb-4">Режим «Писать»</h1>
        <p className="text-dark-600 mb-4">Нет глав для написания. Создайте главы и добавьте к ним краткое содержание.</p>
        <Link to={`/universes/${universeId}/chapters`} className="btn btn-primary inline-flex items-center gap-2">
          <BookOpen size={18} />
          Перейти к главам
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-800 flex items-center gap-2">
          <PenLine size={28} className="text-primary-600" />
          Режим «Писать»
        </h1>
        <p className="text-dark-600 mt-1">
          Введите инструкцию — ИИ сгенерирует прозу с учётом контекста всей вселенной и выбранной главы.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Выбор главы и инструкция */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Глава</label>
            <select
              value={selectedChapterId ?? ''}
              onChange={(e) => onChapterChange(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="input w-full"
            >
              <option value="">Выберите главу</option>
              {sortedChapters.map((ch: Chapter) => (
                <option key={ch.id} value={ch.id}>
                  {ch.chapter_number != null ? `${ch.chapter_number}. ` : ''}{ch.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Инструкция (что написать)</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Например: Опиши приезд героя в замок. Или: Диалог между Марком и Анной о побеге."
              className="input w-full min-h-[120px] resize-y"
              disabled={isGenerating}
            />
            <button
              onClick={startGenerate}
              disabled={isGenerating || !instruction.trim() || !selectedChapterId}
              className="btn btn-primary mt-2 w-full inline-flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Генерация…
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Сгенерировать
                </>
              )}
            </button>
          </div>

          {/* Подсказки ИИ для выбранной главы */}
          {selectedChapterId && (
            <div className="border border-dark-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setSuggestionsOpen((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between bg-dark-100 text-dark-700 text-sm font-medium hover:bg-dark-150"
              >
                <span className="flex items-center gap-2">
                  <Lightbulb size={16} className="text-primary-500" />
                  Подсказки для главы
                </span>
                {suggestionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {suggestionsOpen && (
                <div className="p-3 bg-dark-50 text-sm">
                  {!suggestions && !suggestionsLoading && (
                    <button
                      type="button"
                      onClick={loadSuggestions}
                      className="btn btn-secondary w-full text-sm"
                    >
                      Загрузить подсказки
                    </button>
                  )}
                  {suggestionsLoading && (
                    <div className="flex items-center justify-center gap-2 py-2 text-dark-500">
                      <Loader2 size={16} className="animate-spin" />
                      Загрузка…
                    </div>
                  )}
                  {suggestions && !suggestionsLoading && (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {suggestions.error && (
                        <p className="text-red-600 text-xs">{suggestions.error}</p>
                      )}
                      {suggestions.characters?.length ? (
                        <div>
                          <div className="font-medium text-dark-700 mb-0.5">Персонажи</div>
                          <ul className="list-disc list-inside text-dark-600 text-xs space-y-0.5">
                            {suggestions.characters.slice(0, 5).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {suggestions.locations?.length ? (
                        <div>
                          <div className="font-medium text-dark-700 mb-0.5">Локации</div>
                          <ul className="list-disc list-inside text-dark-600 text-xs space-y-0.5">
                            {suggestions.locations.slice(0, 5).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {suggestions.events?.length ? (
                        <div>
                          <div className="font-medium text-dark-700 mb-0.5">События</div>
                          <ul className="list-disc list-inside text-dark-600 text-xs space-y-0.5">
                            {suggestions.events.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {suggestions.style_tips?.length ? (
                        <div>
                          <div className="font-medium text-dark-700 mb-0.5">Стиль</div>
                          <ul className="list-disc list-inside text-dark-600 text-xs space-y-0.5">
                            {suggestions.style_tips.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {suggestions.plot_ideas?.length ? (
                        <div>
                          <div className="font-medium text-dark-700 mb-0.5">Идеи сюжета</div>
                          <ul className="list-disc list-inside text-dark-600 text-xs space-y-0.5">
                            {suggestions.plot_ideas.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {suggestions.warnings?.length ? (
                        <div>
                          <div className="font-medium text-amber-700 mb-0.5">Внимание</div>
                          <ul className="list-disc list-inside text-amber-600 text-xs space-y-0.5">
                            {suggestions.warnings.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={loadSuggestions}
                        className="text-primary-600 hover:underline text-xs"
                      >
                        Обновить подсказки
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {generated && !isGenerating && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-200">
              <button
                onClick={acceptGenerated}
                disabled={updateMutation.isPending}
                className="btn btn-primary inline-flex items-center gap-1"
              >
                <Check size={16} />
                Добавить в главу
              </button>
              <button onClick={discardGenerated} className="btn btn-secondary inline-flex items-center gap-1">
                <X size={16} />
                Отклонить
              </button>
              <button onClick={retryGenerate} className="btn btn-secondary inline-flex items-center gap-1">
                <RotateCcw size={16} />
                Повторить
              </button>
            </div>
          )}
        </div>

        {/* Текст главы + результат генерации */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">
              {selectedChapter ? `Текст главы «${selectedChapter.title}»` : 'Текст главы'}
            </label>
            <div className="bg-dark-50 rounded-lg border border-dark-200 p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
              {selectedChapter ? (
                <>
                  {(selectedChapter.content || '').trim() ? (
                    <p className="text-dark-700 whitespace-pre-wrap font-serif text-base leading-relaxed">
                      {selectedChapter.content}
                    </p>
                  ) : (
                    <p className="text-dark-500 italic">В этой главе пока нет текста. Сгенерируйте прозу по инструкции выше.</p>
                  )}
                </>
              ) : (
                <p className="text-dark-500">Выберите главу слева.</p>
              )}
            </div>
          </div>

          {(generated || isGenerating || generateError) && (
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-2">Результат генерации</label>
              <div className="bg-primary-50/50 rounded-lg border border-primary-200 p-4 min-h-[120px] max-h-[320px] overflow-y-auto">
                {generateError && <p className="text-red-600">{generateError}</p>}
                {(generated || isGenerating) && (
                  <p className="text-dark-700 whitespace-pre-wrap font-serif text-base leading-relaxed">
                    {generated}
                    {isGenerating && <span className="animate-pulse">▌</span>}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-sm text-dark-500">
        <Link to={`/universes/${universeId}/chapters`} className="text-primary-600 hover:underline">
          Управление главами
        </Link>
        {' · '}
        <Link to={`/universes/${universeId}/book-view`} className="text-primary-600 hover:underline">
          Просмотр книги
        </Link>
      </div>
    </div>
  );
}
