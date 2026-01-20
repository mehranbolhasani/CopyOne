# CopyOne

**Copy once, paste any property you want.**

A Figma plugin that lets you copy all visual properties from any element and selectively paste only the ones you need to other elements.

---

## What You Can Copy & Paste

| Property | Details |
|----------|---------|
| **Fills** | Solid colors, gradients, images |
| **Strokes** | Color, weight, alignment, dash patterns |
| **Effects** | Drop shadows, inner shadows, blurs |
| **Corner Radius** | Uniform or individual corners |
| **Opacity & Blend** | Opacity level and blend mode |
| **Text Styles** | Font, size, weight, line height, letter spacing |

## How It Works

1. Select any element in Figma
2. Click **"Copy Properties"** to capture everything
3. Select your target element(s)
4. Check only the properties you want
5. Click **"Paste Selected"**

## Why Use CopyOne?

- No more copying everything when you just need the stroke
- Works with shapes, frames, components, text, and more
- Paste to multiple elements at once
- Clean, simple interface

Perfect for designers who want precise control over style transfers without the all-or-nothing approach of Figma's native copy/paste.

---

## Installation

### From Figma Community
Search for **"CopyOne"** in the Figma Community plugins, or visit the [plugin page](#) directly.

### For Development
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. In Figma Desktop: **Plugins → Development → Import plugin from manifest...**
5. Select the `manifest.json` file

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode - auto-compile on changes |
| `npm run lint` | Check for linting errors |
| `npm run lint:fix` | Auto-fix linting errors |

### Project Structure

```
CopyOne/
├── code.ts          # Plugin logic (Figma sandbox)
├── code.js          # Compiled output
├── ui.html          # Plugin UI panel
├── manifest.json    # Figma plugin config
├── package.json     # Dependencies & scripts
├── tsconfig.json    # TypeScript config
└── LICENSE          # MIT License
```

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## License

[MIT](LICENSE) © Mehran Bolhasani
