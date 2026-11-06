# CopyOne

![CopyOne demo](docs/demo.gif)

**Copy once, paste any property you want.**

A Figma plugin that copies visual properties from one layer and lets you paste only the ones you need onto other layers.

---

## What you can copy and paste

| Property | Details |
|----------|---------|
| Fills | Solid colors, gradients, images |
| Strokes | Color, per-side weights, alignment, caps, joins, dash patterns |
| Effects | Drop shadows, inner shadows, blurs |
| Corner radius | Uniform or individual corners, plus smoothing |
| Opacity | Layer opacity from 0 to 100% |
| Blend mode | Layer blend mode, including pass through |
| Text styles | Font, size, weight, line height, letter spacing |

Styles and variables are kept when they exist in the target file. When a style or variable is missing, CopyOne falls back to raw values and explains what happened in the paste message.

## How it works

1. Select one layer in Figma.
2. Click **Copy properties** or press `C` while the panel is focused.
3. Select one or more target layers.
4. Check only the properties you want.
5. Click **Paste selected** or press `V` while the panel is focused.

The clipboard stays available after the plugin is closed. Reopen it and paste with the same properties.

## How is this different from Figma's paste properties?

- Pick exactly which properties to paste instead of taking everything.
- Paste several properties at once to many layers.
- Keeps styles and variables when they're in the file, and falls back to values when they aren't.
- The clipboard survives closing the plugin, so you can come back to it later or use it in another file.

## Why use CopyOne?

- No more copying everything when you only need the stroke.
- Works with shapes, frames, components, text, and more.
- Paste to multiple layers at once.
- Clean, simple interface.

Perfect for designers who want precise control over style transfers without the all-or-nothing approach of Figma's native copy and paste.

---

## Installation

### From Figma Community

Search for **"CopyOne"** in the Figma Community plugins, or visit the [plugin page](https://www.figma.com/community/plugin/1595426926785684694) directly.

### For development

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. In Figma Desktop: **Plugins → Development → Import plugin from manifest...**
5. Select the `manifest.json` file.

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript and inject the version |
| `npm run dev` | Watch source files and rebuild automatically |
| `npm run watch` | TypeScript watch mode only |
| `npm run lint` | Check for linting errors |
| `npm run lint:fix` | Auto-fix linting errors |

### Project structure

```text
CopyOne/
├── code.ts          # Plugin logic (Figma sandbox)
├── code.js          # Compiled output (gitignored)
├── ui.html          # Plugin UI panel
├── manifest.json    # Figma plugin config
├── package.json     # Dependencies, scripts, version
├── tsconfig.json    # TypeScript config
├── scripts/         # Build, dev watch, and release scripts
├── docs/            # Demo assets
└── LICENSE          # MIT License
```

The `docs/` folder holds the demo GIF referenced at the top of this README.

## Contributing

Contributions are welcome. Feel free to report bugs, suggest features, or submit pull requests.

## License

[MIT](LICENSE) © Mehran Bolhasani
