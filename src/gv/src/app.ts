/**
 * gv — browser-based Graphviz viewer.
 *
 * Handles file selection/drop, drives rendering via @viz-js/viz,
 * and manages pan/zoom of the resulting SVG.
 */

import { renderDot } from './renderer.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────

const fileInput      = document.getElementById('file-input')     as HTMLInputElement | null;
const engineSelect   = document.getElementById('engine-select')  as HTMLSelectElement;
const zoomInBtn      = document.getElementById('zoom-in-btn')    as HTMLButtonElement;
const zoomOutBtn     = document.getElementById('zoom-out-btn')   as HTMLButtonElement;
const fitBtn         = document.getElementById('fit-btn')        as HTMLButtonElement;
const resetBtn       = document.getElementById('reset-btn')      as HTMLButtonElement;
const titleEl        = document.getElementById('title')          as HTMLSpanElement;
const statusEl       = document.getElementById('status')         as HTMLDivElement;
const welcomeEl      = document.getElementById('welcome')        as HTMLDivElement | null;
const viewerEl       = document.getElementById('viewer')         as HTMLDivElement;
const graphContainer = document.getElementById('graph-container') as HTMLDivElement;
const graphCanvas    = document.getElementById('graph-canvas')   as HTMLDivElement;

// ─── Plugin mode detection ───────────────────────────────────────────────────

const pluginMode =
  Boolean((window as any).__GV_PLUGIN) ||
  new URLSearchParams(location.search).get('plugin') === '1' ||
  document.body.dataset.plugin === '1';

// ─── Pan / Zoom state ────────────────────────────────────────────────────────

let scale = 1;
let tx    = 0;
let ty    = 0;

const ZOOM_STEP = 1.25;
const MIN_SCALE = 0.02;
const MAX_SCALE = 50;

function applyTransform(): void {
  graphCanvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function zoomAt(factor: number, cx: number, cy: number): void {
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
  const ratio    = newScale / scale;
  tx    = cx - (cx - tx) * ratio;
  ty    = cy - (cy - ty) * ratio;
  scale = newScale;
  applyTransform();
}

/**
 * Convert a Graphviz SVG dimension attribute (e.g. "134pt" or "200") to CSS px.
 * Graphviz outputs points (1 pt = 96/72 CSS px at standard screen resolution).
 */
function svgAttrToPx(attr: string): number {
  const m = attr.match(/^([0-9.]+)(pt)?$/);
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2] === 'pt' ? 96 / 72 : 1);
}

function fitToView(): void {
  const svg = graphCanvas.querySelector<SVGSVGElement>('svg');
  if (!svg) return;

  const { width: cw, height: ch } = graphContainer.getBoundingClientRect();
  const svgW = svgAttrToPx(svg.getAttribute('width')  ?? '');
  const svgH = svgAttrToPx(svg.getAttribute('height') ?? '');

  if (svgW <= 0 || svgH <= 0 || cw <= 0 || ch <= 0) return;

  scale = Math.min(cw / svgW, ch / svgH) * 0.95;
  tx    = (cw - svgW * scale) / 2;
  ty    = (ch - svgH * scale) / 2;
  applyTransform();
}

// ─── Rendering ───────────────────────────────────────────────────────────────

let currentDot = '';

async function render(dot: string, engine?: string): Promise<void> {
  const eng = engine ?? engineSelect.value;
  setStatus('Rendering…');

  try {
    const svgEl = await renderDot(dot, eng);
    graphCanvas.innerHTML = '';
    graphCanvas.appendChild(svgEl);
    currentDot = dot;
    setStatus('');
    showViewer();
    // Fit graph into view after the SVG is laid out
    requestAnimationFrame(() => fitToView());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Error: ${msg}`, true);
    showViewer();
  }
}

// ─── Status bar ──────────────────────────────────────────────────────────────

function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg;
  statusEl.hidden      = !msg;
  statusEl.classList.toggle('error', isError);
}

// ─── Welcome ↔ Viewer visibility ─────────────────────────────────────────────

function showViewer(): void {
  if (welcomeEl) welcomeEl.hidden = true;
  viewerEl.hidden = false;
}

// ─── File loading ────────────────────────────────────────────────────────────

async function loadFile(file: File): Promise<void> {
  titleEl.textContent = file.name;
  const dot = await file.text();
  await render(dot);
}

// ─── Event: file input ───────────────────────────────────────────────────────

fileInput?.addEventListener('change', () => {
  const file = fileInput!.files?.[0];
  if (file) loadFile(file);
});

// ─── Event: engine selector ──────────────────────────────────────────────────

engineSelect.addEventListener('change', () => {
  if (currentDot) render(currentDot);
});

// ─── Event: zoom / fit buttons ───────────────────────────────────────────────

zoomInBtn.addEventListener('click', () => {
  const { width: cw, height: ch } = graphContainer.getBoundingClientRect();
  zoomAt(ZOOM_STEP, cw / 2, ch / 2);
});

zoomOutBtn.addEventListener('click', () => {
  const { width: cw, height: ch } = graphContainer.getBoundingClientRect();
  zoomAt(1 / ZOOM_STEP, cw / 2, ch / 2);
});

fitBtn.addEventListener('click', fitToView);

resetBtn.addEventListener('click', () => {
  scale = 1; tx = 0; ty = 0;
  applyTransform();
});

// ─── Event: keyboard shortcuts ───────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomInBtn.click(); }
    if (e.key === '-')                  { e.preventDefault(); zoomOutBtn.click(); }
    if (e.key === '0')                  { e.preventDefault(); fitToView(); }
    if (e.key === '1')                  { e.preventDefault(); resetBtn.click(); }
  }
});

// ─── Event: mouse drag (pan) ─────────────────────────────────────────────────

let dragging = false;
let lastX    = 0;
let lastY    = 0;

graphContainer.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  graphContainer.style.cursor = 'grabbing';
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  tx += e.clientX - lastX;
  ty += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  applyTransform();
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  graphContainer.style.cursor = 'grab';
});

// ─── Event: mouse wheel (zoom) ───────────────────────────────────────────────

graphContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  const rect   = graphContainer.getBoundingClientRect();
  zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });

// ─── Event: touch (pinch-zoom + pan) ─────────────────────────────────────────

let lastTouchDist = 0;
let lastTouchMidX = 0;
let lastTouchMidY = 0;

graphContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    dragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    dragging = false;
    const dx = e.touches[1].clientX - e.touches[0].clientX;
    const dy = e.touches[1].clientY - e.touches[0].clientY;
    lastTouchDist = Math.hypot(dx, dy);
    lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
  e.preventDefault();
}, { passive: false });

graphContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && dragging) {
    tx += e.touches[0].clientX - lastX;
    ty += e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    applyTransform();
  } else if (e.touches.length === 2) {
    const dx   = e.touches[1].clientX - e.touches[0].clientX;
    const dy   = e.touches[1].clientY - e.touches[0].clientY;
    const dist = Math.hypot(dx, dy);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rect = graphContainer.getBoundingClientRect();
    if (lastTouchDist > 0) {
      zoomAt(dist / lastTouchDist, midX - rect.left, midY - rect.top);
    }
    lastTouchDist = dist;
    lastTouchMidX = midX;
    lastTouchMidY = midY;
  }
  e.preventDefault();
}, { passive: false });

graphContainer.addEventListener('touchend', () => {
  dragging = false;
  lastTouchDist = 0;
});

// ─── Drag-and-drop file loading ──────────────────────────────────────────────

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
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  });
}

const dropZone = document.getElementById('drop-zone');
if (dropZone) attachDropHandlers(dropZone);
attachDropHandlers(graphContainer); // allow dropping a new file onto the viewer

// ─── Plugin API ──────────────────────────────────────────────────────────────

if (pluginMode) {
  // postMessage-based API:
  //   parent.postMessage({ type: 'gv-render', dot: '...', engine: 'dot' }, '*')
  window.addEventListener('message', (e: MessageEvent) => {
    if (!e.data || e.data.type !== 'gv-render') return;
    const dot    = String(e.data.dot ?? '');
    const engine = e.data.engine ? String(e.data.engine) : undefined;
    if (engine) engineSelect.value = engine;
    render(dot, engine);
  });

  // Direct JS API (when embedding in the same origin):
  //   iframeEl.contentWindow.__GV_RENDER('digraph { a -> b }', 'dot')
  (window as any).__GV_RENDER = (dot: string, engine?: string) => {
    if (engine) engineSelect.value = engine;
    render(dot, engine);
  };
}
