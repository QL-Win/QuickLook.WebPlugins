# gv

Browser-based Graphviz viewer — renders `.gv` and `.dot` files directly in the browser without any server-side processing.

## Features

- Drag-and-drop or file-picker to open `.gv` / `.dot` files
- Renders via [**@viz-js/viz**](https://www.npmjs.com/package/@viz-js/viz) (WebAssembly build of Graphviz)
- All 8 Graphviz layout engines: `dot`, `neato`, `fdp`, `sfdp`, `twopi`, `circo`, `osage`, `patchwork`
- Pan (drag) and zoom (scroll wheel / pinch) with fit-to-view
- Keyboard shortcuts: `Ctrl++` / `Ctrl+-` / `Ctrl+0` (fit) / `Ctrl+1` (100%)
- **Plugin mode** (`plugin.html`) — embed as iframe, push graphs via `postMessage`
- Single-file build output — no external dependencies at runtime

## Usage

```bash
npm install
npm run dev          # dev server
npm run build        # production build → dist/
npm run build:all    # production build + inline into single HTML files
```

After `build:all`, `dist/index.html` and `dist/plugin.html` are fully self-contained.

## Plugin API

Embed `plugin.html` in an iframe:

```html
<iframe id="viz" src="plugin.html"></iframe>
```

Send a graph via `postMessage`:

```js
document.getElementById('viz').contentWindow.postMessage({
  type: 'gv-render',
  dot: 'digraph { a -> b -> c }',
  engine: 'dot'   // optional
}, '*');
```

Or, if same-origin, call directly:

```js
iframeEl.contentWindow.__gv_RENDER('digraph { a -> b }', 'neato');
```

## Test files

| File | Description |
|------|-------------|
| `test/simple.gv` | Simple directed graph with a loop |
| `test/fsm.dot` | TCP finite state machine |
| `test/cluster.dot` | Web architecture with clustered subgraphs |
| `test/social.gv` | Undirected social network (use `neato` or `fdp` engine) |
| `test/classes.dot` | UML class hierarchy with record shapes |
