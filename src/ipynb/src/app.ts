/**
 * ipynb — browser-based Jupyter Notebook viewer
 *
 * Entry point. Handles file selection/drop, converts .ipynb JSON to HTML,
 * builds the TOC sidebar, and drives fragment navigation.
 */

import { convertIpynb, decodeUtf8 } from './lib/convert.js';
import type { ConvertedDocument } from './lib/types.js';
import { renderTocWithPaths, highlightTocEntry } from './toc-panel.js';
import { applyContentTheme, renderHtmlToDiv, scrollToFragment } from './renderer.js';
import {
  applyTheme,
  getResolvedTheme,
  initTheme,
  isThemePreference,
  onThemeChange,
  toggleTheme,
  type ThemePreference,
} from './theme.js';

// ─── DOM refs ───────────────────────────────────────────────────────────────

const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const titleEl = document.getElementById('title') as HTMLSpanElement;
const tocContainer = document.getElementById('toc-container') as HTMLDivElement;
const contentHtml = document.getElementById('content-html') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const viewerEl = document.getElementById('viewer') as HTMLDivElement;
const welcomeEl = document.getElementById('welcome') as HTMLDivElement;
const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
const fwdBtn = document.getElementById('fwd-btn') as HTMLButtonElement;
const resizer = document.getElementById('resizer') as HTMLDivElement;
const sidebar = document.getElementById('sidebar') as HTMLDivElement;
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement | null;

// ─── Application state ───────────────────────────────────────────────────────

let currentDoc: ConvertedDocument | null = null;
let currentFragment = '';
const history: string[] = [];
let historyIndex = -1;

// Plugin mode detection (set by `plugin.html` or via ?plugin=1)
const urlParams = new URLSearchParams(location.search);
const pluginMode =
  Boolean((window as unknown as { __IPYNB_PLUGIN?: boolean }).__IPYNB_PLUGIN) ||
  urlParams.get('plugin') === '1' ||
  document.body.dataset.plugin === '1';

// Theme: default auto (follow system); one button toggles light ↔ dark
initTheme(urlParams);
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    toggleTheme();
  });
}
onThemeChange((resolved) => {
  applyContentTheme(contentHtml, resolved);
});

// ─── Navigation (fragment-based within a single rendered document) ───────────

async function navigate(fragmentOrHref: string, pushHistory = true): Promise<void> {
  if (!currentDoc) return;

  const fragment = normalizeFragment(fragmentOrHref);

  if (fragment) {
    scrollToFragment(contentHtml, fragment);
    currentFragment = fragment;
    highlightTocEntry(tocContainer, fragment);
  } else {
    const wrapper = contentHtml.querySelector('.ipynb-host-wrapper');
    const host = wrapper?.shadowRoot?.querySelector('.ipynb-host');
    if (host) (host as HTMLElement).scrollTop = 0;
    else contentHtml.scrollTop = 0;
    currentFragment = '';
    highlightTocEntry(tocContainer, '');
  }

  if (pushHistory) {
    history.splice(historyIndex + 1);
    history.push(fragment);
    historyIndex = history.length - 1;
  }

  updateNavButtons();
}

function normalizeFragment(href: string): string {
  if (!href) return '';
  const hashIdx = href.indexOf('#');
  if (hashIdx !== -1) return href.slice(hashIdx + 1);
  if (!href.includes('/') && !href.includes('.')) return href.replace(/^\//, '');
  return href.replace(/^\//, '');
}

function updateNavButtons(): void {
  backBtn.disabled = historyIndex <= 0;
  fwdBtn.disabled = historyIndex >= history.length - 1;
}

// ─── Event: messages from content / host ─────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  if (!event.data) return;
  if (event.data.type === 'ipynb-navigate') {
    const href = String(event.data.href);
    navigate(href);
    return;
  }
  if (event.data.type === 'open-ipynb') {
    const payload = event.data.payload || {};
    handleHostOpenRequest(payload).catch((err) => setStatus(`Failed to open: ${String(err)}`));
    return;
  }
  if (event.data.type === 'set-theme') {
    const payload = event.data.payload || {};
    const theme = payload.theme ?? payload.preference ?? event.data.theme;
    if (isThemePreference(theme)) {
      applyTheme(theme as ThemePreference);
    }
  }
});

// WebView2 host messaging (if available)
const chromeObj = (window as unknown as { chrome?: { webview?: { addEventListener: Function } } })
  .chrome;
if (chromeObj?.webview && typeof chromeObj.webview.addEventListener === 'function') {
  chromeObj.webview.addEventListener('message', (ev: { data: unknown }) => {
    const data = ev.data as { type?: string; payload?: unknown } | null;
    if (!data) return;
    if (data.type === 'open-ipynb') {
      handleHostOpenRequest(data.payload || {}).catch((err: unknown) =>
        setStatus(`Failed to open: ${String(err)}`),
      );
      return;
    }
    if (data.type === 'set-theme') {
      const payload = (data.payload || {}) as Record<string, unknown>;
      const theme = payload.theme ?? payload.preference;
      if (isThemePreference(theme)) {
        applyTheme(theme);
      }
    }
  });
}

async function handleHostOpenRequest(payload: unknown) {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  if (p.base64) {
    const buf = base64ToArrayBuffer(String(p.base64));
    await openIpynbBuffer(buf, String(p.name || 'notebook.ipynb'));
    return;
  }
  if (p.text != null) {
    await openIpynbText(String(p.text), String(p.name || 'notebook.ipynb'));
    return;
  }
  if (p.json != null) {
    const text = typeof p.json === 'string' ? p.json : JSON.stringify(p.json);
    await openIpynbText(text, String(p.name || 'notebook.ipynb'));
    return;
  }
  if (p.url) {
    await openIpynbFromUrl(String(p.url), p.name ? String(p.name) : undefined);
    return;
  }
  if (p.path) {
    await openIpynbFromUrl(String(p.path), p.name ? String(p.name) : undefined);
    return;
  }
  throw new Error('Unsupported payload for open-ipynb');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function openIpynbFromUrl(url: string, name?: string) {
  setStatus('Fetching notebook…');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  await openIpynbBuffer(ab, name || extractNameFromUrl(url));
}

function extractNameFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

// ─── Event: back / forward ────────────────────────────────────────────────────

backBtn.addEventListener('click', () => {
  if (historyIndex > 0) {
    historyIndex--;
    navigate(history[historyIndex], false);
  }
});

fwdBtn.addEventListener('click', () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    navigate(history[historyIndex], false);
  }
});

// ─── Open notebook ────────────────────────────────────────────────────────────

async function openIpynbBuffer(buffer: ArrayBuffer, name: string): Promise<void> {
  const text = decodeUtf8(buffer);
  await openIpynbText(text, name);
}

async function openIpynbText(source: string, name: string): Promise<void> {
  setStatus('Rendering notebook…');

  history.length = 0;
  historyIndex = -1;
  currentFragment = '';
  currentDoc = null;

  try {
    const converted = await convertIpynb(source, { name });
    currentDoc = converted;

    if (converted.title) {
      titleEl.textContent = converted.title;
      titleEl.hidden = false;
      document.title = `ipynb — ${converted.title}`;
    } else {
      titleEl.textContent = name;
      titleEl.hidden = false;
      document.title = `ipynb — ${name}`;
    }

    tocContainer.innerHTML = '<p class="toc-loading">Loading TOC…</p>';
    if (converted.toc.entries.length > 0) {
      renderTocWithPaths(tocContainer, converted.toc, (id) => navigate(id));
    } else {
      tocContainer.innerHTML = '<p class="toc-loading">(No TOC)</p>';
    }

    renderHtmlToDiv(converted.html, contentHtml, getResolvedTheme());

    history.push('');
    historyIndex = 0;
    updateNavButtons();

    welcomeEl.hidden = true;
    viewerEl.hidden = false;
    setStatus('');
  } catch (err) {
    setStatus(`Failed to open: ${String(err)}`);
    console.error(err);
  }
}

// ─── File input / drag-drop ───────────────────────────────────────────────────

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) readFile(file);
  fileInput.value = '';
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) readFile(file);
});

function readFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => openIpynbBuffer(reader.result as ArrayBuffer, file.name);
  reader.onerror = () => setStatus(`Read file failed: ${file.name}`);
  reader.readAsArrayBuffer(file);
}

// ─── Sidebar resizer ─────────────────────────────────────────────────────────

let isResizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartWidth = sidebar.offsetWidth;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const delta = e.clientX - resizeStartX;
  const newWidth = Math.max(150, Math.min(600, resizeStartWidth + delta));
  sidebar.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setStatus(msg: string): void {
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
}

// If running as plugin, auto-open from querystring or wait for host message
if (pluginMode) {
  try {
    if (dropZone) dropZone.hidden = true;
  } catch {
    /* ignore */
  }
  try {
    const openBtn = document.getElementById('open-btn');
    if (openBtn) (openBtn as HTMLElement).hidden = true;
  } catch {
    /* ignore */
  }

  (async () => {
    const ipynbParam =
      urlParams.get('ipynb') || urlParams.get('ipynbUrl') || urlParams.get('url');
    const ipynbBase64 = urlParams.get('ipynbBase64') || urlParams.get('base64');
    const name = urlParams.get('name') || undefined;
    try {
      if (ipynbBase64) {
        const buf = base64ToArrayBuffer(ipynbBase64);
        await openIpynbBuffer(buf, name || 'notebook.ipynb');
      } else if (ipynbParam) {
        await openIpynbFromUrl(ipynbParam, name);
      } else {
        setStatus('Waiting for host to provide notebook…');
      }
    } catch (err) {
      setStatus(`Plugin open failed: ${String(err)}`);
    }
  })();
}
