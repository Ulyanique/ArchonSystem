import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Settings, FileText } from 'lucide-react';

interface PromptSettingsEditorProps {
  settings: any;
  onChange: (settings: any) => void;
  defaults?: any;
}

export default function PromptSettingsEditor({ settings, onChange, defaults: _defaults }: PromptSettingsEditorProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set(['character_identity', 'universe_context']));
  const [showJson, setShowJson] = useState(false);

  const toggleBlock = (blockName: string) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(blockName)) {
      newExpanded.delete(blockName);
    } else {
      newExpanded.add(blockName);
    }
    setExpandedBlocks(newExpanded);
  };

  const updateBlock = (blockName: string, updates: any) => {
    const newSettings = {
      ...settings,
      blocks: {
        ...settings.blocks,
        [blockName]: {
          ...settings.blocks[blockName],
          ...updates
        }
      }
    };
    onChange(newSettings);
  };

  const updateSetting = (path: string[], value: any) => {
    const newSettings = { ...settings };
    let current: any = newSettings;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    onChange(newSettings);
  };

  const blocks = [
    {
      key: 'character_identity',
      name: 'Идентичность персонажа',
      description: 'Информация о персонаже: имя, атрибуты, возраст, речь',
      icon: '👤'
    },
    {
      key: 'universe_context',
      name: 'Контекст вселенной',
      description: 'Информация о мире, персонажах, локациях, заметках',
      icon: '🌍'
    },
    {
      key: 'rag_context',
      name: 'RAG контекст',
      description: 'Релевантные факты из векторного поиска',
      icon: '🔍'
    },
    {
      key: 'speaker_info',
      name: 'Информация о собеседнике',
      description: 'Кто ведет диалог с персонажем',
      icon: '💬'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Основные настройки */}
      <div className="border border-dark-200 rounded-lg p-4">
        <h3 className="font-bold text-dark-800 mb-3 flex items-center gap-2">
          <Settings size={18} />
          Основные настройки
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-dark-600 mb-2">Инструкция по языку</label>
            <textarea
              value={settings.language_instruction || ''}
              onChange={(e) => updateSetting(['language_instruction'], e.target.value)}
              className="input w-full h-20"
              placeholder="⚠️ КРИТИЧЕСКИ ВАЖНО: ВСЕГДА отвечай ТОЛЬКО на РУССКОМ языке!"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-600 mb-2">Разделитель секций</label>
            <input
              type="text"
              value={settings.formatting?.section_separator || '\n\n'}
              onChange={(e) => updateSetting(['formatting', 'section_separator'], e.target.value)}
              className="input w-full"
              placeholder="\n\n"
            />
          </div>
        </div>
      </div>

      {/* Блоки промпта */}
      <div className="space-y-2">
        <h3 className="font-bold text-dark-800 mb-3">Блоки промпта</h3>
        {blocks.map((block) => {
          const blockConfig = settings.blocks?.[block.key] || {};
          const isExpanded = expandedBlocks.has(block.key);
          
          return (
            <div key={block.key} className="border border-dark-200 rounded-lg">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-50"
                onClick={() => toggleBlock(block.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{block.icon}</span>
                  <div>
                    <div className="font-semibold text-dark-800">{block.name}</div>
                    <div className="text-sm text-dark-500">{block.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={blockConfig.enabled !== false}
                      onChange={(e) => updateBlock(block.key, { enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-primary-600"
                    />
                    <span className="text-sm text-dark-600">
                      {blockConfig.enabled !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                    </span>
                  </label>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 border-t border-dark-200 bg-dark-50">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-dark-600 mb-2">Порядок</label>
                        <input
                          type="number"
                          value={blockConfig.order || 1}
                          onChange={(e) => updateBlock(block.key, { order: parseInt(e.target.value) || 1 })}
                          className="input w-full"
                          min="1"
                        />
                      </div>
                      {block.key === 'character_identity' && (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={blockConfig.include_name !== false}
                              onChange={(e) => updateBlock(block.key, { include_name: e.target.checked })}
                              className="w-4 h-4 rounded text-primary-600"
                            />
                            <label className="text-sm text-dark-600">Включать имя</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={blockConfig.include_format_instructions !== false}
                              onChange={(e) => updateBlock(block.key, { include_format_instructions: e.target.checked })}
                              className="w-4 h-4 rounded text-primary-600"
                            />
                            <label className="text-sm text-dark-600">Инструкции по формату</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={blockConfig.include_canonical_dates !== false}
                              onChange={(e) => updateBlock(block.key, { include_canonical_dates: e.target.checked })}
                              className="w-4 h-4 rounded text-primary-600"
                            />
                            <label className="text-sm text-dark-600">Канонические даты</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={blockConfig.include_age_speech !== false}
                              onChange={(e) => updateBlock(block.key, { include_age_speech: e.target.checked })}
                              className="w-4 h-4 rounded text-primary-600"
                            />
                            <label className="text-sm text-dark-600">Речь по возрасту</label>
                          </div>
                        </>
                      )}
                      {block.key === 'universe_context' && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-dark-600 mb-2">Заголовок</label>
                            <input
                              type="text"
                              value={blockConfig.header || '=== ВАШ МИР И ЗНАНИЯ ==='}
                              onChange={(e) => updateBlock(block.key, { header: e.target.value })}
                              className="input w-full"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={blockConfig.use_smart_context !== false}
                              onChange={(e) => updateBlock(block.key, { use_smart_context: e.target.checked })}
                              className="w-4 h-4 rounded text-primary-600"
                            />
                            <label className="text-sm text-dark-600">Использовать умный контекст</label>
                          </div>
                        </>
                      )}
                      {(block.key === 'rag_context' || block.key === 'speaker_info') && (
                        <div>
                          <label className="block text-sm font-semibold text-dark-600 mb-2">Заголовок</label>
                          <input
                            type="text"
                            value={blockConfig.header || `=== ${block.name.toUpperCase()} ===`}
                            onChange={(e) => updateBlock(block.key, { header: e.target.value })}
                            className="input w-full"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* JSON редактор (расширенный режим) */}
      <div className="border border-dark-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-dark-800 flex items-center gap-2">
            <FileText size={18} />
            Расширенный режим (JSON)
          </h3>
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {showJson ? 'Скрыть' : 'Показать'} JSON
          </button>
        </div>
        {showJson && (
          <div>
            <textarea
              value={JSON.stringify(settings, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange(parsed);
                } catch (err) {
                  // Игнорируем ошибки парсинга при вводе
                }
              }}
              className="input w-full h-64 font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-xs text-dark-500 mt-2">
              Внимание: Изменения в JSON применяются сразу. Убедитесь, что JSON валиден.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
