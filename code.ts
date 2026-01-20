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
  fontSize: number;
  fontName: FontName;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
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

// Message types for communication between UI and plugin
type MessageToPlugin =
  | { type: "copy" }
  | { type: "paste"; properties: string[] }
  | { type: "get-selection" };

type MessageToUI =
  | { type: "selection-changed"; hasSelection: boolean; nodeName?: string; nodeType?: string }
  | { type: "properties-copied"; properties: StoredProperties; availableProperties: string[] }
  | { type: "paste-complete"; success: boolean; message: string }
  | { type: "error"; message: string };

// ============================================================================
// Global State
// ============================================================================

let storedProperties: StoredProperties | null = null;

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
  const result: Pick<StoredProperties, "cornerRadius" | "cornerRadii"> = {};

  if ("cornerRadius" in node) {
    result.cornerRadius = node.cornerRadius;

    // Check for individual corner radii
    if (
      node.cornerRadius === figma.mixed &&
      "topLeftRadius" in node &&
      "topRightRadius" in node &&
      "bottomLeftRadius" in node &&
      "bottomRightRadius" in node
    ) {
      result.cornerRadii = {
        topLeft: node.topLeftRadius as number,
        topRight: node.topRightRadius as number,
        bottomLeft: node.bottomLeftRadius as number,
        bottomRight: node.bottomRightRadius as number,
      };
    }
  }

  return result;
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

  // Only extract if values are not mixed
  if (
    textNode.fontSize === figma.mixed ||
    textNode.fontName === figma.mixed ||
    textNode.lineHeight === figma.mixed ||
    textNode.letterSpacing === figma.mixed ||
    textNode.textCase === figma.mixed ||
    textNode.textDecoration === figma.mixed
  ) {
    return {};
  }

  return {
    textStyles: {
      fontSize: textNode.fontSize as number,
      fontName: textNode.fontName as FontName,
      lineHeight: textNode.lineHeight as LineHeight,
      letterSpacing: textNode.letterSpacing as LetterSpacing,
      textCase: textNode.textCase as TextCase,
      textDecoration: textNode.textDecoration as TextDecoration,
    },
  };
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

function getAvailableProperties(props: StoredProperties): string[] {
  const available: string[] = [];

  if (props.fills !== undefined) available.push("fills");
  if (props.strokes !== undefined) available.push("strokes");
  if (props.effects !== undefined) available.push("effects");
  if (props.cornerRadius !== undefined) available.push("cornerRadius");
  if (props.opacity !== undefined || props.blendMode !== undefined) available.push("opacityBlend");
  if (props.textStyles !== undefined) available.push("textStyles");

  return available;
}

// ============================================================================
// Property Application Functions
// ============================================================================

function applyFills(node: SceneNode, props: StoredProperties): boolean {
  if (props.fills === undefined) return false;
  if (!("fills" in node)) return false;

  try {
    if (props.fills !== figma.mixed) {
      (node as GeometryMixin).fills = [...props.fills];
    }
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
    
    if (props.strokes) strokeNode.strokes = [...props.strokes];
    if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
      strokeNode.strokeWeight = props.strokeWeight;
    }
    if (props.strokeAlign !== undefined) {
      strokeNode.strokeAlign = props.strokeAlign;
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

    return true;
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
  if (props.cornerRadius === undefined) return false;
  if (!("cornerRadius" in node)) return false;

  try {
    const cornerNode = node as CornerMixin;

    if (props.cornerRadii) {
      // Apply individual corner radii if available
      if ("topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node) {
        const rectNode = node as RectangleNode | FrameNode | ComponentNode | InstanceNode;
        rectNode.topLeftRadius = props.cornerRadii.topLeft;
        rectNode.topRightRadius = props.cornerRadii.topRight;
        rectNode.bottomLeftRadius = props.cornerRadii.bottomLeft;
        rectNode.bottomRightRadius = props.cornerRadii.bottomRight;
      }
    } else if (props.cornerRadius !== figma.mixed) {
      cornerNode.cornerRadius = props.cornerRadius;
    }

    return true;
  } catch {
    return false;
  }
}

function applyOpacityBlend(node: SceneNode, props: StoredProperties): boolean {
  if (props.opacity === undefined && props.blendMode === undefined) return false;

  try {
    if ("opacity" in node && props.opacity !== undefined) {
      (node as BlendMixin).opacity = props.opacity;
    }
    if ("blendMode" in node && props.blendMode !== undefined) {
      (node as BlendMixin).blendMode = props.blendMode;
    }
    return true;
  } catch {
    return false;
  }
}

async function applyTextStyles(node: SceneNode, props: StoredProperties): Promise<boolean> {
  if (props.textStyles === undefined) return false;
  if (node.type !== "TEXT") return false;

  try {
    const textNode = node as TextNode;
    const { fontName, fontSize, lineHeight, letterSpacing, textCase, textDecoration } = props.textStyles;

    // Must load font before applying text styles
    await figma.loadFontAsync(fontName);

    textNode.fontName = fontName;
    textNode.fontSize = fontSize;
    textNode.lineHeight = lineHeight;
    textNode.letterSpacing = letterSpacing;
    textNode.textCase = textCase;
    textNode.textDecoration = textDecoration;

    return true;
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
  storedProperties = extractAllProperties(node);
  const availableProperties = getAvailableProperties(storedProperties);

  figma.ui.postMessage({
    type: "properties-copied",
    properties: storedProperties,
    availableProperties,
  } as MessageToUI);

  figma.notify(`Copied properties from "${node.name}"`);
}

async function handlePaste(propertiesToPaste: string[]): Promise<void> {
  const selection = figma.currentPage.selection;

  if (!storedProperties) {
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
    const result = await applyProperties(node, storedProperties, propertiesToPaste);
    totalSuccess += result.success.length;
    totalFailed += result.failed.length;
  }

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
  width: 280,
  height: 420,
  title: "CopyOne",
});

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
  }
};
