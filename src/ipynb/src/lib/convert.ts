/**
 * Convert Jupyter Notebook (.ipynb) JSON to standalone HTML + TOC.
 */

import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import { marked, type Tokens } from 'marked';
import markedKatex from 'marked-katex-extension';
import { NOTEBOOK_CSS } from './notebook-css.js';
import { buildTocFromHeadings, uniqueSlug, type HeadingEntry } from './toc.js';
import type { ConvertedDocument } from './types.js';

// ─── Notebook JSON shapes (subset of nbformat v4) ────────────────────────────

type Multiline = string | string[];

interface NotebookCell {
  cell_type: 'markdown' | 'code' | 'raw' | string;
  source: Multiline;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

interface NotebookOutput {
  output_type: string;
  name?: string;
  text?: Multiline;
  data?: Record<string, Multiline>;
  metadata?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  execution_count?: number | null;
}

interface NotebookDocument {
  nbformat?: number;
  nbformat_minor?: number;
  metadata?: {
    kernelspec?: { display_name?: string; language?: string; name?: string };
    language_info?: { name?: string; version?: string };
    title?: string;
    [key: string]: unknown;
  };
  cells: NotebookCell[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function joinSource(source: Multiline | undefined): string {
  if (source == null) return '';
  return Array.isArray(source) ? source.join('') : String(source);
}

/** Decode UTF-8 text from an ArrayBuffer (BOM-aware). */
export function decodeUtf8(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const start =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return new TextDecoder('utf-8').decode(bytes.subarray(start));
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip ANSI CSI / OSC sequences from traceback / stream text. */
export function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b[@-Z\\-_]/g, '');
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'],
  });
}

function guessLanguage(notebook: NotebookDocument): string {
  const li = notebook.metadata?.language_info?.name;
  if (li) return normalizeLang(li);
  const ks = notebook.metadata?.kernelspec?.language;
  if (ks) return normalizeLang(ks);
  return 'python';
}

function normalizeLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === 'ipython' || l === 'python3' || l === 'python2') return 'python';
  if (l === 'javascript' || l === 'js' || l === 'node') return 'javascript';
  if (l === 'typescript' || l === 'ts') return 'typescript';
  if (l === 'c++' || l === 'cpp') return 'cpp';
  if (l === 'c#') return 'csharp';
  if (l === 'r') return 'r';
  if (l === 'julia' || l === 'jl') return 'julia';
  if (l === 'bash' || l === 'shell' || l === 'sh') return 'bash';
  return l;
}

function highlightCode(code: string, language: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function mimePreferred(
  data: Record<string, Multiline>,
  prefs: string[],
): { mime: string; value: string } | null {
  for (const mime of prefs) {
    if (data[mime] != null) {
      return { mime, value: joinSource(data[mime]) };
    }
  }
  // Fallback: first available
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  return { mime: keys[0], value: joinSource(data[keys[0]]) };
}

// ─── Markdown (with KaTeX + heading ids) ─────────────────────────────────────

let katexExtensionRegistered = false;

function ensureKatexExtension(): void {
  if (katexExtensionRegistered) return;
  marked.use(
    markedKatex({
      throwOnError: false,
      nonStandard: true,
      output: 'html',
    }),
  );
  katexExtensionRegistered = true;
}

function createMarkdownRenderer(usedSlugs: Set<string>, headings: HeadingEntry[]) {
  ensureKatexExtension();

  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }: Tokens.Heading): string {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, '').trim();
    const id = uniqueSlug(plain || 'section', usedSlugs);
    headings.push({ level: depth, text: plain || 'section', id });
    return `<h${depth} id="${escapeHtml(id)}">${text}</h${depth}>\n`;
  };

  renderer.code = function ({ text, lang }: Tokens.Code): string {
    const language = lang ? normalizeLang(lang) : '';
    const highlighted = highlightCode(text, language);
    const cls = language ? `language-${escapeHtml(language)} hljs` : 'hljs';
    return `<pre><code class="${cls}">${highlighted}</code></pre>\n`;
  };

  return {
    render(source: string): string {
      return String(
        marked.parse(source, {
          gfm: true,
          breaks: false,
          renderer,
        }),
      );
    },
  };
}

// ─── Cell / output rendering ─────────────────────────────────────────────────

function renderPrompt(kind: 'in' | 'out' | 'none', count: number | null | undefined): string {
  if (kind === 'none') return `<div class="nb-prompt"></div>`;
  const label = kind === 'in' ? 'In' : 'Out';
  const n = count == null ? ' ' : String(count);
  return `<div class="nb-prompt">${label}&nbsp;[${escapeHtml(n)}]:</div>`;
}

function renderMarkdownCell(source: string, md: ReturnType<typeof createMarkdownRenderer>, cellId: string): string {
  const html = sanitizeHtml(md.render(source));
  return `
<article class="nb-cell nb-cell-markdown" id="${escapeHtml(cellId)}">
  ${renderPrompt('none', null)}
  <div class="nb-cell-body"><div class="nb-markdown">${html}</div></div>
</article>`;
}

function renderRawCell(source: string, cellId: string): string {
  return `
<article class="nb-cell nb-cell-raw" id="${escapeHtml(cellId)}">
  ${renderPrompt('none', null)}
  <div class="nb-cell-body"><pre class="nb-raw">${escapeHtml(source)}</pre></div>
</article>`;
}

function renderDisplayData(data: Record<string, Multiline>): string {
  const pick = mimePreferred(data, [
    'text/html',
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/json',
    'text/markdown',
    'text/latex',
    'text/plain',
  ]);
  if (!pick) return '';

  const { mime, value } = pick;

  if (mime === 'text/html') {
    return `<div class="nb-html-output">${sanitizeHtml(value)}</div>`;
  }
  if (mime === 'image/svg+xml') {
    return `<div class="nb-image-output">${sanitizeHtml(value)}</div>`;
  }
  if (mime.startsWith('image/')) {
    const src = value.startsWith('data:') ? value : `data:${mime};base64,${value.replace(/\s+/g, '')}`;
    return `<div class="nb-image-output"><img src="${escapeHtml(src)}" alt="output" /></div>`;
  }
  if (mime === 'application/json') {
    let pretty = value;
    try {
      pretty = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      /* keep raw */
    }
    return `<pre class="nb-json">${escapeHtml(pretty)}</pre>`;
  }
  if (mime === 'text/markdown') {
    // Lightweight: escape + preserve newlines via <pre> to avoid nested marked state
    return `<pre class="nb-text">${escapeHtml(value)}</pre>`;
  }
  if (mime === 'text/latex') {
    try {
      const html = katex.renderToString(value, { throwOnError: false, displayMode: true });
      return `<div class="nb-html-output">${html}</div>`;
    } catch {
      return `<pre class="nb-text">${escapeHtml(value)}</pre>`;
    }
  }
  return `<pre class="nb-text">${escapeHtml(stripAnsi(value))}</pre>`;
}

function renderOutput(output: NotebookOutput, showOutPrompt: boolean): string {
  const prompt =
    showOutPrompt && (output.output_type === 'execute_result' || output.output_type === 'display_data')
      ? renderPrompt('out', output.execution_count ?? null)
      : `<div class="nb-prompt"></div>`;

  let body = '';

  if (output.output_type === 'stream') {
    const text = stripAnsi(joinSource(output.text));
    const cls = output.name === 'stderr' ? 'nb-stream nb-stream-stderr' : 'nb-stream';
    body = `<pre class="${cls}">${escapeHtml(text)}</pre>`;
  } else if (output.output_type === 'error') {
    const lines = (output.traceback || [])
      .map((line) => escapeHtml(stripAnsi(line)))
      .join('\n');
    const fallback = escapeHtml(
      stripAnsi(`${output.ename || 'Error'}: ${output.evalue || ''}`),
    );
    body = `<pre class="nb-error">${lines || fallback}</pre>`;
  } else if (
    output.output_type === 'execute_result' ||
    output.output_type === 'display_data' ||
    output.output_type === 'update_display_data'
  ) {
    body = renderDisplayData(output.data || {});
  }

  if (!body) return '';

  return `
<div class="nb-output">
  ${prompt}
  <div class="nb-output-body">${body}</div>
</div>`;
}

function renderCodeCell(cell: NotebookCell, language: string, cellId: string): string {
  const source = joinSource(cell.source);
  const highlighted = highlightCode(source, language);
  const count = cell.execution_count ?? null;

  const outputs = cell.outputs || [];
  let firstResultPromptShown = false;
  const outputHtml = outputs
    .map((o) => {
      const isResult = o.output_type === 'execute_result';
      const showPrompt = isResult && !firstResultPromptShown;
      if (showPrompt) firstResultPromptShown = true;
      // display_data typically has blank prompt in classic notebook
      return renderOutput(o, showPrompt || (isResult && o.execution_count != null));
    })
    .join('');

  return `
<article class="nb-cell nb-cell-code" id="${escapeHtml(cellId)}">
  ${renderPrompt('in', count)}
  <div class="nb-cell-body">
    <div class="nb-code-input"><pre><code class="language-${escapeHtml(language)} hljs">${highlighted}</code></pre></div>
    ${outputHtml ? `<div class="nb-outputs">${outputHtml}</div>` : ''}
  </div>
</article>`;
}

// ─── Title extraction ────────────────────────────────────────────────────────

function extractTitle(notebook: NotebookDocument, headings: HeadingEntry[], fallbackName: string): string {
  const metaTitle = notebook.metadata?.title;
  if (typeof metaTitle === 'string' && metaTitle.trim()) return metaTitle.trim();

  const firstH1 = headings.find((h) => h.level === 1);
  if (firstH1) return firstH1.text;

  if (headings.length > 0) return headings[0].text;

  return fallbackName.replace(/\.ipynb$/i, '') || 'Notebook';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse and convert notebook source (JSON string or already-parsed object).
 */
export async function convertIpynb(
  source: string | object,
  options?: { name?: string },
): Promise<ConvertedDocument> {
  let notebook: NotebookDocument;
  try {
    notebook = typeof source === 'string' ? (JSON.parse(source) as NotebookDocument) : (source as NotebookDocument);
  } catch (err) {
    throw new Error(`Invalid notebook JSON: ${String(err)}`);
  }

  if (!notebook || !Array.isArray(notebook.cells)) {
    throw new Error('Not a valid Jupyter notebook (missing cells array)');
  }

  const language = guessLanguage(notebook);
  const usedSlugs = new Set<string>();
  const headings: HeadingEntry[] = [];
  const md = createMarkdownRenderer(usedSlugs, headings);

  const parts: string[] = [];
  notebook.cells.forEach((cell, index) => {
    const cellId = `cell-${index}`;
    usedSlugs.add(cellId);
    const src = joinSource(cell.source);
    if (cell.cell_type === 'markdown') {
      parts.push(renderMarkdownCell(src, md, cellId));
    } else if (cell.cell_type === 'code') {
      parts.push(renderCodeCell(cell, language, cellId));
    } else if (cell.cell_type === 'raw') {
      parts.push(renderRawCell(src, cellId));
    }
  });

  const body =
    parts.length > 0
      ? parts.join('\n')
      : `<p class="nb-empty">This notebook has no cells.</p>`;

  const title = extractTitle(notebook, headings, options?.name || 'Notebook');
  const toc = buildTocFromHeadings(headings);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
${NOTEBOOK_CSS}
</style>
</head>
<body>
<div id="content" class="ipynb-notebook">
${body}
</div>
</body>
</html>`;

  return { title, html, toc };
}
