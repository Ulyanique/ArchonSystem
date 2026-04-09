import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Иконка (компонент Lucide) */
  icon: LucideIcon;
  /** Заголовок */
  title: string;
  /** Описание под заголовком */
  description?: string;
  /** Текст кнопки; при переданном onClick показывается кнопка */
  actionLabel?: string;
  /** Обработчик кнопки */
  onAction?: () => void;
  /** Вариант для тёмного фона (светлый текст) */
  variant?: 'default' | 'onDark';
  className?: string;
}

/** Единый блок пустого состояния: иконка, заголовок, описание, опциональная кнопка */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const isOnDark = variant === 'onDark';
  const wrap = isOnDark ? 'text-white/70' : 'text-dark-500 dark:text-dark-400';
  const iconCls = isOnDark ? 'text-white/50' : 'text-dark-300 dark:text-dark-500';
  const titleCls = isOnDark ? 'text-white' : 'text-dark-700 dark:text-dark-200';
  const descCls = isOnDark ? 'text-white/70' : '';
  const btnCls = isOnDark
    ? 'mt-4 px-4 py-2 rounded-lg border border-white/40 bg-white/10 text-white hover:bg-white/20 transition-colors'
    : 'mt-4 btn btn-primary';

  return (
    <div
      className={`text-center py-12 px-4 ${wrap} ${className}`}
      role="status"
      aria-label={title}
    >
      <Icon size={64} className={`mx-auto mb-4 ${iconCls}`} aria-hidden />
      <p className={`text-lg font-medium ${titleCls}`}>{title}</p>
      {description && (
        <p className={`text-sm mt-2 max-w-md mx-auto ${descCls}`}>{description}</p>
      )}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className={btnCls}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
