# AGENTS.md

## Project type
Figma plugin. `code.ts` runs in the Figma sandbox, `ui.html` is the plugin UI panel, `manifest.json` is the Figma plugin config.

## Commands

```bash
npm run build      # tsc → inject version tokens into code.js
npm run dev        # Watch TS/build files, auto-run full build on change
npm run watch      # tsc --watch only (no version injection)
npm run lint       # ESLint
npm run lint:fix   # ESLint --fix
```

There are no test scripts.

## Build pipeline (must run in order)

1. `tsc -p tsconfig.json` compiles `code.ts` → `code.js`
2. `scripts/inject-version.mjs` replaces `__PLUGIN_VERSION__`, `__PLUGIN_BUILD_STAMP__`, and `__PLUGIN_DEV_LABEL__` tokens in the compiled `code.js` with values from `package.json` and current timestamp

`npm run watch` skips step 2, so `code.js` will have unreplaced tokens. Use `npm run dev` or `npm run build` instead.

## Architecture

Single source file (`code.ts`, ~600 lines) with one UI file (`ui.html`). No frameworks — just vanilla TypeScript and HTML/CSS/JS.

`code.js` is gitignored build output. **Never edit `code.js` directly** — edit `code.ts` and run `npm run build`.

## Communication

The plugin (sandbox) and UI communicate via postMessage:
- Sandbox → UI: `figma.ui.postMessage({ type, ... })`
- UI → Sandbox: `parent.postMessage({ pluginMessage: { type, ... } }, '*')`

`ui.html` resizes via `parent.postMessage({ pluginMessage: { type: 'resize-ui', height } }, '*')`.

## Figma-specific constraints

- TypeScript target is `es6`, lib is `es6` only — no DOM/types available in sandbox code
- Figma plugin typings from `@figma/plugin-typings`
- `manifest.json`: `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]`
- Text styles require `await figma.loadFontAsync(font)` before applying
- `dev-watch.mjs` only watches TS/build files; for HTML/CSS changes, manually close and relaunch the plugin in Figma

## Linting

Uses `@figma/eslint-plugin-figma-plugins/recommended` in addition to standard ESLint/TypeScript rules. Unused vars prefixed with `_` are allowed.
