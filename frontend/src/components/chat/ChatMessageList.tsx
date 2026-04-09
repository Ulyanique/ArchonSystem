import { useRef, useLayoutEffect } from 'react';
import { ChatMessage } from '../../types';
import ChatMessageItem from './ChatMessageItem';
import { Bot, Code } from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessage[];
  characterName?: string;
  character?: any;
  characterId?: number;
  universeId?: number;
  userRole?: string;
  characters?: any[];
  isLoading: boolean;
  onCopy: (text: string) => void;
  onSaveQuote: (text: string) => void;
  onDelete?: (messageId: string) => void;
  copiedText: string | null;
  showPrompt?: boolean;
  prompt?: string | null;
  searchQuery?: string;
  searchResults?: number[];
  currentSearchIndex?: number;
}

export default function ChatMessageList({
  messages,
  characterName,
  character,
  characterId,
  universeId,
  userRole,
  characters = [],
  isLoading,
  onCopy,
  onSaveQuote,
  onDelete,
  copiedText,
  showPrompt = false,
  prompt = null,
  searchQuery = '',
  searchResults = [],
  currentSearchIndex = -1
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(messages.length);

  // Проверяем, находится ли пользователь внизу списка
  const isNearBottom = () => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const threshold = 100; // пикселей от низа
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  // Прокрутка только если пользователь внизу или добавлено новое сообщение
  useLayoutEffect(() => {
    const shouldScroll = isNearBottom() || messages.length !== lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (shouldScroll && endRef.current) {
      // Мгновенная прокрутка без анимации
      endRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [messages.length, isLoading]);


  return (
    <div ref={containerRef} className="h-full px-4 py-6 scrollbar-hide">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white shadow-sm">
            <Bot size={32} />
          </div>
          <p className="text-lg font-medium text-gray-600">Начните диалог с вашей вселенной</p>
        </div>
      ) : (
        <>
          {messages.map((msg, idx) => {
            const isHighlighted = searchQuery && searchResults.includes(idx);
            const isCurrentResult = isHighlighted && idx === searchResults[currentSearchIndex];
            const isLastAssistantMessage = idx === messages.length - 1 && msg.role === 'assistant';
            
            return (
              <div key={`message-wrapper-${idx}`}>
                {/* Показываем промпт перед последним сообщением от assistant */}
                {isLastAssistantMessage && showPrompt && prompt && (
                  <div className="flex justify-end mb-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex-1 flex justify-end min-w-0">
                        <div className="bg-accent-subtle border border-accent-dim rounded-2xl rounded-tr-none px-4 py-3 shadow-sm w-full">
                          <div className="text-xs font-semibold text-accent mb-2 uppercase tracking-wide">Системный промпт</div>
                          <div className="text-xs text-dark-700 dark:text-dark-200 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto">{prompt}</div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        <Code size={16} />
                      </div>
                    </div>
                  </div>
                )}
                <div 
                  key={msg.id ?? `msg-${idx}`}
                  className={isCurrentResult ? 'ring-2 ring-accent ring-offset-2 rounded-xl' : ''}
                  data-message-index={idx}
                >
                  <ChatMessageItem
                    message={msg}
                    characterName={characterName}
                    character={character}
                    characterId={characterId}
                    universeId={universeId}
                    userRole={userRole}
                    characters={characters}
                    onCopy={onCopy}
                    onSaveQuote={onSaveQuote}
                    onDelete={onDelete}
                    copiedText={copiedText}
                    searchQuery={searchQuery}
                    isHighlighted={!!isHighlighted}
                  />
                </div>
              </div>
            );
          })}
          {isLoading && (() => {
            // Проверяем, есть ли уже сообщение от assistant (даже с частичным контентом)
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const hasAssistantMessage = lastMessage?.role === 'assistant';
            const hasContent = lastMessage?.content && lastMessage.content.trim().length > 0;
            
            // Показываем индикатор только если:
            // 1. Нет сообщений вообще ИЛИ
            // 2. Последнее сообщение не от assistant ИЛИ
            // 3. Последнее сообщение от assistant, но пустое
            if (hasAssistantMessage && hasContent) {
              return null;
            }
            
            // Убеждаемся, что последнее сообщение - от пользователя (чтобы индикатор был после него)
            const lastUserMessage = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
            if (!lastUserMessage && messages.length > 0) {
              return null;
            }
            
            return (
              <div className="flex justify-start mb-6">
                <div className="flex items-start gap-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white border-2 border-accent">
                    <Bot size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-2xl rounded-tl-none px-4 py-3 min-h-[44px] flex items-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                      <div className="relative z-10 flex items-center gap-1 text-accent text-sm leading-relaxed ml-2">
                        <span className="font-medium">печатает</span>
                        <span className="typing-dots">
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
      <div ref={endRef} style={{ minHeight: '1px' }} />
    </div>
  );
}
