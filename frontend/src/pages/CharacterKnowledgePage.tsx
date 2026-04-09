import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  characterKnowledgeApi,
  charactersApi,
  locationsApi,
  timelineApi,
} from '../api';
import { Brain, Plus, Trash2, Edit2 } from 'lucide-react';
import type { CharacterKnowledgeCreate, Character } from '../types';

const KNOWLEDGE_LEVELS = [
  { value: 'none', label: 'Нет' },
  { value: 'rumors', label: 'Слухи' },
  { value: 'superficial', label: 'Поверхностно' },
  { value: 'good', label: 'Хорошо' },
  { value: 'complete', label: 'Полностью' },
];
const SOURCE_TYPES = [
  { value: 'participated', label: 'Участвовал' },
  { value: 'heard', label: 'Услышал' },
  { value: 'read', label: 'Прочитал' },
  { value: 'learned_from', label: 'Узнал от' },
];
const TARGET_TYPES = [
  { value: 'character', label: 'Персонаж' },
  { value: 'event', label: 'Событие' },
  { value: 'location', label: 'Локация' },
  { value: 'concept', label: 'Концепция' },
];

function targetLabel(
  targetType: string,
  targetId: number,
  characters: Character[],
  locations: { id: number; name: string }[],
  events: { id: number; title: string }[]
): string {
  if (targetType === 'character') {
    const c = characters.find((x) => x.id === targetId);
    return c ? c.name : `#${targetId}`;
  }
  if (targetType === 'location') {
    const l = locations.find((x) => x.id === targetId);
    return l ? l.name : `#${targetId}`;
  }
  if (targetType === 'event') {
    const e = events.find((x) => x.id === targetId);
    return e ? e.title : `#${targetId}`;
  }
  return `${targetType}#${targetId}`;
}

export default function CharacterKnowledgePage() {
  const { universeId } = useParams<{ universeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const bid = universeId ? parseInt(universeId, 10) : 0;
  const characterFromUrl = searchParams.get('character');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    characterFromUrl ? parseInt(characterFromUrl, 10) : null
  );
  
  // Обновляем URL при изменении выбранного персонажа
  useEffect(() => {
    if (selectedCharacterId) {
      setSearchParams({ character: selectedCharacterId.toString() });
    } else {
      setSearchParams({});
    }
  }, [selectedCharacterId, setSearchParams]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CharacterKnowledgeCreate>({
    target_type: 'character',
    target_id: 0,
    knowledge_level: 'superficial',
    source_type: null,
    source_id: null,
    notes: '',
  });
  const [editForm, setEditForm] = useState<{ knowledge_level: string; source_type: string | null; source_id: number | null; notes: string | null }>({
    knowledge_level: 'superficial',
    source_type: null,
    source_id: null,
    notes: '',
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', bid],
    queryFn: () => charactersApi.getAll(bid),
    enabled: !!bid,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', bid],
    queryFn: () => locationsApi.getAll(bid),
    enabled: !!bid,
  });
  const { data: events = [] } = useQuery({
    queryKey: ['timeline', bid],
    queryFn: () => timelineApi.getAll(bid),
    enabled: !!bid,
  });

  const { data: knowledgeList = [], isLoading } = useQuery({
    queryKey: ['character-knowledge', bid, selectedCharacterId],
    queryFn: () => characterKnowledgeApi.getAll(bid, selectedCharacterId!),
    enabled: !!bid && !!selectedCharacterId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CharacterKnowledgeCreate) =>
      characterKnowledgeApi.create(bid, selectedCharacterId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-knowledge', bid, selectedCharacterId] });
      setShowAdd(false);
      setForm({ target_type: 'character', target_id: 0, knowledge_level: 'superficial', source_type: null, source_id: null, notes: '' });
      toast.success('Запись добавлена');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { knowledge_level?: string; source_type?: string | null; source_id?: number | null; notes?: string | null } }) =>
      characterKnowledgeApi.update(bid, selectedCharacterId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-knowledge', bid, selectedCharacterId] });
      setEditingId(null);
      toast.success('Сохранено');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => characterKnowledgeApi.delete(bid, selectedCharacterId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-knowledge', bid, selectedCharacterId] });
      toast.success('Удалено');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка'),
  });

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain size={24} />
        <h2 className="text-xl font-bold text-dark-800">Знания персонажей</h2>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-dark-700 mb-2">Персонаж</label>
        <select
          value={selectedCharacterId ?? ''}
          onChange={(e) => {
            setSelectedCharacterId(e.target.value ? parseInt(e.target.value, 10) : null);
            setShowAdd(false);
            setEditingId(null);
          }}
          className="input w-full max-w-md"
        >
          <option value="">— Выберите персонажа —</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedCharacterId ? (
        <p className="text-dark-500">Выберите персонажа, чтобы просматривать и редактировать его знания.</p>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-dark-600">
              Знания: <strong>{selectedCharacter?.name}</strong>
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              Добавить знание
            </button>
          </div>

          {showAdd && (
            <div className="card border-primary-200 bg-primary-50/30">
              <h3 className="font-medium mb-3">Новая запись</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-dark-600 mb-1">Тип цели</label>
                  <select
                    value={form.target_type}
                    onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value }))}
                    className="input w-full"
                  >
                    {TARGET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-dark-600 mb-1">Цель (ID или выберите)</label>
                  {form.target_type === 'character' && (
                    <select
                      value={form.target_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, target_id: parseInt(e.target.value, 10) }))}
                      className="input w-full"
                    >
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  {form.target_type === 'location' && (
                    <select
                      value={form.target_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, target_id: parseInt(e.target.value, 10) }))}
                      className="input w-full"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  )}
                  {form.target_type === 'event' && (
                    <select
                      value={form.target_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, target_id: parseInt(e.target.value, 10) }))}
                      className="input w-full"
                    >
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  )}
                  {form.target_type === 'concept' && (
                    <input
                      type="number"
                      value={form.target_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, target_id: parseInt(e.target.value, 10) || 0 }))}
                      className="input w-full"
                      placeholder="ID"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm text-dark-600 mb-1">Уровень</label>
                  <select
                    value={form.knowledge_level}
                    onChange={(e) => setForm((f) => ({ ...f, knowledge_level: e.target.value }))}
                    className="input w-full"
                  >
                    {KNOWLEDGE_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-dark-600 mb-1">Источник</label>
                  <select
                    value={form.source_type ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value || null }))}
                    className="input w-full"
                  >
                    <option value="">—</option>
                    {SOURCE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-dark-600 mb-1">Заметки</label>
                  <input
                    type="text"
                    value={form.notes ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                    className="input w-full"
                    placeholder="Опционально"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => createMutation.mutate(form)}
                  disabled={createMutation.isPending}
                  className="btn btn-primary"
                >
                  Сохранить
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-dark-500">Загрузка...</p>
          ) : knowledgeList.length === 0 && !showAdd ? (
            <p className="text-dark-500">Нет записей знаний. Добавьте знания о других персонажах, событиях или локациях.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-200 text-left text-dark-600">
                    <th className="py-2 pr-4">Цель</th>
                    <th className="py-2 pr-4">Уровень</th>
                    <th className="py-2 pr-4">Источник</th>
                    <th className="py-2 pr-4">Заметки</th>
                    <th className="py-2 w-24">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeList.map((k) => (
                    <tr key={k.id} className="border-b border-dark-100">
                      <td className="py-2 pr-4">
                        {targetLabel(k.target_type, k.target_id, characters, locations, events)}
                        <span className="text-dark-400 ml-1">({k.target_type})</span>
                      </td>
                      <td className="py-2 pr-4">
                        {editingId === k.id ? (
                          <select
                            value={editForm.knowledge_level}
                            onChange={(e) => setEditForm((f) => ({ ...f, knowledge_level: e.target.value }))}
                            className="input py-1 text-sm"
                          >
                            {KNOWLEDGE_LEVELS.map((l) => (
                              <option key={l.value} value={l.value}>{l.label}</option>
                            ))}
                          </select>
                        ) : (
                          KNOWLEDGE_LEVELS.find((l) => l.value === k.knowledge_level)?.label ?? k.knowledge_level
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {editingId === k.id ? (
                          <select
                            value={editForm.source_type ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, source_type: e.target.value || null }))}
                            className="input py-1 text-sm"
                          >
                            <option value="">—</option>
                            {SOURCE_TYPES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        ) : (
                          SOURCE_TYPES.find((s) => s.value === k.source_type)?.label ?? (k.source_type || '—')
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {editingId === k.id ? (
                          <input
                            type="text"
                            value={editForm.notes ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value || null }))}
                            className="input py-1 text-sm w-full"
                          />
                        ) : (
                          (k.notes || '—').slice(0, 40)
                        )}
                      </td>
                      <td className="py-2">
                        {editingId === k.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateMutation.mutate({ id: k.id, data: editForm })}
                              className="text-primary-600 hover:underline mr-2"
                            >
                              Ok
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-dark-500 hover:underline">
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(k.id);
                                setEditForm({
                                  knowledge_level: k.knowledge_level,
                                  source_type: k.source_type ?? null,
                                  source_id: k.source_id ?? null,
                                  notes: k.notes ?? '',
                                });
                              }}
                              className="p-1 hover:bg-dark-100 rounded"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm('Удалить запись?')) deleteMutation.mutate(k.id); }}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
