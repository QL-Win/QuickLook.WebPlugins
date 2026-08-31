/** TOC tree types shared by converter and sidebar. */

export interface RstTocEntry {
  name: string;
  /** Fragment id without leading '#', e.g. "introduction" */
  id: string;
  children: RstTocEntry[];
}

export interface RstToc {
  entries: RstTocEntry[];
}

export interface ConvertedDocument {
  title: string;
  /**
   * Standalone-ish HTML fragment for the document body,
   * plus optional `<head>` extras from the compiler (KaTeX / tabs).
   */
  html: string;
  header: string;
  toc: RstToc;
}
