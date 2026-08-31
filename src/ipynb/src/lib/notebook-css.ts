/**
 * Jupyter-like styles injected into the Shadow DOM content host.
 */

export const NOTEBOOK_CSS = `
.ipynb-host {
  --nb-fg: #242424;
  --nb-muted: #6e6e6e;
  --nb-border: #e0e0e0;
  --nb-code-bg: #f5f5f5;
  --nb-input-prompt: #0078d4;
  --nb-output-prompt: #a31515;
  --nb-error-bg: #fde7e9;
  --nb-error-fg: #c50f1f;
  --nb-stream-stderr: #c50f1f;
  --nb-table-border: #ddd;
  --nb-table-header-bg: #f0f0f0;
  --nb-link: #0078d4;
  --nb-link-hover: #005a9e;
  --nb-hr: #c7e0f4;
  --nb-blockquote-border: #c7e0f4;
  --nb-blockquote-fg: #555;
  --nb-inline-code-bg: #f0f0f0;
}

.ipynb-host[data-theme="dark"] {
  --nb-fg: #e6e6e6;
  --nb-muted: #9d9d9d;
  --nb-border: #333;
  --nb-code-bg: #1e1e1e;
  --nb-input-prompt: #60cdff;
  --nb-output-prompt: #ff99a4;
  --nb-error-bg: #442726;
  --nb-error-fg: #ff99a4;
  --nb-stream-stderr: #ff99a4;
  --nb-table-border: #444;
  --nb-table-header-bg: #2c2c2c;
  --nb-link: #60cdff;
  --nb-link-hover: #82c7ff;
  --nb-hr: #3a4a5a;
  --nb-blockquote-border: #555;
  --nb-blockquote-fg: #c8c8c8;
  --nb-inline-code-bg: #2a2a2a;
}

.ipynb-notebook {
  max-width: 960px;
  margin: 0 auto;
}

.nb-cell {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin: 0 0 1em;
  padding: 0.25em 0;
  scroll-margin-top: 0.5em;
}

.nb-prompt {
  flex: 0 0 72px;
  width: 72px;
  padding: 0.4em 0.4em 0 0;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  user-select: none;
  color: var(--nb-muted);
}

.nb-cell-code > .nb-prompt {
  color: var(--nb-input-prompt);
}

.nb-cell-output > .nb-prompt {
  color: var(--nb-output-prompt);
}

.nb-cell-body {
  flex: 1;
  min-width: 0;
}

/* Markdown */
.nb-markdown {
  font-size: 16px;
  line-height: 1.65;
  color: var(--nb-fg);
}

.nb-markdown > *:first-child { margin-top: 0; }
.nb-markdown > *:last-child { margin-bottom: 0; }

.nb-markdown h1,
.nb-markdown h2,
.nb-markdown h3,
.nb-markdown h4,
.nb-markdown h5,
.nb-markdown h6 {
  color: var(--nb-link);
  font-weight: 650;
  line-height: 1.3;
  margin: 1.1em 0 0.45em;
  scroll-margin-top: 0.5em;
}

.nb-markdown h1 { font-size: 1.85em; border-bottom: 1px solid var(--nb-border); padding-bottom: 0.25em; }
.nb-markdown h2 { font-size: 1.45em; border-bottom: 1px solid var(--nb-border); padding-bottom: 0.2em; }
.nb-markdown h3 { font-size: 1.2em; }
.nb-markdown h4 { font-size: 1.05em; }

.nb-markdown p { margin: 0.7em 0; }
.nb-markdown ul, .nb-markdown ol { margin: 0.6em 0; padding-left: 1.6em; }
.nb-markdown li { margin: 0.2em 0; }
.nb-markdown a { color: var(--nb-link); }
.nb-markdown a:hover { color: var(--nb-link-hover); }

.nb-markdown code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--nb-inline-code-bg);
  padding: 0.12em 0.35em;
  border-radius: 4px;
}

.nb-markdown pre {
  background: var(--nb-code-bg);
  border: 1px solid var(--nb-border);
  border-radius: 6px;
  padding: 0.85em 1em;
  overflow-x: auto;
  margin: 0.8em 0;
}

.nb-markdown pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.5;
}

.nb-markdown blockquote {
  margin: 0.8em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 4px solid var(--nb-blockquote-border);
  color: var(--nb-blockquote-fg);
}

.nb-markdown hr {
  border: none;
  border-top: 2px solid var(--nb-hr);
  margin: 1.2em 0;
}

.nb-markdown table {
  border-collapse: collapse;
  margin: 0.8em 0;
  width: 100%;
  overflow-x: auto;
  display: block;
}

.nb-markdown th,
.nb-markdown td {
  border: 1px solid var(--nb-table-border);
  padding: 0.4em 0.7em;
  text-align: left;
}

.nb-markdown th {
  background: var(--nb-table-header-bg);
  font-weight: 600;
}

.nb-markdown img {
  max-width: 100%;
  height: auto;
}

.nb-markdown .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.4em 0;
}

/* Code input */
.nb-code-input {
  background: var(--nb-code-bg);
  border: 1px solid var(--nb-border);
  border-radius: 6px;
  overflow: hidden;
}

.nb-code-input pre {
  margin: 0;
  padding: 0.75em 1em;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.nb-code-input pre code {
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
}

/* Outputs */
.nb-outputs {
  margin-top: 0.35em;
}

.nb-output {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin: 0.15em 0;
}

.nb-output-body {
  flex: 1;
  min-width: 0;
}

.nb-stream,
.nb-text,
.nb-json {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: var(--nb-fg);
}

.nb-stream-stderr {
  color: var(--nb-stream-stderr);
}

.nb-error {
  background: var(--nb-error-bg);
  color: var(--nb-error-fg);
  border-radius: 6px;
  padding: 0.7em 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.nb-html-output {
  overflow-x: auto;
  color: var(--nb-fg);
}

.nb-html-output table {
  border-collapse: collapse;
  margin: 0.4em 0;
}

.nb-html-output th,
.nb-html-output td {
  border: 1px solid var(--nb-table-border);
  padding: 0.35em 0.65em;
}

.nb-html-output th {
  background: var(--nb-table-header-bg);
}

.nb-image-output {
  margin: 0.35em 0;
}

.nb-image-output img,
.nb-image-output svg {
  max-width: 100%;
  height: auto;
  display: block;
}

.nb-raw {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  background: var(--nb-code-bg);
  border: 1px dashed var(--nb-border);
  border-radius: 6px;
  padding: 0.75em 1em;
  color: var(--nb-muted);
}

.nb-empty {
  color: var(--nb-muted);
  font-style: italic;
  padding: 1em 0;
  text-align: center;
}
`;
