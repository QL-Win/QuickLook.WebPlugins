/**
 * gv renderer — wraps @viz-js/viz for easy DOT → SVG rendering.
 */

import * as Viz from '@viz-js/viz';

// Lazily initialize the Viz instance (loads WASM once)
let vizPromise: ReturnType<typeof Viz.instance> | null = null;

function getViz(): ReturnType<typeof Viz.instance> {
  if (!vizPromise) {
    vizPromise = Viz.instance();
  }
  return vizPromise;
}

/**
 * Render a DOT-language string to an SVGSVGElement using the given engine.
 * Throws if rendering fails (invalid DOT syntax, unknown engine, etc.).
 */
export async function renderDot(dot: string, engine = 'dot'): Promise<SVGSVGElement> {
  const viz = await getViz();
  return viz.renderSVGElement(dot, { engine });
}
