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

interface StrokeSideWeights {
  top: number;
  right: number;
  bottom: number;
  left: number;
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

type StoredNodeField =
  | "topLeftRadius"
  | "topRightRadius"
  | "bottomLeftRadius"
  | "bottomRightRadius"
  | "strokeWeight"
  | "strokeTopWeight"
  | "strokeRightWeight"
  | "strokeBottomWeight"
  | "strokeLeftWeight"
  | "opacity";

type StoredBoundVariables = Partial<Record<StoredNodeField, string>>;

interface StoredProperties {
  // Source layer info
  sourceName: string;
  sourceType: string;

  // Fill properties
  fills?: readonly Paint[] | typeof figma.mixed;
  fillStyleId?: string;
  fillStyleName?: string;

  // Stroke properties
  strokes?: readonly Paint[];
  strokeWeight?: number | typeof figma.mixed;
  strokeSideWeights?: StrokeSideWeights;
  strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE";
  strokeCap?: StrokeCap | typeof figma.mixed;
  strokeJoin?: StrokeJoin | typeof figma.mixed;
  dashPattern?: readonly number[];
  strokeStyleId?: string;
  strokeStyleName?: string;

  // Effects
  effects?: readonly Effect[];
  effectStyleId?: string;
  effectStyleName?: string;

  // Corner radius
  cornerRadius?: number | typeof figma.mixed;
  cornerRadii?: CornerRadii;
  cornerSmoothing?: number;

  // Opacity and blend
  opacity?: number;
  blendMode?: BlendMode;

  // Text styles
  textStyles?: TextStyles;
  textStyleId?: string;
  textStyleName?: string;

  // Variable bindings on the node itself
  boundVariables?: StoredBoundVariables;
  boundVariableNames?: { [field: string]: string };
}

interface SerializedProperties {
  sourceName: string;
  sourceType: string;

  fills: readonly Paint[] | null;
  fillsMixed: boolean;
  fillStyleId: string | null;
  fillStyleName: string | null;

  strokes: readonly Paint[] | null;
  strokeWeight: number | null;
  strokeWeightMixed: boolean;
  strokeSideWeights: StrokeSideWeights | null;
  strokeAlign: "CENTER" | "INSIDE" | "OUTSIDE" | null;
  strokeCap: StrokeCap | null;
  strokeCapMixed: boolean;
  strokeJoin: StrokeJoin | null;
  strokeJoinMixed: boolean;
  dashPattern: readonly number[] | null;
  strokeStyleId: string | null;
  strokeStyleName: string | null;

  effects: readonly Effect[] | null;
  effectStyleId: string | null;
  effectStyleName: string | null;

  cornerRadius: number | null;
  cornerRadiusMixed: boolean;
  cornerRadii: CornerRadii | null;
  cornerSmoothing: number | null;

  opacity: number | null;
  blendMode: BlendMode | null;

  textStyles: TextStyles | null;
  textStyleId: string | null;
  textStyleName: string | null;

  boundVariables: StoredBoundVariables | null;
  boundVariableNames: { [field: string]: string } | null;
}

interface ClipboardPayload {
  schema: 1;
  savedAt: string;
  data: SerializedProperties;
}

interface PrefsPayload {
  schema: 1;
  checked: { [property: string]: boolean };
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
  opacity?: string;
  blendMode?: string;
  textStyles?: string;
  textStylesPartial?: boolean;
}

type ApplyStatus = "applied" | "skipped" | "failed";

type ApplyReason =
  | "unsupported-layer"
  | "missing-font"
  | "style-unavailable"
  | "variable-unavailable"
  | "variable-not-bindable"
  | "image-unavailable"
  | "error";

interface ApplyNote {
  reason: ApplyReason;
  detail?: string;
}

interface ApplyResult {
  status: ApplyStatus;
  notes: ApplyNote[];
}

type PropertyResults = { [property: string]: ApplyResult };

type MessageLevel = "success" | "warning" | "error";

// Message types for communication between UI and plugin
type MessageToPlugin =
  | { type: "copy" }
  | { type: "paste"; properties: string[] }
  | { type: "get-selection" }
  | { type: "save-prefs"; checked: { [property: string]: boolean } }
  | { type: "clear-clipboard" }
  | { type: "resize-ui"; height: number };

type MessageToUI =
  | { type: "version"; version: string }
  | { type: "selection-changed"; hasSelection: boolean; count: number; nodeName?: string; nodeType?: string }
  | { type: "property-labels"; labels: { [property: string]: string } }
  | {
      type: "properties-copied";
      sourceName: string;
      sourceType: string;
      availableProperties: string[];
      defaultValued: string[];
      mixed: string[];
      previews: PropertyPreviews;
      restored: boolean;
    }
  | { type: "prefs"; checked: { [property: string]: boolean } }
  | { type: "clipboard-cleared" }
  | { type: "paste-complete"; level: MessageLevel; message: string; moreSentences?: string[] }
  | { type: "info"; message: string }
  | { type: "error"; message: string };

// ============================================================================
// Global State
// ============================================================================

let _stored: StoredProperties | null = null;
let clipboardChangedSinceStartup = false;
let prefsChangedSinceStartup = false;

function getStored(): StoredProperties | null {
  return _stored;
}

function setStored(value: StoredProperties | null): void {
  _stored = value;
}
const PLUGIN_VERSION = "__PLUGIN_VERSION__";
const UI_WIDTH = 300;
const UI_MIN_HEIGHT = 420;
const UI_MAX_HEIGHT = 1200;
const CLIPBOARD_KEY = "copyone.clipboard.v1";
const PREFS_KEY = "copyone.prefs.v1";
const STORAGE_SCHEMA = 1;

const BOUND_VARIABLE_FIELDS: StoredNodeField[] = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "opacity",
];

// Single source of property display names. The UI receives this map at startup
// so labels in the panel and paste messages cannot drift apart.
const PROPERTY_LABELS: { [property: string]: string } = {
  fills: "Fills",
  strokes: "Strokes",
  effects: "Effects",
  cornerRadius: "Corner radius",
  opacity: "Opacity",
  blendMode: "Blend mode",
  textStyles: "Text styles",
};

const NOTE_REASON_ORDER: ApplyReason[] = [
  "missing-font",
  "unsupported-layer",
  "error",
  "style-unavailable",
  "variable-unavailable",
  "variable-not-bindable",
  "image-unavailable",
];

interface PasteNoteGroup {
  property: string;
  reason: ApplyReason;
  detail?: string;
  layers: Set<number>;
}

interface NoteSentence {
  reason: ApplyReason;
  text: string;
}

interface PasteFeedback {
  level: MessageLevel;
  message: string;
  moreSentences: string[];
}

interface BoundVariableSource {
  readonly boundVariables?: { [field: string]: VariableAlias | undefined };
}

// ============================================================================
// Property Extraction Functions
// ============================================================================

function extractFills(node: SceneNode): Pick<StoredProperties, "fills" | "fillStyleId"> {
  const result: Pick<StoredProperties, "fills" | "fillStyleId"> = {};

  if ("fills" in node) {
    result.fills = node.fills;
  }
  if ("fillStyleId" in node && typeof node.fillStyleId === "string" && node.fillStyleId !== "") {
    result.fillStyleId = node.fillStyleId;
  }

  return result;
}

function extractStrokes(node: SceneNode): Pick<
  StoredProperties,
  | "strokes"
  | "strokeWeight"
  | "strokeSideWeights"
  | "strokeAlign"
  | "strokeCap"
  | "strokeJoin"
  | "dashPattern"
  | "strokeStyleId"
> {
  const result: Pick<
    StoredProperties,
    | "strokes"
    | "strokeWeight"
    | "strokeSideWeights"
    | "strokeAlign"
    | "strokeCap"
    | "strokeJoin"
    | "dashPattern"
    | "strokeStyleId"
  > = {};

  if ("strokes" in node) {
    result.strokes = node.strokes as Paint[];
  }
  if ("strokeWeight" in node) {
    result.strokeWeight = node.strokeWeight;

    if (node.strokeWeight === figma.mixed) {
      const individual = node as SceneNode & {
        strokeTopWeight?: number;
        strokeRightWeight?: number;
        strokeBottomWeight?: number;
        strokeLeftWeight?: number;
      };
      if (
        typeof individual.strokeTopWeight === "number" &&
        typeof individual.strokeRightWeight === "number" &&
        typeof individual.strokeBottomWeight === "number" &&
        typeof individual.strokeLeftWeight === "number"
      ) {
        result.strokeSideWeights = {
          top: individual.strokeTopWeight,
          right: individual.strokeRightWeight,
          bottom: individual.strokeBottomWeight,
          left: individual.strokeLeftWeight,
        };
      }
    }
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
  if ("strokeStyleId" in node && typeof node.strokeStyleId === "string" && node.strokeStyleId !== "") {
    result.strokeStyleId = node.strokeStyleId;
  }

  return result;
}

function extractEffects(node: SceneNode): Pick<StoredProperties, "effects" | "effectStyleId"> {
  const result: Pick<StoredProperties, "effects" | "effectStyleId"> = {};

  if ("effects" in node) {
    result.effects = node.effects as Effect[];
  }
  if ("effectStyleId" in node && typeof node.effectStyleId === "string" && node.effectStyleId !== "") {
    result.effectStyleId = node.effectStyleId;
  }

  return result;
}

function extractCornerRadius(node: SceneNode): Pick<StoredProperties, "cornerRadius" | "cornerRadii" | "cornerSmoothing"> {
  if (!("cornerRadius" in node)) return {};

  const result: Pick<StoredProperties, "cornerRadius" | "cornerRadii" | "cornerSmoothing"> = {};
  const cr = node.cornerRadius;

  if (typeof cr === "number") {
    result.cornerRadius = cr;
  } else {
    const topLeft = "topLeftRadius" in node ? node.topLeftRadius : undefined;
    const topRight = "topRightRadius" in node ? node.topRightRadius : undefined;
    const bottomLeft = "bottomLeftRadius" in node ? node.bottomLeftRadius : undefined;
    const bottomRight = "bottomRightRadius" in node ? node.bottomRightRadius : undefined;

    const tlOk = typeof topLeft === "number";
    const trOk = typeof topRight === "number";
    const blOk = typeof bottomLeft === "number";
    const brOk = typeof bottomRight === "number";

    if (tlOk || trOk || blOk || brOk) {
      result.cornerRadius = cr;
      result.cornerRadii = {
        topLeft: tlOk ? topLeft as number : 0,
        topRight: trOk ? topRight as number : 0,
        bottomLeft: blOk ? bottomLeft as number : 0,
        bottomRight: brOk ? bottomRight as number : 0,
      };
    } else {
      result.cornerRadius = cr;
    }
  }

  if ("cornerSmoothing" in node && typeof node.cornerSmoothing === "number") {
    result.cornerSmoothing = node.cornerSmoothing;
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

function extractTextStyles(node: SceneNode): Pick<StoredProperties, "textStyles" | "textStyleId"> {
  if (node.type !== "TEXT") {
    return {};
  }

  const result: Pick<StoredProperties, "textStyles" | "textStyleId"> = {};
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

  if (hasAnyStyle) {
    if (hasMixed) {
      styles.hasMixedValues = true;
    }
    result.textStyles = styles;
  }

  if (typeof textNode.textStyleId === "string" && textNode.textStyleId !== "") {
    result.textStyleId = textNode.textStyleId;
  }

  return result;
}

function extractBoundVariables(node: SceneNode): Pick<StoredProperties, "boundVariables"> {
  const bv = (node as unknown as BoundVariableSource).boundVariables;
  if (!bv) return {};

  const result: StoredBoundVariables = {};
  let hasAny = false;

  for (const field of BOUND_VARIABLE_FIELDS) {
    const alias = bv[field];
    if (alias && typeof alias.id === "string" && alias.id !== "") {
      result[field] = alias.id;
      hasAny = true;
    }
  }

  return hasAny ? { boundVariables: result } : {};
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
    ...extractBoundVariables(node),
  };
}

async function populateAuxiliaryNames(props: StoredProperties): Promise<void> {
  const styleIds = [
    props.fillStyleId,
    props.strokeStyleId,
    props.effectStyleId,
    props.textStyleId,
  ];
  const styles = await Promise.all(styleIds.map((id) => getStyleSafely(id)));

  if (styles[0]) props.fillStyleName = styles[0].name;
  if (styles[1]) props.strokeStyleName = styles[1].name;
  if (styles[2]) props.effectStyleName = styles[2].name;
  if (styles[3]) props.textStyleName = styles[3].name;

  if (props.boundVariables) {
    const fields: StoredNodeField[] = [];
    const ids: string[] = [];
    for (const field of BOUND_VARIABLE_FIELDS) {
      const id = props.boundVariables[field];
      if (id) {
        fields.push(field);
        ids.push(id);
      }
    }

    const variables = await Promise.all(ids.map((id) => getVariableSafely(id)));
    const names: { [field: string]: string } = {};
    for (let i = 0; i < fields.length; i++) {
      const variable = variables[i];
      if (variable) names[fields[i]] = variable.name;
    }
    if (Object.keys(names).length > 0) {
      props.boundVariableNames = names;
    }
  }
}

async function getStyleSafely(id: string | undefined): Promise<BaseStyle | null> {
  if (!id) return null;
  try {
    return await figma.getStyleByIdAsync(id);
  } catch {
    return null;
  }
}

async function getVariableSafely(id: string): Promise<Variable | null> {
  try {
    return await figma.variables.getVariableByIdAsync(id);
  } catch {
    return null;
  }
}

// ============================================================================
// Clipboard serialization
// ============================================================================

const SERIALIZED_KEYS: string[] = [
  "sourceName",
  "sourceType",
  "fills",
  "fillsMixed",
  "fillStyleId",
  "fillStyleName",
  "strokes",
  "strokeWeight",
  "strokeWeightMixed",
  "strokeSideWeights",
  "strokeAlign",
  "strokeCap",
  "strokeCapMixed",
  "strokeJoin",
  "strokeJoinMixed",
  "dashPattern",
  "strokeStyleId",
  "strokeStyleName",
  "effects",
  "effectStyleId",
  "effectStyleName",
  "cornerRadius",
  "cornerRadiusMixed",
  "cornerRadii",
  "cornerSmoothing",
  "opacity",
  "blendMode",
  "textStyles",
  "textStyleId",
  "textStyleName",
  "boundVariables",
  "boundVariableNames",
];

function serializeProperties(props: StoredProperties): SerializedProperties {
  return {
    sourceName: props.sourceName,
    sourceType: props.sourceType,

    fills: props.fills !== undefined && props.fills !== figma.mixed ? Array.from(props.fills) : null,
    fillsMixed: props.fills === figma.mixed,
    fillStyleId: props.fillStyleId || null,
    fillStyleName: props.fillStyleName || null,

    strokes: props.strokes !== undefined ? Array.from(props.strokes) : null,
    strokeWeight: props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed ? props.strokeWeight : null,
    strokeWeightMixed: props.strokeWeight === figma.mixed,
    strokeSideWeights: props.strokeSideWeights
      ? {
          top: props.strokeSideWeights.top,
          right: props.strokeSideWeights.right,
          bottom: props.strokeSideWeights.bottom,
          left: props.strokeSideWeights.left,
        }
      : null,
    strokeAlign: props.strokeAlign || null,
    strokeCap: props.strokeCap !== undefined && props.strokeCap !== figma.mixed ? props.strokeCap : null,
    strokeCapMixed: props.strokeCap === figma.mixed,
    strokeJoin: props.strokeJoin !== undefined && props.strokeJoin !== figma.mixed ? props.strokeJoin : null,
    strokeJoinMixed: props.strokeJoin === figma.mixed,
    dashPattern: props.dashPattern ? Array.from(props.dashPattern) : null,
    strokeStyleId: props.strokeStyleId || null,
    strokeStyleName: props.strokeStyleName || null,

    effects: props.effects ? Array.from(props.effects) : null,
    effectStyleId: props.effectStyleId || null,
    effectStyleName: props.effectStyleName || null,

    cornerRadius: props.cornerRadius !== undefined && props.cornerRadius !== figma.mixed ? props.cornerRadius : null,
    cornerRadiusMixed: props.cornerRadius === figma.mixed,
    cornerRadii: props.cornerRadii
      ? {
          topLeft: props.cornerRadii.topLeft,
          topRight: props.cornerRadii.topRight,
          bottomLeft: props.cornerRadii.bottomLeft,
          bottomRight: props.cornerRadii.bottomRight,
        }
      : null,
    cornerSmoothing: props.cornerSmoothing === undefined ? null : props.cornerSmoothing,

    opacity: props.opacity === undefined ? null : props.opacity,
    blendMode: props.blendMode || null,

    textStyles: props.textStyles ? { ...props.textStyles } : null,
    textStyleId: props.textStyleId || null,
    textStyleName: props.textStyleName || null,

    boundVariables: props.boundVariables ? { ...props.boundVariables } : null,
    boundVariableNames: props.boundVariableNames ? { ...props.boundVariableNames } : null,
  };
}

function deserializeProperties(data: SerializedProperties): StoredProperties {
  const props: StoredProperties = {
    sourceName: data.sourceName,
    sourceType: data.sourceType,
  };

  if (data.fillsMixed) {
    props.fills = figma.mixed;
  } else if (data.fills !== null) {
    props.fills = data.fills;
  }
  if (data.fillStyleId !== null) props.fillStyleId = data.fillStyleId;
  if (data.fillStyleName !== null) props.fillStyleName = data.fillStyleName;

  if (data.strokes !== null) props.strokes = data.strokes;
  if (data.strokeWeightMixed) {
    props.strokeWeight = figma.mixed;
  } else if (data.strokeWeight !== null) {
    props.strokeWeight = data.strokeWeight;
  }
  if (data.strokeSideWeights !== null) {
    props.strokeSideWeights = {
      top: data.strokeSideWeights.top,
      right: data.strokeSideWeights.right,
      bottom: data.strokeSideWeights.bottom,
      left: data.strokeSideWeights.left,
    };
  }
  if (data.strokeAlign !== null) props.strokeAlign = data.strokeAlign;
  if (data.strokeCapMixed) {
    props.strokeCap = figma.mixed;
  } else if (data.strokeCap !== null) {
    props.strokeCap = data.strokeCap;
  }
  if (data.strokeJoinMixed) {
    props.strokeJoin = figma.mixed;
  } else if (data.strokeJoin !== null) {
    props.strokeJoin = data.strokeJoin;
  }
  if (data.dashPattern !== null) props.dashPattern = data.dashPattern;
  if (data.strokeStyleId !== null) props.strokeStyleId = data.strokeStyleId;
  if (data.strokeStyleName !== null) props.strokeStyleName = data.strokeStyleName;

  if (data.effects !== null) props.effects = data.effects;
  if (data.effectStyleId !== null) props.effectStyleId = data.effectStyleId;
  if (data.effectStyleName !== null) props.effectStyleName = data.effectStyleName;

  if (data.cornerRadiusMixed) {
    props.cornerRadius = figma.mixed;
  } else if (data.cornerRadius !== null) {
    props.cornerRadius = data.cornerRadius;
  }
  if (data.cornerRadii !== null) {
    props.cornerRadii = {
      topLeft: data.cornerRadii.topLeft,
      topRight: data.cornerRadii.topRight,
      bottomLeft: data.cornerRadii.bottomLeft,
      bottomRight: data.cornerRadii.bottomRight,
    };
  }
  if (data.cornerSmoothing !== null) props.cornerSmoothing = data.cornerSmoothing;

  if (data.opacity !== null) props.opacity = data.opacity;
  if (data.blendMode !== null) props.blendMode = data.blendMode;

  if (data.textStyles !== null) props.textStyles = data.textStyles;
  if (data.textStyleId !== null) props.textStyleId = data.textStyleId;
  if (data.textStyleName !== null) props.textStyleName = data.textStyleName;

  if (data.boundVariables !== null) props.boundVariables = data.boundVariables;
  if (data.boundVariableNames !== null) props.boundVariableNames = data.boundVariableNames;

  return props;
}

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || typeof value === "number";
}

function isTypedRecordArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && typeof entry.type === "string");
}

function isNumberArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === "number");
}

function isStringMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.keys(value).every((key) => typeof value[key] === "string");
}

function isSideWeights(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.top === "number" &&
    typeof value.right === "number" &&
    typeof value.bottom === "number" &&
    typeof value.left === "number";
}

function isCornerRadii(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.topLeft === "number" &&
    typeof value.topRight === "number" &&
    typeof value.bottomLeft === "number" &&
    typeof value.bottomRight === "number";
}

function isTextStyles(value: unknown): boolean {
  if (!isRecord(value)) return false;

  if (value.fontSize !== undefined && typeof value.fontSize !== "number") return false;

  if (value.fontName !== undefined) {
    if (!isRecord(value.fontName) ||
      typeof value.fontName.family !== "string" ||
      typeof value.fontName.style !== "string") {
      return false;
    }
  }

  if (value.lineHeight !== undefined) {
    if (!isRecord(value.lineHeight) || typeof value.lineHeight.unit !== "string") return false;
    if (value.lineHeight.value !== undefined && typeof value.lineHeight.value !== "number") return false;
  }

  if (value.letterSpacing !== undefined) {
    if (!isRecord(value.letterSpacing) || typeof value.letterSpacing.unit !== "string") return false;
    if (value.letterSpacing.value !== undefined && typeof value.letterSpacing.value !== "number") return false;
  }

  if (value.textCase !== undefined && typeof value.textCase !== "string") return false;
  if (value.textDecoration !== undefined && typeof value.textDecoration !== "string") return false;
  if (value.hasMixedValues !== undefined && typeof value.hasMixedValues !== "boolean") return false;

  return true;
}

function isSerializedProperties(value: unknown): value is SerializedProperties {
  if (!isRecord(value)) return false;
  if (!SERIALIZED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(value, key))) return false;

  if (typeof value.sourceName !== "string" || value.sourceName === "") return false;
  if (typeof value.sourceType !== "string" || value.sourceType === "") return false;

  if (value.fills !== null && !isTypedRecordArray(value.fills)) return false;
  if (typeof value.fillsMixed !== "boolean") return false;
  if (!isStringOrNull(value.fillStyleId)) return false;
  if (!isStringOrNull(value.fillStyleName)) return false;

  if (value.strokes !== null && !isTypedRecordArray(value.strokes)) return false;
  if (!isNumberOrNull(value.strokeWeight)) return false;
  if (typeof value.strokeWeightMixed !== "boolean") return false;
  if (value.strokeSideWeights !== null && !isSideWeights(value.strokeSideWeights)) return false;
  if (value.strokeAlign !== null &&
    value.strokeAlign !== "CENTER" &&
    value.strokeAlign !== "INSIDE" &&
    value.strokeAlign !== "OUTSIDE") {
    return false;
  }
  if (!isStringOrNull(value.strokeCap)) return false;
  if (typeof value.strokeCapMixed !== "boolean") return false;
  if (!isStringOrNull(value.strokeJoin)) return false;
  if (typeof value.strokeJoinMixed !== "boolean") return false;
  if (value.dashPattern !== null && !isNumberArray(value.dashPattern)) return false;
  if (!isStringOrNull(value.strokeStyleId)) return false;
  if (!isStringOrNull(value.strokeStyleName)) return false;

  if (value.effects !== null && !isTypedRecordArray(value.effects)) return false;
  if (!isStringOrNull(value.effectStyleId)) return false;
  if (!isStringOrNull(value.effectStyleName)) return false;

  if (!isNumberOrNull(value.cornerRadius)) return false;
  if (typeof value.cornerRadiusMixed !== "boolean") return false;
  if (value.cornerRadii !== null && !isCornerRadii(value.cornerRadii)) return false;
  if (!isNumberOrNull(value.cornerSmoothing)) return false;

  if (!isNumberOrNull(value.opacity)) return false;
  if (!isStringOrNull(value.blendMode)) return false;

  if (value.textStyles !== null && !isTextStyles(value.textStyles)) return false;
  if (!isStringOrNull(value.textStyleId)) return false;
  if (!isStringOrNull(value.textStyleName)) return false;

  if (value.boundVariables !== null && !isStringMap(value.boundVariables)) return false;
  if (value.boundVariableNames !== null && !isStringMap(value.boundVariableNames)) return false;

  return true;
}

function isClipboardPayload(value: unknown): value is ClipboardPayload {
  if (!isRecord(value)) return false;
  if (value.schema !== STORAGE_SCHEMA || typeof value.savedAt !== "string") return false;
  return isSerializedProperties(value.data);
}

function isPrefsPayload(value: unknown): value is PrefsPayload {
  if (!isRecord(value)) return false;
  if (value.schema !== STORAGE_SCHEMA) return false;

  const checked = value.checked;
  if (!isRecord(checked)) return false;
  return Object.keys(checked).every((key) => typeof checked[key] === "boolean");
}

async function loadPrefs(): Promise<{ [property: string]: boolean }> {
  try {
    const raw = await figma.clientStorage.getAsync(PREFS_KEY);
    if (raw === undefined) return {};
    if (isPrefsPayload(raw)) return raw.checked;

    await figma.clientStorage.deleteAsync(PREFS_KEY);
    return {};
  } catch (err) {
    console.error(`[CopyOne] Could not load prefs: ${errorMessage(err)}`);
    return {};
  }
}

async function persistPrefs(checked: { [property: string]: boolean }): Promise<void> {
  const payload: PrefsPayload = { schema: 1, checked };
  try {
    await figma.clientStorage.setAsync(PREFS_KEY, payload);
  } catch (err) {
    console.error(`[CopyOne] Could not save prefs: ${errorMessage(err)}`);
  }
}

async function loadClipboard(): Promise<StoredProperties | null> {
  try {
    const raw = await figma.clientStorage.getAsync(CLIPBOARD_KEY);
    if (raw === undefined) return null;

    if (!isClipboardPayload(raw)) {
      await figma.clientStorage.deleteAsync(CLIPBOARD_KEY);
      return null;
    }

    return deserializeProperties(raw.data);
  } catch (err) {
    console.error(`[CopyOne] Could not restore clipboard: ${errorMessage(err)}`);
    try {
      await figma.clientStorage.deleteAsync(CLIPBOARD_KEY);
    } catch {
      // Nothing else to do.
    }
    return null;
  }
}

async function persistClipboard(props: StoredProperties): Promise<void> {
  const payload: ClipboardPayload = {
    schema: 1,
    savedAt: new Date().toISOString(),
    data: serializeProperties(props),
  };

  try {
    await figma.clientStorage.setAsync(CLIPBOARD_KEY, payload);
  } catch (err) {
    console.error(`[CopyOne] Could not save clipboard: ${errorMessage(err)}`);
  }
}

async function deleteStoredClipboard(): Promise<void> {
  try {
    await figma.clientStorage.deleteAsync(CLIPBOARD_KEY);
  } catch (err) {
    console.error(`[CopyOne] Could not clear clipboard: ${errorMessage(err)}`);
  }
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
  if (props.strokeSideWeights) {
    const sides = props.strokeSideWeights;
    weight = `${sides.top}/${sides.right}/${sides.bottom}/${sides.left}px`;
  } else if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
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
  if (props.cornerRadius === undefined && props.cornerRadii === undefined) return undefined;

  let radius: string;
  if (props.cornerRadii) {
    const r = props.cornerRadii;
    radius = `${r.topLeft} / ${r.topRight} / ${r.bottomLeft} / ${r.bottomRight}`;
  } else if (props.cornerRadius !== figma.mixed) {
    radius = `${props.cornerRadius}`;
  } else {
    radius = 'Mixed';
  }

  if (props.cornerSmoothing !== undefined && props.cornerSmoothing > 0) {
    radius += `, smoothing ${Math.round(props.cornerSmoothing * 100)}%`;
  }

  return radius;
}

function sentenceCaseLabel(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function computeOpacityPreview(props: StoredProperties): string | undefined {
  if (props.opacity === undefined) return undefined;
  return `${Math.round(props.opacity * 100)}%`;
}

function computeBlendModePreview(props: StoredProperties): string | undefined {
  if (props.blendMode === undefined) return undefined;
  return sentenceCaseLabel(props.blendMode);
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

  if (props.opacity !== undefined) {
    const opacityPreview = computeOpacityPreview(props);
    if (opacityPreview) previews.opacity = opacityPreview;
  }

  if (props.blendMode !== undefined) {
    const blendPreview = computeBlendModePreview(props);
    if (blendPreview) previews.blendMode = blendPreview;
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
  if (props.opacity !== undefined) available.push("opacity");
  if (props.blendMode !== undefined) available.push("blendMode");
  if (props.textStyles !== undefined) available.push("textStyles");

  return available;
}

function computeDefaultValued(props: StoredProperties): string[] {
  const defaults: string[] = [];

  const smoothingDefault = props.cornerSmoothing === undefined || props.cornerSmoothing === 0;
  const radiusDefault = props.cornerRadii
    ? props.cornerRadii.topLeft === 0 &&
      props.cornerRadii.topRight === 0 &&
      props.cornerRadii.bottomLeft === 0 &&
      props.cornerRadii.bottomRight === 0
    : typeof props.cornerRadius === "number" && props.cornerRadius === 0;

  if (smoothingDefault && radiusDefault) defaults.push("cornerRadius");
  if (props.opacity !== undefined && props.opacity === 1) defaults.push("opacity");
  if (props.blendMode !== undefined && (props.blendMode === "PASS_THROUGH" || props.blendMode === "NORMAL")) {
    defaults.push("blendMode");
  }

  return defaults;
}

// ============================================================================
// Property Application Functions
// ============================================================================

function note(reason: ApplyReason, detail?: string): ApplyNote {
  return detail ? { reason, detail } : { reason };
}

function applied(notes: ApplyNote[] = []): ApplyResult {
  return { status: "applied", notes };
}

function skipped(reason?: ApplyReason, detail?: string): ApplyResult {
  return { status: "skipped", notes: reason ? [note(reason, detail)] : [] };
}

function failed(reason?: ApplyReason, detail?: string): ApplyResult {
  return { status: "failed", notes: reason ? [note(reason, detail)] : [] };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function addNote(notes: ApplyNote[], next: ApplyNote | null): void {
  if (!next) return;
  const duplicate = notes.some((existing) => existing.reason === next.reason && existing.detail === next.detail);
  if (!duplicate) notes.push(next);
}

async function resolveStyleOfType(id: string, type: "PAINT" | "EFFECT" | "TEXT"): Promise<BaseStyle | null> {
  const style = await getStyleSafely(id);
  if (style && style.type === type) return style;
  return null;
}

const CORNER_RADIUS_FIELDS: StoredNodeField[] = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
];

const STROKE_SIDE_FIELDS: StoredNodeField[] = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
];

function layerTypeLabel(node: SceneNode): string {
  return sentenceCaseLabel(node.type);
}

function variableNameFor(props: StoredProperties, field: StoredNodeField): string | undefined {
  return props.boundVariableNames ? props.boundVariableNames[field] : undefined;
}

function firstVariableName(props: StoredProperties, fields: StoredNodeField[]): string | undefined {
  for (const field of fields) {
    if (props.boundVariables && props.boundVariables[field]) {
      return variableNameFor(props, field);
    }
  }
  return undefined;
}

function hasAnyVariable(props: StoredProperties, fields: StoredNodeField[]): boolean {
  return fields.some((field) => Boolean(props.boundVariables && props.boundVariables[field]));
}

function getSharedSideVariableId(props: StoredProperties, fields: StoredNodeField[]): string | null {
  let shared: string | null = null;

  for (const field of fields) {
    const id = props.boundVariables ? props.boundVariables[field] : undefined;
    if (!id) return null;
    if (shared === null) {
      shared = id;
    } else if (shared !== id) {
      return null;
    }
  }

  return shared;
}

async function bindVariableId(
  node: SceneNode,
  field: VariableBindableNodeField,
  variableId: string,
  variableName: string | undefined
): Promise<ApplyNote | null> {
  const variable = await getVariableSafely(variableId);
  if (!variable) return note("variable-unavailable", variableName);

  try {
    node.setBoundVariable(field, variable);
    return null;
  } catch {
    return note("variable-not-bindable", layerTypeLabel(node));
  }
}

async function bindFieldVariable(
  node: SceneNode,
  field: StoredNodeField,
  props: StoredProperties
): Promise<ApplyNote | null> {
  const id = props.boundVariables ? props.boundVariables[field] : undefined;
  if (!id) return null;
  if (!(field in node)) return null;

  return bindVariableId(node, field, id, variableNameFor(props, field));
}

function isImagePaintAvailable(paint: Paint): boolean {
  if (paint.type !== "IMAGE") return true;
  if (!paint.imageHash) return false;
  try {
    return figma.getImageByHash(paint.imageHash) !== null;
  } catch {
    return false;
  }
}

async function applyFills(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.fills === undefined || props.fills === figma.mixed) return skipped("unsupported-layer");
  if (!("fills" in node)) return skipped("unsupported-layer");

  const fillNode = node as SceneNode & {
    fills: readonly Paint[];
    setFillStyleIdAsync(styleId: string): Promise<void>;
  };

  let imageUnavailable = false;
  const fillsToApply = Array.from(props.fills).filter((paint) => {
    if (isImagePaintAvailable(paint)) return true;
    imageUnavailable = true;
    return false;
  });

  let styleFallback: string | undefined;
  let hasStyleFallback = false;

  if (props.fillStyleId) {
    const style = await resolveStyleOfType(props.fillStyleId, "PAINT");
    if (style) {
      try {
        await fillNode.setFillStyleIdAsync(props.fillStyleId);
        return applied();
      } catch {
        styleFallback = props.fillStyleName;
        hasStyleFallback = true;
      }
    } else {
      styleFallback = props.fillStyleName;
      hasStyleFallback = true;
    }
  }

  if (fillsToApply.length === 0) {
    return imageUnavailable ? skipped("image-unavailable") : skipped("unsupported-layer");
  }

  const notes: ApplyNote[] = [];
  if (hasStyleFallback) addNote(notes, note("style-unavailable", styleFallback));
  if (imageUnavailable) addNote(notes, note("image-unavailable"));

  try {
    fillNode.fills = fillsToApply;
    return applied(notes);
  } catch (err) {
    return failed("error", errorMessage(err));
  }
}

async function applyStrokes(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.strokes === undefined) return skipped("unsupported-layer");
  if (!("strokes" in node)) return skipped("unsupported-layer");

  const strokeNode = node as SceneNode & {
    strokes: readonly Paint[];
    strokeWeight: number | typeof figma.mixed;
    strokeAlign: "CENTER" | "INSIDE" | "OUTSIDE";
    strokeCap?: StrokeCap | typeof figma.mixed;
    strokeJoin?: StrokeJoin | typeof figma.mixed;
    dashPattern: readonly number[];
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
    setStrokeStyleIdAsync(styleId: string): Promise<void>;
  };

  let didApply = false;
  let styleFallback: string | undefined;
  let hasStyleFallback = false;
  let styleApplied = false;

  if (props.strokeStyleId) {
    const style = await resolveStyleOfType(props.strokeStyleId, "PAINT");
    if (style) {
      try {
        await strokeNode.setStrokeStyleIdAsync(props.strokeStyleId);
        didApply = true;
        styleApplied = true;
      } catch {
        styleFallback = props.strokeStyleName;
        hasStyleFallback = true;
      }
    } else {
      styleFallback = props.strokeStyleName;
      hasStyleFallback = true;
    }
  }

  if (!styleApplied) {
    try {
      strokeNode.strokes = Array.from(props.strokes);
      didApply = true;
    } catch {
      // Stroke paints are applied below where possible.
    }
  }

  const supportsSideWeights =
    typeof strokeNode.strokeTopWeight === "number" &&
    typeof strokeNode.strokeRightWeight === "number" &&
    typeof strokeNode.strokeBottomWeight === "number" &&
    typeof strokeNode.strokeLeftWeight === "number" &&
    "strokeTopWeight" in node &&
    "strokeRightWeight" in node &&
    "strokeBottomWeight" in node &&
    "strokeLeftWeight" in node;

  if (props.strokeSideWeights) {
    const sides = props.strokeSideWeights;
    if (supportsSideWeights) {
      try {
        strokeNode.strokeTopWeight = sides.top;
        strokeNode.strokeRightWeight = sides.right;
        strokeNode.strokeBottomWeight = sides.bottom;
        strokeNode.strokeLeftWeight = sides.left;
        didApply = true;
      } catch {
        // Fall through to the largest side as a uniform weight.
        try {
          strokeNode.strokeWeight = Math.max(sides.top, sides.right, sides.bottom, sides.left);
          didApply = true;
        } catch {
          // Weight stays untouched.
        }
      }
    } else {
      try {
        strokeNode.strokeWeight = Math.max(sides.top, sides.right, sides.bottom, sides.left);
        didApply = true;
      } catch {
        // Weight stays untouched.
      }
    }
  } else if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
    try {
      strokeNode.strokeWeight = props.strokeWeight;
      didApply = true;
    } catch {
      // Weight stays untouched.
    }
  }

  if (props.strokeAlign !== undefined) {
    try {
      strokeNode.strokeAlign = props.strokeAlign;
      didApply = true;
    } catch {
      // Alignment stays untouched.
    }
  }

  if (props.strokeCap !== undefined && props.strokeCap !== figma.mixed && "strokeCap" in node) {
    try {
      strokeNode.strokeCap = props.strokeCap;
      didApply = true;
    } catch {
      // Cap stays untouched.
    }
  }

  if (props.strokeJoin !== undefined && props.strokeJoin !== figma.mixed && "strokeJoin" in node) {
    try {
      strokeNode.strokeJoin = props.strokeJoin;
      didApply = true;
    } catch {
      // Join stays untouched.
    }
  }

  if (props.dashPattern !== undefined && "dashPattern" in node) {
    try {
      strokeNode.dashPattern = Array.from(props.dashPattern);
      didApply = true;
    } catch {
      // Dash pattern stays untouched.
    }
  }

  const notes: ApplyNote[] = [];
  if (hasStyleFallback) addNote(notes, note("style-unavailable", styleFallback));

  if (props.strokeSideWeights) {
    if (supportsSideWeights) {
      for (const field of STROKE_SIDE_FIELDS) {
        addNote(notes, await bindFieldVariable(node, field, props));
      }
    } else {
      const sharedId = getSharedSideVariableId(props, STROKE_SIDE_FIELDS);
      if (sharedId) {
        addNote(notes, await bindVariableId(
          node,
          "strokeWeight",
          sharedId,
          firstVariableName(props, STROKE_SIDE_FIELDS)
        ));
      } else if (hasAnyVariable(props, STROKE_SIDE_FIELDS)) {
        addNote(notes, note("variable-not-bindable", layerTypeLabel(node)));
      } else {
        addNote(notes, await bindFieldVariable(node, "strokeWeight", props));
      }
    }
  } else {
    addNote(notes, await bindFieldVariable(node, "strokeWeight", props));
  }

  if (!didApply) return failed("error");
  return applied(notes);
}

async function applyEffects(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.effects === undefined) return skipped("unsupported-layer");
  if (!("effects" in node)) return skipped("unsupported-layer");

  const effectNode = node as SceneNode & {
    effects: readonly Effect[];
    setEffectStyleIdAsync(styleId: string): Promise<void>;
  };

  let styleFallback: string | undefined;
  let hasStyleFallback = false;

  if (props.effectStyleId) {
    const style = await resolveStyleOfType(props.effectStyleId, "EFFECT");
    if (style) {
      try {
        await effectNode.setEffectStyleIdAsync(props.effectStyleId);
        return applied();
      } catch {
        styleFallback = props.effectStyleName;
        hasStyleFallback = true;
      }
    } else {
      styleFallback = props.effectStyleName;
      hasStyleFallback = true;
    }
  }

  try {
    effectNode.effects = Array.from(props.effects);
    return hasStyleFallback ? applied([note("style-unavailable", styleFallback)]) : applied();
  } catch (err) {
    return failed("error", errorMessage(err));
  }
}

async function applyCornerRadius(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.cornerRadius === undefined && props.cornerRadii === undefined && props.cornerSmoothing === undefined) {
    return skipped("unsupported-layer");
  }
  if (!("cornerRadius" in node)) return skipped("unsupported-layer");

  const cornerNode = node as SceneNode & {
    cornerRadius: number | typeof figma.mixed;
    cornerSmoothing?: number;
    topLeftRadius?: number;
    topRightRadius?: number;
    bottomLeftRadius?: number;
    bottomRightRadius?: number;
  };

  const supportsSideRadii =
    "topLeftRadius" in node &&
    "topRightRadius" in node &&
    "bottomLeftRadius" in node &&
    "bottomRightRadius" in node;

  let didApply = false;

  if (props.cornerRadii) {
    if (supportsSideRadii) {
      try {
        cornerNode.topLeftRadius = props.cornerRadii.topLeft;
        cornerNode.topRightRadius = props.cornerRadii.topRight;
        cornerNode.bottomLeftRadius = props.cornerRadii.bottomLeft;
        cornerNode.bottomRightRadius = props.cornerRadii.bottomRight;
        didApply = true;
      } catch {
        // Fall through to a uniform radius below.
      }
    }

    if (!didApply) {
      try {
        cornerNode.cornerRadius = props.cornerRadii.topLeft;
        didApply = true;
      } catch {
        // Radius stays untouched.
      }
    }
  } else if (props.cornerRadius !== undefined && props.cornerRadius !== figma.mixed) {
    try {
      cornerNode.cornerRadius = props.cornerRadius;
      didApply = true;
    } catch {
      // Radius stays untouched.
    }
  }

  if (props.cornerSmoothing !== undefined && "cornerSmoothing" in node) {
    try {
      cornerNode.cornerSmoothing = props.cornerSmoothing;
      didApply = true;
    } catch {
      // Smoothing stays untouched.
    }
  }

  const notes: ApplyNote[] = [];
  if (supportsSideRadii) {
    for (const field of CORNER_RADIUS_FIELDS) {
      addNote(notes, await bindFieldVariable(node, field, props));
    }
  } else if (hasAnyVariable(props, CORNER_RADIUS_FIELDS)) {
    // Uniform-only targets cannot bind corner radius variables without side fields.
    addNote(notes, note("variable-not-bindable", layerTypeLabel(node)));
  }

  if (!didApply) return failed("error");
  return applied(notes);
}

async function applyOpacity(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.opacity === undefined) return skipped("unsupported-layer");
  if (!("opacity" in node)) return skipped("unsupported-layer");

  try {
    (node as SceneNode & { opacity: number }).opacity = props.opacity;
  } catch (err) {
    return failed("error", errorMessage(err));
  }

  const notes: ApplyNote[] = [];
  addNote(notes, await bindFieldVariable(node, "opacity", props));
  return applied(notes);
}

async function applyBlendMode(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.blendMode === undefined) return skipped("unsupported-layer");
  if (!("blendMode" in node)) return skipped("unsupported-layer");

  try {
    (node as SceneNode & { blendMode: BlendMode }).blendMode = props.blendMode;
    return applied();
  } catch (err) {
    return failed("error", errorMessage(err));
  }
}

function getMissingFontDetail(textNode: TextNode): string | undefined {
  const fontName = textNode.fontName;
  if (fontName !== figma.mixed) return fontName.family;

  try {
    const length = textNode.characters.length;
    if (length > 0) {
      const names = textNode.getRangeAllFontNames(0, length);
      if (names.length > 0) return names[0].family;
    }
  } catch {
    // Best effort only.
  }

  return undefined;
}

function collectFontsToLoad(textNode: TextNode, styles: TextStyles): FontName[] {
  const fonts: FontName[] = [];
  const seen: { [key: string]: boolean } = {};

  const add = (font: FontName): void => {
    const key = `${font.family}\u0000${font.style}`;
    if (seen[key]) return;
    seen[key] = true;
    fonts.push(font);
  };

  const length = textNode.characters.length;
  if (length > 0) {
    try {
      const rangeFonts = textNode.getRangeAllFontNames(0, length);
      for (const font of rangeFonts) add(font);
    } catch {
      // Range fonts can fail on unusual text nodes; the fontName fallback below still helps.
    }
  } else if (textNode.fontName !== figma.mixed) {
    add(textNode.fontName);
  }

  if (styles.fontName) add(styles.fontName);

  return fonts;
}

async function applyTextStyles(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.textStyles === undefined) return skipped("unsupported-layer");
  if (node.type !== "TEXT") return skipped("unsupported-layer");

  const textNode = node as TextNode;

  if (textNode.hasMissingFont) {
    return skipped("missing-font", getMissingFontDetail(textNode));
  }

  const styles = props.textStyles;

  // Load every font used by the target and the source before touching text properties.
  const fonts = collectFontsToLoad(textNode, styles);
  try {
    await Promise.all(fonts.map((font) => figma.loadFontAsync(font)));
  } catch {
    return failed("missing-font", styles.fontName ? styles.fontName.family : undefined);
  }

  let styleFallback: string | undefined;
  let hasStyleFallback = false;

  if (props.textStyleId) {
    const style = await resolveStyleOfType(props.textStyleId, "TEXT");
    if (style) {
      try {
        await textNode.setTextStyleIdAsync(props.textStyleId);
        return applied();
      } catch {
        styleFallback = props.textStyleName;
        hasStyleFallback = true;
      }
    } else {
      styleFallback = props.textStyleName;
      hasStyleFallback = true;
    }
  }

  let didApply = false;

  if (styles.fontName) {
    try {
      textNode.fontName = styles.fontName;
      didApply = true;
    } catch {
      // Font stays untouched.
    }
  }
  if (styles.fontSize !== undefined) {
    try {
      textNode.fontSize = styles.fontSize;
      didApply = true;
    } catch {
      // Size stays untouched.
    }
  }
  if (styles.lineHeight !== undefined) {
    try {
      textNode.lineHeight = styles.lineHeight;
      didApply = true;
    } catch {
      // Line height stays untouched.
    }
  }
  if (styles.letterSpacing !== undefined) {
    try {
      textNode.letterSpacing = styles.letterSpacing;
      didApply = true;
    } catch {
      // Letter spacing stays untouched.
    }
  }
  if (styles.textCase !== undefined) {
    try {
      textNode.textCase = styles.textCase;
      didApply = true;
    } catch {
      // Text case stays untouched.
    }
  }
  if (styles.textDecoration !== undefined) {
    try {
      textNode.textDecoration = styles.textDecoration;
      didApply = true;
    } catch {
      // Decoration stays untouched.
    }
  }

  if (!didApply) return failed("error");
  if (hasStyleFallback) return applied([note("style-unavailable", styleFallback)]);
  return applied();
}

async function applyProperties(node: SceneNode, props: StoredProperties, propertiesToApply: string[]): Promise<PropertyResults> {
  const results: PropertyResults = {};

  for (const prop of propertiesToApply) {
    let result: ApplyResult = failed("error");

    switch (prop) {
      case "fills":
        result = await applyFills(node, props);
        break;
      case "strokes":
        result = await applyStrokes(node, props);
        break;
      case "effects":
        result = await applyEffects(node, props);
        break;
      case "cornerRadius":
        result = await applyCornerRadius(node, props);
        break;
      case "opacity":
        result = await applyOpacity(node, props);
        break;
      case "blendMode":
        result = await applyBlendMode(node, props);
        break;
      case "textStyles":
        result = await applyTextStyles(node, props);
        break;
      default:
        result = skipped("unsupported-layer");
        break;
    }

    results[prop] = result;
  }

  return results;
}

// ============================================================================
// Paste feedback
// ============================================================================

function propertyLabel(property: string): string {
  return PROPERTY_LABELS[property] || property;
}

function pluralLayers(count: number): string {
  return `${count} layer${count === 1 ? "" : "s"}`;
}

function unsupportedHint(property: string): string {
  switch (property) {
    case "textStyles":
      return "not text";
    case "fills":
      return "no fill support";
    case "strokes":
      return "no stroke support";
    case "effects":
      return "no effect support";
    case "cornerRadius":
      return "no corner radius support";
    default:
      return "not supported";
  }
}

function addNoteGroup(
  groups: PasteNoteGroup[],
  groupIndex: { [key: string]: PasteNoteGroup },
  property: string,
  reason: ApplyReason,
  detail: string | undefined,
  layerIndex: number
): void {
  const key = reason === "error"
    ? `${property}|error`
    : `${property}|${reason}|${detail || ""}`;

  let group = groupIndex[key];
  if (!group) {
    group = { property, reason, detail, layers: new Set<number>() };
    groupIndex[key] = group;
    groups.push(group);
  }

  group.layers.add(layerIndex);
}

function sentenceForGroup(group: PasteNoteGroup): string | null {
  const label = propertyLabel(group.property);
  const count = group.layers.size;

  switch (group.reason) {
    case "missing-font":
      return `${label} skipped on ${pluralLayers(count)} (${group.detail ? `font “${group.detail}” is missing` : "font is missing"}).`;
    case "unsupported-layer":
      return `${label} skipped on ${pluralLayers(count)} (${unsupportedHint(group.property)}).`;
    case "error":
      return `Something went wrong pasting ${label.toLowerCase()}.`;
    case "style-unavailable":
      return group.detail
        ? `Style “${group.detail}” isn't in this file, so its values were used.`
        : `A style isn't in this file, so its values were used.`;
    case "variable-unavailable":
      return group.detail
        ? `Variable “${group.detail}” isn't in this file, so its value was used.`
        : `A variable isn't in this file, so its value was used.`;
    case "image-unavailable":
      return `Image fill isn't available in this file and was skipped.`;
    default:
      return null;
  }
}

function sentenceForVariableNotBindable(property: string, groups: PasteNoteGroup[]): string {
  const layers = new Set<number>();
  const layerTypes: string[] = [];

  for (const group of groups) {
    group.layers.forEach((layer) => layers.add(layer));
    if (group.detail) {
      const type = group.detail.toLowerCase();
      if (layerTypes.indexOf(type) === -1) layerTypes.push(type);
    }
  }

  const label = propertyLabel(property);
  const count = layers.size;

  if (layerTypes.length === 1) {
    const type = layerTypes[0];
    if (count === 1) {
      return `${label} variable can't be used on a ${type} layer, so the value was used.`;
    }
    return `${label} variable can't be used on ${type} layers, so the value was used.`;
  }

  return `${label} variable can't be used on ${pluralLayers(count)}, so the value was used.`;
}

function buildNoteSentences(groups: PasteNoteGroup[]): NoteSentence[] {
  const sentences: NoteSentence[] = [];
  const variableGroups: { [property: string]: PasteNoteGroup[] } = {};

  for (const group of groups) {
    if (group.reason === "variable-not-bindable") {
      if (!variableGroups[group.property]) variableGroups[group.property] = [];
      variableGroups[group.property].push(group);
      continue;
    }

    const text = sentenceForGroup(group);
    if (text) sentences.push({ reason: group.reason, text });
  }

  for (const property of Object.keys(variableGroups)) {
    sentences.push({
      reason: "variable-not-bindable",
      text: sentenceForVariableNotBindable(property, variableGroups[property]),
    });
  }

  const ordered: NoteSentence[] = [];
  for (const reason of NOTE_REASON_ORDER) {
    for (const sentence of sentences) {
      if (sentence.reason === reason) ordered.push(sentence);
    }
  }
  for (const sentence of sentences) {
    if (NOTE_REASON_ORDER.indexOf(sentence.reason) === -1) ordered.push(sentence);
  }

  return ordered;
}

function buildPasteFeedback(
  appliedLayerCount: number,
  selectionCount: number,
  allApplied: boolean,
  groups: PasteNoteGroup[]
): PasteFeedback {
  const sentences = buildNoteSentences(groups);
  const shown = sentences.slice(0, 2);
  const moreSentences = sentences.slice(2).map((sentence) => sentence.text);

  if (appliedLayerCount === 0) {
    const everyNoteIsUnsupported = groups.length > 0 &&
      groups.every((group) => group.reason === "unsupported-layer");

    if (groups.length === 0 || everyNoteIsUnsupported) {
      return {
        level: "error",
        message: "Nothing was pasted. None of the selected layers support these properties.",
        moreSentences: [],
      };
    }

    let message = "Nothing was pasted.";
    if (shown.length > 0) {
      message += " " + shown.map((sentence) => sentence.text).join(" ");
    }
    return { level: "error", message, moreSentences };
  }

  let message = appliedLayerCount === selectionCount
    ? `Pasted to ${pluralLayers(appliedLayerCount)}.`
    : `Pasted to ${appliedLayerCount} of ${pluralLayers(selectionCount)}.`;

  if (shown.length > 0) {
    message += " " + shown.map((sentence) => sentence.text).join(" ");
  }

  return {
    level: allApplied && sentences.length === 0 ? "success" : "warning",
    message,
    moreSentences,
  };
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
      count: 0,
    } as MessageToUI);
  } else if (selection.length === 1) {
    figma.ui.postMessage({
      type: "selection-changed",
      hasSelection: true,
      count: 1,
      nodeName: selection[0].name,
      nodeType: selection[0].type,
    } as MessageToUI);
  } else {
    figma.ui.postMessage({
      type: "selection-changed",
      hasSelection: true,
      count: selection.length,
      nodeName: `${selection.length} layers`,
      nodeType: "MULTIPLE",
    } as MessageToUI);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function sendPropertiesCopied(properties: StoredProperties, restored: boolean): void {
  const availableProperties = getAvailableProperties(properties);
  const defaultValued = computeDefaultValued(properties);
  const mixed: string[] = [];
  if (properties.sourceType === "TEXT" && properties.fills === figma.mixed) {
    mixed.push("fills");
  }
  const previews = computeAllPreviews(properties);

  figma.ui.postMessage({
    type: "properties-copied",
    sourceName: properties.sourceName,
    sourceType: properties.sourceType,
    availableProperties,
    defaultValued,
    mixed,
    previews,
    restored,
  } as MessageToUI);

  if (properties.textStyles?.hasMixedValues) {
    figma.ui.postMessage({
      type: "info",
      message: "Some text styles were skipped due to mixed values.",
    } as MessageToUI);
  }
}

async function handleCopy(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select a layer first",
    } as MessageToUI);
    return;
  }

  if (selection.length > 1) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select only one layer to copy from",
    } as MessageToUI);
    return;
  }

  const node = selection[0];

  let properties: StoredProperties;
  try {
    properties = extractAllProperties(node);
    await populateAuxiliaryNames(properties);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({
      type: "error",
      message: "Copy failed: " + msg,
    } as MessageToUI);
    return;
  }

  setStored(properties);
  clipboardChangedSinceStartup = true;
  await persistClipboard(properties);
  sendPropertiesCopied(properties, false);
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
      message: "Please select target layers first",
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

  const groups: PasteNoteGroup[] = [];
  const groupIndex: { [key: string]: PasteNoteGroup } = {};
  let appliedLayerCount = 0;
  let allApplied = true;

  for (let layerIndex = 0; layerIndex < selection.length; layerIndex++) {
    const node = selection[layerIndex];
    let results: PropertyResults = {};
    let layerApplied = false;
    let layerAllApplied = true;

    try {
      results = await applyProperties(node, stored, propertiesToPaste);
    } catch (err) {
      console.error(`[CopyOne] Paste failed on ${node.type} "${node.name}": ${errorMessage(err)}`);
      layerAllApplied = false;
    }

    for (const property of propertiesToPaste) {
      const propertyResult = results[property];
      if (!propertyResult) {
        layerAllApplied = false;
        addNoteGroup(groups, groupIndex, property, "error", undefined, layerIndex);
        continue;
      }

      if (propertyResult.status === "applied") {
        layerApplied = true;
      }
      if (propertyResult.status !== "applied" || propertyResult.notes.length > 0) {
        layerAllApplied = false;
      }

      for (const applyNote of propertyResult.notes) {
        if (applyNote.reason === "error" && applyNote.detail) {
          console.error(`[CopyOne] Failed to paste ${property} on ${node.type} "${node.name}": ${applyNote.detail}`);
        }
        addNoteGroup(groups, groupIndex, property, applyNote.reason, applyNote.detail, layerIndex);
      }
    }

    if (layerApplied) appliedLayerCount++;
    if (!layerAllApplied) allApplied = false;
  }

  figma.commitUndo();

  const feedback = buildPasteFeedback(appliedLayerCount, selection.length, allApplied, groups);
  figma.ui.postMessage({
    type: "paste-complete",
    level: feedback.level,
    message: feedback.message,
    moreSentences: feedback.moreSentences,
  } as MessageToUI);
}

// ============================================================================
// Plugin Initialization
// ============================================================================

async function initializeStorage(): Promise<void> {
  const prefs = await loadPrefs();
  if (!prefsChangedSinceStartup) {
    figma.ui.postMessage({
      type: "prefs",
      checked: prefs,
    } as MessageToUI);
  }

  const restored = await loadClipboard();
  if (clipboardChangedSinceStartup || !restored) return;

  setStored(restored);
  sendPropertiesCopied(restored, true);
}

async function handleClearClipboard(): Promise<void> {
  clipboardChangedSinceStartup = true;
  setStored(null);
  await deleteStoredClipboard();
  figma.ui.postMessage({
    type: "clipboard-cleared",
  } as MessageToUI);
}

// Show the UI panel
figma.showUI(__html__, {
  width: UI_WIDTH,
  height: 560,
  title: "CopyOne",
  themeColors: true,
});

figma.ui.postMessage({
  type: "version",
  version: PLUGIN_VERSION,
} as MessageToUI);
figma.ui.postMessage({
  type: "property-labels",
  labels: PROPERTY_LABELS,
} as MessageToUI);

// Listen for selection changes
figma.on("selectionchange", () => {
  sendSelectionUpdate();
});

// Send initial selection state
sendSelectionUpdate();

// Restore the clipboard and prefs after the UI can receive messages.
initializeStorage().catch((err) => {
  console.error(`[CopyOne] Could not initialize storage: ${errorMessage(err)}`);
});

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
    case "save-prefs": {
      const checked: { [property: string]: boolean } = {};
      if (isRecord(msg.checked)) {
        for (const key of Object.keys(msg.checked)) {
          if (typeof msg.checked[key] === "boolean") {
            checked[key] = msg.checked[key];
          }
        }
      }
      prefsChangedSinceStartup = true;
      await persistPrefs(checked);
      break;
    }
    case "clear-clipboard":
      await handleClearClipboard();
      break;
    case "resize-ui":
      if (Number.isFinite(msg.height)) {
        const nextHeight = Math.max(UI_MIN_HEIGHT, Math.min(UI_MAX_HEIGHT, Math.ceil(msg.height)));
        figma.ui.resize(UI_WIDTH, nextHeight);
      }
      break;
  }
};
