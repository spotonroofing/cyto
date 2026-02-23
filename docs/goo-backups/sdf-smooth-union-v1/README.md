# SDF Smooth-Union Goo Renderer (v1)

Single fullscreen fragment shader evaluating per-pixel SDF circles (cells) and capsules (connections).
Uses smin polynomial blend (cubic smooth minimum) for organic membrane merging.
No FBOs or multi-pass rendering — one draw call covers the entire viewport.
Distance-weighted color blending produces natural gradients at cell junctions.
Premultiplied alpha output composited over the page background.
Inherently DPR-correct: screen-to-world transform uses devicePixelRatio uniform.
Nucleus layer rendered as separate sharp SDF circles with harmonic wobble deformation.
Tuning parameters (sminK, tube ratios, animation speeds) driven by Zustand tuningStore.
Early bounding-box discard skips pixels far from any cell or connection.

THIS IS THE LOCKED WORKING VERSION. DO NOT MODIFY THESE BACKUP FILES.
