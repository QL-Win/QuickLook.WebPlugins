# adoc — AsciiDoc Viewer (with plugin mode)

> A small browser-based AsciiDoc viewer that renders `.adoc` / `.asciidoc` files in the browser using [Asciidoctor.js](https://docs.asciidoctor.org/asciidoctor.js/latest/). This repository also includes a plugin-mode HTML that accepts AsciiDoc content from a host (QuickLook, WebView2, etc.) so you can embed the renderer in a native host.

The UI shell mirrors [`chm`](../chm): toolbar, Contents sidebar, Shadow DOM content pane, and host messaging.

---

## Quick start

- **Requirements**: Node.js (20+ recommended for `@asciidoctor/core` v4) and npm.
- Clone the repository and install dependencies:

```bash
cd src/adoc
npm install
```

- Run development server (hot-reload):

```bash
npm run dev
```

Open `http://localhost:5173` (Vite default) and use the UI to open a `.adoc` file.

## Build

- Standard build (multi-file output):

```bash
npm run build
```

This produces `dist/index.html`, `dist/plugin.html` and a `dist/assets/` folder with JS/CSS bundles.

- Produce self-contained single-file HTML outputs (inlines assets into each HTML):

```bash
npm run build:all
```

After `npm run build:all`, `dist/index.html` and `dist/plugin.html` will be inlined (single-file) for easy distribution. The intermediate `dist/assets/` folder is removed automatically after the assets are inlined.

Files of interest:
- Main app entry: [src/app.ts](src/app.ts)
- Converter: [src/lib/convert.ts](src/lib/convert.ts)
- Plugin HTML: [plugin.html](plugin.html)
- Build helper that inlines assets: [scripts/make-singlefiles.js](scripts/make-singlefiles.js)
- Build config: [vite.config.ts](vite.config.ts)

---

## Plugin mode (for QuickLook / WebView hosts)

The plugin page is `dist/plugin.html`. In plugin mode the page hides the regular "Open" UI and waits for the host to provide an AsciiDoc file to render. There are multiple ways a host can provide content:

1) Query parameters (quick tests)

- Provide a remote URL to fetch (subject to CORS):

```
dist/plugin.html?adoc=https://example.com/foo.adoc&name=Foo.adoc
```

- Provide base64-encoded AsciiDoc inline:

```
dist/plugin.html?adocBase64=<BASE64_DATA>&name=Foo.adoc
```

2) Host → Page messaging (preferred for embedded hosts)

Send a `postMessage` (or WebView2 message) with `type: 'open-adoc'` and a `payload` object. The renderer accepts the following payload fields:

- `base64` — file bytes as a base64 string (recommended for local files)
- `text` — raw AsciiDoc string
- `url` — HTTP(S) URL to fetch (requires CORS)
- `path` — treated like `url` (use with caution)
- `name` — optional display name for the document

Example (page `postMessage`):

```js
window.postMessage({
  type: 'open-adoc',
  payload: { url: 'https://example.com/foo.adoc', name: 'Foo.adoc' }
}, '*');

window.postMessage({
  type: 'open-adoc',
  payload: { text: '= Title\n\nHello *world*.', name: 'hello.adoc' }
}, '*');

window.postMessage({
  type: 'open-adoc',
  payload: { base64: '<BASE64_DATA>', name: 'Foo.adoc' }
}, '*');
```

3) WebView2 (C#) example (recommended on Windows hosts)

```csharp
using System.IO;
using System.Text.Json;

var bytes = File.ReadAllBytes(@"C:\path\to\file.adoc");
var base64 = Convert.ToBase64String(bytes);

var msgObj = new {
  type = "open-adoc",
  payload = new { base64 = base64, name = Path.GetFileName(@"C:\path\to\file.adoc") }
};
var json = JsonSerializer.Serialize(msgObj);
webView.CoreWebView2.PostWebMessageAsJson(json);
```

Notes:
- Using base64 / text avoids CORS and `file://` restrictions.
- Relative `image::` / `include::` targets are resolved only when the conversion environment can fetch them (typically not available for a lone dropped file). Prefer embedding images as data URIs or having the host expand includes beforehand.

---

## Message API (summary)

```json
{
  "type": "open-adoc",
  "payload": { "base64": "...", "name": "Foo.adoc" }
}
```

Internal navigation from rendered content:

```json
{ "type": "adoc-navigate", "href": "#_section_id" }
```

---

## Theme

Default is **Auto** (follow OS light/dark). Use the toolbar sun/moon button to toggle Light ↔ Dark; the choice is saved in `localStorage` (`adoc-theme`).

Also supported:

- Query: `?theme=auto|light|dark`
- Host message:

```js
window.postMessage({ type: 'set-theme', payload: { theme: 'dark' } }, '*');
```

---

## Troubleshooting

- If fetching via `url` fails: check CORS on the server or prefer sending `base64` / `text` from the host.
- If conversion fails: ensure the file is UTF-8 AsciiDoc; check the toolbar status message and browser console.
- If the host webview doesn't forward messages: verify `PostWebMessageAsJson` (WebView2) and that CoreWebView2 is initialized.

---

## Development notes

- Dev server: `npm run dev`
- Entry: [src/app.ts](src/app.ts) — host-message handling and plugin-mode detection (`window.__adoc_PLUGIN` or `?plugin=1`)
- Regenerate single-file HTMLs:

```bash
npm run build:all
```
