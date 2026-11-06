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
  // Source element info
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
  | { type: "properties-copied"; sourceName: string; sourceType: string; availableProperties: string[]; previews: PropertyPreviews }
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
  const spaced = node.type.toLowerCase().replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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

async function applyFills(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.fills === undefined || props.fills === figma.mixed) return skipped("unsupported-layer");
  if (!("fills" in node)) return skipped("unsupported-layer");

  const fillNode = node as SceneNode & {
    fills: readonly Paint[];
    setFillStyleIdAsync(styleId: string): Promise<void>;
  };

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

  try {
    fillNode.fills = Array.from(props.fills);
    return hasStyleFallback ? applied([note("style-unavailable", styleFallback)]) : applied();
  } catch {
    return failed("error");
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
  } catch {
    return failed("error");
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

async function applyOpacityBlend(node: SceneNode, props: StoredProperties): Promise<ApplyResult> {
  if (props.opacity === undefined && props.blendMode === undefined) return skipped("unsupported-layer");

  const supportsOpacity = "opacity" in node;
  const supportsBlend = "blendMode" in node;
  if (!supportsOpacity && !supportsBlend) return skipped("unsupported-layer");

  const blendNode = node as SceneNode & { opacity: number; blendMode: BlendMode };
  let didApply = false;

  if (supportsOpacity && props.opacity !== undefined) {
    try {
      blendNode.opacity = props.opacity;
      didApply = true;
    } catch {
      // Opacity stays untouched.
    }
  }

  if (supportsBlend && props.blendMode !== undefined) {
    try {
      blendNode.blendMode = props.blendMode;
      didApply = true;
    } catch {
      // Blend mode stays untouched.
    }
  }

  const notes: ApplyNote[] = [];
  if (supportsOpacity) {
    addNote(notes, await bindFieldVariable(node, "opacity", props));
  }

  if (!didApply) return failed("error");
  return applied(notes);
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
      case "opacityBlend":
        result = await applyOpacityBlend(node, props);
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
  const availableProperties = getAvailableProperties(properties);
  const previews = computeAllPreviews(properties);

  figma.ui.postMessage({
    type: "properties-copied",
    sourceName: properties.sourceName,
    sourceType: properties.sourceType,
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
  let totalSkipped = 0;

  for (const node of selection) {
    const result = await applyProperties(node, stored, propertiesToPaste);
    for (const prop of Object.keys(result)) {
      const propertyResult = result[prop];
      if (propertyResult.status === "applied") {
        totalSuccess++;
      } else if (propertyResult.status === "skipped") {
        totalSkipped++;
      } else {
        totalFailed++;
      }
    }
  }

  figma.commitUndo();

  const message = totalFailed > 0 || totalSkipped > 0
    ? `Applied ${totalSuccess} properties. ${totalFailed + totalSkipped} couldn't be applied (incompatible node types).`
    : `Successfully applied ${totalSuccess} properties to ${selection.length} element(s).`;

  figma.ui.postMessage({
    type: "paste-complete",
    success: totalFailed === 0 && totalSkipped === 0,
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
