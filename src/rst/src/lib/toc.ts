/**
 * Extract a nested TOC tree from rst-compiler section nodes.
 */

import type { RstSection } from 'rst-compiler';
import type { HtmlAttrResolver } from 'rst-compiler';
import type { RstToc, RstTocEntry } from './types.js';

export interface DocumentLike {
  children: ReadonlyArray<{ nodeType: string; textContent: string }>;
}

/** Nest flat section list by heading level into a TOC tree. */
export function buildTocFromSections(
  sections: ReadonlyArray<{ name: string; id: string; level: number }>,
): RstToc {
  const root: RstTocEntry[] = [];
  const stack: Array<{ entry: RstTocEntry; level: number }> = [];

  for (const section of sections) {
    const entry: RstTocEntry = {
      name: section.name || '(Untitled)',
      id: section.id,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].entry.children.push(entry);
    }

    stack.push({ entry, level: section.level });
  }

  return { entries: root };
}

export function extractToc(
  root: DocumentLike,
  htmlAttrResolver: Pick<HtmlAttrResolver, 'getNodeHtmlId'>,
): RstToc {
  const sections: Array<{ name: string; id: string; level: number }> = [];

  for (const child of root.children) {
    if (child.nodeType !== 'Section') continue;
    const section = child as RstSection;
    const id = htmlAttrResolver.getNodeHtmlId(section) || '';
    sections.push({
      name: (section.textContent || '(Untitled)').replace(/[ \t]+$/g, ''),
      id,
      level: section.level,
    });
  }

  return buildTocFromSections(sections);
}
