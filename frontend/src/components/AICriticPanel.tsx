import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Brain, AlertTriangle, CheckCircle, Lightbulb, HelpCircle, X, ChevronDown, ChevronUp, Trash2, Copy, FilePen } from 'lucide-react';
import { AIAnalysis, AIIssue, AIContradiction } from '../types';
import { notesApi } from '../api';

interface AICriticProps {
  analysis: AIAnalysis | null;
  onClose: () => void;
  isLoading?: boolean;
  universeId?: number;
  onDelete?: () => void;
}

const severityColors: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  low: { bg: 'bg-accent-subtle', border: 'border-accent-dim', text: 'text-accent', icon: '🟡', label: 'Мелочь (незначительное)' },
  medium: { bg: 'bg-accent-subtle', border: 'border-accent-dim', text: 'text-accent', icon: '🟠', label: 'Средне' },
  high: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: '🔴', label: 'Критично' },
};

export default function AICriticPanel({ analysis, onClose, isLoading, onDelete, universeId }: AICriticProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('issues');
  const queryClient = useQueryClient();
  const addToDraftMutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      notesApi.create(universeId!, { title, content, note_type: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', universeId] });
      toast.success('Добавлено в черновики');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  const copyText = (text: string, label: string) => {
    if (!text?.trim()) return;
    navigator.clipboard.writeText(text).then(() => toast.success(`Скопировано: ${label}`)).catch(() => toast.error('Не удалось скопировать'));
  };

  const addToDraft = (title: string, content: string) => {
    if (!universeId || !content?.trim()) return;
    addToDraftMutation.mutate({ title: title?.trim() || 'Идея из анализа', content: content.trim() });
  };

  const buildFullReportText = (): string => {
    if (!analysis) return '';
    const lines: string[] = [];
    lines.push(`AI Анализ. Оценка: ${analysis.score ?? 0}/10`);
    lines.push('');
    if (analysis.strengths?.length) {
      lines.push('СИЛЬНЫЕ СТОРОНЫ');
      analysis.strengths.forEach((s) => lines.push('✓ ' + s));
      lines.push('');
    }
    if (analysis.issues?.length) {
      lines.push('ПРОБЛЕМЫ');
      analysis.issues.forEach((i: AIIssue) => {
        const label = i.severity === 'high' ? 'Критично' : i.severity === 'medium' ? 'Средне' : 'Мелочь';
        lines.push(`• [${label}] ${(i.description || '').trim() || '(без описания)'}`);
      });
      lines.push('');
    }
    if (analysis.suggestions?.length) {
      lines.push('ПРЕДЛОЖЕНИЯ');
      analysis.suggestions.forEach((s: string | { title?: string; description?: string }) => {
        const title = typeof s === 'string' ? undefined : s.title;
        const desc = typeof s === 'string' ? s : s.description;
        if (title) lines.push(title);
        if (desc) lines.push(desc);
        if (title || desc) lines.push('');
      });
    }
    if (analysis.questions?.length) {
      lines.push('ВОПРОСЫ ДЛЯ РАЗМЫШЛЕНИЯ');
      analysis.questions.forEach((q) => lines.push('? ' + q));
      lines.push('');
    }
    if (analysis.related_ideas?.length) {
      lines.push('С ЧЕМ МОЖНО СВЯЗАТЬ');
      analysis.related_ideas.forEach((r) => lines.push('→ ' + r));
      lines.push('');
    }
    if (analysis.contradictions?.length) {
      lines.push('ПРОТИВОРЕЧИЯ');
      analysis.contradictions.forEach((c: AIContradiction) =>
        lines.push('- ' + (c.description || [c.value1, c.value2].filter(Boolean).join(' vs ')))
      );
    }
    return lines.join('\n').trim();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-800 rounded-lg p-8 text-center max-w-md border border-accent-dim">
          <Brain size={48} className="mx-auto mb-4 text-accent animate-pulse" />
          <h3 className="text-lg font-semibold text-dark-800 dark:text-dark-200 mb-2">AI анализирует...</h3>
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-2">Генерация анализа в реальном времени</p>
          <p className="text-xs text-dark-400 mb-4">Если процесс занимает слишком много времени, проверьте логи backend</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          {analysis && (
            <div className="mt-4 p-4 bg-dark-50 rounded-lg text-left max-h-64 overflow-y-auto">
              <div className="text-xs text-dark-600 font-mono whitespace-pre-wrap">
                {JSON.stringify(analysis, null, 2).substring(0, 500)}
                {JSON.stringify(analysis, null, 2).length > 500 ? '...' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const score = analysis.score || 0;
  const scoreColor = score >= 8 ? 'text-accent' : score >= 5 ? 'text-accent' : 'text-red-600 dark:text-red-400';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto border border-accent-dim">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-accent-dim px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Brain size={28} className="text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-dark-800 dark:text-dark-200">AI Анализ</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className={scoreColor}>
                  Оценка: <strong>{score}/10</strong>
                </span>
                {(analysis.issues?.length ?? 0) > 0 && (
                  <span className="text-dark-500 dark:text-dark-400">
                    • {analysis.issues?.length ?? 0} проблем
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => copyText(buildFullReportText(), 'весь отчёт')} className="btn btn-secondary text-sm py-1.5 px-2" title="Скопировать весь отчёт в буфер обмена">
              Копировать отчёт
            </button>
            {universeId && (
              <button type="button" onClick={() => addToDraft('AI Анализ (полный отчёт)', buildFullReportText())} disabled={addToDraftMutation.isPending} className="btn btn-secondary text-sm py-1.5 px-2" title="Сохранить весь отчёт в черновик">
                В черновик
              </button>
            )}
            {onDelete && (
              <button 
                onClick={onDelete} 
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400"
                title="Удалить анализ"
                aria-label="Удалить анализ"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-accent-subtle rounded-lg" title="Закрыть" aria-label="Закрыть">
              <X size={20} className="text-dark-500 dark:text-dark-400 hover:text-accent" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Сильные стороны */}
          {(analysis.strengths?.length ?? 0) > 0 && (
            <div className="bg-accent-subtle border border-accent-dim rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <CheckCircle size={18} className="text-accent" />
                  Сильные стороны ({analysis.strengths?.length ?? 0})
                </h3>
                <button type="button" onClick={() => copyText(analysis.strengths!.map((s: string) => '✓ ' + s).join('\n'), 'сильные стороны')} className="text-xs text-accent hover:underline">
                  Копировать блок
                </button>
              </div>
              <ul className="space-y-2">
                {analysis.strengths?.map((strength: string, idx: number) => (
                  <li key={idx} className="text-sm text-dark-700 dark:text-dark-300 flex items-start gap-2">
                    <span className="text-accent mt-1">✓</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Проблемы */}
          {(analysis.issues?.length ?? 0) > 0 && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'issues' ? null : 'issues')}
                className="w-full flex items-center justify-between bg-accent-subtle border border-accent-dim rounded-lg p-4 mb-3 hover:bg-accent-subtle/80 transition-colors"
              >
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <AlertTriangle size={18} className="text-accent" />
                  Проблемы ({analysis.issues?.length ?? 0})
                </h3>
                {expandedSection === 'issues' ? <ChevronUp size={18} className="text-accent" /> : <ChevronDown size={18} className="text-accent" />}
              </button>
              {expandedSection === 'issues' && (
                <>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mb-2">
                    По важности: 🔴 Критично — серьёзно, 🟠 Средне — стоит учесть, 🟡 Мелочь — незначительное.
                  </p>
                  <div className="space-y-2">
                    {analysis.issues?.map((issue: AIIssue, idx: number) => {
                      const colors = severityColors[issue.severity as string] || severityColors.low;
                      const desc = (issue.description || '').trim();
                      return (
                        <div key={idx} className={`${colors.bg} ${colors.border} border rounded-lg p-3`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span>{colors.icon}</span>
                            {issue.type && (
                              <span className={`text-xs font-medium ${colors.text} uppercase`}>
                                {issue.type}
                              </span>
                            )}
                            <span className={`text-xs ${colors.text}`}>
                              • {colors.label}
                            </span>
                          </div>
                          <p className="text-sm text-dark-700 dark:text-dark-300">
                            {desc || '(модель не указала описание — перезапустите анализ)'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Предложения */}
          {(analysis.suggestions?.length ?? 0) > 0 && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'suggestions' ? null : 'suggestions')}
                className="w-full flex items-center justify-between bg-accent-subtle border border-accent-dim rounded-lg p-4 mb-3 hover:bg-accent-subtle/80 transition-colors"
              >
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <Lightbulb size={18} className="text-accent" />
                  Предложения ({analysis.suggestions?.length ?? 0})
                </h3>
                {expandedSection === 'suggestions' ? <ChevronUp size={18} className="text-accent" /> : <ChevronDown size={18} className="text-accent" />}
              </button>
              
              {expandedSection === 'suggestions' && (
                <div className="space-y-3">
                  {analysis.suggestions?.map((suggestion: string | { title?: string; description?: string }, idx: number) => {
                    const title = typeof suggestion === 'string' ? undefined : suggestion.title;
                    const description = typeof suggestion === 'string' ? suggestion : (suggestion.description ?? '');
                    const text = (title ? `${title}\n\n` : '') + description;
                    const shortLabel = title || description.slice(0, 40) + (description.length > 40 ? '…' : '');
                    return (
                      <div key={idx} className="bg-white dark:bg-dark-700 border border-accent-dim rounded-lg p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {title && <h4 className="font-semibold text-accent mb-2">{title}</h4>}
                            <p className="text-sm text-dark-700 dark:text-dark-300 whitespace-pre-wrap">{description || (typeof suggestion === 'string' ? suggestion : '')}</p>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button type="button" onClick={() => copyText(text, shortLabel)} className="p-2 hover:bg-accent-subtle rounded-lg" title="Копировать" aria-label="Копировать предложение">
                              <Copy size={16} className="text-accent" />
                            </button>
                            {universeId && (description || title) && (
                              <button type="button" onClick={() => addToDraft(title || 'Предложение из анализа', description || title || '')} disabled={addToDraftMutation.isPending} className="p-2 hover:bg-accent-subtle rounded-lg" title="Добавить в черновик" aria-label="Добавить в черновик">
                                <FilePen size={16} className="text-accent" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Вопросы */}
          {(analysis.questions?.length ?? 0) > 0 && (
            <div className="bg-accent-subtle border border-accent-dim rounded-lg p-4">
              <h3 className="font-semibold text-accent mb-3 flex items-center gap-2">
                <HelpCircle size={18} className="text-accent" />
                Вопросы для размышления ({analysis.questions?.length ?? 0})
              </h3>
              <ul className="space-y-2">
                {analysis.questions?.map((question: string, idx: number) => (
                  <li key={idx} className="text-sm text-dark-700 dark:text-dark-300 flex items-start gap-2">
                    <span className="text-accent mt-1">?</span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Связанные идеи (для заметок) */}
          {(analysis.related_ideas?.length ?? 0) > 0 && (
            <div className="bg-accent-subtle border border-accent-dim rounded-lg p-4">
              <h3 className="font-semibold text-accent mb-3 flex items-center gap-2">
                <Brain size={18} className="text-accent" />
                С чем можно связать
              </h3>
              <ul className="space-y-2">
                {analysis.related_ideas?.map((idea: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 group">
                    <span className="text-accent mt-1 shrink-0">→</span>
                    <span className="text-sm text-dark-700 dark:text-dark-300 flex-1 min-w-0">{idea}</span>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => copyText(idea, 'идея')} className="p-1.5 hover:bg-accent-subtle rounded" title="Копировать" aria-label="Копировать идею">
                        <Copy size={14} className="text-accent" />
                      </button>
                      {universeId && (
                        <button type="button" onClick={() => addToDraft('Связь: ' + idea.slice(0, 50) + (idea.length > 50 ? '…' : ''), idea)} disabled={addToDraftMutation.isPending} className="p-1.5 hover:bg-accent-subtle rounded" title="В черновик" aria-label="Добавить в черновик">
                          <FilePen size={14} className="text-accent" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Противоречия (для анализа вселенной) */}
          {(analysis.contradictions?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-semibold text-accent mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-accent" />
                Противоречия ({(analysis.contradictions?.length ?? 0)})
              </h3>
              <div className="space-y-2">
                {analysis.contradictions?.map((contradiction: AIContradiction, idx: number) => (
                  <div key={idx} className="bg-accent-subtle border border-accent-dim rounded-lg p-3">
                    <span className="text-xs text-accent uppercase font-medium">{contradiction.type ?? contradiction.field}</span>
                    <p className="text-sm text-dark-700 dark:text-dark-300 mt-1">{contradiction.description ?? [contradiction.value1, contradiction.value2].filter(Boolean).join(' vs ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
