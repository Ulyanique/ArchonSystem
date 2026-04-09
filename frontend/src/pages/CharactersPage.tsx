import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Loader2, Wand2, Sparkles, UserCircle, Brain, AlertTriangle, ChevronRight
} from 'lucide-react';

import {
  charactersApi, chatApi, universesApi, coverageApi
} from '../api';
import { apiFetch } from '../api/client';
import { Character, CharacterCreate, AIAnalysis, GeneratedCharacter } from '../types';

import CharacterCard from '../components/characters/CharacterCard';
import CharacterPortrait from '../components/characters/CharacterPortrait';
import CharacterForm from '../components/characters/CharacterForm';
import AICriticPanel from '../components/AICriticPanel';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { validateCharacter } from '../utils/validation';
import { enqueueJob } from '../store/jobQueue';

export default function CharactersPage() {
  const { universeId, characterId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isFormView = characterId !== undefined;

  // States
  const [analyzingCharacter, setAnalyzingCharacter] = useState<Character | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [_generatedCharacters, _setGeneratedCharacters] = useState<GeneratedCharacter[]>([]);
  const [_showGenerated, _setShowGenerated] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);

  const [_autofillLoading, _setAutofillLoading] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [isGeneratingAllFields, setIsGeneratingAllFields] = useState(false);
  const [isGeneratingPortrait, _setIsGeneratingPortrait] = useState(false);
  const fillAllFieldsRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Queries
  const { data: characters = [], isLoading } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: characterFromRoute, isLoading: _isLoadingCharacter } = useQuery({
    queryKey: ['character', universeId, characterId],
    queryFn: () => charactersApi.getById(parseInt(universeId!), parseInt(characterId!, 10)),
    enabled: !!universeId && !!characterId && characterId !== 'new',
  });

  const { data: _book } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: coverageStats } = useQuery({
    queryKey: ['coverage', universeId],
    queryFn: () => coverageApi.getStats(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const formatApiError = (e: any): string => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail) && detail.length)
      return detail.map((d: { msg?: string }) => d?.msg ?? JSON.stringify(d)).join('; ');
    if (detail && typeof detail === 'string') return detail;
    return e?.message || 'Неизвестная ошибка';
  };

  const createFromQueueRef = useRef(false);
  const createMutation = useMutation({
    mutationFn: (data: CharacterCreate) => charactersApi.create(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
      if (!createFromQueueRef.current) toast.success('Персонаж создан');
      createFromQueueRef.current = false;
      navigate(`/universes/${universeId}/characters`);
    },
    onError: (e: any) => {
      createFromQueueRef.current = false;
      toast.error('Ошибка: ' + formatApiError(e));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CharacterCreate> }) => 
      charactersApi.update(parseInt(universeId!), id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
      queryClient.invalidateQueries({ queryKey: ['character', universeId, String(updated.id)] });
      toast.success('Персонаж обновлён');
    },
    onError: (e: any) => toast.error('Ошибка: ' + formatApiError(e))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => charactersApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
      toast.success('Персонаж удалён');
    },
  });

  // Handlers
  const handleFormSubmit = (data: any) => {
    const validation = validateCharacter(data);
    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error.message));
      return;
    }

    if (characterId && characterId !== 'new') {
      const payload = { ...data };
      if (characterFromRoute) {
        payload.portrait_image_path = characterFromRoute.portrait_image_path ?? payload.portrait_image_path;
        payload.portrait_ai_prompt = characterFromRoute.portrait_ai_prompt ?? payload.portrait_ai_prompt;
      }
      updateMutation.mutate({ id: parseInt(characterId), data: payload });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleEnabled = (char: Character) => {
    updateMutation.mutate({ id: char.id, data: { enabled: !char.enabled } });
  };

  const handleAnalyze = async (character: Character) => {
    setAnalyzingCharacter(character);
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      if (character.ai_analysis) {
        try {
          setAiAnalysis(JSON.parse(character.ai_analysis));
          setIsAnalyzing(false);
          return;
        } catch { /* ignore parse errors in stream */ }
      }
      
      const response = await apiFetch(`/universes/${universeId}/ai/characters/${character.id}/analyze?stream=true`, { method: 'POST' });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const decoder = new TextDecoder();
      let streamingText = '';
      
      // eslint-disable-next-line no-constant-condition -- stream read loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.content) {
                streamingText += payload.content;
                const partial = parsePartialJSON(streamingText);
                if (partial) setAiAnalysis(partial);
              }
              if (payload.complete && payload.result) {
                setAiAnalysis(payload.result);
              }
            } catch { /* ignore line parse */ }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
    } catch (error: any) {
      toast.error('Ошибка анализа: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parsePartialJSON = (text: string): AIAnalysis | null => {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }
    return null;
  };

  const SHORT_FIELDS = new Set(['nationality', 'birth_place', 'gender', 'profession', 'role', 'birth_date', 'death_date']);

  const handleAutofill = async (fieldName: string): Promise<void> => {
    if (!characterId || characterId === 'new' || !universeId) return;
    setGeneratingField(fieldName);
    try {
      const uId = parseInt(universeId);
      const cId = parseInt(characterId);
      if (SHORT_FIELDS.has(fieldName)) {
        const { value } = await charactersApi.generateField(uId, cId, fieldName);
        if (value != null && value !== '') {
          const updatedCharacter = await charactersApi.update(uId, cId, { [fieldName]: value });
          queryClient.setQueryData(['character', universeId, characterId], updatedCharacter);
          toast.success('Сгенерировано и сохранено');
        } else {
          toast.error('Не удалось сгенерировать значение');
        }
        return;
      }

      const char = characterFromRoute;
      const charName = char?.name || 'персонажа';

      // Собираем контекст о персонаже для более точной генерации
      const characterContext: string[] = [];
      if (char?.gender) {
        characterContext.push(`Пол: ${char.gender}`);
      }
      // Для поля "description" не включаем возраст - оно должно описывать характер
      if (char?.age && fieldName !== 'description') {
        characterContext.push(`Возраст: ${char.age}`);
      }
      if (char?.role) {
        characterContext.push(`Роль: ${char.role}`);
      }
      if (char?.profession) {
        characterContext.push(`Профессия: ${char.profession}`);
      }
      if (char?.appearance && fieldName !== 'description') {
        characterContext.push(`Внешность: ${char.appearance}`);
      }
      
      const contextStr = characterContext.length > 0 
        ? `\n\nУчти следующие данные о персонаже:\n${characterContext.join('\n')}` 
        : '';
      
      // Специальные инструкции для описания с учётом пола и типа поля
      let fieldSpecificInstruction = '';
      if (fieldName === 'description') {
        // Для краткого описания фокусируемся на характере, без возраста
        const languageInstruction = '\n\nОБЯЗАТЕЛЬНО: Генерируй описание ТОЛЬКО на русском языке.';
        if (char?.gender === 'Мужской') {
          fieldSpecificInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж мужского пола - используй мужские формы слов (он, его, мужчина и т.д.).`;
        } else if (char?.gender === 'Женский') {
          fieldSpecificInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши её личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж женского пола - используй женские формы слов (она, её, женщина и т.д.).`;
        } else if (char?.gender === 'Безполое') {
          fieldSpecificInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж безполый - используй нейтральные формы (существо, персонаж, оно и т.д.).`;
        } else {
          fieldSpecificInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики.`;
        }
      } else if (char?.gender) {
        // Для других полей сохраняем обычные инструкции по полу
        if (char?.gender === 'Мужской') {
          fieldSpecificInstruction = '\n\nВАЖНО: Персонаж мужского пола. Используй мужские формы слов (он, его, молодой человек, мужчина и т.д.).';
        } else if (char?.gender === 'Женский') {
          fieldSpecificInstruction = '\n\nВАЖНО: Персонаж женского пола. Используй женские формы слов (она, её, молодая женщина, женщина и т.д.).';
        } else if (char?.gender === 'Безполое') {
          fieldSpecificInstruction = '\n\nВАЖНО: Персонаж безполый. Избегай указания пола, используй нейтральные формы (существо, персонаж, оно и т.д.).';
        }
      }
      
      const systemPrompt = `Ты — помощник писателя. Генерируй значение для поля "${fieldName}" персонажа "${charName}".${contextStr}${fieldSpecificInstruction}

КРИТИЧЕСКИ ВАЖНО:
- Верни ТОЛЬКО текст, без JSON, без кавычек, без форматирования
- НЕ используй формат {"field": "value"} или подобный
- Верни просто текст, который можно сразу вставить в поле формы
- Если это описание - верни обычный текст, не JSON объект`;

      const response = await chatApi.send({
        universe_id: parseInt(universeId),
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Сгенерируй ${fieldName}` }],
        provider: 'ollama',
      });

      // Очищаем ответ от JSON-форматирования
      let value = response.content.trim();
      
      // Убираем markdown код-блоки
      value = value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
      
      // Пытаемся извлечь значение из JSON объекта
      try {
        // Если весь ответ - это JSON объект
        if (value.trim().startsWith('{') && value.trim().endsWith('}')) {
          const parsed = JSON.parse(value);
          // Ищем значение по имени поля или первому значению объекта
          if (parsed[fieldName]) {
            value = String(parsed[fieldName]);
          } else if (parsed.description) {
            value = String(parsed.description);
          } else {
            // Берем первое строковое значение из объекта
            const firstStringValue = Object.values(parsed).find(v => typeof v === 'string');
            if (firstStringValue) {
              value = String(firstStringValue);
            }
          }
        } else {
          // Пытаемся найти JSON внутри текста - используем более гибкий подход
          // Ищем JSON объект с любым содержимым между кавычками (включая переносы строк)
          const jsonPattern = new RegExp(`\\{[\\s\\S]*?"(?:description|${fieldName})"[\\s\\S]*?:\\s*"((?:[^"\\\\]|\\\\.|\\\\n)*)"[\\s\\S]*?\\}`);
          const jsonMatch = value.match(jsonPattern);
          if (jsonMatch && jsonMatch[1]) {
            value = jsonMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\\\/g, '\\');
          } else {
            // Пытаемся найти любое значение в JSON (более простой паттерн)
            const generalJsonMatch = value.match(/\{[\s\S]*?:\s*"((?:[^"\\]|\\.|\\n)*)"[\s\S]*?\}/);
            if (generalJsonMatch && generalJsonMatch[1]) {
              value = generalJsonMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r')
                .replace(/\\\\/g, '\\');
            }
          }
        }
      } catch (e) {
        // Если не удалось распарсить JSON, просто продолжаем с исходным текстом
        // Убираем явные JSON-маркеры если они есть
        value = value.replace(/^\s*\{[\s\S]*?"description"[\s\S]*?:\s*"/, '').replace(/"[\s\S]*?\}\s*$/, '');
      }
      
      // Убираем кавычки в начале/конце
      value = value.replace(/^["']|["']$/g, '');
      
      // Убираем лишние пробелы и переносы строк в начале/конце
      value = value.trim();
      
      // Сохраняем в базу данных
      const updatedCharacter = await charactersApi.update(parseInt(universeId), parseInt(characterId), { [fieldName]: value });
      
      // Обновляем локальный кэш с полными данными из ответа API
      queryClient.setQueryData(['character', universeId, characterId], updatedCharacter);
      
      toast.success('Сгенерировано и сохранено');
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    } finally {
      setGeneratingField(null);
    }
  };


  const handleGenerateContextual = () => {
    enqueueJob('character', 'Генерация персонажа', async () => {
      try {
        const created = await charactersApi.createContextual(parseInt(universeId!));
        queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
        queryClient.invalidateQueries({ queryKey: ['character', universeId, String(created.id)] });
        toast.success(created.portrait_image_path ? 'Персонаж создан с аватаркой' : 'Персонаж создан');
        navigate(`/universes/${universeId}/characters/${created.id}`);
      } catch (error: any) {
        toast.error('Ошибка генерации: ' + formatApiError(error), { id: 'gen' });
      }
    });
  };

  // Rendering logic
  const displayedCharacters = showDisabled
    ? characters
    : characters.filter((c: Character) => c.enabled !== false);

  if (isLoading && !isFormView) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-48 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
          <div className="h-10 w-32 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
        </div>
        <LoadingSkeleton variant="card" lines={3} className="gap-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isFormView ? (
        <>
          <div className="page-title-bar flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-dark-800 dark:text-dark-200 page-title">Персонажи</h2>
              <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDisabled}
                  onChange={(e) => setShowDisabled(e.target.checked)}
                  className="rounded border-dark-300"
                />
                Показать отключённые
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCharacters.map((char: Character) => (
              <CharacterCard
                key={char.id}
                character={char}
                onEdit={(c) => navigate(String(c.id))}
                onGoTo={(c) => navigate(String(c.id))}
                onAnalyze={handleAnalyze}
                onToggleEnabled={toggleEnabled}
                onDelete={(c) => confirm('Удалить?') && deleteMutation.mutate(c.id)}
                universeId={parseInt(universeId!)}
                mentionChapterCount={coverageStats?.by_entity?.character?.find((e: { id: number }) => e.id === char.id)?.chapter_ids?.length ?? 0}
              />
            ))}
            {/* Плейсхолдер для добавления/генерации персонажа — в конце списка */}
            <div className="card border-2 border-dashed border-dark-300 hover:border-primary-400 transition-colors flex flex-col items-center justify-center min-h-[200px] p-6 group cursor-pointer">
              <div className="w-24 h-24 rounded-lg bg-dark-100 border-2 border-dashed border-dark-300 flex items-center justify-center mb-4 group-hover:border-primary-400 transition-colors">
                <UserCircle size={48} className="text-dark-300 group-hover:text-primary-400 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-dark-600 mb-4">Новый персонаж</h3>
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={handleGenerateContextual}
                  className="btn btn-secondary flex items-center justify-center gap-2 w-full text-sm"
                >
                  <Sparkles size={18} />
                  Сгенерировать
                </button>
                <button 
                  onClick={() => navigate('new')}
                  className="btn btn-primary flex items-center justify-center gap-2 w-full text-sm"
                >
                  <Plus size={18} />
                  Добавить вручную
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="max-w-6xl mx-auto space-y-6 w-full">
          <Link to={`/universes/${universeId}/characters`} className="text-primary-600 hover:underline flex items-center gap-1">
            ← Назад к списку
          </Link>

          <div className="bg-white rounded-2xl shadow-sm border border-dark-100 p-8">
            <div className="flex flex-col md:flex-row gap-8 mb-8">
              {characterId !== 'new' && characterFromRoute && (
                <CharacterPortrait
                    character={characterFromRoute}
                    onGenerate={() => {
                      const uId = parseInt(universeId!);
                      const cId = characterFromRoute.id;
                      const prompt = characterFromRoute.portrait_ai_prompt || undefined;
                      const charIdParam = characterId;
                      enqueueJob('portrait', `Портрет: ${characterFromRoute.name}`, async () => {
                        toast.loading('Генерация портрета ИИ...', { id: 'portrait', duration: Infinity });
                        try {
                          const updatedCharacter = await charactersApi.generatePortrait(uId, cId, prompt);
                          queryClient.setQueryData(['character', universeId, charIdParam], updatedCharacter);
                          await queryClient.refetchQueries({ queryKey: ['character', universeId, charIdParam] });
                          queryClient.setQueryData(['characters', universeId], (old: Character[] | undefined) => {
                            if (!old) return old;
                            return old.map(char =>
                              char.id === updatedCharacter.id ? updatedCharacter : char
                            );
                          });
                          toast.success('Портрет сгенерирован', { id: 'portrait', duration: 4000 });
                          setTimeout(() => toast.dismiss('portrait'), 4000);
                        } catch (error: any) {
                          const msg = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
                          toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg), { id: 'portrait', duration: 5000 });
                          setTimeout(() => toast.dismiss('portrait'), 5000);
                        }
                      });
                    }}
                    isGenerating={isGeneratingPortrait}
                    onUpload={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          toast.loading('Загрузка портрета...', { id: 'portrait' });
                          const updatedCharacter = await charactersApi.uploadPortrait(parseInt(universeId!), characterFromRoute.id, file);
                          // Обновляем кэш напрямую с данными из ответа
                          queryClient.setQueryData(['character', universeId, characterId], updatedCharacter);
                          // Также принудительно обновляем запрос для немедленного обновления UI
                          await queryClient.refetchQueries({ queryKey: ['character', universeId, characterId] });
                          // Обновляем конкретный элемент в списке персонажей
                          queryClient.setQueryData(['characters', universeId], (old: Character[] | undefined) => {
                            if (!old) return old;
                            return old.map(char => 
                              char.id === updatedCharacter.id ? updatedCharacter : char
                            );
                          });
                          toast.success('Портрет загружен', { id: 'portrait', duration: 4000 });
                          setTimeout(() => toast.dismiss('portrait'), 4000);
                        } catch (error: any) {
                          toast.error('Ошибка загрузки портрета: ' + (error.message || 'Неизвестная ошибка'), { id: 'portrait', duration: 5000 });
                          setTimeout(() => toast.dismiss('portrait'), 5000);
                        }
                      }
                    }}
                    onDelete={async () => {
                      try {
                        toast.loading('Удаление портрета...', { id: 'portrait' });
                        const updatedCharacter = await charactersApi.deletePortrait(parseInt(universeId!), characterFromRoute.id);
                        // Обновляем кэш напрямую с данными из ответа
                        queryClient.setQueryData(['character', universeId, characterId], updatedCharacter);
                        // Также принудительно обновляем запрос для немедленного обновления UI
                        await queryClient.refetchQueries({ queryKey: ['character', universeId, characterId] });
                        // Обновляем конкретный элемент в списке персонажей
                        queryClient.setQueryData(['characters', universeId], (old: Character[] | undefined) => {
                          if (!old) return old;
                          return old.map(char => 
                            char.id === updatedCharacter.id ? updatedCharacter : char
                          );
                        });
                        toast.success('Портрет удален', { id: 'portrait', duration: 4000 });
                        setTimeout(() => toast.dismiss('portrait'), 4000);
                      } catch (error: any) {
                        toast.error('Ошибка удаления портрета: ' + (error.message || 'Неизвестная ошибка'), { id: 'portrait', duration: 5000 });
                        setTimeout(() => toast.dismiss('portrait'), 5000);
                      }
                    }}
                />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-dark-800 mb-2">
                      {characterId === 'new' ? 'Новый персонаж' : characterFromRoute?.name}
                    </h1>
                    <p className="text-dark-500">
                      {characterId === 'new' ? 'Заполните данные вручную или используйте ИИ для генерации' : 'Редактирование профиля героя'}
                    </p>
                  </div>
                  {characterId !== 'new' && characterFromRoute && (
                    <button
                      onClick={() => fillAllFieldsRef.current?.()}
                      disabled={isGeneratingAllFields}
                      className="btn btn-secondary flex items-center gap-2 shrink-0"
                    >
                      {isGeneratingAllFields ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Генерация...
                        </>
                      ) : (
                        <>
                          <Wand2 size={18} />
                          Заполнить все поля
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Блок просмотра AI-анализа в карточке персонажа */}
            {characterId !== 'new' && characterFromRoute && (
              <div className="mb-8">
                {(() => {
                  const raw = characterFromRoute.ai_analysis;
                  let parsed: AIAnalysis | null = null;
                  if (raw) {
                    try {
                      parsed = JSON.parse(raw) as AIAnalysis;
                    } catch {
                      parsed = null;
                    }
                  }
                  const score = parsed?.score ?? 0;
                  const scoreColor = score >= 8 ? 'text-accent' : score >= 5 ? 'text-dark-600 dark:text-dark-300' : 'text-red-600 dark:text-red-400';
                  const issuesCount = parsed?.issues?.length ?? 0;
                  const hasAnalysis = !!parsed && (parsed.issues?.length || parsed.suggestions?.length || parsed.strengths?.length);

                  if (!hasAnalysis && !raw) {
                    return (
                      <div className="rounded-xl border border-dashed border-dark-200 dark:border-dark-600 bg-dark-50/50 dark:bg-dark-800/50 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Brain size={22} className="text-accent" />
                          </div>
                          <div>
                            <p className="font-medium text-dark-700 dark:text-dark-300">AI анализ</p>
                            <p className="text-sm text-dark-500 dark:text-dark-400">Получите оценку глубины персонажа и предложения по доработке</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAnalyze(characterFromRoute)}
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          <Brain size={18} />
                          Запустить AI анализ
                        </button>
                      </div>
                    );
                  }

                  if (raw && !parsed) {
                    return (
                      <div className="rounded-xl border border-dark-200 dark:border-dark-600 bg-dark-50/50 dark:bg-dark-800/50 p-4 flex items-center justify-between gap-4">
                        <p className="text-sm text-dark-500">Сохранённый анализ в неверном формате</p>
                        <button type="button" onClick={() => handleAnalyze(characterFromRoute)} className="btn btn-secondary text-sm">
                          Обновить анализ
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="rounded-xl border border-accent-dim bg-accent-subtle/30 dark:bg-dark-800/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                            <Brain size={22} className="text-accent" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold ${scoreColor}`}>Оценка: {score}/10</span>
                              {issuesCount > 0 && (
                                <span className="text-sm text-dark-500 dark:text-dark-400 flex items-center gap-1">
                                  <AlertTriangle size={14} />
                                  {issuesCount} проблем{issuesCount === 1 ? 'а' : issuesCount < 5 ? 'ы' : ''}
                                </span>
                              )}
                            </div>
                            {(parsed?.issues?.length || parsed?.suggestions?.length) ? (
                              <p className="text-sm text-dark-600 dark:text-dark-400 mt-1 line-clamp-2">
                                {parsed?.issues?.[0]?.description || (typeof parsed?.suggestions?.[0] === 'string' ? parsed.suggestions[0] : (parsed?.suggestions?.[0] as { title?: string; description?: string })?.description || (parsed?.suggestions?.[0] as { title?: string; description?: string })?.title) || ''}
                              </p>
                            ) : parsed?.strengths?.[0] && (
                              <p className="text-sm text-dark-600 dark:text-dark-400 mt-1 line-clamp-2">✓ {parsed.strengths[0]}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAiAnalysis(parsed);
                              setAnalyzingCharacter(characterFromRoute);
                            }}
                            className="btn btn-secondary text-sm flex items-center gap-1"
                          >
                            Подробнее
                            <ChevronRight size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnalyze(characterFromRoute)}
                            className="btn btn-ghost text-sm text-dark-500 hover:text-accent"
                          >
                            Обновить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <CharacterForm
              initialData={characterId === 'new' ? {} : (characterFromRoute || {})}
              onSubmit={handleFormSubmit}
              onCancel={() => navigate(`/universes/${universeId}/characters`)}
              isPending={createMutation.isPending || updateMutation.isPending}
              onAutofill={handleAutofill}
              generatingField={generatingField}
              universeId={parseInt(universeId!)}
              fillAllFieldsRef={fillAllFieldsRef}
              isGeneratingAllFields={isGeneratingAllFields}
              onGeneratingAllFieldsChange={setIsGeneratingAllFields}
              onFieldGenerated={(field, value) => {
                // Обновляем форму после генерации
                queryClient.setQueryData(['character', universeId, characterId], (old: any) => {
                  if (!old) return old;
                  return { ...old, [field]: value };
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {(isAnalyzing || aiAnalysis) && (
        <AICriticPanel
          analysis={aiAnalysis}
          isLoading={isAnalyzing}
          universeId={parseInt(universeId!)}
          onClose={() => { setAiAnalysis(null); setAnalyzingCharacter(null); }}
          onDelete={() => charactersApi.update(parseInt(universeId!), analyzingCharacter!.id, { ai_analysis: null }).then(() => {
                setAiAnalysis(null);
                queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
                queryClient.invalidateQueries({ queryKey: ['character', universeId, characterId] });
              })}
        />
      )}

    </div>
  );
}
