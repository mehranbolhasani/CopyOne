#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# CopyOne Figma Plugin — Release Script
# =============================================================================
# Usage:
#   ./scripts/release.sh [patch|minor|major]
#
# Steps:
#   1. Verify working tree is clean (warn if not)
#   2. Run lint + build
#   3. Review changes since last version
#   4. Bump version in package.json
#   5. Rebuild to inject version into code.js
#   6. Create release zip (manifest.json + code.js + ui.html)
#   7. Verify zip contents
#   8. Show next steps for Figma upload
# =============================================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function error()   { echo -e "${RED}✖ $1${NC}"; }
function success() { echo -e "${GREEN}✔ $1${NC}"; }
function warn()      { echo -e "${YELLOW}⚠ $1${NC}"; }
function info()      { echo -e "${BLUE}ℹ $1${NC}"; }

# ─── Parse argument ─────────────────────────────────────────────────────────
BUMP_TYPE="${1:-}"
if [[ -z "$BUMP_TYPE" ]]; then
  echo "Usage: $0 <patch|minor|major>"
  echo ""
  echo "  patch — bug fixes, UI tweaks, docs (1.0.1 → 1.0.2)"
  echo "  minor — new features, meaningful behavior changes (1.0.1 → 1.1.0)"
  echo "  major — breaking changes (1.0.1 → 2.0.0)"
  exit 1
fi

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  error "Invalid bump type: $BUMP_TYPE. Must be patch, minor, or major."
  exit 1
fi

# ─── 1. Working tree check ──────────────────────────────────────────────────
echo ""
info "1. Checking working tree..."
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "Working tree is not clean. Uncommitted changes detected:"
  git status --short
  echo ""
  read -r -p "Continue anyway? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    info "Aborted. Commit or stash your changes first."
    exit 0
  fi
else
  success "Working tree is clean."
fi

# ─── 2. Lint + Build ────────────────────────────────────────────────────────
echo ""
info "2. Running lint..."
npm run lint
success "Lint passed."

echo ""
info "3. Running build..."
npm run build
success "Build passed."

# ─── 3. Review changes ──────────────────────────────────────────────────────
echo ""
info "4. Changes since the last tag (or last 10 commits if no tag):"
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [[ -n "$LAST_TAG" ]]; then
  echo "   Last tag: $LAST_TAG"
  echo ""
  git log --oneline --no-decorate "$LAST_TAG..HEAD" || true
else
  echo "   (no tags found — showing last 10 commits)"
  echo ""
  git log --oneline --no-decorate -10 || true
fi

echo ""
info "   Files changed since last tag:"
if [[ -n "$LAST_TAG" ]]; then
  git diff --name-only "$LAST_TAG..HEAD" || true
else
  git diff --name-only HEAD~10..HEAD || true
fi

# ─── 4. Current version ─────────────────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo ""
info "5. Current version: $CURRENT_VERSION"

# ─── 5. Bump version ────────────────────────────────────────────────────────
echo ""
info "6. Bumping version ($BUMP_TYPE)..."
NEW_VERSION=$(npm version "$BUMP_TYPE" --no-git-tag-version | sed 's/^v//')
success "New version: $NEW_VERSION"

# Show the diff
info "   package.json diff:"
git diff package.json | grep -A1 -B1 '"version"' || true

# ─── 6. Rebuild with new version ───────────────────────────────────────────
echo ""
info "7. Rebuilding with injected version..."
npm run build
success "Build complete with version $NEW_VERSION."

# ─── 7. Verify required files exist ─────────────────────────────────────────
echo ""
info "8. Verifying release files..."

REQUIRED_FILES=("manifest.json" "code.js" "ui.html")
MISSING=0
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    error "Missing required file: $f"
    MISSING=1
  fi
done

if [[ "$MISSING" -eq 1 ]]; then
  error "Aborting — required files are missing."
  exit 1
fi

# Verify manifest points to existing files
MAIN_FILE=$(node -p "require('./manifest.json').main")
UI_FILE=$(node -p "require('./manifest.json').ui")
if [[ ! -f "$MAIN_FILE" ]]; then
  error "manifest.json main points to '$MAIN_FILE' which does not exist."
  exit 1
fi
if [[ ! -f "$UI_FILE" ]]; then
  error "manifest.json ui points to '$UI_FILE' which does not exist."
  exit 1
fi

success "All required files present and manifest is consistent."

# ─── 8. Create release zip ──────────────────────────────────────────────────
echo ""
info "9. Creating release package..."

RELEASE_DIR="$REPO_ROOT/releases"
mkdir -p "$RELEASE_DIR"

ZIP_NAME="CopyOne-v${NEW_VERSION}.zip"
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"

# Remove old zip if it exists
rm -f "$ZIP_PATH"

# Create zip with only the files Figma needs
zip -j "$ZIP_PATH" manifest.json code.js ui.html

success "Release package created: $ZIP_PATH"

# ─── 9. Verify zip contents ─────────────────────────────────────────────────
echo ""
info "10. Verifying zip contents..."
unzip -l "$ZIP_PATH"

# ─── 10. Commit and tag ─────────────────────────────────────────────────────
echo ""
info "11. Git operations..."
echo ""
read -r -p "   Commit version bump and create git tag v$NEW_VERSION? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  git add package.json
  git add code.js
  git commit -m "Release v$NEW_VERSION"
  git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
  success "Committed and tagged v$NEW_VERSION."
else
  warn "Skipped git commit/tag. Run manually when ready:"
  echo "     git add package.json code.js"
  echo "     git commit -m \"Release v$NEW_VERSION\""
  echo "     git tag -a v$NEW_VERSION -m \"Release v$NEW_VERSION\""
fi

# ─── 11. Next steps ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Release v$NEW_VERSION is ready"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Package: $ZIP_PATH"
echo ""
echo "  Next steps to publish to Figma:"
echo ""
echo "    1. Open Figma Desktop"
echo "    2. Go to Plugins → Development → Manage Plugins"
echo "    3. Find CopyOne and click 'Update' (or 'Publish' for first release)"
echo "    4. Upload the zip file: $ZIP_NAME"
echo "    5. Fill in release notes (see CHANGELOG suggestion below)"
echo ""
echo "  Suggested CHANGELOG entry:"
echo ""
if [[ "$BUMP_TYPE" == "patch" ]]; then
  echo "    ## v$NEW_VERSION — Bug fixes and polish"
else
  echo "    ## v$NEW_VERSION — Improvements"
fi
echo ""
echo "    - Fixed per-corner (mixed) corner radius copy, preview, and paste"
echo "    - Fixed source/target name truncation in the plugin panel"
echo "    - Improved dark-mode button contrast"
echo "    - Aligned TypeScript/eslint toolchain versions"
echo ""
echo "═══════════════════════════════════════════════════════════════"
