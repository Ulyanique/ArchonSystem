import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../api';
import { Search, X, Users, MapPin, BookOpen, Calendar, Lightbulb } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';

/** Разбивает запрос на слова (нормализация как на бэкенде: нижний регистр, ё→е). */
function queryToWords(q: string): string[] {
  if (!q?.trim()) return [];
  const s = q.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  return s.split(' ').filter(Boolean);
}

/** Экранирует спецсимволы для RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Подсвечивает в тексте все вхождения слов запроса; возвращает React-узлы (строка и <mark>). */
function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!text) return null;
  const words = queryToWords(query);
  if (words.length === 0) return text;
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi');
  const segments: { type: 'text' | 'match'; value: string }[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) segments.push({ type: 'text', value: text.slice(lastEnd, m.index) });
    segments.push({ type: 'match', value: m[0] });
    lastEnd = re.lastIndex;
  }
  if (lastEnd < text.length) segments.push({ type: 'text', value: text.slice(lastEnd) });
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'match' ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-600/50 rounded px-0.5">
            {seg.value}
          </mark>
        ) : (
          seg.value
        )
      )}
    </>
  );
}

const typeColors: Record<string, string> = {
  character: 'bg-blue-100 text-blue-700',
  location: 'bg-green-100 text-green-700',
  chapter: 'bg-amber-100 text-amber-700',
  note: 'bg-purple-100 text-purple-700',
  timeline: 'bg-red-100 text-red-700',
};

export default function SearchPage() {
  const { universeId } = useParams();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce поиска
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', universeId, debouncedQuery],
    queryFn: () => searchApi.search(parseInt(universeId!), debouncedQuery, 50),
    enabled: debouncedQuery.length >= 2,
  });

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-dark-800 mb-2">Поиск по вселенной</h2>
        <p className="text-sm text-dark-500">
          Поиск по персонажам, локациям, главам, заметкам и таймлайну
        </p>
      </div>

      {/* Поисковая строка */}
      <div className="relative mb-6">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите поисковый запрос..."
            className="input pl-10 pr-10 py-3 text-lg"
            autoFocus
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-dark-100 rounded"
            >
              <X size={18} className="text-dark-400" />
            </button>
          )}
        </div>
      </div>

      {/* Результаты */}
      {isLoading ? (
        <div className="py-8">
          <LoadingSkeleton variant="list" lines={6} />
        </div>
      ) : results ? (
        <div>
          {/* Статистика */}
          <div className="mb-4 text-sm text-dark-500">
            Найдено: <strong>{results.total}</strong> результатов
          </div>

          {results.total === 0 ? (
            <EmptyState
              icon={Search}
              title="Ничего не найдено"
              description="Попробуйте другой запрос или проверьте орфографию"
            />
          ) : (
            <div className="space-y-6">
              {/* Персонажи */}
              {(results.characters?.length ?? 0) > 0 && (
                <SearchResultsGroup
                  title="Персонажи"
                  icon={Users}
                  color="bg-blue-500"
                  results={results.characters}
                  highlightQuery={debouncedQuery}
                />
              )}

              {/* Локации */}
              {(results.locations?.length ?? 0) > 0 && (
                <SearchResultsGroup
                  title="Локации"
                  icon={MapPin}
                  color="bg-green-500"
                  results={results.locations}
                  highlightQuery={debouncedQuery}
                />
              )}

              {/* Главы */}
              {(results.chapters?.length ?? 0) > 0 && (
                <SearchResultsGroup
                  title="Главы"
                  icon={BookOpen}
                  color="bg-amber-500"
                  results={results.chapters}
                  highlightQuery={debouncedQuery}
                />
              )}

              {/* Заметки */}
              {(results.notes?.length ?? 0) > 0 && (
                <SearchResultsGroup
                  title="Заметки"
                  icon={Lightbulb}
                  color="bg-purple-500"
                  results={results.notes}
                  highlightQuery={debouncedQuery}
                />
              )}

              {/* Таймлайн */}
              {(results.timeline?.length ?? 0) > 0 && (
                <SearchResultsGroup
                  title="Таймлайн"
                  icon={Calendar}
                  color="bg-red-500"
                  results={results.timeline}
                  highlightQuery={debouncedQuery}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-dark-500">
          <Search size={64} className="mx-auto text-dark-300 mb-4" />
          <p>Введите минимум 2 символа для поиска</p>
        </div>
      )}
    </div>
  );
}

// Компонент группы результатов
function SearchResultsGroup({ title, icon: Icon, color, results, highlightQuery }: { title: string; icon: React.ComponentType<{ size?: number }>; color: string; results: any[]; highlightQuery?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-6 rounded ${color}`}></div>
        <Icon size={20} className="text-dark-600" />
        <h3 className="text-lg font-semibold text-dark-800">{title}</h3>
        <span className="text-sm text-dark-500">({results.length})</span>
      </div>

      <div className="space-y-2">
        {results.map((result: any) => (
          <Link
            key={`${result.type}_${result.id}`}
            to={result.url}
            className="block card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${typeColors[result.type]}`}>
                {result.type}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-dark-800 truncate">
                  {highlightQuery ? highlightSnippet(result.title, highlightQuery) : result.title}
                </h4>
                {result.subtitle && (
                  <p className="text-sm text-dark-500 mb-1">{result.subtitle}</p>
                )}
                {result.snippet && (
                  <p className="text-sm text-dark-600 line-clamp-2">
                    {highlightQuery ? highlightSnippet(result.snippet, highlightQuery) : result.snippet}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
