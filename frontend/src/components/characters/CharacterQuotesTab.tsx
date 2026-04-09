import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotesApi, charactersApi } from '../../api';
import QuoteCard from '../QuoteCard';
import { Quote } from '../../types';

export default function CharacterQuotesTab({
  characterId,
  universeId,
  characterName
}: {
  characterId: number;
  universeId: number;
  characterName: string
}) {
  const navigate = useNavigate();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes', universeId, characterId],
    queryFn: () => quotesApi.getByCharacter(universeId, characterId),
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(universeId),
  });

  const getInterlocutorName = (quote: Quote) => {
    if (quote.interlocutor_type === 'character' && quote.interlocutor_id) {
      return characters.find(c => c.id === quote.interlocutor_id)?.name;
    }
    return undefined;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-dark-500">Загрузка цитат...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-dark-800">Цитаты персонажа</h3>
        <button
          onClick={() => navigate(`/universes/${universeId}/quotes?character=${characterId}`)}
          className="btn btn-secondary text-sm"
        >
          Перейти к всем цитатам
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-8 text-dark-500">
          <p>У этого персонажа пока нет сохранённых цитат.</p>
          <p className="text-sm mt-2">Добавьте цитаты из чата или на странице «Цитаты».</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {quotes.map(quote => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              characterName={characterName}
              interlocutorName={getInterlocutorName(quote)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
