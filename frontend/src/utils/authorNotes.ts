/**
 * Комментарии автора в тексте: %% ... %%.
 * Видны только ИИ; в превью и экспорте удаляются (экспорт делает backend).
 */
const AUTHOR_NOTE_REGEX = /%%[\s\S]*?%%/g;

export function stripAuthorNotes(text: string): string {
  if (!text) return text;
  const cleaned = text.replace(AUTHOR_NOTE_REGEX, '').replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

export type ContentSegment = { type: 'text'; value: string } | { type: 'comment'; value: string };

/** Разбить content на сегменты: текст и комментарии %% ... %%. */
export function parseContentSegments(content: string): ContentSegment[] {
  if (!content) return [{ type: 'text', value: '' }];
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  const re = /%%([\s\S]*?)%%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, m.index) });
    }
    segments.push({ type: 'comment', value: m[1] ?? '' });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  if (segments.length === 0) segments.push({ type: 'text', value: content });
  return segments;
}

/** Собрать сегменты обратно в content. */
export function serializeContentSegments(segments: ContentSegment[]): string {
  return segments
    .map((s) => (s.type === 'comment' ? `%%${s.value}%%` : s.value))
    .join('');
}
