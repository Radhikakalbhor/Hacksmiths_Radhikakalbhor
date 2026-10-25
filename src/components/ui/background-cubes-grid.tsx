"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Isometric variant: a flat field of cubes that ripples under the pointer.   */
/* -------------------------------------------------------------------------- */

const SIM_HZ = 120;
const STEP = 1 / SIM_HZ;
const BRUSH_RADIUS = 1.1;
const PUSH_PER_CELL = 0.16;

export type IsometricCubesProps = {
  variant?: "isometric";
  className?: string;
  /** On-screen width of one tile, in CSS pixels. */
  cellSize?: number;
  /** Seam between cubes, as a fraction of a tile. */
  gap?: number;
  /** Top face color. */
  topColor?: string;
  /** Left side face color. */
  leftColor?: string;
  /** Right side face color. */
  rightColor?: string;
  /** Wave height, in tiles. */
  amplitude?: number;
  /** Wave speed, in tiles per second. */
  speed?: number;
  /** Fraction of wave energy kept per second, from 0 to 1. Lower values settle faster. */
  damping?: number;
  /** Drop random ripples when the pointer stops. */
  idleRipples?: boolean;
  /** Seconds the grid stays flat and still before random ripples start. */
  idleDelay?: number;
  /** Color of the light that follows the ripple. */
  glowColor?: string;
  /** Glow strength. Use 0 to turn it off. */
  glow?: number;
};

const isoVertexShader = `
  attribute vec2 aOffset;
  attribute float aHeight;
  attribute float aGlow;
  uniform float uAmplitude;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vGlow;
  varying float vDepth;

  void main() {
    vec3 p = position;
    p.xz += aOffset;
    // Crests round off softly; troughs have no limit and sink deeper than crests rise.
    // The two curves blend smoothly around zero, so cubes never change speed as they pass rest.
    float x = aHeight;
    vHeight = mix( x * 1.5, tanh( x ), smoothstep( -0.6, 0.6, x ) );
    p.y += vHeight * uAmplitude;
    vNormal = normal;
    vGlow = aGlow;
    vDepth = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
  }
`;

const isoFragmentShader = `
  uniform vec3 uTop;
  uniform vec3 uLeft;
  uniform vec3 uRight;
  uniform vec3 uGlowColor;
  uniform float uGlow;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vGlow;
  varying float vDepth;

  void main() {
    bool isTop = vNormal.y > 0.5;
    vec3 color = isTop ? uTop : ( abs( vNormal.x ) > 0.5 ? uLeft : uRight );
    // Tops that sink below the surface pick up a little shade so the trough reads.
    if ( isTop ) color = mix( color, uLeft, clamp( -vHeight, 0.0, 1.0 ) * 0.6 );

    // Glow: tops get a soft tint; sides are lit hardest near the rim, like a box-shadow.
    float glow = clamp( vGlow * uGlow, 0.0, 1.0 );
    float falloff = isTop ? 0.2 : exp( vDepth * 1.6 ) * 0.6;
    color = mix( color, uGlowColor, glow * falloff );

    gl_FragColor = vec4( color, 1.0 );
    #include <colorspace_fragment>
  }
`;

function createIsometricScene(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  options: Required<Omit<IsometricCubesProps, "className" | "variant">>,
) {
  const {
    cellSize,
    gap,
    topColor,
    leftColor,
    rightColor,
    amplitude,
    speed,
    damping,
    idleRipples,
    idleDelay,
    glowColor,
    glow,
  } = options;

  const c2 = Math.min((speed / SIM_HZ) ** 2, 0.5);
  // Per-second rates. While the pointer moves (or auto mode runs), waves travel freely and a
  // slow pull toward zero removes leftover offset. Once the pointer stops, both rates ramp up
  // smoothly so the surface eases back into a flat, aligned grid without a sudden brake.
  const flowDrag = -Math.log(Math.min(Math.max(damping, 1e-4), 1));
  const settleDrag = -Math.log(0.02);
  const flowPull = 0.8;
  const settlePull = 3.5;
  const SETTLE_AFTER = 0.15;
  const SETTLE_RAMP = 0.8;
  const FLAT = 0.004;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(topColor);
  const scene = new THREE.Scene();

  // True isometric view: camera on the (1, 1, 1) diagonal.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader: isoVertexShader,
    fragmentShader: isoFragmentShader,
    uniforms: {
      uAmplitude: { value: amplitude },
      uTop: { value: new THREE.Color(topColor) },
      uLeft: { value: new THREE.Color(leftColor) },
      uRight: { value: new THREE.Color(rightColor) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uGlow: { value: glow },
    },
  });

  let size = 0;
  let height = new Float32Array(0);
  let velocity = new Float32Array(0);
  let lastHeight = new Float32Array(0);
  let glowField = new Float32Array(0);
  let geometry: THREE.InstancedBufferGeometry | null = null;
  let heightAttribute: THREE.InstancedBufferAttribute | null = null;
  let glowAttribute: THREE.InstancedBufferAttribute | null = null;
  let mesh: THREE.Mesh | null = null;

  const build = (count: number) => {
    if (mesh) scene.remove(mesh);
    geometry?.dispose();
    size = count;
    height = new Float32Array(size * size);
    velocity = new Float32Array(size * size);
    lastHeight = new Float32Array(size * size);
    glowField = new Float32Array(size * size);

    // Tall columns so deep troughs never expose the bottom of a cube.
    const box = new THREE.BoxGeometry(1 - gap, 16, 1 - gap).translate(0, -8, 0);
    geometry = new THREE.InstancedBufferGeometry();
    geometry.index = box.index;
    geometry.setAttribute("position", box.getAttribute("position"));
    geometry.setAttribute("normal", box.getAttribute("normal"));

    const offsets = new Float32Array(size * size * 2);
    const half = (size - 1) / 2;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        offsets[(i * size + j) * 2] = i - half;
        offsets[(i * size + j) * 2 + 1] = j - half;
      }
    }
    geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 2));
    heightAttribute = new THREE.InstancedBufferAttribute(new Float32Array(size * size), 1);
    heightAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aHeight", heightAttribute);
    glowAttribute = new THREE.InstancedBufferAttribute(glowField, 1);
    glowAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aGlow", glowAttribute);
    geometry.instanceCount = size * size;

    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  };

  let awake = true;
  const resize = () => {
    const width = container.clientWidth;
    const viewHeight = container.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, viewHeight, false);

    // A tile's top face spans sqrt(2) world units across the screen.
    const scale = cellSize / Math.SQRT2;
    camera.left = -width / 2 / scale;
    camera.right = width / 2 / scale;
    camera.top = viewHeight / 2 / scale;
    camera.bottom = -viewHeight / 2 / scale;
    camera.updateProjectionMatrix();

    const needed = Math.ceil(((width + viewHeight * 2) / cellSize) * 1.1) + 4;
    if (needed > size) build(needed);
    awake = true;
  };

  // Smooth Gaussian push into the velocity field, centred on a fractional grid position.
  const brush = (gx: number, gz: number, strength: number, radius = BRUSH_RADIUS) => {
    const reach = Math.ceil(radius * 3);
    const inv = 1 / (2 * radius * radius);
    const ci = Math.round(gx);
    const cj = Math.round(gz);
    for (let i = Math.max(1, ci - reach); i <= Math.min(size - 2, ci + reach); i++) {
      for (let j = Math.max(1, cj - reach); j <= Math.min(size - 2, cj + reach); j++) {
        const dx = i - gx;
        const dz = j - gz;
        velocity[i * size + j] -= strength * Math.exp(-(dx * dx + dz * dz) * inv);
      }
    }
    awake = true;
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let target: { x: number; z: number } | null = null;
  let brushAt: { x: number; z: number } | null = null;
  let idleTime = 0;
  let quietTime = 0;
  let idleTimer = 0;
  let autoMode = false;
  let lastEnergy = 0;

  // Listen on window so content placed above the canvas does not block ripples.
  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (Math.abs(nx) > 1 || Math.abs(ny) > 1) {
      target = null;
      brushAt = null;
      return;
    }
    pointer.set(nx, ny);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const half = (size - 1) / 2;
    target = { x: hit.x + half, z: hit.z + half };
    idleTime = 0;
    quietTime = 0;
    autoMode = false;
  };

  // Drag the brush along the path the pointer travelled since the last frame.
  const applyPointer = () => {
    if (!target) return;
    if (!brushAt) {
      brushAt = { ...target };
      return;
    }
    const dx = target.x - brushAt.x;
    const dz = target.z - brushAt.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.01) return;
    const samples = Math.ceil(distance / 0.35);
    const push = (Math.min(distance, 3) * PUSH_PER_CELL) / samples;
    for (let s = 1; s <= samples; s++) {
      brush(brushAt.x + (dx * s) / samples, brushAt.z + (dz * s) / samples, push);
    }
    brushAt = { ...target };
  };

  const step = () => {
    const ramp = autoMode ? 0 : Math.min(Math.max((idleTime - SETTLE_AFTER) / SETTLE_RAMP, 0), 1);
    const s = ramp * ramp * (3 - 2 * ramp);
    const keep = Math.exp(-(flowDrag + (settleDrag - flowDrag) * s) / SIM_HZ);
    const relax = Math.exp(-(flowPull + (settlePull - flowPull) * s) / SIM_HZ);
    lastHeight.set(height);
    for (let i = 1; i < size - 1; i++) {
      for (let j = 1; j < size - 1; j++) {
        const k = i * size + j;
        // Nine-point Laplacian: round wavefronts and no grid-aligned checkerboard noise.
        const edges = height[k - 1] + height[k + 1] + height[k - size] + height[k + size];
        const corners =
          height[k - size - 1] + height[k - size + 1] + height[k + size - 1] + height[k + size + 1];
        const laplacian = (4 * edges + corners - 20 * height[k]) / 6;
        velocity[k] = (velocity[k] + c2 * laplacian) * keep;
      }
    }
    for (let k = 0; k < height.length; k++) height[k] = (height[k] + velocity[k]) * relax;

    // Glow eases toward the local wave energy: quick to light up, slow to fade.
    for (let i = 1; i < size - 1; i++) {
      for (let j = 1; j < size - 1; j++) {
        const k = i * size + j;
        const energy =
          (Math.abs(height[k]) * 4 +
            Math.abs(height[k - 1]) +
            Math.abs(height[k + 1]) +
            Math.abs(height[k - size]) +
            Math.abs(height[k + size])) /
          8;
        glowField[k] += (energy - glowField[k]) * (energy > glowField[k] ? 0.08 : 0.015);
      }
    }
  };

  let accumulator = 0;
  const update = (delta: number) => {
    if (!heightAttribute || !glowAttribute) return;

    idleTime += delta;
    // Auto mode starts only after the grid has been flat and still for `idleDelay` seconds.
    quietTime = !autoMode && idleTime > SETTLE_AFTER && lastEnergy < FLAT ? quietTime + delta : 0;
    if (idleRipples && !autoMode && quietTime > idleDelay) autoMode = true;
    if (autoMode) {
      idleTimer += delta;
      if (idleTimer > 1.8) {
        idleTimer = 0;
        const spread = size * 0.15;
        brush(
          size / 2 + (Math.random() - 0.5) * spread * 2,
          size / 2 + (Math.random() - 0.5) * spread * 2,
          0.28,
          1.8,
        );
      }
    } else {
      idleTimer = 1.8;
    }

    applyPointer();
    if (!awake) {
      lastEnergy = 0;
      return;
    }

    accumulator = Math.min(accumulator + delta, STEP * 8);
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }

    // Blend the last two simulation states so motion stays smooth at any refresh rate.
    const alpha = accumulator / STEP;
    const display = heightAttribute.array as Float32Array;
    let wave = 0;
    let light = 0;
    for (let k = 0; k < height.length; k++) {
      display[k] = lastHeight[k] + (height[k] - lastHeight[k]) * alpha;
      wave = Math.max(wave, Math.abs(height[k]), Math.abs(velocity[k]) * 20);
      light = Math.max(light, glowField[k]);
    }
    heightAttribute.needsUpdate = true;
    glowAttribute.needsUpdate = true;
    renderer.render(scene, camera);
    lastEnergy = wave;
    const energy = Math.max(wave, light);

    // Stop rendering once the surface has settled; the next push wakes it up.
    if (energy < 1e-4) awake = false;
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener("pointermove", onPointerMove);

  const dispose = () => {
    observer.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    geometry?.dispose();
    material.dispose();
    renderer.dispose();
  };

  return { update, dispose };
}

function IsometricCubes({
  className,
  cellSize = 150,
  gap = 0.025,
  topColor = "#fafaf9",
  leftColor = "#e7e5e4",
  rightColor = "#d6d3d1",
  amplitude = 0.7,
  speed = 7,
  damping = 0.08,
  idleRipples = true,
  idleDelay = 1.5,
  glowColor = "#a8a29e",
  glow = 0.5,
}: IsometricCubesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateRef = useRef<((delta: number) => void) | null>(null);
  const reduceMotion = useReducedMotion();
  const idle = idleRipples && !reduceMotion;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const { update, dispose } = createIsometricScene(canvasRef.current, containerRef.current, {
      cellSize,
      gap,
      topColor,
      leftColor,
      rightColor,
      amplitude,
      speed,
      damping,
      idleRipples: idle,
      idleDelay,
      glowColor,
      glow,
    });
    updateRef.current = update;
    return () => {
      updateRef.current = null;
      dispose();
    };
  }, [cellSize, gap, topColor, leftColor, rightColor, amplitude, speed, damping, idle, idleDelay, glowColor, glow]);

  useAnimationFrame((_, delta) => {
    updateRef.current?.(Math.min(delta / 1000, 0.1));
  });

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      style={{ backgroundColor: topColor }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Perspective variant: a tilted 3D grid with glowing wave crests.            */
/* -------------------------------------------------------------------------- */

const MAX_TRAIL = 128;
const CUBE_WIDTH = 0.72;
const CUBE_HEIGHT = 3;
const CAMERA_RADIUS = 12;
const ALPHA_RANGE = Math.PI * 0.03;
const BETA_RANGE = Math.PI * 0.05;

const PERSPECTIVE_WAVE = {
  speed: 6.0,
  frequency: 1.2,
  width: 3.0,
  jitter: 0.2,
  fadeTime: 2.0,
  trailSpacing: 0.1,
  idleStrength: 0.8,
};

export type PerspectiveCubesProps = {
  variant: "perspective";
  className?: string;
  /** Number of cubes per side. */
  gridSize?: number;
  /** Space between cubes, in world units. */
  gap?: number;
  /** Cube color at rest. */
  baseColor?: string;
  /** Color of the wave crests. */
  waveColor?: string;
  /** Scene background and fog color. */
  backgroundColor?: string;
  /** Amount of light the crests emit. */
  glow?: number;
  /** Wave height. */
  amplitude?: number;
  /** Camera tilt from top-down, in radians. */
  tilt?: number;
  /** Start random waves when the pointer stops. */
  idleRipples?: boolean;
};

const VignetteRGBShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    shiftAmount: { value: 0.004 },
    vignetteRadius: { value: 0.35 },
    vignetteSoftness: { value: 0.45 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float shiftAmount;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      float dist = distance(vUv, center);
      vec2 dir = sign(vUv - center);
      float vignetteFactor = smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, dist);
      vec2 shift = dir * shiftAmount * vignetteFactor;
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      gl_FragColor = vec4(vec3(r, g, b) * (1.0 - vignetteFactor * 0.7), 1.0);
    }
  `,
};

const overrideVertexShader = (vertexShader: string) =>
  vertexShader
    .replace(
      "#include <common>",
      `#include <common>
      varying float vHeight;
      attribute vec2 aOffset;
      uniform sampler2D uTrailTexture;
      uniform int       uTrailCount;
      uniform float     uWaveSpeed;
      uniform float     uWaveFreq;
      uniform float     uWaveWidth;
      uniform float     uFadeTime;
      uniform float     uAmplitude;
      uniform float     uJitter;
      uniform float     uMaxHeight;

      vec2 hash2( vec2 p ) {
        p = vec2(
          dot( p, vec2( 127.1, 311.7 ) ),
          dot( p, vec2( 269.5, 183.3 ) )
        );
        return fract( sin( p ) * 43758.5453123 ) - 0.5;
      }`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vHeight = 0.0;
      if ( position.y > 0.0 ) {
        vec2 worldXZ = aOffset + hash2( aOffset ) * uJitter;
        float waveHeight  = 0.0;
        float totalWeight = 0.0;

        for ( int i = 0; i < uTrailCount; i++ ) {
          vec4 td = texture2D(
            uTrailTexture,
            vec2( ( float(i) + 0.5 ) / ${MAX_TRAIL}.0, 0.5 )
          );
          float dist    = length( worldXZ - td.rg );
          float relDist = dist - uWaveSpeed * td.b;
          float window  = exp( -( relDist * relDist ) / ( uWaveWidth * uWaveWidth ) );
          float fade    = exp( -td.b / uFadeTime );
          float atten   = 1.0 / ( 1.0 + dist * 0.1 );
          float weight  = fade * window * atten * td.a;

          waveHeight  += weight * cos( uWaveFreq * relDist );
          totalWeight += weight;
        }

        waveHeight /= max( totalWeight, 1.0 );

        float displacement = clamp( waveHeight * uAmplitude, -uMaxHeight, uMaxHeight );
        transformed.y += displacement;
        vHeight = displacement;
      }`,
    );

type TrailPoint = { x: number; z: number; age: number; distDelta: number };

type SceneOptions = Required<Omit<PerspectiveCubesProps, "className" | "variant">>;

function createPerspectiveScene(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  options: SceneOptions,
) {
  const { gridSize, gap, baseColor, waveColor, backgroundColor, glow, amplitude, tilt, idleRipples } =
    options;
  let width = container.clientWidth;
  let height = container.clientHeight;
  let pixelRatio = Math.min(window.devicePixelRatio, 2);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);
  scene.fog = new THREE.Fog(backgroundColor, 9, 26);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
  const mouse = new THREE.Vector2();
  const lerpedMouse = new THREE.Vector2();
  const updateCamera = (mx: number, my: number) => {
    const alpha = tilt + my * ALPHA_RANGE;
    const beta = mx * BETA_RANGE;
    camera.position.set(
      -CAMERA_RADIUS * Math.cos(alpha) * Math.sin(beta),
      CAMERA_RADIUS * Math.cos(alpha) * Math.cos(beta),
      CAMERA_RADIUS * Math.sin(alpha),
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  };
  updateCamera(0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(pixelRatio);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(VignetteRGBShiftShader));
  composer.addPass(new OutputPass());
  composer.setSize(width, height);
  composer.setPixelRatio(pixelRatio);

  scene.add(new THREE.AmbientLight("#ffffff", 0.35));
  const keyLight = new THREE.DirectionalLight("#ffffff", 3.0);
  keyLight.position.set(-20, 12, -6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 6;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -22;
  keyLight.shadow.camera.right = 22;
  keyLight.shadow.camera.top = 22;
  keyLight.shadow.camera.bottom = -22;
  keyLight.shadow.bias = 0.0001;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(waveColor, 1.2);
  rimLight.position.set(12, 4, 10);
  scene.add(rimLight);

  const bounds = gridSize * (CUBE_WIDTH + gap);
  const maxHeight = amplitude;

  const trail: TrailPoint[] = [];
  let lastPoint: { x: number; z: number } | null = null;
  let timeSinceLastMove = 0;
  let randomPointTimer = 0;
  let isPlacingRandomPoints = idleRipples;

  const trailData = new Float32Array(MAX_TRAIL * 4);
  const trailTexture = new THREE.DataTexture(
    trailData,
    MAX_TRAIL,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  trailTexture.needsUpdate = true;
  const trailUniforms = {
    uTrailTexture: { value: trailTexture },
    uTrailCount: { value: 0 },
    uFadeTime: { value: PERSPECTIVE_WAVE.fadeTime },
  };

  const rayPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds, bounds),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false }),
  );
  rayPlane.rotation.x = -Math.PI / 2;
  rayPlane.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const pushPoint = (point: TrailPoint) => {
    if (trail.length >= MAX_TRAIL) trail.shift();
    trail.push(point);
  };

  const waveUniforms = () => ({
    ...trailUniforms,
    uWaveSpeed: { value: PERSPECTIVE_WAVE.speed },
    uWaveFreq: { value: PERSPECTIVE_WAVE.frequency },
    uWaveWidth: { value: PERSPECTIVE_WAVE.width },
    uAmplitude: { value: amplitude },
    uJitter: { value: PERSPECTIVE_WAVE.jitter },
    uMaxHeight: { value: maxHeight },
  });

  const count = gridSize * gridSize;
  const geometry = new RoundedBoxGeometry(CUBE_WIDTH, CUBE_HEIGHT, CUBE_WIDTH, 2, 0.12);
  const offsetAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(count * 2),
    2,
  );
  geometry.setAttribute("aOffset", offsetAttribute);

  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms(), {
      uColorBase: { value: new THREE.Color(baseColor) },
      uColorHigh: { value: new THREE.Color(waveColor) },
      uGlow: { value: glow },
    });
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vHeight;
        uniform vec3  uColorBase;
        uniform vec3  uColorHigh;
        uniform float uMaxHeight;
        uniform float uGlow;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float crest  = clamp( vHeight / uMaxHeight, 0.0, 1.0 );
        float trough = clamp( -vHeight / uMaxHeight, 0.0, 1.0 );
        diffuseColor.rgb = mix( uColorBase, uColorHigh, crest ) * ( 1.0 - trough * 0.6 );`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uColorHigh * crest * crest * uGlow;`,
      );
  };

  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms());
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
  };

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const spacing = CUBE_WIDTH + gap;
  const gridOffset = ((gridSize - 1) * spacing) / 2;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const index = i * gridSize + j;
      const x = i * spacing - gridOffset;
      const z = j * spacing - gridOffset;
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      offsetAttribute.setXY(index, x, z);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  offsetAttribute.needsUpdate = true;

  // Listen on window so content placed above the canvas does not block waves.
  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (Math.abs(nx) > 1 || Math.abs(ny) > 1) return;
    mouse.set(nx, ny);
    pointer.set(nx, ny);

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(rayPlane);
    if (hits.length === 0) return;

    const { x, z } = hits[0].point;
    let distDelta = 0;
    if (lastPoint) {
      distDelta = Math.hypot(x - lastPoint.x, z - lastPoint.z);
      if (distDelta < PERSPECTIVE_WAVE.trailSpacing) return;
    }
    pushPoint({ x, z, age: 0, distDelta });
    lastPoint = { x, z };
    timeSinceLastMove = 0;
    isPlacingRandomPoints = false;
    randomPointTimer = 0;
  };

  const resizeObserver = new ResizeObserver(() => {
    width = container.clientWidth;
    height = container.clientHeight;
    pixelRatio = Math.min(window.devicePixelRatio, 2);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.setPixelRatio(pixelRatio);
  });
  resizeObserver.observe(container);
  window.addEventListener("pointermove", onPointerMove);

  const update = (delta: number) => {
    lerpedMouse.x += (mouse.x - lerpedMouse.x) * 0.04;
    lerpedMouse.y += (mouse.y - lerpedMouse.y) * 0.04;
    updateCamera(lerpedMouse.x, lerpedMouse.y);

    const expiry = PERSPECTIVE_WAVE.fadeTime * 4;
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += delta;
      if (trail[i].age > expiry) trail.splice(i, 1);
    }

    timeSinceLastMove += delta;
    if (idleRipples && timeSinceLastMove >= 3.0 && !isPlacingRandomPoints) {
      isPlacingRandomPoints = true;
      randomPointTimer = 0;
    }
    if (isPlacingRandomPoints) {
      randomPointTimer += delta;
      if (randomPointTimer >= 1.5) {
        pushPoint({
          x: (Math.random() * 0.5 - 0.25) * bounds,
          z: (Math.random() * 0.5 - 0.25) * bounds,
          age: 0,
          distDelta: PERSPECTIVE_WAVE.idleStrength + Math.random() * 0.2,
        });
        randomPointTimer = 0;
      }
    }

    const live = Math.min(trail.length, MAX_TRAIL);
    if (live > 0 || trailUniforms.uTrailCount.value > 0) {
      for (let i = 0; i < live; i++) {
        trailData.set(
          [trail[i].x, trail[i].z, trail[i].age, trail[i].distDelta],
          i * 4,
        );
      }
      trailTexture.needsUpdate = true;
      trailUniforms.uTrailCount.value = live;
    }

    composer.render();
  };

  const dispose = () => {
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    geometry.dispose();
    material.dispose();
    depthMaterial.dispose();
    rayPlane.geometry.dispose();
    rayPlane.material.dispose();
    trailTexture.dispose();
    composer.dispose();
    renderer.dispose();
  };

  return { update, dispose };
}

function PerspectiveCubes({
  className,
  gridSize = 44,
  gap = 0.08,
  baseColor = "#2a2a30",
  waveColor = "#ff6a2b",
  backgroundColor = "#0b0b0d",
  glow = 0.9,
  amplitude = 0.5,
  tilt = 0.7,
  idleRipples = true,
}: PerspectiveCubesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateRef = useRef<((delta: number) => void) | null>(null);
  const reduceMotion = useReducedMotion();
  const idle = idleRipples && !reduceMotion;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const { update, dispose } = createPerspectiveScene(canvasRef.current, containerRef.current, {
      gridSize,
      gap,
      baseColor,
      waveColor,
      backgroundColor,
      glow,
      amplitude,
      tilt,
      idleRipples: idle,
    });
    updateRef.current = update;
    return () => {
      updateRef.current = null;
      dispose();
    };
  }, [gridSize, gap, baseColor, waveColor, backgroundColor, glow, amplitude, tilt, idle]);

  useAnimationFrame((_, delta) => {
    updateRef.current?.(Math.min(delta / 1000, 0.1));
  });

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      style={{ backgroundColor }}
    >
      <canvas ref={canvasRef} className="block h-full w-full outline-none" />
    </div>
  );
}

export type BackgroundCubesGridProps = IsometricCubesProps | PerspectiveCubesProps;

export const BackgroundCubesGrid = (props: BackgroundCubesGridProps) =>
  props.variant === "perspective" ? <PerspectiveCubes {...props} /> : <IsometricCubes {...props} />;
