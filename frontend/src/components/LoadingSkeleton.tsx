interface LoadingSkeletonProps {
  /** Количество строк/карточек */
  lines?: number;
  /** Вариант: строка, карточка, список */
  variant?: 'text' | 'card' | 'list';
  className?: string;
}

/** Скелетон загрузки с анимацией pulse */
export default function LoadingSkeleton({ lines = 3, variant = 'text', className = '' }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={`flex gap-4 flex-wrap ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-w-[200px] w-full max-w-[340px] rounded-xl border border-dark-200 dark:border-dark-600 p-6 animate-pulse"
          >
            <div className="h-6 bg-dark-200 dark:bg-dark-600 rounded w-3/4 mb-4" />
            <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-full mb-2" />
            <div className="h-4 bg-dark-100 dark:bg-dark-700 rounded w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center animate-pulse">
            <div className="h-10 w-10 rounded bg-dark-200 dark:bg-dark-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-dark-200 dark:bg-dark-600 rounded w-1/3 mb-2" />
              <div className="h-3 bg-dark-100 dark:bg-dark-700 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-dark-200 dark:bg-dark-600 rounded animate-pulse"
          style={{ width: i === lines - 1 && lines > 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
}
