import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Loader2, Maximize2, Grid, Columns, Sparkles, Wand2, Pencil, ImagePlus, Image } from 'lucide-react';
import { conceptArtApi, uploadsUrl } from '../api';
import EmptyState from '../components/EmptyState';

export default function ConceptArtPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedArt, setSelectedArt] = useState<any>(null);
  const [isEditingSelectedArt, setIsEditingSelectedArt] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'other', tags: '' });
  const [viewMode, setViewMode] = useState<'masonry' | 'grid'>('masonry');
  const [generateData, setGenerateData] = useState({ title: '', description: '', category: 'other', tags: '', aspect_ratio: 'landscape' as const });

  const { data: arts = [], isLoading } = useQuery({
    queryKey: ['concept-art', universeId],
    queryFn: () => conceptArtApi.getAll(parseInt(universeId!)),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState({ title: '', description: '', category: 'other', tags: '' });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => conceptArtApi.create(parseInt(universeId!), formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      setShowUpload(false);
      setUploadData({ title: '', description: '', category: 'other', tags: '' });
      toast.success('Арт добавлен');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => conceptArtApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      toast.success('Арт удален');
    }
  });

  const generateMutation = useMutation({
    mutationFn: (body: { title: string; description: string; category?: string; tags?: string }) =>
      conceptArtApi.generate(parseInt(universeId!), body as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      setShowGenerate(false);
      setGenerateData({ title: '', description: '', category: 'other', tags: '', aspect_ratio: 'landscape' });
      toast.success('Концепт-арт сгенерирован');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Ошибка генерации');
    }
  });

  const generateAutoMutation = useMutation({
    mutationFn: (body?: { aspect_ratio?: string }) => conceptArtApi.generateAuto(parseInt(universeId!), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      setShowGenerate(false);
      toast.success('Концепт-арт сгенерирован автоматически');
    },
    onError: (err: any) => {
      const d = err?.response?.data?.detail;
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x?.msg ?? x).join('; ') : (d && typeof d === 'object' ? JSON.stringify(d) : null) || 'Ошибка авто-генерации';
      toast.error(msg);
    }
  });

  const updateArtMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; description?: string; category?: string; tags?: string } }) =>
      conceptArtApi.update(parseInt(universeId!), id, data),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      setSelectedArt(updated);
      setIsEditingSelectedArt(false);
      toast.success('Изменения сохранены');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения');
    }
  });

  const replaceImageMutation = useMutation({
    mutationFn: ({ artId, file }: { artId: number; file: File }) =>
      conceptArtApi.replaceImage(parseInt(universeId!), artId, file),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ['concept-art', universeId] });
      setSelectedArt(updated);
      toast.success('Картинка заменена');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Ошибка замены изображения');
    }
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Выберите файл');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    formData.append('category', uploadData.category);
    formData.append('tags', uploadData.tags);
    createMutation.mutate(formData);
  };

  if (isLoading) return <div className="p-8 text-center text-dark-500">Загрузка...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark-800">Концепт-арт</h1>
          <p className="text-dark-500">Визуализация вашей вселенной</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-dark-100 p-1 rounded-lg flex mr-4">
            <button
              onClick={() => setViewMode('masonry')}
              className={`p-2 rounded-md transition-all ${viewMode === 'masonry' ? 'bg-white shadow-sm text-primary-600' : 'text-dark-500'}`}
              title="Masonry View"
            >
              <Columns size={20} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-dark-500'}`}
              title="Grid View"
            >
              <Grid size={20} />
            </button>
          </div>
          <button onClick={() => setShowGenerate(true)} className="btn btn-secondary flex items-center gap-2">
            <Sparkles size={20} /> Сгенерировать по описанию
          </button>
          <button onClick={() => setShowUpload(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} /> Добавить арт
          </button>
        </div>
      </div>

      {arts.length === 0 ? (
        <EmptyState
          icon={Image}
          title="Нет концепт-артов"
          description="Сгенерируйте с помощью ИИ или загрузите первые изображения для вашей вселенной."
          actionLabel="Сгенерировать арт"
          onAction={() => setShowGenerate(true)}
        />
      ) : (
        <div className={viewMode === 'masonry'
          ? "columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        }>
          {arts.map((art: any) => (
            <div
              key={art.id}
              className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 break-inside-avoid ${viewMode === 'grid' ? 'aspect-square' : ''}`}
            >
              <img
                src={uploadsUrl(art.image_path) || ''}
                alt={art.title}
                className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${viewMode === 'grid' ? 'h-full' : 'h-auto'}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <div className="flex justify-between items-center text-white">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{art.title}</h3>
                    {art.category && <span className="text-xs text-white/70 uppercase tracking-widest">{art.category}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedArt(art)}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-colors"
                    >
                      <Maximize2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(art.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full backdrop-blur-md transition-colors text-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-zoomIn">
            <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
              <h2 className="text-xl font-bold text-dark-800">Добавить концепт-арт</h2>
              <button onClick={() => setShowUpload(false)} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-dark-600 mb-1">ФАЙЛ *</label>
                <input ref={fileInputRef} type="file" accept="image/*" required className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-bold text-dark-600 mb-1">НАЗВАНИЕ *</label>
                <input
                  value={uploadData.title}
                  onChange={e => setUploadData({...uploadData, title: e.target.value})}
                  required
                  className="input w-full"
                  placeholder="Название арта"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-dark-600 mb-1">ОПИСАНИЕ</label>
                <textarea
                  value={uploadData.description}
                  onChange={e => setUploadData({...uploadData, description: e.target.value})}
                  className="input w-full"
                  rows={3}
                  placeholder="О чем этот арт?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-1">КАТЕГОРИЯ</label>
                  <select
                    value={uploadData.category}
                    onChange={e => setUploadData({...uploadData, category: e.target.value})}
                    className="input w-full"
                  >
                    <option value="other">Прочее</option>
                    <option value="character">Персонаж</option>
                    <option value="location">Локация</option>
                    <option value="item">Предмет</option>
                    <option value="creature">Существо</option>
                    <option value="architecture">Архитектура</option>
                    <option value="mood">Настроение</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-1">ТЕГИ</label>
                  <input
                    value={uploadData.tags}
                    onChange={e => setUploadData({...uploadData, tags: e.target.value})}
                    className="input w-full"
                    placeholder="тег1, тег2..."
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="btn btn-secondary">Отмена</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary px-8">
                  {createMutation.isPending ? <Loader2 className="animate-spin" size={20}/> : 'Загрузить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate by description Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-zoomIn">
            <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
              <h2 className="text-xl font-bold text-dark-800">Сгенерировать концепт-арт</h2>
              <button onClick={() => setShowGenerate(false)} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Полностью автоматическая генерация */}
              <div className="rounded-xl border-2 border-primary-200 bg-primary-50/50 p-4">
                <h3 className="font-semibold text-dark-800 mb-1 flex items-center gap-2">
                  <Wand2 size={20} className="text-primary-600" />
                  Полностью автоматически
                </h3>
                <p className="text-sm text-dark-600 mb-4">
                  ИИ придумает идею по контексту вселенной (персонажи, локации, мир) и сгенерирует картинку — например сцена с героем, технология, случайный момент.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-sm font-medium text-dark-600">Соотношение сторон:</span>
                  <select
                    value={generateData.aspect_ratio}
                    onChange={e => setGenerateData({ ...generateData, aspect_ratio: e.target.value as 'landscape' | 'portrait' | 'square' })}
                    className="input w-auto"
                  >
                    <option value="landscape">Горизонтальная</option>
                    <option value="square">Квадратная</option>
                    <option value="portrait">Вертикальная</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => generateAutoMutation.mutate({ aspect_ratio: generateData.aspect_ratio })}
                  disabled={generateAutoMutation.isPending || generateMutation.isPending}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {generateAutoMutation.isPending ? (
                    <><Loader2 className="animate-spin" size={20} /> Генерируем идею и изображение...</>
                  ) : (
                    <><Wand2 size={18} /> Сгенерировать автоматически</>
                  )}
                </button>
              </div>

              <div className="border-t border-dark-200 pt-4">
                <p className="text-sm font-medium text-dark-500 mb-4">Или введите описание вручную</p>
              </div>
            </div>
            <form
              className="px-6 pb-6 pt-0 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!generateData.description.trim()) {
                  toast.error('Введите описание');
                  return;
                }
                generateMutation.mutate({
                  title: generateData.title.trim() || 'Концепт-арт',
                  description: generateData.description.trim(),
                  category: generateData.category,
                  tags: generateData.tags,
                  aspect_ratio: generateData.aspect_ratio,
                });
              }}
            >
              <div>
                <label className="block text-sm font-bold text-dark-600 mb-1">ОПИСАНИЕ / ПРОМПТ *</label>
                <textarea
                  value={generateData.description}
                  onChange={e => setGenerateData({ ...generateData, description: e.target.value })}
                  required
                  className="input w-full"
                  rows={4}
                  placeholder="Например: рыцарь в доспехах на закате, фэнтези, детальная проработка..."
                />
                <p className="text-xs text-dark-400 mt-1">Опишите сцену, персонажа или локацию — ИИ сгенерирует изображение</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-dark-600 mb-1">НАЗВАНИЕ</label>
                <input
                  value={generateData.title}
                  onChange={e => setGenerateData({ ...generateData, title: e.target.value })}
                  className="input w-full"
                  placeholder="Название арта"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-1">СООТНОШЕНИЕ СТОРОН</label>
                  <select
                    value={generateData.aspect_ratio}
                    onChange={e => setGenerateData({ ...generateData, aspect_ratio: e.target.value as 'landscape' | 'portrait' | 'square' })}
                    className="input w-full"
                  >
                    <option value="landscape">Горизонтальная</option>
                    <option value="square">Квадратная</option>
                    <option value="portrait">Вертикальная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-dark-600 mb-1">КАТЕГОРИЯ</label>
                  <select
                    value={generateData.category}
                    onChange={e => setGenerateData({ ...generateData, category: e.target.value })}
                    className="input w-full"
                  >
                    <option value="other">Прочее</option>
                    <option value="character">Персонаж</option>
                    <option value="location">Локация</option>
                    <option value="item">Предмет</option>
                    <option value="creature">Существо</option>
                    <option value="architecture">Архитектура</option>
                    <option value="mood">Настроение</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-dark-600 mb-1">ТЕГИ</label>
                  <input
                    value={generateData.tags}
                    onChange={e => setGenerateData({ ...generateData, tags: e.target.value })}
                    className="input w-full"
                    placeholder="тег1, тег2..."
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowGenerate(false)} className="btn btn-secondary">Отмена</button>
                <button type="submit" disabled={generateMutation.isPending} className="btn btn-primary px-8">
                  {generateMutation.isPending ? <Loader2 className="animate-spin" size={20}/> : <><Sparkles size={18} className="mr-1 inline"/> Сгенерировать</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {selectedArt && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-4 animate-fadeIn overflow-y-auto"
          onClick={() => { setSelectedArt(null); setIsEditingSelectedArt(false); }}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-10" onClick={() => { setSelectedArt(null); setIsEditingSelectedArt(false); }}>
            <X size={32} />
          </button>
          <input
            ref={replaceImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && selectedArt) {
                replaceImageMutation.mutate({ artId: selectedArt.id, file });
                e.target.value = '';
              }
            }}
          />
          <img
            src={uploadsUrl(selectedArt.image_path) || ''}
            alt={selectedArt.title}
            className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <div className="mt-3 flex justify-center" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => replaceImageInputRef.current?.click()}
              disabled={replaceImageMutation.isPending}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              {replaceImageMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />}
              Заменить картинку
            </button>
          </div>
          <div className="mt-6 w-full max-w-2xl px-4" onClick={e => e.stopPropagation()}>
            {isEditingSelectedArt ? (
              <div className="bg-dark-800/80 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Редактировать описание</h3>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Название</label>
                  <input
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className="input w-full bg-dark-700 border-dark-600 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Описание</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="input w-full bg-dark-700 border-dark-600 text-white min-h-[100px]"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Категория</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                      className="input w-full bg-dark-700 border-dark-600 text-white"
                    >
                      <option value="other">Прочее</option>
                      <option value="character">Персонаж</option>
                      <option value="location">Локация</option>
                      <option value="item">Предмет</option>
                      <option value="creature">Существо</option>
                      <option value="architecture">Архитектура</option>
                      <option value="mood">Настроение</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Теги</label>
                    <input
                      value={editForm.tags}
                      onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                      className="input w-full bg-dark-700 border-dark-600 text-white"
                      placeholder="тег1, тег2..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingSelectedArt(false)}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => updateArtMutation.mutate({ id: selectedArt.id, data: editForm })}
                    disabled={updateArtMutation.isPending}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {updateArtMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Pencil size={18} />}
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <h2 className="text-2xl font-bold text-white text-center">{selectedArt.title}</h2>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditForm({
                        title: selectedArt.title || '',
                        description: selectedArt.description || '',
                        category: selectedArt.category || 'other',
                        tags: selectedArt.tags || '',
                      });
                      setIsEditingSelectedArt(true);
                    }}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    title="Редактировать описание"
                  >
                    <Pencil size={20} />
                  </button>
                </div>
                <p className="text-white/60 text-center mt-2 whitespace-pre-wrap">{selectedArt.description || '—'}</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {selectedArt.category && <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80 uppercase">{selectedArt.category}</span>}
                  {selectedArt.tags?.split(',').map((tag: string) => tag.trim() && (
                    <span key={tag} className="px-3 py-1 bg-primary-500/20 rounded-full text-xs text-primary-200">#{tag.trim()}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
