/** TOC tree types shared by converter and sidebar. */

export interface IpynbTocEntry {
  name: string;
  /** Fragment id without leading '#', e.g. "introduction" */
  id: string;
  children: IpynbTocEntry[];
}

export interface IpynbToc {
  entries: IpynbTocEntry[];
}

export interface ConvertedDocument {
  title: string;
  /** Full standalone HTML (with embedded stylesheet). */
  html: string;
  toc: IpynbToc;
}
