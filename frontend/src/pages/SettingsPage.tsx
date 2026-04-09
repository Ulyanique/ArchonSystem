import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save, Loader2, Cpu, Layout, Globe, Shield, Zap, Info, FileText, RotateCcw, Image, Bell } from 'lucide-react';
import { systemSettingsApi, chatApi } from '../api';
import PromptSettingsEditor from '../components/PromptSettingsEditor';
import { logUiEvent } from '../store/jobQueue';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.get,
  });

  const [formState, setFormState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [promptSettings, setPromptSettings] = useState<any>(null);
  const [promptSettingsError, setPromptSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormState(settings);
      // Загружаем настройки промптов
      try {
        const raw = settings.prompt_settings;
        const promptSettingsJson = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : '{}');
        setPromptSettings(JSON.parse(promptSettingsJson));
      } catch (e) {
        setPromptSettings({});
      }
    }
  }, [settings]);

  const { data: promptDefaults } = useQuery({
    queryKey: ['prompt-defaults'],
    queryFn: systemSettingsApi.getPromptDefaults,
  });

  const updateMutation = useMutation({
    mutationFn: systemSettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Настройки сохранены');
      logUiEvent('Изменение настроек системы');
    },
    onError: (error: any) => {
      toast.error('Ошибка сохранения: ' + (error.response?.data?.detail || error.message));
    }
  });

  const { data: ollamaModels = [] } = useQuery({
    queryKey: ['models', 'ollama'],
    queryFn: () => chatApi.getModels('ollama'),
    enabled: !!formState,
  });

  const { data: routeraiModels = [] } = useQuery({
    queryKey: ['models', 'routerai'],
    queryFn: () => chatApi.getModels('routerai'),
    enabled: !!formState && !!formState.routerai_api_key,
  });

  const { data: openrouterModels = [] } = useQuery({
    queryKey: ['models', 'openrouter'],
    queryFn: () => chatApi.getModels('openrouter'),
    enabled: !!formState,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormState((prev: any) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Сохраняем настройки промптов в formState перед отправкой
    if (promptSettings !== null) {
      try {
        formState.prompt_settings = JSON.stringify(promptSettings);
      } catch (e) {
        toast.error('Ошибка сохранения настроек промптов: ' + (e as Error).message);
        return;
      }
    }
    updateMutation.mutate(formState);
  };

  const handlePromptSettingsChange = (newSettings: any) => {
    setPromptSettings(newSettings);
    setPromptSettingsError(null);
    // Валидируем настройки
    systemSettingsApi.validatePromptSettings(newSettings).then(result => {
      if (!result.valid) {
        setPromptSettingsError(result.message);
      }
    }).catch(() => {
      // Игнорируем ошибки валидации при вводе
    });
  };

  const handleResetPromptSettings = () => {
    if (promptDefaults) {
      setPromptSettings(promptDefaults);
      setPromptSettingsError(null);
    }
  };

  if (isLoading || !formState) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  const tabs = [
    { id: 'llm', label: 'ИИ Провайдеры', icon: Cpu },
    { id: 'prompts', label: 'Промпты', icon: Zap },
    { id: 'ui', label: 'Интерфейс', icon: Layout },
    { id: 'advanced', label: 'Расширенные', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark-800 page-title">Настройки системы</h1>
          <p className="text-dark-500 mt-1 page-subtitle">Управление глобальными параметрами ARCHON</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          className="btn btn-primary flex items-center gap-2 px-6"
        >
          {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Сохранить всё
        </button>
      </div>

      <div className="flex gap-2 mb-8 bg-dark-50 p-1 rounded-xl border border-dark-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-primary-600 shadow-sm border border-dark-200'
                : 'text-dark-500 hover:text-dark-700 hover:bg-dark-100'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {activeTab === 'llm' && (
          <div className="space-y-8 animate-fadeIn">
            {/* General LLM */}
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4 flex items-center gap-2">
                <Zap size={20} className="text-primary-500" /> Основной провайдер
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Провайдер по умолчанию</label>
                  <select
                    name="default_provider"
                    value={formState.default_provider}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    <option value="ollama">Ollama (Локально)</option>
                    <option value="deepseek">DeepSeek (Cloud)</option>
                    <option value="openrouter">OpenRouter (Cloud)</option>
                    <option value="routerai">RouterAI (Cloud)</option>
                  </select>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-sm text-blue-700 leading-relaxed flex gap-2">
                        <Info size={20} className="shrink-0" />
                        Этот провайдер будет использоваться для всех автоматических функций (генерация, критик, перевод), если не указано иное.
                    </p>
                </div>
              </div>
            </section>

            {/* Ollama */}
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4">Ollama Настройки</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Base URL</label>
                  <input
                    name="ollama_base_url"
                    value={formState.ollama_base_url}
                    onChange={handleChange}
                    placeholder="http://localhost:11434"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель</label>
                  <select
                    name="ollama_model"
                    value={formState.ollama_model}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    {(() => {
                      const models = (ollamaModels as any)?.models || [];
                      const currentModel = formState.ollama_model;
                      // Убеждаемся, что текущая модель всегда в списке
                      const uniqueModels = Array.from(new Set([currentModel, ...models]));
                      
                      // Сортируем модели: DeepSeek и QWEN сначала
                      const modelPriority = (modelName: string): number => {
                        const lower = modelName.toLowerCase();
                        if (lower.includes('deepseek')) return 1; // DeepSeek - самый высокий приоритет
                        if (lower.includes('qwen')) return 2; // QWEN - второй приоритет
                        return 3; // Остальные модели
                      };
                      
                      const sortedModels = [...uniqueModels].sort((a, b) => {
                        const priorityA = modelPriority(a);
                        const priorityB = modelPriority(b);
                        if (priorityA !== priorityB) {
                          return priorityA - priorityB;
                        }
                        // Если приоритеты одинаковые, сортируем по алфавиту
                        return a.localeCompare(b);
                      });
                      
                      return sortedModels.map((m: string) => (
                        <option key={m} value={m}>{m}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>
            </section>

            {/* DeepSeek */}
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4">DeepSeek Настройки</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">API Key</label>
                  <input
                    type="password"
                    name="deepseek_api_key"
                    value={formState.deepseek_api_key}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Base URL</label>
                  <input
                    name="deepseek_base_url"
                    value={formState.deepseek_base_url}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель</label>
                  <input
                    name="deepseek_model"
                    value={formState.deepseek_model}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
              </div>
            </section>

            {/* OpenRouter */}
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4">OpenRouter Настройки</h2>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-4">
                <p className="text-sm text-green-700 leading-relaxed flex gap-2">
                  <Info size={20} className="shrink-0" />
                  <span>В OpenRouter есть бесплатные модели с суффиксом <strong>:free</strong>! Например, <strong>google/gemini-pro-1.5:free</strong> или <strong>meta-llama/llama-3.2-3b-instruct:free</strong>. Бесплатные модели имеют ограничение: 20 запросов в минуту, 50 запросов в день при нулевом балансе.</span>
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-sm text-blue-700 leading-relaxed flex gap-2">
                  <Info size={20} className="shrink-0" />
                  <span><strong>После пополнения баланса:</strong> Убедитесь, что используете платную модель (без суффикса <strong>:free</strong>). Если проблемы сохраняются, проверьте баланс на <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai</a> и убедитесь, что API ключ правильный.</span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">API Key</label>
                  <input
                    type="password"
                    name="openrouter_api_key"
                    value={formState.openrouter_api_key}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель</label>
                  <select
                    name="openrouter_model"
                    value={formState.openrouter_model}
                    onChange={handleChange}
                    className="input w-full"
                    disabled={!formState.openrouter_api_key}
                  >
                    {(() => {
                      const models = (openrouterModels as any)?.models || [];
                      const currentModel = formState.openrouter_model;
                      
                      // Популярные модели, которые всегда должны быть доступны
                      const popularModels = [
                        'openrouter/aurora-alpha',
                        'google/gemini-pro-1.5',
                        'anthropic/claude-3.5-sonnet',
                        'openai/gpt-4-turbo',
                        'openai/gpt-3.5-turbo',
                      ];
                      
                      // Объединяем модели из API с популярными моделями
                      const allModels = Array.from(new Set([
                        ...popularModels,
                        ...models,
                        currentModel
                      ].filter(Boolean)));
                      
                      if (allModels.length === 0) {
                        return <option value="">Загрузка моделей...</option>;
                      }
                      
                      // Сортируем модели: бесплатные (:free) и популярные сначала, затем текущая модель
                      const sortedModels = [...allModels].sort((a, b) => {
                        const aIsFree = a.includes(':free');
                        const bIsFree = b.includes(':free');
                        const aIsPopular = popularModels.includes(a);
                        const bIsPopular = popularModels.includes(b);
                        
                        // Приоритет: бесплатные > популярные > текущая модель > остальные
                        if (aIsFree && !bIsFree) return -1;
                        if (!aIsFree && bIsFree) return 1;
                        if (aIsPopular && !bIsPopular) return -1;
                        if (!aIsPopular && bIsPopular) return 1;
                        if (a === currentModel && b !== currentModel) return -1;
                        if (a !== currentModel && b === currentModel) return 1;
                        return a.localeCompare(b);
                      });
                      
                      return sortedModels.map((m: string) => {
                        const isFree = m.includes(':free');
                        const isPopular = popularModels.includes(m);
                        return (
                          <option key={m} value={m}>
                            {m}{isFree ? ' 🆓 (бесплатно)' : ''}{isPopular && !isFree ? ' ⭐' : ''}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>
            </section>

            {/* Генератор картинок (портреты персонажей) */}
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4 flex items-center gap-2">
                <Image size={22} /> Генератор картинок
              </h2>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-sm text-blue-700 leading-relaxed flex gap-2">
                  <Info size={20} className="shrink-0" />
                  <span>Используется для генерации портретов персонажей. Можно выбрать <strong>OpenRouter</strong> (модели с поддержкой image) или <strong>Cloudflare Workers AI</strong> — бесплатно до 100 000 запросов/день (<a href="https://github.com/saurav-z/free-image-generation-api" target="_blank" rel="noopener noreferrer" className="underline">free-image-generation-api</a>).</span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Провайдер изображений</label>
                  <select
                    name="image_provider"
                    value={formState.image_provider ?? 'openrouter'}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    <option value="openrouter">OpenRouter (облако, платные модели)</option>
                    <option value="cloudflare">Cloudflare Workers AI (бесплатный лимит)</option>
                    <option value="pixazo">Pixazo (Flux: бесплатный Schnell и платный Pro)</option>
                    <option value="whisk">Whisk (Google Labs, бесплатно по cookie)</option>
                  </select>
                </div>
                {(formState.image_provider ?? 'openrouter') === 'whisk' && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Cookie Google (Whisk)</label>
                      <input
                        name="whisk_google_cookie"
                        type="password"
                        value={formState.whisk_google_cookie ?? ''}
                        onChange={handleChange}
                        placeholder="Cookie из labs.google (см. подсказку)"
                        className="input w-full"
                      />
                      <p className="text-xs text-dark-500 mt-1">
                        Войдите на <a href="https://labs.google/fx/tools/whisk" target="_blank" rel="noopener noreferrer" className="underline">labs.google/fx/tools/whisk</a>, откройте DevTools (F12) → Application → Cookies → скопируйте значение Cookie (или используйте расширение Cookie Editor → Export → Header String). Не передавайте cookie третьим лицам.
                      </p>
                    </div>
                  </>
                )}
                {(formState.image_provider ?? 'openrouter') === 'pixazo' && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель Pixazo</label>
                      <select
                        name="pixazo_model"
                        value={formState.pixazo_model ?? 'flux-1-schnell'}
                        onChange={handleChange}
                        className="input w-full"
                      >
                        <option value="flux-1-schnell">Flux 1 Schnell — бесплатно (только Text-to-Image)</option>
                        <option value="flux-2-pro">Flux 2 Pro — платно (Text-to-Image и Image-to-Image)</option>
                      </select>
                      <p className="text-xs text-dark-500 mt-1">По умолчанию используется бесплатная модель. Image-to-Image (по референсу) только в Flux 2 Pro.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Pixazo API ключ</label>
                      <input
                        name="pixazo_api_key"
                        type="password"
                        value={formState.pixazo_api_key ?? ''}
                        onChange={handleChange}
                        placeholder="Ключ из api-console.pixazo.ai"
                        className="input w-full"
                      />
                      <p className="text-xs text-dark-500 mt-1">Ключ из <a href="https://api-console.pixazo.ai" target="_blank" rel="noopener noreferrer" className="underline">api-console.pixazo.ai</a>. Для Flux 2 Pro нужен пополненный баланс.</p>
                    </div>
                  </>
                )}
                {(formState.image_provider ?? 'openrouter') === 'openrouter' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель для генерации изображений (OpenRouter)</label>
                    <input
                      name="openrouter_image_model"
                      type="text"
                      value={formState.openrouter_image_model ?? 'sourceful/riverflow-v2-pro'}
                      onChange={handleChange}
                      list="openrouter-image-models"
                      placeholder="Например: sourceful/riverflow-v2-pro или введите свой model id"
                      className="input w-full"
                    />
                    <datalist id="openrouter-image-models">
                      {[
                        'sourceful/riverflow-v2-pro',
                        'sourceful/riverflow-v2-fast',
                        'google/gemini-2.5-flash-image',
                        'google/gemini-2.5-flash-image-preview',
                        'google/gemini-flash-1.5',
                        'google/gemini-flash-1.5-8b',
                      ].map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <p className="text-xs text-dark-500 mt-1">Выберите из списка при клике или введите модель вручную (например с <a href="https://openrouter.ai/models?capabilities=image" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/models</a>).</p>
                  </div>
                )}
                {(formState.image_provider ?? 'openrouter') === 'cloudflare' && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">URL Cloudflare Worker</label>
                      <input
                        name="cloudflare_image_url"
                        type="url"
                        value={formState.cloudflare_image_url ?? ''}
                        onChange={handleChange}
                        placeholder="https://your-worker.your-subdomain.workers.dev"
                        className="input w-full"
                      />
                      <p className="text-xs text-dark-500 mt-1">Развёрнутый Worker из <a href="https://github.com/saurav-z/free-image-generation-api" target="_blank" rel="noopener noreferrer" className="underline">free-image-generation-api</a> или свой endpoint.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">API ключ Worker</label>
                      <input
                        name="cloudflare_image_api_key"
                        type="password"
                        value={formState.cloudflare_image_api_key ?? ''}
                        onChange={handleChange}
                        placeholder="Секретный ключ, заданный в Variables Worker"
                        className="input w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

             {/* RouterAI */}
             <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4">RouterAI Настройки (routerai.ru)</h2>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-4">
                <p className="text-sm text-green-700 leading-relaxed flex gap-2">
                  <Info size={20} className="shrink-0" />
                  <span>В RouterAI есть бесплатные модели! Например, <strong>qwen/qwen3-235b-a22b-thinking-2507</strong> доступна бесплатно через провайдер Alibaba (0 ₽ за входящие и исходящие токены). RouterAI автоматически выбирает провайдера с самой низкой ценой.</span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">API Key</label>
                  <input
                    type="password"
                    name="routerai_api_key"
                    value={formState.routerai_api_key || ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Введите API ключ RouterAI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Base URL</label>
                  <input
                    name="routerai_base_url"
                    value={formState.routerai_base_url || 'https://routerai.ru/api/v1'}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="https://routerai.ru/api/v1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Модель</label>
                  <select
                    name="routerai_model"
                    value={formState.routerai_model || ''}
                    onChange={handleChange}
                    className="input w-full"
                    disabled={!formState.routerai_api_key}
                  >
                    {(() => {
                      const models = (routeraiModels as any)?.models || [];
                      const currentModel = formState.routerai_model;
                      // Убеждаемся, что текущая модель всегда в списке
                      const uniqueModels = Array.from(new Set([currentModel, ...models].filter(Boolean)));
                      if (uniqueModels.length === 0) {
                        return <option value="">Введите API ключ для загрузки моделей</option>;
                      }
                      // Список бесплатных моделей (с бесплатным провайдером Alibaba)
                      const freeModels = [
                        'qwen/qwen3-235b-a22b-thinking-2507'
                      ];
                      // Сортируем модели: бесплатные сначала, затем текущая модель (если не бесплатная)
                      const sortedModels = [...uniqueModels].sort((a, b) => {
                        const aIsFree = freeModels.includes(a);
                        const bIsFree = freeModels.includes(b);
                        if (aIsFree && !bIsFree) return -1;
                        if (!aIsFree && bIsFree) return 1;
                        if (a === currentModel && b !== currentModel) return -1;
                        if (a !== currentModel && b === currentModel) return 1;
                        return 0;
                      });
                      return sortedModels.map((m: string) => {
                        const isFree = freeModels.includes(m);
                        return (
                          <option key={m} value={m}>
                            {m}{isFree ? ' 🆓 (бесплатно)' : ''}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'prompts' && promptSettings !== null && (
          <div className="space-y-8 animate-fadeIn">
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-dark-800 flex items-center gap-2">
                  <FileText size={20} className="text-primary-500" /> Настройки промптов
                </h2>
                <button
                  type="button"
                  onClick={handleResetPromptSettings}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  Сбросить к умолчанию
                </button>
              </div>
              
              {promptSettingsError && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                  <p className="text-sm text-red-700">{promptSettingsError}</p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-sm text-blue-700 leading-relaxed flex gap-2">
                  <Info size={20} className="shrink-0" />
                  <span>Настройте структуру промптов, которые отправляются в LLM. Вы можете включать/выключать блоки, менять их порядок и настраивать содержимое.</span>
                </p>
              </div>

              <PromptSettingsEditor 
                settings={promptSettings} 
                onChange={handlePromptSettingsChange}
                defaults={promptDefaults}
              />
            </section>
          </div>
        )}

        {activeTab === 'ui' && (
          <div className="space-y-8 animate-fadeIn">
             <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4 flex items-center gap-2">
                <Globe size={20} className="text-primary-500" /> Локализация и Тема
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Язык интерфейса</label>
                  <select
                    name="language"
                    value={formState.language}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Тема</label>
                  <select
                    name="theme"
                    value={formState.theme}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    <option value="dark">Темная</option>
                    <option value="light">Светлая</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Акцентный цвет (терминал / кибер-стиль)</label>
                  <p className="text-sm text-dark-500 mb-3">Цвет рамок, подсветки и кнопок на тёмных экранах (вселенные, чат).</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'green', name: 'Зелёный', hex: '#0bda5b' },
                      { id: 'blue', name: 'Синий', hex: '#0d7ff2' },
                      { id: 'purple', name: 'Фиолетовый', hex: '#a855f7' },
                      { id: 'orange', name: 'Оранжевый', hex: '#f48c25' },
                      { id: 'cyan', name: 'Бирюзовый', hex: '#22d3ee' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFormState((prev: any) => ({ ...prev, accent_color: preset.id }))}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                          (formState.accent_color || 'green') === preset.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-dark-200 bg-white text-dark-700 hover:border-dark-300'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 border border-dark-300"
                          style={{ backgroundColor: preset.hex }}
                        />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4 flex items-center gap-2">
                <Bell size={20} className="text-primary-500" /> Уведомления
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between md:col-span-2">
                  <div>
                    <h3 className="font-bold text-dark-800">Показывать всплывающие уведомления (toast)</h3>
                    <p className="text-sm text-dark-500">Сообщения об успехе, ошибках и статусе операций.</p>
                  </div>
                  <input
                    type="checkbox"
                    name="show_toast_notifications"
                    checked={!!formState.show_toast_notifications}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Позиция уведомлений</label>
                  <select
                    name="toast_position"
                    value={formState.toast_position ?? 'bottom-center'}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    <option value="top-left">Сверху слева</option>
                    <option value="top-center">Сверху по центру</option>
                    <option value="top-right">Сверху справа</option>
                    <option value="bottom-left">Снизу слева</option>
                    <option value="bottom-center">Снизу по центру</option>
                    <option value="bottom-right">Снизу справа</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Автоскрытие (мс)</label>
                  <input
                    type="number"
                    name="toast_duration"
                    min={0}
                    step={1000}
                    value={formState.toast_duration ?? 3000}
                    onChange={handleChange}
                    placeholder="3000"
                    className="input w-full"
                  />
                  <p className="text-sm text-dark-500 mt-1">0 — не скрывать автоматически. Рекомендуется 2000–5000 мс.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-8 animate-fadeIn">
            <section className="bg-white p-6 rounded-2xl border border-dark-100 shadow-sm">
              <h2 className="text-lg font-bold text-dark-800 mb-4">Параметры RAG и Контекста</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-dark-800">Использовать RAG (Векторный поиск)</h3>
                    <p className="text-sm text-dark-500">Автоматически искать релевантную информацию в заметках и вики.</p>
                  </div>
                  <input
                    type="checkbox"
                    name="enable_rag"
                    checked={formState.enable_rag}
                    onChange={handleChange}
                    className="w-6 h-6 rounded border-dark-300 text-primary-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Размер окна контекста (токенов)</label>
                  <input
                    type="number"
                    name="context_window_size"
                    value={formState.context_window_size}
                    onChange={handleChange}
                    className="input w-full max-w-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-2 uppercase tracking-wider">Бюджет черновиков (символов)</label>
                  <p className="text-sm text-dark-500 mb-2">Сколько всего символов из черновиков подставлять в контекст чата, если включено «Все черновики в контекст». Иначе в контекст попадают только релевантные по запросу (поиск + RAG).</p>
                  <input
                    type="number"
                    name="draft_context_budget"
                    min={0}
                    value={formState.draft_context_budget ?? 3000}
                    onChange={handleChange}
                    className="input w-full max-w-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-dark-800">Все черновики в контекст</h3>
                    <p className="text-sm text-dark-500">Если включено — в контекст чата подставляются все черновики подряд (до бюджета). Если выключено — только релевантные по запросу (рекомендуется, экономит токены).</p>
                  </div>
                  <input
                    type="checkbox"
                    name="include_all_drafts_in_context"
                    checked={!!formState.include_all_drafts_in_context}
                    onChange={handleChange}
                    className="w-6 h-6 rounded border-dark-300 text-primary-600"
                  />
                </div>
                <p className="text-sm text-dark-500 mt-4 font-medium">Лимиты контекста чата (символы)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div>
                    <label className="block text-sm font-bold text-dark-600 mb-1">Знания персонажа (макс. символов)</label>
                    <input
                      type="number"
                      name="context_base_budget"
                      min={0}
                      value={formState.context_base_budget ?? 4000}
                      onChange={handleChange}
                      className="input w-full max-w-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-dark-600 mb-1">Упоминания (макс. символов)</label>
                    <input
                      type="number"
                      name="context_mentions_budget"
                      min={0}
                      value={formState.context_mentions_budget ?? 2000}
                      onChange={handleChange}
                      className="input w-full max-w-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-dark-600 mb-1">Список персонажей для Помощника (символов)</label>
                    <input
                      type="number"
                      name="context_creator_chars"
                      min={0}
                      value={formState.context_creator_chars ?? 8000}
                      onChange={handleChange}
                      className="input w-full max-w-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-dark-600 mb-1">Технологии и артефакты (макс. символов)</label>
                    <input
                      type="number"
                      name="context_technologies_budget"
                      min={0}
                      value={formState.context_technologies_budget ?? 4000}
                      onChange={handleChange}
                      className="input w-full max-w-xs"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </form>
    </div>
  );
}
