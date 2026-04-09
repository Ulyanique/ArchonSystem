// src/utils/chatHistory.ts
import { storage } from './storage';

export interface ChatMessage {
  id: string; // uuid
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  universe_timestamp?: string | null;
  model?: string;
  provider?: string;
  // Доп. поля для будущего: attachments, metadata
}

const HISTORY_KEY_PREFIX = 'chat-history:';

/**
 * Тип роли пользователя в чате
 */
export type UserRole = 'author' | 'helper' | `character:${number}`;

/** Момент времени во вселенной для диалога (год, день, час, минута). */
export interface ChatTimeUniverse {
  universe_year: number;
  universe_day: number;
  universe_hour?: number;
  universe_minute?: number;
}

/**
 * Канонический ключ времени для истории: по нему переключается история при смене даты.
 * "now" = текущее время вселенной (одна общая «сессия» для режима «сейчас»).
 */
export function getChatTimeKey(chatTime: ChatTimeUniverse | null | 'now'): string {
  if (chatTime === null || chatTime === 'now') return 'now';
  const h = chatTime.universe_hour ?? 0;
  const m = chatTime.universe_minute ?? 0;
  return `Y${chatTime.universe_year}-D${chatTime.universe_day}-H${h}-M${m}`;
}

/**
 * По ключу времени вернуть ChatTimeUniverse или 'now'.
 */
export function parseChatTimeKey(chatTimeKey: string): ChatTimeUniverse | 'now' {
  if (!chatTimeKey || chatTimeKey === 'now') return 'now';
  const m = chatTimeKey.match(/^Y(\d+)-D(\d+)-H(\d+)-M(\d+)$/);
  if (!m) return 'now';
  return {
    universe_year: parseInt(m[1], 10),
    universe_day: parseInt(m[2], 10),
    universe_hour: parseInt(m[3], 10),
    universe_minute: parseInt(m[4], 10),
  };
}

/**
 * Человекочитаемая метка времени для списка диалогов.
 */
export function formatChatTimeKeyLabel(chatTimeKey: string): string {
  if (!chatTimeKey || chatTimeKey === 'now') return 'Сейчас';
  const t = parseChatTimeKey(chatTimeKey);
  if (t === 'now') return 'Сейчас';
  const h = t.universe_hour ?? 0;
  const m = t.universe_minute ?? 0;
  return `${t.universe_year} г., день ${t.universe_day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Ключ для хранения истории чата
 * Формат: chat-history:universeId:characterId:userRole:chatTimeKey
 */
function getHistoryKey(
  universeId: number,
  characterId: number | undefined,
  userRole: UserRole | undefined,
  chatTimeKey: string
): string {
  const charPart = characterId !== undefined && characterId !== null ? `:${characterId}` : ':';
  const rolePart = userRole ? `:${userRole}` : ':author';
  return `${HISTORY_KEY_PREFIX}${universeId}${charPart}${rolePart}:${chatTimeKey}`;
}

/** Префикс ключей localStorage для данной конфигурации (вселенныха, персонаж, роль). */
function getHistoryKeyPrefix(
  universeId: number,
  characterId: number | undefined,
  userRole: UserRole | undefined
): string {
  const charPart = characterId !== undefined && characterId !== null ? `:${characterId}` : ':';
  const rolePart = userRole ? `:${userRole}` : ':author';
  return `${HISTORY_KEY_PREFIX}${universeId}${charPart}${rolePart}:`;
}

/**
 * Список всех диалогов (сессий) для данной конфигурации: время + последнее сообщение.
 * Для перехода в нужный диалог по клику.
 */
export interface ChatSessionItem {
  chatTimeKey: string;
  label: string;
  lastTimestamp: number;
  preview: string;
  messageCount: number;
}

export function getChatHistorySessions(
  universeId: number,
  characterId: number | undefined,
  userRole: UserRole | undefined
): ChatSessionItem[] {
  if (typeof localStorage === 'undefined') return [];
  const prefix = getHistoryKeyPrefix(universeId, characterId, userRole);
  const sessions: ChatSessionItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const chatTimeKey = key.slice(prefix.length);
    if (!chatTimeKey) continue;
    const history = getChatHistory(universeId, characterId, userRole, chatTimeKey);
    if (history.length === 0) continue;
    const last = history[history.length - 1];
    const raw = last.content?.trim() || '';
    const preview = raw.slice(0, 60) + (raw.length > 60 ? '…' : '') || '(пусто)';
    sessions.push({
      chatTimeKey,
      label: formatChatTimeKeyLabel(chatTimeKey),
      lastTimestamp: last.timestamp,
      preview: preview || '(пусто)',
      messageCount: history.length,
    });
  }
  sessions.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return sessions;
}

export function getChatHistory(
  universeId: number,
  characterId?: number,
  userRole?: UserRole,
  chatTimeKey: string = 'now'
): ChatMessage[] {
  const key = getHistoryKey(universeId, characterId, userRole, chatTimeKey);
  const raw = storage.get<string>(key, '[]');
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch (e) {
    console.warn('[chatHistory] Ошибка парсинга истории', e);
    return [];
  }
}

/** Удалить из ответа ассистента повторяющиеся таймштампы [ЧЧ:ММ, N день Y года ...] — время подставляет интерфейс. */
export function stripUniverseTimestampFromReply(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\[\s*\d{1,2}:\d{2}\s*,\s*\d+\s*день\s*\d+\s*года\s*[^\]]*\]\s*/gi, '')
    .trim();
}

export function saveChatMessage(
  universeId: number,
  message: Omit<ChatMessage, 'id' | 'timestamp'>,
  characterId?: number,
  userRole?: UserRole,
  chatTimeKey: string = 'now'
): ChatMessage {
  const id = generateId();
  const timestamp = Date.now();
  const content =
    message.role === 'assistant'
      ? stripUniverseTimestampFromReply(message.content)
      : message.content;
  const newMessage: ChatMessage = { ...message, content, id, timestamp };
  const history = getChatHistory(universeId, characterId, userRole, chatTimeKey);
  const updated = [...history, newMessage];
  storage.set(getHistoryKey(universeId, characterId, userRole, chatTimeKey), JSON.stringify(updated));
  return newMessage;
}

export function deleteChatMessage(
  universeId: number,
  messageId: string,
  characterId?: number,
  userRole?: UserRole,
  chatTimeKey: string = 'now'
): boolean {
  const history = getChatHistory(universeId, characterId, userRole, chatTimeKey);
  const updated = history.filter(msg => msg.id !== messageId);
  if (updated.length === history.length) return false;
  storage.set(getHistoryKey(universeId, characterId, userRole, chatTimeKey), JSON.stringify(updated));
  return true;
}

export function clearChatHistory(
  universeId: number,
  characterId?: number,
  userRole?: UserRole,
  chatTimeKey: string = 'now'
): void {
  storage.remove(getHistoryKey(universeId, characterId, userRole, chatTimeKey));
}

/**
 * Удалить всю историю чатов с персонажем за всё время (все моменты времени и роли).
 * Использует прямой перебор ключей localStorage по префиксу.
 */
export function clearAllChatHistoryForCharacter(universeId: number, characterId: number): number {
  if (typeof localStorage === 'undefined') return 0;
  const prefix = `${HISTORY_KEY_PREFIX}${universeId}:${characterId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => storage.remove(k));
  return keysToRemove.length;
}

/**
 * Удалить всю историю диалогов, где пользователь говорил от имени указанного персонажа (роль «я как X»).
 * Ключи содержат userRole = `character:${characterId}`. Удаляются все такие записи для данной вселенной.
 */
export function clearAllChatHistoryForUserAsCharacter(universeId: number, characterId: number): number {
  if (typeof localStorage === 'undefined') return 0;
  const bookPrefix = `${HISTORY_KEY_PREFIX}${universeId}:`;
  const roleSuffix = `:character:${characterId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(bookPrefix) && key.includes(roleSuffix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => storage.remove(k));
  return keysToRemove.length;
}

export function updateChatMessage(
  universeId: number,
  messageId: string,
  updates: Partial<ChatMessage>,
  characterId?: number,
  userRole?: UserRole,
  chatTimeKey: string = 'now'
): boolean {
  const history = getChatHistory(universeId, characterId, userRole, chatTimeKey);
  const idx = history.findIndex(msg => msg.id === messageId);
  if (idx === -1) return false;
  history[idx] = { ...history[idx], ...updates };
  storage.set(getHistoryKey(universeId, characterId, userRole, chatTimeKey), JSON.stringify(history));
  return true;
}

// Вспомогательная функция — генерация UUID v4 (упрощённая)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}