# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Camera Mapping Tool — a browser-based application for placing cameras and network drops on a floor plan image, drawing connections between them, and computing project cost estimates. It runs entirely client-side with no build step, server, or dependencies.

## Running the App

Open `index.html` directly in a browser (works with `file://` protocol). No build tools, package manager, or dev server required.

## Architecture

The entire application lives in a single IIFE in `js/app.js`. There are six classes, each managing a distinct concern:

- **`App`** — Top-level orchestrator. Wires together all managers, sets up toolbar button handlers, and handles project save/load (JSON files with embedded base64 image data).
- **`MapManager`** — Owns the pannable/zoomable canvas. Handles coordinate transforms between screen and image space (`screenToImageCoords`). Delegates click events to callbacks (`onPinPlacement`, `onConnectionPointPlacement`) based on the current mode (`select`, `pan`, `add-drop`, `add-camera`, `add-connection`).
- **`PinManager`** — Manages the array of pin objects (drops and cameras). Handles pin rendering (inline SVG icons), drag-to-move, selection, and FOV cone rendering/dragging for cameras. Each camera pin has a visual FOV cone with draggable handles for angle, spread, and range.
- **`ConnectionManager`** — Manages point-to-point connection lines rendered in an SVG overlay. Supports endpoint snapping (within `snapDistance` of 15 image-px) and a two-click creation flow with a preview line.
- **`BudgetManager`** — Computes cost summaries from camera prices, labor cost per camera, and cost per connection. Updates the sidebar budget panel DOM directly.
- **`UIManager`** — Manages the sidebar: pin/connection list, properties panel (name, price, linked drop, FOV controls), delete confirmation modal, and keyboard shortcut (Delete/Backspace).

### Rendering layers (in `index.html` inside `#mapCanvas`)

1. `<img #layoutImage>` — the uploaded floor plan
2. `<svg #connectionsLayer>` — SVG lines and endpoint circles for connections
3. `<svg #fovLayer>` — (reserved, currently unused; FOV cones are rendered inside pin elements)
4. `<div #pinsLayer>` — absolutely-positioned div elements for each pin

All layers share the same CSS transform applied to `#mapCanvas` by `MapManager.applyTransform()`.

### Project file format

Save/load serializes to JSON with keys: `version`, `image` (base64 data URL), `pins`, `connections`, `budget`, `map`. Each manager has `getState()`/`setState()` methods. Backward compatibility handles old `cameraType`/`customPrice` fields.

### Visibility filters

Toggle buttons on the toolbar add/remove CSS classes (`hide-drops`, `hide-cameras`, `hide-fov`, `hidden`) to the pins and connections layers to control visibility.

## Key Conventions

- No modules — the IIFE pattern is intentional for `file://` compatibility.
- Pin IDs use `${type}-${Date.now()}` format.
- Coordinates are always in image-space (pixels relative to the uploaded image's natural dimensions).
- The global `DEFAULT_CAMERA_PRICE` variable is shared between `PinManager` and `BudgetManager`.
- CSS uses a dark navy/blue color scheme with specific hex values (`#0a1628`, `#0f2847`, `#1e4976`, `#38bdf8`, `#7dd3fc`).
