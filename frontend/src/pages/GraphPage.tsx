import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linksApi } from '../api';
import KnowledgeGraph from '../components/KnowledgeGraph';
import { Network, Plus, Trash2, Link as LinkIcon, Lightbulb, Globe } from 'lucide-react';
import { Link, GraphNode, LinkSuggestion, LinkCreate, ReactFlowNode } from '../types';
import type { GraphViewType } from '../components/KnowledgeGraph';

export default function GraphPage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [graphView, setGraphView] = useState<GraphViewType>('knowledge');

  const { data: graphDataKnowledge, isLoading: loadingKnowledge } = useQuery({
    queryKey: ['graph', universeId],
    queryFn: () => linksApi.getGraph(parseInt(universeId!)),
    enabled: !!universeId && graphView === 'knowledge',
  });

  const { data: graphDataSpace, isLoading: loadingSpace } = useQuery({
    queryKey: ['graph-space', universeId],
    queryFn: () => linksApi.getGraphSpace(parseInt(universeId!)),
    enabled: !!universeId && graphView === 'space',
  });

  const graphData = graphView === 'space' ? graphDataSpace : graphDataKnowledge;
  const isLoading = graphView === 'space' ? loadingSpace : loadingKnowledge;

  const { data: links = [] } = useQuery({
    queryKey: ['links', universeId],
    queryFn: () => linksApi.getAll(parseInt(universeId!)),
    enabled: !!universeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => linksApi.delete(parseInt(universeId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', universeId] });
      queryClient.invalidateQueries({ queryKey: ['graph', universeId] });
    },
  });

  const handleNodeClick = (node: ReactFlowNode) => {
    const [type, id] = node.id.split('_');
    // Безопасный доступ к label: пытаемся извлечь из React элемента или используем id как fallback
    let label: string = node.id;
    try {
      const labelElement = node.data?.label;
      if (labelElement?.props?.children) {
        const children = Array.isArray(labelElement.props.children) 
          ? labelElement.props.children 
          : [labelElement.props.children];
        const textElement = children[1]?.props?.children;
        if (textElement) {
          label = typeof textElement === 'string' ? textElement : textElement.toString();
        }
      }
    } catch (e) {
      // Если не удалось извлечь label, используем id
      label = node.id;
    }
    setSelectedNode({ id: node.id, label, type, universe_id: parseInt(universeId!) });
    
    // Загружаем предложения
    linksApi.getSuggestions(parseInt(universeId!), type, parseInt(id))
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  };

  const handleAddSuggestion = (suggestion: LinkSuggestion) => {
    if (!selectedNode) return;
    
    const linkData: LinkCreate = {
      source_type: selectedNode.type,
      source_id: parseInt(selectedNode.id.split('_')[1]),
      target_type: suggestion.target_type,
      target_id: suggestion.target_id,
      link_type: suggestion.link_type,
      description: suggestion.description,
    };
    
    linksApi.create(parseInt(universeId!), linkData).then(() => {
      queryClient.invalidateQueries({ queryKey: ['links', universeId] });
      queryClient.invalidateQueries({ queryKey: ['graph', universeId] });
      setSuggestions([]);
    });
  };

  if (isLoading) {
    return <div className="text-center py-12">Загрузка графа...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
            <Network size={24} />
            Граф
          </h2>
          <p className="text-sm text-dark-500 mt-1">
            {graphView === 'space'
              ? 'Пространство: Вселенная → Галактики → Системы → Небесные тела → Локации'
              : 'Визуализация связей между элементами вселенной'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-dark-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setGraphView('knowledge')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${graphView === 'knowledge' ? 'bg-primary-500 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200'}`}
            >
              <Network size={16} />
              Граф знаний
            </button>
            <button
              type="button"
              onClick={() => setGraphView('space')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${graphView === 'space' ? 'bg-primary-500 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-200'}`}
            >
              <Globe size={16} />
              Пространство
            </button>
          </div>
          {graphView === 'knowledge' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Добавить связь
            </button>
          )}
        </div>
      </div>

      {/* Граф */}
      {graphData && graphData.nodes.length > 0 ? (
        <KnowledgeGraph data={graphData} universeId={parseInt(universeId!)} onNodeClick={handleNodeClick} graphView={graphView} />
      ) : (
        <div className="text-center py-12">
          <Network size={64} className="mx-auto text-dark-300 mb-4" />
          <p className="text-dark-500">Пока нет элементов для отображения графа</p>
          <p className="text-sm text-dark-400 mt-2">
            {graphView === 'space'
              ? 'Добавьте галактики и звёздные системы в разделе Пространство'
              : 'Добавьте персонажей, локации или главы'}
          </p>
        </div>
      )}

      {/* Панель выбранного узла (только для графа знаний) */}
      {graphView === 'knowledge' && selectedNode && (
        <div className="card mt-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-dark-800">
              {selectedNode.label}
            </h3>
            <button
              onClick={() => {
                setSelectedNode(null);
                setSuggestions([]);
              }}
              className="text-dark-400 hover:text-dark-600"
            >
              ✕
            </button>
          </div>
          
          {/* Предложения связей */}
          {suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-dark-700 mb-2 flex items-center gap-1">
                <Lightbulb size={16} className="text-yellow-500" />
                Предложенные связи:
              </h4>
              <div className="space-y-2">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-dark-50 rounded-lg p-2"
                  >
                    <span className="text-sm text-dark-700">
                      → {suggestion.target_name ?? suggestion.target_label} ({suggestion.suggested_type ?? suggestion.link_type})
                    </span>
                    <button
                      onClick={() => handleAddSuggestion(suggestion)}
                      className="btn btn-primary text-xs py-1 px-2"
                    >
                      <LinkIcon size={14} className="mr-1" />
                      Связать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedNode && suggestions.length === 0 && (
            <p className="text-sm text-dark-500">
              Нажмите на узел, чтобы увидеть предложенные связи на основе анализа текста
            </p>
          )}
        </div>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {graphView === 'space' ? (
          <>
            <div className="card text-center">
              <div className="text-2xl font-bold text-indigo-600">{graphData?.nodes.filter(n => n.type === 'galaxy').length || 0}</div>
              <div className="text-sm text-dark-500">Галактик</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-amber-600">{graphData?.nodes.filter(n => n.type === 'star_system').length || 0}</div>
              <div className="text-sm text-dark-500">Систем</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-cyan-600">{graphData?.nodes.filter(n => n.type === 'celestial_body').length || 0}</div>
              <div className="text-sm text-dark-500">Небесных тел</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{graphData?.nodes.filter(n => n.type === 'location').length || 0}</div>
              <div className="text-sm text-dark-500">Локаций</div>
            </div>
          </>
        ) : (
          <>
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">{graphData?.nodes.filter(n => n.type === 'character').length || 0}</div>
              <div className="text-sm text-dark-500">Персонажей</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{graphData?.nodes.filter(n => n.type === 'location').length || 0}</div>
              <div className="text-sm text-dark-500">Локаций</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-amber-600">{graphData?.nodes.filter(n => n.type === 'chapter').length || 0}</div>
              <div className="text-sm text-dark-500">Глав</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-purple-600">{graphData?.links.length || 0}</div>
              <div className="text-sm text-dark-500">Связей</div>
            </div>
          </>
        )}
      </div>

      {/* Список связей */}
      {links.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-dark-800 mb-4">Все связи</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {links.map((link: Link) => (
              <div
                key={link.id}
                className="flex items-center justify-between bg-dark-50 rounded-lg p-2"
              >
                <div className="text-sm text-dark-700">
                  <span className="font-medium">{link.source_type}_{link.source_id}</span>
                  <span className="mx-2 text-dark-400">→</span>
                  <span className="font-medium">{link.target_type}_{link.target_id}</span>
                  <span className="ml-2 text-xs text-dark-500">({link.link_type})</span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(link.id)}
                  className="p-1 hover:bg-red-100 rounded"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal создания связи */}
      {showCreateModal && (
        <CreateLinkModal
          universeId={parseInt(universeId!)}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['links', universeId] });
            queryClient.invalidateQueries({ queryKey: ['graph', universeId] });
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// Компонент модального окна создания связи
function CreateLinkModal({ universeId, onClose, onSuccess }: { universeId: number, onClose: () => void, onSuccess: () => void }) {
  const createMutation = useMutation({
    mutationFn: (data: LinkCreate) => linksApi.create(universeId, data),
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      source_type: formData.get('source_type') as string,
      source_id: parseInt(formData.get('source_id') as string),
      target_type: formData.get('target_type') as string,
      target_id: parseInt(formData.get('target_id') as string),
      link_type: formData.get('link_type') as string,
      description: formData.get('description') as string,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Новая связь</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Откуда (тип)
            </label>
            <select name="source_type" className="input" required>
              <option value="character">Персонаж</option>
              <option value="location">Локация</option>
              <option value="chapter">Глава</option>
              <option value="note">Заметка</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Откуда (ID)
            </label>
            <input name="source_id" type="number" className="input" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Куда (тип)
            </label>
            <select name="target_type" className="input" required>
              <option value="character">Персонаж</option>
              <option value="location">Локация</option>
              <option value="chapter">Глава</option>
              <option value="note">Заметка</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Куда (ID)
            </label>
            <input name="target_id" type="number" className="input" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Тип связи
            </label>
            <select name="link_type" className="input">
              <option value="related">Связан</option>
              <option value="friend">Друг</option>
              <option value="enemy">Враг</option>
              <option value="family">Семья</option>
              <option value="loves">Любит</option>
              <option value="hates">Ненавидит</option>
              <option value="located_in">Находится в</option>
              <option value="appears_in">Появляется в</option>
              <option value="knows">Знает</option>
              <option value="visited">Посетил</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Описание
            </label>
            <textarea name="description" rows={2} className="input" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
