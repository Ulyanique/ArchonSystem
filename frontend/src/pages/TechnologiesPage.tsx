import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Cpu, Box, Loader2, X, FlaskConical } from 'lucide-react';
import { techApi } from '../api';

export default function TechnologiesPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'tech' | 'artifacts'>('tech');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const deleteTechMutation = useMutation({
    mutationFn: (id: number) => techApi.deleteTech(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['techs', universeId] });
      toast.success('Технология удалена');
    },
    onError: () => {
      toast.error('Ошибка при удалении технологии');
    }
  });

  const deleteArtifactMutation = useMutation({
    mutationFn: (id: number) => techApi.deleteArtifact(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', universeId] });
      toast.success('Артефакт удален');
    },
    onError: () => {
      toast.error('Ошибка при удалении артефакта');
    }
  });

  const { data: techs = [], isLoading: loadingTechs } = useQuery({
    queryKey: ['techs', universeId],
    queryFn: () => techApi.getTechs(parseInt(universeId!)),
  });

  const { data: artifacts = [], isLoading: loadingArtifacts } = useQuery({
    queryKey: ['artifacts', universeId],
    queryFn: () => techApi.getArtifacts(parseInt(universeId!)),
  });

  if (loadingTechs || loadingArtifacts) return <div className="p-8 text-center">Загрузка...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark-800 flex items-center gap-2">
            <Cpu className="text-primary-600" /> Технологии и Артефакты
          </h1>
          <p className="text-dark-500">Научные достижения и уникальные предметы вашей вселенной</p>
        </div>
        <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> {activeTab === 'tech' ? 'Добавить технологию' : 'Добавить артефакт'}
        </button>
      </div>

      <div className="flex gap-4 mb-8 bg-dark-50 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('tech')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'tech' ? 'bg-white shadow-sm text-primary-600' : 'text-dark-500 hover:bg-dark-100'}`}
          >
              Технологии ({techs.length})
          </button>
          <button
            onClick={() => setActiveTab('artifacts')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'artifacts' ? 'bg-white shadow-sm text-primary-600' : 'text-dark-500 hover:bg-dark-100'}`}
          >
              Артефакты ({artifacts.length})
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(activeTab === 'tech' ? techs : artifacts).map((item: any) => (
          <div key={item.id} className="card bg-white border border-dark-100 hover:shadow-xl transition-all p-6 group">
             <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary-50 rounded-2xl text-primary-600">
                {activeTab === 'tech' ? <FlaskConical size={24} /> : <Box size={24} />}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingItem(item); setShowForm(true); }} className="p-2 hover:bg-dark-50 rounded-lg text-dark-400 hover:text-primary-600">
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Удалить?')) {
                      activeTab === 'tech'
                        ? deleteTechMutation.mutate(item.id)
                        : deleteArtifactMutation.mutate(item.id);
                    }
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg text-dark-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-dark-800 mb-2">{item.name}</h3>
            {activeTab === 'tech' ? (
                <span className="inline-block px-3 py-1 bg-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-4">
                    LVL: {item.tech_level || 'Unknown'}
                </span>
            ) : (
                <span className="inline-block px-3 py-1 bg-amber-100 rounded-full text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-4">
                    {item.artifact_type || 'Relic'}
                </span>
            )}

            <p className="text-dark-600 text-sm line-clamp-3 mb-6 leading-relaxed">
              {item.description || 'Нет описания.'}
            </p>

            {activeTab === 'tech' ? (
                <div className="space-y-2 text-sm text-dark-500 italic">
                    <p><strong>Принципы:</strong> {item.principles || '—'}</p>
                </div>
            ) : (
                <div className="space-y-2 text-sm text-dark-500 italic">
                    <p><strong>Способности:</strong> {item.abilities || '—'}</p>
                </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
          <TechForm
            type={activeTab}
            item={editingItem}
            onClose={() => setShowForm(false)}
            uId={parseInt(universeId!)}
          />
      )}
    </div>
  );
}

function TechForm({ type, item, onClose, uId }: any) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState(item || (type === 'tech' ? {
        name: '',
        description: '',
        tech_level: '',
        principles: '',
        application: ''
    } : {
        name: '',
        description: '',
        artifact_type: '',
        origin: '',
        abilities: '',
        location_hint: ''
    }));

    const mutation = useMutation({
        mutationFn: (data: any) => {
            if (type === 'tech') {
                return item ? techApi.updateTech(uId, item.id, data) : techApi.createTech(uId, data);
            } else {
                return item ? techApi.updateArtifact(uId, item.id, data) : techApi.createArtifact(uId, data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [type === 'tech' ? 'techs' : 'artifacts', uId] });
            toast.success('Сохранено');
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-zoomIn">
                <div className="p-6 border-b border-dark-100 flex justify-between items-center bg-dark-50">
                    <h2 className="text-xl font-bold text-dark-800">{item ? 'Редактировать' : 'Добавить'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-200 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Название *</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="input w-full" />
                    </div>
                    {type === 'tech' ? (
                        <div>
                            <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Уровень технологий</label>
                            <input value={formData.tech_level} onChange={e => setFormData({...formData, tech_level: e.target.value})} className="input w-full" placeholder="Продвинутый, стимпанк..." />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Тип артефакта</label>
                            <input value={formData.artifact_type} onChange={e => setFormData({...formData, artifact_type: e.target.value})} className="input w-full" placeholder="Магический, древний..." />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Описание</label>
                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input w-full" rows={3} />
                    </div>
                    {type === 'tech' ? (
                        <div>
                            <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Принципы работы</label>
                            <textarea value={formData.principles} onChange={e => setFormData({...formData, principles: e.target.value})} className="input w-full" rows={2} />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-dark-500 uppercase mb-1">Способности</label>
                            <textarea value={formData.abilities} onChange={e => setFormData({...formData, abilities: e.target.value})} className="input w-full" rows={2} />
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4">
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
