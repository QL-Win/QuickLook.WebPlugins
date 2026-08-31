import { ChmFile } from './chm-file.js';
import type { ChmSystemInfo } from './system.js';
import { ChmEnumerateFlags } from './types.js';

export async function discoverArchiveFile(
  chm: ChmFile,
  extensions: string[],
  options: { prefer?: string[] } = {},
): Promise<string | null> {
  const normalizedExts = extensions.map((ext) => ext.toLowerCase());
  const candidates: string[] = [];

  for await (const entry of chm.enumerate(ChmEnumerateFlags.All)) {
    if (!(entry.flags & ChmEnumerateFlags.Files)) continue;

    const path = normalizePathKey(entry.path);
    if (normalizedExts.some((ext) => path.endsWith(ext))) {
      candidates.push(entry.path);
    }
  }

  return pickBestCandidate(candidates, options.prefer ?? []);
}

export async function discoverTocFile(
  chm: ChmFile,
  systemInfo?: ChmSystemInfo,
): Promise<string | null> {
  return discoverArchiveFile(chm, ['.hhc'], {
    prefer: buildSitemapHints(systemInfo, '.hhc'),
  });
}

export async function discoverIndexFile(
  chm: ChmFile,
  systemInfo?: ChmSystemInfo,
): Promise<string | null> {
  return discoverArchiveFile(chm, ['.hhk'], {
    prefer: buildSitemapHints(systemInfo, '.hhk'),
  });
}

function buildSitemapHints(systemInfo: ChmSystemInfo | undefined, extension: string): string[] {
  if (!systemInfo) return [];

  const hints = new Set<string>();

  if (extension === '.hhc' && systemInfo.tocFile) {
    hints.add(systemInfo.tocFile);
  }
  if (extension === '.hhk' && systemInfo.indexFile) {
    hints.add(systemInfo.indexFile);
  }
  if (systemInfo.compiledFile) {
    hints.add(`/${stripExtension(systemInfo.compiledFile)}${extension}`);
  }
  if (systemInfo.defaultTopic) {
    const topicName = lastPathSegment(systemInfo.defaultTopic);
    if (topicName.length > 0) {
      hints.add(`/${stripExtension(topicName)}${extension}`);
    }
  }

  return [...hints];
}

function pickBestCandidate(candidates: string[], prefer: string[]): string | null {
  if (candidates.length === 0) return null;

  const preferredPaths = new Set(prefer.map((path) => normalizePathKey(path)));
  const preferredNames = new Set(prefer.map((path) => normalizePathKey(lastPathSegment(path))));

  return [...candidates].sort((left, right) => {
    const leftRank = rankCandidate(left, preferredPaths, preferredNames);
    const rightRank = rankCandidate(right, preferredPaths, preferredNames);

    if (leftRank !== rightRank) return rightRank - leftRank;

    const leftDepth = pathDepth(left);
    const rightDepth = pathDepth(right);
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;

    if (left.length !== right.length) return left.length - right.length;

    return normalizePathKey(left).localeCompare(normalizePathKey(right));
  })[0] ?? null;
}

function rankCandidate(
  candidate: string,
  preferredPaths: Set<string>,
  preferredNames: Set<string>,
): number {
  const path = normalizePathKey(candidate);
  const name = normalizePathKey(lastPathSegment(candidate));

  if (preferredPaths.has(path)) return 3;
  if (preferredNames.has(name)) return 2;
  return 1;
}

function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

function stripExtension(value: string): string {
  return value.replace(/\.[^.]+$/u, '');
}

function lastPathSegment(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function normalizePathKey(path: string): string {
  return path.toLowerCase();
}
