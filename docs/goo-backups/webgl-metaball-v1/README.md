# WebGL 2-Pass Metaball Renderer (v1)

Backup of the unified WebGL2 goo renderer as of 2026-02-23.
Introduced at commit `cc318f2` replacing all SVG filter pipelines.

## How It Works

1. **Density field approach:** Each blob (membrane, bridge sample, nucleus) is an
   instanced quad emitting a radial density falloff: `f = (1 - dist^2)^2`.
   Color is pre-multiplied by density so blending preserves hue gradients.

2. **Pass 1 — Goo density FBO:** All membrane blobs + bridge sample blobs are
   drawn with additive blending (`gl.ONE, gl.ONE`) into a half-res RGBA16F
   framebuffer. Overlapping densities sum, creating implicit metaball fusion.

3. **Pass 2 — Nucleus density FBO:** Nucleus blobs (with harmonic deformation
   in the fragment shader for organic wobble) are drawn into a second RGBA16F FBO.

4. **Pass 3 — Composite:** A fullscreen quad reads both FBO textures. Each is
   thresholded via `smoothstep(threshold - smooth, threshold + smooth, density)`
   to produce a crisp alpha. Nucleus composites over goo with standard alpha blend.
   `fwidth()` on density provides adaptive anti-aliasing at blob edges.

5. **DPR handling:** Canvas backing pixels = CSS size * min(devicePixelRatio, 2).
   FBOs render at 50% of backing resolution (`FBO_SCALE = 0.5`), then the
   composite pass upsamples with `LINEAR` filtering to full resolution.

6. **Performance:** 3 draw calls/frame total (vs 27+ GPU filter passes in the
   old SVG approach). Idle detection throttles rAF. Mobile uses identical quality
   settings for visual parity. All tuning params driven by `tuningStore`.
