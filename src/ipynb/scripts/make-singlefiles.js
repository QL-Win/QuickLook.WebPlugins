import fs from 'fs/promises';
import path from 'path';

const dist = path.resolve(process.cwd(), 'dist');
const htmlFiles = ['index.html', 'plugin.html'];

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}

async function inlineHtml(file) {
  const filePath = path.join(dist, file);
  if (!(await fileExists(filePath))) {
    console.warn('[make-singlefiles] skipping, not found:', filePath);
    return;
  }

  let html = await fs.readFile(filePath, 'utf8');

  // Inline CSS <link rel="stylesheet" href="...">
  const linkRe = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  html = await replaceAsync(html, linkRe, async (match, href) => {
    const assetPath = href.startsWith('/') ? href.slice(1) : href;
    const full = path.join(dist, assetPath);
    if (!(await fileExists(full))) {
      console.warn('[make-singlefiles] css not found:', full);
      return '';
    }
    const css = await fs.readFile(full, 'utf8');
    return `\n<style>/* inlined ${assetPath} */\n${css}\n</style>`;
  });

  // Inline <script src="..."></script>
  const scriptRe = /<script\s+([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi;
  html = await replaceAsync(html, scriptRe, async (match, beforeAttrs, src, afterAttrs) => {
    const assetPath = src.startsWith('/') ? src.slice(1) : src;
    const full = path.join(dist, assetPath);
    if (!(await fileExists(full))) {
      console.warn('[make-singlefiles] js not found:', full);
      return match;
    }
    const js = await fs.readFile(full, 'utf8');
    const attrs = (beforeAttrs + ' ' + afterAttrs).trim();
    const isModule = /type=["']module["']/.test(attrs);
    const typeAttr = isModule ? ' type="module"' : '';
    return `\n<script${typeAttr}>\n// inlined ${assetPath}\n${js}\n</script>`;
  });

  await fs.writeFile(filePath, html, 'utf8');
  console.log('[make-singlefiles] inlined', filePath);
}

async function replaceAsync(str, re, asyncFn) {
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = re.exec(str)) !== null) {
    parts.push(str.slice(lastIndex, match.index));
    const repl = await asyncFn(...match);
    parts.push(repl);
    lastIndex = re.lastIndex;
  }
  parts.push(str.slice(lastIndex));
  return parts.join('');
}

async function removeAssetsDir() {
  const assetsDir = path.join(dist, 'assets');
  if (!(await fileExists(assetsDir))) {
    return;
  }

  await fs.rm(assetsDir, { recursive: true, force: true });
  console.log('[make-singlefiles] removed', assetsDir);
}

(async () => {
  let hadError = false;

  for (const hf of htmlFiles) {
    try {
      await inlineHtml(hf);
    } catch (err) {
      hadError = true;
      console.error('[make-singlefiles] error inlining', hf, err);
    }
  }

  if (hadError) {
    console.warn('[make-singlefiles] keeping assets because inlining failed');
    process.exitCode = 1;
    return;
  }

  await removeAssetsDir();
})();
