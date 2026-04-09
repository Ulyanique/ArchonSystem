import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { chatApi, universesApi, charactersApi, quotesApi, systemSettingsApi, notesApi, chaptersApi } from '../api';
import { ChatMessage } from '../types';
import {
  getChatHistory, saveChatMessage, clearChatHistory, deleteChatMessage,
  getChatTimeKey, parseChatTimeKey, getChatHistorySessions,
  stripUniverseTimestampFromReply,
  type UserRole, type ChatTimeUniverse
} from '../utils/chatHistory';

import ChatHeader from '../components/chat/ChatHeader';
import ChatSettings from '../components/chat/ChatSettings';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import TimePickerModal from '../components/chat/TimePickerModal';
import RAGContextDisplay from '../components/RAGContextDisplay';
import { useJobQueueStore } from '../store/jobQueue';
import { useChatGenerationStore, isGenerationForContext } from '../store/chatGeneration';
import { X, Search, ChevronUp, ChevronDown, FileText, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
  const { universeId } = useParams();
  const uId = parseInt(universeId!);
  
  // Функция для получения ключа localStorage для состояния чата конкретной вселенной
  const getChatStateKey = useCallback((universeId: number, key: string) => `chat-state-${universeId}-${key}`, []);
  
  // Загружаем сохраненное состояние чата для этой вселенной
  const loadChatState = useCallback((universeId: number) => {
    try {
      const saved = localStorage.getItem(getChatStateKey(universeId, 'state'));
      if (saved) {
        const state = JSON.parse(saved);
        return {
          selectedCharacterId: state.selectedCharacterId || undefined,
          userRole: (state.userRole || 'author') as UserRole,
          chatTime: (state.chatTime || 'now') as ChatTimeUniverse | 'now',
          useCharacterKnowledge: state.useCharacterKnowledge !== undefined ? state.useCharacterKnowledge : true,
          noContext: state.noContext || false,
        includeNoteIds: state.includeNoteIds || [],
        includeChapterIds: state.includeChapterIds || [],
        };
      }
    } catch (e) {
      console.error('Failed to load chat state:', e);
    }
    return {
      selectedCharacterId: undefined,
      userRole: 'author' as UserRole,
      chatTime: 'now' as ChatTimeUniverse | 'now',
      useCharacterKnowledge: true,
      noContext: false,
      includeNoteIds: [] as number[],
      includeChapterIds: [] as number[],
    };
  }, [getChatStateKey]);
  
  // Сохраняем состояние чата
  const saveChatState = useCallback((universeId: number, state: {
    selectedCharacterId?: number;
    userRole: UserRole;
    chatTime: ChatTimeUniverse | 'now';
    useCharacterKnowledge: boolean;
    noContext: boolean;
    includeNoteIds?: number[];
    includeChapterIds?: number[];
  }) => {
    try {
      localStorage.setItem(getChatStateKey(universeId, 'state'), JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save chat state:', e);
    }
  }, [getChatStateKey]);
  
  const initialState = loadChatState(uId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(initialState.userRole);
  const [chatTime, setChatTime] = useState<ChatTimeUniverse | 'now'>(initialState.chatTime);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  // Загружаем провайдер из localStorage или используем значение по умолчанию
  const [provider, setProvider] = useState(() => {
    const saved = localStorage.getItem('chat-provider');
    return saved || 'ollama';
  });
  // Загружаем модель из localStorage или используем пустую строку
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('chat-model');
    return saved || '';
  });
  const [useStream, setUseStream] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [noContext, setNoContext] = useState(initialState.noContext);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | undefined>(initialState.selectedCharacterId);
  const [useCharacterKnowledge, setUseCharacterKnowledge] = useState(initialState.useCharacterKnowledge);
  const [knowledgeStats, setKnowledgeStats] = useState<{ known_characters_count: number; known_events_count: number } | null>(null);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteContent, setQuoteContent] = useState('');
  const [universeClock, setUniverseClock] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [lastRagContext, setLastRagContext] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [includeNoteIds, setIncludeNoteIds] = useState<number[]>(initialState.includeNoteIds || []);
  const [includeChapterIds, setIncludeChapterIds] = useState<number[]>(initialState.includeChapterIds || []);
  const [showIncludeContextModal, setShowIncludeContextModal] = useState(false);
  const [modalSelection, setModalSelection] = useState({ noteIds: [] as number[], chapterIds: [] as number[] });
  
  // Сбрасываем useCharacterKnowledge при смене персонажа
  useEffect(() => {
    if (selectedCharacterId) {
      setUseCharacterKnowledge(true);
    } else {
      setUseCharacterKnowledge(false);
    }
  }, [selectedCharacterId]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamThrottleRef = useRef<{ buffer: string; lastFlush: number }>({ buffer: '', lastFlush: 0 });
  const STREAM_THROTTLE_MS = 60;

  // Для Помощника Создателя всегда используем 'now'
  const chatTimeKey = selectedCharacterId ? getChatTimeKey(chatTime) : 'now';
  
  // Сохраняем состояние чата при изменении ключевых параметров
  useEffect(() => {
    saveChatState(uId, {
      selectedCharacterId,
      userRole,
      chatTime,
      useCharacterKnowledge,
      noContext,
      includeNoteIds,
      includeChapterIds,
    });
  }, [selectedCharacterId, userRole, chatTime, useCharacterKnowledge, noContext, includeNoteIds, includeChapterIds, uId, saveChatState]);

  // Queries
  const { data: universe } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(uId),
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(uId),
  });

  // Загружаем системные настройки
  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.get,
  });

  const { data: modelsData } = useQuery({
    queryKey: ['models', provider],
    queryFn: () => chatApi.getModels(provider),
  });

  const { data: notesForContext = [] } = useQuery({
    queryKey: ['notes', uId],
    queryFn: () => notesApi.getAll(uId),
    enabled: showIncludeContextModal && !!uId,
  });

  const { data: chaptersForContext = [] } = useQuery({
    queryKey: ['chapters', uId],
    queryFn: () => chaptersApi.getAll(uId),
    enabled: showIncludeContextModal && !!uId,
  });
  
  const models = Array.isArray(modelsData) ? modelsData : (modelsData?.models || []);

  const currentJob = useJobQueueStore((s) => s.current);
  const busyModelInfo = useMemo(() => {
    if (!currentJob || !systemSettings) return null;
    if (currentJob.type === 'portrait') {
      const imgProv = (systemSettings.image_provider || 'openrouter').toLowerCase();
      if (imgProv === 'cloudflare') return null;
      if (imgProv === 'whisk') return { provider: 'whisk', model: 'Whisk (Imagen)' };
      if (imgProv === 'pixazo') {
        const pixazoModel = (systemSettings.pixazo_model || 'flux-1-schnell').toLowerCase();
        return { provider: 'pixazo', model: pixazoModel === 'flux-2-pro' ? 'Flux 2 Pro' : 'Flux 1 Schnell' };
      }
      const model = systemSettings.openrouter_image_model ?? 'google/gemini-2.5-flash-image';
      return { provider: 'openrouter', model };
    }
    const prov = systemSettings.default_provider || 'ollama';
    const model =
      prov === 'ollama' ? (systemSettings.ollama_model || '')
      : prov === 'deepseek' ? (systemSettings.deepseek_model || '')
      : prov === 'openrouter' ? (systemSettings.openrouter_model || '')
      : prov === 'routerai' ? (systemSettings.routerai_model || '')
      : '';
    return { provider: prov, model };
  }, [currentJob, systemSettings]);
  const isCurrentModelBusy =
    !!busyModelInfo && provider === busyModelInfo.provider && model === busyModelInfo.model;

  const chatGen = useChatGenerationStore();
  const historyTimeKeyForContext = selectedCharacterId ? chatTimeKey : 'now';
  const isChatGeneratingHere = isGenerationForContext(
    chatGen,
    uId,
    selectedCharacterId,
    userRole,
    historyTimeKeyForContext
  );
  const displayedMessages = useMemo(() => {
    if (!isChatGeneratingHere) return messages;
    const streamingMsg: ChatMessage = {
      id: 'streaming',
      role: 'assistant',
      content: stripUniverseTimestampFromReply(chatGen.content),
      universe_timestamp: universeClock || undefined,
    };
    return [...messages, streamingMsg];
  }, [messages, isChatGeneratingHere, chatGen.content, universeClock]);

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

  // Загружаем статистику знаний персонажа при изменении персонажа или времени
  useEffect(() => {
    if (selectedCharacterId && uId) {
      const year = chatTime !== 'now' && typeof chatTime === 'object' ? chatTime.universe_year : undefined;
      const day = chatTime !== 'now' && typeof chatTime === 'object' ? chatTime.universe_day : undefined;
      charactersApi.getKnowledgeStats(uId, selectedCharacterId, year, day)
        .then(stats => setKnowledgeStats(stats))
        .catch(() => setKnowledgeStats(null));
    } else {
      setKnowledgeStats(null);
    }
  }, [selectedCharacterId, chatTime, uId]);

  // Update clock
  useEffect(() => {
    if (chatTime === 'now') {
        const fetchClock = async () => {
            try {
                const clock = await universesApi.getClock(uId);
                setUniverseClock(clock.display);
            } catch { /* ignore clock fetch */ }
        };
        fetchClock();
        const interval = setInterval(fetchClock, 30000);
        return () => clearInterval(interval);
    } else {
        setUniverseClock(`${chatTime.universe_hour || 0}:${chatTime.universe_minute || 0}, ${chatTime.universe_day} день ${chatTime.universe_year} года`);
    }
  }, [uId, chatTime]);

  // History sessions
  const chatSessions = useMemo(
    () => getChatHistorySessions(uId, selectedCharacterId, userRole),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages.length used inside getChatHistorySessions
    [uId, selectedCharacterId, userRole, messages.length]
  );

  // Загружаем сохраненное состояние при смене вселенной
  useEffect(() => {
    const state = loadChatState(uId);
    setSelectedCharacterId(state.selectedCharacterId);
    setUserRole(state.userRole);
    setChatTime(state.chatTime);
    setUseCharacterKnowledge(state.useCharacterKnowledge);
    setNoContext(state.noContext);
  }, [uId, loadChatState]);

  // Для Помощника Создателя всегда используем текущее время
  useEffect(() => {
    if (!selectedCharacterId) {
      setChatTime('now');
    }
  }, [selectedCharacterId]);

  // Load history on change
  useEffect(() => {
    // Для помощника создателя всегда используем 'now'
    const timeKey = selectedCharacterId ? chatTimeKey : 'now';
    const history = getChatHistory(uId, selectedCharacterId, userRole, timeKey);
    setMessages(history);
  }, [uId, selectedCharacterId, userRole, chatTimeKey]);

  // Устанавливаем провайдер из системных настроек при первой загрузке (если нет сохраненного)
  useEffect(() => {
    if (systemSettings && !settingsInitialized) {
      const savedProvider = localStorage.getItem('chat-provider');
      const defaultProvider = systemSettings.default_provider || 'ollama';
      // Используем сохраненный провайдер, если есть, иначе - из настроек
      const initialProvider = savedProvider || defaultProvider;
      setProvider(initialProvider);
      if (!savedProvider) {
        localStorage.setItem('chat-provider', initialProvider);
      }
      setSettingsInitialized(true);
    }
  }, [systemSettings, settingsInitialized]);

  // Сохраняем провайдер в localStorage при изменении
  useEffect(() => {
    if (settingsInitialized && provider) {
      localStorage.setItem('chat-provider', provider);
    }
  }, [provider, settingsInitialized]);

  // Получаем модель по умолчанию для провайдера из системных настроек
  const getDefaultModelForProvider = useCallback((providerName: string): string => {
    if (!systemSettings) return '';
    if (providerName === 'ollama') {
      return systemSettings.ollama_model || '';
    } else if (providerName === 'deepseek') {
      return systemSettings.deepseek_model || '';
    } else if (providerName === 'openrouter') {
      return systemSettings.openrouter_model || '';
    } else if (providerName === 'routerai') {
      return systemSettings.routerai_model || '';
    }
    return '';
  }, [systemSettings]);

  // Устанавливаем модель из системных настроек для текущего провайдера
  useEffect(() => {
    if (systemSettings && provider && models.length > 0) {
      const savedModel = localStorage.getItem('chat-model');
      const savedProvider = localStorage.getItem('chat-provider');
      const defaultModel = getDefaultModelForProvider(provider);

      // Если провайдер изменился, используем модель из настроек или первую доступную
      if (savedProvider !== provider) {
        if (defaultModel && models.includes(defaultModel)) {
          setModel(defaultModel);
        } else if (models.length > 0) {
          setModel(models[0]);
        }
      } else if (!model || (settingsInitialized && !models.includes(model))) {
        // Если модель не установлена или не найдена в списке
        // НЕ перезаписываем модель, если она уже выбрана пользователем (особенно :free модели)
        if (savedModel && models.includes(savedModel)) {
          setModel(savedModel);
        } else if (defaultModel && models.includes(defaultModel)) {
          setModel(defaultModel);
        } else if (models.length > 0) {
          setModel(models[0]);
        }
      }
      // Если текущая модель валидна и находится в списке, не перезаписываем её
      // Это важно для сохранения выбранных пользователем :free моделей
    } else if (models.length > 0 && !model && !systemSettings) {
      // Fallback: устанавливаем первую доступную модель, если настройки еще не загружены
      setModel(models[0]);
    }
  }, [systemSettings, provider, models, model, settingsInitialized, getDefaultModelForProvider]);

  // Сохраняем модель в localStorage при изменении
  useEffect(() => {
    if (settingsInitialized && model && models.includes(model)) {
      localStorage.setItem('chat-model', model);
    }
  }, [model, settingsInitialized, models]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (isCurrentModelBusy) {
      toast.error('Эта модель занята генерацией. Выберите другую модель для чата.');
      return;
    }

    // Для Помощника Создателя всегда используем текущее время (undefined = текущее время)
    let chatTimePayload = undefined;
    if (selectedCharacterId && chatTime !== 'now') {
        chatTimePayload = chatTime;
    }

    const userMsg: ChatMessage = {
        role: 'user',
        content: input,
        universe_timestamp: universeClock || undefined
    };
    
    // Для Помощника Создателя всегда используем 'now' для истории
    const historyTimeKey = selectedCharacterId ? chatTimeKey : 'now';
    const savedUserMsg = saveChatMessage(uId, userMsg, selectedCharacterId, userRole, historyTimeKey);

    // Мгновенно добавляем сообщение пользователя и очищаем поле ввода
    flushSync(() => {
      setMessages(prev => [...prev, savedUserMsg]);
      setInput('');
    });
    
    if (showPrompt) setCurrentPrompt(null);
    setLastRagContext(null);
    
    // Устанавливаем isLoading только после того, как сообщение пользователя отрендерилось
    // Используем requestAnimationFrame для гарантии рендеринга
    requestAnimationFrame(() => {
      setIsLoading(true);
    });
    
    abortControllerRef.current = new AbortController();

    // Собираем диалоги в контекст для Помощника Создателя: автор↔персонаж и персонаж↔персонаж
    let otherChatsHistory: Array<{ character_name: string; character_id: number; messages: ChatMessage[] }> | undefined;
    if (!selectedCharacterId && characters.length > 0) {
        const MAX_MESSAGES_PER_CHAT = 20;
        const entries: Array<{ character_name: string; character_id: number; messages: ChatMessage[]; lastTs: number }> = [];
        // Диалоги автор ↔ персонаж
        for (const c of characters) {
            const msgs = getChatHistory(uId, c.id, 'author', 'now').slice(-MAX_MESSAGES_PER_CHAT);
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                entries.push({
                    character_name: `Автор → ${c.name}`,
                    character_id: c.id,
                    messages: msgs,
                    lastTs: last?.timestamp ?? 0,
                });
            }
        }
        // Диалоги «от имени персонажа»: персонаж A → персонаж B
        for (const target of characters) {
            for (const speaker of characters) {
                if (speaker.id === target.id) continue;
                const role = `character:${speaker.id}` as UserRole;
                const msgs = getChatHistory(uId, target.id, role, 'now').slice(-MAX_MESSAGES_PER_CHAT);
                if (msgs.length > 0) {
                    const last = msgs[msgs.length - 1];
                    entries.push({
                        character_name: `${speaker.name} → ${target.name}`,
                        character_id: target.id,
                        messages: msgs,
                        lastTs: last?.timestamp ?? 0,
                    });
                }
            }
        }
        // Сортируем по последней активности, берём до 15 диалогов
        entries.sort((a, b) => b.lastTs - a.lastTs);
        otherChatsHistory = entries.slice(0, 15).map(({ character_name, character_id, messages }) => ({
            character_name,
            character_id,
            messages,
        }));
    }

    // Убеждаемся, что модель передается правильно (особенно важно для :free моделей)
    if (!model) {
      toast.error('Модель не выбрана. Пожалуйста, выберите модель в настройках.');
      return;
    }

    const payload = {
      universe_id: uId,
      character_id: selectedCharacterId,
      messages: [...messages, userMsg],
      provider,
      model, // Модель должна включать суффикс :free для бесплатных моделей OpenRouter
      stream: useStream,
      chat_time: chatTimePayload,
      other_chats_history: otherChatsHistory,
      user_role: userRole,
      include_note_ids: includeNoteIds.length > 0 ? includeNoteIds : undefined,
      include_chapter_ids: includeChapterIds.length > 0 ? includeChapterIds : undefined,
      options: {
        show_prompt: showPrompt,
        show_rag_context: !noContext,
        no_context: noContext,
        use_character_knowledge: selectedCharacterId ? useCharacterKnowledge : false
      }
    };

    try {
      if (useStream) {
        const historyTimeKey = selectedCharacterId ? chatTimeKey : 'now';
        useChatGenerationStore.getState().start({
          universeId: uId,
          characterId: selectedCharacterId,
          userRole,
          chatTimeKey: historyTimeKey,
        });
        streamThrottleRef.current = { buffer: '', lastFlush: 0 };

        let assistantContent = '';
        let gotRagInStream = false;

        const flushStreamBuffer = () => {
          if (streamThrottleRef.current.buffer) {
            useChatGenerationStore.getState().appendContent(streamThrottleRef.current.buffer);
            streamThrottleRef.current.buffer = '';
            streamThrottleRef.current.lastFlush = Date.now();
          }
        };

        for await (const chunk of chatApi.sendStream(payload, abortControllerRef.current.signal)) {
          if (typeof chunk === 'object' && chunk !== null && 'type' in chunk) {
            if (chunk.type === 'prompt') {
              setCurrentPrompt((chunk as { prompt: string }).prompt);
              continue;
            }
            if (chunk.type === 'rag_context') {
              gotRagInStream = true;
              setLastRagContext((chunk as { rag_context: string }).rag_context);
              continue;
            }
          }
          const textChunk = typeof chunk === 'string' ? chunk : '';
          if (!textChunk) continue;
          
          assistantContent += textChunk;
          streamThrottleRef.current.buffer += textChunk;
          const now = Date.now();
          if (now - streamThrottleRef.current.lastFlush >= STREAM_THROTTLE_MS) {
            flushStreamBuffer();
          }
        }

        flushStreamBuffer();
        if (!noContext && !gotRagInStream) setLastRagContext('');

        if (assistantContent) {
          const finalAssistantMsg = { 
            role: 'assistant' as const, 
            content: assistantContent, 
            universe_timestamp: universeClock || undefined 
          };
          const savedAssistantMsg = saveChatMessage(uId, finalAssistantMsg, selectedCharacterId, userRole, historyTimeKey);
          setMessages(prev => [...prev, savedAssistantMsg]);
        }
        useChatGenerationStore.getState().finish();
      } else {
        const response = await chatApi.send(payload);
        if (response.prompt) setCurrentPrompt(response.prompt);
        if (response.rag_context !== undefined) setLastRagContext(response.rag_context ?? '');
        else if (!noContext) setLastRagContext('');
        const historyTimeKey = selectedCharacterId ? chatTimeKey : 'now';
        const savedAssistantMsg = saveChatMessage(uId, {
            role: 'assistant',
            content: response.content,
            universe_timestamp: response.universe_timestamp || universeClock || undefined
        }, selectedCharacterId, userRole, historyTimeKey);
        
        setMessages(prev => [...prev, savedAssistantMsg]);
      }
    } catch (err: any) {
      useChatGenerationStore.getState().finish();
      if (err.name !== 'AbortError') {
        // Проверяем статус код ошибки
        const statusCode = err.response?.status || err.statusCode;
        const errorMessage = err.response?.data?.detail || err.message || '';
        
        // Улучшенная обработка ошибок с детальными сообщениями
        let errorText = '';
        let duration = 5000;
        
        if (statusCode === 402) {
          // Ошибка оплаты
          if (provider === 'openrouter') {
            errorText = 'Недостаточно средств на балансе OpenRouter. Пожалуйста, пополните баланс на https://openrouter.ai или используйте бесплатную модель с суффиксом :free';
          } else if (provider === 'routerai') {
            errorText = 'Недостаточно средств на балансе RouterAI. Пожалуйста, пополните баланс на https://routerai.ru';
          } else {
            errorText = errorMessage || 'Недостаточно средств на балансе. Пожалуйста, пополните баланс.';
          }
          duration = 8000;
        } else if (statusCode === 401) {
          // Ошибка авторизации
          if (provider === 'openrouter') {
            errorText = 'Неверный API ключ OpenRouter. Пожалуйста, проверьте API ключ в настройках на https://openrouter.ai';
          } else if (provider === 'routerai') {
            errorText = 'Неверный API ключ RouterAI. Пожалуйста, проверьте API ключ в настройках';
          } else {
            errorText = errorMessage || 'Ошибка авторизации. Проверьте API ключ в настройках.';
          }
          duration = 8000;
        } else if (statusCode === 400) {
          // Ошибка запроса
          errorText = errorMessage || 'Неверный запрос. Проверьте правильность модели и параметров.';
          if (provider === 'openrouter' && model && !model.includes(':free')) {
            errorText += ' Убедитесь, что используете правильную модель.';
          }
        } else {
          // Другие ошибки
          errorText = errorMessage || 'Произошла ошибка при отправке запроса.';
          if (provider === 'openrouter') {
            errorText += ' Проверьте настройки на https://openrouter.ai';
          }
        }
        
        toast.error(errorText, {
          duration: duration,
        });
        
        // Логируем ошибку для отладки
        console.error('Chat error:', {
          statusCode,
          errorMessage,
          provider,
          model,
          error: err
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    useChatGenerationStore.getState().finish();
    setIsLoading(false);
    toast('Генерация прервана');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success('Скопировано');
  };

  const handleSaveQuote = (text: string) => {
    setQuoteContent(text);
    setShowQuoteModal(true);
  };

  const handleDeleteMessage = (messageId: string) => {
    const historyTimeKey = selectedCharacterId ? chatTimeKey : 'now';
    const deleted = deleteChatMessage(uId, messageId, selectedCharacterId, userRole, historyTimeKey);
    if (deleted) {
      // Обновляем состояние сообщений, удаляя сообщение из списка
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Сообщение удалено');
    } else {
      toast.error('Не удалось удалить сообщение');
    }
  };

  const confirmSaveQuote = async () => {
    try {
        await quotesApi.create(uId, {
            character_id: selectedCharacterId!,
            quote_text: quoteContent,
            interlocutor_type: userRole === 'author' ? 'author' : 'character',
            interlocutor_id: userRole.startsWith('character:') ? parseInt(userRole.split(':')[1]) : null
        } as any);
        toast.success('Цитата сохранена');
        setShowQuoteModal(false);
    } catch (err: any) {
        toast.error('Ошибка: ' + err.message);
    }
  };

  const handleFixTime = async () => {
      // Для Помощника Создателя фиксация времени недоступна
      if (!selectedCharacterId) {
          toast.error('Помощник Создателя всегда видит текущее время');
          return;
      }
      try {
          const clock = await universesApi.getClock(uId);
          setChatTime({
              universe_year: clock.year,
              universe_day: clock.day,
              universe_hour: clock.hour,
              universe_minute: clock.minute
          });
          toast.success('Момент зафиксирован');
      } catch {
          toast.error('Не удалось получить время');
      }
  };

  const handleSelectTime = (time: ChatTimeUniverse) => {
      // Для Помощника Создателя выбор времени недоступен
      if (!selectedCharacterId) {
          toast.error('Помощник Создателя всегда видит текущее время');
          setShowTimePicker(false);
          return;
      }
      setChatTime(time);
      setShowTimePicker(false);
      toast.success('Время изменено');
  };

  const handleResetToNow = () => {
      // Для Помощника Создателя это не имеет смысла
      if (!selectedCharacterId) {
          setShowTimePicker(false);
          return;
      }
      setChatTime('now');
      setShowTimePicker(false);
      toast.success('Переключено на текущее время');
  };

  // Поиск по сообщениям
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    displayedMessages.forEach((msg, idx) => {
      if (msg.content.toLowerCase().includes(query)) {
        results.push(idx);
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, displayedMessages]);

  // Горячие клавиши для поиска
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Поиск"]') as HTMLInputElement;
        searchInput?.focus();
      } else if (e.shiftKey && e.key === 'F3' && searchQuery) {
        e.preventDefault();
        if (searchResults.length > 0) {
          const prevIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
          setCurrentSearchIndex(prevIndex);
          const messageIndex = searchResults[prevIndex];
          const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'F3' && searchQuery) {
        e.preventDefault();
        if (searchResults.length > 0) {
          const nextIndex = (currentSearchIndex + 1) % searchResults.length;
          setCurrentSearchIndex(nextIndex);
          const messageIndex = searchResults[nextIndex];
          const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, searchResults, currentSearchIndex]);

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    // Прокрутка к найденному сообщению
    const messageIndex = searchResults[nextIndex];
    const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    const messageIndex = searchResults[prevIndex];
    const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="h-full flex flex-col bg-dark-50 rounded-3xl overflow-hidden border border-dark-200 shadow-inner" style={{ height: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div className="flex-1 flex min-h-0" style={{ minHeight: 0, display: 'flex', flex: '1 1 0%' }}>
        <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0, display: 'flex', flex: '1 1 0%', flexDirection: 'column' }}>
          <div className="p-4 flex-1 flex flex-col min-h-0" style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flex: '1 1 0%', flexDirection: 'column' }}>
            <ChatHeader
              selectedUniverse={universe}
              selectedCharacter={selectedCharacter}
              userRole={userRole}
              characters={characters}
              onCharacterChange={setSelectedCharacterId}
              onRoleChange={setUserRole}
              onClearHistory={() => {
                const historyTimeKey = selectedCharacterId ? chatTimeKey : 'now';
                if (confirm('Очистить?')) {
                  clearChatHistory(uId, selectedCharacterId, userRole, historyTimeKey);
                  setMessages([]);
                }
              }}
              onToggleSettings={() => setShowSettings(!showSettings)}
              messagesCount={displayedMessages.length}
              clock={universeClock}
              onFixTime={handleFixTime}
              onSelectTime={() => setShowTimePicker(true)}
              onResetTime={handleResetToNow}
              chatTime={chatTime}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              knowledgeStats={knowledgeStats}
              universeId={universeId}
            />

            {showSettings && (
              <ChatSettings
                provider={provider} setProvider={setProvider}
                model={model} setModel={setModel}
                models={models}
                busyProvider={busyModelInfo?.provider ?? null}
                busyModel={busyModelInfo?.model ?? null}
                useStream={useStream} setUseStream={setUseStream}
                showPrompt={showPrompt} setShowPrompt={setShowPrompt}
                noContext={noContext} setNoContext={setNoContext}
                useCharacterKnowledge={useCharacterKnowledge}
                setUseCharacterKnowledge={setUseCharacterKnowledge}
                hasCharacter={!!selectedCharacterId}
              />
            )}

            <div className="flex-1 min-h-0 bg-dark-50 rounded-3xl border border-dark-200 flex flex-col" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
                {/* Поиск по сообщениям */}
                {searchQuery && (
                  <div className="px-4 py-2 bg-accent-subtle border-b border-accent-dim flex items-center gap-2">
                    <Search size={16} className="text-accent" />
                    <span className="text-sm text-accent flex-1">
                      Найдено: {searchResults.length} {searchResults.length === 1 ? 'сообщение' : searchResults.length < 5 ? 'сообщения' : 'сообщений'}
                      {currentSearchIndex >= 0 && ` (${currentSearchIndex + 1} из ${searchResults.length})`}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={handleSearchPrev}
                        disabled={searchResults.length === 0}
                        className="p-1.5 text-accent hover:bg-accent-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Предыдущее (Shift+F3)"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={handleSearchNext}
                        disabled={searchResults.length === 0}
                        className="p-1.5 text-accent hover:bg-accent-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Следующее (F3)"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1.5 text-accent hover:bg-accent-subtle rounded-lg transition-colors"
                        title="Закрыть поиск"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {/* Прокручиваемая область сообщений - занимает все доступное пространство, оставляя место для поля ввода */}
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ minHeight: 0, maxHeight: '100%' }}>
                  <div style={{ paddingBottom: '100px' }} className="px-4">
                    <RAGContextDisplay
                      context={lastRagContext}
                      emptyHint={!noContext && systemSettings?.enable_rag !== false}
                    />
                    <ChatMessageList
                        messages={displayedMessages}
                        characterName={selectedCharacter?.name}
                        character={selectedCharacter}
                        characterId={selectedCharacterId}
                        universeId={uId}
                        userRole={userRole}
                        characters={characters}
                        isLoading={isLoading || isChatGeneratingHere}
                        onCopy={handleCopy}
                        onSaveQuote={handleSaveQuote}
                        onDelete={handleDeleteMessage}
                        copiedText={copiedText}
                        showPrompt={showPrompt}
                        prompt={currentPrompt}
                        searchQuery={searchQuery}
                        searchResults={searchResults}
                        currentSearchIndex={currentSearchIndex}
                    />
                  </div>
                </div>
                {/* Строка «Включить в контекст»: выбранные заметки и главы */}
                <div className="flex-shrink-0 px-4 py-2 border-t border-dark-100 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-dark-500">В контекст:</span>
                  {(includeNoteIds.length > 0 || includeChapterIds.length > 0) ? (
                    <span className="text-sm text-dark-700">
                      {includeNoteIds.length > 0 && `${includeNoteIds.length} ${includeNoteIds.length === 1 ? 'заметка' : includeNoteIds.length < 5 ? 'заметки' : 'заметок'}`}
                      {includeNoteIds.length > 0 && includeChapterIds.length > 0 && ', '}
                      {includeChapterIds.length > 0 && `${includeChapterIds.length} ${includeChapterIds.length === 1 ? 'глава' : includeChapterIds.length < 5 ? 'главы' : 'глав'}`}
                    </span>
                  ) : (
                    <span className="text-sm text-dark-400">ничего не выбрано</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setModalSelection({ noteIds: [...includeNoteIds], chapterIds: [...includeChapterIds] });
                      setShowIncludeContextModal(true);
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <FileText size={14} />
                    {includeNoteIds.length > 0 || includeChapterIds.length > 0 ? 'Изменить' : 'Добавить заметки/главы'}
                  </button>
                </div>
                {/* Фиксированное поле ввода внизу - всегда видно, не может выйти за пределы контейнера */}
                <div className="flex-shrink-0 bg-dark-50 border-t border-dark-200" style={{ flexShrink: 0 }}>
                  <ChatInput
                      input={input}
                      setInput={setInput}
                      isLoading={isLoading || isChatGeneratingHere}
                      modelBusy={isCurrentModelBusy}
                      onSend={handleSend}
                      onCancel={handleCancel}
                      draftKey={`${uId}-${selectedCharacterId || 'ai'}-${userRole}`}
                  />
                </div>
            </div>
          </div>
        </div>

        <ChatSidebar
            sessions={chatSessions}
            currentKey={chatTimeKey}
            onSelect={(key) => {
              // Для Помощника Создателя не позволяем выбирать время
              if (!selectedCharacterId) return;
              setChatTime(parseChatTimeKey(key));
            }}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-zoomIn">
                  <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
                      <h2 className="text-xl font-bold text-dark-800">Сохранить цитату</h2>
                      <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="p-4 bg-dark-50 rounded-2xl italic text-dark-600 border border-dark-100 max-h-60 overflow-y-auto">
                          <ReactMarkdown>{quoteContent}</ReactMarkdown>
                      </div>
                      <p className="text-sm text-dark-400">Цитата будет закреплена за персонажем <strong>{selectedCharacter?.name}</strong>.</p>
                      <div className="flex justify-end gap-3">
                          <button onClick={() => setShowQuoteModal(false)} className="btn btn-secondary">Отмена</button>
                          <button onClick={confirmSaveQuote} className="btn btn-primary px-8">Сохранить</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Модальное окно: выбор заметок и глав для контекста */}
      {showIncludeContextModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-100 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-zoomIn">
            <div className="p-6 border-b border-dark-200 flex justify-between items-center bg-dark-50">
              <h2 className="text-xl font-bold text-dark-800">Включить в контекст чата</h2>
              <button onClick={() => setShowIncludeContextModal(false)} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              <p className="text-sm text-dark-500">Выберите заметки и/или главы — их полный текст будет подставлен в контекст при отправке сообщения.</p>
              <div>
                <h3 className="text-sm font-bold text-dark-700 mb-2 flex items-center gap-2"><FileText size={16} /> Заметки и черновики</h3>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto border border-dark-200 rounded-xl p-2">
                  {notesForContext.map((n: { id: number; title?: string; note_type?: string }) => (
                    <li key={n.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={modalSelection.noteIds.includes(n.id)}
                        onChange={() => setModalSelection(prev => ({
                          ...prev,
                          noteIds: prev.noteIds.includes(n.id) ? prev.noteIds.filter(id => id !== n.id) : [...prev.noteIds, n.id],
                        }))}
                        className="rounded border-dark-300 text-primary-600"
                      />
                      <span className="text-sm text-dark-700 truncate flex-1">{n.title || 'Без названия'}</span>
                      {n.note_type && <span className="text-xs text-dark-400">{(n.note_type === 'draft' ? 'Черновик' : n.note_type)}</span>}
                    </li>
                  ))}
                  {notesForContext.length === 0 && <li className="text-sm text-dark-400 py-2">Нет заметок</li>}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-dark-700 mb-2 flex items-center gap-2"><BookOpen size={16} /> Главы</h3>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto border border-dark-200 rounded-xl p-2">
                  {chaptersForContext.map((c: { id: number; title?: string; chapter_number?: number }) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={modalSelection.chapterIds.includes(c.id)}
                        onChange={() => setModalSelection(prev => ({
                          ...prev,
                          chapterIds: prev.chapterIds.includes(c.id) ? prev.chapterIds.filter(id => id !== c.id) : [...prev.chapterIds, c.id],
                        }))}
                        className="rounded border-dark-300 text-primary-600"
                      />
                      <span className="text-sm text-dark-700 truncate flex-1">
                        {c.chapter_number != null ? `Глава ${c.chapter_number}: ` : ''}{c.title || 'Без названия'}
                      </span>
                    </li>
                  ))}
                  {chaptersForContext.length === 0 && <li className="text-sm text-dark-400 py-2">Нет глав</li>}
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-dark-200 flex justify-end gap-3 bg-dark-50">
              <button onClick={() => setShowIncludeContextModal(false)} className="btn btn-secondary">Отмена</button>
              <button
                onClick={() => {
                  setIncludeNoteIds(modalSelection.noteIds);
                  setIncludeChapterIds(modalSelection.chapterIds);
                  setShowIncludeContextModal(false);
                }}
                className="btn btn-primary"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
          <TimePickerModal
              universe={universe}
              currentTime={chatTime === 'now' ? null : chatTime}
              universeId={uId}
              onSelect={handleSelectTime}
              onReset={handleResetToNow}
              onClose={() => setShowTimePicker(false)}
          />
      )}
    </div>
  );
}
