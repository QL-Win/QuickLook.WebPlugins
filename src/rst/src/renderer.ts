/**
 * reStructuredText content renderer for the browser.
 *
 * Takes HTML from rst-compiler and renders into a Shadow DOM so document CSS
 * cannot leak into the shell.
 */

import hljs from 'highlight.js/lib/common';
import { hljsThemeCss } from './hljs-theme.js';
import type { ResolvedTheme } from './theme.js';

/**
 * Base document styles for rst-compiler output (Fluent blue accents).
 */
const RST_BASE_CSS = `
.rst-host {
  --rst-fg: #222;
  --rst-muted: #555;
  --rst-link: #0078d4;
  --rst-link-hover: #005a9e;
  --rst-heading: #0078d4;
  --rst-border: #e0e0e0;
  --rst-code-bg: #f5f5f5;
  --rst-code-fg: #242424;
  --rst-pre-bg: #f5f5f5;
  --rst-pre-border: #e0e0e0;
  --rst-admonition-bg: #f0f6fc;
  --rst-admonition-border: #0078d4;
  --rst-table-stripe: #f8f8f8;
  --rst-blockquote-border: #c7e0f4;
  --rst-blockquote-fg: #444;
}

.rst-host[data-theme="dark"] {
  --rst-fg: #e6e6e6;
  --rst-muted: #b0b0b0;
  --rst-link: #60cdff;
  --rst-link-hover: #82c7ff;
  --rst-heading: #60cdff;
  --rst-border: #444;
  --rst-code-bg: #2a2a2a;
  --rst-code-fg: #e6e6e6;
  --rst-pre-bg: #1e1e1e;
  --rst-pre-border: #333;
  --rst-admonition-bg: #222;
  --rst-admonition-border: #60cdff;
  --rst-table-stripe: #262626;
  --rst-blockquote-border: #555;
  --rst-blockquote-fg: #c8c8c8;
}

.rst-host h1,
.rst-host h2,
.rst-host h3,
.rst-host h4,
.rst-host h5,
.rst-host h6 {
  color: var(--rst-heading);
  font-weight: 600;
  line-height: 1.25;
  margin: 1.4em 0 0.6em;
}
.rst-host h1 { font-size: 2em; border-bottom: 1px solid var(--rst-border); padding-bottom: 0.3em; }
.rst-host h2 { font-size: 1.5em; border-bottom: 1px solid var(--rst-border); padding-bottom: 0.25em; }
.rst-host h3 { font-size: 1.25em; }
.rst-host h4 { font-size: 1.1em; }
.rst-host h5, .rst-host h6 { font-size: 1em; }

.rst-host p { margin: 0.85em 0; }
.rst-host a { color: var(--rst-link); text-decoration: none; }
.rst-host a:hover, .rst-host a:focus { color: var(--rst-link-hover); text-decoration: underline; }

.rst-host ul, .rst-host ol { margin: 0.85em 0; padding-left: 1.6em; }
.rst-host li > p { margin: 0.35em 0; }

.rst-host .literal,
.rst-host .rst-role,
.rst-host :not(pre) > code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
  background: var(--rst-code-bg);
  color: var(--rst-code-fg);
  border: 1px solid var(--rst-border);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}
.rst-host a.rst-role {
  color: var(--rst-link);
  text-decoration: none;
  border-color: transparent;
  background: transparent;
  padding: 0;
}
.rst-host a.rst-role:hover { color: var(--rst-link-hover); text-decoration: underline; }
.rst-host .rst-directive {
  margin: 1em 0;
  padding: 0.75em 1em;
  border: 1px dashed var(--rst-border);
  border-radius: 6px;
  background: var(--rst-code-bg);
}
.rst-host .rst-directive-title {
  margin: 0 0 0.5em;
  color: var(--rst-muted);
  font-size: 0.92em;
}
.rst-host ul.toctree {
  margin: 0.85em 0;
  padding-left: 1.4em;
}
.rst-host .rst-toctree-missing {
  color: var(--rst-muted);
}

.rst-host pre,
.rst-host pre.code,
.rst-host .literal-block pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
  line-height: 1.45;
  background: var(--rst-pre-bg);
  border: 1px solid var(--rst-pre-border);
  border-radius: 6px;
  padding: 0.9em 1em;
  overflow: auto;
  margin: 1em 0;
}
.rst-host pre.highlight code,
.rst-host pre.code code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.rst-host blockquote {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 4px solid var(--rst-blockquote-border);
  color: var(--rst-blockquote-fg);
}

.rst-host hr,
.rst-host .transition {
  border: none;
  border-top: 1px solid var(--rst-border);
  margin: 1.5em 0;
}

.rst-host table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
}
.rst-host th, .rst-host td {
  border: 1px solid var(--rst-border);
  padding: 0.5em 0.75em;
  text-align: left;
}
.rst-host th { background: var(--rst-code-bg); font-weight: 600; }
.rst-host tbody tr:nth-child(even) { background: var(--rst-table-stripe); }

.rst-host .admonition,
.rst-host .note, .rst-host .tip, .rst-host .hint, .rst-host .important,
.rst-host .warning, .rst-host .caution, .rst-host .attention,
.rst-host .danger, .rst-host .error {
  margin: 1em 0;
  padding: 0.85em 1em;
  background: var(--rst-admonition-bg);
  border-left: 4px solid var(--rst-admonition-border);
  border-radius: 0 6px 6px 0;
}
.rst-host .admonition-title,
.rst-host .note > .admonition-title,
.rst-host .tip > .admonition-title {
  font-weight: 700;
  color: var(--rst-heading);
  margin-bottom: 0.35em;
}

.rst-host img { max-width: 100%; height: auto; }
.rst-host .figure { margin: 1em 0; }
.rst-host .caption, .rst-host .legend { color: var(--rst-muted); font-size: 0.92em; }

.rst-host em { font-style: italic; }
.rst-host strong { font-weight: 700; }

.rst-host dl { margin: 1em 0; }
.rst-host dt { font-weight: 600; }
.rst-host dd { margin: 0.25em 0 0.75em 1.5em; }
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
    'pre.highlight code, pre.code code.hljs, code.hljs',
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
 * Render converted RST HTML into a target <div> via Shadow DOM.
 */
export function renderHtmlToDiv(
  bodyHtml: string,
  container: HTMLElement,
  theme: ResolvedTheme = 'light',
  headerHtml = '',
): ShadowRoot {
  const wrapper = document.createElement('div');
  wrapper.className = 'rst-host-wrapper';
  const shadow = wrapper.attachShadow({ mode: 'open' });

  const hostCss = `:host { all: initial; display: block; width: 100%; height: 100%; }
    :host * { box-sizing: border-box; }
    .rst-host {
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
    .rst-host[data-theme="dark"] {
      background: #1a1a1a !important;
      color: #e6e6e6 !important;
      color-scheme: dark;
    }
    /* Explicit block display — some WebView hosts drop UA stylesheet in Shadow DOM */
    .rst-host h1, .rst-host h2, .rst-host h3, .rst-host h4, .rst-host h5, .rst-host h6,
    .rst-host p, .rst-host div, .rst-host section, .rst-host article,
    .rst-host ul, .rst-host ol, .rst-host pre, .rst-host blockquote,
    .rst-host table, .rst-host dl, .rst-host hr, .rst-host figure {
      display: block;
    }
    .rst-host li { display: list-item; }
    .rst-host ul { list-style: disc; }
    .rst-host ol { list-style: decimal; }
    .rst-host pre { white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = hostCss + '\n' + RST_BASE_CSS;
  shadow.appendChild(styleEl);

  // Optional compiler header extras (e.g. KaTeX link / tabs script markup as text)
  if (headerHtml.trim()) {
    const headerHost = document.createElement('div');
    headerHost.setAttribute('data-rst-header', '');
    headerHost.innerHTML = headerHtml;
    // Promote <style> / <link> into the shadow root
    for (const el of Array.from(headerHost.querySelectorAll('style, link[rel="stylesheet"]'))) {
      shadow.appendChild(el);
    }
  }

  setHljsThemeStyle(shadow, theme);

  const inner = document.createElement('div');
  inner.className = 'rst-host';
  inner.dataset.theme = theme;
  inner.innerHTML = bodyHtml;
  shadow.appendChild(inner);

  highlightSourceBlocks(shadow);

  container.innerHTML = '';
  container.appendChild(wrapper);

  // Intercept in-document anchor clicks → rst-navigate messages
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
      window.postMessage({ type: 'rst-navigate', href }, '*');
    },
    true,
  );

  return shadow;
}

/** Update theme on an already-rendered document (no re-convert). */
export function applyContentTheme(container: HTMLElement, theme: ResolvedTheme): void {
  const wrapper = container.querySelector('.rst-host-wrapper');
  const root = wrapper?.shadowRoot;
  if (!root) return;
  const host = root.querySelector('.rst-host') as HTMLElement | null;
  if (host) host.dataset.theme = theme;
  setHljsThemeStyle(root, theme);
}

/** Scroll to a fragment id inside the rendered Shadow DOM content. */
export function scrollToFragment(container: HTMLElement, fragmentId: string): boolean {
  const id = fragmentId.replace(/^#/, '');
  if (!id) return false;

  const wrapper = container.querySelector('.rst-host-wrapper');
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
