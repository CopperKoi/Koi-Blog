"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uBg1;
uniform vec3 uBg2;
uniform vec3 uGlow;
uniform float uFlat;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float starLayer(vec2 uv, float scale, float density) {
  vec2 gv = fract(uv * scale) - 0.5;
  vec2 id = floor(uv * scale);
  float h = hash(id);
  float star = smoothstep(density, 1.0, h);
  float d = length(gv);
  return star * smoothstep(0.4, 0.0, d);
}

vec3 background(vec2 uv) {
  vec3 base = uBg1;
  float s1 = starLayer(uv + uTime * 0.01, 22.0, 0.985);
  float s2 = starLayer(uv - uTime * 0.02, 40.0, 0.992);
  float ring = smoothstep(0.8, 0.2, abs(length(uv) - 0.6));
  float stars = (s1 + s2) * (0.6 + ring * 0.8);
  return base + vec3(stars);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  vec2 m = (uMouse - 0.5) * 0.12;
  uv += m;

  vec3 col = background(uv);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function HomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      canvas.dataset.fallback = "true";
      return;
    }

    const compile = (type: number, source: string) => {
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

    const vertex = compile(gl.VERTEX_SHADER, VERT);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uBg1 = gl.getUniformLocation(program, "uBg1");
    const uBg2 = gl.getUniformLocation(program, "uBg2");
    const uGlow = gl.getUniformLocation(program, "uGlow");
    const uFlat = gl.getUniformLocation(program, "uFlat");

    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const getTheme = () => {
      const root = document.documentElement;
      const stored = root.getAttribute("data-theme");
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    const parseColor = (value: string) => {
      const v = value.trim();
      if (!v) return [0, 0, 0];
      if (v.startsWith("#")) {
        const hex = v.replace("#", "");
        const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
        const num = parseInt(full, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
      }
      const match = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
      return [0, 0, 0];
    };

    const applyTheme = () => {
      const styles = getComputedStyle(document.documentElement);
      const bg1 = parseColor(styles.getPropertyValue("--page-bg"));
      const bg2 = parseColor(styles.getPropertyValue("--page-bg-soft"));
      const accent =
        styles.getPropertyValue("--theme-accent") || styles.getPropertyValue("--brand") || "#7a8da2";
      const glow = parseColor(accent);
      const theme = getTheme();

      gl.uniform3f(uBg1, bg1[0] / 255, bg1[1] / 255, bg1[2] / 255);
      gl.uniform3f(uBg2, bg2[0] / 255, bg2[1] / 255, bg2[2] / 255);
      gl.uniform3f(uGlow, glow[0] / 255, glow[1] / 255, glow[2] / 255);
      gl.uniform1f(uFlat, theme === "dark" ? 1 : 0);
    };

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (event.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (event.clientY - rect.top) / rect.height;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", setSize);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => applyTheme();
    media.addEventListener("change", handleMedia);

    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    setSize();
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    applyTheme();

    let raf = 0;
    const start = performance.now();
    const render = () => {
      const now = (performance.now() - start) * 0.001;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.useProgram(program);
      gl.uniform1f(uTime, now);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      media.removeEventListener("change", handleMedia);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", setSize);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-canvas" aria-hidden="true" />;
}
