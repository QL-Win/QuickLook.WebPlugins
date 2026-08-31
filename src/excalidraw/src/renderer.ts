/**
 * excalidraw renderer — wraps @excalidraw/excalidraw's exportToSvg.
 */

import { exportToSvg } from '@excalidraw/excalidraw';

export interface ExcalidrawFileData {
  elements: Parameters<typeof exportToSvg>[0]['elements'];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface RenderOptions {
  /** Export with dark mode colors (default: false). */
  darkMode?: boolean;
  /** Include the background color in the export (default: true). */
  background?: boolean;
}

/**
 * Parse a raw .excalidraw JSON string into structured data.
 * Throws a descriptive Error for invalid input.
 */
export function parseExcalidraw(json: string): ExcalidrawFileData {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: not a valid .excalidraw file');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid .excalidraw file: expected a JSON object');
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.elements)) {
    throw new Error('Invalid .excalidraw file: missing "elements" array');
  }
  return {
    elements: d.elements as ExcalidrawFileData['elements'],
    appState: (d.appState as Record<string, unknown>) ?? {},
    files: (d.files as Record<string, unknown>) ?? {},
  };
}

/**
 * Render excalidraw data to an SVGSVGElement.
 * Uses @excalidraw/excalidraw's exportToSvg under the hood.
 */
export async function renderExcalidraw(
  data: ExcalidrawFileData,
  opts: RenderOptions = {},
): Promise<SVGSVGElement> {
  const svg = await exportToSvg({
    elements: data.elements,
    appState: {
      ...(data.appState ?? {}),
      exportWithDarkMode: opts.darkMode ?? false,
      exportBackground: opts.background ?? true,
    } as Parameters<typeof exportToSvg>[0]['appState'],
    files: (data.files ?? {}) as Parameters<typeof exportToSvg>[0]['files'],
  });
  return svg;
}
