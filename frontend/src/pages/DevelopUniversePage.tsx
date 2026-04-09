import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { universesApi, outlineApi, aiGeneratorApi, charactersApi, locationsApi, linksApi } from '../api';
import { enqueueJob } from '../store/jobQueue';
import { Sparkles, User, MapPin, ListOrdered, ArrowRight, Check, Loader2, Network, AlertCircle, TrendingUp, Clock, Link2, Lightbulb } from 'lucide-react';

function getErrorMessage(error: any): string {
  if (error.response?.data) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object') return JSON.stringify(detail);
    return String(detail);
  }
  return error.message || 'Неизвестная ошибка';
}

const STEPS = [
  { id: 'direction', label: 'Направление', icon: Sparkles },
  { id: 'characters', label: 'Персонажи', icon: User },
  { id: 'locations', label: 'Локации', icon: MapPin },
  { id: 'outline', label: 'План', icon: ListOrdered },
  { id: 'connectivity', label: 'Связанность', icon: Network },
  { id: 'temporal', label: 'Время', icon: Clock },
  { id: 'suggestions', label: 'Предложения', icon: Lightbulb },
];

export default function DevelopUniversePage() {
  const { universeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState('');
  const [suggestedChars, setSuggestedChars] = useState<any[]>([]);
  const [selectedCharIndices, setSelectedCharIndices] = useState<Set<number>>(new Set());
  const [suggestedLocs, setSuggestedLocs] = useState<any[]>([]);
  const [selectedLocIndices, setSelectedLocIndices] = useState<Set<number>>(new Set());
  const [generatedOutline, setGeneratedOutline] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [addProgress, setAddProgress] = useState<{ type: 'characters' | 'locations'; done: number; total: number } | null>(null);
  const [connectivityData, setConnectivityData] = useState<any>(null);
  const [temporalData, setTemporalData] = useState<any>(null);
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [developmentSuggestions, setDevelopmentSuggestions] = useState<any>(null);

  const bid = parseInt(universeId!);
  const { data: book } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.getById(bid),
    enabled: !!universeId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(bid),
    enabled: !!universeId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(bid),
    enabled: !!universeId,
  });

  const saveDirection = () => {
    universesApi.update(bid, { direction }).then(() => queryClient.invalidateQueries({ queryKey: ['universe', universeId] }));
  };

  const loadSuggestedCharacters = () => {
    enqueueJob('other', 'Предложить персонажей (анализ вселенной)', async () => {
      setLoading('characters');
      try {
        const res = await aiGeneratorApi.characters(bid, book?.genre, 6);
        setSuggestedChars(Array.isArray(res) ? res : []);
      } catch (err: any) {
        toast.error('Ошибка: ' + getErrorMessage(err));
      } finally {
        setLoading(null);
      }
    });
  };

  const loadSuggestedLocations = () => {
    enqueueJob('other', 'Предложить локации (анализ вселенной)', async () => {
      setLoading('locations');
      try {
        const res = await aiGeneratorApi.locations(bid, book?.genre, 6);
        setSuggestedLocs(Array.isArray(res) ? res : []);
      } catch (err: any) {
        toast.error('Ошибка: ' + getErrorMessage(err));
      } finally {
        setLoading(null);
      }
    });
  };

  const addCharacter = async (c: any) => {
    await aiGeneratorApi.applyCharacter(bid, {
      name: c.name,
      description: c.backstory || '',
      role: '',
      traits: c.trait || c.traits || '',
      appearance: c.appearance || '',
      backstory: c.backstory || '',
    });
    queryClient.invalidateQueries({ queryKey: ['characters', universeId] });
  };

  const toggleCharSelection = (i: number) => {
    setSelectedCharIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const addSelectedCharacters = async () => {
    const indicesToAdd = [...selectedCharIndices].sort((a, b) => a - b);
    if (indicesToAdd.length === 0) return;
    setAddProgress({ type: 'characters', done: 0, total: indicesToAdd.length });
    const succeededIndices = new Set<number>();
    try {
      for (const i of indicesToAdd) {
        const c = suggestedChars[i];
        if (!c) continue;
        try {
          await addCharacter(c);
          succeededIndices.add(i);
        } catch (err: any) {
          toast.error(c.name + ': ' + (err.response?.data?.detail || err.message));
        }
        setAddProgress(prev => prev && prev.type === 'characters' ? { ...prev, done: succeededIndices.size } : null);
      }
    } finally {
      setAddProgress(null);
    }
    setSuggestedChars(prev => prev.filter((_, i) => !succeededIndices.has(i)));
    setSelectedCharIndices(prev => {
      const next = new Set(prev);
      succeededIndices.forEach(idx => next.delete(idx));
      return next;
    });
  };

  const addLocation = async (loc: any) => {
    await aiGeneratorApi.applyLocation(bid, {
      name: loc.name,
      description: loc.description || '',
      location_type: loc.type || loc.location_type || '',
      details: loc.secret || loc.details || '',
    });
    queryClient.invalidateQueries({ queryKey: ['locations', universeId] });
  };

  const toggleLocSelection = (i: number) => {
    setSelectedLocIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const addSelectedLocations = async () => {
    const indicesToAdd = [...selectedLocIndices].sort((a, b) => a - b);
    if (indicesToAdd.length === 0) return;
    setAddProgress({ type: 'locations', done: 0, total: indicesToAdd.length });
    const succeededIndices = new Set<number>();
    try {
      for (const i of indicesToAdd) {
        const loc = suggestedLocs[i];
        if (!loc) continue;
        try {
          await addLocation(loc);
          succeededIndices.add(i);
        } catch (err: any) {
          toast.error(loc.name + ': ' + (err.response?.data?.detail || err.message));
        }
        setAddProgress(prev => prev && prev.type === 'locations' ? { ...prev, done: succeededIndices.size } : null);
      }
    } finally {
      setAddProgress(null);
    }
    setSuggestedLocs(prev => prev.filter((_, i) => !succeededIndices.has(i)));
    setSelectedLocIndices(prev => {
      const next = new Set(prev);
      succeededIndices.forEach(idx => next.delete(idx));
      return next;
    });
  };

  const generateOutline = async () => {
    setLoading('outline');
    try {
      const res = await outlineApi.generate(bid, {
        direction: direction || book?.direction,
        genre: book?.genre,
        num_chapters: 12,
      });
      setGeneratedOutline(res.items || []);
    } finally {
      setLoading(null);
    }
  };

  const applyOutline = async () => {
    await outlineApi.apply(bid, generatedOutline, true);
    queryClient.invalidateQueries({ queryKey: ['outline', universeId] });
    queryClient.invalidateQueries({ queryKey: ['chapters', universeId] });
    setGeneratedOutline([]);
  };

  if (!book) return null;

  const currentStep = STEPS[stepIndex];
  const directionValue = direction !== '' ? direction : (book.direction ?? '');

  const loadConnectivityAnalysis = () => {
    enqueueJob('other', 'Анализ связанности вселенной', async () => {
      setLoading('connectivity');
      try {
        const data = await linksApi.getConnectivity(bid);
        setConnectivityData(data);
      } catch (error: any) {
        toast.error('Ошибка анализа: ' + getErrorMessage(error));
      } finally {
        setLoading(null);
      }
    });
  };

  const loadTemporalConsistency = () => {
    enqueueJob('other', 'Временная консистентность вселенной', async () => {
      setLoading('temporal');
      try {
        const data = await linksApi.getTemporalConsistency(bid);
        setTemporalData(data);
      } catch (error: any) {
        toast.error('Ошибка проверки: ' + getErrorMessage(error));
      } finally {
        setLoading(null);
      }
    });
  };

  const loadLinkSuggestions = () => {
    enqueueJob('other', 'Предложения связей вселенной', async () => {
      setLoading('link-suggestions');
      try {
        const suggestions = await linksApi.getLinkSuggestions(bid);
        setLinkSuggestions(suggestions);
      } catch (error: any) {
        toast.error('Ошибка загрузки предложений: ' + getErrorMessage(error));
      } finally {
        setLoading(null);
      }
    });
  };

  const loadDevelopmentSuggestions = () => {
    if (!connectivityData) {
      toast.error('Сначала запустите анализ связанности');
      return;
    }
    const connectivitySnapshot = connectivityData;
    enqueueJob('other', 'AI-предложения по развитию вселенной', async () => {
      setLoading('development-suggestions');
      try {
        const suggestions = await linksApi.getDevelopmentSuggestions(bid, connectivitySnapshot);
        setDevelopmentSuggestions(suggestions);
      } catch (error: any) {
        toast.error('Ошибка генерации предложений: ' + getErrorMessage(error));
      } finally {
        setLoading(null);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-dark-800 mb-2">Анализ вселенной</h2>
        <p className="text-dark-500">Пошагово задайте направление, добавьте персонажей, локации, план и проанализируйте связанность.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar с шагами */}
        <aside className="w-64 shrink-0">
          <div className="card p-4 sticky top-6">
            <h3 className="text-sm font-semibold text-dark-700 mb-4 uppercase tracking-wider">Шаги</h3>
            <nav className="space-y-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStepIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    i === stepIndex 
                      ? 'bg-primary-600 text-white shadow-md' 
                      : 'bg-dark-50 text-dark-600 hover:bg-dark-100'
                  }`}
                >
                  <s.icon size={18} className="shrink-0" />
                  <span className="text-left">{s.label}</span>
                  {i < stepIndex && <Check size={14} className="ml-auto shrink-0" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Основной контент */}
        <main className="flex-1 min-w-0">

      {/* Step 1: Direction */}
      {currentStep.id === 'direction' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <Sparkles size={20} />
              Направление вселенной
            </h3>
            <p className="text-sm text-dark-500">Опишите главную идею, тон и направление развития вселенной</p>
          </div>
          <label className="block text-sm font-medium text-dark-700 mb-2">Премиса / направление</label>
          <textarea
            value={directionValue}
            onChange={(e) => setDirection(e.target.value)}
            rows={6}
            className="input mb-4"
            placeholder="О чём вселенная, главная идея, тон, атмосфера..."
          />
          <div className="flex items-center gap-3">
            <button onClick={saveDirection} className="btn btn-primary">Сохранить направление</button>
            <button onClick={() => setStepIndex(1)} className="btn btn-secondary">
              Дальше: Персонажи <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Characters */}
      {currentStep.id === 'characters' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <User size={20} />
              Персонажи вселенной
            </h3>
            <p className="text-sm text-dark-500">Добавьте главных персонажей. Сгенерируйте идеи и выберите, кого добавить.</p>
            <div className="mt-2 text-sm text-dark-600">
              В вселенной сейчас: <span className="font-semibold text-dark-800">{characters.length} персонажей</span>
            </div>
          </div>
          <button onClick={loadSuggestedCharacters} className="btn btn-primary mb-4" disabled={loading === 'characters'}>
            {loading === 'characters' ? 'Генерация...' : 'Предложить персонажей'}
          </button>
          {suggestedChars.length > 0 && (
            <>
              <ul className="space-y-3 mb-4">
                {suggestedChars.map((c, i) => (
                  <li key={i} className="flex gap-3 items-start p-3 bg-dark-50 rounded">
                    <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedCharIndices.has(i)}
                        onChange={() => toggleCharSelection(i)}
                        className="rounded border-dark-300"
                      />
                      <span className="text-sm text-dark-600">Выбрать</span>
                    </label>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-dark-500 text-sm ml-2">{c.trait || c.traits}</span>
                      {c.backstory && <p className="text-sm text-dark-600 mt-1">{c.backstory.slice(0, 120)}...</p>}
                    </div>
                    <button onClick={() => addCharacter(c)} className="btn btn-secondary text-sm flex items-center gap-1 shrink-0">
                      <Check size={14} /> Один
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={addSelectedCharacters}
                  disabled={selectedCharIndices.size === 0 || addProgress !== null}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {addProgress?.type === 'characters' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Добавлено {addProgress.done} из {addProgress.total}…
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Добавить выбранных {selectedCharIndices.size > 0 && `(${selectedCharIndices.size})`}
                    </>
                  )}
                </button>
                {selectedCharIndices.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCharIndices(new Set())}
                    className="btn btn-secondary text-sm"
                  >
                    Снять выделение
                  </button>
                )}
              </div>
            </>
          )}
          <div className="mt-6 pt-4 border-t border-dark-200">
            <button onClick={() => setStepIndex(2)} className="btn btn-secondary">
              Дальше: Локации <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Locations */}
      {currentStep.id === 'locations' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <MapPin size={20} />
              Локации вселенной
            </h3>
            <p className="text-sm text-dark-500">Добавьте ключевые локации, где происходят события.</p>
            <div className="mt-2 text-sm text-dark-600">
              В вселенной сейчас: <span className="font-semibold text-dark-800">{locations.length} локаций</span>
            </div>
          </div>
          <button onClick={loadSuggestedLocations} className="btn btn-primary mb-4" disabled={loading === 'locations'}>
            {loading === 'locations' ? 'Генерация...' : 'Предложить локации'}
          </button>
          {suggestedLocs.length > 0 && (
            <>
              <ul className="space-y-3 mb-4">
                {suggestedLocs.map((loc, i) => (
                  <li key={i} className="flex gap-3 items-start p-3 bg-dark-50 rounded">
                    <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedLocIndices.has(i)}
                        onChange={() => toggleLocSelection(i)}
                        className="rounded border-dark-300"
                      />
                      <span className="text-sm text-dark-600">Выбрать</span>
                    </label>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{loc.name}</span>
                      <span className="text-dark-500 text-sm ml-2">{loc.type || loc.location_type}</span>
                      {loc.description && <p className="text-sm text-dark-600 mt-1">{loc.description.slice(0, 120)}...</p>}
                    </div>
                    <button onClick={() => addLocation(loc)} className="btn btn-secondary text-sm flex items-center gap-1 shrink-0">
                      <Check size={14} /> Один
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={addSelectedLocations}
                  disabled={selectedLocIndices.size === 0 || addProgress !== null}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {addProgress?.type === 'locations' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Добавлено {addProgress.done} из {addProgress.total}…
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Добавить выбранных {selectedLocIndices.size > 0 && `(${selectedLocIndices.size})`}
                    </>
                  )}
                </button>
                {selectedLocIndices.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedLocIndices(new Set())}
                    className="btn btn-secondary text-sm"
                  >
                    Снять выделение
                  </button>
                )}
              </div>
            </>
          )}
          <div className="mt-6 pt-4 border-t border-dark-200">
            <button onClick={() => setStepIndex(3)} className="btn btn-secondary">
              Дальше: План <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Outline */}
      {currentStep.id === 'outline' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <ListOrdered size={20} />
              План вселенной
            </h3>
            <p className="text-sm text-dark-500">Сгенерируйте план вселенной по направлению и добавленным данным.</p>
          </div>
          <button onClick={generateOutline} className="btn btn-primary mb-4" disabled={loading === 'outline'}>
            {loading === 'outline' ? 'Генерация...' : 'Сгенерировать план'}
          </button>
          {generatedOutline.length > 0 && (
            <>
              <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {generatedOutline.map((item, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-dark-400">[{item.outline_type}]</span> {item.title}
                  </li>
                ))}
              </ul>
              <button onClick={applyOutline} className="btn btn-primary">Применить план (создать главы)</button>
            </>
          )}
          <div className="mt-4 pt-4 border-t">
            <button onClick={() => navigate(`/universes/${universeId}/outline`)} className="btn btn-secondary">
              Перейти к плану
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Connectivity Analysis */}
      {currentStep.id === 'connectivity' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <Network size={20} />
              Анализ связанности
            </h3>
            <p className="text-sm text-dark-500">Проанализируйте связанность сущностей вселенной: персонажей, локаций и событий.</p>
          </div>
          <button onClick={loadConnectivityAnalysis} className="btn btn-primary mb-6" disabled={loading === 'connectivity'}>
            {loading === 'connectivity' ? 'Анализ...' : 'Запустить анализ связанности'}
          </button>
          
          {connectivityData && (
            <div className="space-y-6">
              {/* Статистика */}
              <div className="border-b pb-6 mb-6">
                <h3 className="font-semibold text-dark-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} />
                  Статистика
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={18} className="text-blue-600" />
                      <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Персонажи</div>
                    </div>
                    <div className="text-3xl font-bold text-blue-900">{connectivityData.statistics.total_characters}</div>
                    <div className="text-xs text-blue-600 mt-1">Средняя связанность: {connectivityData.statistics.avg_character_connections}</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={18} className="text-green-600" />
                      <div className="text-xs font-semibold text-green-700 uppercase tracking-wider">Локации</div>
                    </div>
                    <div className="text-3xl font-bold text-green-900">{connectivityData.statistics.total_locations}</div>
                    <div className="text-xs text-green-600 mt-1">Средняя связанность: {connectivityData.statistics.avg_location_connections}</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={18} className="text-purple-600" />
                      <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider">События</div>
                    </div>
                    <div className="text-3xl font-bold text-purple-900">{connectivityData.statistics.total_events}</div>
                    <div className="text-xs text-purple-600 mt-1">Явных связей: {connectivityData.statistics.total_links}</div>
                  </div>
                </div>
              </div>

              {/* Изолированные сущности */}
              {(connectivityData.isolated.characters.length > 0 || 
                connectivityData.isolated.locations.length > 0 || 
                connectivityData.isolated.events.length > 0) && (
                <div className="border-b pb-6 mb-6">
                  <h3 className="font-semibold text-dark-800 mb-4 flex items-center gap-2 text-amber-700">
                    <AlertCircle size={20} />
                    Изолированные сущности (без связей)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {connectivityData.isolated.characters.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          <User size={16} />
                          Персонажи ({connectivityData.isolated.characters.length})
                        </div>
                        <div className="text-sm text-dark-700 space-y-1">
                          {characters.filter(c => connectivityData.isolated.characters.includes(c.id)).slice(0, 5).map(c => (
                            <div key={c.id} className="truncate">• {c.name}</div>
                          ))}
                          {connectivityData.isolated.characters.length > 5 && (
                            <div className="text-xs text-dark-500">и ещё {connectivityData.isolated.characters.length - 5}...</div>
                          )}
                        </div>
                      </div>
                    )}
                    {connectivityData.isolated.locations.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          <MapPin size={16} />
                          Локации ({connectivityData.isolated.locations.length})
                        </div>
                        <div className="text-sm text-dark-700 space-y-1">
                          {locations.filter(l => connectivityData.isolated.locations.includes(l.id)).slice(0, 5).map(l => (
                            <div key={l.id} className="truncate">• {l.name}</div>
                          ))}
                          {connectivityData.isolated.locations.length > 5 && (
                            <div className="text-xs text-dark-500">и ещё {connectivityData.isolated.locations.length - 5}...</div>
                          )}
                        </div>
                      </div>
                    )}
                    {connectivityData.isolated.events.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          <Clock size={16} />
                          События ({connectivityData.isolated.events.length})
                        </div>
                        <div className="text-sm text-dark-700">События без персонажей и локаций</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Слабо связанные */}
              {(connectivityData.weakly_connected.characters.length > 0 || 
                connectivityData.weakly_connected.locations.length > 0) && (
                <div className="border-b pb-6 mb-6">
                  <h3 className="font-semibold text-dark-800 mb-4">Слабо связанные сущности (1-2 связи)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {connectivityData.weakly_connected.characters.length > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <User size={16} />
                          Персонажи ({connectivityData.weakly_connected.characters.length})
                        </div>
                        <div className="text-sm text-dark-700">
                          {characters.filter(c => connectivityData.weakly_connected.characters.includes(c.id)).slice(0, 8).map(c => c.name).join(', ')}
                          {connectivityData.weakly_connected.characters.length > 8 && '...'}
                        </div>
                      </div>
                    )}
                    {connectivityData.weakly_connected.locations.length > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <MapPin size={16} />
                          Локации ({connectivityData.weakly_connected.locations.length})
                        </div>
                        <div className="text-sm text-dark-700">
                          {locations.filter(l => connectivityData.weakly_connected.locations.includes(l.id)).slice(0, 8).map(l => l.name).join(', ')}
                          {connectivityData.weakly_connected.locations.length > 8 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Наиболее связанные */}
              {connectivityData.most_connected.characters.length > 0 && (
                <div>
                  <h3 className="font-semibold text-dark-800 mb-4">Наиболее связанные сущности</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-semibold text-dark-700 mb-3 flex items-center gap-2">
                        <User size={16} />
                        Персонажи
                      </div>
                      <div className="space-y-2">
                        {connectivityData.most_connected.characters.map((item: any) => {
                          const char = characters.find(c => c.id === item.id);
                          return char ? (
                            <div key={item.id} className="p-3 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200 flex items-center justify-between">
                              <span className="font-medium text-dark-800">{char.name}</span>
                              <span className="px-2 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
                                {item.connections}
                              </span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    {connectivityData.most_connected.locations.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-dark-700 mb-3 flex items-center gap-2">
                          <MapPin size={16} />
                          Локации
                        </div>
                        <div className="space-y-2">
                          {connectivityData.most_connected.locations.map((item: any) => {
                            const loc = locations.find(l => l.id === item.id);
                            return loc ? (
                              <div key={item.id} className="p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200 flex items-center justify-between">
                                <span className="font-medium text-dark-800">{loc.name}</span>
                                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                                  {item.connections}
                                </span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 6: Temporal Consistency */}
      {currentStep.id === 'temporal' && (
        <div className="card p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-800 mb-2 flex items-center gap-2">
              <Clock size={20} />
              Временная консистентность
            </h3>
            <p className="text-sm text-dark-500">Проверьте логику времени, противоречия в датах и временные несоответствия.</p>
          </div>
          <button onClick={loadTemporalConsistency} className="btn btn-primary mb-6" disabled={loading === 'temporal'}>
            {loading === 'temporal' ? 'Проверка...' : 'Проверить временную консистентность'}
          </button>
          
          {temporalData && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-dark-50 rounded-lg border border-dark-200">
                  <div className="text-xs text-dark-500 mb-1">Всего проблем</div>
                  <div className="text-2xl font-bold text-dark-800">{temporalData.total_issues}</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xs text-red-600 mb-1">Высокий</div>
                  <div className="text-2xl font-bold text-red-800">{temporalData.by_severity?.high || 0}</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-600 mb-1">Средний</div>
                  <div className="text-2xl font-bold text-amber-800">{temporalData.by_severity?.medium || 0}</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-600 mb-1">Низкий</div>
                  <div className="text-2xl font-bold text-blue-800">{temporalData.by_severity?.low || 0}</div>
                </div>
              </div>

              {temporalData.issues && temporalData.issues.length > 0 && (
                <div className="space-y-2">
                  {temporalData.issues.map((issue: any, i: number) => (
                    <div key={i} className={`p-3 rounded border-l-4 ${
                      issue.severity === 'high' ? 'bg-red-50 border-red-500' :
                      issue.severity === 'medium' ? 'bg-amber-50 border-amber-500' :
                      'bg-blue-50 border-blue-500'
                    }`}>
                      <div className="flex items-start gap-2">
                        <AlertCircle size={18} className={`mt-0.5 ${
                          issue.severity === 'high' ? 'text-red-600' :
                          issue.severity === 'medium' ? 'text-amber-600' :
                          'text-blue-600'
                        }`} />
                        <div className="flex-1">
                          <div className="font-semibold text-dark-800 text-sm mb-1">{issue.type}</div>
                          <div className="text-sm text-dark-600">{issue.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {temporalData.total_issues === 0 && (
                <div className="p-4 bg-green-50 rounded border border-green-200 text-green-800">
                  ✓ Временная консистентность в порядке! Противоречий не найдено.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 7: Suggestions */}
      {currentStep.id === 'suggestions' && (
        <div className="space-y-6">
          <div className="card p-6">
            <p className="text-dark-600 mb-6">Получите умные предложения по развитию вселенной и автоматические предложения связей.</p>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Link Suggestions */}
              <div className="border-r pr-6">
                <h3 className="font-semibold text-dark-800 mb-4 flex items-center gap-2">
                  <Link2 size={20} />
                  Предложения связей
                </h3>
                <button onClick={loadLinkSuggestions} className="btn btn-secondary mb-4 w-full" disabled={loading === 'link-suggestions'}>
                  {loading === 'link-suggestions' ? 'Анализ...' : 'Найти предложения связей'}
                </button>
                
                {linkSuggestions.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {linkSuggestions.map((suggestion, i) => (
                      <div key={i} className="p-3 bg-dark-50 rounded-lg border border-dark-200 hover:border-primary-300 transition-colors">
                        <div className="font-medium text-dark-800 mb-1 flex items-center gap-2">
                          <span className="text-primary-600">{suggestion.source_name}</span>
                          <ArrowRight size={14} className="text-dark-400" />
                          <span className="text-primary-600">{suggestion.target_name}</span>
                        </div>
                        <div className="text-sm text-dark-600 mb-2">{suggestion.reason}</div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="px-2 py-0.5 bg-dark-200 text-dark-700 rounded">{suggestion.link_type}</span>
                          <span className="text-dark-500">Уверенность: <span className="font-semibold">{Math.round(suggestion.confidence * 100)}%</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Development Suggestions */}
              <div>
                <h3 className="font-semibold text-dark-800 mb-4 flex items-center gap-2">
                  <Lightbulb size={20} />
                  AI-предложения по развитию
                </h3>
                <button 
                  onClick={loadDevelopmentSuggestions} 
                  className="btn btn-primary mb-4 w-full" 
                  disabled={loading === 'development-suggestions' || !connectivityData}
                >
                  {loading === 'development-suggestions' ? 'Генерация...' : 'Получить AI-предложения'}
                </button>
                
                {!connectivityData && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-sm mb-4">
                    ⚠ Сначала запустите анализ связанности
                  </div>
                )}
                
                {developmentSuggestions && (
                  <div className="space-y-4">
                    {developmentSuggestions.summary && (
                      <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                        <div className="font-semibold text-dark-800 mb-2 flex items-center gap-2">
                          <Lightbulb size={16} />
                          Резюме
                        </div>
                        <div className="text-sm text-dark-700 leading-relaxed">{developmentSuggestions.summary}</div>
                      </div>
                    )}
                    
                    {developmentSuggestions.suggestions && developmentSuggestions.suggestions.length > 0 && (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {developmentSuggestions.suggestions.map((suggestion: any, i: number) => (
                          <div key={i} className={`p-4 rounded-lg border-l-4 shadow-sm ${
                            suggestion.priority === 'high' ? 'bg-red-50 border-red-500' :
                            suggestion.priority === 'medium' ? 'bg-amber-50 border-amber-500' :
                            'bg-blue-50 border-blue-500'
                          }`}>
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                suggestion.priority === 'high' ? 'bg-red-200 text-red-800' :
                                suggestion.priority === 'medium' ? 'bg-amber-200 text-amber-800' :
                                'bg-blue-200 text-blue-800'
                              }`}>
                                {suggestion.priority === 'high' ? 'Высокий' : suggestion.priority === 'medium' ? 'Средний' : 'Низкий'}
                              </span>
                              <span className="text-xs px-2 py-1 bg-dark-200 text-dark-700 rounded">{suggestion.type}</span>
                            </div>
                            <div className="font-semibold text-dark-800 mb-2">{suggestion.title}</div>
                            <div className="text-sm text-dark-600 mb-2 leading-relaxed">{suggestion.description}</div>
                            {suggestion.action && (
                              <div className="text-sm text-dark-700 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-dark-200">
                                <ArrowRight size={14} />
                                {suggestion.action}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
