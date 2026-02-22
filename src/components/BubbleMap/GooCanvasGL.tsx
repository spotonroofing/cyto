import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'
import { IS_MOBILE, mobileIdle } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'
import { useTuningStore } from '@/stores/tuningStore'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

// ── Shader sources ──────────────────────────────────────────

const DENSITY_VERT = `#version 300 es
precision highp float;

// Static quad corners (shared geometry)
layout(location = 0) in vec2 a_corner;

// Per-instance attributes
layout(location = 1) in vec2 a_center;
layout(location = 2) in float a_radius;
layout(location = 3) in vec3 a_color;

uniform vec2 u_resolution;
uniform vec3 u_camera;    // translateX, translateY, scale
uniform float u_extend;   // falloff extend beyond radius (world units)

out vec2 v_uv;
out vec3 v_color;

void main() {
    float scale = u_camera.z;
    vec2 translate = u_camera.xy;

    float totalRadius = a_radius + u_extend;
    vec2 worldPos = a_center + a_corner * totalRadius;

    // World -> screen -> clip
    vec2 screenPos = worldPos * scale + translate;
    vec2 clipPos = screenPos / u_resolution * 2.0 - 1.0;
    clipPos.y = -clipPos.y;

    gl_Position = vec4(clipPos, 0.0, 1.0);
    v_uv = a_corner;
    v_color = a_color;
}
`

const DENSITY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_color;

out vec4 fragColor;

void main() {
    float dist = length(v_uv);
    if (dist > 1.0) discard;

    // Quartic falloff: 1.0 at center, 0.0 at quad edge
    float f = 1.0 - dist * dist;
    float falloff = f * f;

    // RGB = color weighted by falloff, A = raw falloff
    fragColor = vec4(v_color * falloff, falloff);
}
`

const THRESHOLD_VERT = `#version 300 es

in vec2 a_position;
out vec2 v_uv;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_position * 0.5 + 0.5;
}
`

const THRESHOLD_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_density;
uniform float u_threshold;
uniform float u_smoothWidth;

out vec4 fragColor;

void main() {
    vec4 data = texture(u_density, v_uv);
    float density = data.a;

    if (density < 0.001) discard;

    // Recover weighted-average color
    vec3 color = data.rgb / density;

    // Sharp threshold with antialiased edge
    float alpha = smoothstep(
        u_threshold - u_smoothWidth,
        u_threshold + u_smoothWidth,
        density
    );

    fragColor = vec4(color, alpha);
}
`

// ── Connection data (simplified from GooCanvas) ─────────────

interface ConnectionData {
  sx: number; sy: number; sr: number
  tx: number; ty: number; tr: number
  dx: number; dy: number; dist: number
  nx: number; ny: number
  phaseOffset: number
  flowSpeed: number
  sourceFanOut: number
  targetFanOut: number
  sourceColor: string
  targetColor: string
}

interface BlobAnimData {
  x: number; y: number; radius: number
  color: string
  breathePhase: number
}

// ── Sampling helper (same math as GooCanvas) ────────────────

function sampleConnection(
  conn: ConnectionData,
  t: number,
  time: number,
  wobbleI: number,
  tubeWidthRatio: number,
  filletRatio: number,
): { x: number; y: number; width: number } {
  const curveBow = Math.sin(t * Math.PI) * conn.dist * 0.008
  const dampEnds = Math.sin(t * Math.PI)
  const flowWave = Math.sin(time * conn.flowSpeed + t * 4 + conn.phaseOffset) * 4 * dampEnds * wobbleI

  const x = conn.sx + conn.dx * t + conn.nx * (curveBow + flowWave)
  const y = conn.sy + conn.dy * t + conn.ny * (curveBow + flowWave)

  const smallerR = Math.min(conn.sr, conn.tr)
  const tubeWidth = smallerR * tubeWidthRatio
  const tSE = conn.sr / conn.dist
  const tTE = 1 - conn.tr / conn.dist
  const filletWidth = tubeWidth * filletRatio
  const nearFan = t < 0.5 ? (conn.sourceFanOut || 1) : (conn.targetFanOut || 1)
  const fanScale = nearFan > 2 ? 0.78 : 1.0

  let width: number
  if (tSE >= tTE) {
    width = filletWidth * Math.sin(t * Math.PI) * fanScale
  } else if (t <= tSE) {
    const u = tSE > 0.001 ? t / tSE : 1
    width = filletWidth * u * u * (3 - 2 * u) * fanScale
  } else if (t >= tTE) {
    const span = 1 - tTE
    const u = span > 0.001 ? (1 - t) / span : 1
    width = filletWidth * u * u * (3 - 2 * u) * fanScale
  } else {
    const gap = tTE - tSE
    const g = (t - tSE) / gap
    const edgeDist = Math.min(g, 1 - g)
    const transZone = 0.3
    const fade = Math.min(edgeDist / transZone, 1)
    const eased = 0.5 * (1 - Math.cos(Math.PI * fade))
    width = (filletWidth + (tubeWidth - filletWidth) * eased) * fanScale
  }

  return { x, y, width }
}

// ── Hex color parsing ───────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

// ── WebGL helpers ───────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog)
    gl.deleteProgram(prog)
    throw new Error(`Program link error: ${info}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return prog
}

// ── Constants ───────────────────────────────────────────────

const BRIDGE_SAMPLES = 12       // samples per connection
const MAX_BLOBS = 200           // max blobs (milestones + bridge)
const FLOATS_PER_BLOB = 6       // x, y, radius, r, g, b
const DENSITY_SCALE = 0.5       // FBO at half resolution
const TARGET_DT = 1000 / 60
const IDLE_DT = 1000 / 60
const IDLE_THRESHOLD = 2000     // ms before idle

// ── Component ───────────────────────────────────────────────

interface GooCanvasGLProps {
  width: number
  height: number
  bubbles: LayoutBubble[]
  links: LayoutLink[]
  transform: { x: number; y: number; scale: number }
  onFallback?: () => void
}

export function GooCanvasGL({ width, height, bubbles, links, transform, onFallback }: GooCanvasGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transformRef = useRef(transform)
  const connectionsRef = useRef<ConnectionData[]>([])
  const blobAnimRef = useRef<BlobAnimData[]>([])
  const animFrameRef = useRef(0)
  const { phaseColor, palette } = useTheme()
  const paletteRef = useRef(palette)

  // Keep refs in sync without restarting animation loop
  transformRef.current = transform
  useEffect(() => { paletteRef.current = palette }, [palette])

  // Precompute connection data when layout changes
  useEffect(() => {
    const conns: ConnectionData[] = []
    for (const link of links) {
      const sx = link.source.x, sy = link.source.y, sr = link.source.radius
      const tx = link.target.x, ty = link.target.y, tr = link.target.radius
      const dx = tx - sx, dy = ty - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue

      const uy = dy / dist
      const ux = dx / dist

      conns.push({
        sx, sy, sr, tx, ty, tr,
        dx, dy, dist,
        nx: -uy, ny: ux,
        phaseOffset: Math.random() * Math.PI * 2,
        flowSpeed: 0.4 + Math.random() * 0.3,
        sourceFanOut: 1,
        targetFanOut: 1,
        sourceColor: phaseColor(link.sourcePhaseIndex),
        targetColor: phaseColor(link.targetPhaseIndex),
      })
    }

    // Count fan-out per endpoint
    const endpointCount = new Map<string, number>()
    for (const conn of conns) {
      const sKey = `${conn.sx},${conn.sy}`
      const tKey = `${conn.tx},${conn.ty}`
      endpointCount.set(sKey, (endpointCount.get(sKey) || 0) + 1)
      endpointCount.set(tKey, (endpointCount.get(tKey) || 0) + 1)
    }
    for (const conn of conns) {
      conn.sourceFanOut = endpointCount.get(`${conn.sx},${conn.sy}`) || 1
      conn.targetFanOut = endpointCount.get(`${conn.tx},${conn.ty}`) || 1
    }
    connectionsRef.current = conns

    // Precompute blob animation data
    const blobs: BlobAnimData[] = bubbles.map((b) => ({
      x: b.x,
      y: b.y,
      radius: b.radius,
      color: phaseColor(b.phaseIndex),
      breathePhase: b.phaseIndex * 0.9 + Math.random() * 0.5,
    }))
    blobAnimRef.current = blobs
  }, [links, bubbles, palette])

  // Main WebGL setup + animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    // ── Get WebGL2 context ──
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    })

    if (!gl) {
      console.warn('[GooCanvasGL] WebGL2 unavailable, falling back to Canvas 2D')
      onFallback?.()
      return
    }

    // ── Canvas sizing (1× DPR — threshold provides edge quality) ──
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // ── Compile programs ──
    let densityProg: WebGLProgram
    let thresholdProg: WebGLProgram
    try {
      densityProg = createProgram(gl, DENSITY_VERT, DENSITY_FRAG)
      thresholdProg = createProgram(gl, THRESHOLD_VERT, THRESHOLD_FRAG)
    } catch (e) {
      console.error('[GooCanvasGL] Shader compilation failed:', e)
      onFallback?.()
      return
    }

    // ── Density program uniforms ──
    const dLoc = {
      resolution: gl.getUniformLocation(densityProg, 'u_resolution'),
      camera: gl.getUniformLocation(densityProg, 'u_camera'),
      extend: gl.getUniformLocation(densityProg, 'u_extend'),
    }

    // ── Threshold program uniforms ──
    const tLoc = {
      density: gl.getUniformLocation(thresholdProg, 'u_density'),
      threshold: gl.getUniformLocation(thresholdProg, 'u_threshold'),
      smoothWidth: gl.getUniformLocation(thresholdProg, 'u_smoothWidth'),
    }

    // ── Density FBO (half resolution, RGBA16F) ──
    const fbW = Math.ceil(width * DENSITY_SCALE)
    const fbH = Math.ceil(height * DENSITY_SCALE)
    const densityTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, densityTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, fbW, fbH, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, densityTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // ── Quad geometry (shared by density instances) ──
    // TRIANGLE_STRIP: 4 vertices for a quad
    const quadVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ])
    const quadVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

    // ── Instance buffer ──
    const instanceData = new Float32Array(MAX_BLOBS * FLOATS_PER_BLOB)
    const instanceVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO)
    gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW)

    // ── Density VAO ──
    const densityVAO = gl.createVertexArray()!
    gl.bindVertexArray(densityVAO)

    // a_corner (location 0) — static quad
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // Per-instance attributes from instanceVBO
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO)
    const stride = FLOATS_PER_BLOB * 4 // 24 bytes

    // a_center (location 1) — vec2
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0)
    gl.vertexAttribDivisor(1, 1)

    // a_radius (location 2) — float
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 8)
    gl.vertexAttribDivisor(2, 1)

    // a_color (location 3) — vec3
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 12)
    gl.vertexAttribDivisor(3, 1)

    gl.bindVertexArray(null)

    // ── Full-screen quad for threshold pass ──
    const fsQuadVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ])
    const fsQuadVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, fsQuadVBO)
    gl.bufferData(gl.ARRAY_BUFFER, fsQuadVerts, gl.STATIC_DRAW)

    const thresholdVAO = gl.createVertexArray()!
    gl.bindVertexArray(thresholdVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, fsQuadVBO)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // ── First-frame diagnostics flag ──
    let hasLogged = false

    // ── Animation state ──
    let time = 0
    let lastFrameTime = 0
    let lastKnownTf = { x: 0, y: 0, scale: 0 }
    let lastTransformChangeTime = performance.now()

    const draw = (timestamp: number) => {
      const dbg = useDebugStore.getState()

      // Track transform changes for idle detection
      const tf = transformRef.current
      if (tf.x !== lastKnownTf.x || tf.y !== lastKnownTf.y || tf.scale !== lastKnownTf.scale) {
        lastKnownTf = { x: tf.x, y: tf.y, scale: tf.scale }
        lastTransformChangeTime = timestamp
      }

      const isIdle = (timestamp - lastTransformChangeTime) > IDLE_THRESHOLD

      // Mobile idle freeze — skip drawing entirely
      if (IS_MOBILE && isIdle) {
        mobileIdle.active = true
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      if (IS_MOBILE) {
        mobileIdle.active = false
      }

      // FPS cap
      const effectiveDT = dbg.fpsCap > 0
        ? 1000 / dbg.fpsCap
        : (isIdle ? IDLE_DT : TARGET_DT)

      if (timestamp - lastFrameTime < effectiveDT * 0.8) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      const prevFrame = lastFrameTime
      lastFrameTime = timestamp
      time += prevFrame > 0 ? Math.min((timestamp - prevFrame) / 1000, 0.1) : 0.016

      const connections = connectionsRef.current
      const blobs = blobAnimRef.current
      const wobbleI = dbg.gooWobble ? dbg.gooWobbleIntensity : 0
      const tuning = useTuningStore.getState()

      // ── Build instance buffer ──
      let blobCount = 0
      let offset = 0

      // Milestone blobs (breathing animation)
      for (const blob of blobs) {
        if (blobCount >= MAX_BLOBS) break
        const breathe = Math.sin(time * tuning.membraneBreatheSpeed + blob.breathePhase)
          * tuning.membraneBreatheAmp * wobbleI
        const animatedRadius = blob.radius + breathe

        const [r, g, b] = hexToRgb(blob.color)
        instanceData[offset++] = blob.x
        instanceData[offset++] = blob.y
        instanceData[offset++] = Math.max(1, animatedRadius)
        instanceData[offset++] = r
        instanceData[offset++] = g
        instanceData[offset++] = b
        blobCount++
      }

      // Bridge blobs from connections
      for (const conn of connections) {
        for (let i = 0; i <= BRIDGE_SAMPLES; i++) {
          if (blobCount >= MAX_BLOBS) break
          const t = i / BRIDGE_SAMPLES
          const sample = sampleConnection(conn, t, time, wobbleI,
            tuning.tubeWidthRatio, tuning.filletWidthRatio)

          // Bridge blob radius — wider than connection width for density overlap
          const bridgeR = sample.width * 1.8
          if (bridgeR < 0.5) continue // skip zero-width samples

          // Interpolate color from source to target
          const [sr, sg, sb] = hexToRgb(conn.sourceColor)
          const [tr, tg, tb] = hexToRgb(conn.targetColor)
          const cr = sr + (tr - sr) * t
          const cg = sg + (tg - sg) * t
          const cb = sb + (tb - sb) * t

          instanceData[offset++] = sample.x
          instanceData[offset++] = sample.y
          instanceData[offset++] = bridgeR
          instanceData[offset++] = cr
          instanceData[offset++] = cg
          instanceData[offset++] = cb
          blobCount++
        }
      }

      if (blobCount === 0) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }

      // Upload instance data
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData, 0, blobCount * FLOATS_PER_BLOB)

      // ── Tuning → WebGL uniforms ──
      const extend = tuning.blurStdDev * 2.0 * dbg.filterBlurRadius
      const threshold = tuning.gooContrast > 0
        ? -tuning.gooThreshold / tuning.gooContrast
        : 0.364
      const smoothWidth = tuning.gooContrast > 0
        ? 1.0 / tuning.gooContrast
        : 0.045

      // ── PASS 1: Density field → FBO ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, fbW, fbH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE) // additive

      gl.useProgram(densityProg)
      gl.uniform2f(dLoc.resolution, fbW, fbH)
      gl.uniform3f(dLoc.camera,
        tf.x * DENSITY_SCALE,
        tf.y * DENSITY_SCALE,
        tf.scale)
      gl.uniform1f(dLoc.extend, extend)

      gl.bindVertexArray(densityVAO)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, blobCount)
      gl.bindVertexArray(null)

      // ── PASS 2: Threshold → screen ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) // standard alpha

      gl.useProgram(thresholdProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, densityTex)
      gl.uniform1i(tLoc.density, 0)
      gl.uniform1f(tLoc.threshold, dbg.gooFilter ? threshold : 0.01)
      gl.uniform1f(tLoc.smoothWidth, dbg.gooFilter ? smoothWidth : 0.5)

      gl.bindVertexArray(thresholdVAO)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.bindVertexArray(null)

      gl.disable(gl.BLEND)

      // ── First-frame diagnostics ──
      if (!hasLogged) {
        hasLogged = true
        console.log(
          `[GooCanvasGL] density FBO: ${fbW}×${fbH}, ` +
          `canvas: ${width}×${height}, ` +
          `blobs: ${blobCount} (instanced), ` +
          `draw calls: 2 (density + threshold)`
        )
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      // Cleanup WebGL resources
      gl.deleteBuffer(quadVBO)
      gl.deleteBuffer(instanceVBO)
      gl.deleteBuffer(fsQuadVBO)
      gl.deleteVertexArray(densityVAO)
      gl.deleteVertexArray(thresholdVAO)
      gl.deleteTexture(densityTex)
      gl.deleteFramebuffer(fbo)
      gl.deleteProgram(densityProg)
      gl.deleteProgram(thresholdProg)
    }
  }, [width, height, bubbles, palette, onFallback])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: 'none',
        opacity: palette.goo,
        willChange: 'auto',
      }}
    />
  )
}
