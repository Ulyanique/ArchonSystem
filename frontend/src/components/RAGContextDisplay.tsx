import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface RAGContextProps {
  /** Контекст из RAG; пустая строка — запрос был с RAG, но фрагментов не найдено */
  context: string | null;
  /** Показать подсказку, когда контекст пустой (RAG включён, но база знаний пуста или ничего не подошло) */
  emptyHint?: boolean;
}

export default function RAGContextDisplay({ context, emptyHint }: RAGContextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (context === null || context === undefined) return null;

  if (!context.trim() && emptyHint) {
    return (
      <div className="mb-4 px-4 py-3 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
        <BookOpen size={18} className="shrink-0" />
        <span>
          Контекст из книги не использован — по запросу ничего не найдено. Добавьте главы или черновики и включите их в базу знаний (анализ вселенной), чтобы ИИ мог опираться на материал.
        </span>
      </div>
    );
  }

  if (!context.trim()) return null;

  // Парсим контекст: с заголовком или без (backend может вернуть сразу блоки [type: title]\ncontent)
  const afterHeader = context.split('=== РЕЛЕВАНТНЫЙ КОНТЕКСТ ===')[1];
  const sections = afterHeader != null
    ? afterHeader.split('\n\n').filter(Boolean)
    : context.split('\n\n').filter(Boolean);

  return (
    <div className="mb-4 border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search size={16} />
          <span>Использовано фрагментов из базы знаний: {sections.length}</span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      
      {isExpanded && (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {sections.map((section, idx) => {
            if (!section.trim()) return null;
            
            // Извлекаем тип и заголовок из метаданных
            const match = section.match(/\[(.+?): (.+?)\]/);
            const content = match ? section.replace(match[0], '').trim() : section.trim();
            
            return (
              <div key={idx} className="bg-white rounded p-3 border border-blue-100">
                {match && (
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    {match[1]}: {match[2]}
                  </div>
                )}
                <p className="text-sm text-dark-700 whitespace-pre-wrap">{content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
