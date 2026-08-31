/**
 * TOC (Table of Contents) sidebar panel.
 * Renders the CHM TOC tree into a DOM element and fires callbacks on entry click.
 */

import type { ChmToc, ChmTocEntry } from './lib/toc.js';

export type NavigateCallback = (path: string) => void;

const CHEVRON_RIGHT_SVG = `<svg class="toc-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEVRON_DOWN_SVG = `<svg class="toc-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Render the TOC tree into the given container element. */
export function renderToc(
  container: HTMLElement,
  toc: ChmToc,
  onNavigate: NavigateCallback,
): void {
  container.innerHTML = '';
  if (toc.entries.length === 0) {
    container.textContent = '(No TOC)';
    return;
  }
  const ul = buildList(toc.entries, onNavigate);
  container.appendChild(ul);
}

function buildList(entries: ChmTocEntry[], onNavigate: NavigateCallback): HTMLUListElement {
  const ul = document.createElement('ul');
  for (const entry of entries) {
    ul.appendChild(buildItem(entry, onNavigate));
  }
  return ul;
}

function buildItem(entry: ChmTocEntry, onNavigate: NavigateCallback): HTMLLIElement {
  const li = document.createElement('li');

  const hasChildren = entry.children.length > 0;

  // Toggle button for nodes with children
  if (hasChildren) {
    const toggle = document.createElement('span');
    toggle.className = 'toc-toggle';
    toggle.innerHTML = CHEVRON_RIGHT_SVG;
    toggle.setAttribute('aria-label', 'toggle');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-expanded', 'false');
    li.appendChild(toggle);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = li.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });
  } else {
    // Leaf spacer so text aligns
    const spacer = document.createElement('span');
    spacer.className = 'toc-spacer';
    li.appendChild(spacer);
  }

  const label = document.createElement('span');
  label.className = 'toc-label';
  label.textContent = entry.name || '(Untitled)';

  if (entry.local) {
    label.classList.add('toc-link');
    label.addEventListener('click', () => {
      // Normalize: ensure leading slash
      const path = entry.local!.startsWith('/') ? entry.local! : '/' + entry.local!;
      onNavigate(path);
    });
  }

  li.appendChild(label);

  if (hasChildren) {
    const childUl = buildList(entry.children, onNavigate);
    li.appendChild(childUl);
  }

  return li;
}

/** Highlight the TOC entry that matches a given CHM path. */
export function highlightTocEntry(container: HTMLElement, chmPath: string): void {
  // Remove previous highlight
  for (const el of container.querySelectorAll('.toc-label.active')) {
    el.classList.remove('active');
  }

  const normalizedPath = chmPath.toLowerCase().split('#')[0];
  const links = container.querySelectorAll<HTMLSpanElement>('.toc-label.toc-link');

  for (const link of links) {
    const li = link.closest('li');
    if (!li) continue;

    // Find matching entry by traversing the DOM (we stored the path via closure)
    // We match by checking if the text matches — but we actually need the data attribute approach
    // Instead, rely on the data-path attribute set below
    const dataPath = li.dataset.path;
    if (dataPath && dataPath.toLowerCase() === normalizedPath) {
      link.classList.add('active');
      // Expand parent nodes (no persistent inline styles so collapse still works)
      let parent = li.parentElement?.closest('li');
      while (parent) {
        parent.classList.add('open');
        const toggle = parent.querySelector<HTMLSpanElement>(':scope > .toc-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        parent = parent.parentElement?.closest('li');
      }
      link.scrollIntoView({ block: 'nearest' });
      break;
    }
  }
}

/** Re-render TOC with data-path attributes for highlighting support. */
export function renderTocWithPaths(
  container: HTMLElement,
  toc: ChmToc,
  onNavigate: NavigateCallback,
): void {
  container.innerHTML = '';
  if (toc.entries.length === 0) {
    container.textContent = '(No TOC)';
    return;
  }
  const ul = buildListWithPaths(toc.entries, onNavigate);
  container.appendChild(ul);
}

function buildListWithPaths(
  entries: ChmTocEntry[],
  onNavigate: NavigateCallback,
): HTMLUListElement {
  const ul = document.createElement('ul');
  for (const entry of entries) {
    ul.appendChild(buildItemWithPath(entry, onNavigate));
  }
  return ul;
}

function buildItemWithPath(entry: ChmTocEntry, onNavigate: NavigateCallback): HTMLLIElement {
  const li = document.createElement('li');

  if (entry.local) {
    const path = entry.local.startsWith('/') ? entry.local : '/' + entry.local;
    li.dataset.path = path.toLowerCase().split('#')[0];
  }

  const hasChildren = entry.children.length > 0;

  if (hasChildren) {
    const toggle = document.createElement('span');
    toggle.className = 'toc-toggle';
    toggle.innerHTML = CHEVRON_RIGHT_SVG;
    toggle.setAttribute('aria-label', 'toggle');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-expanded', 'false');
    li.appendChild(toggle);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = li.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'toc-spacer';
    li.appendChild(spacer);
  }

  const label = document.createElement('span');
  label.className = 'toc-label';
  label.textContent = entry.name || '(Untitled)';

  if (entry.local) {
    label.classList.add('toc-link');
    const path = entry.local.startsWith('/') ? entry.local : '/' + entry.local;
    label.addEventListener('click', () => onNavigate(path));
  }

  li.appendChild(label);

  if (hasChildren) {
    const childUl = buildListWithPaths(entry.children, onNavigate);
    li.appendChild(childUl);
  }

  return li;
}
