import type { CssParseResult } from './types.js';

/** Parse iconfont.cn / alibaba iconfont style CSS for class → codepoint mapping */
export function parseIconfontCss(text: string): CssParseResult {
  const classMap = new Map<string, number>();
  let familyName: string | undefined;

  const familyRe = /font-family\s*:\s*["']?([^"';}\s]+)["']?\s*;/gi;
  let fm: RegExpExecArray | null;
  while ((fm = familyRe.exec(text)) !== null) {
    familyName = fm[1].trim();
  }

  const ruleRe = /\.([a-zA-Z0-9_-]+)\s*:before\s*\{[^}]*content\s*:\s*["']\\([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(text)) !== null) {
    const className = m[1];
    const hex = m[2].replace(/^\\+/, '');
    const codepoint = parseInt(hex, 16);
    if (!Number.isNaN(codepoint)) {
      classMap.set(className, codepoint);
    }
  }

  return { familyName, classMap };
}
