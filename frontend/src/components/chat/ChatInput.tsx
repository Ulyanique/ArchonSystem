import { Send, X } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ChatInputProps {
  input: string;
  setInput: (s: string) => void;
  isLoading: boolean;
  modelBusy?: boolean;
  onSend: (e: React.FormEvent) => void;
  onCancel: () => void;
  draftKey?: string; // Ключ для сохранения черновика в localStorage
}

export default function ChatInput({ input, setInput, isLoading, modelBusy = false, onSend, onCancel, draftKey }: ChatInputProps) {
  const sendDisabled = isLoading || modelBusy;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Загрузка черновика при монтировании (только при смене draftKey)
  useEffect(() => {
    if (draftKey) {
      const savedDraft = localStorage.getItem(`chat-draft-${draftKey}`);
      if (savedDraft && !input) {
        setInput(savedDraft);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when draftKey changes
  }, [draftKey]);

  // Сохранение черновика в localStorage
  useEffect(() => {
    if (draftKey && input) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(`chat-draft-${draftKey}`, input);
      }, 500); // Дебаунс 500мс
      return () => clearTimeout(timeoutId);
    } else if (draftKey && !input) {
      localStorage.removeItem(`chat-draft-${draftKey}`);
    }
  }, [input, draftKey]);

  // Автоматическое изменение высоты textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const minHeight = 52;
      const maxHeight = 200;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [input]);

  // Обработка горячих клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc для отмены генерации
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onCancel]);

  return (
    <form onSubmit={onSend} className="relative flex gap-3 p-4 bg-white dark:bg-dark-800 w-full flex-shrink-0 border-t border-gray-200 dark:border-dark-600">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={modelBusy ? "Модель занята генерацией — выберите другую в настройках" : "Спросите что-нибудь у персонажа или ИИ... (Shift+Enter для новой строки)"}
          className="w-full px-4 py-3 pr-12 rounded-2xl bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none min-h-[52px] max-h-[200px] text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-100"
          disabled={isLoading}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !sendDisabled) {
                // Очищаем черновик при отправке
                if (draftKey) {
                  localStorage.removeItem(`chat-draft-${draftKey}`);
                }
                onSend(e);
              }
            }
          }}
          style={{
            overflowY: 'auto'
          }}
        />
      </div>
      {isLoading ? (
        <button
          type="button"
          onClick={onCancel}
          className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 active:bg-red-800 transition-all flex items-center justify-center w-[52px] h-[52px] flex-shrink-0"
          title="Прервать генерацию (Esc)"
        >
          <X size={20} />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim() || sendDisabled}
          className="p-3 bg-accent text-white rounded-xl hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center w-[52px] h-[52px] flex-shrink-0"
          title={modelBusy ? "Модель занята генерацией — выберите другую" : input.trim() ? "Отправить сообщение (Enter)" : "Введите сообщение"}
        >
          <Send size={20} />
        </button>
      )}
    </form>
  );
}
