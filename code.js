"use strict";
// CopyOne - Selective Property Copy/Paste Plugin
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ============================================================================
// Global State
// ============================================================================
let storedProperties = null;
// ============================================================================
// Property Extraction Functions
// ============================================================================
function extractFills(node) {
    if ("fills" in node) {
        return { fills: node.fills };
    }
    return {};
}
function extractStrokes(node) {
    const result = {};
    if ("strokes" in node) {
        result.strokes = node.strokes;
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
function extractEffects(node) {
    if ("effects" in node) {
        return { effects: node.effects };
    }
    return {};
}
function extractCornerRadius(node) {
    const result = {};
    if ("cornerRadius" in node) {
        result.cornerRadius = node.cornerRadius;
        // Check for individual corner radii
        if (node.cornerRadius === figma.mixed &&
            "topLeftRadius" in node &&
            "topRightRadius" in node &&
            "bottomLeftRadius" in node &&
            "bottomRightRadius" in node) {
            result.cornerRadii = {
                topLeft: node.topLeftRadius,
                topRight: node.topRightRadius,
                bottomLeft: node.bottomLeftRadius,
                bottomRight: node.bottomRightRadius,
            };
        }
    }
    return result;
}
function extractOpacityBlend(node) {
    const result = {};
    if ("opacity" in node) {
        result.opacity = node.opacity;
    }
    if ("blendMode" in node) {
        result.blendMode = node.blendMode;
    }
    return result;
}
function extractTextStyles(node) {
    if (node.type !== "TEXT") {
        return {};
    }
    const textNode = node;
    // Only extract if values are not mixed
    if (textNode.fontSize === figma.mixed ||
        textNode.fontName === figma.mixed ||
        textNode.lineHeight === figma.mixed ||
        textNode.letterSpacing === figma.mixed ||
        textNode.textCase === figma.mixed ||
        textNode.textDecoration === figma.mixed) {
        return {};
    }
    return {
        textStyles: {
            fontSize: textNode.fontSize,
            fontName: textNode.fontName,
            lineHeight: textNode.lineHeight,
            letterSpacing: textNode.letterSpacing,
            textCase: textNode.textCase,
            textDecoration: textNode.textDecoration,
        },
    };
}
function extractAllProperties(node) {
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ sourceName: node.name, sourceType: node.type }, extractFills(node)), extractStrokes(node)), extractEffects(node)), extractCornerRadius(node)), extractOpacityBlend(node)), extractTextStyles(node));
}
function getAvailableProperties(props) {
    const available = [];
    if (props.fills !== undefined)
        available.push("fills");
    if (props.strokes !== undefined)
        available.push("strokes");
    if (props.effects !== undefined)
        available.push("effects");
    if (props.cornerRadius !== undefined)
        available.push("cornerRadius");
    if (props.opacity !== undefined || props.blendMode !== undefined)
        available.push("opacityBlend");
    if (props.textStyles !== undefined)
        available.push("textStyles");
    return available;
}
// ============================================================================
// Property Application Functions
// ============================================================================
function applyFills(node, props) {
    if (props.fills === undefined)
        return false;
    if (!("fills" in node))
        return false;
    try {
        if (props.fills !== figma.mixed) {
            node.fills = [...props.fills];
        }
        return true;
    }
    catch (_a) {
        return false;
    }
}
function applyStrokes(node, props) {
    if (props.strokes === undefined)
        return false;
    if (!("strokes" in node))
        return false;
    try {
        const strokeNode = node;
        if (props.strokes)
            strokeNode.strokes = [...props.strokes];
        if (props.strokeWeight !== undefined && props.strokeWeight !== figma.mixed) {
            strokeNode.strokeWeight = props.strokeWeight;
        }
        if (props.strokeAlign !== undefined) {
            strokeNode.strokeAlign = props.strokeAlign;
        }
        // These properties are on nodes that support individual stroke settings
        const extendedNode = node;
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
    }
    catch (_a) {
        return false;
    }
}
function applyEffects(node, props) {
    if (props.effects === undefined)
        return false;
    if (!("effects" in node))
        return false;
    try {
        node.effects = [...props.effects];
        return true;
    }
    catch (_a) {
        return false;
    }
}
function applyCornerRadius(node, props) {
    if (props.cornerRadius === undefined)
        return false;
    if (!("cornerRadius" in node))
        return false;
    try {
        const cornerNode = node;
        if (props.cornerRadii) {
            // Apply individual corner radii if available
            if ("topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node) {
                const rectNode = node;
                rectNode.topLeftRadius = props.cornerRadii.topLeft;
                rectNode.topRightRadius = props.cornerRadii.topRight;
                rectNode.bottomLeftRadius = props.cornerRadii.bottomLeft;
                rectNode.bottomRightRadius = props.cornerRadii.bottomRight;
            }
        }
        else if (props.cornerRadius !== figma.mixed) {
            cornerNode.cornerRadius = props.cornerRadius;
        }
        return true;
    }
    catch (_a) {
        return false;
    }
}
function applyOpacityBlend(node, props) {
    if (props.opacity === undefined && props.blendMode === undefined)
        return false;
    try {
        if ("opacity" in node && props.opacity !== undefined) {
            node.opacity = props.opacity;
        }
        if ("blendMode" in node && props.blendMode !== undefined) {
            node.blendMode = props.blendMode;
        }
        return true;
    }
    catch (_a) {
        return false;
    }
}
function applyTextStyles(node, props) {
    return __awaiter(this, void 0, void 0, function* () {
        if (props.textStyles === undefined)
            return false;
        if (node.type !== "TEXT")
            return false;
        try {
            const textNode = node;
            const { fontName, fontSize, lineHeight, letterSpacing, textCase, textDecoration } = props.textStyles;
            // Must load font before applying text styles
            yield figma.loadFontAsync(fontName);
            textNode.fontName = fontName;
            textNode.fontSize = fontSize;
            textNode.lineHeight = lineHeight;
            textNode.letterSpacing = letterSpacing;
            textNode.textCase = textCase;
            textNode.textDecoration = textDecoration;
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
function applyProperties(node, props, propertiesToApply) {
    return __awaiter(this, void 0, void 0, function* () {
        const success = [];
        const failed = [];
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
                    result = yield applyTextStyles(node, props);
                    break;
            }
            if (result) {
                success.push(prop);
            }
            else {
                failed.push(prop);
            }
        }
        return { success, failed };
    });
}
// ============================================================================
// Selection Handling
// ============================================================================
function sendSelectionUpdate() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        figma.ui.postMessage({
            type: "selection-changed",
            hasSelection: false,
        });
    }
    else if (selection.length === 1) {
        figma.ui.postMessage({
            type: "selection-changed",
            hasSelection: true,
            nodeName: selection[0].name,
            nodeType: selection[0].type,
        });
    }
    else {
        figma.ui.postMessage({
            type: "selection-changed",
            hasSelection: true,
            nodeName: `${selection.length} elements`,
            nodeType: "MULTIPLE",
        });
    }
}
// ============================================================================
// Message Handling
// ============================================================================
function handleCopy() {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.ui.postMessage({
                type: "error",
                message: "Please select an element first",
            });
            return;
        }
        if (selection.length > 1) {
            figma.ui.postMessage({
                type: "error",
                message: "Please select only one element to copy from",
            });
            return;
        }
        const node = selection[0];
        storedProperties = extractAllProperties(node);
        const availableProperties = getAvailableProperties(storedProperties);
        figma.ui.postMessage({
            type: "properties-copied",
            properties: storedProperties,
            availableProperties,
        });
        figma.notify(`Copied properties from "${node.name}"`);
    });
}
function handlePaste(propertiesToPaste) {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        if (!storedProperties) {
            figma.ui.postMessage({
                type: "error",
                message: "No properties copied. Please copy properties first.",
            });
            return;
        }
        if (selection.length === 0) {
            figma.ui.postMessage({
                type: "error",
                message: "Please select target element(s) first",
            });
            return;
        }
        if (propertiesToPaste.length === 0) {
            figma.ui.postMessage({
                type: "error",
                message: "Please select at least one property to paste",
            });
            return;
        }
        let totalSuccess = 0;
        let totalFailed = 0;
        for (const node of selection) {
            const result = yield applyProperties(node, storedProperties, propertiesToPaste);
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
        });
        figma.notify(message);
    });
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
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    switch (msg.type) {
        case "copy":
            yield handleCopy();
            break;
        case "paste":
            yield handlePaste(msg.properties);
            break;
        case "get-selection":
            sendSelectionUpdate();
            break;
    }
});
