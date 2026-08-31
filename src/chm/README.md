# chm — CHM Viewer (with plugin mode)

> A small browser-based CHM viewer that renders .chm files in the browser. This repository also includes a plugin-mode HTML that accepts CHM content from a host (QuickLook, WebView2, etc.) so you can embed the renderer in a native host.

---

## Quick start

- **Requirements**: Node.js (18+ recommended) and npm.
- Clone the repository and install dependencies:

```bash
cd src/chm
npm install
```

- Run development server (hot-reload):

```bash
npm run dev
```

Open `http://localhost:5173` (Vite default) and use the UI to open a `.chm` file.

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
- Main app entry: [src/app.ts](src/app.ts#L1-L1)
- Plugin HTML: [plugin.html](plugin.html)
- Build helper that inlines assets: [scripts/make-singlefiles.js](scripts/make-singlefiles.js)
- Build config: [vite.config.ts](vite.config.ts)

---

## Plugin mode (for QuickLook / WebView hosts)

The plugin page is `dist/plugin.html`. In plugin mode the page hides the regular "Open" UI and waits for the host to provide a CHM file to render. There are multiple ways a host can provide a CHM:

1) Query parameters (quick tests)

- Provide a remote URL to fetch (subject to CORS):

```
dist/plugin.html?chm=https://example.com/foo.chm&name=Foo.chm
```

- Provide base64-encoded CHM inline (not recommended for large files):

```
dist/plugin.html?chmBase64=<BASE64_DATA>&name=Foo.chm
```

2) Host → Page messaging (preferred for embedded hosts)

Send a `postMessage` (or WebView2 message) with `type: 'open-chm'` and a `payload` object. The renderer accepts the following payload fields:

- `base64` — CHM file bytes as a base64 string (recommended for local files)
- `url` — HTTP(S) URL to fetch the CHM from (requires CORS)
- `path` — treated like `url` (use with caution)
- `name` — optional display name for the document

Example (page `postMessage`):

```js
window.postMessage({
  type: 'open-chm',
  payload: { url: 'https://example.com/foo.chm', name: 'Foo.chm' }
}, '*');

// or send base64
window.postMessage({
  type: 'open-chm',
  payload: { base64: '<BASE64_DATA>', name: 'Foo.chm' }
}, '*');
```

3) WebView2 (C#) example (recommended on Windows hosts)

Use `PostWebMessageAsJson` to send a JSON message into the webview. Example (synchronous flow):

```csharp
using System.IO;
using System.Text.Json;

// Read the CHM file and convert to base64
var bytes = File.ReadAllBytes(@"C:\path\to\file.chm");
var base64 = Convert.ToBase64String(bytes);

var msgObj = new {
  type = "open-chm",
  payload = new { base64 = base64, name = Path.GetFileName(@"C:\path\to\file.chm") }
};
var json = JsonSerializer.Serialize(msgObj);
webView.CoreWebView2.PostWebMessageAsJson(json);
```

Notes:
- Using base64 avoids CORS and file:// restrictions. For large CHMs be mindful of memory and message size limits.
- The renderer also listens for the `chrome.webview` message API (used by WebView2).

---

## Message API (summary)

- `postMessage` / WebView message format:

```json
{
  "type": "open-chm",
  "payload": { "base64": "...", "name": "Foo.chm" }
}
```

- The page also accepts `type: 'chm-navigate'` messages from rendered CHM content when the embedded CHM page posts navigation requests; this is internal to the renderer.

---

## Troubleshooting

- If fetching via `url` fails: check CORS on the server or prefer sending base64 from host.
- If large files cause issues when sending base64: consider using a temporary HTTP endpoint the host can serve locally and pass its URL.
- If the host webview doesn't forward messages: verify you are using the proper host API (`PostWebMessageAsJson` for WebView2) and that CoreWebView2 is initialized.

---

## Development notes

- To debug the renderer, use the dev server: `npm run dev`.
- Code entry: [src/app.ts](src/app.ts#L1-L1) contains the host-message handling and plugin-mode detection (`window.__chm_PLUGIN` or `?plugin=1`).
- To regenerate single-file HTMLs after changes, run:

```bash
npm run build:all
```

The build helper overwrites `dist/*.html` with self-contained HTML and removes the temporary `dist/assets/` directory after inline processing succeeds.
