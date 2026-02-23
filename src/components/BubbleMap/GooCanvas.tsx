import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'
import { Q, IS_MOBILE, mobileIdle } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'
import { useTuningStore } from '@/stores/tuningStore'
import {
  precomputeConnections, hexToVec3,
  type ConnectionData, type BlobData,
} from './gooMath'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

// ── Shader sources ──────────────────────────────────────────────

const SDF_VERT = `#version 300 es
void main() {
  // Fullscreen triangle from gl_VertexID — no vertex buffer needed
  float x = float((gl_VertexID << 1) & 2);
  float y = float(gl_VertexID & 2);
  gl_Position = vec4(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
}
`

const SDF_FRAG = `#version 300 es
precision highp float;
precision highp int;

#define MAX_CELLS 12
#define MAX_CONNS 16

uniform vec2  u_resolution;   // CSS pixel dimensions
uniform float u_dpr;           // device pixel ratio
uniform vec3  u_camera;        // (panX, panY, scale)
uniform float u_time;
uniform float u_sminK;         // membrane merge radius (world px)
uniform float u_gooOpacity;
uniform float u_nucleusOpacity;
uniform float u_wobbleIntensity;

// Breathing / deformation speeds & amplitudes
uniform float u_breatheSpeed;
uniform float u_breatheAmp;
uniform float u_deformASpeed;
uniform float u_deformAAmp;
uniform float u_deformBSpeed;
uniform float u_deformBAmp;

// Tube geometry
uniform float u_tubeWidthRatio;
uniform float u_filletWidthRatio;

// Cell data
uniform vec4 u_cells[MAX_CELLS];       // xy=pos, z=membraneRadius, w=phaseIndex
uniform vec4 u_cellColors[MAX_CELLS];  // rgb + unused
uniform int  u_numCells;

// Connection data (packed as pairs of vec4)
uniform vec4 u_conns[MAX_CONNS * 2];   // [i*2]: srcXY, dstXY; [i*2+1]: srcR, dstR, srcColorIdx, dstColorIdx
uniform int  u_numConns;

// Nucleus harmonic data (packed as pairs of vec4)
uniform vec4 u_nucHarm[MAX_CELLS * 2]; // [i*2]: breatheOff, amp2, amp3, amp5; [i*2+1]: phase2, phase3, phase5, nucR

out vec4 fragColor;

float smin(float a, float b, float k) {
  if (k < 0.001) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

void main() {
  // Screen → world
  vec2 sp = gl_FragCoord.xy / u_dpr;
  sp.y = u_resolution.y - sp.y;
  vec2 wp = (sp - u_camera.xy) / u_camera.z;

  float aaW = 1.5 / u_camera.z;

  // ── Early termination: bounding box check ──
  float minBoxDist = 9999.0;
  for (int i = 0; i < MAX_CELLS; i++) {
    if (i >= u_numCells) break;
    vec2 center = u_cells[i].xy;
    float r = u_cells[i].z * 1.2 + u_sminK + 20.0;
    vec2 d = abs(wp - center) - vec2(r);
    minBoxDist = min(minBoxDist, max(d.x, d.y));
  }
  for (int i = 0; i < MAX_CONNS; i++) {
    if (i >= u_numConns) break;
    vec4 c0 = u_conns[i * 2];
    vec2 lo = min(c0.xy, c0.zw) - vec2(u_sminK + 60.0);
    vec2 hi = max(c0.xy, c0.zw) + vec2(u_sminK + 60.0);
    vec2 d = max(lo - wp, wp - hi);
    minBoxDist = min(minBoxDist, max(d.x, d.y));
  }
  if (minBoxDist > 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  // ── Membrane layer ──
  float memDist = 9999.0;
  vec3  memColor = vec3(0.0);
  float memWeightSum = 0.0;
  float blendK = max(u_sminK * 2.0, 20.0);

  // Cells
  for (int i = 0; i < MAX_CELLS; i++) {
    if (i >= u_numCells) break;
    vec2  center = u_cells[i].xy;
    float baseR  = u_cells[i].z;
    float pi     = u_cells[i].w; // phaseIndex as seed
    vec3  color  = u_cellColors[i].rgb;

    // Per-cell animated radius offset (deterministic from cell index + phaseIndex)
    float breathe = sin(u_time * u_breatheSpeed + pi * 0.9 + float(i) * 0.5) * u_breatheAmp;
    float deformA = sin(u_time * u_deformASpeed + float(i) * 2.1 + pi) * u_deformAAmp;
    float deformB = sin(u_time * u_deformBSpeed + float(i) * 3.7 + pi * 0.6) * u_deformBAmp;
    float r = baseR + (breathe + deformA + deformB) * u_wobbleIntensity;

    float d = length(wp - center) - r;

    // Distance-weighted color blending
    float w = max(0.0, 1.0 - d / blendK);
    w *= w;
    memColor += color * w;
    memWeightSum += w;

    memDist = smin(memDist, d, u_sminK);
  }

  // Connections
  for (int i = 0; i < MAX_CONNS; i++) {
    if (i >= u_numConns) break;
    vec4 c0 = u_conns[i * 2];
    vec4 c1 = u_conns[i * 2 + 1];

    vec2  a    = c0.xy;
    vec2  b    = c0.zw;
    float srcR = c1.x;
    float dstR = c1.y;
    int   srcCI = int(c1.z);
    int   dstCI = int(c1.w);

    vec3 srcColor = u_cellColors[srcCI].rgb;
    vec3 dstColor = u_cellColors[dstCI].rgb;

    // sdSegment with tapered radius (capsule)
    vec2  pa = wp - a;
    vec2  ba = b - a;
    float baDot = dot(ba, ba);
    float h = clamp(dot(pa, ba) / baDot, 0.0, 1.0);

    float smallerR = min(srcR, dstR);
    float tubeR    = smallerR * u_tubeWidthRatio;
    float filletR  = tubeR * u_filletWidthRatio;

    // Tapered profile: wider at endpoints (filletR), narrower in middle (tubeR)
    float radius;
    if (h < 0.3) {
      radius = mix(filletR, tubeR, smoothstep(0.0, 0.3, h));
    } else if (h > 0.7) {
      radius = mix(tubeR, filletR, smoothstep(0.7, 1.0, h));
    } else {
      radius = tubeR;
    }

    float d = length(pa - ba * h) - radius;

    // Connection color: interpolate along segment
    vec3 connColor = mix(srcColor, dstColor, h);

    // Distance-weighted color blending
    float w = max(0.0, 1.0 - d / blendK);
    w *= w;
    memColor += connColor * w;
    memWeightSum += w;

    memDist = smin(memDist, d, u_sminK);
  }

  memColor /= max(memWeightSum, 0.001);
  float memAlpha = smoothstep(-aaW, aaW, -memDist) * u_gooOpacity;

  // ── Nucleus layer (sharp circles, no smin) ──
  float nucDist = 9999.0;
  vec3  nucColor = vec3(0.0);

  for (int i = 0; i < MAX_CELLS; i++) {
    if (i >= u_numCells) break;
    vec2 center = u_cells[i].xy;
    vec4 h0 = u_nucHarm[i * 2];       // breatheOff, amp2, amp3, amp5
    vec4 h1 = u_nucHarm[i * 2 + 1];   // phase2, phase3, phase5, nucR

    float nucR = h1.w;
    if (nucR < 0.5) continue;

    float angle = atan(wp.y - center.y, wp.x - center.x);

    // Angle-dependent harmonic deformation
    float r = nucR * (1.0 + h0.x);  // breathing
    r += h0.y * sin(2.0 * angle + h1.x) * nucR;
    r += h0.z * sin(3.0 * angle + h1.y) * nucR;
    r += h0.w * sin(5.0 * angle + h1.z) * nucR;
    r = clamp(r, nucR * 0.6, nucR * 1.25);

    float d = length(wp - center) - r;

    if (d < nucDist) {
      nucDist = d;
      nucColor = u_cellColors[i].rgb;
    }
  }

  float nucAlpha = smoothstep(-aaW, aaW, -nucDist) * u_nucleusOpacity;

  // ── Alpha-over composite ──
  float outA = nucAlpha + memAlpha * (1.0 - nucAlpha);
  vec3  outC = outA > 0.001
    ? (nucColor * nucAlpha + memColor * memAlpha * (1.0 - nucAlpha)) / outA
    : vec3(0.0);

  // Premultiplied alpha output
  fragColor = vec4(outC * outA, outA);
}
`

// ── WebGL helpers ────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[GooSDF] Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vert || !frag) return null
  const prog = gl.createProgram()!
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[GooSDF] Program link error:', gl.getProgramInfoLog(prog))
    return null
  }
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  return prog
}

// ── Props ────────────────────────────────────────────────────────

interface GooCanvasProps {
  width: number
  height: number
  bubbles: LayoutBubble[]
  links: LayoutLink[]
  transform: { x: number; y: number; scale: number }
}

// ── Constants ────────────────────────────────────────────────────

const MAX_CELLS = 12
const MAX_CONNS = 16

// ── Component ────────────────────────────────────────────────────

export function GooCanvas({ width, height, bubbles, links, transform }: GooCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const transformRef = useRef(transform)
  const connectionsRef = useRef<ConnectionData[]>([])
  const blobsRef = useRef<BlobData[]>([])
  const failedRef = useRef(false)
  const { phaseColor, palette } = useTheme()
  const paletteRef = useRef(palette)

  // Eliminate 1-frame lag between SVG overlay and canvas during panning
  transformRef.current = transform
  useEffect(() => { paletteRef.current = palette }, [palette])

  // Precompute layout data
  useEffect(() => {
    connectionsRef.current = precomputeConnections(links, phaseColor)
    blobsRef.current = bubbles.map((b) => ({
      x: b.x, y: b.y, radius: b.radius,
      color: phaseColor(b.phaseIndex),
      phaseIndex: b.phaseIndex,
      breathePhase: b.phaseIndex * 0.9 + Math.random() * 0.5,
      wobblePhase: Math.random() * Math.PI * 2,
      deformFreq: 2 + Math.random(),
      nucleusBreathePhase: Math.random() * Math.PI * 2,
      nucleusHarmonics: Array.from({ length: 5 }, () => 1.5 + Math.random() * 4),
      nucleusPhases: Array.from({ length: 5 }, () => Math.random() * Math.PI * 2),
      nucleusRotSpeed: 0.08 + Math.random() * 0.12,
    }))
  }, [links, bubbles, palette])

  // WebGL setup + animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || failedRef.current) return

    // Use prop values directly — they match the SVG's width/height attributes.
    // canvas.clientWidth/clientHeight is unreliable (depends on layout timing,
    // can return viewport size instead of content size on mobile).
    const cssW = width
    const cssH = height
    if (cssW === 0 || cssH === 0) return

    // ── Context ──
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      console.warn('[GooSDF] WebGL2 unavailable — goo effects disabled')
      failedRef.current = true
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, Q.canvasDpr)
    const pxW = Math.round(cssW * dpr)
    const pxH = Math.round(cssH * dpr)
    canvas.width = pxW
    canvas.height = pxH

    // ── Single SDF program ──
    const prog = createProgram(gl, SDF_VERT, SDF_FRAG)
    if (!prog) {
      console.warn('[GooSDF] Shader compilation failed — goo effects disabled')
      failedRef.current = true
      return
    }

    // ── Empty VAO (WebGL2 requires a bound VAO) ──
    const vao = gl.createVertexArray()!

    // ── Uniform locations ──
    const loc = {
      resolution: gl.getUniformLocation(prog, 'u_resolution'),
      dpr: gl.getUniformLocation(prog, 'u_dpr'),
      camera: gl.getUniformLocation(prog, 'u_camera'),
      time: gl.getUniformLocation(prog, 'u_time'),
      sminK: gl.getUniformLocation(prog, 'u_sminK'),
      gooOpacity: gl.getUniformLocation(prog, 'u_gooOpacity'),
      nucleusOpacity: gl.getUniformLocation(prog, 'u_nucleusOpacity'),
      wobbleIntensity: gl.getUniformLocation(prog, 'u_wobbleIntensity'),
      breatheSpeed: gl.getUniformLocation(prog, 'u_breatheSpeed'),
      breatheAmp: gl.getUniformLocation(prog, 'u_breatheAmp'),
      deformASpeed: gl.getUniformLocation(prog, 'u_deformASpeed'),
      deformAAmp: gl.getUniformLocation(prog, 'u_deformAAmp'),
      deformBSpeed: gl.getUniformLocation(prog, 'u_deformBSpeed'),
      deformBAmp: gl.getUniformLocation(prog, 'u_deformBAmp'),
      tubeWidthRatio: gl.getUniformLocation(prog, 'u_tubeWidthRatio'),
      filletWidthRatio: gl.getUniformLocation(prog, 'u_filletWidthRatio'),
      cells: gl.getUniformLocation(prog, 'u_cells'),
      cellColors: gl.getUniformLocation(prog, 'u_cellColors'),
      numCells: gl.getUniformLocation(prog, 'u_numCells'),
      conns: gl.getUniformLocation(prog, 'u_conns'),
      numConns: gl.getUniformLocation(prog, 'u_numConns'),
      nucHarm: gl.getUniformLocation(prog, 'u_nucHarm'),
    }

    // ── Preallocate uniform arrays ──
    const cellData = new Float32Array(MAX_CELLS * 4)
    const cellColorData = new Float32Array(MAX_CELLS * 4)
    const connData = new Float32Array(MAX_CONNS * 2 * 4)
    const nucHarmData = new Float32Array(MAX_CELLS * 2 * 4)

    // ── First-frame logging flag ──
    let hasLogged = false

    // ── Animation state ──
    let time = 0
    let lastFrameTime = 0
    const TARGET_DT = Q.gooTargetDt
    const IDLE_DT = Q.gooIdleDt
    const IDLE_THRESHOLD = 2000
    let lastKnownTf = { x: 0, y: 0, scale: 0 }
    let lastTransformChangeTime = performance.now()

    const draw = (timestamp: number) => {
      const dbg = useDebugStore.getState()
      const tf = transformRef.current

      // Idle detection
      if (tf.x !== lastKnownTf.x || tf.y !== lastKnownTf.y || tf.scale !== lastKnownTf.scale) {
        lastKnownTf = { x: tf.x, y: tf.y, scale: tf.scale }
        lastTransformChangeTime = timestamp
      }
      const isIdle = (timestamp - lastTransformChangeTime) > IDLE_THRESHOLD

      if (IS_MOBILE) mobileIdle.active = isIdle

      // FPS cap
      const effectiveDT = dbg.fpsCap > 0 ? 1000 / dbg.fpsCap : (isIdle ? IDLE_DT : TARGET_DT)
      if (timestamp - lastFrameTime < effectiveDT * 0.8) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      const prevFrame = lastFrameTime
      lastFrameTime = timestamp
      time += prevFrame > 0 ? Math.min((timestamp - prevFrame) / 1000, 0.1) : 0.016

      const pal = paletteRef.current
      const connections = connectionsRef.current
      const blobs = blobsRef.current
      const wobbleI = dbg.gooWobble ? dbg.gooWobbleIntensity : 0
      const tuning = useTuningStore.getState()
      const sminK = dbg.gooFilter ? tuning.sminK * dbg.filterBlurRadius : 0

      // ── Pack cell uniforms ──
      const numCells = Math.min(blobs.length, MAX_CELLS)

      // Build cell index map for connection color lookups
      const cellIndexMap = new Map<string, number>()

      for (let i = 0; i < numCells; i++) {
        const blob = blobs[i]!
        const off = i * 4
        cellData[off] = blob.x
        cellData[off + 1] = blob.y
        cellData[off + 2] = blob.radius * tuning.membraneRadiusScale
        cellData[off + 3] = blob.phaseIndex

        const [r, g, b] = hexToVec3(blob.color)
        cellColorData[off] = r
        cellColorData[off + 1] = g
        cellColorData[off + 2] = b
        cellColorData[off + 3] = 0

        cellIndexMap.set(`${blob.x},${blob.y}`, i)
      }

      // ── Pack connection uniforms ──
      const numConns = Math.min(connections.length, MAX_CONNS)
      for (let i = 0; i < numConns; i++) {
        const conn = connections[i]!
        const off = i * 8 // 2 vec4s per connection

        // First vec4: srcXY, dstXY
        connData[off] = conn.sx
        connData[off + 1] = conn.sy
        connData[off + 2] = conn.tx
        connData[off + 3] = conn.ty

        // Second vec4: srcR, dstR, srcColorIdx, dstColorIdx
        connData[off + 4] = conn.sr
        connData[off + 5] = conn.tr
        connData[off + 6] = cellIndexMap.get(`${conn.sx},${conn.sy}`) ?? 0
        connData[off + 7] = cellIndexMap.get(`${conn.tx},${conn.ty}`) ?? 0
      }

      // ── Pack nucleus harmonic uniforms ──
      for (let i = 0; i < numCells; i++) {
        const blob = blobs[i]!
        const pHash = blob.breathePhase * 2.7 + blob.phaseIndex * 1.3
        const nucleusR = blob.radius * tuning.nucleusRatioSvg
        const off = i * 8 // 2 vec4s per cell

        const breatheOffset = dbg.nucleusWobble
          ? Math.sin(time * tuning.svgNucleusBreatheSpeed + pHash * 2) * tuning.svgNucleusBreatheAmp
          : 0

        const amp2 = dbg.nucleusWobble ? tuning.svgNucleus2LobeAmp : 0
        const amp3 = dbg.nucleusWobble ? tuning.svgNucleus3LobeAmp : 0
        const amp5 = dbg.nucleusWobble ? tuning.svgNucleus5LobeAmp : 0
        const phase2 = time * tuning.svgNucleus2LobeSpeed + pHash
        const phase3 = time * tuning.svgNucleus3LobeSpeed + pHash * 1.3
        const phase5 = -time * tuning.svgNucleus5LobeSpeed + pHash * 0.7

        // First vec4: breatheOff, amp2, amp3, amp5
        nucHarmData[off] = breatheOffset
        nucHarmData[off + 1] = amp2
        nucHarmData[off + 2] = amp3
        nucHarmData[off + 3] = amp5

        // Second vec4: phase2, phase3, phase5, nucR
        nucHarmData[off + 4] = phase2
        nucHarmData[off + 5] = phase3
        nucHarmData[off + 6] = phase5
        nucHarmData[off + 7] = nucleusR
      }

      // ── Render ──
      gl.viewport(0, 0, pxW, pxH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // premultiplied alpha

      gl.useProgram(prog)
      gl.bindVertexArray(vao)

      // Global uniforms
      gl.uniform2f(loc.resolution, cssW, cssH)
      gl.uniform1f(loc.dpr, dpr)
      gl.uniform3f(loc.camera, tf.x, tf.y, tf.scale)
      gl.uniform1f(loc.time, time)
      gl.uniform1f(loc.sminK, sminK)
      gl.uniform1f(loc.gooOpacity, pal.goo)
      gl.uniform1f(loc.nucleusOpacity, tuning.nucleusOpacity)
      gl.uniform1f(loc.wobbleIntensity, wobbleI)
      gl.uniform1f(loc.breatheSpeed, tuning.membraneBreatheSpeed)
      gl.uniform1f(loc.breatheAmp, tuning.membraneBreatheAmp)
      gl.uniform1f(loc.deformASpeed, tuning.membraneDeformASpeed)
      gl.uniform1f(loc.deformAAmp, tuning.membraneDeformAAmp)
      gl.uniform1f(loc.deformBSpeed, tuning.membraneDeformBSpeed)
      gl.uniform1f(loc.deformBAmp, tuning.membraneDeformBAmp)
      gl.uniform1f(loc.tubeWidthRatio, tuning.tubeWidthRatio)
      gl.uniform1f(loc.filletWidthRatio, tuning.filletWidthRatio)

      // Per-cell data
      gl.uniform4fv(loc.cells, cellData)
      gl.uniform4fv(loc.cellColors, cellColorData)
      gl.uniform1i(loc.numCells, numCells)

      // Per-connection data
      gl.uniform4fv(loc.conns, connData)
      gl.uniform1i(loc.numConns, numConns)

      // Nucleus harmonic data
      gl.uniform4fv(loc.nucHarm, nucHarmData)

      // Single draw call: fullscreen triangle
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.bindVertexArray(null)

      // First-frame log
      if (!hasLogged) {
        hasLogged = true
        console.log(`[GooSDF] DPR: ${dpr}, canvas: ${pxW}x${pxH}, cells: ${numCells}, conns: ${numConns}`)
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(prog)
    }
  }, [width, height, bubbles, palette])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        width: width + 'px',
        height: height + 'px',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
