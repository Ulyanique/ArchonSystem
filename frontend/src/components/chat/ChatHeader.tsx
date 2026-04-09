import { Trash2, Settings, Clock, MessageSquare, Calendar, Search, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole, ChatTimeUniverse } from '../../utils/chatHistory';

interface ChatHeaderProps {
  selectedUniverse: any;
  selectedCharacter: any;
  userRole: UserRole;
  characters: any[];
  onCharacterChange: (id: number | undefined) => void;
  onRoleChange: (role: UserRole) => void;
  onClearHistory: () => void;
  onToggleSettings: () => void;
  messagesCount: number;
  clock: string | null;
  onFixTime: () => void;
  onSelectTime: () => void;
  onResetTime: () => void;
  chatTime: ChatTimeUniverse | 'now';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  knowledgeStats?: { 
    known_characters_count: number; 
    known_events_count: number;
    by_level?: { [key: string]: number };
    by_source?: { [key: string]: number };
    by_type?: { [key: string]: number };
  } | null;
  universeId?: string;
}

export default function ChatHeader({
  selectedUniverse,
  selectedCharacter,
  userRole,
  characters,
  onCharacterChange,
  onRoleChange,
  onClearHistory,
  onToggleSettings,
  messagesCount,
  clock,
  onFixTime,
  onSelectTime,
  onResetTime,
  chatTime,
  searchQuery,
  onSearchChange,
  knowledgeStats,
  universeId
}: ChatHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-dark-100 shadow-sm">
        <div>
            <h1 className="text-xl font-bold text-dark-800 flex items-center gap-2 font-display">
            <MessageSquare className="text-accent" />
            {selectedCharacter ? (
                <>
                <span className="text-accent">
                    {userRole === 'author' ? 'Создатель' : userRole.startsWith('character:') ? characters.find(c => c.id === parseInt(userRole.split(':')[1]))?.name : 'Вы'}
                </span>
                <span className="text-dark-300 mx-1">→</span>
                {selectedCharacter.name}
                </>
            ) : (
                'Помощник Создателя'
            )}
            </h1>
            <div className="flex items-center gap-3 mt-1">
            <select
                value={selectedCharacter?.id || ''}
                onChange={(e) => onCharacterChange(e.target.value ? parseInt(e.target.value) : undefined)}
                className="text-xs bg-dark-50 border-none rounded-lg py-1 px-2 focus:ring-1 focus:ring-accent"
            >
                <option value="">Помощник Создателя</option>
                {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.enabled === false ? '[выкл]' : ''}</option>
                ))}
            </select>
            {selectedCharacter && (
                <>
                    <select
                        value={userRole}
                        onChange={(e) => onRoleChange(e.target.value as UserRole)}
                        className="text-xs bg-dark-50 border-none rounded-lg py-1 px-2 focus:ring-1 focus:ring-accent"
                    >
                        <option value="author">Я - Автор</option>
                        {characters.filter(c => c.id !== selectedCharacter.id).map(c => (
                            <option key={`role-${c.id}`} value={`character:${c.id}`}>Я как {c.name}</option>
                        ))}
                    </select>
                    {universeId && (
                        <Link
                            to={`/universes/${universeId}/knowledge?character=${selectedCharacter.id}`}
                            className="text-xs text-accent hover:opacity-90 hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent-subtle transition-colors"
                            title="Настроить знания персонажа"
                        >
                            <Brain size={14} />
                            Знания
                        </Link>
                    )}
                </>
            )}
            </div>
        </div>
        <div className="flex items-center gap-2">
            {messagesCount > 0 && (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Поиск по сообщениям (Ctrl+F)"
                    className="pl-9 pr-3 py-1.5 text-xs bg-dark-50 border border-dark-200 rounded-lg focus:border-accent focus:ring-1 focus:ring-accent outline-none w-48 transition-all"
                  />
                </div>
                <button 
                  onClick={onClearHistory} 
                  className="p-2 text-dark-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all duration-75 hover:scale-110 active:scale-95" 
                  title={`Очистить чат (${messagesCount} сообщений)`}
                >
                    <Trash2 size={20} />
                </button>
              </>
            )}
            <button 
              onClick={onToggleSettings} 
              className="p-2 text-dark-400 hover:text-accent hover:bg-accent-subtle active:bg-accent-subtle rounded-xl transition-all duration-75 hover:scale-110 active:scale-95"
              title="Настройки чата"
            >
            <Settings size={20} />
            </button>
        </div>
        </div>

        {selectedUniverse && selectedCharacter && (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-50 rounded-xl border border-dark-100 text-xs text-dark-600 shadow-sm">
                    <Clock size={15} className="text-accent shrink-0" />
                    <span className="font-bold uppercase tracking-wider tech-label">Время во вселенной:</span>
                    <span className={`font-mono font-semibold tech-text ${chatTime === 'now' ? 'text-accent' : 'text-dark-800 dark:text-dark-200'}`}>
                      {clock || 'Синхронизация...'}
                    </span>
                    {chatTime !== 'now' && (
                      <span className="px-2.5 py-1 bg-accent-subtle text-accent rounded-md text-[10px] font-semibold border border-accent-dim">
                        Фиксировано
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                  <button 
                    onClick={onSelectTime} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-accent hover:opacity-90 hover:bg-accent-subtle active:bg-accent-subtle rounded-lg transition-all duration-75 font-medium text-xs"
                    title="Выбрать время во вселенной"
                  >
                    <Calendar size={12} />
                    Выбрать время
                  </button>
                  {chatTime === 'now' ? (
                    <button 
                      onClick={onFixTime} 
                      className="px-3 py-1.5 text-accent hover:opacity-90 hover:underline active:opacity-80 transition-colors duration-75 font-medium text-xs"
                      title="Зафиксировать текущий момент времени во вселенной"
                    >
                      Зафиксировать
                    </button>
                  ) : (
                    <button 
                      onClick={onResetTime} 
                      className="px-3 py-1.5 text-gray-600 hover:text-gray-700 hover:underline active:text-gray-800 transition-colors duration-75 font-medium text-xs"
                      title="Вернуться к текущему времени"
                    >
                      Сбросить
                    </button>
                    )}
                    </div>
                </div>
                {knowledgeStats && (
                    <div className="px-4 py-2.5 bg-accent-subtle rounded-xl border border-accent-dim text-xs text-accent">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Brain size={14} className="text-accent shrink-0" />
                            <span className="font-semibold">Знания персонажа:</span>
                            <span>{knowledgeStats.known_characters_count} {knowledgeStats.known_characters_count === 1 ? 'персонажа' : knowledgeStats.known_characters_count < 5 ? 'персонажей' : 'персонажей'}, </span>
                            <span>{knowledgeStats.known_events_count} {knowledgeStats.known_events_count === 1 ? 'событие' : knowledgeStats.known_events_count < 5 ? 'события' : 'событий'}</span>
                            {chatTime !== 'now' && typeof chatTime === 'object' && (
                                <span className="text-accent">до {chatTime.universe_day} дня {chatTime.universe_year} года</span>
                            )}
                        </div>
                        {(knowledgeStats.by_level || knowledgeStats.by_source || knowledgeStats.by_type) && (
                            <div className="mt-2 pt-2 border-t border-accent-dim space-y-1">
                                {knowledgeStats.by_level && Object.keys(knowledgeStats.by_level).some(k => knowledgeStats.by_level![k] > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-accent font-medium">Уровни:</span>
                                        {Object.entries(knowledgeStats.by_level).map(([level, count]) => count > 0 && (
                                            <span key={level} className="px-1.5 py-0.5 bg-accent-subtle rounded text-[10px]">
                                                {level === 'rumors' ? 'слухи' : level === 'superficial' ? 'поверхностно' : level === 'good' ? 'хорошо' : 'полностью'}: {count}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {knowledgeStats.by_source && Object.keys(knowledgeStats.by_source).some(k => knowledgeStats.by_source![k] > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-accent font-medium">Источники:</span>
                                        {Object.entries(knowledgeStats.by_source).map(([source, count]) => count > 0 && (
                                            <span key={source} className="px-1.5 py-0.5 bg-accent-subtle rounded text-[10px]">
                                                {source === 'participated' ? 'участвовал' : source === 'witnessed' ? 'видел' : source === 'heard' ? 'слышал' : source === 'read' ? 'читал' : 'узнал'}: {count}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {knowledgeStats.by_type && Object.keys(knowledgeStats.by_type).some(k => knowledgeStats.by_type![k] > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-accent font-medium">Типы:</span>
                                        {Object.entries(knowledgeStats.by_type).map(([type, count]) => count > 0 && (
                                            <span key={type} className="px-1.5 py-0.5 bg-accent-subtle rounded text-[10px]">
                                                {type === 'character' ? 'персонажи' : type === 'event' ? 'события' : type === 'location' ? 'локации' : 'концепции'}: {count}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
        {selectedUniverse && !selectedCharacter && (
            <div className="flex items-center gap-3 px-4 py-3 bg-accent-subtle rounded-xl border-2 border-accent-dim shadow-sm text-xs text-accent">
                <Clock size={16} className="text-accent shrink-0" />
                <span className="font-bold uppercase tracking-wider tech-label">Время во вселенной:</span>
                <span className="font-mono text-accent font-semibold tech-text">
                  {clock || 'Синхронизация...'}
                </span>
                <span className="ml-auto px-3 py-1 bg-accent text-white rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-sm border border-accent-dim cyber-heading">
                  ⚡ Помощник Создателя видит всё время
                </span>
            </div>
        )}
    </div>
  );
}
