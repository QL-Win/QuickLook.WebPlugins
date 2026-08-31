/**
 * Fluent System Icons (Regular 24) — sourced from FluentUI.SystemIcons.Assets
 * https://github.com/microsoft/fluentui-system-icons
 */

import arrowDownload from '../assets/fluent/ic_fluent_arrow_download_24_regular.svg?raw';
import folderOpen from '../assets/fluent/ic_fluent_folder_open_24_regular.svg?raw';
import search from '../assets/fluent/ic_fluent_search_24_regular.svg?raw';
import copy from '../assets/fluent/ic_fluent_copy_24_regular.svg?raw';
import checkmark from '../assets/fluent/ic_fluent_checkmark_24_regular.svg?raw';
import chevronLeft from '../assets/fluent/ic_fluent_chevron_left_24_regular.svg?raw';
import chevronRight from '../assets/fluent/ic_fluent_chevron_right_24_regular.svg?raw';
import chevronUp from '../assets/fluent/ic_fluent_chevron_up_24_regular.svg?raw';
import chevronDown from '../assets/fluent/ic_fluent_chevron_down_24_regular.svg?raw';
import weatherSunny from '../assets/fluent/ic_fluent_weather_sunny_24_regular.svg?raw';
import weatherMoon from '../assets/fluent/ic_fluent_weather_moon_24_regular.svg?raw';
import textFont from '../assets/fluent/ic_fluent_text_font_24_regular.svg?raw';

export const FLUENT_ICONS = {
  arrow_download: arrowDownload,
  folder_open: folderOpen,
  search,
  copy,
  checkmark,
  chevron_left: chevronLeft,
  chevron_right: chevronRight,
  chevron_up: chevronUp,
  chevron_down: chevronDown,
  weather_sunny: weatherSunny,
  weather_moon: weatherMoon,
  text_font: textFont,
} as const;

export type FluentIconName = keyof typeof FLUENT_ICONS;

export function fluentIconHtml(
  name: FluentIconName,
  size = 24,
  className = '',
): string {
  const raw = FLUENT_ICONS[name];
  const cls = className ? `fluent-icon ${className}` : 'fluent-icon';
  return raw
    .replace(/width="24"/, `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`)
    .replace(/fill="#212121"/g, 'fill="currentColor"')
    .replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `);
}

export function mountFluentIcon(
  el: HTMLElement,
  name: FluentIconName,
  size = 24,
  className = '',
): void {
  el.innerHTML = fluentIconHtml(name, size, className);
}

export function initFluentIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-fluent-icon]').forEach((el) => {
    const name = el.dataset.fluentIcon as FluentIconName;
    if (!FLUENT_ICONS[name]) return;
    const size = Number(el.dataset.fluentSize) || 24;
    const extraClass = el.dataset.fluentClass ?? '';
    mountFluentIcon(el, name, size, extraClass);
  });
}
