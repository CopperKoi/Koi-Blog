"use client";

import { useEffect, useRef } from "react";

type Mat4 = Float32Array;

type FrameConfig = {
  width: number;
  height: number;
  opacity: number;
  opacityMouseDown: number;
  offset: number;
};

type Config = {
  animation: {
    baseSpeed: number;
    boostSpeed: number;
    hoverSpeed: number;
  };
  camera: {
    distance: number;
    startRotXDeg: number;
    scroll: { minDeg: number; maxDeg: number; rangeDeg: number; transitionDeg: number };
    mouseRotationDeg: number;
  };
  interaction: {
    maxParallax: number;
    baseScale: number;
    pressedScale: number;
    hoverScale: number;
  };
  trails: {
    count: number;
    segmentCount: number;
    layers: number;
    layerAngleOffset: number;
    arcLength: number;
    baseRadius: number;
    reducedRadius: number;
    radiusReductionOnMouseDown: number;
    radiusReductionFromAngleFactor: number;
    spiralOffsetFactor: number;
    segmentRadiusSinFactor: number;
    segmentRadiusCosFactor: number;
    circleZFactor: number;
  };
  appearance: {
    minOpacity: number;
    maxOpacity: number;
    baseAlphaFactor: number;
    layerFadePower: number;
    brightness: number;
    brightnessMouseDown: number;
    brightnessBlurFactor: number;
    maxBlurDistance: number;
    distanceMultiplierFactor: number;
  };
  frame: FrameConfig;
};

type State = {
  time: { last: number; rotationOffset: number; speed: number };
  input: { mouseY01: number; mouseX: number; isDown: boolean; isOver: boolean };
  camera: {
    target: { rotXCenter: number; rotY: number };
    current: { rotXCenter: number; rotY: number; rotXActive: number };
    parallax: { target: { x: number; y: number }; current: { x: number; y: number } };
  };
  radius: { target: number; current: number };
  scale: { target: number; current: number };
  morph: { sphere: number; targetSphere: number };
};

const PI = Math.PI;
const D2R = PI / 180;

const config: Config = {
  animation: {
    baseSpeed: 5.0,
    boostSpeed: 20.0,
    hoverSpeed: 1.1
  },
  camera: {
    distance: 3.0,
    startRotXDeg: -77,
    scroll: { minDeg: -84, maxDeg: -77, rangeDeg: 8, transitionDeg: 65 },
    mouseRotationDeg: 7
  },
  interaction: {
    maxParallax: 1.35,
    baseScale: 1.0,
    pressedScale: 0.95,
    hoverScale: 1.14
  },
  trails: {
    count: 35,
    segmentCount: 6,
    layers: 7,
    layerAngleOffset: 0.15,
    arcLength: 1.2,
    baseRadius: 0.677,
    reducedRadius: 0.25,
    radiusReductionOnMouseDown: 0.015,
    radiusReductionFromAngleFactor: 0.15,
    spiralOffsetFactor: 0.2,
    segmentRadiusSinFactor: 0.02,
    segmentRadiusCosFactor: 0.01,
    circleZFactor: 0.035
  },
  appearance: {
    minOpacity: 0.14,
    maxOpacity: 1.0,
    baseAlphaFactor: 0.1,
    layerFadePower: 0.7,
    brightness: 0.9,
    brightnessMouseDown: 1.5,
    brightnessBlurFactor: 0.4,
    maxBlurDistance: 0.25,
    distanceMultiplierFactor: 0.24
  },
  frame: {
    width: 1.16,
    height: 1.16,
    opacity: 0.64,
    opacityMouseDown: 0.9,
    offset: 0.006
  }
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function getThemeMode() {
  const root = document.documentElement;
  const stored = root.getAttribute("data-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createPerspectiveMatrix(fieldOfView: number, aspectRatio: number, near: number, far: number) {
  const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfView);
  const rangeInv = 1.0 / (near - far);
  return new Float32Array([
    f / aspectRatio,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (near + far) * rangeInv,
    -1,
    0,
    0,
    near * far * rangeInv * 2,
    0
  ]);
}

function subtractVectors(a: number[], b: number[]) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function normalizeVector(v: number[]) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len <= 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function crossProduct(a: number[], b: number[]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dotProduct(a: number[], b: number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function createLookAtMatrix(out: Mat4, eye: number[], target: number[], up: number[]) {
  const zAxis = normalizeVector(subtractVectors(eye, target));
  const xAxis = normalizeVector(crossProduct(up, zAxis));
  const yAxis = normalizeVector(crossProduct(zAxis, xAxis));

  out[0] = xAxis[0];
  out[1] = yAxis[0];
  out[2] = zAxis[0];
  out[3] = 0;
  out[4] = xAxis[1];
  out[5] = yAxis[1];
  out[6] = zAxis[1];
  out[7] = 0;
  out[8] = xAxis[2];
  out[9] = yAxis[2];
  out[10] = zAxis[2];
  out[11] = 0;
  out[12] = -dotProduct(xAxis, eye);
  out[13] = -dotProduct(yAxis, eye);
  out[14] = -dotProduct(zAxis, eye);
  out[15] = 1;
  return out;
}

function identityMatrix(out: Mat4) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}

function calculateCameraAngleForCenter(normalizedY: number) {
  const y = clamp01(normalizedY);
  const min = config.camera.scroll.minDeg * D2R;
  const max = config.camera.scroll.maxDeg * D2R;
  const range = config.camera.scroll.rangeDeg * D2R;
  const transition = config.camera.scroll.transitionDeg * D2R;
  return y <= 0.5 ? min + (y / 0.5) * range : max + ((y - 0.5) / 0.5) * transition;
}

function getLayeredSphereCoordinates(
  trailIndex: number,
  baseAngle: number,
  radius: number
): { x: number; y: number; z: number } {
  const t = trailIndex % 2 === 0 ? -baseAngle : baseAngle;
  const seedA = Math.sin(trailIndex * 12.9898) * 43758.5453;
  const seedB = Math.cos(trailIndex * 78.233) * 24634.6345;
  const tilt = seedA - Math.floor(seedA);
  const az = seedB - Math.floor(seedB);
  const tiltRad = tilt * PI;
  const azRad = az * (PI * 2.0);

  const normal = [Math.sin(tiltRad) * Math.cos(azRad), Math.sin(tiltRad) * Math.sin(azRad), Math.cos(tiltRad)];
  const helper = Math.abs(normal[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let u = crossProduct(normal, helper);
  u = normalizeVector(u);
  let v = crossProduct(normal, u);
  v = normalizeVector(v);

  return {
    x: (Math.cos(t) * u[0] + Math.sin(t) * v[0]) * radius,
    y: (Math.cos(t) * u[1] + Math.sin(t) * v[1]) * radius,
    z: (Math.cos(t) * u[2] + Math.sin(t) * v[2]) * radius
  };
}

function setVertex(buffer: Float32Array, index: number, x: number, y: number, z: number) {
  const o = index * 3;
  buffer[o] = x;
  buffer[o + 1] = y;
  buffer[o + 2] = z;
}

function setRectangleVertices(buffer: Float32Array, width: number, height: number, offset = 0) {
  const left = -width / 2 + offset;
  const right = width / 2 - offset;
  const bottom = -height / 2 + offset;
  const top = height / 2 - offset;
  const verts = [
    [left, bottom, 0],
    [right, bottom, 0],
    [right, top, 0],
    [left, bottom, 0],
    [right, top, 0],
    [left, top, 0]
  ];
  for (let i = 0; i < verts.length; i += 1) {
    const v = verts[i];
    setVertex(buffer, i, v[0], v[1], v[2]);
  }
}

export function MinimalFrameLines() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { stencil: true, alpha: true });
    if (!gl) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let projectionMatrix = createPerspectiveMatrix(PI / 4, 1, 0.1, 100);
    const modelMatrix = new Float32Array(16);
    const cameraViewMatrix = new Float32Array(16);
    const frameViewMatrix = new Float32Array(16);
    const eye = [0, 0, 0];

    const frameVertices = new Float32Array(18);
    const trailPoints = new Float32Array(config.trails.segmentCount * 3);

    let darkMode = getThemeMode() === "dark";

    const state: State = {
      time: { last: 0, rotationOffset: 0, speed: config.animation.baseSpeed },
      input: { mouseY01: 0.5, mouseX: 0, isDown: false, isOver: false },
      camera: {
        target: { rotXCenter: config.camera.startRotXDeg * D2R, rotY: 0 },
        current: {
          rotXCenter: config.camera.startRotXDeg * D2R,
          rotY: 0,
          rotXActive: config.camera.startRotXDeg * D2R
        },
        parallax: { target: { x: 0, y: 0 }, current: { x: 0, y: 0 } }
      },
      radius: { target: config.trails.baseRadius, current: config.trails.baseRadius },
      scale: { target: config.interaction.baseScale, current: config.interaction.baseScale },
      morph: { sphere: 0, targetSphere: 0 }
    };

    const vertexShaderSource = `#version 300 es
in vec3 aPos;
in vec4 aCol;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec4 vCol;
void main() {
  vCol = aCol;
  gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}`;

    const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec4 vCol;
out vec4 fragColor;
void main() {
  fragColor = vCol;
}`;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const attrPos = gl.getAttribLocation(program, "aPos");
    const attrCol = gl.getAttribLocation(program, "aCol");
    const uniProj = gl.getUniformLocation(program, "uProj");
    const uniView = gl.getUniformLocation(program, "uView");
    const uniModel = gl.getUniformLocation(program, "uModel");

    const frameBuffer = gl.createBuffer();
    const batchPosBuffer = gl.createBuffer();
    const batchColorBuffer = gl.createBuffer();
    if (!frameBuffer || !batchPosBuffer || !batchColorBuffer) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const newWidth = Math.max(1, Math.round(rect.width * dpr));
      const newHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        gl.viewport(0, 0, newWidth, newHeight);
      }
      projectionMatrix = createPerspectiveMatrix(PI / 4, newWidth / newHeight, 0.1, 100.0);
    };

    const updateCameraViewMatrix = (rotationX: number, rotationY: number, distance: number) => {
      eye[0] = Math.sin(rotationY) * distance;
      eye[1] = Math.sin(rotationX) * distance;
      eye[2] = Math.cos(rotationX) * distance;
      createLookAtMatrix(cameraViewMatrix, eye, [0, 0, 0], [0, 1, 0]);
    };

    const updateFrameViewMatrix = (scaleForFrame: number) => {
      const frameDistance = config.camera.distance / scaleForFrame;
      const frameEye = [state.camera.parallax.current.y, state.camera.parallax.current.x, frameDistance];
      createLookAtMatrix(frameViewMatrix, frameEye, [0, 0, 0], [0, 1, 0]);
    };

    const setupVertexBuffer = (buffer: WebGLBuffer, data: Float32Array) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(attrPos);
      gl.vertexAttribPointer(attrPos, 3, gl.FLOAT, false, 0, 0);
    };

    const drawFrameMask = () => {
      if (!uniView || !uniModel) return;
      gl.uniformMatrix4fv(uniView, false, frameViewMatrix);
      gl.uniformMatrix4fv(uniModel, false, identityMatrix(modelMatrix));
      setRectangleVertices(frameVertices, config.frame.width, config.frame.height);
      setupVertexBuffer(frameBuffer, frameVertices);
      gl.disableVertexAttribArray(attrCol);
      gl.vertexAttrib4f(attrCol, 0, 0, 0, 1);
      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.colorMask(false, false, false, false);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.colorMask(true, true, true, true);
    };

    const drawFrame = () => {
      if (!uniView || !uniModel) return;
      gl.uniformMatrix4fv(uniView, false, frameViewMatrix);
      gl.uniformMatrix4fv(uniModel, false, identityMatrix(modelMatrix));
      gl.stencilFunc(gl.ALWAYS, 0, 0xff);

      const frameOpacity = state.input.isDown ? config.frame.opacityMouseDown : config.frame.opacity;
      const c = darkMode ? 1 : 0;
      gl.disableVertexAttribArray(attrCol);
      gl.vertexAttrib4f(attrCol, c, c, c, frameOpacity);

      const left = -config.frame.width / 2;
      const right = config.frame.width / 2;
      const bottom = -config.frame.height / 2;
      const top = config.frame.height / 2;
      const border = [
        [left, bottom, 0],
        [right, bottom, 0],
        [right, top, 0],
        [left, top, 0]
      ];
      for (let i = 0; i < border.length; i += 1) {
        const v = border[i];
        setVertex(frameVertices, i, v[0], v[1], v[2]);
      }

      setupVertexBuffer(frameBuffer, frameVertices.subarray(0, 12));
      gl.drawArrays(gl.LINE_LOOP, 0, 4);

      const offset = config.frame.offset;
      const inner = [
        [left + offset, bottom + offset, 0],
        [right - offset, bottom + offset, 0],
        [right - offset, top - offset, 0],
        [left + offset, top - offset, 0]
      ];
      for (let i = 0; i < inner.length; i += 1) {
        const v = inner[i];
        setVertex(frameVertices, i, v[0], v[1], v[2]);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, frameBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, frameVertices.subarray(0, 12), gl.STREAM_DRAW);
      gl.drawArrays(gl.LINE_LOOP, 0, 4);
    };

    const calculateDistance = () => {
      let multiplier = 1.0;
      if (state.input.mouseY01 > 0.5) {
        const bottomProgress = (state.input.mouseY01 - 0.5) / 0.5;
        multiplier = 1.0 + bottomProgress * config.appearance.distanceMultiplierFactor;
      }
      return config.camera.distance * multiplier;
    };

    const calculateTrailVertices = (
      trailIndex: number,
      timeInSeconds: number,
      curveReduction: number,
      spiralRadius: number,
      startAngle: number
    ) => {
      let totalDepth = 0;
      const distance = calculateDistance();
      const eyeVector = [
        Math.sin(state.camera.current.rotY) * distance,
        Math.sin(state.camera.current.rotXActive) * distance,
        Math.cos(state.camera.current.rotXActive) * distance
      ];

      for (let i = 0; i < config.trails.segmentCount; i += 1) {
        const segmentRatio = i / config.trails.segmentCount;
        const spiralOffset = segmentRatio * config.trails.spiralOffsetFactor * curveReduction;
        const currentAngle = startAngle + (segmentRatio - 0.5) * config.trails.arcLength + spiralOffset;

        const segmentRadius =
          spiralRadius +
          Math.sin(segmentRatio * PI * 1.5 + timeInSeconds * 12.0 + trailIndex * 0.5) *
            config.trails.segmentRadiusSinFactor *
            curveReduction +
          Math.cos(segmentRatio * PI * 2 + timeInSeconds * 9.0 + trailIndex * 0.8) *
            config.trails.segmentRadiusCosFactor *
            curveReduction;

        const clampedRadius = Math.max(0.2, segmentRadius);
        const circleX = Math.cos(currentAngle) * clampedRadius;
        const circleY = Math.sin(currentAngle) * clampedRadius;
        const circleZ =
          Math.sin(currentAngle + timeInSeconds * 2.5 + trailIndex * 0.5) *
          config.trails.circleZFactor *
          curveReduction;

        const sphereCoords = getLayeredSphereCoordinates(trailIndex, currentAngle, Math.max(0.2, clampedRadius * 0.8));

        const blend = state.morph.sphere;
        const x = circleX * (1 - blend) + sphereCoords.x * blend;
        const y = circleY * (1 - blend) + sphereCoords.y * blend;
        const z = circleZ * (1 - blend) + sphereCoords.z * blend;

        setVertex(trailPoints, i, x, y, z);

        const dx = x - eyeVector[0];
        const dy = y - eyeVector[1];
        const dz = z - eyeVector[2];
        totalDepth += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      return totalDepth / config.trails.segmentCount;
    };

    const buildBatchedTrailGeometry = (timeInSeconds: number) => {
      const positions: number[] = [];
      const colors: number[] = [];

      const radiusReductionOnMouseDown = state.input.isDown ? config.trails.radiusReductionOnMouseDown : 0;
      const angleProgress = clamp01(
        (state.camera.current.rotXActive - config.camera.scroll.minDeg * D2R) /
          (0 - config.camera.scroll.minDeg * D2R)
      );
      const radiusReductionFromAngle = angleProgress * config.trails.radiusReductionFromAngleFactor;
      const effectiveRadius = state.radius.current - radiusReductionOnMouseDown - radiusReductionFromAngle;

      for (let trailIndex = 0; trailIndex < config.trails.count; trailIndex += 1) {
        const trailAngle = (trailIndex / config.trails.count) * PI * 2;
        const isOuterTrail = trailIndex % 4 === 0;
        const baseVariation = Math.sin(timeInSeconds * 6.0 + trailIndex * 0.8) * 0.02;
        const outerOffset = isOuterTrail ? 0.08 + Math.sin(timeInSeconds * 4.0 + trailIndex * 1.5) * 0.04 : 0;

        const speedRatio =
          (state.time.speed - config.animation.baseSpeed) /
          (config.animation.boostSpeed - config.animation.baseSpeed);
        const curveReduction = Math.max(0.25, 1.0 - speedRatio * 0.8);
        const baseRadiusForTrail = effectiveRadius + (baseVariation + outerOffset) * curveReduction;

        for (let layer = 0; layer < config.trails.layers; layer += 1) {
          const layerAngleOffset = layer * config.trails.layerAngleOffset;
          const angleVariation = Math.sin(timeInSeconds * 4.4 + trailIndex * 1.5) * 0.1 * curveReduction;
          const startAngle = state.time.rotationOffset - layerAngleOffset + trailAngle + angleVariation;

          const averageDistance = calculateTrailVertices(
            trailIndex,
            timeInSeconds,
            curveReduction,
            baseRadiusForTrail,
            startAngle
          );

          const distance = calculateDistance();
          const distanceFromFocus = Math.max(0, averageDistance - distance);
          const blurFactor = Math.min(1.0, distanceFromFocus / config.appearance.maxBlurDistance);

          const depthOpacity =
            config.appearance.minOpacity +
            (config.appearance.maxOpacity - config.appearance.minOpacity) * (1.0 - blurFactor);

          const baseAlpha =
            (0.6 + Math.sin(timeInSeconds * 3.5 + trailIndex * 0.3) * config.appearance.baseAlphaFactor) *
            depthOpacity;
          const layerFade = Math.pow(config.appearance.layerFadePower, layer);
          const alphaBoost = 1;
          const alpha = Math.min(1.0, baseAlpha * layerFade * alphaBoost);

          const brightness =
            (state.input.isDown && layer < 2
              ? config.appearance.brightnessMouseDown
              : config.appearance.brightness) *
            (1.0 - blurFactor * config.appearance.brightnessBlurFactor);

          const lineColor = darkMode ? brightness : 0;

          for (let i = 1; i < config.trails.segmentCount; i += 1) {
            const prevOffset = (i - 1) * 3;
            const currOffset = i * 3;

            const x0 = trailPoints[prevOffset];
            const y0 = trailPoints[prevOffset + 1];
            const z0 = trailPoints[prevOffset + 2];
            const x1 = trailPoints[currOffset];
            const y1 = trailPoints[currOffset + 1];
            const z1 = trailPoints[currOffset + 2];

            positions.push(x0, y0, z0, x1, y1, z1);
            colors.push(lineColor, lineColor, lineColor, alpha, lineColor, lineColor, lineColor, alpha);
          }
        }
      }

      return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        vertexCount: positions.length / 3
      };
    };

    const updateAnimationState = (timeInSeconds: number) => {
      const dt = timeInSeconds - state.time.last;
      state.time.last = timeInSeconds;

      let targetSpeed = config.animation.baseSpeed;
      if (state.input.isDown) targetSpeed = config.animation.boostSpeed;
      else if (state.morph.sphere > 0.01) targetSpeed = config.animation.hoverSpeed;

      state.time.speed += (targetSpeed - state.time.speed) * 0.2;
      state.radius.current += (state.radius.target - state.radius.current) * 0.24;
      state.morph.sphere += (state.morph.targetSphere - state.morph.sphere) * 0.3;
      state.time.rotationOffset += state.time.speed * dt;

      const smooth = 0.12;
      state.camera.current.rotXCenter += (state.camera.target.rotXCenter - state.camera.current.rotXCenter) * smooth;
      state.camera.current.rotY += (state.camera.target.rotY - state.camera.current.rotY) * smooth;
      state.camera.parallax.current.x += (state.camera.parallax.target.x - state.camera.parallax.current.x) * 0.18;
      state.camera.parallax.current.y += (state.camera.parallax.target.y - state.camera.parallax.current.y) * 0.18;
      state.scale.current += (state.scale.target - state.scale.current) * smooth * 2;
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      const nx = clientX / vw;
      const ny = clientY / vh;
      state.input.mouseY01 = clamp01(ny);
      state.input.mouseX = nx;

      state.camera.target.rotXCenter = calculateCameraAngleForCenter(state.input.mouseY01);
      const normalizedMouseX = (1 - nx) * 2 - 1;
      state.camera.target.rotY = normalizedMouseX * (config.camera.mouseRotationDeg * D2R);
      const centeredY = ny * 2 - 1;
      state.camera.parallax.target.y = normalizedMouseX * config.interaction.maxParallax;
      state.camera.parallax.target.x = centeredY * config.interaction.maxParallax;
    };

    const onWindowMouseMove = (event: MouseEvent) => onPointerMove(event.clientX, event.clientY);
    const onWindowTouchMove = (event: TouchEvent) => {
      if (!event.touches[0]) return;
      onPointerMove(event.touches[0].clientX, event.touches[0].clientY);
    };

    const onDown = () => {
      state.input.isDown = true;
      state.radius.target = config.trails.reducedRadius;
      state.scale.target = config.interaction.pressedScale;
    };

    const onUp = () => {
      state.input.isDown = false;
      state.radius.target = config.trails.baseRadius;
      state.scale.target = state.input.isOver ? config.interaction.hoverScale : config.interaction.baseScale;
    };

    const onEnter = () => {
      state.input.isOver = true;
      state.morph.targetSphere = 1;
      state.scale.target = config.interaction.hoverScale;
    };

    const onLeave = () => {
      state.input.isOver = false;
      state.input.isDown = false;
      state.morph.targetSphere = 0;
      state.radius.target = config.trails.baseRadius;
      state.scale.target = config.interaction.baseScale;
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseenter", onEnter);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    canvas.addEventListener("touchend", onUp, { passive: true });

    window.addEventListener("resize", resize);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => {
      darkMode = getThemeMode() === "dark";
    };
    media.addEventListener("change", onThemeChange);

    const observer = new MutationObserver(onThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resize();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.STENCIL_TEST);
    gl.clearColor(0, 0, 0, 0);

    const render = (timestamp: number) => {
      const timeInSeconds = timestamp * 0.001;
      if (state.time.last === 0) state.time.last = timeInSeconds;
      updateAnimationState(timeInSeconds);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.useProgram(program);

      if (uniProj) gl.uniformMatrix4fv(uniProj, false, projectionMatrix);

      const rotationX = state.camera.current.rotXCenter;
      state.camera.current.rotXActive = rotationX;

      updateCameraViewMatrix(rotationX, state.camera.current.rotY, calculateDistance());
      updateFrameViewMatrix(state.scale.current);

      drawFrameMask();

      identityMatrix(modelMatrix);
      if (uniView) gl.uniformMatrix4fv(uniView, false, cameraViewMatrix);
      if (uniModel) gl.uniformMatrix4fv(uniModel, false, modelMatrix);

      gl.stencilFunc(gl.EQUAL, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

      const batch = buildBatchedTrailGeometry(timeInSeconds);

      gl.bindBuffer(gl.ARRAY_BUFFER, batchPosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, batch.positions, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(attrPos);
      gl.vertexAttribPointer(attrPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, batchColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, batch.colors, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(attrCol);
      gl.vertexAttribPointer(attrCol, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.LINES, 0, batch.vertexCount);

      drawFrame();
    };

    if (reduceMotion) {
      render(0);
      return () => {
        observer.disconnect();
        media.removeEventListener("change", onThemeChange);
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("touchmove", onWindowTouchMove);
        canvas.removeEventListener("mousedown", onDown);
        canvas.removeEventListener("mouseup", onUp);
        canvas.removeEventListener("mouseenter", onEnter);
        canvas.removeEventListener("mouseleave", onLeave);
        canvas.removeEventListener("touchstart", onDown);
        canvas.removeEventListener("touchend", onUp);
      };
    }

    let raf = 0;
    const loop = (ts: number) => {
      render(ts);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      media.removeEventListener("change", onThemeChange);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("touchmove", onWindowTouchMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseenter", onEnter);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <div className="home-frame-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className="home-frame-canvas" />
    </div>
  );
}
