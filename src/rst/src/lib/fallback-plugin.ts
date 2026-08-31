/**
 * Fallbacks for Sphinx / domain roles and directives that rst-compiler
 * does not ship generators for. Without these, conversion hard-fails with
 * "Missing generator" (e.g. :command:`add_custom_target`).
 */

import type {
  RstCompiler,
  RstDirective,
  RstDocument,
  RstGeneratorState,
  RstInterpretedText,
  RstParserOutput,
} from 'rst-compiler';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssSafe(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}

/** Approximate rst-compiler normalizeSimpleName (not exported). */
function normalizeSimpleName(origName: string): string {
  return origName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\-_.:+<>]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** `:role:`text <target>`` / `:role:`target`` */
function parseEmbeddedRef(raw: string): { label: string; target: string } {
  const m = raw.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  if (m) return { label: m[1].trim() || m[2].trim(), target: m[2].trim() };
  const t = raw.trim();
  return { label: t, target: t };
}

function writeRoleSpan(state: RstGeneratorState, node: RstInterpretedText, extraClass = ''): void {
  const role = cssSafe(node.role);
  const cls = ['rst-role', `rst-role-${role}`, extraClass].filter(Boolean).join(' ');
  state.writeTextWithLinePrefix(`<code class="${cls}">${escapeHtml(node.textContent)}</code>`);
}

function writeRoleLink(
  state: RstGeneratorState,
  node: RstInterpretedText,
  href: string | null,
  label: string,
): void {
  const role = cssSafe(node.role);
  if (href) {
    state.writeTextWithLinePrefix(
      `<a class="rst-role rst-role-${role}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
    );
  } else {
    state.writeTextWithLinePrefix(
      `<code class="rst-role rst-role-${role}">${escapeHtml(label)}</code>`,
    );
  }
}

/** Sphinx inline markup roles → literal-like code spans. */
const SPHINX_LITERAL_ROLES = [
  'command',
  'option',
  'file',
  'guilabel',
  'menuselection',
  'envvar',
  'program',
  'makevar',
  'regexp',
  'samp',
  'mailheader',
  'newsgroup',
  'url',
  'manpage',
  'dfn',
  'term',
  'token',
  'var',
  'c:expr',
  'cpp:expr',
] as const;

/** Sphinx cross-doc roles that call resolveExternalDoc — soft-fail when docs are absent. */
const SPHINX_DOC_ROLES = ['doc', 'guide', 'manual'] as const;

function prettyDocLabel(target: string): string {
  const cleaned = target.replace(/\\/g, '/').replace(/\.rst$/i, '');
  const base = cleaned.split('/').filter(Boolean).pop() || cleaned;
  return base;
}

function softDocRole(state: RstGeneratorState, node: RstInterpretedText): void {
  const { label, target } = parseEmbeddedRef(node.rawTextContent);
  try {
    const { externalUrl, externalLabel } = state.resolveExternalDoc(node, target);
    const display = label === target ? (externalLabel ?? label) : label;
    writeRoleLink(state, node, externalUrl, display);
  } catch {
    const display = label === target ? prettyDocLabel(target) : label;
    writeRoleLink(state, node, null, display);
  }
}

function softTocTreeDirective(state: RstGeneratorState, node: RstDirective): void {
  // Single-file viewer: linked docs from Sphinx trees are usually not available.
  if (typeof node.config?.hasField === 'function' && node.config.hasField('hidden')) {
    state.writeLine(`<!-- ${escapeHtml(node.toShortString())} -->`);
    return;
  }

  state.writeLine('<ul class="toctree">');
  for (const rawLine of String(node.rawBodyText || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const { label, target } = parseEmbeddedRef(line);
    let display = label;
    let href: string | null = null;
    try {
      const resolved = state.resolveExternalDoc(node, target);
      href = resolved.externalUrl;
      display = label === target ? (resolved.externalLabel ?? prettyDocLabel(target)) : label;
    } catch {
      display = label === target ? prettyDocLabel(target) : label;
      href = null;
    }

    if (href) {
      state.writeLine(
        `<li><a href="${escapeHtml(href)}">${escapeHtml(display)}</a></li>`,
      );
    } else {
      state.writeLine(
        `<li><span class="rst-toctree-missing" title="${escapeHtml(target)}">${escapeHtml(display)}</span></li>`,
      );
    }
  }
  state.writeLine('</ul>');
}

function softRefRole(state: RstGeneratorState, node: RstInterpretedText): void {
  const { label, target } = parseEmbeddedRef(node.rawTextContent);
  const simpleName = normalizeSimpleName(target) as Parameters<
    RstGeneratorState['resolveExternalRef']
  >[1];
  try {
    if (!state.canResolveExternalRef(simpleName)) {
      writeRoleLink(state, node, null, label);
      return;
    }
    const { externalUrl, externalLabel } = state.resolveExternalRef(node, simpleName);
    writeRoleLink(state, node, externalUrl, externalLabel ?? label);
  } catch {
    writeRoleLink(state, node, null, label);
  }
}

function softDownloadRole(state: RstGeneratorState, node: RstInterpretedText): void {
  const { label, target } = parseEmbeddedRef(node.rawTextContent);
  try {
    const { downloadDest, fileName } = state.registerDownload(target);
    state.writeTextWithLinePrefix(
      `<a class="rst-role rst-role-download" href="${escapeHtml(downloadDest)}" download="${escapeHtml(fileName)}">${escapeHtml(label)}</a>`,
    );
  } catch {
    writeRoleLink(state, node, null, label);
  }
}

/**
 * Register built-in Sphinx role fallbacks once on the shared compiler.
 * Also softens :doc: / :ref: / :download: so missing cross-doc targets do not abort.
 *
 * Also fixes rst-compiler's handling of CJK-only section titles: normalizeSimpleName()
 * strips all non-ASCII letters to "", and getSimpleName() treats "" as missing
 * (`if (!simpleName) throw`), which breaks `.. contents::` / TOC links on Chinese docs.
 */
export function installBaseFallbacks(compiler: RstCompiler): void {
  compiler.usePlugin({
    getSimpleName: (node) => {
      if (node.nodeType !== 'Section') return null;
      const slug = sectionSlug(node.textContent || '', node.id);
      // Only override when the default ASCII slug would be empty/falsy
      const ascii = normalizeSimpleName(node.textContent || '');
      return ascii ? null : (slug as never);
    },
    onParse: (parserOutput) => {
      fixChineseSectionNames(parserOutput);
    },
  });

  compiler.useInterpretedTextGenerator({
    roles: [...SPHINX_LITERAL_ROLES],
    generate: (state, node) => writeRoleSpan(state, node),
  });

  compiler.useInterpretedTextGenerator({
    roles: [...SPHINX_DOC_ROLES],
    generate: softDocRole,
  });

  compiler.useInterpretedTextGenerator({
    roles: ['ref', 'any'],
    generate: softRefRole,
  });

  compiler.useInterpretedTextGenerator({
    roles: ['download'],
    generate: softDownloadRole,
  });

  // Override built-in toctree so missing sibling docs do not abort conversion
  compiler.useDirectiveGenerator({
    directives: ['toctree'],
    generate: softTocTreeDirective,
  });

  // Sphinx meta title — keep as a comment so it does not throw
  compiler.useDirectiveGenerator({
    directives: ['title'],
    generate: (state, node) => {
      const title = (node.initContentText || node.rawBodyText || '').trim();
      if (title) state.writeLine(`<!-- document-title: ${escapeHtml(title)} -->`);
    },
  });
}

function sectionSlug(text: string, id: number): string {
  const ascii = normalizeSimpleName(text);
  return ascii || `section-${id}`;
}

/**
 * Re-register section simple names / HTML ids when rst-compiler stored "".
 */
function fixChineseSectionNames(parserOutput: RstParserOutput): void {
  const htmlInternal = parserOutput.htmlAttrResolver as unknown as {
    _nodesWithId: Map<object, string>;
    _htmlIds: Set<string>;
    registerNodeAsLinkable: (node: object, name: string) => string;
  };

  for (const section of parserOutput.root.findAllChildren('Section')) {
    const slug = sectionSlug(section.textContent || '', section.id);
    parserOutput.simpleNameResolver.registerImplicitNode(section, slug as never);

    const currentId = htmlInternal._nodesWithId.get(section);
    if (!currentId) {
      htmlInternal.registerNodeAsLinkable(section, slug);
    } else if (currentId === '' || currentId === '-') {
      htmlInternal._htmlIds.delete(currentId);
      htmlInternal._nodesWithId.delete(section);
      htmlInternal.registerNodeAsLinkable(section, slug);
    }
  }
}

/**
 * After parse, register generators for any remaining unknown roles/directives
 * so a single Sphinx domain role cannot abort the whole document.
 */
export function registerDocumentFallbacks(compiler: RstCompiler, root: RstDocument): void {
  const roles = new Set<string>();
  for (const node of root.findAllChildren('InterpretedText')) {
    roles.add(node.role.toLowerCase());
  }

  const missingRoles = [...roles].filter((role) => !compiler.interpretedTextGenerators.has(role));
  if (missingRoles.length > 0) {
    compiler.useInterpretedTextGenerator({
      roles: missingRoles,
      generate: (state, node) => writeRoleSpan(state, node),
    });
  }

  const directives = new Set<string>();
  for (const node of root.findAllChildren('Directive')) {
    directives.add((node as RstDirective).directive.toLowerCase());
  }

  const missingDirectives = [...directives].filter(
    (name) => !compiler.directiveGenerators.has(name),
  );
  if (missingDirectives.length > 0) {
    compiler.useDirectiveGenerator({
      directives: missingDirectives,
      generate: (state, node) => {
        const name = cssSafe(node.directive);
        state.writeLine(`<div class="rst-directive rst-directive-${name}">`);
        if (node.initContentText) {
          state.writeLine(
            `<p class="rst-directive-title"><strong>${escapeHtml(node.directive)}</strong>: ${escapeHtml(node.initContentText)}</p>`,
          );
        } else {
          state.writeLine(
            `<p class="rst-directive-title"><strong>${escapeHtml(node.directive)}</strong></p>`,
          );
        }
        if (node.children.length > 0) {
          state.visitNodes(node.children);
        } else if (node.rawBodyText) {
          state.writeLine(`<pre class="code">${escapeHtml(node.rawBodyText)}</pre>`);
        }
        state.writeLine('</div>');
      },
    });
  }
}
