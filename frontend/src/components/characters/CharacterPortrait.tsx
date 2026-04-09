import { useRef } from 'react';
import { Upload, Image, X, Sparkles, Loader2 } from 'lucide-react';
import { Character } from '../../types';
import { uploadsUrl } from '../../api';

interface CharacterPortraitProps {
  character: Character;
  portraitInputRef?: React.RefObject<HTMLInputElement>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
  universeId?: number;
}

export default function CharacterPortrait({
  character,
  portraitInputRef: externalRef,
  onUpload,
  onDelete,
  onGenerate,
  isGenerating = false,
}: CharacterPortraitProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const portraitInputRef = externalRef || internalRef;
  const portraitUrl = character.portrait_image_path ? uploadsUrl(character.portrait_image_path) : null;
  // Добавляем timestamp для обхода кэша браузера
  const portraitUrlWithCacheBust = portraitUrl 
    ? `${portraitUrl}?t=${character.updated_at ? new Date(character.updated_at).getTime() : Date.now()}`
    : null;

  return (
    <div className="space-y-6 text-center">
      <div className="relative inline-block group">
        <div className="w-48 h-48 rounded-2xl bg-dark-100 border-2 border-dashed border-dark-200 overflow-hidden flex items-center justify-center relative">
          {portraitUrlWithCacheBust ? (
            <img 
              key={`portrait-${character.id}-${character.portrait_image_path}-${character.updated_at || ''}`}
              src={portraitUrlWithCacheBust} 
              alt={character.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Если изображение не загрузилось, пробуем перезагрузить без кэша
                const target = e.target as HTMLImageElement;
                if (target.src && !target.src.includes('?nocache=')) {
                  target.src = `${portraitUrl}?nocache=${Date.now()}`;
                }
              }}
            />
          ) : (
            <div className="text-dark-400 flex flex-col items-center">
              <Image size={48} className="mb-2 opacity-20" />
              <span className="text-xs font-medium">Нет портрета</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="p-2 bg-white text-primary-600 rounded-full hover:bg-primary-50 transition-colors shadow-lg"
              title="Сгенерировать портрет ИИ"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            </button>
          )}
          <button
            onClick={() => portraitInputRef.current?.click()}
            disabled={isGenerating}
            className="p-2 bg-white text-dark-800 rounded-full hover:bg-primary-50 hover:text-primary-600 transition-colors shadow-lg"
            title="Загрузить"
          >
            <Upload size={20} />
          </button>
          {portraitUrl && (
            <button
              onClick={onDelete}
              disabled={isGenerating}
              className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50 transition-colors shadow-lg"
              title="Удалить"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <input
          type="file"
          ref={portraitInputRef}
          className="hidden"
          accept="image/*"
          onChange={onUpload}
        />
      </div>
    </div>
  );
}
