import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  coverageApi,
  type EntityType,
  charactersApi,
  locationsApi,
  factionApi,
  techApi,
} from '../api';
import {
  BarChart3,
  BookOpen,
  Users,
  MapPin,
  Cpu,
  Box,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const ENTITY_LABELS: Record<EntityType, string> = {
  character: 'Персонажи',
  location: 'Локации',
  technology: 'Технологии',
  artifact: 'Артефакты',
  faction: 'Фракции',
};

const ENTITY_ICONS = {
  character: Users,
  location: MapPin,
  technology: Cpu,
  artifact: Box,
  faction: Shield,
} as const;

export default function CoveragePage() {
  const { universeId } = useParams();
  const queryClient = useQueryClient();
  const uId = parseInt(universeId!);
  const [expandedEntity, setExpandedEntity] = useState<EntityType | null>('character');
  const [addMentionChapter, setAddMentionChapter] = useState<number | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['coverage', universeId],
    queryFn: () => coverageApi.getStats(uId),
    enabled: !!universeId,
  });

  const addMentionMutation = useMutation({
    mutationFn: ({
      chapterId,
      entityType,
      entityId,
    }: {
      chapterId: number;
      entityType: EntityType;
      entityId: number;
    }) => coverageApi.addMention(uId, chapterId, entityType, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage', universeId] });
      setAddMentionChapter(null);
      toast.success('Упоминание добавлено');
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      toast.error(err.response?.data?.detail || err.message || 'Ошибка');
    },
  });

  const removeMentionMutation = useMutation({
    mutationFn: ({
      chapterId,
      entityType,
      entityId,
    }: { chapterId: number; entityType: string; entityId: number }) =>
      coverageApi.removeMention(uId, chapterId, entityType, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage', universeId] });
      toast.success('Упоминание удалено');
    },
  });

  if (!universeId) return null;
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  if (!stats)
    return (
      <div className="text-center py-12 text-dark-500">
        Не удалось загрузить данные покрытия.
      </div>
    );

  const totalMentions = stats.chapters.reduce(
    (sum, ch) =>
      sum +
      (ch.mention_counts?.character ?? 0) +
      (ch.mention_counts?.location ?? 0) +
      (ch.mention_counts?.technology ?? 0) +
      (ch.mention_counts?.artifact ?? 0) +
      (ch.mention_counts?.faction ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
          <BarChart3 size={24} />
          Покрытие мира по главам
        </h2>
        <p className="text-sm text-dark-500 mt-1">
          Отмечайте, какие персонажи, локации, технологии и фракции фигурируют в каждой главе — так проще держать научно-фантастический мир согласованным.
        </p>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-primary-600">{stats.chapters.length}</div>
          <div className="text-sm text-dark-500">Глав</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-primary-600">{totalMentions}</div>
          <div className="text-sm text-dark-500">Упоминаний всего</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-600">
            {Object.values(stats.unused).reduce((a, b) => a + b.length, 0)}
          </div>
          <div className="text-sm text-dark-500">Сущностей без упоминаний</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-dark-600">
            {stats.chapters.filter((c) => {
              const n =
                (c.mention_counts?.character ?? 0) +
                (c.mention_counts?.location ?? 0) +
                (c.mention_counts?.technology ?? 0) +
                (c.mention_counts?.artifact ?? 0) +
                (c.mention_counts?.faction ?? 0);
              return n === 0;
            }).length}
          </div>
          <div className="text-sm text-dark-500">Глав без отметок</div>
        </div>
      </div>

      {/* По главам */}
      <div className="card p-4">
        <h3 className="font-semibold text-dark-800 flex items-center gap-2 mb-4">
          <BookOpen size={18} />
          По главам
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-200 text-left text-dark-500">
                <th className="pb-2 pr-4">№</th>
                <th className="pb-2 pr-4">Название</th>
                <th className="pb-2 pr-2 text-center">Перс.</th>
                <th className="pb-2 pr-2 text-center">Лок.</th>
                <th className="pb-2 pr-2 text-center">Техн.</th>
                <th className="pb-2 pr-2 text-center">Арт.</th>
                <th className="pb-2 pr-2 text-center">Фрак.</th>
                <th className="pb-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {stats.chapters.map((ch) => (
                <tr key={ch.id} className="border-b border-dark-100">
                  <td className="py-2 pr-4 font-mono text-dark-500">{ch.chapter_number}</td>
                  <td className="py-2 pr-4 font-medium">{ch.title}</td>
                  {(['character', 'location', 'technology', 'artifact', 'faction'] as const).map(
                    (t) => (
                      <td key={t} className="py-2 pr-2 text-center">
                        {ch.mention_counts?.[t] ?? 0}
                      </td>
                    )
                  )}
                  <td className="py-2">
                    {addMentionChapter === ch.id ? (
                      <AddMentionForm
                        universeId={uId}
                        onAdd={(entityType, entityId) =>
                          addMentionMutation.mutate({
                            chapterId: ch.id,
                            entityType,
                            entityId,
                          })
                        }
                        onCancel={() => setAddMentionChapter(null)}
                        isPending={addMentionMutation.isPending}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddMentionChapter(ch.id)}
                        className="text-primary-600 hover:underline text-xs flex items-center gap-1"
                      >
                        <Plus size={14} /> Добавить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.chapters.length === 0 && (
          <p className="text-dark-500 text-sm py-4">Нет глав. Создайте главы на странице «Главы».</p>
        )}
      </div>

      {/* Развёрнутые упоминания по главам: при клике на строку показать список и кнопки удалить */}
      <div className="card p-4">
        <h3 className="font-semibold text-dark-800 mb-2">Упоминания в главах</h3>
        <div className="space-y-2 text-sm">
          {stats.chapters.map((ch) => {
            const mentions = ch.mentions || [];
            if (mentions.length === 0) return null;
            return (
              <div key={ch.id} className="flex flex-wrap items-center gap-2">
                <span className="text-dark-500 font-mono">{ch.chapter_number}.</span>
                <span className="font-medium">{ch.title}</span>
                <span className="text-dark-400">—</span>
                {mentions.map((m) => {
                    const entList = stats.by_entity[m.entity_type as EntityType] || [];
                    const name = entList.find((e) => e.id === m.entity_id)?.name || `#${m.entity_id}`;
                    return (
                  <span
                    key={`${m.entity_type}-${m.entity_id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dark-100 text-dark-700"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() =>
                        removeMentionMutation.mutate({
                          chapterId: ch.id,
                          entityType: m.entity_type,
                          entityId: m.entity_id,
                        })
                      }
                      className="hover:bg-dark-200 rounded p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Неиспользованные сущности */}
      <div className="card p-4">
        <h3 className="font-semibold text-dark-800 mb-4">Не использованы ни в одной главе</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(stats.unused) as EntityType[]).map((etype) => {
            const ids = stats.unused[etype] || [];
            const list = (stats.by_entity[etype] || []).filter((e) => ids.includes(e.id));
            if (list.length === 0) return null;
            const Icon = ENTITY_ICONS[etype];
            return (
              <div key={etype}>
                <div className="flex items-center gap-2 text-dark-600 font-medium mb-2">
                  {Icon && <Icon size={16} />}
                  {ENTITY_LABELS[etype]} ({list.length})
                </div>
                <ul className="text-sm text-dark-600 space-y-1 max-h-40 overflow-y-auto">
                  {list.map((e) => (
                    <li key={e.id}>{e.name || `#${e.id}`}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* По сущностям: кто в каких главах */}
      <div className="card p-4">
        <h3 className="font-semibold text-dark-800 mb-4">По сущностям</h3>
        {(Object.keys(stats.by_entity) as EntityType[]).map((etype) => {
          const entities = stats.by_entity[etype] || [];
          const isOpen = expandedEntity === etype;
          const Icon = ENTITY_ICONS[etype];
          return (
            <div key={etype} className="border-b border-dark-100 last:border-0">
              <button
                type="button"
                onClick={() => setExpandedEntity(isOpen ? null : etype)}
                className="w-full flex items-center gap-2 py-3 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={18} className="text-dark-500" />
                ) : (
                  <ChevronRight size={18} className="text-dark-500" />
                )}
                {Icon && <Icon size={18} className="text-dark-500" />}
                <span className="font-medium">{ENTITY_LABELS[etype]}</span>
                <span className="text-dark-500 text-sm">({entities.length})</span>
              </button>
              {isOpen && (
                <ul className="pb-3 pl-8 text-sm space-y-1 max-h-60 overflow-y-auto">
                  {entities.map((e) => (
                    <li key={e.id} className="text-dark-600">
                      <span className="font-medium">{e.name || `#${e.id}`}</span>
                      {e.chapter_ids.length > 0 ? (
                        <span className="text-dark-400"> — главы: {e.chapter_ids.join(', ')}</span>
                      ) : (
                        <span className="text-amber-600"> — не используется</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddMentionForm({
  universeId,
  onAdd,
  onCancel,
  isPending,
}: {
  universeId: number;
  onAdd: (entityType: EntityType, entityId: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [entityType, setEntityType] = useState<EntityType>('character');
  const [entityId, setEntityId] = useState<number | ''>('');

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.getAll(universeId),
    enabled: !!universeId && entityType === 'character',
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', universeId],
    queryFn: () => locationsApi.getAll(universeId),
    enabled: !!universeId && entityType === 'location',
  });
  const { data: factions = [] } = useQuery({
    queryKey: ['factions', universeId],
    queryFn: () => factionApi.getAll(universeId),
    enabled: !!universeId && entityType === 'faction',
  });
  const { data: techs = [] } = useQuery({
    queryKey: ['techs', universeId],
    queryFn: () => techApi.getTechs(universeId),
    enabled: !!universeId && entityType === 'technology',
  });
  const { data: artifacts = [] } = useQuery({
    queryKey: ['artifacts', universeId],
    queryFn: () => techApi.getArtifacts(universeId),
    enabled: !!universeId && entityType === 'artifact',
  });
  const techList = Array.isArray(techs) ? techs : [];
  const artifactList = Array.isArray(artifacts) ? artifacts : [];

  const options =
    entityType === 'character'
      ? characters.map((c) => ({ id: c.id, name: c.name || `#${c.id}` }))
      : entityType === 'location'
        ? locations.map((l) => ({ id: l.id, name: l.name || `#${l.id}` }))
        : entityType === 'faction'
          ? factions.map((f: { id: number; name?: string }) => ({ id: f.id, name: f.name || `#${f.id}` }))
          : entityType === 'technology'
            ? techList.map((t: { id: number; name?: string }) => ({ id: t.id, name: t.name || `#${t.id}` }))
            : artifactList.map((a: { id: number; name?: string }) => ({ id: a.id, name: a.name || `#${a.id}` }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = typeof entityId === 'number' ? entityId : parseInt(String(entityId), 10);
    if (!Number.isFinite(id)) return;
    onAdd(entityType, id);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <select
        value={entityType}
        onChange={(e) => {
          setEntityType(e.target.value as EntityType);
          setEntityId('');
        }}
        className="input text-xs py-1 w-28"
      >
        {(Object.keys(ENTITY_LABELS) as EntityType[]).map((t) => (
          <option key={t} value={t}>
            {ENTITY_LABELS[t]}
          </option>
        ))}
      </select>
      <select
        value={entityId}
        onChange={(e) => setEntityId(e.target.value ? parseInt(e.target.value, 10) : '')}
        className="input text-xs py-1 w-40"
        required
      >
        <option value="">Выберите...</option>
        {options.map((o: { id: number; name: string }) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isPending || entityId === ''} className="btn btn-primary text-xs py-1">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
      </button>
      <button type="button" onClick={onCancel} className="text-dark-500 hover:underline text-xs">
        Отмена
      </button>
    </form>
  );
}
