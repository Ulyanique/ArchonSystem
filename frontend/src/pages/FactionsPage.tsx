import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Shield, Target, Flag, User, MapPin, Loader2, X, Sparkles } from 'lucide-react';
import { factionApi, aiGeneratorApi, universesApi } from '../api';
import EmptyState from '../components/EmptyState';

export default function FactionsPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingFaction, setEditingFaction] = useState<any>(null);
  const [generatedFactions, setGeneratedFactions] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  const { data: universe } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const { data: factions = [], isLoading } = useQuery({
    queryKey: ['factions', universeId],
    queryFn: () => factionApi.getAll(parseInt(universeId!)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => factionApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factions', universeId] });
      toast.success('Фракция удалена');
    }
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark-800 flex items-center gap-2">
            <Shield className="text-primary-600" /> Фракции и Организации
          </h1>
          <p className="text-dark-500">Политические силы и объединения вашей вселенной</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!universeId) return;
              setIsGeneratingSingle(true);
              try {
                const faction = await aiGeneratorApi.singleFaction(parseInt(universeId));
                setEditingFaction(faction);
                setShowForm(true);
                toast.success('Фракция сгенерирована');
              } catch (error: any) {
                toast.error('Ошибка генерации: ' + (error.response?.data?.detail || error.message));
              } finally {
                setIsGeneratingSingle(false);
              }
            }}
            disabled={isGeneratingSingle || isGenerating}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={20} />
            {isGeneratingSingle ? 'Генерация...' : 'Сгенерировать фракцию'}
          </button>
          <button
            onClick={async () => {
              if (!universeId) return;
              setIsGenerating(true);
              try {
                const factions = await aiGeneratorApi.factions(parseInt(universeId), universe?.genre, 5);
                setGeneratedFactions(factions);
              } catch (error: any) {
                toast.error('Ошибка генерации: ' + (error.response?.data?.detail || error.message));
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating || isGeneratingSingle}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={20} />
            {isGenerating ? 'Генерация...' : 'Сгенерировать фракции'}
          </button>
          <button onClick={() => { setEditingFaction(null); setShowForm(true); }} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} /> Добавить фракцию
          </button>
        </div>
      </div>

      {/* Сгенерированные фракции */}
      {factions.length === 0 && !generatedFactions && !showForm ? (
        <EmptyState
          icon={Flag}
          title="Нет фракций"
          description="Добавьте первую организацию, группировку или государство вашей вселенной."
          actionLabel="Добавить фракцию"
          onAction={() => { setEditingFaction(null); setShowForm(true); }}
        />
      ) : (
      <>
      {generatedFactions && generatedFactions.length > 0 && (
        <div className="card p-4 mb-6 border-2 border-primary-200">
          <h3 className="font-bold text-dark-800 mb-2">Сгенерированные фракции — применить?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 max-h-96 overflow-y-auto">
            {generatedFactions.map((faction, i) => (
              <div key={i} className="p-3 bg-dark-50 rounded border border-dark-200">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-dark-800">{faction.name}</h4>
                    <span className="text-xs text-dark-500">{faction.faction_type}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingFaction(faction);
                      setShowForm(true);
                      setGeneratedFactions(null);
                    }}
                    className="btn btn-secondary text-xs p-1"
                  >
                    Применить
                  </button>
                </div>
                {faction.description && (
                  <p className="text-sm text-dark-600 mb-2 line-clamp-2">{faction.description}</p>
                )}
                {faction.ideology && (
                  <p className="text-xs text-dark-500 mb-1"><strong>Идеология:</strong> {faction.ideology}</p>
                )}
                {faction.goals && (
                  <p className="text-xs text-dark-500 mb-1"><strong>Цели:</strong> {faction.goals}</p>
                )}
                {faction.leader_name && (
                  <p className="text-xs text-dark-500"><strong>Лидер:</strong> {faction.leader_name}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!universeId || !generatedFactions) return;
                try {
                  for (const faction of generatedFactions) {
                    await factionApi.create(parseInt(universeId), faction);
                  }
                  queryClient.invalidateQueries({ queryKey: ['factions', universeId] });
                  setGeneratedFactions(null);
                  toast.success(`Добавлено ${generatedFactions.length} фракций`);
                } catch (error: any) {
                  toast.error('Ошибка добавления: ' + (error.response?.data?.detail || error.message));
                }
              }}
              className="btn btn-primary"
            >
              Применить все фракции
            </button>
            <button
              onClick={() => setGeneratedFactions(null)}
              className="btn btn-secondary"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {factions.map((faction: any) => (
          <div key={faction.id} className="card bg-white border border-dark-100 hover:shadow-xl transition-all p-6 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary-50 rounded-2xl text-primary-600">
                <Flag size={24} />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingFaction(faction); setShowForm(true); }} className="p-2 hover:bg-dark-50 rounded-lg text-dark-400 hover:text-primary-600">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => confirm('Удалить?') && deleteMutation.mutate(faction.id)} className="p-2 hover:bg-red-50 rounded-lg text-dark-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-dark-800 mb-2">{faction.name}</h3>
            <span className="inline-block px-3 py-1 bg-dark-100 rounded-full text-xs font-bold text-dark-600 uppercase tracking-wider mb-4">
              {faction.faction_type || 'Тип не указан'}
            </span>

            <p className="text-dark-600 text-sm line-clamp-3 mb-6 leading-relaxed">
              {faction.description || 'Описания пока нет.'}
            </p>

            <div className="space-y-3 pt-4 border-t border-dark-50">
              <div className="flex items-center gap-3 text-sm">
                <User size={14} className="text-dark-400" />
                <span className="text-dark-500">Лидер:</span>
                <span className="text-dark-800 font-medium">{faction.leader_name || 'Неизвестен'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={14} className="text-dark-400" />
                <span className="text-dark-500">Штаб-квартира:</span>
                <span className="text-dark-800 font-medium">{faction.headquarters || 'Скрыта'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Target size={14} className="text-dark-400" />
                <span className="text-dark-500">Влияние:</span>
                <div className="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500" style={{ width: `${(faction.influence_level || 5) * 10}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {showForm && (
          <FactionForm
            faction={editingFaction}
            onClose={() => setShowForm(false)}
            uId={parseInt(universeId!)}
          />
      )}
    </div>
  );
}

function FactionForm({ faction, onClose, uId }: any) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState(faction || {
        name: '',
        description: '',
        faction_type: '',
        ideology: '',
        goals: '',
        headquarters: '',
        leader_name: '',
        influence_level: 5
    });

    const mutation = useMutation({
        mutationFn: (data: any) => faction ? factionApi.update(uId, faction.id, data) : factionApi.create(uId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factions', uId] });
            toast.success(faction ? 'Обновлено' : 'Создано');
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-zoomIn">
                <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
                    <h2 className="text-xl font-bold text-dark-800">{faction ? 'Редактировать фракцию' : 'Новая фракция'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Название *</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="input w-full" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Тип</label>
                        <input value={formData.faction_type} onChange={e => setFormData({...formData, faction_type: e.target.value})} className="input w-full" placeholder="Военная, Политическая..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Влияние (1-10)</label>
                        <input type="number" min="1" max="10" value={formData.influence_level} onChange={e => setFormData({...formData, influence_level: parseInt(e.target.value)})} className="input w-full" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Описание</label>
                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input w-full" rows={3} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Идеология</label>
                        <textarea value={formData.ideology} onChange={e => setFormData({...formData, ideology: e.target.value})} className="input w-full" rows={2} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Цели</label>
                        <textarea value={formData.goals} onChange={e => setFormData({...formData, goals: e.target.value})} className="input w-full" rows={2} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Лидер</label>
                        <input value={formData.leader_name} onChange={e => setFormData({...formData, leader_name: e.target.value})} className="input w-full" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Штаб-квартира</label>
                        <input value={formData.headquarters} onChange={e => setFormData({...formData, headquarters: e.target.value})} className="input w-full" />
                    </div>
                    <div className="col-span-2 flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Отмена</button>
                        <button type="submit" disabled={mutation.isPending} className="btn btn-primary px-8">
                            {mutation.isPending ? <Loader2 className="animate-spin" size={20}/> : 'Сохранить'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
