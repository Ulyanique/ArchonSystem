import { useState, useEffect } from 'react';
import { X, Clock, RotateCcw } from 'lucide-react';
import { ChatTimeUniverse } from '../../utils/chatHistory';
import { universesApi } from '../../api';

interface TimePickerModalProps {
  universe: any;
  currentTime: ChatTimeUniverse | null;
  universeId: number;
  onSelect: (time: ChatTimeUniverse) => void;
  onReset?: () => void;
  onClose: () => void;
}

export default function TimePickerModal({
  universe,
  currentTime,
  universeId,
  onSelect,
  onReset: _onReset,
  onClose
}: TimePickerModalProps) {
  const [year, setYear] = useState<number>(currentTime?.universe_year || 2026);
  const [day, setDay] = useState<number>(currentTime?.universe_day || 1);
  const [hour, setHour] = useState<number>(currentTime?.universe_hour || 0);
  const [minute, setMinute] = useState<number>(currentTime?.universe_minute || 0);
  const [loadingCurrentTime, setLoadingCurrentTime] = useState(false);

  useEffect(() => {
    if (currentTime) {
      setYear(currentTime.universe_year);
      setDay(currentTime.universe_day);
      setHour(currentTime.universe_hour || 0);
      setMinute(currentTime.universe_minute || 0);
    } else {
      // Загружаем текущее время вселенной при открытии, если время не зафиксировано
      loadCurrentTime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadCurrentTime = async () => {
    setLoadingCurrentTime(true);
    try {
      const clock = await universesApi.getClock(universeId);
      setYear(clock.year);
      setDay(clock.day);
      setHour(clock.hour);
      setMinute(clock.minute);
    } catch (error) {
      console.error('Не удалось загрузить текущее время', error);
    } finally {
      setLoadingCurrentTime(false);
    }
  };

  const handleLoadCurrent = async () => {
    await loadCurrentTime();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Валидация
    if (year < 1) {
      alert('Год должен быть больше 0');
      return;
    }
    if (day < 1) {
      alert('День должен быть больше 0');
      return;
    }
    // Можно добавить проверку максимального дня в году, если есть такая информация
    onSelect({
      universe_year: year,
      universe_day: day,
      universe_hour: hour,
      universe_minute: minute
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-zoomIn">
        <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-dark-800">Выбор времени во вселенной</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-dark-200 rounded-full transition-colors duration-75"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-2">
                Год
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-dark-700 mb-2">
                День
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                min="1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-dark-700 mb-2">
                  Час
                </label>
                <input
                  type="number"
                  value={hour}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setHour(Math.max(0, Math.min(23, val)));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                  min="0"
                  max="23"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 mb-2">
                  Минута
                </label>
                <input
                  type="number"
                  value={minute}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setMinute(Math.max(0, Math.min(59, val)));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                  min="0"
                  max="59"
                  required
                />
              </div>
            </div>
          </div>

          <div className="bg-accent-subtle border border-accent-dim rounded-xl p-4">
            <div className="text-xs font-semibold text-accent mb-1">Выбранное время:</div>
            <div className="text-sm font-mono text-dark-800 dark:text-dark-200">
              {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}, {day} день {year} года {universe?.universe_epoch_name || 'н.э.'}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button
              type="button"
              onClick={handleLoadCurrent}
              disabled={loadingCurrentTime}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors duration-75"
            >
              <RotateCcw size={16} className={loadingCurrentTime ? 'animate-spin' : ''} />
              {loadingCurrentTime ? 'Загрузка...' : 'Загрузить текущее'}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors duration-75"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-medium text-white bg-accent hover:brightness-110 rounded-xl transition-colors duration-75"
              >
                Применить (Ctrl+Enter)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
