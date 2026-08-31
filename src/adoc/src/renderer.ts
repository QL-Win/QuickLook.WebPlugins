/**
 * AsciiDoc content renderer for the browser.
 *
 * Takes standalone HTML from Asciidoctor, extracts embedded styles + body,
 * and renders into a Shadow DOM so document CSS cannot leak into the shell.
 */

import hljs from 'highlight.js/lib/common';
import { hljsThemeCss } from './hljs-theme.js';
import type { ResolvedTheme } from './theme.js';

/**
 * Split a standalone Asciidoctor HTML document into CSS + body markup.
 */
export function splitStandaloneHtml(html: string): { css: string; body: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const css = Array.from(doc.querySelectorAll('style'))
    .map((el) => el.textContent || '')
    .join('\n');

  // Prefer #content when present (Asciidoctor default), else whole body
  const content = doc.getElementById('content') || doc.body;
  const body = content ? content.innerHTML : html;

  return { css, body };
}

/**
 * Override Asciidoctor default accent colors (#ba3925 / #7a2518 reds)
 * with Microsoft Fluent blues for both light and dark themes.
 */
const ADOC_ACCENT_CSS = `
/* --- Light (default): Fluent blue instead of Asciidoctor brick red --- */
.adoc-host h1,
.adoc-host h2,
.adoc-host h3,
.adoc-host h4,
.adoc-host h5,
.adoc-host h6,
.adoc-host #header h1,
.adoc-host #toctitle,
.adoc-host .sidebarblock > .content > .title,
.adoc-host .exampleblock > .title,
.adoc-host .listingblock > .title,
.adoc-host .literalblock > .title,
.adoc-host .openblock > .title,
.adoc-host .paragraph > .title,
.adoc-host .quoteblock > .title,
.adoc-host .verseblock > .title,
.adoc-host .imageblock > .title,
.adoc-host .videoblock > .title,
.adoc-host .tableblock > caption.title,
.adoc-host .audioblock > .title,
.adoc-host dlist > .title,
.adoc-host olist > .title,
.adoc-host ulist > .title,
.adoc-host .hdlist > .title,
.adoc-host #content h1,
.adoc-host #content h2,
.adoc-host #content h3,
.adoc-host #content h4,
.adoc-host #content h5,
.adoc-host #content h6 {
  color: #0078d4 !important;
}
.adoc-host a {
  color: #0078d4 !important;
}
.adoc-host a:hover,
.adoc-host a:focus {
  color: #005a9e !important;
}
.adoc-host .admonitionblock td.icon .title {
  color: #0078d4 !important;
}
.adoc-host hr {
  border-color: #c7e0f4 !important;
  background: #c7e0f4 !important;
}

/* --- Dark: Fluent accent blues --- */
.adoc-host[data-theme="dark"] {
  background: #1a1a1a !important;
  color: #e6e6e6 !important;
}
/* Asciidoctor hardcodes near-black on preamble lead / .paragraph.lead */
.adoc-host[data-theme="dark"] #preamble > .sectionbody > [class="paragraph"]:first-of-type p,
.adoc-host[data-theme="dark"] #preamble > .sectionbody > .paragraph:first-of-type p,
.adoc-host[data-theme="dark"] .paragraph.lead > p {
  color: #e6e6e6 !important;
}
.adoc-host[data-theme="dark"] p,
.adoc-host[data-theme="dark"] li,
.adoc-host[data-theme="dark"] td,
.adoc-host[data-theme="dark"] th,
.adoc-host[data-theme="dark"] dd,
.adoc-host[data-theme="dark"] dt {
  color: #e6e6e6 !important;
}
.adoc-host[data-theme="dark"] p a,
.adoc-host[data-theme="dark"] li a,
.adoc-host[data-theme="dark"] td a {
  color: #60cdff !important;
}
.adoc-host[data-theme="dark"] h1,
.adoc-host[data-theme="dark"] h2,
.adoc-host[data-theme="dark"] h3,
.adoc-host[data-theme="dark"] h4,
.adoc-host[data-theme="dark"] h5,
.adoc-host[data-theme="dark"] h6,
.adoc-host[data-theme="dark"] #header h1,
.adoc-host[data-theme="dark"] #toctitle,
.adoc-host[data-theme="dark"] .sidebarblock > .content > .title,
.adoc-host[data-theme="dark"] .exampleblock > .title,
.adoc-host[data-theme="dark"] .listingblock > .title,
.adoc-host[data-theme="dark"] .literalblock > .title,
.adoc-host[data-theme="dark"] .openblock > .title,
.adoc-host[data-theme="dark"] .paragraph > .title,
.adoc-host[data-theme="dark"] .quoteblock > .title,
.adoc-host[data-theme="dark"] .verseblock > .title,
.adoc-host[data-theme="dark"] .imageblock > .title,
.adoc-host[data-theme="dark"] .videoblock > .title,
.adoc-host[data-theme="dark"] .tableblock > caption.title,
.adoc-host[data-theme="dark"] .audioblock > .title,
.adoc-host[data-theme="dark"] dlist > .title,
.adoc-host[data-theme="dark"] olist > .title,
.adoc-host[data-theme="dark"] ulist > .title,
.adoc-host[data-theme="dark"] .hdlist > .title,
.adoc-host[data-theme="dark"] #content h1,
.adoc-host[data-theme="dark"] #content h2,
.adoc-host[data-theme="dark"] #content h3,
.adoc-host[data-theme="dark"] #content h4,
.adoc-host[data-theme="dark"] #content h5,
.adoc-host[data-theme="dark"] #content h6,
.adoc-host[data-theme="dark"] .admonitionblock td.icon .title {
  color: #60cdff !important;
}
.adoc-host[data-theme="dark"] a {
  color: #60cdff !important;
}
.adoc-host[data-theme="dark"] a:hover,
.adoc-host[data-theme="dark"] a:focus {
  color: #82c7ff !important;
}
/* Inline / plain code only — keep syntax-highlighted blocks untouched */
.adoc-host[data-theme="dark"] :where(p, li, td, th, dd, dt, .paragraph, .sidebarblock, .admonitionblock) code,
.adoc-host[data-theme="dark"] kbd,
.adoc-host[data-theme="dark"] .literalblock pre {
  background: #2a2a2a !important;
  color: #e6e6e6 !important;
  border-color: #444 !important;
}
.adoc-host[data-theme="dark"] .listingblock pre.highlight,
.adoc-host[data-theme="dark"] .listingblock pre.highlightjs,
.adoc-host[data-theme="dark"] pre.highlight,
.adoc-host[data-theme="dark"] pre.highlightjs {
  background: #1e1e1e !important;
  border-color: #333 !important;
  color: unset !important;
}
.adoc-host[data-theme="dark"] .listingblock pre.highlight code,
.adoc-host[data-theme="dark"] .listingblock pre.highlightjs code,
.adoc-host[data-theme="dark"] pre.highlight code,
.adoc-host[data-theme="dark"] pre.highlightjs code {
  background: transparent !important;
  color: unset !important;
}
.adoc-host[data-theme="dark"] .sidebarblock,
.adoc-host[data-theme="dark"] .exampleblock > .content,
.adoc-host[data-theme="dark"] .quoteblock.abstract blockquote,
.adoc-host[data-theme="dark"] table.tableblock,
.adoc-host[data-theme="dark"] table.frame-all,
.adoc-host[data-theme="dark"] table.grid-all > * > tr > * {
  background: #222 !important;
  border-color: #444 !important;
  color: #e6e6e6 !important;
}
.adoc-host[data-theme="dark"] table.tableblock th,
.adoc-host[data-theme="dark"] table thead tr th {
  background: #2c2c2c !important;
  color: #f0f0f0 !important;
}
.adoc-host[data-theme="dark"] table.stripes-all > tbody > tr:nth-of-type(even),
.adoc-host[data-theme="dark"] table.stripes-odd > tbody > tr:nth-of-type(odd),
.adoc-host[data-theme="dark"] table.stripes-even > tbody > tr:nth-of-type(even),
.adoc-host[data-theme="dark"] table.stripes-hover > tbody > tr:hover {
  background: #262626 !important;
}
.adoc-host[data-theme="dark"] .admonitionblock td.icon {
  background: #2a2a2a !important;
}
.adoc-host[data-theme="dark"] .admonitionblock td.content {
  background: #222 !important;
  border-left-color: #555 !important;
  color: #e6e6e6 !important;
}
.adoc-host[data-theme="dark"] hr {
  border-color: #3a4a5a !important;
  background: #3a4a5a !important;
}
.adoc-host[data-theme="dark"] blockquote {
  color: #c8c8c8 !important;
  border-left-color: #555 !important;
}
.adoc-host[data-theme="dark"] .subtitle,
.adoc-host[data-theme="dark"] #author,
.adoc-host[data-theme="dark"] #revnumber,
.adoc-host[data-theme="dark"] #revdate,
.adoc-host[data-theme="dark"] #revremark {
  color: #c0c0c0 !important;
}
.adoc-host[data-theme="dark"] mark {
  background: #5c4b00 !important;
  color: #fff8d6 !important;
}
`;

function setHljsThemeStyle(shadow: ShadowRoot, theme: ResolvedTheme): void {
  let el = shadow.querySelector('style[data-hljs-theme]') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.setAttribute('data-hljs-theme', '');
    shadow.appendChild(el);
  }
  el.textContent = hljsThemeCss(theme);
}

function highlightSourceBlocks(shadow: ShadowRoot): void {
  const blocks = shadow.querySelectorAll<HTMLElement>(
    'pre.highlightjs code, pre.highlight code.hljs, code.hljs',
  );
  for (const block of blocks) {
    if (block.dataset.highlighted === 'yes') continue;
    try {
      hljs.highlightElement(block);
    } catch {
      // Unknown language etc. — leave plain text
    }
  }
}

/**
 * Render converted AsciiDoc HTML into a target <div> via Shadow DOM.
 */
export function renderHtmlToDiv(
  standaloneHtml: string,
  container: HTMLElement,
  theme: ResolvedTheme = 'light',
): ShadowRoot {
  const { css, body } = splitStandaloneHtml(standaloneHtml);

  const wrapper = document.createElement('div');
  wrapper.className = 'adoc-host-wrapper';
  const shadow = wrapper.attachShadow({ mode: 'open' });

  const hostCss = `:host { all: initial; display: block; width: 100%; height: 100%; }
    :host * { box-sizing: border-box; }
    .adoc-host {
      display: block;
      width: 100%;
      min-height: 100%;
      padding: 1.5em 2em 3em;
      overflow: auto;
      background: #fff;
      color: #222;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color-scheme: light;
    }
    .adoc-host[data-theme="dark"] {
      color-scheme: dark;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = hostCss + '\n' + css + '\n' + ADOC_ACCENT_CSS;
  shadow.appendChild(styleEl);

  setHljsThemeStyle(shadow, theme);

  const inner = document.createElement('div');
  inner.className = 'adoc-host';
  inner.dataset.theme = theme;
  inner.innerHTML = body;
  shadow.appendChild(inner);

  highlightSourceBlocks(shadow);

  container.innerHTML = '';
  container.appendChild(wrapper);

  // Intercept in-document anchor clicks → adoc-navigate messages
  shadow.addEventListener(
    'click',
    (e: Event) => {
      let target = e.target as Element | null;
      while (target && target.tagName !== 'A') target = target.parentElement;
      if (!target) return;
      const a = target as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href) return;
      if (
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('javascript:')
      ) {
        return;
      }
      e.preventDefault();
      window.postMessage({ type: 'adoc-navigate', href }, '*');
    },
    true,
  );

  return shadow;
}

/** Update theme on an already-rendered document (no re-convert). */
export function applyContentTheme(container: HTMLElement, theme: ResolvedTheme): void {
  const wrapper = container.querySelector('.adoc-host-wrapper');
  const root = wrapper?.shadowRoot;
  if (!root) return;
  const host = root.querySelector('.adoc-host') as HTMLElement | null;
  if (host) host.dataset.theme = theme;
  setHljsThemeStyle(root, theme);
}

/** Scroll to a fragment id inside the rendered Shadow DOM content. */
export function scrollToFragment(container: HTMLElement, fragmentId: string): boolean {
  const id = fragmentId.replace(/^#/, '');
  if (!id) return false;

  const wrapper = container.querySelector('.adoc-host-wrapper');
  const root = wrapper?.shadowRoot;
  if (!root) return false;

  const el =
    root.getElementById(id) ||
    root.querySelector(`[id="${CSS.escape(id)}"]`) ||
    root.querySelector(`[name="${CSS.escape(id)}"]`);

  if (!el) return false;
  (el as HTMLElement).scrollIntoView({ block: 'start' });
  return true;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
