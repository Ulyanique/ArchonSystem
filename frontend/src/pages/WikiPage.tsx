import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { wikiApi, charactersApi, locationsApi, timelineApi } from '../api';
import { BookOpen, Plus, Trash2, Edit2, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { injectEntityLinks } from '../utils/entityLinks';
import type { WikiArticle, WikiArticleCreate, WikiArticleUpdate } from '../types';

/** Преобразует контент вики: [[entity_type:entity_id|label]] в markdown-ссылки на статьи или сущности */
function wikiContentToMarkdown(
  content: string,
  universeId: string,
  articlesByEntity: Map<string, string>
): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target: string, label: string | undefined) => {
      const text = label || target;
      const key = target.trim();
      const slug = articlesByEntity.get(key);
      if (slug) {
        return `[${text}](/universes/${universeId}/wiki/article/${encodeURIComponent(slug)})`;
      }
      return `[${text}](#)`;
    }
  );
}

export default function WikiPage() {
  const { universeId } = useParams<{ universeId: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewSlug, setViewSlug] = useState<string | null>(null);
  const [editArticle, setEditArticle] = useState<WikiArticle | null | 'new'>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formContent, setFormContent] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateType, setGenerateType] = useState<'character' | 'location' | 'event'>('character');
  const [generateId, setGenerateId] = useState('');

  const bid = universeId ? parseInt(universeId, 10) : 0;

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['wiki', bid],
    queryFn: () => wikiApi.getAll(bid),
    enabled: !!bid,
  });

  const { data: viewArticle, isLoading: viewLoading } = useQuery({
    queryKey: ['wiki', bid, 'slug', viewSlug],
    queryFn: () => wikiApi.getBySlug(bid, viewSlug!),
    enabled: !!bid && !!viewSlug,
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
    enabled: !!bid && (showGenerateModal || editArticle !== null),
  });

  const createMutation = useMutation({
    mutationFn: (data: WikiArticleCreate) => wikiApi.create(bid, data),
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', bid] });
      setEditArticle(null);
      setViewSlug(a.slug);
      toast.success('Статья создана');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка создания'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WikiArticleUpdate }) =>
      wikiApi.update(bid, id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', bid] });
      queryClient.invalidateQueries({ queryKey: ['wiki', bid, 'slug', updated.slug] });
      setEditArticle(null);
      setViewSlug(updated.slug);
      toast.success('Статья сохранена');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => wikiApi.delete(bid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', bid] });
      setEditArticle(null);
      setViewSlug(null);
      toast.success('Статья удалена');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка удаления'),
  });

  const generateMutation = useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: 'character' | 'location' | 'event'; entityId: number }) =>
      wikiApi.generate(bid, entityType, entityId),
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', bid] });
      setShowGenerateModal(false);
      setGenerateId('');
      setViewSlug(a.slug);
      toast.success('Статья сгенерирована');
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Ошибка генерации'),
  });

  const articlesByEntity = useMemo(() => {
    const m = new Map<string, string>();
    articles.forEach((a) => {
      if (a.linked_entity_type && a.linked_entity_id != null) {
        m.set(`${a.linked_entity_type}:${a.linked_entity_id}`, a.slug);
      }
      m.set(a.slug, a.slug);
    });
    return m;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
    );
  }, [articles, search]);

  const openEdit = (a: WikiArticle | null | 'new') => {
    setEditArticle(a);
    if (a && a !== 'new') {
      setFormTitle(a.title);
      setFormSlug(a.slug);
      setFormContent(a.content || '');
    } else {
      setFormTitle('');
      setFormSlug('');
      setFormContent('');
    }
  };

  const handleSave = () => {
    if (editArticle === 'new') {
      createMutation.mutate({
        title: formTitle,
        slug: formSlug || undefined,
        content: formContent,
        article_type: 'manual',
      });
    } else if (editArticle && typeof editArticle === 'object') {
      updateMutation.mutate({
        id: editArticle.id,
        data: { title: formTitle, slug: formSlug || undefined, content: formContent },
      });
    }
  };

  const handleGenerate = () => {
    const id = parseInt(generateId, 10);
    if (!generateId || isNaN(id)) {
      toast.error('Выберите сущность');
      return;
    }
    generateMutation.mutate({ entityType: generateType, entityId: id });
  };

  const contentForPreview = useMemo(() => {
    if (!viewArticle?.content || !universeId) return viewArticle?.content ?? '';
    const withWikiLinks = wikiContentToMarkdown(viewArticle.content, universeId, articlesByEntity);
    return injectEntityLinks(withWikiLinks, { characters, locations, universeId: bid });
  }, [viewArticle?.content, universeId, articlesByEntity, characters, locations, bid]);

  if (articlesLoading && !articles.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-dark-500">Загрузка вики...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-dark-800 flex items-center gap-2">
          <BookOpen size={24} />
          Вики
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Sparkles size={18} />
            Сгенерировать статью
          </button>
          <button
            type="button"
            onClick={() => openEdit('new')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Новая статья
          </button>
        </div>
      </div>

      {editArticle !== null ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editArticle === 'new' ? 'Новая статья' : 'Редактирование'}
            </h3>
            <button
              type="button"
              onClick={() => setEditArticle(null)}
              className="text-dark-500 hover:text-dark-700"
            >
              Закрыть
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Заголовок</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="input w-full"
                placeholder="Название статьи"
              />
              <label className="block text-sm font-medium text-dark-700 mt-2 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="input w-full"
                placeholder="оставьте пустым для автогенерации"
              />
              <label className="block text-sm font-medium text-dark-700 mt-2 mb-1">Содержание (Markdown)</label>
              <p className="text-xs text-dark-500 mb-1">
                Гиперссылки: [[character:1|Имя]] или [[location:2]] или [[slug-статьи]]
              </p>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="input w-full min-h-[280px] font-mono text-sm"
                placeholder="## Введение\nТекст с **выделением** и [[character:1|персонажем]]..."
              />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={handleSave} className="btn btn-primary">
                  {editArticle === 'new' ? 'Создать' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setEditArticle(null)} className="btn btn-secondary">
                  Отмена
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-dark-600 mb-2">Предпросмотр</div>
              <div className="border border-dark-200 rounded-lg p-4 bg-dark-50 min-h-[320px] prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) =>
                      href?.startsWith('/universes/') ? (
                        <Link to={href} className="text-primary-600 hover:underline">{children}</Link>
                      ) : (
                        <a href={href}>{children}</a>
                      ),
                  }}
                >
                  {injectEntityLinks(wikiContentToMarkdown(formContent, universeId || '', articlesByEntity), {
                    characters,
                    locations,
                    universeId: bid,
                  })}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      ) : viewSlug && viewArticle ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewSlug(null)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              К списку
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(viewArticle)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Edit2 size={18} />
                Редактировать
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Удалить статью?')) deleteMutation.mutate(viewArticle.id);
                }}
                className="btn btn-danger flex items-center gap-2"
              >
                <Trash2 size={18} />
                Удалить
              </button>
            </div>
          </div>
          {viewLoading ? (
            <p className="text-dark-500">Загрузка...</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-dark-800 mb-4">{viewArticle.title}</h1>
              <div className="prose prose-lg max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      if (!href) return <span>{children}</span>;
                      if (href.startsWith('/universes/') || href.startsWith('/universes/')) {
                        const wikiIdx = href.indexOf('/wiki/article/');
                        if (wikiIdx !== -1) {
                          return (
                            <a
                              href={href}
                              onClick={(e) => {
                                e.preventDefault();
                                setViewSlug(decodeURIComponent(href.slice(wikiIdx + 14)));
                              }}
                            >
                              {children}
                            </a>
                          );
                        }
                        return <Link to={href} className="text-primary-600 hover:underline">{children}</Link>;
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                  }}
                >
                  {contentForPreview}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или slug..."
              className="input w-full pl-9"
            />
          </div>
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              {articles.length === 0
                ? 'Статей пока нет. Создайте вручную или сгенерируйте из персонажа/локации/события.'
                : 'Нет статей по запросу.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredArticles.map((a) => (
                <li
                  key={a.id}
                  className="card cursor-pointer hover:border-primary-300 flex items-center justify-between"
                  onClick={() => setViewSlug(a.slug)}
                >
                  <div>
                    <span className="font-medium text-dark-800">{a.title}</span>
                    <span className="text-dark-500 text-sm ml-2">/{a.slug}</span>
                    {a.auto_generated && (
                      <span className="ml-2 text-xs text-primary-600">авто</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(a);
                    }}
                    className="p-2 hover:bg-dark-100 rounded"
                  >
                    <Edit2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Сгенерировать статью вики</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Тип сущности</label>
                <select
                  value={generateType}
                  onChange={(e) => {
                    setGenerateType(e.target.value as 'character' | 'location' | 'event');
                    setGenerateId('');
                  }}
                  className="input w-full"
                >
                  <option value="character">Персонаж</option>
                  <option value="location">Локация</option>
                  <option value="event">Событие</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Выберите сущность</label>
                <select
                  value={generateId}
                  onChange={(e) => setGenerateId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">—</option>
                  {generateType === 'character' &&
                    characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  {generateType === 'location' &&
                    locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  {generateType === 'event' &&
                    events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !generateId}
                className="btn btn-primary"
              >
                {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
