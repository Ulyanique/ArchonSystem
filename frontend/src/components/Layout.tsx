import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { Users, MapPin, BookOpen, FileText, MessageSquare, Menu, X, Globe, Network, Calendar, Search, ScrollText, ListOrdered, Settings, Sparkles, Quote, Book, Brain, Image as ImageIcon, Shield, Cpu, LogOut, PenTool, PenLine, Download, BarChart3, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, FilePen, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore, getStoredUniverseId } from '../store';
import { useQuery } from '@tanstack/react-query';
import { universesApi, exportApi } from '../api';
import BackgroundAudioPlayer from './BackgroundAudioPlayer';
import UniverseClock from './UniverseClock';
import CommandPalette from './CommandPalette';
import JobsPanel from './JobsPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { logUiEvent } from '../store/jobQueue';
import { useEffect, useState, useRef } from 'react';

/** Пункт меню */
type NavItemDef = { slug: string; icon: LucideIcon; label: string };
/** Подкатегория: заголовок + пункты */
type NavSubcategoryDef = { label: string; items: NavItemDef[] };
/** Категория: заголовок + подкатегории */
type NavCategoryDef = { label: string; icon: LucideIcon; subcategories: NavSubcategoryDef[] };

const UNIVERSE_NAV_STRUCTURE: NavCategoryDef[] = [
  {
    label: 'Книга',
    icon: BookOpen,
    subcategories: [
      { label: 'Написание и структура', items: [
        { slug: 'book', icon: BookOpen, label: 'Книга' },
        { slug: 'write-book', icon: PenTool, label: 'Мастер книги' },
        { slug: 'chapters', icon: BookOpen, label: 'Главы' },
        { slug: 'storylines', icon: Layers, label: 'Сюжетные линии' },
        { slug: 'outline', icon: ListOrdered, label: 'План' },
        { slug: 'coverage', icon: BarChart3, label: 'Покрытие' },
      ]},
      { label: 'Материал', items: [
        { slug: 'notes', icon: FileText, label: 'Заметки' },
        { slug: 'drafts', icon: FilePen, label: 'Черновики' },
        { slug: 'quotes', icon: Quote, label: 'Цитаты' },
        { slug: 'book-view', icon: ScrollText, label: 'Текст целиком' },
      ]},
    ],
  },
  {
    label: 'Мир',
    icon: Globe,
    subcategories: [
      { label: 'Сущности', items: [
        { slug: 'characters', icon: Users, label: 'Персонажи' },
        { slug: 'locations', icon: MapPin, label: 'Локации' },
        { slug: 'factions', icon: Shield, label: 'Фракции' },
      ]},
      { label: 'Системы', items: [
        { slug: 'technologies', icon: Cpu, label: 'Технологии' },
        { slug: 'space', icon: Globe, label: 'Пространство' },
      ]},
    ],
  },
  {
    label: 'Знания и анализ',
    icon: Brain,
    subcategories: [
      { label: 'Анализ и вики', items: [
        { slug: 'develop', icon: Sparkles, label: 'Анализ вселенной' },
        { slug: 'wiki', icon: Book, label: 'Вики' },
      ]},
      { label: 'Граф и персонажи', items: [
        { slug: 'graph', icon: Network, label: 'Граф знаний' },
        { slug: 'knowledge', icon: Brain, label: 'Знания персонажей' },
      ]},
    ],
  },
  {
    label: 'Медиа и время',
    icon: LayoutGrid,
    subcategories: [
      { label: '', items: [
        { slug: 'concept-art', icon: ImageIcon, label: 'Концепт-арт' },
        { slug: 'timeline', icon: Calendar, label: 'Таймлайн' },
      ]},
    ],
  },
  {
    label: 'Служебное',
    icon: Settings,
    subcategories: [
      { label: '', items: [
        { slug: 'search', icon: Search, label: 'Поиск' },
        { slug: 'settings', icon: Settings, label: 'Настройки вселенной' },
      ]},
    ],
  },
];

export default function Layout() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, universesPageView, selectedUniverse: storedUniverse, setSelectedUniverse } = useAppStore();
  const location = useLocation();
  const { universeId } = useParams();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  // Обработчик открытия палитры через горячие клавиши
  useEffect(() => {
    const handleOpenPalette = () => {
      setCommandPaletteOpen(true);
    };
    
    window.addEventListener('openCommandPalette', handleOpenPalette);
    window.addEventListener('forceOpenCommandPalette', handleOpenPalette);
    
    return () => {
      window.removeEventListener('openCommandPalette', handleOpenPalette);
      window.removeEventListener('forceOpenCommandPalette', handleOpenPalette);
    };
  }, []);

  const { data: universes = [] } = useQuery({
    queryKey: ['universes'],
    queryFn: universesApi.getAll,
  });

  const isUniversesPage = location.pathname === '/universes';
  const isClassicPage = location.pathname === '/universes/classic';
  const isVersionPage = isClassicPage;
  const isTerminalView = isUniversesPage && universesPageView === 'terminal';
  /** Все страницы кроме главной (список вселенных) — для единого тёмного стиля */
  const isInnerPages = !isUniversesPage && !isVersionPage;

  // Определяем текущую вселенную: сначала из URL, потом из store
  const currentUniverseId = universeId || storedUniverse?.id?.toString();
  // Определяем selectedUniverse: сначала из URL, потом из store, но синхронизируем с данными из API
  const selectedUniverse = (() => {
    if (universeId) {
      return universes.find(u => u.id === parseInt(universeId)) || null;
    }
    if (storedUniverse) {
      // Пытаемся найти в загруженных universes, если не найдено - используем storedUniverse
      const found = universes.find(u => u.id === storedUniverse.id);
      return found || storedUniverse;
    }
    return null;
  })();
  
  // Считаем, что мы внутри вселенной, если есть universeId в URL ИЛИ сохранена вселенная в store
  const isInsideUniverse = !!currentUniverseId;

  // Класс на body для тёмной темы только на внутренних страницах (не на главной)
  useEffect(() => {
    document.body.classList.toggle('inner-pages', isInnerPages);
    document.body.classList.toggle('main-page', !isInnerPages);
    return () => {
      document.body.classList.remove('inner-pages', 'main-page');
    };
  }, [isInnerPages]);

  // Обновляем выбранную вселенную в store при изменении universeId в URL или при загрузке universes
  useEffect(() => {
    if (universeId) {
      const universe = universes.find(u => u.id === parseInt(universeId));
      if (universe && universe.id !== storedUniverse?.id) {
        setSelectedUniverse(universe);
      }
    } else if (isUniversesPage && storedUniverse) {
      // Очищаем состояние вселенной при переходе на главную страницу
      setSelectedUniverse(null);
    } else if (!universeId && storedUniverse && universes.length > 0) {
      // Синхронизируем storedUniverse с данными из API, если они загружены
      const syncedUniverse = universes.find(u => u.id === storedUniverse.id);
      if (syncedUniverse && syncedUniverse.id === storedUniverse.id) {
        // Обновляем только если данные изменились (например, обновилось название)
        setSelectedUniverse(syncedUniverse);
      }
    } else if (!universeId && !storedUniverse && universes.length > 0) {
      // Восстановление после перезагрузки (например на /settings): берём ID из localStorage
      const storedId = getStoredUniverseId();
      if (storedId != null) {
        const universe = universes.find(u => u.id === storedId);
        if (universe) setSelectedUniverse(universe);
      }
    }
  }, [universeId, universes, storedUniverse, setSelectedUniverse, isUniversesPage]);

  // Логирование перехода по интерфейсу в консоль событий
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isInnerPages || !location.pathname) return;
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    const path = location.pathname;
    const name =
      path === '/universes' ? 'Вселенные' :
      path === '/settings' ? 'Настройки системы' :
      path.includes('/write-book') ? 'Написать книгу' :
      path.includes('/write') && !path.includes('write-book') ? 'Писать' :
      path.includes('/characters') ? 'Персонажи' :
      path.includes('/locations') ? 'Локации' :
      path.includes('/chapters') ? 'Главы' :
      path.includes('/storylines') ? 'Сюжетные линии' :
      path.includes('/coverage') ? 'Покрытие' :
      path.includes('/outline') ? 'План' :
      path.includes('/develop') ? 'Анализ вселенной' :
      path.includes('/notes') ? 'Заметки' :
      path.includes('/quotes') ? 'Цитаты' :
      path.includes('/factions') ? 'Фракции' :
      path.includes('/technologies') ? 'Технологии' :
      path.includes('/space') ? 'Пространство' :
      path.includes('/wiki') ? 'Вики' :
      path.includes('/concept-art') ? 'Концепт-арт' :
      path.includes('/knowledge') ? 'Знания персонажей' :
      path.includes('/book-view') ? 'Вселенная целиком' :
      path.includes('/graph') ? 'Граф знаний' :
      path.includes('/timeline') ? 'Таймлайн' :
      path.includes('/search') ? 'Поиск' :
      path.includes('/settings') ? 'Настройки вселенной' :
      path.includes('/chat') ? 'Терминал связи' :
      'Страница';
    logUiEvent(`Переход: ${name}`);
  }, [location.pathname, isInnerPages]);

  const basePath = isInsideUniverse && currentUniverseId ? `/universes/${currentUniverseId}` : '';
  const [categoriesExpanded, setCategoriesExpanded] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(UNIVERSE_NAV_STRUCTURE.map((_, i) => [i, true]))
  );
  const toggleCategory = (index: number) => {
    setCategoriesExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
      <div className={`flex h-screen app-layout ${isInnerPages ? 'inner-pages' : ''} ${isTerminalView || isVersionPage || isUniversesPage ? 'bg-black' : 'bg-dark-50'}`}>
      {/* Sidebar */}
      {!isUniversesPage && !isVersionPage && (
        <aside 
          className={`${
            sidebarOpen ? (sidebarCollapsed ? 'w-14' : 'w-64') : 'w-0'
          } ${sidebarCollapsed ? 'lg:w-14' : 'lg:w-64'} bg-dark-900 text-white transition-all duration-300 overflow-hidden flex flex-col shrink-0`}
        >
        <div className={`sidebar-header border-b border-dark-700 flex items-center shrink-0 ${sidebarCollapsed ? 'px-2 py-3 flex-col gap-2' : 'pl-6 pr-4 py-2'}`}>
          <div className={`flex items-center w-full min-w-0 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {sidebarCollapsed ? null : (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold !text-accent font-display tracking-wider">ARCHON</h1>
                  <span className="text-xs text-dark-400 shrink-0">v0.1.0</span>
                </div>
                <p className="text-[11px] text-dark-400 leading-tight mt-0.5 truncate">Система управления вселенными</p>
              </div>
            )}
            <div className="flex items-center gap-0.5 shrink-0">
              {sidebarCollapsed && (
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-dark-700 rounded" title="Закрыть">
                  <X size={18} />
                </button>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 hover:bg-dark-700 rounded"
                title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              {!sidebarCollapsed && (
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-dark-700 rounded" title="Закрыть">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto sidebar-scrollbar ${sidebarCollapsed ? 'px-2 py-4 flex flex-col items-center gap-1' : 'pl-6 pr-4 py-4'}`}>
          {/* Main Navigation - показываем только если НЕ внутри вселенной */}
          {!isInsideUniverse && (
            <div className={sidebarCollapsed ? 'flex flex-col items-center gap-1 w-full' : 'mb-6 space-y-1'}>
              <Link
                to="/universes"
                title="Все вселенные"
                className={`sidebar-item text-white ${sidebarCollapsed ? 'justify-center px-2 w-full' : ''} ${
                  location.pathname === '/universes' ? 'active' : ''
                }`}
              >
                <Globe size={20} />
                {!sidebarCollapsed && <span>Все вселенные</span>}
              </Link>
              <Link
                to="/settings"
                title="Настройки системы"
                className={`sidebar-item text-white ${sidebarCollapsed ? 'justify-center px-2 w-full' : ''} ${
                  location.pathname === '/settings' ? 'active' : ''
                }`}
              >
                <Settings size={20} />
                {!sidebarCollapsed && <span>Настройки системы</span>}
              </Link>
            </div>
          )}

          {/* Внутри вселенной: Терминал и Настройки сверху, затем категории */}
          {isInsideUniverse && currentUniverseId && basePath && (
            <>
              <Link
                to={`${basePath}/chat`}
                title="Терминал связи"
                className={`sidebar-item text-white ${sidebarCollapsed ? 'justify-center px-2 w-full' : ''} ${
                  location.pathname === `${basePath}/chat` ? 'active' : ''
                }`}
              >
                <MessageSquare size={20} />
                {!sidebarCollapsed && <span>Терминал связи</span>}
              </Link>

              <Link
                to="/settings"
                title="Настройки системы"
                className={`sidebar-item text-white ${sidebarCollapsed ? 'justify-center px-2 w-full' : ''} ${
                  location.pathname === '/settings' ? 'active' : ''
                }`}
              >
                <Settings size={20} />
                {!sidebarCollapsed && <span>Настройки системы</span>}
              </Link>

              {sidebarCollapsed ? (
                /* Свёрнутое меню: только иконки всех пунктов подряд */
                <div className={sidebarCollapsed ? 'flex flex-col items-center gap-1 w-full' : ''}>
                  {UNIVERSE_NAV_STRUCTURE.flatMap((cat) =>
                    cat.subcategories.flatMap((sub) =>
                      sub.items.map((item) => (
                        <Link
                          key={item.slug}
                          to={`${basePath}/${item.slug}`}
                          title={item.label}
                          className={`sidebar-item text-white justify-center px-2 w-full ${
                            location.pathname === `${basePath}/${item.slug}` ? 'active' : ''
                          }`}
                        >
                          <item.icon size={20} />
                        </Link>
                      ))
                    )
                  )}
                </div>
              ) : (
                /* Развёрнутое меню: категории и подкатегории */
                <div className="mt-2 space-y-3">
                  {UNIVERSE_NAV_STRUCTURE.map((category, catIndex) => {
                    const isExpanded = categoriesExpanded[catIndex] !== false;
                    return (
                      <div key={catIndex} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleCategory(catIndex)}
                          className="sidebar-item text-white w-full justify-between bg-transparent hover:bg-dark-700/50 border-0 -ml-4 pl-4"
                        >
                          <span className="flex items-center gap-3">
                            <category.icon size={18} className="text-dark-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">
                              {category.label}
                            </span>
                          </span>
                          <ChevronDown
                            size={16}
                            className={`text-dark-500 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                          />
                        </button>
                        {isExpanded && (
                          <div className="ml-2 pl-3 border-l border-dark-700 space-y-3">
                            {category.subcategories.map((sub, subIndex) => (
                              <div key={subIndex} className="space-y-0.5">
                                {sub.label && (
                                  <div className="text-[11px] font-medium text-dark-500 uppercase tracking-wider mb-1 px-1">
                                    {sub.label}
                                  </div>
                                )}
                                {sub.items.map((item) => (
                                  <Link
                                    key={item.slug}
                                    to={`${basePath}/${item.slug}`}
                                    title={item.label}
                                    className={`sidebar-item text-white py-1.5 ${
                                      location.pathname === `${basePath}/${item.slug}` ? 'active' : ''
                                    }`}
                                  >
                                    <item.icon size={18} />
                                    <span className="text-sm">{item.label}</span>
                                  </Link>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </nav>

        <div className={`border-t border-dark-700 shrink-0 ${sidebarCollapsed ? 'px-2 py-4 flex justify-center' : 'pl-6 pr-4 py-4'}`}>
          {isInsideUniverse && (
            <Link
              to="/universes"
              onClick={() => setSelectedUniverse(null)}
              title="Выйти из вселенной"
              className={`sidebar-item text-white bg-dark-800 hover:bg-dark-700 border border-dark-600 ${sidebarCollapsed ? 'justify-center px-2 w-full' : 'w-full whitespace-nowrap'}`}
            >
              <LogOut size={20} />
              {!sidebarCollapsed && <span>Выйти из вселенной</span>}
            </Link>
          )}
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden min-w-0 ${isTerminalView || isVersionPage || isUniversesPage ? '!overflow-visible' : ''}`}>
        {/* Header */}
        {!isTerminalView && !isVersionPage && !isUniversesPage && (
          <header className="app-header bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-600 ml-6 pl-6 pr-4 py-2 flex items-center gap-4 flex-nowrap">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-dark-100 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-dark-800">
              {selectedUniverse?.title || 'Вселенные'}
            </h2>
            {isInsideUniverse && selectedUniverse && currentUniverseId && (
              <>
                <UniverseClock universeId={parseInt(currentUniverseId)} />
                <div className="ml-auto flex flex-1 min-w-0 items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setCommandPaletteOpen(true);
                    }}
                    className="flex flex-1 min-w-0 justify-start items-center gap-2 px-3 py-1.5 text-sm font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-lg transition-colors border border-dark-200"
                    title="Открыть палитру команд (Ctrl+K / Cmd+K)"
                  >
                    <Search size={16} className="shrink-0" />
                    <span className="hidden sm:inline truncate">Поиск</span>
                    <kbd className="hidden sm:inline shrink-0 text-xs px-1.5 py-0.5 bg-dark-100 rounded border border-dark-300">
                      {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                    </kbd>
                  </button>
                  <button
                    onClick={() => {
                      const url = exportApi.markdown(parseInt(currentUniverseId), {});
                      window.open(url, '_blank');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Экспортировать книгу в Markdown"
                  >
                    <Download size={16} />
                    Экспорт
                  </button>
                  <BackgroundAudioPlayer universeId={parseInt(currentUniverseId)} />
                </div>
              </>
            )}
          </header>
        )}

        {/* Page Content: ErrorBoundary на уровне страницы — падение одной не ломает весь интерфейс */}
        <div className={`flex-1 overflow-y-auto page-content app-scrollbar ${isTerminalView || isVersionPage || isUniversesPage ? 'p-0' : 'px-6 py-6'}`}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      
      {/* Right panel: очередь задач (только на внутренних страницах) */}
      {isInnerPages && <JobsPanel universeId={currentUniverseId ? parseInt(currentUniverseId, 10) : null} />}

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
