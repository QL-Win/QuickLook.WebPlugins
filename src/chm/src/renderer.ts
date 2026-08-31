/**
 * CHM content renderer for the browser.
 *
 * Extracts HTML pages and their assets from a ChmFile, rewrites resource
 * URLs to Blob URLs so the browser can load them from memory, and injects
 * a navigation interceptor so anchor clicks are routed through the app
 * instead of navigating the iframe away.
 */

import { ChmFile } from './lib/chm-file.js';
import { decodeText, decodeTextWithLangHint } from './lib/text.js';

/** Resolve a relative/absolute CHM path against the current page path. */
export function resolveChmPath(base: string, href: string): string {
  // Strip any fragment identifier before resolving
  const noFrag = href.split('#')[0];
  if (!noFrag) return base; // pure fragment link

  if (noFrag.startsWith('/')) return noFrag;

  // Walk relative path from the directory of base
  const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
  const combined = baseDir + noFrag;

  // Normalize ".." and "."
  const parts: string[] = [];
  for (const part of combined.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

/** Mime type guesses based on file extension. */
function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    png: 'image/png',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Create a Blob URL for a resource at the given CHM path. Returns null if not found. */
async function blobUrlForPath(
  chm: ChmFile,
  chmPath: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const key = chmPath.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const entry = await chm.resolve(chmPath);
  if (!entry) return null;

  const data = await chm.retrieve(entry);
  const mime = guessMime(chmPath);

  let blob: Blob;
  if (mime === 'text/css') {
    // Process CSS: rewrite url() references to blob URLs
    const { text } = decodeText(data);
    const processed = await processCss(chm, text, chmPath, cache);
    blob = new Blob([processed], { type: mime });
  } else {
    // Copy into a plain ArrayBuffer to satisfy Blob constructor type requirements
    const plainBuffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(plainBuffer).set(data);
    blob = new Blob([plainBuffer], { type: mime });
  }

  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}

/** Replace url(...) references in CSS with blob URLs. */
async function processCss(
  chm: ChmFile,
  css: string,
  basePath: string,
  cache: Map<string, string>,
): Promise<string> {
  // Match url("..."), url('...'), url(...)
  const urlRe = /url\(\s*(['"]?)([^)"']+)\1\s*\)/gi;
  const replacements: Array<{ match: string; replacement: string }> = [];

  for (const m of css.matchAll(urlRe)) {
    const href = m[2].trim();
    if (href.startsWith('data:') || href.startsWith('http://') || href.startsWith('https://')) {
      continue;
    }
    const resolved = resolveChmPath(basePath, href);
    const blobUrl = await blobUrlForPath(chm, resolved, cache);
    if (blobUrl) {
      replacements.push({ match: m[0], replacement: `url("${blobUrl}")` });
    }
  }

  let result = css;
  for (const { match, replacement } of replacements) {
    result = result.replaceAll(match, replacement);
  }
  return result;
}

/**
 * Rewrite resource attribute (src / href for non-anchor, background, etc.)
 * in an HTML string to blob URLs.
 * Anchor href values are left as-is; they are handled by the injected script.
 */
async function rewriteHtmlResources(
  chm: ChmFile,
  html: string,
  pagePath: string,
  cache: Map<string, string>,
): Promise<string> {
  // We do textual replacement to avoid needing a full DOM parser in a worker.
  // Pattern: match src="...", href="...", background="..."
  // For href we only rewrite stylesheet/icon links, not navigation anchors.

  type Replacement = { start: number; end: number; value: string };
  const replacements: Replacement[] = [];

  // Helper: scan HTML for attribute matches
  async function scanAttr(
    re: RegExp,
    isNavigationHref: boolean,
    isImg: boolean = false
  ): Promise<void> {
    for (const m of html.matchAll(re)) {
      const attrStart = m.index! + m[0].indexOf(m[1]);
      const attrEnd = attrStart + m[1].length;
      const href = m[2].trim();

      if (
        href.startsWith('data:') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//') ||
        href.startsWith('javascript:') ||
        href.startsWith('#') ||
        href === ''
      ) {
        continue;
      }

      if (isNavigationHref) {
        // Anchor navigation – leave as-is, handled by injected interceptor
        continue;
      }

      const resolved = resolveChmPath(pagePath, href);
      const blobUrl = await blobUrlForPath(chm, resolved, cache);
      if (blobUrl) {
        replacements.push({ start: attrStart, end: attrEnd, value: `"${blobUrl}"` });
      } else if (isImg) {
        // Add a red border and title for missing images
        // Find the <img ...> tag range that contains the src attribute
        const tagStart = html.lastIndexOf('<img', attrStart);
        const tagEnd = html.indexOf('>', attrEnd);
        if (tagStart !== -1 && tagEnd !== -1) {
          // Insert style and title attributes into the <img ...> tag
          const before = html.slice(tagStart, tagEnd);
          let patched = before;
          if (!/style=/i.test(before)) {
            patched = patched.replace(/<img/i, '<img style="border:2px solid red"');
          }
          if (!/title=/i.test(before)) {
            patched = patched.replace(/<img/i, `<img title="Image not found: ${resolved}"`);
          }
          replacements.push({ start: tagStart, end: tagEnd, value: patched });
        }
      }
    }
  }

  // src="..." for img, script, frame, iframe, embed, input
  // Special-case handling only for <img ... src=...>
  await scanAttr(/\bsrc\s*=\s*("([^"]*)")/gi, false, true);
  await scanAttr(/\bsrc\s*=\s*('([^']*)')/gi, false, true);

  // background="..."
  await scanAttr(/\bbackground\s*=\s*("([^"]*)")/gi, false);
  await scanAttr(/\bbackground\s*=\s*('([^']*)')/gi, false);

  // href="..." for <link> elements (stylesheets, icons) — NOT <a> anchors
  // We detect <link ... href="..."> by looking for link tags
  // Simple approach: if the full tag context contains <link, it's a resource link
  // Improved: Only replace the href value, not the whole attribute or tag
  const linkHrefRe = /<link([^>]*?)href\s*=\s*(['"])([^"']+?)\2([^>]*)>/gi;
  for (const m of html.matchAll(linkHrefRe)) {
    const fullTag = m[0];
    const beforeAttrs = m[1];
    const href = m[3].trim();
    const afterAttrs = m[4];

    if (!href || href.startsWith('data:') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//') || href.startsWith('#')) continue;

    // Determine if this is a stylesheet link (rel="stylesheet")
    const relAttr = (beforeAttrs + ' ' + afterAttrs).match(/rel\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
    const rel = relAttr ? (relAttr[1] || relAttr[2] || relAttr[3] || '').toLowerCase() : '';

    const tagStart = m.index!;
    const tagEnd = tagStart + fullTag.length;

    const resolved = resolveChmPath(pagePath, href);

    if (rel.includes('stylesheet') || /rel\s*=\s*stylesheet/i.test(beforeAttrs + afterAttrs)) {
      // Inline stylesheet content as a <style> so it is safe to scope later
      const entry = await chm.resolve(resolved);
      if (!entry) continue;
      const data = await chm.retrieve(entry);
      const cssTextRaw = decodeText(data).text;
      const processedCss = await processCss(chm, cssTextRaw, resolved, cache);
      replacements.push({ start: tagStart, end: tagEnd, value: `<style>${processedCss}</style>` });
    } else {
      // For non-stylesheet links (icons etc), convert href to blob URL
      const blobUrl = await blobUrlForPath(chm, resolved, cache);
      if (blobUrl) {
        // replace just the href value inside the tag
        const beforeHref = fullTag.indexOf(href);
        const attrStart = tagStart + beforeHref;
        const attrEnd = attrStart + href.length;
        replacements.push({ start: attrStart, end: attrEnd, value: blobUrl });
      }
    }
  }

  // style="..." inline background-image: url(...)
  // We handle this via CSS processing, but inline styles need special treatment
  const inlineStyleRe = /\bstyle\s*=\s*"([^"]*)"/gi;
  for (const m of html.matchAll(inlineStyleRe)) {
    const styleContent = m[1];
    if (!styleContent.includes('url(')) continue;
    const processed = await processCss(chm, styleContent, pagePath, cache);
    if (processed !== styleContent) {
      const attrStart = m.index!;
      const attrEnd = attrStart + m[0].length;
      replacements.push({ start: attrStart, end: attrEnd, value: `style="${processed}"` });
    }
  }

  if (replacements.length === 0) return html;

  // Apply replacements from end to start to preserve offsets
  replacements.sort((a, b) => b.start - a.start);
  let result = html;
  for (const { start, end, value } of replacements) {
    result = result.slice(0, start) + value + result.slice(end);
  }
  return result;
}

/** Script injected into every CHM HTML page to intercept navigation. */
const NAV_INTERCEPTOR = `
<script data-chm-nav>
(function() {
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target) return;
    var href = target.getAttribute('href');
    if (!href) return;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) return;
    if (href.startsWith('javascript:')) return;
    e.preventDefault();
    window.parent.postMessage({ type: 'chm-navigate', href: href }, '*');
  }, true);
})();
</script>
`;

/**
 * Sanitize HTML/CSS to remove negative margins which can cause clipping
 * when CHM content is embedded in the app. This adjusts inline style
 * margins and <style> block margin declarations by clamping negative
 * numeric margin values to 0.
 */
function sanitizeNegativeMargins(html: string): string {
  // Inline styles: double-quoted
  html = html.replace(/style\s*=\s*"([^"]*)"/gi, (m: string, styles: string) => {
    let s = styles;
    // margin-top/right/bottom/left
    s = s.replace(/(margin(?:-(?:top|right|bottom|left))?)\s*:\s*([-+]?\d*\.?\d+)([a-z%]*)/gi, (mm, prop, num, unit) => {
      if (/^\s*-/.test(num)) return `${prop}:0${unit}`;
      return mm;
    });
    // shorthand margin: if any value is negative, set to 0
    s = s.replace(/margin\s*:\s*([^;]*)/gi, (mm, vals) => {
      if (/[-]\s*\d/.test(vals)) return 'margin:0';
      return mm;
    });
    return `style="${s}"`;
  });

  // Inline styles: single-quoted
  html = html.replace(/style\s*=\s*'([^']*)'/gi, (m: string, styles: string) => {
    let s = styles;
    s = s.replace(/(margin(?:-(?:top|right|bottom|left))?)\s*:\s*([-+]?\d*\.?\d+)([a-z%]*)/gi, (mm, prop, num, unit) => {
      if (/^\s*-/.test(num)) return `${prop}:0${unit}`;
      return mm;
    });
    s = s.replace(/margin\s*:\s*([^;]*)/gi, (mm, vals) => {
      if (/[-]\s*\d/.test(vals)) return 'margin:0';
      return mm;
    });
    return `style='${s}'`;
  });

  // <style> blocks: process CSS content
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m: string, css: string) => {
    let s = css;
    // clamp margin-xxx
    s = s.replace(/(margin(?:-(?:top|right|bottom|left))?)\s*:\s*([^;}]*)/gi, (mm, prop, vals) => {
      if (/[-]\s*\d/.test(vals)) return `${prop}:0`;
      return mm;
    });
    // shorthand margin
    s = s.replace(/margin\s*:\s*([^;}]*)/gi, (mm, vals) => {
      if (/[-]\s*\d/.test(vals)) return 'margin:0';
      return mm;
    });
    return `<style>${s}</style>`;
  });

  return html;
}

/**
 * Render a CHM page into the given iframe element.
 *
 * @param chm       - open ChmFile instance
 * @param pagePath  - absolute CHM path (e.g. "/index.html")
 * @param iframe    - target <iframe> element
 * @param cache     - shared blob URL cache (caller manages lifecycle)
 */

/**
 * Render a CHM page into a target <div> (no iframe, for file:// compatibility).
 * @param chm       - open ChmFile instance
 * @param pagePath  - absolute CHM path (e.g. "/index.html")
 * @param container - target <div> element
 * @param cache     - shared blob URL cache (caller manages lifecycle)
 */
export async function renderPageToDiv(
  chm: ChmFile,
  pagePath: string,
  container: HTMLElement,
  cache: Map<string, string>,
): Promise<void> {
  const entry = await chm.resolve(pagePath);
  if (!entry) {
    container.innerHTML = `<div style="font-family:sans-serif;color:#c00;padding:2em">Page not found: ${escapeHtml(pagePath)}</div>`;
    return;
  }

  const data = await chm.retrieve(entry);
  // Prefer using the CHM file's declared language id when available so ANSI
  // encoded pages are decoded with the correct codepage.
  const langId = (chm as any).getLanguageId ? (chm as any).getLanguageId() : undefined;
  const { text } = (langId !== undefined && langId !== null)
    ? decodeTextWithLangHint(data, langId)
    : decodeText(data);

  // Rewrite resource references to blob URLs
  const rewritten = await rewriteHtmlResources(chm, text, pagePath, cache);
  const sanitized = sanitizeNegativeMargins(rewritten);

  // Use Shadow DOM to isolate injected CHM styles from the host page.
  // Create a wrapper element and attach a shadow root; inject a small
  // reset + host CSS and then place the rewritten HTML inside the shadow.
  const wrapper = document.createElement('div');
  wrapper.className = 'chm-host-wrapper';
  const shadow = wrapper.attachShadow({ mode: 'open' });

  // reset for shadow host: revert outer-page rules and ensure full size
  const hostCss = `:host { all: initial; display: block; width:100%; height:100%; }
    :host * { box-sizing: border-box; }
  `;

  // Inject the host CSS and the navigation interceptor into the shadow
  const styleEl = document.createElement('style');
  styleEl.textContent = hostCss;
  shadow.appendChild(styleEl);

  // Create a container inside shadow where the HTML will go
  const inner = document.createElement('div');
  inner.className = 'chm-host';
  inner.style.width = '100%';
  inner.style.height = '100%';
  inner.innerHTML = sanitized;

  // inject navigation interceptor inside shadow
  const navScript = document.createElement('script');
  navScript.setAttribute('data-chm-nav', '');
  navScript.textContent = NAV_INTERCEPTOR;
  shadow.appendChild(navScript);

  shadow.appendChild(inner);

  // Replace container content with the wrapper
  container.innerHTML = '';
  container.appendChild(wrapper);

  // Bind navigation handlers in the shadow root (intercept anchor clicks)
  shadow.addEventListener('click', (e: Event) => {
    let target = e.target as Element | null;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target) return;
    const a = target as HTMLAnchorElement;
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) return;
    if (href.startsWith('javascript:')) return;
    e.preventDefault();
    window.postMessage({ type: 'chm-navigate', href }, '*');
  }, true);

  // Adjust only elements that extend left of the host (off-screen).
  // Instead of shifting the whole page (which can create a centered look),
  // we apply a per-element translateX to move only the offending elements
  // rightwards. We store original transform in data attributes so we can
  // revert the change if the layout later no longer overflows.
  function adjustShadowContentPadding(wrapperEl: HTMLElement) {
    const sroot = wrapperEl.shadowRoot;
    if (!sroot) return;
    const innerEl = sroot.querySelector<HTMLElement>('.chm-host');
    if (!innerEl) return;

    requestAnimationFrame(() => {
      const hostRect = wrapperEl.getBoundingClientRect();
      const all = Array.from(innerEl.querySelectorAll<HTMLElement>('*'));
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.left < hostRect.left) {
          const offset = Math.ceil(hostRect.left - r.left);
          // Save original transform if we haven't already
          if (!el.dataset.chmOrigTransform) {
            const cs = getComputedStyle(el);
            el.dataset.chmOrigTransform = cs.transform && cs.transform !== 'none' ? cs.transform : '';
          }
          const orig = el.dataset.chmOrigTransform || '';
          // Apply a translateX to nudge the element rightwards by the offset
          el.style.transform = `${orig} translateX(${offset}px)`.trim();
          el.dataset.chmShifted = '1';
        } else if (el.dataset.chmShifted) {
          // No longer overflowing — revert transform back to original
          el.style.transform = el.dataset.chmOrigTransform || '';
          delete el.dataset.chmShifted;
          delete el.dataset.chmOrigTransform;
        }
      }
    });
  }

  // Run initial adjustment and re-run when images or media load inside shadow
  adjustShadowContentPadding(wrapper);
  shadow.addEventListener('load', () => adjustShadowContentPadding(wrapper), true);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
