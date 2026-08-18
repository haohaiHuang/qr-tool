# qr-tool

**English** | [简体中文](README.zh.md)

A local QR code enhancement tool — a single HTML page, zero server, running entirely in your browser. It turns low-resolution QR codes / WeChat mini-program codes into high-definition PNG / SVG for print.

## Capabilities

- **Standard QR (incl. with logo) — semantic rebuild (vector, lossless)**: detects the module grid, samples each module, and redraws it as crisp vectors — any resolution, retaining the original module arrangement, colors, gap/rounded style, and center logo
- **Enhance-redraw / Original-enlarge switch**: if the rebuilt result is not to your liking, switch to pixel-faithful enlargement with one click
- **WeChat mini-program code — pixel-faithful enlargement**: color creative codes are kept as-is and enlarged with high-quality interpolation (no structure rebuild — it would lose colors/creativity)
- **Closed-loop self-check**: every rebuilt code is re-decoded and compared character-by-character with the original — never outputs an unverified code
- **Preview = download**: the preview shows exactly what you download (1184px PNG, or vector SVG with embedded logo)
- **Fallback chain**: rebuild fails → automatic pixel-faithful enlargement (never errors out)
- **Long-content support**: high-version QR codes (up to 77+ modules), URL parameters / tracking data preserved character-for-character

## How to use

```bash
python3 -m http.server 8123
# open http://localhost:8123/ui/index.html
```

Drag an image onto the page (or click to pick a file). The tool detects the code type, processes it, and lets you download PNG / SVG.

## Architecture

```
Input → type detection
  ├─ WeChat mini-program code → pixel-faithful enlargement (color creative code, cannot rebuild)
  └─ Standard QR → semantic rebuild (detect grid → sample modules → vector redraw)
       └─ rebuild fails → pixel-faithful enlargement (fallback)
```

- **Semantic rebuild** (`src/qr/`): module-grid detection (finder triangles + alignment), per-module sampling, vector redraw with original colors / gaps / rounded corners / logo (white-ring detection + region growing)
- **Pixel-faithful enlargement** (`src/wechat.js`): Catmull-Rom interpolation
- **Quality detection** (`src/quality.js`): edge-gradient sharpness (reserved)

## Tech stack

- Pure JS (ESM), zero build — browser runs `src/` modules directly via import map
- Tests: `node:test`, zero-dependency (`npm test`)
- Decoding: jsQR + zxing (fallback); QR generation: qrcode-generator (for testing)
- Single HTML UI (`ui/`), local-only processing (no server upload)

## Development

Follows Spec → Plan → Task breakdown with strict TDD (Red → Green → Refactor). Harness files:

- `AGENTS.md` — agent rules (TDD workflow, tech constraints)
- `SPEC.md` — features F1-F8 + test cases
- `PLAN.md` — phases (0-6)
- `TASKS.md` — TDD-grained task list
- `feature_list.json` / `progress.md` — feature state and progress

Current status: Phase 0-4 complete (MVP: standard QR + logo QR + WeChat code, 61 tests).
