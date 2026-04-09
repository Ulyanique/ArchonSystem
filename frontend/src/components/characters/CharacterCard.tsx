import { Edit2, Brain, Eye, EyeOff, UserCircle, Briefcase, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Character } from '../../types';
import { uploadsUrl } from '../../api';

interface CharacterCardProps {
  character: Character;
  onEdit: (char: Character) => void;
  onAnalyze: (char: Character) => void;
  onToggleEnabled: (char: Character) => void;
  onGoTo: (char: Character) => void;
  onDelete: (char: Character) => void;
  onGeneratePortraitPrompt?: (char: Character) => void;
  universeId?: number;
  /** Количество глав, в которых упоминается персонаж (покрытие) */
  mentionChapterCount?: number;
}

export default function CharacterCard({
  character,
  onEdit,
  onAnalyze,
  onToggleEnabled,
  onGoTo,
  onDelete,
  onGeneratePortraitPrompt: _onGeneratePortraitPrompt,
  universeId,
  mentionChapterCount
}: CharacterCardProps) {
  const portraitUrl = character.portrait_image_path ? uploadsUrl(character.portrait_image_path) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onGoTo(character)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoTo(character); } }}
      className={`card hover:shadow-md transition-all group relative overflow-hidden cursor-pointer ${
        !character.enabled ? 'opacity-70 bg-dark-50 grayscale border-amber-200' : ''
      }`}
    >
      <div className="flex gap-4">
        {/* Аватар/Портрет */}
        <div
          className="w-24 h-24 rounded-lg bg-dark-100 flex-shrink-0 overflow-hidden border border-dark-200 group"
        >
          {portraitUrl ? (
            <img
              key={`${character.id}-${character.portrait_image_path}-${character.updated_at || ''}`}
              src={`${portraitUrl}?t=${character.updated_at ? new Date(character.updated_at).getTime() : Date.now()}`}
              alt={character.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              onError={(e) => {
                // Если изображение не загрузилось, пробуем перезагрузить без кэша
                const target = e.target as HTMLImageElement;
                if (target.src && !target.src.includes('?nocache=')) {
                  target.src = `${portraitUrl}?nocache=${Date.now()}`;
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dark-400">
              <UserCircle size={48} />
            </div>
          )}
        </div>

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-dark-800 truncate hover:text-primary-600">
              {character.name}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleEnabled(character); }}
                className={`p-1.5 rounded transition-colors ${
                  character.enabled
                    ? 'text-dark-400 hover:text-dark-600 hover:bg-dark-100'
                    : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                }`}
                title={character.enabled ? "Выключить (не будет в контексте ИИ)" : "Включить"}
              >
                {character.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(character); }}
                className="p-1.5 text-dark-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                title="Редактировать"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(character); }}
                className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
            {character.role && (
              <span className="flex items-center gap-1 text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded">
                <Target size={12} />
                {character.role}
              </span>
            )}
            {character.profession && (
              <span className="flex items-center gap-1 text-dark-500 bg-dark-100 px-2 py-0.5 rounded">
                <Briefcase size={12} />
                {character.profession}
              </span>
            )}
          </div>

          <p className="text-sm text-dark-600 line-clamp-2 mt-2 leading-relaxed">
            {character.description || 'Нет описания'}
          </p>
          {mentionChapterCount != null && mentionChapterCount > 0 && universeId && (
            <div className="mt-1 text-xs text-dark-500">
              <Link to={`/universes/${universeId}/coverage`} onClick={(e) => e.stopPropagation()} className="hover:text-primary-600">
                В главах: {mentionChapterCount}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Футер карточки */}
      <div className="mt-4 pt-3 border-t border-dark-100">
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-2">
            {universeId && (
              <Link
                to={`/universes/${universeId}/knowledge?character=${character.id}`}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Настроить знания персонажа"
                onClick={(e) => e.stopPropagation()}
              >
                <Brain size={16} />
              </Link>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze(character);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Brain size={14} />
            AI Анализ
          </button>
        </div>
      </div>
    </div>
  );
}
