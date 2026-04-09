import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Dice5, Sparkles, Loader2, Check } from 'lucide-react';

interface AIGenerateButtonProps {
  onGenerate: () => Promise<unknown>;
  onResult: (result: unknown) => void;
  tooltip?: string;
  variant?: 'default' | 'primary' | 'small';
}

export default function AIGenerateButton({ 
  onGenerate, 
  onResult, 
  tooltip = 'Сгенерировать ИИ',
  variant = 'default'
}: AIGenerateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const result = await onGenerate();
      onResult(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось сгенерировать';
      console.error('AI generation error:', error);
      toast.error('Ошибка генерации: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClass = variant === 'small' ? 'p-1' : variant === 'primary' ? 'px-4 py-2' : 'p-2';
  const iconSize = variant === 'small' ? 14 : variant === 'primary' ? 18 : 16;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          ${sizeClass}
          ${variant === 'primary' 
            ? 'bg-accent text-white hover:brightness-110' 
            : 'bg-accent text-white hover:brightness-110'
          }
          rounded-lg shadow-md transition-all duration-200 
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2 font-medium
        `}
        title={tooltip}
      >
        {isLoading ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          <>
            <Dice5 size={iconSize} />
            {variant === 'primary' && <span>🎲 Сгенерировать</span>}
          </>
        )}
      </button>

      {showTooltip && !isLoading && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-800"></div>
        </div>
      )}
    </div>
  );
}

// Компонент для отображения результатов генерации
export function AIGenerationModal({ 
  results, 
  onSelect, 
  onClose,
  title = "Результаты генерации",
  renderItem,
  multiSelect = false,
  onAddSelected,
}: { 
  results: unknown[], 
  onSelect?: (item: unknown) => void, 
  onClose: () => void,
  title?: string,
  renderItem: (item: unknown, index: number) => React.ReactNode,
  multiSelect?: boolean,
  onAddSelected?: (items: unknown[]) => void,
}) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const toggleIndex = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(() => {
    if (!onAddSelected || selectedIndices.size === 0) return;
    const items = results.filter((_, i) => selectedIndices.has(i));
    onAddSelected(items);
    setSelectedIndices(new Set());
  }, [onAddSelected, results, selectedIndices]);

  const allSelected = results.length > 0 && selectedIndices.size === results.length;
  const selectAll = useCallback(() => {
    if (allSelected) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(results.map((_, i) => i)));
  }, [allSelected, results]);

  if (!results || results.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-dark-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={24} className="text-accent" />
            <h2 className="text-xl font-bold text-dark-800">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-100 rounded-lg">
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((item, index) => (
              <div key={index} className={multiSelect ? 'flex gap-3 items-start' : ''}>
                {multiSelect && (
                  <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-2">
                    <input
                      type="checkbox"
                      checked={selectedIndices.has(index)}
                      onChange={() => toggleIndex(index)}
                      className="rounded border-dark-300"
                    />
                    <span className="text-sm text-dark-600">Выбрать</span>
                  </label>
                )}
                <div
                  className={multiSelect ? 'flex-1 min-w-0' : ''}
                  onClick={!multiSelect && onSelect ? () => onSelect(item) : undefined}
                  role={!multiSelect && onSelect ? 'button' : undefined}
                >
                  {renderItem(item, index)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {multiSelect && onAddSelected && (
              <button
                onClick={handleAddSelected}
                disabled={selectedIndices.size === 0}
                className="btn btn-primary flex items-center gap-2"
              >
                <Check size={16} />
                Добавить выбранных {selectedIndices.size > 0 && `(${selectedIndices.size})`}
              </button>
            )}
            {multiSelect && (
              <button
                type="button"
                onClick={selectAll}
                className="btn btn-secondary"
              >
                {allSelected ? 'Снять всех' : 'Выбрать всех'}
              </button>
            )}
            {multiSelect && selectedIndices.size > 0 && !allSelected && (
              <button
                type="button"
                onClick={() => setSelectedIndices(new Set())}
                className="btn btn-secondary"
              >
                Снять выделение
              </button>
            )}
            <button onClick={onClose} className="btn btn-secondary">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
