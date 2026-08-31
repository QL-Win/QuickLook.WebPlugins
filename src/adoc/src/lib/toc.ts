/**
 * Extract a TOC tree from an Asciidoctor Document via getSections().
 */

import type { AdocToc, AdocTocEntry } from './types.js';

/** Minimal structural surface we need from Asciidoctor Section / Document. */
export interface SectionLike {
  getId(): string | undefined;
  getTitle(): string | null | undefined;
  getCaptionedTitle?(): string;
  getSections(): SectionLike[];
}

function sectionTitle(section: SectionLike): string {
  if (typeof section.getCaptionedTitle === 'function') {
    const captioned = section.getCaptionedTitle();
    if (captioned) return captioned;
  }
  return section.getTitle() || '(Untitled)';
}

function mapSection(section: SectionLike): AdocTocEntry {
  return {
    name: sectionTitle(section),
    id: section.getId() || '',
    children: (section.getSections() || []).map(mapSection),
  };
}

export function extractToc(doc: SectionLike): AdocToc {
  const sections = doc.getSections() || [];
  return { entries: sections.map(mapSection) };
}
