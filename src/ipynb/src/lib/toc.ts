/**
 * Build a TOC tree from markdown heading entries (flat → nested by level).
 */

import type { IpynbToc, IpynbTocEntry } from './types.js';

export interface HeadingEntry {
  level: number;
  text: string;
  id: string;
}

export function buildTocFromHeadings(headings: HeadingEntry[]): IpynbToc {
  const root: IpynbTocEntry[] = [];
  const stack: { level: number; entry: IpynbTocEntry }[] = [];

  for (const h of headings) {
    const entry: IpynbTocEntry = {
      name: h.text,
      id: h.id,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].entry.children.push(entry);
    }

    stack.push({ level: h.level, entry });
  }

  return { entries: root };
}

/** Generate a URL-safe slug; ensures uniqueness with a used-set. */
export function uniqueSlug(text: string, used: Set<string>): string {
  let base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) base = 'section';

  let slug = base;
  let n = 1;
  while (used.has(slug)) {
    slug = `${base}-${n++}`;
  }
  used.add(slug);
  return slug;
}
