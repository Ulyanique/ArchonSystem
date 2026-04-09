/**
 * Автоподстановка ссылок на сущности в тексте (как в Novelcrafter).
 * Упоминания имён из списка превращаются в markdown-ссылки [имя](url).
 * Совпадения по границам слов; более длинные имена обрабатываются первыми.
 */

export interface EntityLink {
  name: string;
  url: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Граница слова: начало строки, пробел, знак препинания или конец строки.
 * Для кириллицы и латиницы не разбиваем внутри слова.
 */
function wordBoundaryRegex(name: string): RegExp {
  const escaped = escapeRegex(name);
  return new RegExp(
    `(^|[\\s\\.,;:!?»«—–"'\\[\\]()])(${escaped})([\\s\\.,;:!?»«—–"'\\[\\]()]|$)`,
    'gu'
  );
}

const LINK_PLACEHOLDER = '\u0000AL\u0000';

/**
 * Заменяет в тексте упоминания имён из entities на markdown-ссылки [имя](url).
 * Не трогает вхождения внутри существующих markdown-ссылок [...](...).
 * Более длинные имена обрабатываются первыми.
 */
export function autolinkEntityNames(text: string, entities: EntityLink[]): string {
  if (!text || entities.length === 0) return text;

  const savedLinks: string[] = [];
  let result = text.replace(/\[([^\]]*)\]\((#[^)]*|[^)]+)\)/g, (_, content, url) => {
    savedLinks.push(`[${content}](${url})`);
    return LINK_PLACEHOLDER;
  });

  const sorted = [...entities].filter((e) => e.name && e.name.trim()).sort((a, b) => b.name.length - a.name.length);

  for (const { name, url } of sorted) {
    const re = wordBoundaryRegex(name);
    result = result.replace(re, (_, before, match, after) => {
      return `${before}[${match}](${url})${after}`;
    });
  }

  for (const link of savedLinks) {
    result = result.replace(LINK_PLACEHOLDER, link);
  }
  return result;
}
