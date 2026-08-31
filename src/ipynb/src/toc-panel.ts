/**
 * TOC (Table of Contents) sidebar panel.
 * Renders the notebook heading tree and fires callbacks on entry click.
 */

import type { IpynbToc, IpynbTocEntry } from './lib/types.js';

export type NavigateCallback = (fragmentId: string) => void;

const CHEVRON_RIGHT_SVG = `<svg class="toc-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Highlight the TOC entry that matches a fragment id. */
export function highlightTocEntry(container: HTMLElement, fragmentId: string): void {
  for (const el of container.querySelectorAll('.toc-label.active')) {
    el.classList.remove('active');
  }

  const normalized = fragmentId.replace(/^#/, '').toLowerCase();
  if (!normalized) return;

  const links = container.querySelectorAll<HTMLSpanElement>('.toc-label.toc-link');
  for (const link of links) {
    const li = link.closest('li');
    if (!li) continue;
    const dataId = li.dataset.id;
    if (dataId && dataId.toLowerCase() === normalized) {
      link.classList.add('active');
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

/** Render TOC with data-id attributes for highlighting support. */
export function renderTocWithPaths(
  container: HTMLElement,
  toc: IpynbToc,
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
  entries: IpynbTocEntry[],
  onNavigate: NavigateCallback,
): HTMLUListElement {
  const ul = document.createElement('ul');
  for (const entry of entries) {
    ul.appendChild(buildItemWithPath(entry, onNavigate));
  }
  return ul;
}

function buildItemWithPath(entry: IpynbTocEntry, onNavigate: NavigateCallback): HTMLLIElement {
  const li = document.createElement('li');

  if (entry.id) {
    li.dataset.id = entry.id.toLowerCase();
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

  if (entry.id) {
    label.classList.add('toc-link');
    label.addEventListener('click', () => onNavigate(entry.id));
  }

  li.appendChild(label);

  if (hasChildren) {
    const childUl = buildListWithPaths(entry.children, onNavigate);
    li.appendChild(childUl);
  }

  return li;
}
