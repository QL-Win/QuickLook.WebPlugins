/**
 * Syntax highlight themes — Microsoft Fluent blue palette.
 *
 * Replaces highlight.js "github" / "github-dark" (which use GitHub red #d73a49
 * for keywords). Colors align with Fluent UI / Windows accent blues.
 */

import type { ResolvedTheme } from './theme.js';

/** Fluent accent references: #0078D4 (light), #60CDFF (dark) */
const HLJS_LIGHT = `
.hljs {
  color: #242424;
  background: #f5f5f5;
}
.hljs-comment,
.hljs-quote {
  color: #6e6e6e;
  font-style: italic;
}
.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-name,
.hljs-strong {
  color: #0078d4;
  font-weight: 600;
}
.hljs-built_in,
.hljs-type,
.hljs-params {
  color: #005a9e;
}
.hljs-number,
.hljs-symbol,
.hljs-bullet {
  color: #4f6bed;
}
.hljs-string,
.hljs-regexp,
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string {
  color: #038387;
}
.hljs-title,
.hljs-section,
.hljs-title.function_,
.hljs-title.class_,
.hljs-title.class_.inherited__ {
  color: #005fb8;
  font-weight: 600;
}
.hljs-variable,
.hljs-template-variable,
.hljs-selector-id,
.hljs-selector-class,
.hljs-selector-attr,
.hljs-attr {
  color: #5b5fc7;
}
.hljs-doctag,
.hljs-meta,
.hljs-meta .hljs-keyword {
  color: #0067c0;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-deletion {
  color: #c50f1f;
  background: #fde7e9;
}
.hljs-link {
  color: #0078d4;
  text-decoration: underline;
}
.hljs-subst {
  color: #242424;
}
`;

const HLJS_DARK = `
.hljs {
  color: #e6e6e6;
  background: #1e1e1e;
}
.hljs-comment,
.hljs-quote {
  color: #9d9d9d;
  font-style: italic;
}
.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-name,
.hljs-strong {
  color: #60cdff;
  font-weight: 600;
}
.hljs-built_in,
.hljs-type,
.hljs-params {
  color: #82c7ff;
}
.hljs-number,
.hljs-symbol,
.hljs-bullet {
  color: #9cdcfe;
}
.hljs-string,
.hljs-regexp,
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string {
  color: #6cffe0;
}
.hljs-title,
.hljs-section,
.hljs-title.function_,
.hljs-title.class_,
.hljs-title.class_.inherited__ {
  color: #4fc1ff;
  font-weight: 600;
}
.hljs-variable,
.hljs-template-variable,
.hljs-selector-id,
.hljs-selector-class,
.hljs-selector-attr,
.hljs-attr {
  color: #b4a0ff;
}
.hljs-doctag,
.hljs-meta,
.hljs-meta .hljs-keyword {
  color: #7ec8ff;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-deletion {
  color: #ff99a4;
  background: #442726;
}
.hljs-link {
  color: #60cdff;
  text-decoration: underline;
}
.hljs-subst {
  color: #e6e6e6;
}
`;

export function hljsThemeCss(theme: ResolvedTheme): string {
  return theme === 'dark' ? HLJS_DARK : HLJS_LIGHT;
}
