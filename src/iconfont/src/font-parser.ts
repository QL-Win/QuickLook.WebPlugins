import opentype from 'opentype.js';
import type { CssParseResult, FontLoadResult, IconEntry } from './types.js';

const FONT_MIME: Record<string, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function mimeFromFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? 'ttf';
  return FONT_MIME[ext] ?? 'font/ttf';
}

function formatFromMime(mime: string): string {
  if (mime.includes('woff2')) return 'woff2';
  if (mime.includes('woff')) return 'woff';
  if (mime.includes('otf')) return 'opentype';
  return 'truetype';
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function codepointToChar(cp: number): string {
  return cp <= 0xffff
    ? String.fromCharCode(cp)
    : String.fromCodePoint(cp);
}

function defaultIconName(codepoint: number, glyphName: string | null | undefined): string {
  glyphName = glyphName ?? '';
  const cleaned = glyphName.replace(/^uni/i, '').replace(/^u/i, '');
  if (/^[0-9A-Fa-f]{4,6}$/.test(cleaned)) {
    return `u${cleaned.toLowerCase()}`;
  }
  if (glyphName && glyphName !== '.notdef' && !glyphName.startsWith('glyph')) {
    return glyphName.replace(/\s+/g, '-').toLowerCase();
  }
  return `u${codepoint.toString(16).padStart(4, '0')}`;
}

function mergeCssClasses(icons: IconEntry[], css: CssParseResult | null): IconEntry[] {
  if (!css || css.classMap.size === 0) return icons;

  const byCode = new Map<number, IconEntry>();
  for (const icon of icons) {
    byCode.set(icon.codepoint, icon);
  }

  for (const [className, codepoint] of css.classMap) {
    const existing = byCode.get(codepoint);
    if (existing) {
      existing.cssClass = className;
      if (!existing.name.startsWith('u') || className.length > 2) {
        existing.name = className;
      }
    } else {
      const entry: IconEntry = {
        name: className,
        codepoint,
        char: codepointToChar(codepoint),
        cssClass: className,
        index: -1,
      };
      icons.push(entry);
      byCode.set(codepoint, entry);
    }
  }

  return icons.sort((a, b) => a.codepoint - b.codepoint);
}

export function extractIconsFromFont(font: opentype.Font): IconEntry[] {
  const seen = new Set<number>();
  const icons: IconEntry[] = [];

  for (let i = 0; i < font.glyphs.length; i++) {
    const glyph = font.glyphs.get(i);
    if (!glyph || glyph.unicode === undefined || glyph.unicode <= 0) continue;
    if (seen.has(glyph.unicode)) continue;
    seen.add(glyph.unicode);

    icons.push({
      name: defaultIconName(glyph.unicode, glyph.name),
      codepoint: glyph.unicode,
      char: codepointToChar(glyph.unicode),
      index: i,
    });
  }

  return icons.sort((a, b) => a.codepoint - b.codepoint);
}

export async function loadFontFile(
  file: File,
  css?: CssParseResult | null,
): Promise<FontLoadResult> {
  const buffer = await file.arrayBuffer();
  return loadFontBuffer(buffer, file.name, mimeFromFileName(file.name), css);
}

export async function loadFontBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  css?: CssParseResult | null,
): Promise<FontLoadResult> {
  const font = opentype.parse(buffer);
  let icons = extractIconsFromFont(font);
  icons = mergeCssClasses(icons, css ?? null);

  if (icons.length === 0) {
    throw new Error('No usable glyphs found in font file');
  }

  const familyName = css?.familyName || font.names.fontFamily?.en || fileName.replace(/\.[^.]+$/, '');
  const base64 = bufferToBase64(buffer);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return {
    familyName,
    icons,
    dataUrl,
    mimeType,
    fileName,
  };
}

export function buildFontFaceCss(familyName: string, dataUrl: string, mimeType: string): string {
  const format = formatFromMime(mimeType);
  const safeFamily = familyName.replace(/"/g, '\\"');
  return `@font-face {
  font-family: "${safeFamily}";
  src: url("${dataUrl}") format("${format}");
  font-display: block;
}`;
}

export function codepointHex(cp: number): string {
  return cp.toString(16).toUpperCase().padStart(cp <= 0xffff ? 4 : 6, '0');
}

export function iconHtmlSnippet(
  icon: IconEntry,
  familyName: string,
  size = 24,
  color = 'currentColor',
  cssPrefix = 'iconfont',
): string {
  if (icon.cssClass) {
    return `<i class="${cssPrefix} ${icon.cssClass}" style="font-size:${size}px;color:${color}"></i>`;
  }
  return `<span class="${cssPrefix}" style="font-family:'${familyName}';font-size:${size}px;color:${color}">${icon.char}</span>`;
}

export function iconCssSnippet(icon: IconEntry, cssPrefix = 'iconfont'): string {
  const hex = codepointHex(icon.codepoint);
  const name = icon.cssClass ?? `.${cssPrefix}-${icon.name}`;
  const selector = name.startsWith('.') ? name : `.${name}`;
  return `${selector}:before {
  content: "\\${hex}";
}`;
}

export function iconUnicodeSnippet(icon: IconEntry): string {
  const cp = icon.codepoint;
  if (cp <= 0xffff) {
    return `\\u${codepointHex(cp)}`;
  }
  return `\\u{${codepointHex(cp)}}`;
}

export function iconCharEntity(icon: IconEntry): string {
  return `&#x${codepointHex(icon.codepoint)};`;
}
