/**
 * chm — browser-based CHM viewer
 *
 * Entry point. Handles file selection/drop, opens the ChmFile,
 * builds the TOC sidebar, and drives page navigation.
 */

import { ChmFile } from './lib/chm-file.js';
import { chmReaderFromBuffer } from './lib/reader.js';
import { parseSystemInfo } from './lib/system.js';
import { parseToc } from './lib/toc.js';
import { discoverTocFile } from './lib/archive-discovery.js';
import { ChmEnumerateFlags } from './lib/types.js';
import { renderTocWithPaths, highlightTocEntry } from './toc-panel.js';
import { renderPageToDiv, resolveChmPath } from './renderer.js';

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

// ─── Application state ───────────────────────────────────────────────────────

let chm: ChmFile | null = null;
let currentPath = '';
const history: string[] = [];
let historyIndex = -1;

// Plugin mode detection (set by `plugin.html` or via ?plugin=1)
const urlParams = new URLSearchParams(location.search);
const pluginMode = Boolean((window as any).__CHM_PLUGIN) || urlParams.get('plugin') === '1' || document.body.dataset.plugin === '1';

/** Shared blob URL cache — paths are stored lower-cased */
const blobCache = new Map<string, string>();

// ─── Navigation ──────────────────────────────────────────────────────────────

async function navigate(path: string, pushHistory = true): Promise<void> {
  if (!chm) return;

  // Separate fragment from path
  const [pagePath, fragment] = splitFragment(path);
  const resolvedPath = pagePath || currentPath;

  setStatus('Loading…');

  try {
    await renderPageToDiv(chm, resolvedPath, contentHtml, blobCache);
    currentPath = resolvedPath;

    if (pushHistory) {
      // Discard forward history
      history.splice(historyIndex + 1);
      history.push(path);
      historyIndex = history.length - 1;
    }

    updateNavButtons();
    highlightTocEntry(tocContainer, resolvedPath);

    // Scroll to fragment (anchor)
    if (fragment) {
      const el = contentHtml.querySelector(`#${CSS.escape(fragment)}, [name="${fragment}"]`);
      if (el) (el as HTMLElement).scrollIntoView();
    }

    setStatus('');
  } catch (err) {
    setStatus(`Error: ${String(err)}`);
  }
}

function splitFragment(path: string): [string, string] {
  const idx = path.indexOf('#');
  if (idx === -1) return [path, ''];
  return [path.slice(0, idx), path.slice(idx + 1)];
}

function updateNavButtons(): void {
  backBtn.disabled = historyIndex <= 0;
  fwdBtn.disabled = historyIndex >= history.length - 1;
}

// ─── Event: messages from iframe (navigation interceptor) ────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  if (!event.data) return;
  // navigation messages from embedded pages
  if (event.data.type === 'chm-navigate') {
    const href = String(event.data.href);
    const resolved = resolveChmPath(currentPath, href);
    navigate(resolved);
    return;
  }
  // host / plugin messages: open a CHM
  if (event.data.type === 'open-chm') {
    const payload = event.data.payload || {};
    handleHostOpenRequest(payload).catch((err) => setStatus(`Failed to open: ${String(err)}`));
    return;
  }
});

// WebView2 host messaging (if available)
if ((window as any).chrome && (window as any).chrome.webview && typeof (window as any).chrome.webview.addEventListener === 'function') {
  (window as any).chrome.webview.addEventListener('message', (ev: any) => {
    const data = ev.data;
    if (!data) return;
    if (data.type === 'open-chm') {
      handleHostOpenRequest(data.payload || {}).catch((err: any) => setStatus(`Failed to open: ${String(err)}`));
    }
  });
}

async function handleHostOpenRequest(payload: any) {
  // payload may be { url, base64, name }
  if (payload.base64) {
    const buf = base64ToArrayBuffer(payload.base64);
    await openChmBuffer(buf, payload.name || 'file.chm');
    return;
  }
  if (payload.url) {
    await openChmFromUrl(payload.url, payload.name);
    return;
  }
  if (payload.path) {
    // treat as URL attempt
    await openChmFromUrl(payload.path, payload.name);
    return;
  }
  throw new Error('Unsupported payload for open-chm');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function openChmFromUrl(url: string, name?: string) {
  setStatus('Fetching CHM…');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  await openChmBuffer(ab, name || extractNameFromUrl(url));
}

function extractNameFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.split('/').pop() || url;
  } catch (e) {
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

// ─── Open CHM file ────────────────────────────────────────────────────────────

async function openChmBuffer(buffer: ArrayBuffer, name: string): Promise<void> {
  setStatus('Parsing CHM file…');

  // Revoke old blob URLs
  for (const url of blobCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobCache.clear();

  if (chm) {
    chm.close();
    chm = null;
  }

  // Reset history
  history.length = 0;
  historyIndex = -1;

  try {
    const data = new Uint8Array(buffer);
    chm = await ChmFile.open(chmReaderFromBuffer(data));

    // Read /#SYSTEM
    const sysRaw = await chm.getSystemRaw();
    const sys = sysRaw ? parseSystemInfo(sysRaw, chm.getLanguageId() ?? undefined) : {};

    // Set title: only render if /#SYSTEM provides a title.
    if (sys.title) {
      titleEl.textContent = sys.title;
      titleEl.hidden = false;
      document.title = `chm — ${sys.title}`;
    } else {
      // Hide the title element and restore default page title
      titleEl.textContent = '';
      titleEl.hidden = true;
      document.title = 'chm — CHM Viewer';
    }

    // Build TOC
    tocContainer.innerHTML = '<p class="toc-loading">Loading TOC…</p>';
    const tocPath = await discoverTocFile(chm, sys);
    if (tocPath) {
      const tocEntry = await chm.resolve(tocPath);
      if (tocEntry) {
        const tocData = await chm.retrieve(tocEntry);
        // Decode TOC using CHM language hint when available
        const tocText = (await import('./lib/text.js')).decodeTextWithLangHint(tocData, chm.getLanguageId() ?? undefined).text;
        const toc = parseToc(tocText);
        renderTocWithPaths(tocContainer, toc, (path) => navigate(path));
      }
    } else {
      tocContainer.innerHTML = '<p class="toc-loading">(No TOC)</p>';
    }

    // Navigate to default topic
    const defaultTopic = sys.defaultTopic || await findFirstHtmlPage(chm);
    if (defaultTopic) {
      await navigate(defaultTopic.startsWith('/') ? defaultTopic : '/' + defaultTopic);
    }

    // Show viewer
    welcomeEl.hidden = true;
    viewerEl.hidden = false;
    setStatus('');
  } catch (err) {
    setStatus(`Failed to open: ${String(err)}`);
    console.error(err);
  }
}

/** Fallback: find the first HTML page if /#SYSTEM has no default topic. */
async function findFirstHtmlPage(chmFile: ChmFile): Promise<string | null> {
  for await (const entry of chmFile.enumerate(ChmEnumerateFlags.All)) {
    const p = entry.path.toLowerCase();
    if (p.endsWith('.html') || p.endsWith('.htm')) {
      return entry.path;
    }
  }
  return null;
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
  reader.onload = () => openChmBuffer(reader.result as ArrayBuffer, file.name);
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
  // hide open UI if present
  try { if (dropZone) dropZone.hidden = true; } catch (e) {}
  try { const openBtn = document.getElementById('open-btn'); if (openBtn) (openBtn as HTMLElement).hidden = true; } catch (e) {}

  (async () => {
    const chmParam = urlParams.get('chm') || urlParams.get('chmUrl') || urlParams.get('url');
    const chmBase64 = urlParams.get('chmBase64') || urlParams.get('base64');
    const name = urlParams.get('name') || undefined;
    try {
      if (chmBase64) {
        const buf = base64ToArrayBuffer(chmBase64);
        await openChmBuffer(buf, name || 'file.chm');
      } else if (chmParam) {
        await openChmFromUrl(chmParam, name);
      } else {
        // wait for host message; show placeholder status
        setStatus('Waiting for host to provide CHM…');
      }
    } catch (err) {
      setStatus(`Plugin open failed: ${String(err)}`);
    }
  })();
}
