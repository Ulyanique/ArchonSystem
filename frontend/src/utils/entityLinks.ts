/**
 * Внедряет в текст markdown-ссылки на персонажей и локации по упоминанию имени.
 * Не трогает текст внутри уже существующих ссылок [...](...).
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Граница слова: не внутри другого слова (поддержка кириллицы и латиницы) */
function wordBoundaryRegex(name: string): RegExp {
  const escaped = escapeRegex(name);
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escaped})(?=[^\\p{L}\\p{N}_]|$)`,
    'gu'
  );
}

/**
 * Заменяет в plain-тексте (без markdown-ссылок) упоминания имён на ссылки.
 * Имена сортируются по длине по убыванию, чтобы длинные совпадали первыми.
 */
function injectInPlainText(
  plain: string,
  entities: { name: string; url: string }[]
): string {
  if (!entities.length) return plain;
  const byLength = [...entities].sort((a, b) => b.name.length - a.name.length);
  let result = plain;
  for (const { name, url } of byLength) {
    if (!name.trim()) continue;
    const re = wordBoundaryRegex(name);
    const markdownLink = `[${name}](${url})`;
    result = result.replace(re, `$1${markdownLink}`);
  }
  return result;
}

export interface EntityLinkInput {
  characters: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  universeId: number;
}

/**
 * Обрабатывает markdown-контент: разбивает по существующим ссылкам [...](...),
 * в «обычном» тексте заменяет упоминания имён персонажей и локаций на ссылки
 * на страницы персонажа/локации.
 */
export function injectEntityLinks(
  content: string,
  { characters, locations, universeId }: EntityLinkInput
): string {
  if (!content || !universeId) return content;

  const entities: { name: string; url: string }[] = [];
  const seenNames = new Set<string>();

  for (const c of characters) {
    const name = (c.name || '').trim();
    if (name && !seenNames.has(name)) {
      seenNames.add(name);
      entities.push({ name, url: `/universes/${universeId}/characters/${c.id}` });
    }
  }
  for (const l of locations) {
    const name = (l.name || '').trim();
    if (name && !seenNames.has(name)) {
      seenNames.add(name);
      entities.push({ name, url: `/universes/${universeId}/locations/${l.id}` });
    }
  }

  if (!entities.length) return content;

  const linkPattern = /\[[^\]]*\]\([^)]*\)/g;
  const parts = content.split(linkPattern);
  const links = content.match(linkPattern) || [];

  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(injectInPlainText(parts[i], entities));
    if (i < links.length) out.push(links[i]);
  }
  return out.join('');
}
