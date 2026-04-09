import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { User, Bot, Copy, Check, Quote, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage, Character } from '../../types';
import { uploadsUrl } from '../../api';

interface ChatMessageItemProps {
  message: ChatMessage;
  characterName?: string;
  character?: Character | null;
  characterId?: number;
  universeId?: number;
  userRole?: string;
  characters?: Character[];
  onCopy: (text: string) => void;
  onSaveQuote?: (text: string) => void;
  onDelete?: (messageId: string) => void;
  copiedText: string | null;
  searchQuery?: string;
  isHighlighted?: boolean;
}

export default function ChatMessageItem({
  message,
  characterName,
  character,
  characterId,
  universeId,
  userRole,
  characters = [],
  onCopy,
  onSaveQuote,
  onDelete,
  copiedText,
  searchQuery = '',
  isHighlighted = false
}: ChatMessageItemProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [userImageError, setUserImageError] = useState(false);
  const isUser = message.role === 'user';
  
  // Определяем персонажа, от имени которого говорит пользователь
  const userCharacterId = userRole?.startsWith('character:') 
    ? parseInt(userRole.split(':')[1]) 
    : null;
  const userCharacter = userCharacterId 
    ? characters.find(c => c.id === userCharacterId) 
    : null;
  const userCharacterPortraitUrl = userCharacter?.portrait_image_path && !userImageError 
    ? uploadsUrl(userCharacter.portrait_image_path) 
    : null;
  
  // Получаем URL портрета персонажа (для сообщений от assistant)
  const portraitUrl = character?.portrait_image_path && !imageError ? uploadsUrl(character.portrait_image_path) : null;
  
  // Обработчик клика по аватарке персонажа
  const handleAvatarClick = () => {
    if (characterId && universeId) {
      navigate(`/universes/${universeId}/characters/${characterId}`);
    }
  };
  
  // Обработчик клика по аватарке пользователя (когда говорит от имени персонажа)
  const handleUserAvatarClick = () => {
    if (userCharacterId && universeId) {
      navigate(`/universes/${universeId}/characters/${userCharacterId}`);
    }
  };
  
  // Не показываем пустые сообщения от assistant (они заменяются индикатором "печатает")
  if (!isUser && (!message.content || message.content.trim() === '')) {
    return null;
  }

  // Подсветка найденного текста в markdown
  const highlightMarkdown = (text: string, query: string) => {
    if (!query) return text;
    // Экранируем специальные символы regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Заменяем найденный текст на markdown с подсветкой
    return text.replace(new RegExp(`(${escapedQuery})`, 'gi'), (match) => `**${match}**`);
  };

  // Современный дизайн с градиентами и glassmorphism
  if (isUser) {
    // Сообщение пользователя - справа, градиентный фон с эффектом стекла
    return (
      <div className="flex justify-end mb-6">
        <div className="flex items-start gap-3 max-w-[85%]">
          <div className="flex-1 flex justify-end min-w-0">
            <div className={`relative group max-w-full min-w-0 ${isHighlighted ? 'ring-2 ring-accent ring-offset-2 rounded-2xl' : ''}`}>
              {/* Фон сообщения автора — акцентный цвет из настроек */}
              <div className="bg-accent text-white rounded-2xl rounded-tr-none px-4 py-3 relative overflow-hidden">
                {/* Контент */}
                <div className="relative z-10 prose prose-sm max-w-none prose-invert text-white prose-p:my-2 prose-p:leading-relaxed prose-headings:text-white prose-strong:text-white/90 prose-code:text-white prose-pre:bg-black/30 break-words overflow-wrap-anywhere chat-message-content">
                  <ReactMarkdown>
                    {searchQuery ? highlightMarkdown(message.content, searchQuery) : message.content}
                  </ReactMarkdown>
                </div>
              </div>
              {/* Действия под сообщением */}
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <button
                  onClick={() => onCopy(message.content)}
                  className="p-1 hover:bg-white/10 active:bg-white/20 rounded transition-all duration-75 text-white/70 hover:text-white"
                  title="Копировать (Ctrl+C)"
                >
                  {copiedText === message.content ? (
                    <Check size={12} className="text-green-200" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
                {onDelete && message.id && (
                  <button
                    onClick={() => {
                      if (confirm('Удалить это сообщение?')) {
                        onDelete(message.id!);
                      }
                    }}
                    className="p-1 hover:bg-red-500/30 active:bg-red-500/40 rounded transition-all duration-75 text-red-200 hover:text-red-100"
                    title="Удалить сообщение"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              onClick={userCharacterId && universeId ? handleUserAvatarClick : undefined}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden border-2 transition-all duration-100 ${
                userCharacterId && universeId
                  ? 'cursor-pointer hover:scale-105 border-accent hover:opacity-90'
                  : 'border-accent'
              } ${
                userCharacterPortraitUrl
                  ? 'bg-gray-100 dark:bg-dark-200'
                  : 'bg-accent'
              }`}
              title={userCharacterId && universeId ? `Перейти к персонажу: ${userCharacter?.name || 'Персонаж'}` : 'Вы'}
            >
              {userCharacterPortraitUrl ? (
                <img
                  src={userCharacterPortraitUrl}
                  alt={userCharacter?.name || 'Персонаж'}
                  className="w-full h-full object-cover"
                  onError={() => setUserImageError(true)}
                />
              ) : (
                <User size={20} />
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-medium max-w-[48px] truncate text-center leading-tight">
              {userCharacter?.name || 'Вы'}
            </span>
          </div>
        </div>
      </div>
    );
  } else {
    // Сообщение AI - слева, glassmorphism эффект
    const canNavigate = characterId && universeId;
    return (
      <div className="flex justify-start mb-6">
        <div className="flex items-start gap-3 max-w-[85%]">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              onClick={canNavigate ? handleAvatarClick : undefined}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white overflow-hidden border-2 transition-all duration-100 ${
                canNavigate
                  ? 'cursor-pointer hover:scale-105 border-accent hover:opacity-90'
                  : 'border-accent'
              } ${
                portraitUrl
                  ? 'bg-gray-100 dark:bg-dark-200'
                  : 'bg-accent'
              }`}
              title={canNavigate ? `Перейти к персонажу: ${characterName || 'Персонаж'}` : characterName || 'Помощник Создателя'}
            >
              {portraitUrl && !imageError ? (
                <img
                  src={portraitUrl}
                  alt={characterName || 'Персонаж'}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Bot size={20} />
              )}
            </div>
            {characterName && (
              <span className="text-[10px] text-gray-500 font-medium max-w-[48px] truncate text-center leading-tight">
                {characterName}
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className={`relative group min-w-0 ${isHighlighted ? 'ring-2 ring-accent ring-offset-2 rounded-2xl' : ''}`}>
              {/* Фон сообщения AI — нейтральный, акцент на полосе слева */}
              <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-2xl rounded-tl-none px-4 py-3 relative overflow-hidden">
                {/* Полоса акцентного цвета слева (из настроек) */}
                <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                {/* Контент — strong/ссылки подсвечиваются акцентом через [data-accent] в CSS */}
                <div className="relative z-10 prose prose-sm max-w-none text-gray-800 dark:text-gray-200 prose-p:my-2 prose-p:leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-accent prose-code:text-gray-800 dark:prose-code:text-gray-200 prose-pre:bg-gray-100 dark:prose-pre:bg-dark-700 break-words overflow-wrap-anywhere chat-message-content">
                  <ReactMarkdown>
                    {searchQuery ? highlightMarkdown(message.content, searchQuery) : message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            {/* Временной штамп и действия под сообщением */}
            <div className="flex items-center gap-2 mt-1.5">
              {message.universe_timestamp && (
                <div className="text-xs text-accent flex items-center gap-1.5">
                  <Clock size={10} className="text-accent shrink-0" />
                  <span className="font-mono tech-text">{message.universe_timestamp}</span>
                </div>
              )}
              {/* Действия - всегда видимы */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onCopy(message.content)}
                  className="p-1 hover:bg-accent-subtle active:bg-accent-subtle rounded transition-all duration-75 text-gray-400 hover:text-accent"
                  title="Копировать (Ctrl+C)"
                >
                  {copiedText === message.content ? (
                    <Check size={12} className="text-accent" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
                {onSaveQuote && (
                  <button
                    onClick={() => onSaveQuote(message.content)}
                    className="p-1 hover:bg-accent-subtle active:bg-accent-subtle rounded transition-all duration-75 text-gray-400 hover:text-accent"
                    title="Сохранить как цитату"
                  >
                    <Quote size={12} />
                  </button>
                )}
                {onDelete && message.id && (
                  <button
                    onClick={() => {
                      if (confirm('Удалить это сообщение?')) {
                        onDelete(message.id!);
                      }
                    }}
                    className="p-1 hover:bg-red-100 active:bg-red-200 rounded transition-all duration-75 text-gray-400 hover:text-red-600"
                    title="Удалить сообщение"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
