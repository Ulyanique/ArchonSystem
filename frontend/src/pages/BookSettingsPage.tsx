import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { universesApi, uploadsUrl } from '../api';
import { Settings, Upload, Trash2, Image as ImageIcon, Clock, Download, Archive } from 'lucide-react';
import type { UniverseUpdate } from '../types';

interface FormState {
  title: string;
  description: string;
  genre: string;
  direction: string;
  style_notes: string;
  clock_enabled: boolean;
  universe_start_year: number;
  universe_start_day: number;
  universe_start_hour: number;
  universe_hours_per_day: number;
  universe_days_per_year: number;
  universe_epoch_name: string;
  universe_time_scale: number;
}

const defaultFormState: FormState = {
  title: '',
  description: '',
  genre: '',
  direction: '',
  style_notes: '',
  clock_enabled: false,
  universe_start_year: 2026,
  universe_start_day: 1,
  universe_start_hour: 0,
  universe_hours_per_day: 24,
  universe_days_per_year: 365,
  universe_epoch_name: 'н.э.',
  universe_time_scale: 1,
};

export default function BookSettingsPage() {
  const { universeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [restoreTitle, setRestoreTitle] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const { data: universe, isLoading } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: clockDisplay } = useQuery({
    queryKey: ['universe-clock', universeId],
    queryFn: () => universesApi.getClock(parseInt(universeId!)),
    enabled: !!universeId && !!universe && !!universe.clock_enabled,
    refetchInterval: universe?.clock_enabled ? 60_000 : false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UniverseUpdate) => universesApi.update(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe', universeId] });
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      queryClient.invalidateQueries({ queryKey: ['universe-clock', universeId] });
      toast.success('Настройки вселенной сохранены');
    },
    onError: (e: unknown) =>
      toast.error(
        'Ошибка: ' +
          (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось сохранить')
      ),
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => universesApi.uploadCover(parseInt(universeId!), file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe', universeId] });
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      toast.success('Обложка загружена');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      if (err.response?.status === 413) {
        toast.error('Файл слишком большой. Максимум 10 МБ.');
        return;
      }
      toast.error('Ошибка загрузки: ' + (err.response?.data?.detail || err.message || ''));
    },
  });

  const deleteCoverMutation = useMutation({
    mutationFn: () => universesApi.deleteCover(parseInt(universeId!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe', universeId] });
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      toast.success('Обложка удалена');
    },
    onError: (e: unknown) =>
      toast.error(
        'Ошибка: ' +
          (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '')
      ),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => universesApi.restoreBackup(file, title),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      setRestoreFile(null);
      setRestoreTitle('');
      if (restoreFileRef.current) restoreFileRef.current.value = '';
      toast.success(`Вселенная «${data.title}» восстановлена`);
      navigate(`/universes/${data.universe_id}/settings`);
    },
    onError: (e: unknown) =>
      toast.error(
        'Ошибка восстановления: ' +
          (e && typeof e === 'object' && 'response' in e && (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
            ? String((e as { response: { data: { detail: string } } }).response.data.detail)
            : (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : ''))
      ),
  });

  useEffect(() => {
    if (universe) {
      setFormState({
        title: universe.title,
        description: universe.description || '',
        genre: universe.genre || '',
        direction: universe.direction || '',
        style_notes: universe.style_notes || '',
        clock_enabled: !!universe.clock_enabled,
        universe_start_year: universe.universe_start_year ?? 2026,
        universe_start_day: universe.universe_start_day ?? 1,
        universe_start_hour: universe.universe_start_hour ?? 0,
        universe_hours_per_day: universe.universe_hours_per_day ?? 24,
        universe_days_per_year: universe.universe_days_per_year ?? 365,
        universe_epoch_name: universe.universe_epoch_name || 'н.э.',
        universe_time_scale: universe.universe_time_scale ?? 1,
      });
    }
  }, [universe?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      title: formState.title,
      description: formState.description,
      genre: formState.genre,
      direction: formState.direction,
      style_notes: formState.style_notes,
      clock_enabled: formState.clock_enabled ? 1 : 0,
      universe_start_year: formState.universe_start_year,
      universe_start_day: formState.universe_start_day,
      universe_start_hour: formState.universe_start_hour,
      universe_hours_per_day: formState.universe_hours_per_day,
      universe_days_per_year: formState.universe_days_per_year,
      universe_epoch_name: formState.universe_epoch_name || null,
      universe_time_scale: formState.universe_time_scale,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadCoverMutation.mutate(file);
    } else if (file) {
      toast.error('Выберите изображение (JPG, PNG, GIF, WebP)');
    }
    e.target.value = '';
  };

  const coverUrl = universe?.cover_image_path ? uploadsUrl(universe.cover_image_path) : null;

  if (isLoading || !universe) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
          <Settings size={24} />
          Настройки вселенной
        </h2>
        <p className="text-sm text-dark-500 mt-1">
          Название, описание, стилистика, обложка и время во вселенной
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
        {/* Основное */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-dark-800">Основное</h3>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Название</label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Описание</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
              className="input w-full"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Жанр</label>
              <input
                type="text"
                value={formState.genre}
                onChange={(e) => setFormState((s) => ({ ...s, genre: e.target.value }))}
                className="input w-full"
                placeholder="Фэнтези, детектив..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Направление / премиса</label>
              <input
                type="text"
                value={formState.direction}
                onChange={(e) => setFormState((s) => ({ ...s, direction: e.target.value }))}
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Стилистика (тон, визуальные подсказки для ИИ)
            </label>
            <textarea
              value={formState.style_notes}
              onChange={(e) => setFormState((s) => ({ ...s, style_notes: e.target.value }))}
              className="input w-full"
              rows={3}
              placeholder="Например: тёмная атмосфера, средневековье, минимализм в описаниях..."
            />
          </div>
          <div className="border border-dark-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-dark-700 mb-2">Обложка</label>
            <div className="flex flex-wrap items-start gap-4">
              {coverUrl ? (
                <div className="relative">
                  <img
                    src={coverUrl}
                    alt="Обложка вселенной"
                    className="w-32 h-44 object-cover rounded border border-dark-200"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div className="w-32 h-44 border-2 border-dashed border-dark-300 rounded items-center justify-center text-dark-400 hidden">
                    <ImageIcon size={32} />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCoverMutation.mutate()}
                    disabled={deleteCoverMutation.isPending}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    title="Удалить обложку"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-44 border-2 border-dashed border-dark-300 rounded flex items-center justify-center text-dark-400">
                  <ImageIcon size={32} />
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadCoverMutation.isPending}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Upload size={18} />
                  {coverUrl ? 'Заменить' : 'Загрузить обложку'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Время во вселенной */}
        <section className="border border-dark-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-dark-800 flex items-center gap-2">
            <Clock size={20} />
            Время во вселенной
          </h3>
          <p className="text-sm text-dark-500">
            Настройте календарь и ход времени внутри вселенной. Используется в таймлайне и контексте для ИИ.
          </p>
          {clockDisplay && (
            <p className="text-sm font-medium text-dark-700">
              Сейчас во вселенной: <span className="text-primary-600">{clockDisplay.display}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="clock_enabled"
              checked={formState.clock_enabled}
              onChange={(e) => setFormState((s) => ({ ...s, clock_enabled: e.target.checked }))}
              className="rounded border-dark-300"
            />
            <label htmlFor="clock_enabled" className="text-sm font-medium text-dark-700">
              Включить собственное время вселенной (иначе используется реальное)
            </label>
          </div>
          {formState.clock_enabled && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Год старта</label>
                <input
                  type="number"
                  value={formState.universe_start_year}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, universe_start_year: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">День года (1–365)</label>
                <input
                  type="number"
                  min={1}
                  max={366}
                  value={formState.universe_start_day}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, universe_start_day: parseInt(e.target.value, 10) || 1 }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Час старта (0–23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={formState.universe_start_hour}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, universe_start_hour: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Часов в сутках</label>
                <input
                  type="number"
                  min={1}
                  value={formState.universe_hours_per_day}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      universe_hours_per_day: parseInt(e.target.value, 10) || 24,
                    }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Дней в году</label>
                <input
                  type="number"
                  min={1}
                  value={formState.universe_days_per_year}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      universe_days_per_year: parseInt(e.target.value, 10) || 365,
                    }))
                  }
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Эпоха (название)</label>
                <input
                  type="text"
                  value={formState.universe_epoch_name}
                  onChange={(e) => setFormState((s) => ({ ...s, universe_epoch_name: e.target.value }))}
                  className="input w-full"
                  placeholder="н.э., до н.э."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Масштаб времени (1 = как в реальности)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.01}
                  value={formState.universe_time_scale}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      universe_time_scale: parseFloat(e.target.value) || 1,
                    }))
                  }
                  className="input w-full"
                  placeholder="1"
                />
                <p className="text-xs text-dark-500 mt-0.5">
                  Например: 24 = один реальный час равен одному дню во вселенной
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Бэкап и восстановление */}
        <section className="border border-dark-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-dark-800 flex items-center gap-2">
            <Archive size={20} />
            Бэкап и восстановление
          </h3>
          <p className="text-sm text-dark-500">
            Скачайте архив вселенной (БД и файлы) или восстановите вселенную из ранее сохранённого архива.
          </p>
          <div className="flex flex-wrap gap-4 items-start">
            <button
              type="button"
              onClick={async () => {
                if (!universeId) return;
                setBackupDownloading(true);
                try {
                  await universesApi.downloadBackup(parseInt(universeId));
                  toast.success('Бэкап скачан');
                } catch (e) {
                  toast.error('Ошибка: ' + (e instanceof Error ? e.message : 'не удалось скачать'));
                } finally {
                  setBackupDownloading(false);
                }
              }}
              disabled={backupDownloading}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download size={18} />
              {backupDownloading ? 'Скачивание...' : 'Скачать бэкап'}
            </button>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium text-dark-700">Восстановить из архива (создаст новую вселенную)</p>
              <form
                className="flex flex-wrap gap-2 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!restoreFile) {
                    toast.error('Выберите файл .zip');
                    return;
                  }
                  restoreMutation.mutate({ file: restoreFile, title: restoreTitle || undefined });
                }}
              >
                <input
                  ref={restoreFileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => restoreFileRef.current?.click()}
                  className="btn btn-secondary"
                >
                  Выбрать .zip
                </button>
                <input
                  type="text"
                  value={restoreTitle}
                  onChange={(e) => setRestoreTitle(e.target.value)}
                  placeholder="Название (опционально)"
                  className="input flex-1 min-w-[160px]"
                />
                <button
                  type="submit"
                  disabled={!restoreFile || restoreMutation.isPending}
                  className="btn btn-primary"
                >
                  {restoreMutation.isPending ? 'Восстановление...' : 'Восстановить'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
