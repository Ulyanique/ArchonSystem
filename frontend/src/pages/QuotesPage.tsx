import { useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi, charactersApi } from '../api';
import { Quote, QuoteCreate } from '../types';
import { MessageSquare, Plus, Search, X } from 'lucide-react';
import QuoteCard from '../components/QuoteCard';

export default function QuotesPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  // Проверяем URL параметры для фильтрации по персонажу
  const urlParams = new URLSearchParams(window.location.search);
  const urlCharacterId = urlParams.get('character');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | undefined>(
    urlCharacterId ? parseInt(urlCharacterId) : undefined
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [formState, setFormState] = useState<QuoteCreate>({
    universe_id: parseInt(universeId!),
    character_id: 0,
    interlocutor_type: 'author',
    interlocutor_id: null,
    quote_text: '',
    context: ''
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes', universeId, selectedCharacterId],
    queryFn: () => quotesApi.getAll(parseInt(universeId!), selectedCharacterId),
    enabled: !!universeId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: QuoteCreate) => quotesApi.create(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', universeId] });
      setShowModal(false);
      setEditingQuote(null);
      setFormState({
        universe_id: parseInt(universeId!),
        character_id: 0,
        interlocutor_type: 'author',
        interlocutor_id: null,
        quote_text: '',
        context: ''
      });
      toast.success('Цитата сохранена');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<QuoteCreate> }) => 
      quotesApi.update(parseInt(universeId!), id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', universeId] });
      setShowModal(false);
      setEditingQuote(null);
      toast.success('Цитата обновлена');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotesApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', universeId] });
      toast.success('Цитата удалена');
    },
  });

  const openEdit = (quote: Quote) => {
    setEditingQuote(quote);
    setFormState({
      universe_id: quote.universe_id,
      character_id: quote.character_id,
      interlocutor_type: quote.interlocutor_type,
      interlocutor_id: quote.interlocutor_id || null,
      quote_text: quote.quote_text,
      context: quote.context || ''
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingQuote(null);
    setFormState({
      universe_id: parseInt(universeId!),
      character_id: 0,
      interlocutor_type: 'author',
      interlocutor_id: null,
      quote_text: '',
      context: ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.quote_text.trim()) {
      toast.error('Текст цитаты не может быть пустым');
      return;
    }
    if (!formState.character_id) {
      toast.error('Выберите персонажа');
      return;
    }
    if (formState.interlocutor_type === 'character' && !formState.interlocutor_id) {
      toast.error('Выберите персонажа-собеседника');
      return;
    }

    if (editingQuote) {
      updateMutation.mutate({ id: editingQuote.id, data: formState });
    } else {
      createMutation.mutate(formState);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const character = characters.find(c => c.id === quote.character_id);
      const characterName = character?.name.toLowerCase() || '';
      const quoteText = quote.quote_text.toLowerCase();
      const context = (quote.context || '').toLowerCase();
      return quoteText.includes(searchLower) || characterName.includes(searchLower) || context.includes(searchLower);
    }
    return true;
  });

  const getCharacterName = (characterId: number) => {
    return characters.find(c => c.id === characterId)?.name || 'Неизвестный персонаж';
  };

  const getInterlocutorName = (quote: Quote) => {
    if (quote.interlocutor_type === 'character' && quote.interlocutor_id) {
      return getCharacterName(quote.interlocutor_id);
    }
    return undefined;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare size={28} className="text-primary-600" />
          <h1 className="text-2xl font-bold text-dark-800">Цитаты</h1>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Добавить цитату
        </button>
      </div>

      {/* Фильтры и поиск */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Поиск по тексту, персонажу или контексту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={selectedCharacterId || ''}
          onChange={(e) => setSelectedCharacterId(e.target.value ? parseInt(e.target.value) : undefined)}
          className="input"
        >
          <option value="">Все персонажи</option>
          {characters.map(char => (
            <option key={char.id} value={char.id}>{char.name}</option>
          ))}
        </select>
        {selectedCharacterId && (
          <button
            onClick={() => setSelectedCharacterId(undefined)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <X size={16} />
            Сбросить фильтр
          </button>
        )}
      </div>

      {/* Список цитат */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-dark-500">Загрузка цитат...</div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare size={48} className="text-dark-300 mb-4" />
          <h3 className="text-lg font-semibold text-dark-700 mb-2">
            {searchQuery || selectedCharacterId ? 'Цитаты не найдены' : 'Нет цитат'}
          </h3>
          <p className="text-dark-500 mb-4">
            {searchQuery || selectedCharacterId 
              ? 'Попробуйте изменить фильтры поиска'
              : 'Добавьте первую цитату из чата или вручную'}
          </p>
          {!searchQuery && !selectedCharacterId && (
            <button onClick={openCreate} className="btn btn-primary">
              Добавить цитату
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto">
          {filteredQuotes.map(quote => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              characterName={getCharacterName(quote.character_id)}
              interlocutorName={getInterlocutorName(quote)}
              onEdit={openEdit}
              onDelete={(q) => {
                if (confirm('Удалить эту цитату?')) {
                  deleteMutation.mutate(q.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl my-8">
            <div className="border-b border-dark-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-800">
                {editingQuote ? 'Редактировать цитату' : 'Добавить цитату'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingQuote(null);
                }}
                className="p-2 hover:bg-dark-100 rounded-lg"
              >
                <X size={20} className="text-dark-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Персонаж (кто сказал) *
                </label>
                <select
                  value={formState.character_id}
                  onChange={(e) => setFormState({ ...formState, character_id: parseInt(e.target.value) })}
                  className="input w-full"
                  required
                >
                  <option value={0}>Выберите персонажа</option>
                  {characters.map(char => (
                    <option key={char.id} value={char.id}>{char.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Тип собеседника *
                </label>
                <select
                  value={formState.interlocutor_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'character' | 'author' | 'helper';
                    setFormState({
                      ...formState,
                      interlocutor_type: newType,
                      interlocutor_id: newType === 'character' ? formState.interlocutor_id : null
                    });
                  }}
                  className="input w-full"
                  required
                >
                  <option value="author">Создатель</option>
                  <option value="helper">Помощник</option>
                  <option value="character">Другой персонаж</option>
                </select>
              </div>

              {formState.interlocutor_type === 'character' && (
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Персонаж-собеседник *
                  </label>
                  <select
                    value={formState.interlocutor_id || 0}
                    onChange={(e) => setFormState({ ...formState, interlocutor_id: parseInt(e.target.value) || null })}
                    className="input w-full"
                    required
                  >
                    <option value={0}>Выберите персонажа</option>
                    {characters
                      .filter(char => char.id !== formState.character_id)
                      .map(char => (
                        <option key={char.id} value={char.id}>{char.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Текст цитаты *
                </label>
                <textarea
                  value={formState.quote_text}
                  onChange={(e) => setFormState({ ...formState, quote_text: e.target.value })}
                  className="input w-full"
                  rows={6}
                  placeholder="Введите текст цитаты..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Контекст (опционально)
                </label>
                <textarea
                  value={formState.context || ''}
                  onChange={(e) => setFormState({ ...formState, context: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="Опишите ситуацию, в которой была сказана эта цитата..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingQuote(null);
                  }}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Сохранение...'
                    : editingQuote
                    ? 'Сохранить изменения'
                    : 'Создать цитату'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
