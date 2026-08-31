import { initFluentIcons } from './fluent-icons.js';

function syncUnitInputWidth(input: HTMLInputElement): void {
  const len = Math.max(String(input.value || '0').length, 1);
  input.style.width = `${len}ch`;
}

/** Wire Fluent chevron step buttons to a number input (hides native spinners via CSS). */
export function initNumberSteppers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.number-stepper').forEach((wrap) => {
    if (wrap.dataset.stepperBound === '1') return;

    const input = wrap.querySelector<HTMLInputElement>('.number-stepper-input');
    if (!input) return;

    wrap.dataset.stepperBound = '1';

    wrap.querySelectorAll<HTMLButtonElement>('.number-stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step);
        if (step > 0) input.stepUp();
        else if (step < 0) input.stepDown();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (wrap.classList.contains('has-unit')) syncUnitInputWidth(input);
      });
    });

    if (wrap.classList.contains('has-unit')) {
      const field = wrap.querySelector<HTMLElement>('.number-stepper-field');
      syncUnitInputWidth(input);
      input.addEventListener('input', () => syncUnitInputWidth(input));

      field?.addEventListener('mousedown', (e) => {
        if (input.disabled) return;
        if (e.target === input) return;
        e.preventDefault();
        input.focus();
        input.select();
      });
    }
  });

  initFluentIcons(root);
}

export function numberStepperHtml(
  id: string,
  className: string,
  attrs: Record<string, string | number | boolean | undefined>,
  unit?: string,
): string {
  const attrParts = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${String(v).replace(/"/g, '&quot;')}"`));

  const valueBlock = unit
    ? `<div class="number-stepper-value">
      <input id="${id}" class="control-input number-stepper-input ${className}" type="number" ${attrParts.join(' ')} />
      <span class="number-stepper-suffix">${unit}</span>
    </div>`
    : `<input id="${id}" class="control-input number-stepper-input ${className}" type="number" ${attrParts.join(' ')} />`;

  const fieldInner = unit
    ? `<div class="number-stepper-field">${valueBlock}</div>`
    : valueBlock;

  return `<div class="number-stepper${unit ? ' has-unit' : ''}">
    ${fieldInner}
    <div class="number-stepper-btns">
      <button type="button" class="number-stepper-btn" data-step="1" title="Increase" aria-label="Increase" data-fluent-icon="chevron_up" data-fluent-size="12"></button>
      <button type="button" class="number-stepper-btn" data-step="-1" title="Decrease" aria-label="Decrease" data-fluent-icon="chevron_down" data-fluent-size="12"></button>
    </div>
  </div>`;
}
