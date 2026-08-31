export interface IconEntry {
  /** Display / search name */
  name: string;
  /** Unicode codepoint */
  codepoint: number;
  /** Single-character string for rendering */
  char: string;
  /** CSS class from iconfont stylesheet, e.g. icon-home */
  cssClass?: string;
  /** Glyph index in the font */
  index: number;
}

export interface FontLoadResult {
  familyName: string;
  icons: IconEntry[];
  /** Base64 data URL for @font-face */
  dataUrl: string;
  /** MIME type used in data URL */
  mimeType: string;
  /** Original file name */
  fileName: string;
}

export interface CssParseResult {
  familyName?: string;
  classMap: Map<string, number>;
}

export interface IconFontState {
  familyName: string;
  icons: IconEntry[];
  dataUrl: string;
  mimeType: string;
  fileName: string;
  cssFileName?: string;
}

export interface PluginLoadPayload {
  /** Base64-encoded font bytes (without data: prefix) */
  fontBase64: string;
  fileName?: string;
  mimeType?: string;
  /** Optional CSS text for class-name mapping */
  cssText?: string;
  familyName?: string;
}
