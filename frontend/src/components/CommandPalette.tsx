import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, X, Users, MapPin, BookOpen, Calendar, 
  Network, Settings, Sparkles, MessageSquare, Globe, ListOrdered,
  PenTool, PenLine
} from 'lucide-react';
import { universesApi, charactersApi, locationsApi, chaptersApi, searchApi } from '../api';

interface Command {
  id: string;
  label: string;
  icon: any;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CommandPalette({ isOpen: externalIsOpen, onClose }: CommandPaletteProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
    setQuery('');
    setSelectedIndex(0);
  };
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { universeId } = useParams();

  const { data: _universes = [] } = useQuery({
    queryKey: ['universes'],
    queryFn: universesApi.getAll,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => universeId ? charactersApi.getAll(parseInt(universeId)) : Promise.resolve([]),
    enabled: !!universeId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => universeId ? locationsApi.getAll(parseInt(universeId)) : Promise.resolve([]),
    enabled: !!universeId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', universeId],
    queryFn: () => universeId ? chaptersApi.getAll(parseInt(universeId)) : Promise.resolve([]),
    enabled: !!universeId,
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['quickSearch', universeId, query],
    queryFn: () => universeId && query.length >= 2 ? searchApi.quickSearch(parseInt(universeId), query) : Promise.resolve(null),
    enabled: !!universeId && query.length >= 2,
  });

  // Глобальные команды (доступны всегда)
  const globalCommands: Command[] = [
    {
      id: 'universes',
      label: 'Все вселенные',
      icon: Globe,
      category: 'Навигация',
      action: () => navigate('/universes'),
      keywords: ['вселенные', 'список', 'главная'],
    },
    {
      id: 'settings',
      label: 'Настройки системы',
      icon: Settings,
      category: 'Настройки',
      action: () => navigate('/settings'),
      keywords: ['настройки', 'конфигурация'],
    },
  ];

  // Команды для вселенной
  const universeCommands: Command[] = universeId ? [
    {
      id: 'chat',
      label: 'Терминал связи',
      icon: MessageSquare,
      category: 'Основное',
      action: () => navigate(`/universes/${universeId}/chat`),
      keywords: ['чат', 'терминал', 'диалог'],
    },
    {
      id: 'write',
      label: 'Писать',
      icon: PenLine,
      category: 'Основное',
      action: () => navigate(`/universes/${universeId}/write`),
      keywords: ['писать', 'режим', 'бит', 'инструкция', 'генерация'],
    },
    {
      id: 'write-book',
      label: 'Написать книгу',
      icon: PenTool,
      category: 'Основное',
      action: () => navigate(`/universes/${universeId}/write-book`),
      keywords: ['книга', 'мастер'],
    },
    {
      id: 'characters',
      label: 'Персонажи',
      icon: Users,
      category: 'Сущности',
      action: () => navigate(`/universes/${universeId}/characters`),
      keywords: ['персонажи', 'герои', 'люди'],
    },
    {
      id: 'locations',
      label: 'Локации',
      icon: MapPin,
      category: 'Сущности',
      action: () => navigate(`/universes/${universeId}/locations`),
      keywords: ['локации', 'места', 'города'],
    },
    {
      id: 'chapters',
      label: 'Главы',
      icon: BookOpen,
      category: 'Контент',
      action: () => navigate(`/universes/${universeId}/chapters`),
      keywords: ['главы', 'текст', 'контент'],
    },
    {
      id: 'outline',
      label: 'План',
      icon: ListOrdered,
      category: 'Контент',
      action: () => navigate(`/universes/${universeId}/outline`),
      keywords: ['план', 'структура', 'содержание'],
    },
    {
      id: 'develop',
      label: 'Анализ вселенной',
      icon: Sparkles,
      category: 'Анализ',
      action: () => navigate(`/universes/${universeId}/develop`),
      keywords: ['анализ', 'развить', 'статистика'],
    },
    {
      id: 'timeline',
      label: 'Таймлайн',
      icon: Calendar,
      category: 'Время',
      action: () => navigate(`/universes/${universeId}/timeline`),
      keywords: ['таймлайн', 'события', 'время'],
    },
    {
      id: 'graph',
      label: 'Граф знаний',
      icon: Network,
      category: 'Визуализация',
      action: () => navigate(`/universes/${universeId}/graph`),
      keywords: ['граф', 'связи', 'сеть'],
    },
    {
      id: 'search',
      label: 'Поиск',
      icon: Search,
      category: 'Утилиты',
      action: () => navigate(`/universes/${universeId}/search`),
      keywords: ['поиск', 'найти'],
    },
    {
      id: 'universe-settings',
      label: 'Настройки вселенной',
      icon: Settings,
      category: 'Настройки',
      action: () => navigate(`/universes/${universeId}/settings`),
      keywords: ['настройки', 'конфигурация'],
    },
  ] : [];

  // Команды для сущностей
  const entityCommands: Command[] = [];
  
  if (universeId) {
    characters.slice(0, 10).forEach(char => {
      entityCommands.push({
        id: `char-${char.id}`,
        label: char.name,
        icon: Users,
        category: 'Персонажи',
        action: () => navigate(`/universes/${universeId}/characters/${char.id}`),
        keywords: [char.name.toLowerCase(), char.role?.toLowerCase() || '', char.description?.toLowerCase().slice(0, 50) || ''],
      });
    });

    locations.slice(0, 10).forEach(loc => {
      entityCommands.push({
        id: `loc-${loc.id}`,
        label: loc.name,
        icon: MapPin,
        category: 'Локации',
        action: () => navigate(`/universes/${universeId}/locations`),
        keywords: [loc.name.toLowerCase(), loc.location_type?.toLowerCase() || '', loc.description?.toLowerCase().slice(0, 50) || ''],
      });
    });

    chapters.slice(0, 10).forEach(chapter => {
      entityCommands.push({
        id: `chap-${chapter.id}`,
        label: chapter.title,
        icon: BookOpen,
        category: 'Главы',
        action: () => navigate(`/universes/${universeId}/chapters`),
        keywords: [chapter.title.toLowerCase(), chapter.content?.toLowerCase().slice(0, 50) || ''],
      });
    });
  }

  // Команды из результатов поиска
  const searchResultCommands: Command[] = searchResults ? [
    ...(searchResults.characters?.slice(0, 5).map((c: any) => ({
      id: `search-char-${c.id}`,
      label: c.title,
      icon: Users,
      category: 'Поиск: Персонажи',
      action: () => navigate(c.url),
      keywords: [],
    })) || []),
    ...(searchResults.locations?.slice(0, 5).map((l: any) => ({
      id: `search-loc-${l.id}`,
      label: l.title,
      icon: MapPin,
      category: 'Поиск: Локации',
      action: () => navigate(l.url),
      keywords: [],
    })) || []),
    ...(searchResults.chapters?.slice(0, 5).map((ch: any) => ({
      id: `search-chap-${ch.id}`,
      label: ch.title,
      icon: BookOpen,
      category: 'Поиск: Главы',
      action: () => navigate(ch.url),
      keywords: [],
    })) || []),
  ] : [];

  // Объединяем все команды
  const allCommands = [
    ...globalCommands,
    ...universeCommands,
    ...entityCommands,
    ...searchResultCommands,
  ];

  // Фильтрация команд по запросу
  const filteredCommands = query
    ? allCommands.filter(cmd => {
        const queryLower = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(queryLower) ||
          cmd.category.toLowerCase().includes(queryLower) ||
          cmd.keywords?.some(k => k.includes(queryLower))
        );
      })
    : allCommands;

  // Группировка по категориям
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Открытие палитры: Ctrl+K или Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          if (onClose) {
            // Если есть внешний обработчик, используем событие для открытия
            const openEvent = new CustomEvent('openCommandPalette');
            window.dispatchEvent(openEvent);
          } else {
            setInternalIsOpen(true);
          }
        }
        return;
      }
      
      if (!isOpen) return;
      
      // Закрытие палитры
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      
      // Навигация по командам
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredCommands, selectedIndex, onClose, handleClose]);

  // Фокус на input при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[20vh]"
      onClick={handleClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Поисковая строка */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Поиск команд, страниц, сущностей... (Ctrl+K)"
              className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            <button
              onClick={handleClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded text-slate-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Список команд */}
        <div className="flex-1 overflow-y-auto p-2 app-scrollbar">
          {query.length >= 2 && isSearching && (
            <div className="px-2 py-3 text-slate-400 flex items-center gap-2">
              <Search size={18} className="animate-pulse" />
              <span>Поиск…</span>
            </div>
          )}
          {query.length >= 2 && !isSearching && searchResults && searchResults.total === 0 && (
            <div className="text-center py-6 text-slate-400">
              <Search size={32} className="mx-auto mb-2 text-slate-500" />
              <p>Ничего не найдено</p>
            </div>
          )}
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category} className="mb-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
                {category}
              </div>
              {commands.map((cmd, _idx) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;
                const Icon = cmd.icon;
                
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      handleClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]' : 'hover:bg-slate-800 text-slate-200'
                    }`}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.category.includes('Поиск') && (
                      <span className="text-xs text-slate-500">Поиск</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && !(query.length >= 2 && searchResults && searchResults.total === 0) && (
            <div className="text-center py-8 text-slate-400">
              <Search size={32} className="mx-auto mb-2 text-slate-500" />
              <p>Ничего не найдено</p>
            </div>
          )}
        </div>

        {/* Подсказки */}
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>↑↓ Навигация</span>
            <span>Enter Выбрать</span>
            <span>Esc Закрыть</span>
          </div>
          <span className="text-slate-400">Ctrl+K для открытия</span>
        </div>
      </div>
    </div>
  );
}
