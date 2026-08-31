# QuickLook.WebPlugins

Browser-based viewers that render various file formats as self-contained HTML. Each package ships a standalone UI and a **plugin mode** (`plugin.html`) for embedding in hosts such as [QuickLook](https://github.com/QL-Win/QuickLook) / WebView2 via `postMessage`.

## Packages

| Package | Formats | Engine |
| --- | --- | --- |
| [`src/adoc`](src/adoc) | `.adoc`, `.asciidoc` | Asciidoctor.js |
| [`src/chm`](src/chm) | `.chm` | In-browser CHM parser |
| [`src/excalidraw`](src/excalidraw) | `.excalidraw` | `@excalidraw/excalidraw` |
| [`src/gv`](src/gv) | `.gv`, `.dot` | `@viz-js/viz` (Graphviz WASM) |
| [`src/iconfont`](src/iconfont) | `.ttf`, `.otf`, `.woff`, `.woff2` | Local icon-font browser |
| [`src/ipynb`](src/ipynb) | `.ipynb` | Jupyter Notebook renderer |
| [`src/rst`](src/rst) | `.rst`, `.rest` | rst-compiler |

## Requirements

- Node.js 20+ (18+ may work for some packages)
- npm

## Quick start

Each package is independent. From the repo root:

```bash
cd src/<package>   # e.g. src/adoc
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`) and open a sample file from the UI.

## Build

```bash
cd src/<package>
npm run build        # multi-file output under dist/
npm run build:all    # build + inline into single-file HTML
```

After `build:all`, `dist/index.html` and `dist/plugin.html` are self-contained (no external runtime requests).

## Plugin mode

Embed `plugin.html` in an iframe (or WebView2) and push content with `postMessage`. Message shapes differ per package — see each package README for the exact API.

Typical host flow:

1. Load `plugin.html`
2. Wait for the viewer ready signal (if documented)
3. `postMessage` file bytes / text / JSON
4. Viewer renders inside the page

## Layout

```
QuickLook.WebPlugins/
├── README.md
└── src/
    ├── adoc/
    ├── chm/
    ├── excalidraw/
    ├── gv/
    ├── iconfont/
    ├── ipynb/
    └── rst/
```

## License

See individual package directories for details. This collection is maintained for use with QuickLook on Windows.
