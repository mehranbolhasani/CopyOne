// CopyOne - Selective Property Copy/Paste Plugin

// ============================================================================
// Type Definitions
// ============================================================================

interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

interface TextStyles {
  fontSize?: number;
  fontName?: FontName;
  lineHeight?: LineHeight;
  letterSpacing?: LetterSpacing;
  textCase?: TextCase;
  textDecoration?: TextDecoration;
  hasMixedValues?: boolean;
}

interface StoredProperties {
  // Source element info
  sourceName: string;
  sourceType: string;

  // Fill properties
  fills?: readonly Paint[] | typeof figma.mixed;

  // Stroke properties
  strokes?: readonly Paint[];
  strokeWeight?: number | typeof figma.mixed;
  strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE";
  strokeCap?: StrokeCap | typeof figma.mixed;
  strokeJoin?: StrokeJoin | typeof figma.mixed;
  dashPattern?: readonly number[];

  // Effects
  effects?: readonly Effect[];

  // Corner radius
  cornerRadius?: number | typeof figma.mixed;
  cornerRadii?: CornerRadii;

  // Opacity and blend
  opacity?: number;
  blendMode?: BlendMode;

  // Text styles
  textStyles?: TextStyles;
}

interface PropertyPreviews {
  fills?: {
    swatches: string[];
    label: string;
    hasImage: boolean;
  };
  strokes?: {
    swatch: string;
    weight: string;
    dashed: boolean;
  };
  effects?: string;
  cornerRadius?: string;
  opacityBlend?: string;
  textStyles?: string;
  textStylesPartial?: boolean;
}

// Message types for communication between UI and plugin
type MessageToPlugin =
  | { type: "copy" }
  | { type: "paste"; properties: string[] }
  | { type: "get-selection" }
  | { type: "resize-ui"; height: number };

type MessageToUI =
  | { type: "version"; version: string }
  | { type: "build-info"; devLabel: string; buildStamp: string }
  | { type: "selection-changed"; hasSelection: boolean; nodeName?: string; nodeType?: string }
  | { type: "properties-copied"; properties: StoredProperties; availableProperties: string[]; previews: PropertyPreviews }
  | { type: "paste-complete"; success: boolean; message: string }
  | { type: "info"; message: string }
  | { type: "error"; message: string };

// ============================================================================
// Global State
// ============================================================================

let _stored: StoredProperties | null = null;

function getStored(): StoredProperties | null {
  return _stored;
}

function setStored(value: StoredProperties): void {
  _stored = value;
}
const PLUGIN_VERSION = "__PLUGIN_VERSION__";
const PLUGIN_BUILD_STAMP = "__PLUGIN_BUILD_STAMP__";
const PLUGIN_DEV_LABEL = "__PLUGIN_DEV_LABEL__";
const UI_WIDTH = 300;
const UI_MIN_HEIGHT = 420;
const UI_MAX_HEIGHT = 1200;

// ============================================================================
// Property Extraction Functions
// ============================================================================

function extractFills(node: SceneNode): Pick<StoredProperties, "fills"> {
  if ("fills" in node) {
    return { fills: node.fills };
  }
  return {};
}

function extractStrokes(node: SceneNode): Pick<StoredProperties, "strokes" | "strokeWeight" | "strokeAlign" | "strokeCap" | "strokeJoin" | "dashPattern"> {
  const result: Pick<StoredProperties, "strokes" | "strokeWeight" | "strokeAlign" | "strokeCap" | "strokeJoin" | "dashPattern"> = {};

  if ("strokes" in node) {
    result.strokes = node.strokes as Paint[];
  }
  if ("strokeWeight" in node) {
    result.strokeWeight = node.strokeWeight;
  }
  if ("strokeAlign" in node) {
    result.strokeAlign = node.strokeAlign;
  }
  if ("strokeCap" in node) {
    result.strokeCap = node.strokeCap;
  }
  if ("strokeJoin" in node) {
    result.strokeJoin = node.strokeJoin;
  }
  if ("dashPattern" in node) {
    result.dashPattern = node.dashPattern;
  }

  return result;
}

function extractEffects(node: SceneNode): Pick<StoredProperties, "effects"> {
  if ("effects" in node) {
    return { effects: node.effects as Effect[] };
  }
  return {};
}

function extractCornerRadius(node: SceneNode): Pick<StoredProperties, "cornerRadius" | "cornerRadii"> {
  if (!("cornerRadius" in node)) return {};

  const cr = node.cornerRadius;

  if (typeof cr === 'number') {
    return { cornerRadius: cr };
  }

  const topLeft = "topLeftRadius" in node ? node.topLeftRadius : undefined;
  const topRight = "topRightRadius" in node ? node.topRightRadius : undefined;
  const bottomLeft = "bottomLeftRadius" in node ? node.bottomLeftRadius : undefined;
  const bottomRight = "bottomRightRadius" in node ? node.bottomRightRadius : undefined;

  const tlOk = typeof topLeft === 'number';
  const trOk = typeof topRight === 'number';
  const blOk = typeof bottomLeft === 'number';
  const brOk = typeof bottomRight === 'number';

  if (!tlOk && !trOk && !blOk && !brOk) {
    return { cornerRadius: cr };
  }

  return {
    cornerRadius: cr,
    cornerRadii: {
      topLeft: tlOk ? topLeft as number : 0,
      topRight: trOk ? topRight as number : 0,
      bottomLeft: blOk ? bottomLeft as number : 0,
      bottomRight: brOk ? bottomRight as number : 0,
    },
  };
}

function extractOpacityBlend(node: SceneNode): Pick<StoredProperties, "opacity" | "blendMode"> {
  const result: Pick<StoredProperties, "opacity" | "blendMode"> = {};

  if ("opacity" in node) {
    result.opacity = node.opacity;
  }
  if ("blendMode" in node) {
    result.blendMode = node.blendMode;
  }

  return result;
}

function extractTextStyles(node: SceneNode): Pick<StoredProperties, "textStyles"> {
  if (node.type !== "TEXT") {
    return {};
  }

  const textNode = node as TextNode;
  const styles: TextStyles = {};
  let hasMixed = false;

  if (textNode.fontSize !== figma.mixed) {
    styles.fontSize = textNode.fontSize;
  } else {
    hasMixed = true;
  }

  if (textNode.fontName !== figma.mixed) {
    styles.fontName = textNode.fontName;
  } else {
    hasMixed = true;
  }

  if (textNode.lineHeight !== figma.mixed) {
    styles.lineHeight = textNode.lineHeight;
  } else {
    hasMixed = true;
  }

  if (textNode.letterSpacing !== figma.mixed) {
    styles.letterSpacing = textNode.letterSpacing;
  } else {
    hasMixed = true;
  }

  if (textNode.textCase !== figma.mixed) {
    styles.textCase = textNode.textCase;
  } else {
    hasMixed = true;
  }

  if (textNode.textDecoration !== figma.mixed) {
    styles.textDecoration = textNode.textDecoration;
  } else {
    hasMixed = true;
  }

  // If no non-mixed properties were extracted, skip entirely
  const hasAnyStyle = styles.fontSize !== undefined || styles.fontName !== undefined ||
    styles.lineHeight !== undefined || styles.letterSpacing !== undefined ||
    styles.textCase !== undefined || styles.textDecoration !== undefined;

  if (!hasAnyStyle) {
    return {};
  }

  if (hasMixed) {
    styles.hasMixedValues = true;
  }

  return { textStyles: styles };
}

function extractAllProperties(node: SceneNode): StoredProperties {
  return {
    sourceName: node.name,
    sourceType: node.type,
    ...extractFills(node),
    ...extractStrokes(node),
    ...extractEffects(node),
    ...extractCornerRadius(node),
    ...extractOpacityBlend(node),
    ...extractTextStyles(node),
  };
}

function componentToHex(c: number): string {
  const hex = Math.round(c * 255).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function computeFillsPreview(fills: readonly Paint[] | typeof figma.mixed): NonNullable<PropertyPreviews['fills']> | undefined {
  if (!fills || fills === figma.mixed || fills.length === 0) return undefined;

  const swatches: string[] = [];
  let hasImage = false;
  let solidCount = 0;

  for (const fill of fills) {
    if (fill.type === 'SOLID' && fill.color) {
      swatches.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
      solidCount++;
    } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_ANGULAR' || fill.type === 'GRADIENT_DIAMOND') {
      if (fill.gradientStops && fill.gradientStops.length > 0) {
        const first = fill.gradientStops[0];
        swatches.push(rgbToHex(first.color.r, first.color.g, first.color.b));
      } else {
        swatches.push('#888888');
      }
    } else if (fill.type === 'IMAGE') {
      hasImage = true;
      swatches.push('image');
    }
  }

  let label: string;
  if (solidCount === fills.length && solidCount === 1) {
    label = swatches[0];
  } else if (solidCount === fills.length) {
    label = `${solidCount} solids`;
  } else {
    const parts: string[] = [];
    if (solidCount > 0) parts.push(`${solidCount} solid${solidCount > 1 ? 's' : ''}`);
    if (fills.length - solidCount - (hasImage ? 1 : 0) > 0) parts.push('gradient');
    if (hasImage) parts.push('image');
    label = parts.join(', ');
  }

  return { swatches, label, hasImage };
}

function computeStrokesPreview(props: StoredProperties): NonNullable<PropertyPreviews['strokes']> | undefined {
  if (!props.strokes || props.strokes.length === 0) return undefined;

  const stroke = props.strokes[0];
  let swatch = '';
  if (stroke.type === 'SOLID' && stroke.color) {
    swatch = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
  } else if (stroke.type === 'GRADIENT_LINEAR' || stroke.type === 'GRADIENT_RADIAL' || stroke.type === 'GRADIENT_ANGULAR' || stroke.type === 'GRADIENT_DIAMOND') {
    if (stroke.gradientStops && stroke.gradientStops.length > 0) {
      swatch = rgbToHex(stroke.gradientStops[0].color.r, stroke.gradientStops[0].color.g, stroke.gradientStops[0].color.b);
    }
  }

  let weight = '';
  if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
    weight = `${props.strokeWeight}px`;
  }

  const dashed = props.dashPattern !== undefined && props.dashPattern.length > 0;

  return { swatch, weight, dashed };
}

function computeEffectsPreview(effects: readonly Effect[]): string | undefined {
  if (!effects || effects.length === 0) return undefined;

  const shadowCount = effects.filter(e => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW').length;
  const blurCount = effects.filter(e => e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR').length;

  const parts: string[] = [];
  if (shadowCount > 0) parts.push(`${shadowCount} shadow${shadowCount > 1 ? 's' : ''}`);
  if (blurCount > 0) parts.push(`${blurCount} blur${blurCount > 1 ? 's' : ''}`);
  if (parts.length === 0) parts.push(`${effects.length} effect${effects.length > 1 ? 's' : ''}`);

  return parts.join(', ');
}

function computeCornerRadiusPreview(props: StoredProperties): string | undefined {
  if (props.cornerRadius === undefined) return undefined;

  if (props.cornerRadii) {
    const r = props.cornerRadii;
    return `${r.topLeft} / ${r.topRight} / ${r.bottomLeft} / ${r.bottomRight}`;
  }

  if (props.cornerRadius !== figma.mixed) {
    return `${props.cornerRadius}`;
  }

  return 'Mixed';
}

function computeOpacityBlendPreview(props: StoredProperties): string | undefined {
  if (props.opacity === undefined && props.blendMode === undefined) return undefined;

  const parts: string[] = [];

  if (props.opacity !== undefined) {
    parts.push(`${Math.round(props.opacity * 100)}%`);
  }

  if (props.blendMode !== undefined && props.blendMode !== 'PASS_THROUGH' && props.blendMode !== 'NORMAL') {
    const modeName = props.blendMode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    parts.push(modeName);
  }

  return parts.join(', ') || undefined;
}

function computeTextStylesPreview(props: StoredProperties): { text: string; hasMixed: boolean } | undefined {
  if (!props.textStyles) return undefined;

  const parts: string[] = [];

  if (props.textStyles.fontName) {
    parts.push(props.textStyles.fontName.family);
  }

  if (props.textStyles.fontSize !== undefined) {
    parts.push(`${props.textStyles.fontSize}`);
  }

  return {
    text: parts.length > 0 ? parts.join(' ') : 'Text styling',
    hasMixed: props.textStyles.hasMixedValues === true,
  };
}

function computeAllPreviews(props: StoredProperties): PropertyPreviews {
  const previews: PropertyPreviews = {};

  if (props.fills !== undefined && props.fills !== figma.mixed && props.fills.length > 0) {
    const fp = computeFillsPreview(props.fills);
    if (fp) previews.fills = fp;
  }

  if (props.strokes !== undefined && props.strokes.length > 0) {
    const sp = computeStrokesPreview(props);
    if (sp) previews.strokes = sp;
  }

  if (props.effects !== undefined && props.effects.length > 0) {
    const ep = computeEffectsPreview(props.effects);
    if (ep) previews.effects = ep;
  }

  if (props.cornerRadius !== undefined || props.cornerRadii !== undefined) {
    const cr = computeCornerRadiusPreview(props);
    if (cr) previews.cornerRadius = cr;
  }

  if (props.opacity !== undefined || props.blendMode !== undefined) {
    const ob = computeOpacityBlendPreview(props);
    if (ob) previews.opacityBlend = ob;
  }

  if (props.textStyles !== undefined) {
    const ts = computeTextStylesPreview(props);
    if (ts) {
      previews.textStyles = ts.text;
      previews.textStylesPartial = ts.hasMixed;
    }
  }

  return previews;
}

function getAvailableProperties(props: StoredProperties): string[] {
  const available: string[] = [];

  if (props.fills !== undefined && props.fills !== figma.mixed && props.fills.length > 0) available.push("fills");
  if (props.strokes !== undefined && props.strokes.length > 0) available.push("strokes");
  if (props.effects !== undefined && props.effects.length > 0) available.push("effects");
  if (props.cornerRadius !== undefined || props.cornerRadii !== undefined) available.push("cornerRadius");
  if (props.opacity !== undefined || props.blendMode !== undefined) available.push("opacityBlend");
  if (props.textStyles !== undefined) available.push("textStyles");

  return available;
}

// ============================================================================
// Property Application Functions
// ============================================================================

function applyFills(node: SceneNode, props: StoredProperties): boolean {
  if (props.fills === undefined || props.fills === figma.mixed) return false;
  if (!("fills" in node)) return false;

  try {
    (node as GeometryMixin).fills = [...props.fills];
    return true;
  } catch {
    return false;
  }
}

function applyStrokes(node: SceneNode, props: StoredProperties): boolean {
  if (props.strokes === undefined) return false;
  if (!("strokes" in node)) return false;

  try {
    const strokeNode = node as MinimalStrokesMixin;
    let didApply = false;

    if (props.strokes) {
      strokeNode.strokes = [...props.strokes];
      didApply = true;
    }
    if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
      strokeNode.strokeWeight = props.strokeWeight;
      didApply = true;
    }
    if (props.strokeAlign !== undefined) {
      strokeNode.strokeAlign = props.strokeAlign;
      didApply = true;
    }

    // These properties are on nodes that support individual stroke settings
    const extendedNode = node as SceneNode & { strokeCap?: StrokeCap; strokeJoin?: StrokeJoin; dashPattern?: number[] };
    if ("strokeCap" in extendedNode && props.strokeCap !== undefined && props.strokeCap !== figma.mixed) {
      extendedNode.strokeCap = props.strokeCap;
    }
    if ("strokeJoin" in extendedNode && props.strokeJoin !== undefined && props.strokeJoin !== figma.mixed) {
      extendedNode.strokeJoin = props.strokeJoin;
    }
    if ("dashPattern" in extendedNode && props.dashPattern !== undefined) {
      extendedNode.dashPattern = [...props.dashPattern];
    }

    return didApply;
  } catch {
    return false;
  }
}

function applyEffects(node: SceneNode, props: StoredProperties): boolean {
  if (props.effects === undefined) return false;
  if (!("effects" in node)) return false;

  try {
    (node as BlendMixin).effects = [...props.effects];
    return true;
  } catch {
    return false;
  }
}

function applyCornerRadius(node: SceneNode, props: StoredProperties): boolean {
  if (props.cornerRadius === undefined && props.cornerRadii === undefined) return false;
  if (!("cornerRadius" in node)) return false;

  try {
    const cornerNode = node as CornerMixin;
    let didApply = false;

    if (props.cornerRadii) {
      // Apply individual corner radii if available
      if ("topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node) {
        const rectNode = node as RectangleNode | FrameNode | ComponentNode | InstanceNode;
        rectNode.topLeftRadius = props.cornerRadii.topLeft;
        rectNode.topRightRadius = props.cornerRadii.topRight;
        rectNode.bottomLeftRadius = props.cornerRadii.bottomLeft;
        rectNode.bottomRightRadius = props.cornerRadii.bottomRight;
        didApply = true;
      }
    } else if (props.cornerRadius !== figma.mixed && props.cornerRadius !== undefined) {
      cornerNode.cornerRadius = props.cornerRadius as number;
      didApply = true;
    }

    return didApply;
  } catch {
    return false;
  }
}

function applyOpacityBlend(node: SceneNode, props: StoredProperties): boolean {
  if (props.opacity === undefined && props.blendMode === undefined) return false;

  let didApply = false;
  try {
    if ("opacity" in node && props.opacity !== undefined) {
      (node as BlendMixin).opacity = props.opacity;
      didApply = true;
    }
    if ("blendMode" in node && props.blendMode !== undefined) {
      (node as BlendMixin).blendMode = props.blendMode;
      didApply = true;
    }
    return didApply;
  } catch {
    return false;
  }
}

async function applyTextStyles(node: SceneNode, props: StoredProperties): Promise<boolean> {
  if (props.textStyles === undefined) return false;
  if (node.type !== "TEXT") return false;

  try {
    const textNode = node as TextNode;
    const styles = props.textStyles;
    let didApply = false;

    // Must load font before applying text styles
    if (styles.fontName) {
      await figma.loadFontAsync(styles.fontName);
      textNode.fontName = styles.fontName;
      didApply = true;
    } else {
      // Load existing font to allow other text property changes
      if (textNode.fontName !== figma.mixed) {
        await figma.loadFontAsync(textNode.fontName);
      }
    }

    if (styles.fontSize !== undefined) { textNode.fontSize = styles.fontSize; didApply = true; }
    if (styles.lineHeight !== undefined) { textNode.lineHeight = styles.lineHeight; didApply = true; }
    if (styles.letterSpacing !== undefined) { textNode.letterSpacing = styles.letterSpacing; didApply = true; }
    if (styles.textCase !== undefined) { textNode.textCase = styles.textCase; didApply = true; }
    if (styles.textDecoration !== undefined) { textNode.textDecoration = styles.textDecoration; didApply = true; }

    return didApply;
  } catch {
    return false;
  }
}

async function applyProperties(node: SceneNode, props: StoredProperties, propertiesToApply: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const prop of propertiesToApply) {
    let result = false;

    switch (prop) {
      case "fills":
        result = applyFills(node, props);
        break;
      case "strokes":
        result = applyStrokes(node, props);
        break;
      case "effects":
        result = applyEffects(node, props);
        break;
      case "cornerRadius":
        result = applyCornerRadius(node, props);
        break;
      case "opacityBlend":
        result = applyOpacityBlend(node, props);
        break;
      case "textStyles":
        result = await applyTextStyles(node, props);
        break;
    }

    if (result) {
      success.push(prop);
    } else {
      failed.push(prop);
    }
  }

  return { success, failed };
}

// ============================================================================
// Selection Handling
// ============================================================================

function sendSelectionUpdate(): void {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "selection-changed",
      hasSelection: false,
    } as MessageToUI);
  } else if (selection.length === 1) {
    figma.ui.postMessage({
      type: "selection-changed",
      hasSelection: true,
      nodeName: selection[0].name,
      nodeType: selection[0].type,
    } as MessageToUI);
  } else {
    figma.ui.postMessage({
      type: "selection-changed",
      hasSelection: true,
      nodeName: `${selection.length} elements`,
      nodeType: "MULTIPLE",
    } as MessageToUI);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

async function handleCopy(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select an element first",
    } as MessageToUI);
    return;
  }

  if (selection.length > 1) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select only one element to copy from",
    } as MessageToUI);
    return;
  }

  const node = selection[0];
  const properties = extractAllProperties(node);
  setStored(properties);
  const availableProperties = getAvailableProperties(properties);
  const previews = computeAllPreviews(properties);

  figma.ui.postMessage({
    type: "properties-copied",
    properties: properties,
    availableProperties,
    previews,
  } as MessageToUI);

  if (properties.textStyles?.hasMixedValues) {
    figma.ui.postMessage({
      type: "info",
      message: "Some text styles were skipped due to mixed values.",
    } as MessageToUI);
  }

  figma.notify(`Copied properties from "${node.name}"`);
}

async function handlePaste(propertiesToPaste: string[]): Promise<void> {
  const selection = figma.currentPage.selection;

  const stored = getStored();

  if (!stored) {
    figma.ui.postMessage({
      type: "error",
      message: "No properties copied. Please copy properties first.",
    } as MessageToUI);
    return;
  }

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select target element(s) first",
    } as MessageToUI);
    return;
  }

  if (propertiesToPaste.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select at least one property to paste",
    } as MessageToUI);
    return;
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const node of selection) {
    const result = await applyProperties(node, stored, propertiesToPaste);
    totalSuccess += result.success.length;
    totalFailed += result.failed.length;
  }

  figma.commitUndo();

  const message = totalFailed > 0
    ? `Applied ${totalSuccess} properties. ${totalFailed} couldn't be applied (incompatible node types).`
    : `Successfully applied ${totalSuccess} properties to ${selection.length} element(s).`;

  figma.ui.postMessage({
    type: "paste-complete",
    success: totalFailed === 0,
    message,
  } as MessageToUI);

  figma.notify(message);
}

// ============================================================================
// Plugin Initialization
// ============================================================================

// Show the UI panel
figma.showUI(__html__, {
  width: UI_WIDTH,
  height: 560,
  title: "CopyOne",
});

figma.ui.postMessage({
  type: "version",
  version: PLUGIN_VERSION,
} as MessageToUI);
figma.ui.postMessage({
  type: "build-info",
  devLabel: PLUGIN_DEV_LABEL,
  buildStamp: PLUGIN_BUILD_STAMP,
} as MessageToUI);

// Listen for selection changes
figma.on("selectionchange", () => {
  sendSelectionUpdate();
});

// Send initial selection state
sendSelectionUpdate();

// Handle messages from UI
figma.ui.onmessage = async (msg: MessageToPlugin) => {
  switch (msg.type) {
    case "copy":
      await handleCopy();
      break;
    case "paste":
      await handlePaste(msg.properties);
      break;
    case "get-selection":
      sendSelectionUpdate();
      break;
    case "resize-ui":
      if (Number.isFinite(msg.height)) {
        const nextHeight = Math.max(UI_MIN_HEIGHT, Math.min(UI_MAX_HEIGHT, Math.ceil(msg.height)));
        figma.ui.resize(UI_WIDTH, nextHeight);
      }
      break;
  }
};
