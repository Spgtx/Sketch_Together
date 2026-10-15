# SketchTogether v1.4 — Raster & Vector Paint Studio

This release extends the v1.3 Art Studio without changing the protected/classic
synchronization protocol or removing the Endless Sketchpage homepage.

## What's new

- **Transparent raster paint layers.** Open the **Paint** tab in a room, press
  **New transparent paint layer**, choose that layer, then use **Pixel brush (G)**.
  Each paint layer is a separate Fabric image, stored as PNG inside the board's
  Fabric JSON data, and painted using a 2D canvas. Up to **five** layers are
  supported, each **1600 × 1000 pixels** anchored to board coordinates (0, 0).
- **True pixel-level eraser (X).** Uses `destination-out` on the active layer's
  canvas pixels. Unlike the original object eraser (E), it cuts transparent
  holes within painted marks instead of deleting an entire stroke object.
- **Contiguous color fill bucket (F).** Uses a tolerance-based 4-neighbour
  fill and the currently selected color and opacity. Click a region on the
  selected raster layer. Filling a blank transparent layer fills the whole
  bounded raster surface.
- **Six blending modes.** Normal, Multiply, Screen, Overlay, Darken, Lighten.
  These are native canvas compositing operations and affect how the selected
  paint layer combines with objects beneath it. Use PNG export to preserve
  the rendered composite most reliably; SVG export may not reproduce every
  browser-specific blend mode.
- **Raster layer controls.** Select, rename, hide/show, export PNG, or delete paint layers
  from the Paint tab. To reorder objects, use the original Layers panel.
- **Editable Bézier handles.** Draw a curve (B: start, control, end), then
  select the curve (V). Drag its three visible on-canvas handles. Numeric X/Y
  coordinate editing remains available in the Art tab.
- **Vector fill colors.** Select a Bézier curve and toggle **Close and fill
  this curve** in the Art tab; pick the desired shape fill using the native
  color picker. The usual rectangle/ellipse fill tools are retained.
- **Original local SVG artwork.** `public/art/studio/paint-friends.svg`, plus
  a custom paint-bucket glyph added to `StudioIcon.tsx`.

## Collaboration rules (important)

The cloud stores each completed **paint layer** as one versioned object, not
as individually mergeable brush pixels. Protected mode can accept edits to
**different layers** simultaneously. If two collaborators paint the **same
layer** from the same base revision, the second protected edit is rejected and
kept locally for manual recovery. Classic mode still uses last-write-wins.

This is conflict detection and preservation, **not per-pixel CRDT merging**.
Choose one layer per collaborator for lower-conflict collaborative painting.
The new paint features are otherwise compatible with existing boards, notes,
connectors, stickers, snapshots, and local JSON exports.

## Size and performance limitations

1. The cloud document/operation limit is **4.5 MB**. Detailed painted images,
   photos and five raster layers may exceed this. The UI will warn if cloud
   sync rejects an oversized edit. Save a JSON backup regularly.
2. Browsers also impose localStorage quotas. The raster layer's PNG payload
   is stored as a data URL inside Fabric JSON; use downloaded JSON backups
   rather than relying on localStorage for very large painted boards.
3. Raster editing is restricted to the initial 1600 × 1000 board-coordinate
   region. Infinite-canvas raster tiling, masks, selection-based fills,
   brush textures, per-pixel CRDT merging, advanced pressure/tilt, and fully
   draggable *multi-segment* Bézier paths are not implemented.
4. The pixel eraser clears pixels only within its **active raster layer**.
   Use the original object eraser for notes, vector paths and stickers.
5. The stroke is previewed while dragging and committed at pointer release.
   On slow hardware, the PNG encoding at completion may pause briefly.

## How to test locally

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

In a room:

1. Add a paint layer and draw a red stroke. Draw another color over it.
2. Use X to erase a small portion **of the stroke**, not the entire layer.
3. Use F to color-fill a bounded region; change the paint color and opacity.
4. Add a second layer, set Multiply, draw and confirm overlapping colors.
5. Hide/show and rename layers; save, reload, and verify the same pixels.
6. Export PNG and editable JSON, then import JSON into a new local room.
7. Create a Bézier, select it, drag its control handle, and close/fill it.
8. In **two browsers** connected via Redis/Supabase, edit distinct layers and
   verify both survive; then edit the same layer in Protected mode and verify
   the collision warning and local recovery behavior.
9. Test with mobile/touch and, if possible, a pressure-capable tablet.

**Verification in the authoring environment:** Node unit tests and TypeScript
syntax parsing passed; CSS, SVG and archive integrity checks also run. The
full Next.js typecheck/build and live two-browser test are **not verified**
because npm registry access was unavailable in the authoring container.
