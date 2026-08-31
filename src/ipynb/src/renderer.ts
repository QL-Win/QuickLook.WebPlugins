/**
 * Notebook content renderer for the browser.
 *
 * Takes standalone HTML from the converter, extracts embedded styles + body,
 * and renders into a Shadow DOM so document CSS cannot leak into the shell.
 */

import katexCss from 'katex/dist/katex.min.css?inline';
import { hljsThemeCss } from './hljs-theme.js';
import type { ResolvedTheme } from './theme.js';

/**
 * Split a standalone notebook HTML document into CSS + body markup.
 */
export function splitStandaloneHtml(html: string): { css: string; body: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const css = Array.from(doc.querySelectorAll('style'))
    .map((el) => el.textContent || '')
    .join('\n');

  const content = doc.getElementById('content') || doc.body;
  const body = content ? content.innerHTML : html;

  return { css, body };
}

function setHljsThemeStyle(shadow: ShadowRoot, theme: ResolvedTheme): void {
  let el = shadow.querySelector('style[data-hljs-theme]') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.setAttribute('data-hljs-theme', '');
    shadow.appendChild(el);
  }
  el.textContent = hljsThemeCss(theme);
}

/**
 * Render converted notebook HTML into a target <div> via Shadow DOM.
 */
export function renderHtmlToDiv(
  standaloneHtml: string,
  container: HTMLElement,
  theme: ResolvedTheme = 'light',
): ShadowRoot {
  const { css, body } = splitStandaloneHtml(standaloneHtml);

  const wrapper = document.createElement('div');
  wrapper.className = 'ipynb-host-wrapper';
  const shadow = wrapper.attachShadow({ mode: 'open' });

  const hostCss = `:host { all: initial; display: block; width: 100%; height: 100%; }
    :host * { box-sizing: border-box; }
    .ipynb-host {
      display: block;
      width: 100%;
      min-height: 100%;
      padding: 1.25em 1.5em 3em;
      overflow: auto;
      background: #fff;
      color: #222;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color-scheme: light;
    }
    .ipynb-host[data-theme="dark"] {
      background: #1a1a1a;
      color: #e6e6e6;
      color-scheme: dark;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = hostCss + '\n' + katexCss + '\n' + css;
  shadow.appendChild(styleEl);

  setHljsThemeStyle(shadow, theme);

  const inner = document.createElement('div');
  inner.className = 'ipynb-host';
  inner.dataset.theme = theme;
  inner.innerHTML = body;
  shadow.appendChild(inner);

  container.innerHTML = '';
  container.appendChild(wrapper);

  // Intercept in-document anchor clicks → ipynb-navigate messages
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
      window.postMessage({ type: 'ipynb-navigate', href }, '*');
    },
    true,
  );

  return shadow;
}

/** Update theme on an already-rendered document (no re-convert). */
export function applyContentTheme(container: HTMLElement, theme: ResolvedTheme): void {
  const wrapper = container.querySelector('.ipynb-host-wrapper');
  const root = wrapper?.shadowRoot;
  if (!root) return;
  const host = root.querySelector('.ipynb-host') as HTMLElement | null;
  if (host) host.dataset.theme = theme;
  setHljsThemeStyle(root, theme);
}

/** Scroll to a fragment id inside the rendered Shadow DOM content. */
export function scrollToFragment(container: HTMLElement, fragmentId: string): boolean {
  const id = fragmentId.replace(/^#/, '');
  if (!id) return false;

  const wrapper = container.querySelector('.ipynb-host-wrapper');
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
