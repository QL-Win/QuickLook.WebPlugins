/**
 * Convert AsciiDoc source to HTML using Asciidoctor.js.
 */

import { load } from '@asciidoctor/core';
import { extractToc } from './toc.js';
import type { ConvertedDocument } from './types.js';

const CONVERT_ATTRIBUTES: Record<string, string | number | boolean | null> = {
  showtitle: true,
  sectanchors: true,
  // Sidebar TOC replaces the in-document TOC
  toc: null,
  // Avoid Font Awesome / image icon deps in the browser viewer
  icons: null,
  // Emit highlight.js markup; we run hljs client-side (no CDN)
  'source-highlighter': 'highlight.js',
};

/**
 * Load and convert AsciiDoc text into standalone HTML + TOC metadata.
 */
export async function convertAdoc(
  source: string,
  options?: { baseDir?: string },
): Promise<ConvertedDocument> {
  const loadOpts: Record<string, unknown> = {
    safe: 'safe',
    standalone: true,
    attributes: { ...CONVERT_ATTRIBUTES },
  };
  if (options?.baseDir) {
    loadOpts.base_dir = options.baseDir;
  }

  const doc = await load(source, loadOpts);
  const titleRaw = doc.getDocumentTitle();
  const title =
    typeof titleRaw === 'string'
      ? titleRaw
      : titleRaw && typeof (titleRaw as { getCombined?: () => string }).getCombined === 'function'
        ? (titleRaw as { getCombined: () => string }).getCombined()
        : '';

  const toc = extractToc(doc);
  const html = String(await doc.convert());

  return {
    title: title || '',
    html,
    toc,
  };
}

/** Decode UTF-8 text from an ArrayBuffer (BOM-aware). */
export function decodeUtf8(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Strip UTF-8 BOM
  const start =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return new TextDecoder('utf-8').decode(bytes.subarray(start));
}
