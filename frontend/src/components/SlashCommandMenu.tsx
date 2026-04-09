import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';

export type SlashCommandItem = {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: React.ReactNode;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  anchorEl: HTMLElement | null;
  commands: SlashCommandItem[];
  onClose: () => void;
};

export function SlashCommandMenu({ open, anchorEl, commands, onClose }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (anchorEl && !anchorEl.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorEl]);

  useEffect(() => {
    if (open && listRef.current) {
      const first = listRef.current.querySelector<HTMLButtonElement>('[data-command-item]');
      first?.focus();
    }
  }, [open]);

  if (!open || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const categories = Array.from(new Set(commands.map((c) => c.category)));

  const content = (
    <div
      ref={listRef}
      className="fixed z-[100] min-w-[280px] max-w-[360px] rounded-xl border border-dark-200 bg-white dark:bg-dark-800 shadow-xl py-2 max-h-[70vh] overflow-y-auto"
      style={{
        left: rect.left,
        top: rect.bottom + 4,
      }}
      role="listbox"
    >
      {categories.map((cat) => (
        <div key={cat} className="px-3 py-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-1">
            {cat}
          </div>
          <div className="space-y-0.5">
            {commands
              .filter((c) => c.category === cat)
              .map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  data-command-item
                  onClick={() => {
                    cmd.onSelect();
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      cmd.onSelect();
                      onClose();
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 flex items-start gap-3 transition-colors"
                >
                  <span className="text-dark-500 dark:text-dark-400 shrink-0 mt-0.5">
                    {cmd.icon ?? <FileText size={16} />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-dark-800 dark:text-dark-200 text-sm">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">{cmd.description}</div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
