import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChatSidebarProps {
  sessions: any[];
  currentKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatSidebar({ sessions, currentKey, onSelect, collapsed, onToggle }: ChatSidebarProps) {
  if (collapsed) {
    return (
      <div className="w-12 border-l border-dark-100 bg-dark-50 flex flex-col items-center py-4 gap-4">
        <button onClick={onToggle} className="p-1 hover:bg-dark-200 rounded-lg text-dark-500">
          <ChevronLeft size={20} />
        </button>
        <div className="text-[10px] font-bold text-dark-400 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
          История чатов
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-dark-100 bg-dark-50 flex flex-col animate-slideInRight">
      <div className="p-4 border-b border-dark-100 flex justify-between items-center bg-white/50">
        <h2 className="text-xs font-bold text-dark-500 uppercase tracking-widest cyber-heading">История диалогов</h2>
        <button onClick={onToggle} className="p-1 hover:bg-dark-200 rounded-lg text-dark-400">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 app-scrollbar">
        {sessions.map((session) => (
          <button
            key={session.chatTimeKey}
            onClick={() => onSelect(session.chatTimeKey)}
            className={`w-full text-left p-3 rounded-xl transition-all border ${
              currentKey === session.chatTimeKey
                ? 'bg-white dark:bg-dark-700 border-accent-dim shadow-sm ring-1 ring-accent/20'
                : 'border-transparent hover:bg-white/60 hover:border-dark-200'
            }`}
          >
            <div className="text-[10px] font-bold text-accent mb-1">{session.label}</div>
            <p className="text-xs text-dark-600 line-clamp-2 leading-relaxed">{session.preview}</p>
            <div className="mt-2 text-[10px] text-dark-400">{session.messageCount} сообщений</div>
          </button>
        ))}
      </div>
    </div>
  );
}
