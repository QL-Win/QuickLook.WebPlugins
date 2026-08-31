/**
 * Convert reStructuredText source to HTML using rst-compiler.
 */

import { RstToHtmlCompiler, type RstDirective, type RstDocument } from 'rst-compiler';
import { installBaseFallbacks, registerDocumentFallbacks } from './fallback-plugin.js';
import { extractToc } from './toc.js';
import type { ConvertedDocument } from './types.js';

const compiler = new RstToHtmlCompiler();
installBaseFallbacks(compiler);

/** Collect language hints from code / code-block directives (document order). */
function collectCodeLanguages(root: RstDocument): string[] {
  const langs: string[] = [];
  for (const node of root.findAllChildren('Directive')) {
    const directive = node as RstDirective;
    const name = directive.directive.toLowerCase();
    if (name === 'code' || name === 'code-block' || name === 'sourcecode') {
      langs.push((directive.initContentText || '').trim().toLowerCase());
    }
  }
  return langs;
}

/**
 * Wrap `<pre class="code">` blocks so highlight.js can style them,
 * attaching language classes from matching directives when available.
 * Literal blocks (also `pre.code`) are wrapped without a language class.
 */
function enhanceCodeBlocks(bodyHtml: string, languages: string[]): string {
  if (typeof DOMParser === 'undefined') {
    return bodyHtml;
  }

  const doc = new DOMParser().parseFromString(`<body>${bodyHtml}</body>`, 'text/html');
  let i = 0;

  for (const pre of Array.from(doc.body.querySelectorAll('pre.code'))) {
    const codeEl = doc.createElement('code');
    codeEl.className = 'hljs';
    codeEl.innerHTML = pre.innerHTML;

    if (!pre.closest('.literal-block')) {
      const lang = (languages[i++] || '').replace(/[^a-z0-9_+-]/gi, '');
      if (lang) codeEl.classList.add(`language-${lang}`);
    }

    pre.classList.add('highlight');
    pre.replaceChildren(codeEl);
  }

  return doc.body.innerHTML;
}

/**
 * rst-compiler only handles Unix newlines. Windows CRLF / old Mac CR, or a
 * host that collapses newlines to spaces, will turn the whole document into
 * one paragraph (section underlines and `..` markup appear as literal text).
 */
export function normalizeRstSource(source: string): string {
  let text = source;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const newlineCount = (text.match(/\n/g) || []).length;
  const looksCollapsed =
    newlineCount < Math.max(3, Math.floor(text.length / 400)) &&
    /(?:\s[=\-`:.'"~^\*_+#]{4,}|\.\.\s+_|\.\.\s+[\w:-]+::)/.test(text);

  if (looksCollapsed) {
    text = recoverCollapsedRst(text);
  }

  return text;
}

/**
 * Best-effort restore of RST structure when a host flattened the file to one line.
 * Not perfect, but recovers headings / lists / literal blocks for common docs.
 */
function recoverCollapsedRst(text: string): string {
  let s = text.trim().replace(/[ \t]+/g, ' ');

  // Explicit targets: ".. _name: Title" → ".. _name:\n\nTitle"
  s = s.replace(/(\.\.\s+_[A-Za-z0-9_.:-]+:)\s+(?=\S)/g, '$1\n\n');

  // Block directives boundaries
  s = s.replace(/\s+(\.\.\s+[\w:-]+::)/g, '\n\n$1');

  // Section underlines: "Title ======" → "Title\n======" (same underline char ×3+)
  s = s.replace(
    /([^\n]+?) +(([=\-`:.'"~^\*_+#])\3{2,})(?=(?:\s|$))/g,
    (_m, title: string, underline: string) => `${String(title).trimEnd()}\n${underline}`,
  );

  // After underline, start a new block
  s = s.replace(/([=\-`:.'"~^\*_+#]{3,}) +(?=\S)/g, '$1\n\n');

  // "……。 短标题\n-----" → break section title onto its own line
  // Title segment must be short and must not itself contain sentence punctuation.
  s = s.replace(
    /([；。！？])\s*([^\n；。！？]{1,30})\n([=\-`:.'"~^\*_+#]{3,})/g,
    '$1\n\n$2\n$3',
  );

  // Bullet list items
  s = s.replace(/\s+(- (?=\S))/g, '\n$1');
  // Blank line before a list that follows a paragraph
  s = s.replace(/([^\n])\n(-\s+)/g, '$1\n\n$2');

  // Literal block marker
  s = s.replace(/:: +/g, '::\n\n    ');

  // After an indented shell example, break before following CJK prose
  s = s.replace(/(^|\n)(    \$[^\n]+?) +(?=[\u4e00-\u9fff])/gm, '$1$2\n\n');

  return s;
}

/**
 * Load and convert reStructuredText into HTML + TOC metadata.
 */
export async function convertRst(source: string): Promise<ConvertedDocument> {
  let normalized = normalizeRstSource(source);
  // "……：\n::" (CJK colon then literal-block marker) confuses section detection in rst-compiler
  normalized = normalized.replace(/：[ \t]*\n::/g, '：\n\n::');
  const parserOutput = compiler.parse(normalized);
  // Sphinx docs often use roles/directives rst-compiler does not implement
  // (e.g. :command:). Register per-document fallbacks before generate.
  registerDocumentFallbacks(compiler, parserOutput.root);
  const generated = compiler.compile(parserOutput);

  const toc = extractToc(parserOutput.root, parserOutput.htmlAttrResolver);
  const languages = collectCodeLanguages(parserOutput.root);
  const body = enhanceCodeBlocks(String(generated.body || ''), languages);

  const title =
    toc.entries.find((e) => e.name)?.name ||
    parserOutput.root.children.find((c) => c.nodeType === 'Section')?.textContent ||
    '';

  return {
    title: title || '',
    html: body,
    header: String(generated.header || ''),
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
