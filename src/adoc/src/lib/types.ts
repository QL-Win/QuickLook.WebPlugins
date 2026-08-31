/** TOC tree types shared by converter and sidebar. */

export interface AdocTocEntry {
  name: string;
  /** Fragment id without leading '#', e.g. "_introduction" */
  id: string;
  children: AdocTocEntry[];
}

export interface AdocToc {
  entries: AdocTocEntry[];
}

export interface ConvertedDocument {
  title: string;
  /** Full standalone HTML (with embedded stylesheet). */
  html: string;
  toc: AdocToc;
}
