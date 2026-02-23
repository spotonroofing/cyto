import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'
import { Q, IS_MOBILE, mobileIdle } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'
import { useTuningStore } from '@/stores/tuningStore'
import {
  precomputeConnections, sampleConnection, hexToVec3, blendVec3,
  type ConnectionData, type BlobData,
} from './gooMath'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

// ── Shader sources (inline GLSL) ────────────────────────────────

const GOO_DENSITY_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_center;
layout(location = 2) in float a_radius;
layout(location = 3) in vec3 a_color;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_radiusScale;
out vec2 v_localPos;
out vec3 v_color;
void main() {
  float totalR = a_radius * u_radiusScale;
  vec2 worldPos = a_center + a_corner * totalR;
  vec2 screen = worldPos * u_camera.z + u_camera.xy;
  vec2 clip = screen / u_resolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_localPos = a_corner;
  v_color = a_color;
}
`

const GOO_DENSITY_FRAG = `#version 300 es
precision highp float;
in vec2 v_localPos;
in vec3 v_color;
out vec4 fragColor;
void main() {
  float dist = length(v_localPos);
  if (dist > 1.0) discard;
  float f = 1.0 - dist * dist;
  float density = f * f;
  fragColor = vec4(v_color * density, density);
}
`

const NUC_DENSITY_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_center;
layout(location = 2) in float a_radius;
layout(location = 3) in vec3 a_color;
layout(location = 4) in float a_breatheOffset;
layout(location = 5) in vec4 a_harmAmps;
layout(location = 6) in vec4 a_harmPhases;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_radiusScale;
out vec2 v_localPos;
out vec3 v_color;
out float v_breatheOffset;
out vec4 v_harmAmps;
out vec4 v_harmPhases;
void main() {
  float maxDeform = 1.25;
  float totalR = a_radius * maxDeform * u_radiusScale;
  vec2 worldPos = a_center + a_corner * totalR;
  vec2 screen = worldPos * u_camera.z + u_camera.xy;
  vec2 clip = screen / u_resolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_localPos = a_corner * maxDeform * u_radiusScale;
  v_color = a_color;
  v_breatheOffset = a_breatheOffset;
  v_harmAmps = a_harmAmps;
  v_harmPhases = a_harmPhases;
}
`

const NUC_DENSITY_FRAG = `#version 300 es
precision highp float;
in vec2 v_localPos;
in vec3 v_color;
in float v_breatheOffset;
in vec4 v_harmAmps;
in vec4 v_harmPhases;
out vec4 fragColor;
void main() {
  float angle = atan(v_localPos.y, v_localPos.x);
  float r = 1.0 + v_breatheOffset;
  r += v_harmAmps.x * sin(2.0 * angle + v_harmPhases.x);
  r += v_harmAmps.y * sin(3.0 * angle + v_harmPhases.y);
  r += v_harmAmps.z * sin(5.0 * angle + v_harmPhases.z);
  r = clamp(r, 0.6, 1.25);
  float normDist = length(v_localPos) / r;
  if (normDist > 1.0) discard;
  float f = 1.0 - normDist * normDist;
  float density = f * f;
  fragColor = vec4(v_color * density, density);
}
`

const COMPOSITE_VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_position * 0.5 + 0.5;
}
`

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_gooDensity;
uniform sampler2D u_nucDensity;
uniform float u_gooThreshold;
uniform float u_gooSmooth;
uniform float u_gooOpacity;
uniform float u_nucThreshold;
uniform float u_nucSmooth;
uniform float u_nucOpacity;
out vec4 fragColor;
void main() {
  vec4 goo = texture(u_gooDensity, v_uv);
  vec3 gooColor = goo.a > 0.001 ? goo.rgb / goo.a : vec3(0.0);
  float gooAlpha = smoothstep(u_gooThreshold - u_gooSmooth, u_gooThreshold + u_gooSmooth, goo.a) * u_gooOpacity;

  vec4 nuc = texture(u_nucDensity, v_uv);
  vec3 nucColor = nuc.a > 0.001 ? nuc.rgb / nuc.a : vec3(0.0);
  float nucAlpha = smoothstep(u_nucThreshold - u_nucSmooth, u_nucThreshold + u_nucSmooth, nuc.a) * u_nucOpacity;

  float outA = nucAlpha + gooAlpha * (1.0 - nucAlpha);
  vec3 outC = outA > 0.001
    ? (nucColor * nucAlpha + gooColor * gooAlpha * (1.0 - nucAlpha)) / outA
    : vec3(0.0);
  if (outA < 0.004) discard;
  fragColor = vec4(outC, outA);
}
`

// ── WebGL helpers ────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[GooGL] Shader compile error:', gl.getShaderInfoLog(shader))
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
    console.error('[GooGL] Program link error:', gl.getProgramInfoLog(prog))
    return null
  }
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  return prog
}

function createFBO(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('[GooGL] FBO incomplete:', status)
    return null
  }
  return { fbo, tex, w, h }
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

const GOO_FLOATS_PER = 6    // center.xy, radius, color.rgb
const GOO_MAX = 400
const NUC_FLOATS_PER = 14   // center.xy, radius, color.rgb, breatheOffset, harmAmps.xyzw, harmPhases.xyz(+pad)
const NUC_MAX = 16
const BRIDGE_SAMPLES = 25
const BRIDGE_RADIUS_MULT = 1.8
const FBO_SCALE = 0.5

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
    if (!canvas || width === 0 || height === 0 || failedRef.current) return

    // ── Context ──
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      console.warn('[GooGL] WebGL2 unavailable — goo effects disabled')
      failedRef.current = true
      return
    }

    // Check RGBA16F support (WebGL2 spec guarantees it but be defensive)
    gl.getExtension('EXT_color_buffer_half_float')
    gl.getExtension('EXT_color_buffer_float')

    canvas.width = width
    canvas.height = height

    // ── Programs ──
    const gooProg = createProgram(gl, GOO_DENSITY_VERT, GOO_DENSITY_FRAG)
    const nucProg = createProgram(gl, NUC_DENSITY_VERT, NUC_DENSITY_FRAG)
    const compProg = createProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG)
    if (!gooProg || !nucProg || !compProg) {
      console.warn('[GooGL] Shader compilation failed — goo effects disabled')
      failedRef.current = true
      return
    }

    // ── FBOs ──
    const fboW = Math.ceil(width * FBO_SCALE)
    const fboH = Math.ceil(height * FBO_SCALE)
    const gooFBO = createFBO(gl, fboW, fboH)
    const nucFBO = createFBO(gl, fboW, fboH)
    if (!gooFBO || !nucFBO) {
      console.warn('[GooGL] FBO creation failed — goo effects disabled')
      failedRef.current = true
      return
    }

    // ── Static quad geometry ──
    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const quadVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

    // ── Instance buffers ──
    const gooInstanceData = new Float32Array(GOO_MAX * GOO_FLOATS_PER)
    const gooInstanceVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, gooInstanceVBO)
    gl.bufferData(gl.ARRAY_BUFFER, gooInstanceData.byteLength, gl.DYNAMIC_DRAW)

    const nucInstanceData = new Float32Array(NUC_MAX * NUC_FLOATS_PER)
    const nucInstanceVBO = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, nucInstanceVBO)
    gl.bufferData(gl.ARRAY_BUFFER, nucInstanceData.byteLength, gl.DYNAMIC_DRAW)

    // ── VAOs ──

    // Goo density VAO
    const gooVAO = gl.createVertexArray()!
    gl.bindVertexArray(gooVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, gooInstanceVBO)
    const gooStride = GOO_FLOATS_PER * 4
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, gooStride, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, gooStride, 8)
    gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, gooStride, 12)
    gl.vertexAttribDivisor(3, 1)
    gl.bindVertexArray(null)

    // Nucleus density VAO
    const nucVAO = gl.createVertexArray()!
    gl.bindVertexArray(nucVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, nucInstanceVBO)
    const nucStride = NUC_FLOATS_PER * 4
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, nucStride, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, nucStride, 8)
    gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, nucStride, 12)
    gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, nucStride, 24)
    gl.vertexAttribDivisor(4, 1)
    gl.enableVertexAttribArray(5)
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, nucStride, 28)
    gl.vertexAttribDivisor(5, 1)
    gl.enableVertexAttribArray(6)
    gl.vertexAttribPointer(6, 4, gl.FLOAT, false, nucStride, 44)
    gl.vertexAttribDivisor(6, 1)
    gl.bindVertexArray(null)

    // Composite VAO
    const compVAO = gl.createVertexArray()!
    gl.bindVertexArray(compVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    const compPosLoc = gl.getAttribLocation(compProg, 'a_position')
    gl.enableVertexAttribArray(compPosLoc)
    gl.vertexAttribPointer(compPosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // ── Uniform locations ──
    const gooUniforms = {
      resolution: gl.getUniformLocation(gooProg, 'u_resolution'),
      camera: gl.getUniformLocation(gooProg, 'u_camera'),
      radiusScale: gl.getUniformLocation(gooProg, 'u_radiusScale'),
    }
    const nucUniforms = {
      resolution: gl.getUniformLocation(nucProg, 'u_resolution'),
      camera: gl.getUniformLocation(nucProg, 'u_camera'),
      radiusScale: gl.getUniformLocation(nucProg, 'u_radiusScale'),
    }
    const compUniforms = {
      gooDensity: gl.getUniformLocation(compProg, 'u_gooDensity'),
      nucDensity: gl.getUniformLocation(compProg, 'u_nucDensity'),
      gooThreshold: gl.getUniformLocation(compProg, 'u_gooThreshold'),
      gooSmooth: gl.getUniformLocation(compProg, 'u_gooSmooth'),
      gooOpacity: gl.getUniformLocation(compProg, 'u_gooOpacity'),
      nucThreshold: gl.getUniformLocation(compProg, 'u_nucThreshold'),
      nucSmooth: gl.getUniformLocation(compProg, 'u_nucSmooth'),
      nucOpacity: gl.getUniformLocation(compProg, 'u_nucOpacity'),
    }

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

      // Mobile idle: signal other layers to pause, but keep goo rendering
      // at a reduced framerate so breathing/wobble stay alive
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

      // ── Fill goo instance buffer ──
      let gooCount = 0

      // Membrane blobs
      for (const blob of blobs) {
        if (gooCount >= GOO_MAX) break
        const breathe = Math.sin(time * tuning.membraneBreatheSpeed + blob.breathePhase) * tuning.membraneBreatheAmp * wobbleI
        const r = blob.radius + breathe
        const [cr, cg, cb] = hexToVec3(blob.color)
        const off = gooCount * GOO_FLOATS_PER
        gooInstanceData[off] = blob.x
        gooInstanceData[off + 1] = blob.y
        gooInstanceData[off + 2] = r
        gooInstanceData[off + 3] = cr
        gooInstanceData[off + 4] = cg
        gooInstanceData[off + 5] = cb
        gooCount++
      }

      // Connection bridge blobs
      for (const conn of connections) {
        const segments = Math.max(BRIDGE_SAMPLES, Math.floor(conn.dist / 100 * Q.gooSamplesPerPx))
        const srcVec = hexToVec3(conn.sourceColor)
        const tgtVec = hexToVec3(conn.targetColor)
        for (let i = 0; i <= segments; i++) {
          if (gooCount >= GOO_MAX) break
          const t = i / segments
          const sample = sampleConnection(conn, t, time, wobbleI, tuning.tubeWidthRatio, tuning.filletWidthRatio)
          if (sample.width < 0.5) continue
          const blobR = sample.width * BRIDGE_RADIUS_MULT
          const color = blendVec3(srcVec, tgtVec, t)
          const off = gooCount * GOO_FLOATS_PER
          gooInstanceData[off] = sample.x
          gooInstanceData[off + 1] = sample.y
          gooInstanceData[off + 2] = blobR
          gooInstanceData[off + 3] = color[0]
          gooInstanceData[off + 4] = color[1]
          gooInstanceData[off + 5] = color[2]
          gooCount++
        }
      }

      // ── Fill nucleus instance buffer ──
      let nucCount = 0
      for (const blob of blobs) {
        if (nucCount >= NUC_MAX) break
        // Stable per-blob offset for animation timing
        const pHash = blob.breathePhase * 2.7 + blob.phaseIndex * 1.3
        const nucleusR = blob.radius * tuning.nucleusRatioSvg
        const [cr, cg, cb] = hexToVec3(blob.color)

        const breatheOffset = dbg.nucleusWobble
          ? Math.sin(time * tuning.svgNucleusBreatheSpeed + pHash * 2) * tuning.svgNucleusBreatheAmp
          : 0

        const amp2 = dbg.nucleusWobble ? tuning.svgNucleus2LobeAmp : 0
        const amp3 = dbg.nucleusWobble ? tuning.svgNucleus3LobeAmp : 0
        const amp5 = dbg.nucleusWobble ? tuning.svgNucleus5LobeAmp : 0
        const phase2 = time * tuning.svgNucleus2LobeSpeed + pHash
        const phase3 = time * tuning.svgNucleus3LobeSpeed + pHash * 1.3
        const phase5 = -time * tuning.svgNucleus5LobeSpeed + pHash * 0.7

        const off = nucCount * NUC_FLOATS_PER
        nucInstanceData[off] = blob.x
        nucInstanceData[off + 1] = blob.y
        nucInstanceData[off + 2] = nucleusR
        nucInstanceData[off + 3] = cr
        nucInstanceData[off + 4] = cg
        nucInstanceData[off + 5] = cb
        nucInstanceData[off + 6] = breatheOffset
        nucInstanceData[off + 7] = amp2
        nucInstanceData[off + 8] = amp3
        nucInstanceData[off + 9] = amp5
        nucInstanceData[off + 10] = 0
        nucInstanceData[off + 11] = phase2
        nucInstanceData[off + 12] = phase3
        nucInstanceData[off + 13] = phase5
        nucCount++
      }

      // ── Upload instance data ──
      gl.bindBuffer(gl.ARRAY_BUFFER, gooInstanceVBO)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, gooInstanceData, 0, gooCount * GOO_FLOATS_PER)
      gl.bindBuffer(gl.ARRAY_BUFFER, nucInstanceVBO)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nucInstanceData, 0, nucCount * NUC_FLOATS_PER)

      // ── Threshold mapping from tuning store ──
      const gooThreshold = dbg.gooFilter ? -tuning.gooThreshold / tuning.gooContrast : 0.01
      const gooSmooth = dbg.gooFilter ? 1.0 / tuning.gooContrast : 0.5
      const nucThreshold = -tuning.nucleusThreshold / tuning.nucleusContrast
      const nucSmooth = 1.0 / tuning.nucleusContrast

      // Radius scale: controls density reach beyond blob edge
      const gooRadiusScale = 1.0 + (tuning.blurStdDev * dbg.filterBlurRadius) / 40.0
      const nucRadiusScale = 1.0 + tuning.nucleusBlur / 30.0

      // Camera uniform scaled to FBO resolution
      const camX = tf.x * FBO_SCALE
      const camY = tf.y * FBO_SCALE
      const camScale = tf.scale * FBO_SCALE

      // ── PASS 1: Goo density ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, gooFBO.fbo)
      gl.viewport(0, 0, fboW, fboH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.useProgram(gooProg)
      gl.uniform2f(gooUniforms.resolution, fboW, fboH)
      gl.uniform3f(gooUniforms.camera, camX, camY, camScale)
      gl.uniform1f(gooUniforms.radiusScale, gooRadiusScale)
      gl.bindVertexArray(gooVAO)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, gooCount)

      // ── PASS 2: Nucleus density ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, nucFBO.fbo)
      gl.viewport(0, 0, fboW, fboH)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(nucProg)
      gl.uniform2f(nucUniforms.resolution, fboW, fboH)
      gl.uniform3f(nucUniforms.camera, camX, camY, camScale)
      gl.uniform1f(nucUniforms.radiusScale, nucRadiusScale)
      gl.bindVertexArray(nucVAO)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nucCount)

      // ── PASS 3: Composite to screen ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(compProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, gooFBO.tex)
      gl.uniform1i(compUniforms.gooDensity, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, nucFBO.tex)
      gl.uniform1i(compUniforms.nucDensity, 1)
      gl.uniform1f(compUniforms.gooThreshold, gooThreshold)
      gl.uniform1f(compUniforms.gooSmooth, gooSmooth)
      gl.uniform1f(compUniforms.gooOpacity, pal.goo)
      gl.uniform1f(compUniforms.nucThreshold, nucThreshold)
      gl.uniform1f(compUniforms.nucSmooth, nucSmooth)
      gl.uniform1f(compUniforms.nucOpacity, tuning.nucleusOpacity)
      gl.bindVertexArray(compVAO)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      gl.bindVertexArray(null)

      // First-frame log
      if (!hasLogged) {
        hasLogged = true
        console.log(`[GooGL] FBO: ${fboW}x${fboH}, goo blobs: ${gooCount}, nuclei: ${nucCount}, draw calls: 3`)
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      gl.deleteVertexArray(gooVAO)
      gl.deleteVertexArray(nucVAO)
      gl.deleteVertexArray(compVAO)
      gl.deleteBuffer(quadVBO)
      gl.deleteBuffer(gooInstanceVBO)
      gl.deleteBuffer(nucInstanceVBO)
      gl.deleteFramebuffer(gooFBO.fbo)
      gl.deleteTexture(gooFBO.tex)
      gl.deleteFramebuffer(nucFBO.fbo)
      gl.deleteTexture(nucFBO.tex)
      gl.deleteProgram(gooProg)
      gl.deleteProgram(nucProg)
      gl.deleteProgram(compProg)
    }
  }, [width, height, bubbles, palette])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
