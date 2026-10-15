# Drawing Studio v1.3 — release and test notes

This release extends the existing Next.js / Fabric.js 6.9.0 editor. No new
runtime packages are required. The Endless Sketchpage homepage, rooms, saved
boards, object-level Protected/Classic synchronization and smart connectors
are retained.

## Drawing and vector tools

- **Pencil (P):** familiar smoothed Fabric PencilBrush strokes.
- **Ink pen:** a slightly bolder consistent-width brush.
- **Marker:** a wider, translucent brush; repeated passes build up color.
- **Spray:** Fabric's original SprayBrush. Its dots are editable as one stroke.
- **Pressure pen:** produces a closed, pressure-varying **vector outline**.
  Pointer Events from compatible pens/tablets supply pressure; mouse/touch
  fall back to a constant pressure. Each stroke is an ordinary Fabric Path,
  with a unique ID and one add operation on completion. No point cloud is
  continually broadcast. Up to 3,000 sampled points are captured per stroke.
- **Eraser (E):** removes full objects (strokes, shapes, notes, etc.) upon click
  or while dragging. This is an object eraser, NOT a pixel/split-path eraser.
- **Three-point Bézier curve (B):** click start, then control handle, then end.
  The resulting curve is saved as a vector Path with `vectorNodes` metadata.
  Select the path and open the **Art** drawer to edit node X/Y values.
  Moving or transforming a curve flattens its new world coordinates back into
  an ordinary editable path. This first version does not support draggable
  on-canvas anchor handles or freeform multi-segment paths.
- **Stroke color and width:** in the Art drawer; presets can be changed without
  switching away from the room. Ink opacity supports 5–100%.
- **Shape fill:** can be set before drawing rectangles/ellipses or changed for a
  selected object. Transparent fill is the default.
- **Existing SVG/PNG/JSON export, zoom, undo/redo, stickers, notes and layers**
  still use the original editor architecture.

New modules:

```
lib/art-strokes.ts                   pressure geometry, curve geometry, opacity
components/editor/ArtToolsPanel.tsx brush UI, fill/opacity, curve points
public/art/studio/brush-workshop.svg original vector art for the Art drawer
tests/art-strokes.test.cjs           stroke/curve geometry regression tests
```

These changes are intentionally **not a Krita replacement**. There are no
raster paint layers, pixel-level masks, blending modes, boolean path
operations, on-canvas Bézier handles, or pressure calibration profiles yet.

## Run and verify

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

In a local room:

1. Sketch with each preset. Confirm undo, save/reload and SVG/PNG export.
2. Draw with the Pressure pen using mouse, then with a graphics tablet (if
   available). Compare a light touch and strong press.
3. Draw a Bézier curve by clicking three points; select and change its control
   point in the Art drawer. Move the curve, then edit its coordinates again.
4. Create an ellipse with a custom fill, change opacity, then erase it with E.
5. With two browsers on a cloud-backed room, draw separate strokes concurrently
   using **Protected** sync: both should persist without a collision.
6. In both sessions edit the *same* curve: Protected should reject stale
   edits; Classic should accept the last write. Verify backup/conflict warning.
7. Move a shape attached to a smart connector and ensure its path tracks.
8. On mobile, scroll the horizontal toolbar and open the Art drawer; check
   pointer drawing does not interfere with board navigation.

## Runtime caveats

The new source has syntax/geometry checks, but this workspace cannot install
packages from npm or run a complete Next.js build. Do not deploy without the
local TypeScript, production build and live two-session tests above. Existing
boards and exports should remain compatible; save a JSON backup first when
moving an important production room to this version.
