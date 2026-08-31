# iconfont

浏览器端 Icon Font 查看器 — 加载本地 TTF / OTF / WOFF / WOFF2 字体，以 [Iconify](https://icon-sets.iconify.design/) 风格的 icon-set 网格浏览图标，并复制 HTML / CSS / Unicode。

## 功能

- 拖放或文件选择器打开字体文件（`.ttf`、`.otf`、`.woff`、`.woff2`）
- 可选加载 `iconfont.css`（iconfont.cn 导出格式）以显示类名
- Iconify 风格 UI：搜索栏、图标网格、分页、右侧详情面板
- 详情面板支持调整大小/颜色，复制 HTML、CSS、Unicode、HTML Entity
- **Plugin 模式**（`plugin.html`）— 嵌入 iframe，通过 `postMessage` 传入字体数据
- 单文件构建 — `build:all` 后无需外部依赖

## 使用

```bash
npm install
npm run dev          # 开发服务器
npm run build        # 生产构建 → dist/
npm run build:all    # 构建 + 内联为单文件 HTML
```

执行 `build:all` 后，`dist/index.html` 与 `dist/plugin.html` 为完全自包含的单文件 HTML。

## Plugin API

嵌入 `plugin.html`：

```html
<iframe id="viewer" src="plugin.html"></iframe>
```

通过 `postMessage` 传入 base64 编码的字体：

```js
const fontBytes = await fetch('iconfont.woff2').then(r => r.arrayBuffer());
const base64 = btoa(String.fromCharCode(...new Uint8Array(fontBytes)));

document.getElementById('viewer').contentWindow.postMessage({
  type: 'iconfont-load',
  payload: {
    fontBase64: base64,
    fileName: 'iconfont.woff2',
    mimeType: 'font/woff2',
    cssText: await fetch('iconfont.css').then(r => r.text()), // 可选
    familyName: 'iconfont', // 可选
  }
}, '*');
```

同源时也可直接调用：

```js
iframeEl.contentWindow.__iconfont_LOAD({
  fontBase64: base64,
  fileName: 'iconfont.woff2',
  mimeType: 'font/woff2',
});
```

## 项目结构

```
iconfont/
├── index.html              # 独立查看器
├── plugin.html             # 可嵌入 iframe 插件
├── src/
│   ├── app.ts              # UI、搜索、分页、Plugin API
│   ├── font-parser.ts      # opentype.js 字体解析与 snippet 生成
│   ├── css-parser.ts       # iconfont.css 类名解析
│   ├── types.ts
│   └── style.css           # Iconify 风格 UI
├── scripts/
│   └── make-singlefiles.js # 构建后内联 CSS+JS
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 架构

与 [excalidraw](../excalidraw) 相同模式：

| 层 | excalidraw | iconfont |
|----|-----------------|---------------|
| 输入 | `.excalidraw` JSON | TTF/WOFF 字体 + 可选 CSS |
| 解析库 | `@excalidraw/excalidraw` | `opentype.js` |
| 输出 | SVG 渲染 | `@font-face` + iconfont 字符渲染 |
| 构建 | Vite + make-singlefiles.js | Vite + make-singlefiles.js |
