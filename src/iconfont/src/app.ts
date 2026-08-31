/**
 * iconfont — browser-based icon font viewer.
 */

import { initFluentIcons, mountFluentIcon } from './fluent-icons.js';
import { initNumberSteppers, numberStepperHtml } from './number-stepper.js';
import { initPageSizeCombobox } from './page-size-combobox.js';
import { parseIconfontCss } from './css-parser.js';
import {
  buildFontFaceCss,
  iconCharEntity,
  iconUnicodeSnippet,
  loadFontBuffer,
  loadFontFile,
} from './font-parser.js';
import type { CssParseResult, IconEntry, IconFontState, PluginLoadPayload } from './types.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────

const fontInput      = document.getElementById('font-input')      as HTMLInputElement;
const cssInput       = document.getElementById('css-input')       as HTMLInputElement | null;
const searchInput    = document.getElementById('search-input')    as HTMLInputElement;
const sizeInput      = document.getElementById('size-input')      as HTMLInputElement;
const colorInput     = document.getElementById('color-input')     as HTMLInputElement;
const themeBtn       = document.getElementById('theme-btn')       as HTMLButtonElement | null;
const statusEl       = document.getElementById('status')          as HTMLDivElement;
const welcomeEl      = document.getElementById('welcome')         as HTMLDivElement;
const browserEl      = document.getElementById('browser')         as HTMLDivElement;
const iconsGrid      = document.getElementById('icons-grid')      as HTMLDivElement;
const detailPanel    = document.getElementById('detail-panel')    as HTMLElement;
const fontFaceEl     = document.getElementById('iconfont-face')   as HTMLStyleElement;
const setTitleEl     = document.getElementById('set-title')       as HTMLHeadingElement;
const setFamilyEl    = document.getElementById('set-family')      as HTMLElement;
const setFileEl      = document.getElementById('set-file')        as HTMLElement;
const setGridEl      = document.getElementById('set-grid')        as HTMLElement;
const visibleCountEl = document.getElementById('visible-count')  as HTMLElement;
const totalCountEl   = document.getElementById('total-count')     as HTMLElement;
const pagePrevBtn    = document.getElementById('page-prev')       as HTMLButtonElement;
const pageNextBtn    = document.getElementById('page-next')       as HTMLButtonElement;
const pageSizeCombobox = document.getElementById('page-size-combobox') as HTMLElement;
const pageSizeInput  = document.getElementById('page-size-input')  as HTMLInputElement;
const pageInfoEl     = document.getElementById('page-info')       as HTMLElement;
const dropZone       = document.getElementById('drop-zone')       as HTMLElement | null;

// ─── Plugin mode ─────────────────────────────────────────────────────────────

const pluginMode =
  Boolean((window as unknown as { __ICONFONT_PLUGIN?: boolean }).__ICONFONT_PLUGIN) ||
  new URLSearchParams(location.search).get('plugin') === '1' ||
  document.body.dataset.plugin === '1';

// ─── State ───────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10000;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20000;
const MIN_ICON_SIZE = 12;
const MAX_ICON_SIZE = 128;
const DEFAULT_ICON_SIZE = 48;
const MAX_DETAIL_PREVIEW_SIZE = 256;
let state: IconFontState | null = null;
let cssCache: CssParseResult | null = null;
let cssFileName: string | undefined;
let filteredIcons: IconEntry[] = [];
let selectedIcon: IconEntry | null = null;
let currentPage = 0;
let pageSize = DEFAULT_PAGE_SIZE;
let previewSize = DEFAULT_ICON_SIZE;
let previewColor = defaultIconColor();
let detailPreviewSize = DEFAULT_ICON_SIZE;
let detailPreviewColor = defaultIconColor();
let manualTheme: 'light' | 'dark' | null = null;
let statusTimer = 0;

const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// ─── Theme ───────────────────────────────────────────────────────────────────

function isDarkTheme(): boolean {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return prefersDarkQuery.matches;
}

function defaultIconColor(): string {
  return isDarkTheme() ? '#e8e8ed' : '#1e293b';
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  previewColor = defaultIconColor();
  colorInput.value = previewColor;
  detailPreviewColor = previewColor;
  const detailColorInput = detailPanel.querySelector('#detail-color') as HTMLInputElement | null;
  if (detailColorInput) detailColorInput.value = previewColor;
  updateGridPreview();
  updateDetailPreview();
}

function syncThemeFromSystem(): void {
  if (manualTheme) {
    applyTheme(manualTheme);
  } else {
    applyTheme(prefersDarkQuery.matches ? 'dark' : 'light');
  }
}

if (!pluginMode && themeBtn) {
  themeBtn.addEventListener('click', () => {
    manualTheme = isDarkTheme() ? 'light' : 'dark';
    applyTheme(manualTheme);
  });
}

prefersDarkQuery.addEventListener('change', () => {
  if (manualTheme === null) syncThemeFromSystem();
});

syncThemeFromSystem();
applyIconSize(DEFAULT_ICON_SIZE, false);

function clampIconSize(v: number): number {
  return Math.max(MIN_ICON_SIZE, Math.min(MAX_ICON_SIZE, v));
}

function applyIconSize(size: number, syncInput = true): void {
  previewSize = clampIconSize(size);
  document.documentElement.style.setProperty('--icon-size', `${previewSize}px`);
  if (syncInput) sizeInput.value = String(previewSize);
  setGridEl.textContent = `${previewSize}px`;
  updateGridPreview();
}

function commitSizeInput(input: HTMLInputElement): void {
  const v = Number(input.value);
  if (!Number.isNaN(v)) applyIconSize(v);
  else input.value = String(previewSize);
}

function bindSizeInput(input: HTMLInputElement): void {
  input.addEventListener('input', () => {
    const v = Number(input.value);
    if (input.value !== '' && !Number.isNaN(v) && v >= MIN_ICON_SIZE && v <= MAX_ICON_SIZE) {
      applyIconSize(v, input === sizeInput);
    }
  });
  input.addEventListener('change', () => commitSizeInput(input));
  input.addEventListener('blur', () => commitSizeInput(input));
}

function syncDetailPreviewFromGlobal(): void {
  detailPreviewSize = previewSize;
  detailPreviewColor = previewColor;
}

function updateDetailPreview(): void {
  const glyph = detailPanel.querySelector('#detail-glyph') as HTMLElement | null;
  if (glyph) {
    glyph.style.fontSize = `${detailPreviewSize}px`;
    glyph.style.color = detailPreviewColor;
  }
}

function updateGridPreview(): void {
  document.querySelectorAll('#icons-grid .icon-glyph').forEach((el) => {
    (el as HTMLElement).style.color = previewColor;
  });
}

function clampDetailPreviewSize(v: number): number {
  return Math.max(MIN_ICON_SIZE, Math.min(MAX_DETAIL_PREVIEW_SIZE, v));
}

function applyDetailPreviewSize(size: number, syncInput = true): void {
  detailPreviewSize = clampDetailPreviewSize(size);
  if (syncInput) {
    const input = detailPanel.querySelector('#detail-size') as HTMLInputElement | null;
    if (input) input.value = String(detailPreviewSize);
  }
  updateDetailPreview();
}

function commitDetailSizeInput(input: HTMLInputElement): void {
  const v = Number(input.value);
  if (!Number.isNaN(v)) applyDetailPreviewSize(v);
  else input.value = String(detailPreviewSize);
}

function clampPageSize(v: number): number {
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, v));
}

function applyPageSize(size: number, syncInput = true): void {
  pageSize = clampPageSize(size);
  currentPage = 0;
  if (syncInput) pageSizeInput.value = String(pageSize);
  renderGrid();
}

function bindPageSizeInput(): void {
  initPageSizeCombobox(pageSizeCombobox, {
    getCurrent: () => pageSize,
    clamp: clampPageSize,
    onPreview: (v) => {
      pageSize = v;
      currentPage = 0;
      renderGrid();
    },
    onCommit: (v) => applyPageSize(v),
  });
}

// ─── Status ──────────────────────────────────────────────────────────────────

function setStatus(msg: string, isError = false): void {
  window.clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
  statusEl.classList.toggle('error', isError);
  if (msg && !isError) {
    statusTimer = window.setTimeout(() => {
      statusEl.hidden = true;
    }, 2000);
  }
}

// ─── Font loading ────────────────────────────────────────────────────────────

async function applyFont(result: IconFontState): Promise<void> {
  state = result;
  selectedIcon = null;
  currentPage = 0;
  searchInput.value = '';
  searchInput.disabled = false;
  sizeInput.disabled = false;
  colorInput.disabled = false;
  pageSizeInput.disabled = false;
  pageSizeCombobox.querySelector<HTMLButtonElement>('.fluent-combobox-toggle')!.disabled = false;

  fontFaceEl.textContent = buildFontFaceCss(result.familyName, result.dataUrl, result.mimeType);

  setTitleEl.textContent = result.familyName;
  setFamilyEl.textContent = result.familyName;
  setFileEl.textContent = result.fileName;
  setGridEl.textContent = `${previewSize}px`;

  filteredIcons = [...result.icons];
  renderGrid();
  showBrowser();
  renderDetailEmpty();
  setStatus('');
}

async function loadFontWithCss(file: File): Promise<void> {
  setStatus('Loading font…');
  try {
    const result = await loadFontFile(file, cssCache);
    await applyFont({ ...result, cssFileName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(msg, true);
  }
}

async function loadCssFile(file: File): Promise<void> {
  const text = await file.text();
  cssCache = parseIconfontCss(text);
  cssFileName = file.name;
}

async function loadFromPlugin(payload: PluginLoadPayload): Promise<void> {
  setStatus('Loading font…');
  try {
    const binary = atob(payload.fontBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const fileName = payload.fileName ?? 'font.woff2';
    const mimeType = payload.mimeType ?? 'font/woff2';
    const css = payload.cssText ? parseIconfontCss(payload.cssText) : cssCache;

    const result = await loadFontBuffer(bytes.buffer, fileName, mimeType, css);
    if (payload.familyName) result.familyName = payload.familyName;

    await applyFont({ ...result, cssFileName: payload.cssText ? 'inline.css' : cssFileName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(msg, true);
  }
}

// ─── Visibility ──────────────────────────────────────────────────────────────

function showBrowser(): void {
  welcomeEl.hidden = true;
  browserEl.hidden = false;
}

function renderDetailEmpty(): void {
  detailPanel.className = 'empty';
  detailPanel.innerHTML = '<p>Select an icon to view details<br/>and copy snippets</p>';
}

// ─── Search & filter ─────────────────────────────────────────────────────────

function filterIcons(query: string): void {
  if (!state) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    filteredIcons = [...state.icons];
  } else {
    filteredIcons = state.icons.filter((icon) => {
      const hex = icon.codepoint.toString(16);
      return (
        icon.name.toLowerCase().includes(q) ||
        (icon.cssClass?.toLowerCase().includes(q) ?? false) ||
        hex.includes(q.replace(/^u|^0x|^\\+/i, '')) ||
        icon.codepoint.toString().includes(q)
      );
    });
  }
  currentPage = 0;
  selectedIcon = null;
  renderGrid();
  renderDetailEmpty();
}

function iconDisplayName(icon: IconEntry): string {
  return icon.cssClass ?? icon.name;
}

// ─── Grid rendering ──────────────────────────────────────────────────────────

function renderGrid(): void {
  if (!state) return;

  const total = filteredIcons.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, totalPages - 1);

  const start = currentPage * pageSize;
  const pageIcons = filteredIcons.slice(start, start + pageSize);

  iconsGrid.innerHTML = '';

  if (pageIcons.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = searchInput.value.trim() ? 'No matching icons' : 'No icons in font';
    iconsGrid.appendChild(empty);
  } else {
    const frag = document.createDocumentFragment();
    for (const icon of pageIcons) {
      frag.appendChild(createIconCell(icon));
    }
    iconsGrid.appendChild(frag);
  }

  visibleCountEl.textContent = String(pageIcons.length);
  totalCountEl.textContent = String(total);
  pageInfoEl.textContent = total > 0 ? `${currentPage + 1} / ${totalPages}` : '—';
  pagePrevBtn.disabled = currentPage <= 0;
  pageNextBtn.disabled = currentPage >= totalPages - 1;
}

function createIconCell(icon: IconEntry): HTMLElement {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'icon-cell';
  cell.title = iconDisplayName(icon);
  cell.dataset.codepoint = String(icon.codepoint);
  if (selectedIcon?.codepoint === icon.codepoint) {
    cell.classList.add('selected');
  }

  const glyphWrap = document.createElement('span');
  glyphWrap.className = 'icon-glyph-wrap';

  const glyph = document.createElement('i');
  glyph.className = 'icon-glyph';
  glyph.style.fontFamily = `"${state!.familyName}"`;
  glyph.style.color = previewColor;
  glyph.textContent = icon.char;

  glyphWrap.appendChild(glyph);

  const name = document.createElement('span');
  name.className = 'icon-name';
  name.textContent = iconDisplayName(icon);

  cell.append(glyphWrap, name);
  cell.addEventListener('click', () => selectIcon(icon));
  return cell;
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function selectIcon(icon: IconEntry): void {
  if (!state) return;
  selectedIcon = icon;

  document.querySelectorAll('.icon-cell.selected').forEach((el) => el.classList.remove('selected'));
  iconsGrid.querySelector(`.icon-cell[data-codepoint="${icon.codepoint}"]`)?.classList.add('selected');

  renderDetail(icon);
}

function renderDetail(icon: IconEntry): void {
  if (!state) return;

  syncDetailPreviewFromGlobal();

  detailPanel.className = '';
  const hex = icon.codepoint.toString(16).toUpperCase().padStart(4, '0');
  const displayName = iconDisplayName(icon);
  const unicodeCode = iconUnicodeSnippet(icon);
  const entityCode = iconCharEntity(icon);

  detailPanel.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(displayName)}</h2>
      <div class="detail-code">U+${hex}${icon.cssClass ? ` · .${escapeHtml(icon.cssClass)}` : ''}</div>
    </div>
    <div class="detail-body">
      <div class="detail-preview">
        <i class="icon-glyph" id="detail-glyph"></i>
      </div>
      <div class="detail-section">
        <h3>Customize</h3>
        <div class="detail-controls">
          <label class="control-label">Size ${numberStepperHtml('detail-size', 'detail-size-input', { value: detailPreviewSize, min: 12, max: 256, step: 1 }, 'px')}</label>
          <label class="control-label">Color <input id="detail-color" class="control-input detail-color-input" type="color" value="${detailPreviewColor}"></label>
        </div>
      </div>
      ${codeSection('UNICODE', unicodeCode)}
      ${codeSection('Entity', entityCode)}
    </div>
  `;

  const glyph = detailPanel.querySelector('#detail-glyph') as HTMLElement;
  glyph.style.fontFamily = `"${state.familyName}"`;
  glyph.style.fontSize = `${detailPreviewSize}px`;
  glyph.style.color = detailPreviewColor;
  glyph.textContent = icon.char;

  detailPanel.querySelector('#detail-size')?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const v = Number(input.value);
    if (input.value !== '' && !Number.isNaN(v) && v >= MIN_ICON_SIZE && v <= MAX_DETAIL_PREVIEW_SIZE) {
      applyDetailPreviewSize(v);
    }
  });
  detailPanel.querySelector('#detail-size')?.addEventListener('change', (e) => {
    commitDetailSizeInput(e.target as HTMLInputElement);
  });
  detailPanel.querySelector('#detail-size')?.addEventListener('blur', (e) => {
    commitDetailSizeInput(e.target as HTMLInputElement);
  });

  detailPanel.querySelector('#detail-color')?.addEventListener('input', (e) => {
    detailPreviewColor = (e.target as HTMLInputElement).value;
    updateDetailPreview();
  });

  bindCopyButtons();
  initNumberSteppers(detailPanel);
}

function codeSection(label: string, code: string): string {
  return `
    <div class="detail-section">
      <h3>${escapeHtml(label)}</h3>
      <div class="code-block">
        <pre>${escapeHtml(code)}</pre>
        <button type="button" class="copy-btn icon-btn" data-copy="${escapeAttr(code)}" title="Copy" aria-label="Copy" data-fluent-icon="copy" data-fluent-size="16"></button>
      </div>
    </div>`;
}

function bindCopyButtons(): void {
  detailPanel.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(text);
        mountFluentIcon(btn, 'checkmark', 16);
        btn.classList.add('copied');
        btn.title = 'Copied';
        setTimeout(() => {
          mountFluentIcon(btn, 'copy', 16);
          btn.classList.remove('copied');
          btn.title = 'Copy';
        }, 1500);
      } catch {
        setStatus('Copy failed', true);
      }
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─── Events: file inputs ─────────────────────────────────────────────────────

fontInput.addEventListener('change', () => {
  const file = fontInput.files?.[0];
  if (file) loadFontWithCss(file);
  fontInput.value = '';
});

cssInput?.addEventListener('change', async () => {
  const file = cssInput.files?.[0];
  if (file) await loadCssFile(file);
  cssInput.value = '';
});

// ─── Events: search / size / color / pagination ──────────────────────────────

searchInput.addEventListener('input', () => filterIcons(searchInput.value));

bindSizeInput(sizeInput);
bindPageSizeInput();

colorInput.addEventListener('input', () => {
  previewColor = colorInput.value;
  updateGridPreview();
});

pagePrevBtn.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    renderGrid();
  }
});

pageNextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredIcons.length / pageSize);
  if (currentPage < totalPages - 1) {
    currentPage++;
    renderGrid();
  }
});

// ─── Drag and drop ───────────────────────────────────────────────────────────

function attachDropHandlers(el: HTMLElement): void {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget as Node | null)) {
      el.classList.remove('drag-over');
    }
  });
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const files = [...(e.dataTransfer?.files ?? [])];
    const cssFile = files.find((f) => f.name.endsWith('.css'));
    const fontFile = files.find((f) => /\.(ttf|otf|woff2?)$/i.test(f.name));
    if (cssFile) await loadCssFile(cssFile);
    if (fontFile) await loadFontWithCss(fontFile);
  });
}

if (dropZone) attachDropHandlers(dropZone);

// ─── Plugin API ──────────────────────────────────────────────────────────────

if (pluginMode) {
  window.addEventListener('message', (e: MessageEvent) => {
    if (!e.data || e.data.type !== 'iconfont-load') return;
    loadFromPlugin(e.data.payload as PluginLoadPayload);
  });

  (window as unknown as { __ICONFONT_LOAD: typeof loadFromPlugin }).__ICONFONT_LOAD = loadFromPlugin;
}

initFluentIcons();
initNumberSteppers();

export { loadFromPlugin };
