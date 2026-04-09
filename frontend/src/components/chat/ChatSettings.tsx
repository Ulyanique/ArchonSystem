
interface ChatSettingsProps {
  provider: string;
  setProvider: (p: string) => void;
  model: string;
  setModel: (m: string) => void;
  models: string[];
  busyProvider?: string | null;
  busyModel?: string | null;
  useStream: boolean;
  setUseStream: (s: boolean) => void;
  showPrompt: boolean;
  setShowPrompt: (s: boolean) => void;
  noContext?: boolean;
  setNoContext?: (v: boolean) => void;
  useCharacterKnowledge?: boolean;
  setUseCharacterKnowledge?: (v: boolean) => void;
  hasCharacter?: boolean;
}

export default function ChatSettings({
  provider,
  setProvider,
  model,
  setModel,
  models,
  busyProvider = null,
  busyModel = null,
  useStream,
  setUseStream,
  showPrompt,
  setShowPrompt,
  noContext = false,
  setNoContext,
  useCharacterKnowledge = true,
  setUseCharacterKnowledge,
  hasCharacter = false
}: ChatSettingsProps) {
  const isModelBusy = (p: string, m: string) => !!busyProvider && !!busyModel && p === busyProvider && m === busyModel;
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-2 tech-label">Провайдер</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input w-full">
            <option value="ollama">Ollama</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openrouter">OpenRouter</option>
            <option value="routerai">RouterAI</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-2 tech-label">Модель</label>
          {busyProvider && busyModel && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Модель, занятая генерацией в фоне, недоступна для чата — выберите другую.</p>
          )}
          <select value={model} onChange={(e) => setModel(e.target.value)} className="input w-full">
            {(() => {
              // Для RouterAI: список бесплатных моделей
              const freeModels = [
                'qwen/qwen3-235b-a22b-thinking-2507'
              ];
              
              // Для OpenRouter: популярные модели, которые всегда должны быть доступны
              const openrouterPopularModels = [
                'openrouter/aurora-alpha',
                'google/gemini-pro-1.5',
                'anthropic/claude-3.5-sonnet',
                'openai/gpt-4-turbo',
                'openai/gpt-3.5-turbo',
              ];
              
              // Для Ollama: приоритет DeepSeek и QWEN
              const modelPriority = (modelName: string): number => {
                const lower = modelName.toLowerCase();
                if (lower.includes('deepseek')) return 1;
                if (lower.includes('qwen')) return 2;
                return 3;
              };
              
              // Для OpenRouter: добавляем популярные модели, если их нет в списке
              let modelsToShow = [...models];
              if (provider === 'openrouter') {
                modelsToShow = Array.from(new Set([
                  ...openrouterPopularModels,
                  ...modelsToShow,
                  model // Текущая выбранная модель
                ].filter(Boolean)));
              }
              
              // Сортируем модели в зависимости от провайдера
              const sortedModels = [...modelsToShow].sort((a, b) => {
                if (provider === 'routerai') {
                  // Для RouterAI: бесплатные модели сначала
                  const aIsFree = freeModels.includes(a);
                  const bIsFree = freeModels.includes(b);
                  if (aIsFree && !bIsFree) return -1;
                  if (!aIsFree && bIsFree) return 1;
                  return 0;
                } else if (provider === 'openrouter') {
                  // Для OpenRouter: бесплатные модели (:free) и популярные сначала
                  const aIsFree = a.includes(':free');
                  const bIsFree = b.includes(':free');
                  const aIsPopular = openrouterPopularModels.includes(a);
                  const bIsPopular = openrouterPopularModels.includes(b);
                  
                  // Приоритет: бесплатные > популярные > текущая модель > остальные
                  if (aIsFree && !bIsFree) return -1;
                  if (!aIsFree && bIsFree) return 1;
                  if (aIsPopular && !bIsPopular) return -1;
                  if (!aIsPopular && bIsPopular) return 1;
                  if (a === model && b !== model) return -1;
                  if (a !== model && b === model) return 1;
                  return a.localeCompare(b);
                } else if (provider === 'ollama') {
                  // Для Ollama: DeepSeek и QWEN сначала
                  const priorityA = modelPriority(a);
                  const priorityB = modelPriority(b);
                  if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                  }
                  return a.localeCompare(b);
                }
                return 0;
              });
              
              return sortedModels.map(m => {
                // Для RouterAI проверяем список бесплатных моделей
                const isFreeRouterAI = provider === 'routerai' && freeModels.includes(m);
                // Для OpenRouter проверяем суффикс :free или популярные модели
                const isFreeOpenRouter = provider === 'openrouter' && m.includes(':free');
                const isPopularOpenRouter = provider === 'openrouter' && openrouterPopularModels.includes(m);
                const isFree = isFreeRouterAI || isFreeOpenRouter;
                const busy = isModelBusy(provider, m);
                return (
                  <option key={m} value={m} disabled={busy}>
                    {m}{isFree ? ' 🆓 (бесплатно)' : ''}{isPopularOpenRouter && !isFree ? ' ⭐' : ''}{busy ? ' — занята (генерация)' : ''}
                  </option>
                );
              });
            })()}
          </select>
        </div>
        <div className="flex flex-col justify-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent border-dark-300" />
                <span className="text-sm text-dark-600 group-hover:text-dark-900 transition-colors duration-75">Стриминг</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showPrompt} onChange={(e) => setShowPrompt(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent border-dark-300" />
                <span className="text-sm text-dark-600 group-hover:text-dark-900 transition-colors duration-75">Показать промпт</span>
            </label>
            {setNoContext && (
              <label className="flex items-center gap-2 cursor-pointer group" title="ИИ не будет получать контекст из глав и черновиков">
                  <input type="checkbox" checked={noContext} onChange={(e) => setNoContext(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent border-dark-300" />
                  <span className="text-sm text-dark-600 group-hover:text-dark-900 transition-colors duration-75">Без контекста книги</span>
              </label>
            )}
            {setUseCharacterKnowledge && hasCharacter && (
              <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={useCharacterKnowledge} onChange={(e) => setUseCharacterKnowledge(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent border-dark-300" />
                  <span className="text-sm text-dark-600 group-hover:text-dark-900 transition-colors duration-75">Учитывать знания персонажа</span>
              </label>
            )}
        </div>
      </div>
    </div>
  );
}
