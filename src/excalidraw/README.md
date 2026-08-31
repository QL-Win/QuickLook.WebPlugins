# excalidraw

Browser-based Excalidraw viewer — renders `.excalidraw` files directly in the browser without any server-side processing.

## Features

- Drag-and-drop or file-picker to open `.excalidraw` files
- Renders via [**@excalidraw/excalidraw**](https://www.npmjs.com/package/@excalidraw/excalidraw)'s `exportToSvg`
- Light / Dark export theme toggle
- Pan (drag) and zoom (scroll wheel / pinch) with fit-to-view
- Keyboard shortcuts: `Ctrl++` / `Ctrl+-` / `Ctrl+0` (fit) / `Ctrl+1` (100%)
- **Plugin mode** (`plugin.html`) — embed as iframe, push drawings via `postMessage`
- Single-file build output — no external dependencies at runtime

## Usage

```bash
npm install
npm run dev          # dev server
npm run build        # production build → dist/
npm run build:all    # production build + inline into single HTML files
```

After `build:all`, `dist/index.html` and `dist/plugin.html` are fully self-contained single-file HTML documents with no external requests.

## Plugin API

Embed `plugin.html` in an iframe:

```html
<iframe id="viz" src="plugin.html"></iframe>
```

Send a drawing via `postMessage` (pass the raw JSON string or the parsed object):

```js
// Using the raw file text
const json = await fetch('my-drawing.excalidraw').then(r => r.text());
document.getElementById('viz').contentWindow.postMessage({
  type: 'excalidraw-render',
  data: json,      // string or parsed object
  dark: false      // optional dark mode flag
}, '*');
```

Or, if same-origin, call directly:

```js
// data can be a JSON string or a parsed { elements, appState, files } object
iframeEl.contentWindow.__excalidraw_RENDER(data, /* dark= */ false);
```

## Test files

| File | Description |
|------|-------------|
| `test/simple.excalidraw` | Rectangle + ellipse connected by an arrow |
| `test/flowchart.excalidraw` | Input-validation flowchart with decision diamond and loop |
| `test/mindmap.excalidraw` | Project mind map with Design, Dev, DevOps, and QA branches |

## Project structure

```
excalidraw/
├── index.html              # Standalone viewer
├── plugin.html             # Embeddable iframe plugin
├── src/
│   ├── app.ts              # UI, pan/zoom, file loading, plugin API
│   ├── renderer.ts         # Wraps @excalidraw/excalidraw exportToSvg
│   └── style.css           # Dark-themed UI styles
├── scripts/
│   └── make-singlefiles.js # Inlines CSS+JS into dist HTML after build
├── test/                   # Sample .excalidraw files
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture

Follows the same pattern as [`gv`](../gv):

| Layer | gv | excalidraw |
|-------|---------|-----------------|
| Input format | `.gv` / `.dot` (text) | `.excalidraw` (JSON) |
| Render library | `@viz-js/viz` (WASM Graphviz) | `@excalidraw/excalidraw` |
| Output | SVG element | SVG element |
| Config option | Layout engine selector | Light/dark theme toggle |
| Build | Vite + make-singlefiles.js | Vite + make-singlefiles.js |
