# AGENTS.md

## Project type

Figma plugin. `code.ts` runs in the Figma sandbox, `ui.html` is the plugin UI panel, `manifest.json` is the Figma plugin config.

## Commands

```bash
npm run build      # tsc → inject version tokens into code.js
npm run dev        # Watch code.ts / package.json / tsconfig.json / scripts, auto-run full build on change
npm run watch      # tsc --watch only (no version injection)
npm run lint       # ESLint
npm run lint:fix   # ESLint --fix
```

There are no test scripts.

**`npm run build` must succeed before the plugin works in Figma** because `code.js` is gitignored build output. `npm run watch` skips version injection, so tokens like `__PLUGIN_VERSION__` stay unreplaced — use `npm run build` or `npm run dev` for a production-ready build.

`npm run dev` does **not** watch `ui.html`; HTML/CSS changes require closing and relaunching the plugin in Figma.

## Build pipeline (must run in order)

1. `tsc -p tsconfig.json` compiles `code.ts` → `code.js`
2. `scripts/inject-version.mjs` replaces `__PLUGIN_VERSION__`, `__PLUGIN_BUILD_STAMP__`, and `__PLUGIN_DEV_LABEL__` tokens in the compiled `code.js` with values from `package.json` and current timestamp

`code.js` is gitignored. **Never edit `code.js` directly** — edit `code.ts` and run `npm run build`.

## Architecture

Single source file (`code.ts`, ~800 lines) with one UI file (`ui.html`). No frameworks — vanilla TypeScript and HTML/CSS/JS.

## Communication

The plugin (sandbox) and UI communicate via postMessage:
- Sandbox → UI: `figma.ui.postMessage({ type, ... })`
- UI → Sandbox: `parent.postMessage({ pluginMessage: { type, ... } }, '*')`

`ui.html` resizes via `parent.postMessage({ pluginMessage: { type: 'resize-ui', height } }, '*')`.

### Critical: `figma.mixed` cannot cross `postMessage`

`figma.mixed` is a Symbol. Figma's `figma.ui.postMessage` uses structured clone, and **Symbols cannot be cloned** — attempting to send `figma.mixed` in a message payload throws `DataCloneError` ("Cannot unwrap symbol").

Sandbox code may store `figma.mixed` in local state (e.g. `_stored.cornerRadius`), but the UI message contract must only send JSON-safe data. The `properties-copied` message sends `sourceName: string` and `sourceType: string`, **not** the full `StoredProperties` object.

## Figma-specific constraints

- TypeScript target is `es6`, lib is `es6` only — no DOM/types available in sandbox code
- Figma plugin typings from `@figma/plugin-typings`
- `manifest.json`: `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]`
- Text styles require `await figma.loadFontAsync(font)` before applying
- `dev-watch.mjs` only watches TS/build files; for HTML/CSS changes, manually close and relaunch the plugin in Figma

## Linting

Uses `@figma/eslint-plugin-figma-plugins/recommended` in addition to standard ESLint/TypeScript rules. Unused vars prefixed with `_` are allowed.

## House style

Sentence case only. Never introduce `text-transform: uppercase` or ALL-CAPS labels anywhere in the UI.

## Release

Use `./scripts/release.sh <patch|minor|major>` to lint, build, bump version, create `releases/CopyOne-v{X.Y.Z}.zip`, and optionally commit + tag. The zip contains exactly `manifest.json`, `code.js`, and `ui.html` for Figma upload.
