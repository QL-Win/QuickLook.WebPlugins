import { initFluentIcons } from './fluent-icons.js';

export const PAGE_SIZE_PRESETS = [10, 50, 100, 500, 1000, 5000, 10000, 15000, 20000] as const;

export type PageSizeComboboxHandlers = {
  getCurrent: () => number;
  clamp: (value: number) => number;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
};

function parsePageSizeInput(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) && v > 0 ? v : null;
}

function closePopup(wrap: HTMLElement): void {
  const popup = wrap.querySelector<HTMLElement>('.fluent-combobox-popup');
  const toggle = wrap.querySelector<HTMLButtonElement>('.fluent-combobox-toggle');
  if (!popup || popup.hidden) return;
  popup.hidden = true;
  wrap.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
}

function openPopup(wrap: HTMLElement): void {
  const input = wrap.querySelector<HTMLInputElement>('.fluent-combobox-input');
  const popup = wrap.querySelector<HTMLElement>('.fluent-combobox-popup');
  const toggle = wrap.querySelector<HTMLButtonElement>('.fluent-combobox-toggle');
  if (!popup || !input || input.disabled) return;
  popup.hidden = false;
  wrap.classList.add('open');
  toggle?.setAttribute('aria-expanded', 'true');
  const current = String(handlersCache.get(wrap)?.getCurrent() ?? input.value);
  popup.querySelectorAll<HTMLElement>('.fluent-combobox-option').forEach((opt) => {
    opt.classList.toggle('selected', opt.dataset.value === current);
  });
}

const handlersCache = new WeakMap<HTMLElement, PageSizeComboboxHandlers>();

function commitInput(wrap: HTMLElement, input: HTMLInputElement): void {
  const handlers = handlersCache.get(wrap);
  if (!handlers) return;
  const parsed = parsePageSizeInput(input.value);
  if (parsed === null) {
    input.value = String(handlers.getCurrent());
    return;
  }
  const clamped = handlers.clamp(parsed);
  handlers.onCommit(clamped);
  input.value = String(clamped);
  closePopup(wrap);
}

/** Wire Fluent-style editable combobox for icons-per-page. */
export function initPageSizeCombobox(
  wrap: HTMLElement,
  handlers: PageSizeComboboxHandlers,
): HTMLInputElement {
  if (wrap.dataset.comboboxBound === '1') {
    return wrap.querySelector<HTMLInputElement>('.fluent-combobox-input')!;
  }

  wrap.dataset.comboboxBound = '1';
  handlersCache.set(wrap, handlers);

  const input = wrap.querySelector<HTMLInputElement>('.fluent-combobox-input');
  const toggle = wrap.querySelector<HTMLButtonElement>('.fluent-combobox-toggle');
  const popup = wrap.querySelector<HTMLElement>('.fluent-combobox-popup');
  if (!input || !toggle || !popup) {
    throw new Error('page-size combobox markup is incomplete');
  }

  toggle.addEventListener('click', () => {
    if (popup.hidden) openPopup(wrap);
    else closePopup(wrap);
  });

  popup.querySelectorAll<HTMLButtonElement>('.fluent-combobox-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const v = Number(opt.dataset.value);
      if (!Number.isFinite(v)) return;
      handlers.onCommit(handlers.clamp(v));
      input.value = String(handlers.getCurrent());
      closePopup(wrap);
    });
  });

  input.addEventListener('input', () => {
    const parsed = parsePageSizeInput(input.value);
    if (parsed !== null) handlers.onPreview(handlers.clamp(parsed));
  });

  input.addEventListener('change', () => commitInput(wrap, input));
  input.addEventListener('blur', () => commitInput(wrap, input));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInput(wrap, input);
      input.blur();
      return;
    }
    if (e.key === 'Escape') {
      input.value = String(handlers.getCurrent());
      closePopup(wrap);
      return;
    }
    if (e.key === 'ArrowDown' && popup.hidden) {
      e.preventDefault();
      openPopup(wrap);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target as Node)) closePopup(wrap);
  });

  initFluentIcons(wrap);
  return input;
}

export function pageSizeComboboxHtml(
  id: string,
  value: number,
  disabled = false,
): string {
  const options = PAGE_SIZE_PRESETS.map(
    (n) => `<button type="button" class="fluent-combobox-option" role="option" data-value="${n}">${n}</button>`,
  ).join('');

  const dis = disabled ? ' disabled' : '';

  return `<div class="fluent-combobox page-size-combobox" id="page-size-combobox">
    <div class="fluent-combobox-field">
      <input id="${id}" class="fluent-combobox-input" type="text" inputmode="numeric" value="${value}" title="Icons per page" autocomplete="off"${dis} />
      <button type="button" class="fluent-combobox-toggle" aria-label="Icons per page options" aria-expanded="false" data-fluent-icon="chevron_down" data-fluent-size="12"${dis}></button>
    </div>
    <div class="fluent-combobox-popup" role="listbox" aria-label="Icons per page" hidden>
      ${options}
    </div>
  </div>`;
}
