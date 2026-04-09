import { useState, useEffect, useRef } from 'react';
import { Character } from '../../types';
import { DemographicSection, FormField } from './CharacterFormFields';
import { Target, Users, MessageSquare, ScrollText, Sparkles, Brain, Save, X, Quote as QuoteIcon, Loader2, Image as ImageIcon, Copy, Check } from 'lucide-react';
import CharacterQuotesTab from './CharacterQuotesTab';
import { charactersApi, chatApi } from '../../api';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

interface CharacterFormProps {
  initialData: Partial<Character>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
  onAutofill: (field: string) => Promise<void>;
  generatingField: string | null;
  universeId: number;
  onFillAllFields?: () => void;
  isGeneratingAllFields?: boolean;
  onGeneratingAllFieldsChange?: (isGenerating: boolean) => void;
  fillAllFieldsRef?: React.MutableRefObject<(() => void) | null>;
  onFieldGenerated?: (field: string, value: string) => void;
}

export default function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  isPending,
  onAutofill,
  generatingField,
  universeId,
  onFillAllFields,
  isGeneratingAllFields: externalIsGeneratingAllFields,
  onGeneratingAllFieldsChange,
  fillAllFieldsRef,
  onFieldGenerated: _onFieldGenerated
}: CharacterFormProps) {
  const [formState, setFormState] = useState<any>(initialData);
  const [activeTab, setActiveTab] = useState('basic');
  const [isGeneratingPortraitPrompt, setIsGeneratingPortraitPrompt] = useState(false);
  const [portraitPromptCopied, setPortraitPromptCopied] = useState(false);
  const [_internalIsGeneratingAllFields, setInternalIsGeneratingAllFields] = useState(false);
  const setIsGeneratingAllFields = externalIsGeneratingAllFields !== undefined
    ? () => {} // Если управление извне, не используем внутреннее состояние
    : setInternalIsGeneratingAllFields;
  const queryClient = useQueryClient();
  
  // Сохраняем ссылку на функцию для вызова извне
  useEffect(() => {
    if (fillAllFieldsRef) {
      if (initialData.id && tabFields[activeTab]) {
        fillAllFieldsRef.current = handleFillAllTabFields;
      } else {
        fillAllFieldsRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, initialData.id]);

  useEffect(() => {
    // Обновляем форму только при первой загрузке или при изменении ID персонажа
    // Это предотвращает перезапись локальных изменений при обновлении из API
    const isNewCharacter = !formState.id && initialData.id;
    const isDifferentCharacter = formState.id && initialData.id && formState.id !== initialData.id;
    
    if (isNewCharacter || isDifferentCharacter || Object.keys(formState).length === 0) {
      setFormState(initialData);
    }
  }, [initialData.id]); // Обновляем только при изменении ID
  
  // Отдельный эффект для обновления сгенерированных полей
  // Обновляем форму когда generatingField становится null (генерация завершена)
  // и initialData содержит новое значение для этого поля
  const prevGeneratingField = useRef<string | null>(null);
  useEffect(() => {
    if (prevGeneratingField.current && !generatingField && initialData.id && formState.id === initialData.id) {
      // Генерация только что завершилась, обновляем поле из initialData
      const fieldName = prevGeneratingField.current;
      const generatedValue = (initialData as any)[fieldName];
      const currentValue = (formState as any)[fieldName];
      if (generatedValue !== undefined && generatedValue !== null && generatedValue !== currentValue) {
        setFormState((prev: any) => ({ ...prev, [fieldName]: generatedValue }));
      }
    }
    prevGeneratingField.current = generatingField;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formState intentionally excluded to avoid loops
  }, [generatingField, initialData, formState.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
        setFormState((prev: any) => ({ ...prev, [name]: value === '' ? null : parseInt(value, 10) }));
    } else {
        setFormState((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formState);
  };

  const tabs = [
    { id: 'basic', label: 'Основные', icon: Users },
    { id: 'motivation', label: 'Мотивация', icon: Target },
    { id: 'traits', label: 'Личность', icon: Brain },
    { id: 'speech', label: 'Речь и манеры', icon: MessageSquare },
    { id: 'backstory', label: 'Предыстория', icon: ScrollText },
  ];

  if (initialData.id) {
    tabs.push({ id: 'portrait', label: 'Портрет', icon: ImageIcon });
    tabs.push({ id: 'quotes', label: 'Цитаты', icon: QuoteIcon });
  }
  
  const handleGeneratePortraitPrompt = async () => {
    if (!initialData.id || !universeId) return;
    
    setIsGeneratingPortraitPrompt(true);
    try {
      const response = await chatApi.send({
        universe_id: universeId,
        messages: [
          { 
            role: 'system', 
            content: `Ты эксперт по созданию промптов для AI-генераторов изображений (Midjourney, Stable Diffusion, DALL-E, Leonardo.ai).
            
Твоя задача: создать чистый, оптимизированный промпт для портрета персонажа, который можно сразу использовать в генераторе изображений.

Правила:
1. Используй только ключевые визуальные характеристики
2. Формат: описание внешности, стиль, настроение, качество
3. Без лишних слов, только то, что нужно для генерации изображения
4. Используй английские термины для лучшего понимания AI (например: "portrait", "detailed", "high quality")
5. Структура: [тип изображения], [описание внешности], [стиль], [качество/детали]
6. Пример хорошего промпта: "portrait of a young woman with long dark hair, piercing blue eyes, wearing medieval armor, fantasy art style, highly detailed, professional lighting, 8k resolution"

Верни ТОЛЬКО промпт, без дополнительных объяснений.` 
          },
          { 
            role: 'user', 
            content: `Создай промпт для портрета персонажа:
Имя: ${formState.name || initialData.name || 'Персонаж'}
Внешность: ${formState.appearance || initialData.appearance || 'не указана'}
Роль: ${formState.role || initialData.role || 'не указана'}
Пол: ${formState.gender || initialData.gender || 'не указан'}
Возраст: ${formState.age || initialData.age || 'не указан'}

Создай чистый промпт для AI-генератора изображений.` 
          }
        ],
        provider: 'ollama',
      });
      
      const prompt = response.content.trim();
      // Очищаем промпт от возможных лишних символов и форматирования
      const cleanPrompt = prompt
        .replace(/^["']|["']$/g, '') // Убираем кавычки в начале/конце
        .replace(/^Промпт:?\s*/i, '') // Убираем "Промпт:" в начале
        .replace(/^Prompt:?\s*/i, '') // Убираем "Prompt:" в начале
        .trim();
      
      // Обновляем форму и базу данных
      const updatedState = { ...formState, portrait_ai_prompt: cleanPrompt };
      setFormState(updatedState);
      
      await charactersApi.update(universeId, initialData.id, { portrait_ai_prompt: cleanPrompt } as any);
      queryClient.invalidateQueries({ queryKey: ['character', universeId, String(initialData.id)] });
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
      
      toast.success('Промпт сгенерирован');
    } catch (error: any) {
      toast.error('Ошибка генерации: ' + error.message);
    } finally {
      setIsGeneratingPortraitPrompt(false);
    }
  };
  
  const handleCopyPortraitPrompt = () => {
    if (formState.portrait_ai_prompt) {
      navigator.clipboard.writeText(formState.portrait_ai_prompt);
      setPortraitPromptCopied(true);
      toast.success('Промпт скопирован');
      setTimeout(() => setPortraitPromptCopied(false), 2000);
    }
  };
  
  const handlePortraitPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState((prev: any) => ({ ...prev, portrait_ai_prompt: e.target.value }));
  };
  
  const handleFillAllTabFields = async () => {
    if (onFillAllFields) {
      onFillAllFields();
      return;
    }
    
    if (!initialData.id || !universeId) {
      toast.error('Сначала сохраните персонажа');
      return;
    }
    
    setIsGeneratingAllFields(true);
    onGeneratingAllFieldsChange?.(true);
    
    const currentTabFields = tabFields[activeTab];
    if (!currentTabFields) {
      setIsGeneratingAllFields(false);
      onGeneratingAllFieldsChange?.(false);
      return;
    }
    
    // Сохраняем ссылку на функцию для вызова извне
    if (fillAllFieldsRef) {
      fillAllFieldsRef.current = handleFillAllTabFields;
    }
    
    try {
      // Генерируем все поля последовательно
      const updatedState = { ...formState };
      
      const fieldLabels: Record<string, string> = {
        role: 'Роль в сюжете',
        profession: 'Профессия',
        description: 'Краткое описание',
        nationality: 'Национальность',
        birth_place: 'Место рождения',
        goals: 'Цели и желания',
        fears: 'Страхи',
        conflicts: 'Внутренние и внешние конфликты',
        character_values: 'Ценности и принципы',
        traits: 'Черты характера',
        appearance: 'Внешность',
        skills: 'Навыки и умения',
        abilities: 'Особые способности',
        speech_pattern: 'Манера речи',
        mannerisms: 'Привычные жесты и манеры',
        habits: 'Привычки',
        backstory: 'Предыстория',
        relationships: 'Отношения с другими персонажами'
      };
      
      for (const fieldName of currentTabFields.fields) {
        try {
          const fieldLabel = fieldLabels[fieldName] || fieldName;
          
          // Для каждого поля формируем свой контекст и инструкции
          // Для поля description исключаем возраст и внешность из контекста
          let fieldContextStr = '';
          let fieldGenderInstruction = '';
          
          if (fieldName === 'description') {
            // Для краткого описания - только характер, без возраста и внешности
            const descriptionContext: string[] = [];
            if (formState.name) descriptionContext.push(`Имя: ${formState.name}`);
            if (formState.gender) descriptionContext.push(`Пол: ${formState.gender}`);
            if (formState.role) descriptionContext.push(`Роль: ${formState.role}`);
            if (formState.profession) descriptionContext.push(`Профессия: ${formState.profession}`);
            fieldContextStr = descriptionContext.length > 0 
              ? `\n\nУчти следующие данные о персонаже:\n${descriptionContext.join('\n')}` 
              : '';
            
            // Специальные инструкции для description
            const languageInstruction = '\n\nОБЯЗАТЕЛЬНО: Генерируй описание ТОЛЬКО на русском языке.';
            if (formState.gender === 'Мужской') {
              fieldGenderInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж мужского пола - используй мужские формы слов (он, его, мужчина и т.д.).`;
            } else if (formState.gender === 'Женский') {
              fieldGenderInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши её личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж женского пола - используй женские формы слов (она, её, женщина и т.д.).`;
            } else if (formState.gender === 'Безполое') {
              fieldGenderInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики. Персонаж безполый - используй нейтральные формы (существо, персонаж, оно и т.д.).`;
            } else {
              fieldGenderInstruction = `${languageInstruction}\n\nВАЖНО: Это краткое описание характера персонажа. Опиши его личность, характер, внутренние качества, мотивацию, мировоззрение. НЕ упоминай возраст, внешность или физические характеристики.`;
            }
          } else {
            // Для других полей используем полный контекст
            const characterContext: string[] = [];
            if (formState.name) characterContext.push(`Имя: ${formState.name}`);
            if (formState.gender) characterContext.push(`Пол: ${formState.gender}`);
            if (formState.age) characterContext.push(`Возраст: ${formState.age}`);
            if (formState.role) characterContext.push(`Роль: ${formState.role}`);
            if (formState.profession) characterContext.push(`Профессия: ${formState.profession}`);
            if (formState.description) characterContext.push(`Описание: ${formState.description}`);
            fieldContextStr = characterContext.length > 0 
              ? `\n\nУчти следующие данные о персонаже:\n${characterContext.join('\n')}` 
              : '';
            
            // Обычные инструкции по полу для других полей
            if (formState.gender === 'Мужской') {
              fieldGenderInstruction = '\n\nВАЖНО: Персонаж мужского пола. Используй мужские формы слов (он, его, молодой человек, мужчина и т.д.).';
            } else if (formState.gender === 'Женский') {
              fieldGenderInstruction = '\n\nВАЖНО: Персонаж женского пола. Используй женские формы слов (она, её, молодая женщина, женщина и т.д.).';
            } else if (formState.gender === 'Безполое') {
              fieldGenderInstruction = '\n\nВАЖНО: Персонаж безполый. Избегай указания пола, используй нейтральные формы (существо, персонаж, оно и т.д.).';
            }
          }
          
          const systemPrompt = `Ты — помощник писателя. Генерируй значение для поля "${fieldLabel}" персонажа "${formState.name || 'персонажа'}".${fieldContextStr}${fieldGenderInstruction}

КРИТИЧЕСКИ ВАЖНО:
- Верни ТОЛЬКО текст, без JSON, без кавычек, без форматирования
- НЕ используй формат {"field": "value"} или подобный
- Верни просто текст, который можно сразу вставить в поле формы
- Если это описание - верни обычный текст, не JSON объект`;
          
          const response = await chatApi.send({
            universe_id: universeId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Сгенерируй ${fieldLabel.toLowerCase()}` }
            ],
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
          updatedState[fieldName] = value;
          setFormState(updatedState);
          
          // Сохраняем каждое поле в базу данных сразу после генерации
          try {
            await charactersApi.update(universeId, initialData.id, { [fieldName]: value });
          } catch (saveError: any) {
            console.error(`Ошибка сохранения поля ${fieldName}:`, saveError);
            toast.error(`Ошибка сохранения ${fieldLabels[fieldName] || fieldName}`);
          }
        } catch (error: any) {
          console.error(`Ошибка генерации поля ${fieldName}:`, error);
          toast.error(`Ошибка генерации ${fieldLabels[fieldName] || fieldName}`);
        }
      }
      
      // Обновляем кэш после генерации всех полей
      queryClient.invalidateQueries({ queryKey: ['character', universeId, String(initialData.id)] });
      queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
      
      toast.success(`Все поля раздела "${currentTabFields.label}" заполнены и сохранены`);
    } catch (error: any) {
      toast.error('Ошибка генерации: ' + error.message);
    } finally {
      setIsGeneratingAllFields(false);
      onGeneratingAllFieldsChange?.(false);
    }
  };

  // Определяем, есть ли кнопка "Заполнить все поля" для текущего таба
  const tabFields: Record<string, { fields: string[], label: string }> = {
    basic: {
      fields: ['role', 'profession', 'description', 'nationality', 'birth_place'],
      label: 'Основные поля'
    },
    motivation: {
      fields: ['goals', 'fears', 'conflicts', 'character_values'],
      label: 'Мотивация'
    },
    traits: {
      fields: ['traits', 'appearance', 'skills', 'abilities'],
      label: 'Личность'
    },
    speech: {
      fields: ['speech_pattern', 'mannerisms', 'habits'],
      label: 'Речь и манеры'
    },
    backstory: {
      fields: ['backstory', 'relationships'],
      label: 'Предыстория'
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="flex flex-nowrap gap-2 border-b border-dark-100 pb-4 overflow-x-auto items-center">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700 shadow-sm'
                : 'text-dark-500 hover:bg-dark-100 hover:text-dark-700'
            }`}
          >
            <tab.icon size={16} className="shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'basic' && (
          <div className="space-y-6 animate-fadeIn">
            <DemographicSection 
              state={formState} 
              onChange={handleChange} 
              onDiceClick={async (field: string) => {
                await onAutofill(field);
                // После успешной генерации обновляем форму из initialData
                // Используем setTimeout чтобы дать время обновиться кэшу через useQuery
                setTimeout(() => {
                  const value = (initialData as any)[field];
                  if (value !== undefined && value !== null && value !== (formState as any)[field]) {
                    setFormState((prev: any) => ({ ...prev, [field]: value }));
                  }
                }, 300);
              }} 
              generatingField={generatingField} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Роль в сюжете" name="role" value={formState.role} onChange={handleChange} onDiceClick={() => onAutofill('role')} isGenerating={generatingField === 'role'} placeholder="Главный герой, антагонист..." />
              <FormField label="Профессия" name="profession" value={formState.profession} onChange={handleChange} onDiceClick={() => onAutofill('profession')} isGenerating={generatingField === 'profession'} />
            </div>
            <FormField label="Краткое описание" name="description" type="textarea" value={formState.description} onChange={handleChange} onDiceClick={() => onAutofill('description')} isGenerating={generatingField === 'description'} rows={2} />
          </div>
        )}

        {activeTab === 'motivation' && (
          <div className="space-y-4 animate-fadeIn">
            <FormField label="Цели и желания" name="goals" type="textarea" value={formState.goals} onChange={handleChange} onDiceClick={() => onAutofill('goals')} isGenerating={generatingField === 'goals'} />
            <FormField label="Страхи" name="fears" type="textarea" value={formState.fears} onChange={handleChange} onDiceClick={() => onAutofill('fears')} isGenerating={generatingField === 'fears'} />
            <FormField label="Внутренние и внешние конфликты" name="conflicts" type="textarea" value={formState.conflicts} onChange={handleChange} onDiceClick={() => onAutofill('conflicts')} isGenerating={generatingField === 'conflicts'} />
            <FormField label="Ценности и принципы" name="character_values" type="textarea" value={formState.character_values} onChange={handleChange} onDiceClick={() => onAutofill('character_values')} isGenerating={generatingField === 'character_values'} />
          </div>
        )}

        {activeTab === 'traits' && (
          <div className="space-y-4 animate-fadeIn">
            <FormField label="Черты характера" name="traits" type="textarea" value={formState.traits} onChange={handleChange} onDiceClick={() => onAutofill('traits')} isGenerating={generatingField === 'traits'} />
            <FormField label="Внешность" name="appearance" type="textarea" value={formState.appearance} onChange={handleChange} onDiceClick={() => onAutofill('appearance')} isGenerating={generatingField === 'appearance'} />
            <FormField label="Навыки и умения" name="skills" type="textarea" value={formState.skills} onChange={handleChange} onDiceClick={() => onAutofill('skills')} isGenerating={generatingField === 'skills'} />
            <FormField label="Особые способности" name="abilities" type="textarea" value={formState.abilities} onChange={handleChange} onDiceClick={() => onAutofill('abilities')} isGenerating={generatingField === 'abilities'} />
          </div>
        )}

        {activeTab === 'speech' && (
          <div className="space-y-4 animate-fadeIn">
             <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
              <label className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2 uppercase">
                <Sparkles size={16} /> Развитие речи
              </label>
              <select
                name="speech_development"
                value={formState.speech_development || 'human'}
                onChange={handleChange}
                className="input bg-white border-amber-200"
              >
                <option value="human">Человек (речь зависит от возраста)</option>
                <option value="ageless">Вне возраста (ИИ, робот, вечное существо)</option>
              </select>
              <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                Если выбрано «Человек», ИИ будет автоматически отыгрывать детский лепет, если возраст персонажа в текущий момент времени во вселенной меньше 3 лет.
              </p>
            </div>
            <FormField label="Манера речи" name="speech_pattern" type="textarea" value={formState.speech_pattern} onChange={handleChange} onDiceClick={() => onAutofill('speech_pattern')} isGenerating={generatingField === 'speech_pattern'} />
            <FormField label="Привычные жесты и манеры" name="mannerisms" type="textarea" value={formState.mannerisms} onChange={handleChange} onDiceClick={() => onAutofill('mannerisms')} isGenerating={generatingField === 'mannerisms'} />
            <FormField label="Привычки" name="habits" type="textarea" value={formState.habits} onChange={handleChange} onDiceClick={() => onAutofill('habits')} isGenerating={generatingField === 'habits'} />
          </div>
        )}

        {activeTab === 'backstory' && (
          <div className="space-y-4 animate-fadeIn">
            <FormField label="Предыстория" name="backstory" type="textarea" value={formState.backstory} onChange={handleChange} onDiceClick={() => onAutofill('backstory')} isGenerating={generatingField === 'backstory'} rows={10} />
            <FormField label="Отношения с другими персонажами" name="relationships" type="textarea" value={formState.relationships} onChange={handleChange} onDiceClick={() => onAutofill('relationships')} isGenerating={generatingField === 'relationships'} placeholder="JSON или текст..." />
          </div>
        )}

        {activeTab === 'portrait' && initialData.id && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
                <ImageIcon size={20} className="text-purple-600" />
                Промпт для AI-генератора изображений
              </h3>
              <p className="text-sm text-dark-600 mb-4">
                Сгенерируйте промпт для создания портрета персонажа в AI-генераторах изображений (Midjourney, Stable Diffusion, DALL-E, Leonardo.ai и др.)
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-dark-500 uppercase tracking-wider">
                    Промпт (готов к использованию)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGeneratePortraitPrompt}
                      disabled={isGeneratingPortraitPrompt}
                      className="btn btn-primary text-sm flex items-center gap-2"
                    >
                      {isGeneratingPortraitPrompt ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Генерация...
                        </>
                      ) : (
                        <>
                          <Brain size={16} />
                          Сгенерировать промпт
                        </>
                      )}
                    </button>
                    {formState.portrait_ai_prompt && (
                      <button
                        type="button"
                        onClick={handleCopyPortraitPrompt}
                        className="btn btn-secondary text-sm flex items-center gap-2"
                        title="Копировать промпт"
                      >
                        {portraitPromptCopied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
                
                <textarea
                  name="portrait_ai_prompt"
                  value={formState.portrait_ai_prompt || ''}
                  onChange={handlePortraitPromptChange}
                  rows={6}
                  className="input w-full resize-none font-mono text-sm"
                  placeholder="Промпт будет сгенерирован автоматически или введите вручную..."
                />
                
                {formState.portrait_ai_prompt && (
                  <div className="mt-3 p-3 bg-white border border-purple-200 rounded-lg">
                    <p className="text-xs text-dark-500 mb-2">Использование:</p>
                    <p className="text-xs text-dark-600">
                      Скопируйте промпт выше и вставьте его в любой AI-генератор изображений. Промпт оптимизирован для Midjourney, Stable Diffusion, DALL-E и других генераторов.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quotes' && initialData.id && (
            <CharacterQuotesTab characterId={initialData.id} universeId={universeId} characterName={formState.name} />
        )}
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-dark-100">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex items-center gap-2">
          <X size={18} /> Отмена
        </button>
        <button type="submit" disabled={isPending} className="btn btn-primary flex items-center gap-2 px-8">
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {initialData.id ? 'Обновить персонажа' : 'Создать персонажа'}
        </button>
      </div>
    </form>
  );
}
