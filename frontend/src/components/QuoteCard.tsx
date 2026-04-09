import { Quote } from '../types';
import { MessageSquare, Edit2, Trash2 } from 'lucide-react';

interface QuoteCardProps {
  quote: Quote;
  characterName: string;
  interlocutorName?: string;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
}

export default function QuoteCard({ quote, characterName, interlocutorName, onEdit, onDelete }: QuoteCardProps) {
  const getInterlocutorLabel = () => {
    if (quote.interlocutor_type === 'author') {
      return 'Создателем';
    } else if (quote.interlocutor_type === 'helper') {
      return 'Помощником';
    } else if (quote.interlocutor_type === 'character' && interlocutorName) {
      return interlocutorName;
    }
    return 'неизвестным';
  };

  return (
    <div className="bg-white border border-dark-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-dark-500">
          <MessageSquare size={16} />
          <span className="font-medium text-dark-700">{characterName}</span>
          <span>в диалоге с</span>
          <span className="font-medium text-dark-700">{getInterlocutorLabel()}</span>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(quote)}
              className="p-1 hover:bg-dark-100 rounded"
              title="Редактировать"
            >
              <Edit2 size={16} className="text-dark-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(quote)}
              className="p-1 hover:bg-red-100 rounded"
              title="Удалить"
            >
              <Trash2 size={16} className="text-red-500" />
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-dark-50 rounded p-3 mb-2 border-l-4 border-primary-500">
        <p className="text-dark-800 italic whitespace-pre-wrap">{quote.quote_text}</p>
      </div>
      
      {quote.context && (
        <div className="text-xs text-dark-500 mb-2">
          <strong>Контекст:</strong> {quote.context}
        </div>
      )}
      
      <div className="text-xs text-dark-400">
        {new Date(quote.created_at).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  );
}
