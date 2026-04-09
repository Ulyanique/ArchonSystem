import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { parseContentSegments, serializeContentSegments, type ContentSegment } from '../utils/authorNotes';

const SAVE_DEBOUNCE_MS = 400;

export type ContentWithInlineCommentsHandle = {
  insertAtCursor: (text: string) => void;
};

type Props = {
  content: string;
  onSave: (content: string) => void;
  placeholder?: string;
  className?: string;
  showCommentBlocks: boolean;
  readOnly?: boolean;
  /** При нажатии "/" открыть меню команд (как в Novelcrafter). Передаётся элемент ввода для позиционирования. */
  onSlashCommand?: (target: HTMLElement) => void;
};

export const ContentWithInlineComments = forwardRef<ContentWithInlineCommentsHandle, Props>(function ContentWithInlineComments(
  {
    content,
    onSave,
    placeholder,
    className = '',
    showCommentBlocks,
    readOnly,
    onSlashCommand,
  },
  ref
) {
  const [segments, setSegments] = useState<ContentSegment[]>(() => parseContentSegments(content));
  const [localContent, setLocalContent] = useState(content);
  const lastSavedRef = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedSegmentRef = useRef<{ index: number; el: HTMLTextAreaElement | HTMLInputElement } | null>(null);

  useEffect(() => {
    if (content !== lastSavedRef.current) {
      setSegments(parseContentSegments(content));
      setLocalContent(content);
      lastSavedRef.current = content;
    }
  }, [content]);

  const scheduleSave = useCallback(
    (newSegments: ContentSegment[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const serialized = serializeContentSegments(newSegments);
        lastSavedRef.current = serialized;
        onSave(serialized);
      }, SAVE_DEBOUNCE_MS);
    },
    [onSave]
  );

  const updateSegment = useCallback(
    (index: number, value: string, isComment: boolean) => {
      setSegments((prev) => {
        const next = [...prev];
        if (isComment) next[index] = { type: 'comment', value };
        else next[index] = { type: 'text', value };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const triggerSave = useCallback(
    (newContent: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        lastSavedRef.current = newContent;
        onSave(newContent);
      }, SAVE_DEBOUNCE_MS);
    },
    [onSave]
  );

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      if (!showCommentBlocks && textareaRef.current) {
        const el = textareaRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const v = localContent;
        const newVal = v.slice(0, start) + text + v.slice(end);
        setLocalContent(newVal);
        triggerSave(newVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + text.length;
          el.focus();
        }, 0);
        return;
      }
      const foc = focusedSegmentRef.current;
      if (foc) {
        const el = foc.el;
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? start;
        const currentVal = 'value' in el ? String((el as HTMLInputElement).value) : '';
        const newVal = currentVal.slice(0, start) + text + currentVal.slice(end);
        updateSegment(foc.index, newVal, segments[foc.index]?.type === 'comment');
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + text.length;
          el.focus();
        }, 0);
      } else if (segments.length > 0) {
        const firstText = segments.findIndex((s) => s.type === 'text');
        if (firstText >= 0) {
          const seg = segments[firstText] as { type: 'text'; value: string };
          updateSegment(firstText, seg.value + text, false);
        }
      }
    },
  }), [showCommentBlocks, localContent, segments, triggerSave, updateSegment]);

  const handleSlashKey = useCallback(
    (e: React.KeyboardEvent, target: HTMLElement) => {
      if (e.key === '/' && !readOnly) {
        e.preventDefault();
        onSlashCommand?.(target);
      }
    },
    [readOnly, onSlashCommand]
  );

  if (!showCommentBlocks) {
    return (
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={(e) => {
          const v = e.target.value;
          setLocalContent(v);
          triggerSave(v);
        }}
        onKeyDown={(e) => handleSlashKey(e, e.currentTarget)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={className}
        spellCheck={false}
        rows={3}
      />
    );
  }

  return (
    <div className={`${className} flex flex-wrap gap-y-1 gap-x-1 items-start`}>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <textarea
            key={i}
            value={seg.value}
            onChange={(e) => updateSegment(i, e.target.value, false)}
            onFocus={(e) => { focusedSegmentRef.current = { index: i, el: e.currentTarget }; }}
            onBlur={() => { if (focusedSegmentRef.current?.index === i) focusedSegmentRef.current = null; }}
            onKeyDown={(e) => handleSlashKey(e, e.currentTarget)}
            readOnly={readOnly}
            placeholder={i === 0 ? placeholder : ''}
            className="flex-1 min-w-[140px] text-sm font-mono border-0 bg-transparent resize-none overflow-hidden py-0.5 px-0 focus:ring-0 focus:outline-none min-h-[1.5em]"
            spellCheck={false}
            rows={Math.max(1, (seg.value.match(/\n/g)?.length ?? 0) + 1)}
          />
        ) : (
          <span
            key={i}
            className="inline-flex items-center rounded-md border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-500 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-200 shrink-0"
            title="Комментарий автора (только для ИИ)"
          >
            <input
              type="text"
              value={seg.value}
              onChange={(e) => updateSegment(i, e.target.value, true)}
              onFocus={(e) => { focusedSegmentRef.current = { index: i, el: e.currentTarget }; }}
              onBlur={() => { if (focusedSegmentRef.current?.index === i) focusedSegmentRef.current = null; }}
              onKeyDown={(e) => handleSlashKey(e, e.currentTarget)}
              readOnly={readOnly}
              className="bg-transparent border-0 min-w-[60px] max-w-[220px] text-current focus:ring-0 focus:outline-none py-0"
              placeholder="…"
            />
          </span>
        )
      )}
    </div>
  );
});
