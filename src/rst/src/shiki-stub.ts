/**
 * Minimal shiki stub so rst-compiler does not pull the full highlighter into the bundle.
 * Language validation for code-tab labels still works for common ids/aliases.
 */

export const bundledLanguagesInfo = [
  { id: 'txt', name: 'Plain Text', aliases: ['text', 'plain'] },
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'java', name: 'Java' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++', aliases: ['c++'] },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'php', name: 'PHP' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'json', name: 'JSON' },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'xml', name: 'XML' },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'shellscript', name: 'Shell', aliases: ['bash', 'sh', 'shell', 'zsh'] },
  { id: 'sql', name: 'SQL' },
  { id: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
];

export async function createHighlighter() {
  throw new Error('shiki is stubbed in rst; use highlight.js instead');
}

export default { bundledLanguagesInfo, createHighlighter };
