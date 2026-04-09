import { useState, useRef } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { locationsApi, aiCriticApi, aiGeneratorApi, uploadsUrl, coverageApi } from '../api';
import { MapPin, Plus, Trash2, Edit2, Brain, Eye, EyeOff, Sparkles, Upload, X } from 'lucide-react';
import { Location, GeneratedLocation } from '../types';
import AICriticPanel from '../components/AICriticPanel';
import AIGenerateButton, { AIGenerationModal } from '../components/AIGenerateButton';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { validateLocation } from '../utils/validation';
import { enqueueJob } from '../store/jobQueue';

export default function LocationsPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedLocations, setGeneratedLocations] = useState<GeneratedLocation[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({ name: '', description: '', location_type: '', details: '' });
  const [autofillLoading, setAutofillLoading] = useState(false);
  const locationImageInputRef = useRef<HTMLInputElement>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: coverageStats } = useQuery({
    queryKey: ['coverage', universeId],
    queryFn: () => coverageApi.getStats(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => locationsApi.create(parseInt(universeId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
      setShowModal(false);
      setEditingLocation(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      locationsApi.update(parseInt(universeId!), id, data),
    onSuccess: (updatedLocation, variables) => {
      // Обновляем кэш - используем данные с сервера (они всегда актуальные)
      queryClient.setQueryData(['locations', universeId], (old: Location[] | undefined) => {
        if (!old) return old;
        return old.map(loc => {
          if (loc.id === variables.id) {
            // Используем данные с сервера если есть, иначе обновляем оптимистично
            if (updatedLocation) {
              return updatedLocation;
            }
            // Оптимистичное обновление
            const updated = { ...loc };
            // Явно устанавливаем enabled из variables.data
            if ('enabled' in variables.data) {
              updated.enabled = variables.data.enabled;
            } else {
              // Если enabled не передано, используем остальные данные
              Object.assign(updated, variables.data);
            }
            return updated;
          }
          return loc;
        });
      });
      // НЕ инвалидируем сразу - даем время для обновления UI
      // Инвалидируем только через небольшую задержку для синхронизации с сервером
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
      }, 100);
      setShowModal(false);
      setEditingLocation(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => locationsApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = { name: formState.name, description: formState.description, location_type: formState.location_type, details: formState.details };
    
    const validation = validateLocation(data);
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        toast.error(error.message);
      });
      return;
    }
    
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAnalyze = async (location: Location) => {
    setIsAnalyzing(true);
    try {
      const result = await aiCriticApi.analyzeLocation(parseInt(universeId!), location.id);
      setAiAnalysis(result);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error('Ошибка анализа: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openEdit = (location: Location | null) => {
    setEditingLocation(location);
    setFormState(location ? { name: location.name, description: location.description || '', location_type: location.location_type || '', details: location.details || '' } : { name: '', description: '', location_type: '', details: '' });
    setShowModal(true);
  };

  const handleAutofillLocation = async () => {
    if (!editingLocation?.id || !universeId) return;
    setAutofillLoading(true);
    try {
      const result = await locationsApi.autofill(parseInt(universeId), editingLocation.id);
      setFormState(prev => ({ ...prev, ...result }));
      toast.success('Поля заполнены по контексту.');
    } catch (e: any) {
      toast.error('Ошибка автозаполнения: ' + (e?.message || 'Не удалось'));
    } finally {
      setAutofillLoading(false);
    }
  };

  const handleGenerateLocations = async () => {
    try {
      const result = await aiGeneratorApi.locations(parseInt(universeId!), undefined, 6);
      setGeneratedLocations(Array.isArray(result) ? result : []);
      setShowGenerated(true);
    } catch (error: any) {
      toast.error('Ошибка генерации: ' + (error.message || 'Не удалось сгенерировать'));
    }
  };

  const handleGenerateOneLocationWithImage = () => {
    if (!universeId) return;
    enqueueJob('location', 'Локация по контексту + картинка', async () => {
      const id = 'location-one';
      toast.loading('Генерация локации по контексту вселенной...', { id, duration: Infinity });
      try {
        const ideas = await aiGeneratorApi.locations(parseInt(universeId!), undefined, 1);
        if (!ideas?.length) {
          toast.error('Не удалось сгенерировать идею локации', { id, duration: 5000 });
          setTimeout(() => toast.dismiss(id), 5000);
          return;
        }
        toast.loading('Создание локации и генерация изображения...', { id, duration: Infinity });
        const created = await aiGeneratorApi.applyLocation(parseInt(universeId!), toLocationData(ideas[0]));
        await locationsApi.generateImage(parseInt(universeId!), created.id);
        queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
        toast.success(`Локация «${created.name}» создана с описанием и картинкой`, { id, duration: 4000 });
        setTimeout(() => toast.dismiss(id), 4000);
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? e?.message ?? 'Ошибка';
        toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg), { id, duration: 5000 });
        setTimeout(() => toast.dismiss(id), 5000);
      }
    });
  };

  const toLocationData = (loc: any) => ({
    name: loc.name,
    description: loc.description || '',
    location_type: loc.type || loc.location_type || '',
    details: loc.secret || loc.details || '',
  });

  const handleAddSelectedLocations = async (items: any[]) => {
    for (const loc of items) {
      await locationsApi.create(parseInt(universeId!), toLocationData(loc));
    }
    queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
  };

  const handleGenerateLocationImage = (loc: Location) => {
    if (!universeId || !loc.id) return;
    enqueueJob('other', `Изображение: ${loc.name}`, async () => {
      toast.loading('Генерация изображения локации...', { id: 'location-image', duration: Infinity });
      try {
        const updated = await locationsApi.generateImage(parseInt(universeId), loc.id);
        queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
        if (editingLocation?.id === loc.id) setEditingLocation(updated);
        toast.success('Изображение сгенерировано', { id: 'location-image', duration: 4000 });
        setTimeout(() => toast.dismiss('location-image'), 4000);
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? e?.message ?? 'Ошибка';
        toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg), { id: 'location-image', duration: 5000 });
        setTimeout(() => toast.dismiss('location-image'), 5000);
      }
    });
  };

  const handleUploadLocationImage = async (loc: Location, file: File) => {
    if (!universeId || !loc.id) return;
    toast.loading('Загрузка изображения...', { id: 'location-image', duration: Infinity });
    try {
      const updated = await locationsApi.uploadImage(parseInt(universeId), loc.id, file);
      queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
      if (editingLocation?.id === loc.id) setEditingLocation(updated);
      toast.success('Изображение загружено', { id: 'location-image', duration: 4000 });
      setTimeout(() => toast.dismiss('location-image'), 4000);
    } catch (e: any) {
      toast.error('Ошибка загрузки: ' + (e?.message ?? 'Не удалось'), { id: 'location-image', duration: 5000 });
      setTimeout(() => toast.dismiss('location-image'), 5000);
    }
  };

  const handleDeleteLocationImage = async (loc: Location) => {
    if (!universeId || !loc.id) return;
    toast.loading('Удаление изображения...', { id: 'location-image', duration: Infinity });
    try {
      const updated = await locationsApi.deleteImage(parseInt(universeId), loc.id);
      queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
      if (editingLocation?.id === loc.id) setEditingLocation(updated);
      toast.success('Изображение удалено', { id: 'location-image', duration: 4000 });
      setTimeout(() => toast.dismiss('location-image'), 4000);
    } catch (e: any) {
      toast.error('Ошибка удаления: ' + (e?.message ?? 'Не удалось'), { id: 'location-image', duration: 5000 });
      setTimeout(() => toast.dismiss('location-image'), 5000);
    }
  };

  const toggleEnabled = (loc: Location) => {
    const current = loc.enabled ?? false;
    const newEnabled = !current;

    // Сразу обновляем кэш оптимистично для мгновенного отображения
    queryClient.setQueryData(['locations', universeId], (old: Location[] | undefined) => {
      if (!old) return old;
      return old.map(l =>
        l.id === loc.id ? { ...l, enabled: newEnabled } : l
      );
    });

    updateMutation.mutate(
      { id: loc.id, data: { enabled: newEnabled } },
      {
        onSuccess: (updatedLocation) => {
          // Обновляем кэш данными с сервера
          if (updatedLocation) {
            queryClient.setQueryData(['locations', universeId], (old: Location[] | undefined) => {
              if (!old) return old;
              return old.map(l =>
                l.id === loc.id ? updatedLocation : l
              );
            });
          }
          toast.success(newEnabled ? 'Локация включена в контекст ИИ' : 'Локация выключена из контекста ИИ');
        },
        onError: (error: any) => {
          // Откатываем оптимистичное обновление при ошибке
          queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
          toast.error('Ошибка обновения: ' + (error?.message || 'Не удалось обновить'));
        },
      }
    );
  };

  const displayedLocations = React.useMemo(() => {
    if (showDisabled) {
      return locations;
    }
    return locations.filter((l: Location) => l.enabled === true);
  }, [locations, showDisabled]);

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <div className="h-8 w-40 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-44 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
            <div className="h-10 w-32 bg-dark-200 dark:bg-dark-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-dark-200 dark:border-dark-600 overflow-hidden animate-pulse">
              <div className="w-full aspect-video bg-dark-200 dark:bg-dark-600" />
              <div className="p-3">
                <div className="h-5 bg-dark-200 dark:bg-dark-600 rounded w-2/3 mb-2" />
                <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-full mb-1" />
                <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-dark-800">Локации</h2>
          <label className="inline-flex items-center gap-2 mt-2 text-sm text-dark-600 cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-dark-300" />
            Показать отключённые
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateOneLocationWithImage}
            className="btn btn-primary flex items-center gap-2"
            title="Одна локация по контексту вселенной с описанием и картинкой"
          >
            <Sparkles size={18} />
            Локация по контексту
          </button>
          <AIGenerateButton
            onGenerate={handleGenerateLocations}
            onResult={() => {}}
            tooltip="Сгенерировать локации"
            variant="primary"
          />
          <button onClick={() => openEdit(null)} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            Добавить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedLocations.map((loc: Location) => {
          const imageUrl = loc.image_path ? uploadsUrl(loc.image_path) : null;
          return (
            <div 
              key={loc.id} 
              role="button"
              tabIndex={0}
              onClick={() => openEdit(loc)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(loc); } }}
              className={`card overflow-hidden p-0 flex flex-col cursor-pointer hover:shadow-md transition-shadow ${loc.enabled === false ? 'opacity-50 grayscale' : ''}`}
              style={loc.enabled === false ? { borderColor: '#f59e0b', borderWidth: '1px', borderStyle: 'solid' } : {}}
            >
              <div className="w-full aspect-video shrink-0 overflow-hidden bg-dark-100 dark:bg-dark-700">
                {imageUrl ? (
                  <img
                    src={`${imageUrl}?t=${loc.updated_at ? new Date(loc.updated_at).getTime() : ''}`}
                    alt={loc.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-dark-100 dark:bg-dark-700 border border-dashed border-dark-300 dark:border-dark-600 rounded-none" aria-hidden />
                )}
              </div>
              <div className="p-3 flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-dark-800 dark:text-dark-200 truncate">{loc.name}</h3>
                    {loc.location_type && (
                      <span className="text-xs text-accent">{loc.location_type}</span>
                    )}
                    {loc.enabled === false && <span className="block text-xs text-amber-600">Выключена</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleEnabled(loc); }} className="p-1 hover:bg-dark-100 dark:hover:bg-dark-600 rounded" title={loc.enabled !== false ? 'Выключить из контекста ИИ' : 'Включить в контекст ИИ'}>
                      {loc.enabled !== false ? <Eye size={16} className="text-dark-500" /> : <EyeOff size={16} className="text-amber-600" />}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleAnalyze(loc); }} className="p-1 hover:bg-accent-subtle rounded" title="AI анализ">
                      <Brain size={16} className="text-accent" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(loc); }} className="p-1 hover:bg-dark-100 dark:hover:bg-dark-600 rounded">
                      <Edit2 size={16} className="text-dark-500" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm('Удалить локацию?')) deleteMutation.mutate(loc.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>
                {loc.description && (
                  <p className="text-sm text-dark-500 dark:text-dark-400 line-clamp-3 mt-1">{loc.description}</p>
                )}
                {coverageStats?.by_entity?.location?.find((e: { id: number }) => e.id === loc.id)?.chapter_ids?.length > 0 && (
                  <div className="mt-1 text-xs text-dark-500">
                    <Link to={`/universes/${universeId}/coverage`} onClick={(e) => e.stopPropagation()} className="hover:text-primary-600">
                      В главах: {coverageStats.by_entity.location.find((e: { id: number }) => e.id === loc.id).chapter_ids.length}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Плейсхолдер: новая локация — генерация по контексту или добавление вручную */}
        <div className="card border-2 border-dashed border-dark-300 hover:border-primary-400 transition-colors flex flex-col items-center justify-center min-h-[200px] p-6 group">
          <div className="w-24 h-24 rounded-lg bg-dark-100 border-2 border-dashed border-dark-300 flex items-center justify-center mb-4 group-hover:border-primary-400 transition-colors">
            <MapPin size={48} className="text-dark-300 group-hover:text-primary-400 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-dark-600 mb-4">Новая локация</h3>
          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={handleGenerateOneLocationWithImage}
              className="btn btn-secondary flex items-center justify-center gap-2 w-full text-sm"
            >
              <Sparkles size={18} />
              Сгенерировать
            </button>
            <button
              type="button"
              onClick={() => openEdit(null)}
              className="btn btn-primary flex items-center justify-center gap-2 w-full text-sm"
            >
              <Plus size={18} />
              Добавить вручную
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-bold mb-4">
              {editingLocation ? 'Редактировать локацию' : 'Новая локация'}
            </h2>
            {editingLocation?.id && (
              <div className="mb-4">
                <button type="button" onClick={handleAutofillLocation} disabled={autofillLoading} className="btn btn-secondary text-sm">
                  {autofillLoading ? 'Загрузка...' : 'Заполнить по контексту'}
                </button>
              </div>
            )}
            {editingLocation?.id && (
              <div className="mb-4">
                <div className="relative w-full rounded-xl overflow-hidden bg-dark-100 dark:bg-dark-700 border-2 border-dashed border-dark-200 dark:border-dark-600 group">
                  <div className="w-full aspect-video flex items-center justify-center">
                    {editingLocation.image_path ? (
                      <img
                        src={uploadsUrl(editingLocation.image_path) + `?t=${editingLocation.updated_at ? new Date(editingLocation.updated_at).getTime() : ''}`}
                        alt={editingLocation.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full" aria-hidden />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleGenerateLocationImage(editingLocation)}
                      className="p-2.5 bg-white dark:bg-dark-200 text-accent rounded-full hover:bg-accent-subtle transition-colors shadow-lg"
                      title="Сгенерировать ИИ"
                    >
                      <Sparkles size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => locationImageInputRef.current?.click()}
                      className="p-2.5 bg-white dark:bg-dark-200 text-dark-800 dark:text-dark-200 rounded-full hover:bg-accent-subtle hover:text-accent transition-colors shadow-lg"
                      title="Загрузить"
                    >
                      <Upload size={20} />
                    </button>
                    {editingLocation.image_path && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLocationImage(editingLocation)}
                        className="p-2.5 bg-white dark:bg-dark-200 text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-lg"
                        title="Удалить"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={locationImageInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && editingLocation) handleUploadLocationImage(editingLocation, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Название *</label>
                  <input name="name" type="text" required value={formState.name} onChange={(e) => setFormState(s => ({ ...s, name: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Тип</label>
                  <input name="location_type" type="text" value={formState.location_type} onChange={(e) => setFormState(s => ({ ...s, location_type: e.target.value }))} className="input" placeholder="Город, здание, регион..." />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">Описание</label>
                <textarea name="description" rows={3} value={formState.description} onChange={(e) => setFormState(s => ({ ...s, description: e.target.value }))} className="input" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 mb-1">Дополнительные детали</label>
                <textarea name="details" rows={3} value={formState.details} onChange={(e) => setFormState(s => ({ ...s, details: e.target.value }))} className="input" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowModal(false); setEditingLocation(null); }} className="btn btn-secondary">
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending 
                    ? 'Сохранение...' 
                    : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Critic Panel */}
      {(isAnalyzing || aiAnalysis) && (
        <AICriticPanel
          analysis={aiAnalysis}
          isLoading={isAnalyzing}
          universeId={parseInt(universeId!)}
          onClose={() => setAiAnalysis(null)}
        />
      )}

      {/* AI Generation Modal */}
      {showGenerated && (
        <AIGenerationModal
          results={generatedLocations}
          onClose={() => setShowGenerated(false)}
          title="Сгенерированные локации"
          multiSelect
          onAddSelected={handleAddSelectedLocations}
          renderItem={(item) => {
            const loc = item as GeneratedLocation;
            return (
            <div className="card border-2 border-purple-200 hover:border-purple-400 transition-colors">
              <h3 className="font-bold text-lg text-dark-800 mb-2">{loc.name}</h3>
              <div className="text-sm text-dark-600 space-y-1">
                <p><strong>Тип:</strong> {loc.type || loc.location_type}</p>
                {loc.description && <p><strong>Описание:</strong> {loc.description}</p>}
                {loc.secret && <p><strong>Особенность:</strong> {loc.secret}</p>}
              </div>
              <div className="mt-3 text-center text-purple-600 text-sm font-medium">
                Отметьте галочками и нажмите «Добавить выбранных»
              </div>
            </div>
            );
          }}
        />
      )}
    </div>
  );
}
