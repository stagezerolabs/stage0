import { useEffect, useRef } from 'react';

// One full-screen triangle; the fragment shader does both the waves and the dithering.
const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// The canvas is drawn at 1/pixelSize resolution and upscaled by CSS, so one
// fragment here is one dither block. That is 4x fewer invocations than
// shading every screen pixel and pixelating afterwards.
const fragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform float enableMouseInteraction;
uniform float mouseRadius;
uniform float colorNum;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

// 8x8 ordered-dither threshold without a const array (not allowed in WebGL1).
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

// The old three.js pipeline encoded its output to sRGB; keep the same brightness.
vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction > 0.5) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    f -= 0.5 * (1.0 - smoothstep(0.0, mouseRadius, dist));
  }
  vec3 color = mix(vec3(0.0), waveColor, f);

  float threshold = bayer8(gl_FragCoord.xy) - 0.25;
  float levels = colorNum - 1.0;
  color += threshold / levels;
  color = clamp(color - 0.2, 0.0, 1.0);
  color = floor(color * levels + 0.5) / levels;
  gl_FragColor = vec4(linearToSRGB(color), 1.0);
}
`;

const UNIFORMS = [
    'resolution',
    'time',
    'waveSpeed',
    'waveFrequency',
    'waveAmplitude',
    'waveColor',
    'mousePos',
    'enableMouseInteraction',
    'mouseRadius',
    'colorNum'
] as const;

type UniformName = (typeof UNIFORMS)[number];

const FRAME_INTERVAL_MS = 1000 / 30;

interface DitherProps {
    waveSpeed?: number;
    waveFrequency?: number;
    waveAmplitude?: number;
    waveColor?: [number, number, number];
    colorNum?: number;
    pixelSize?: number;
    disableAnimation?: boolean;
    enableMouseInteraction?: boolean;
    mouseRadius?: number;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Dither shader failed to compile', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

export default function Dither({
    waveSpeed = 0.05,
    waveFrequency = 3,
    waveAmplitude = 0.3,
    waveColor = [0.5, 0.5, 0.5],
    colorNum = 4,
    pixelSize = 2,
    disableAnimation = false,
    enableMouseInteraction = true,
    mouseRadius = 1
}: DitherProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const props = { waveSpeed, waveFrequency, waveAmplitude, waveColor, colorNum, pixelSize, disableAnimation, enableMouseInteraction, mouseRadius };
    const propsRef = useRef(props);
    const refreshRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        propsRef.current = props;
        refreshRef.current();
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const maybeGl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'low-power'
        });
        if (!maybeGl) return;
        const gl: WebGLRenderingContext = maybeGl;

        let program: WebGLProgram | null = null;
        let buffer: WebGLBuffer | null = null;
        let locations = {} as Record<UniformName, WebGLUniformLocation | null>;
        let contextLost = false;
        let visible = true;
        let cssWidth = canvas.clientWidth;
        let cssHeight = canvas.clientHeight;
        const mouse = { x: 0, y: 0 };
        const startedAt = performance.now();
        let frameId = 0;
        let lastFrameAt = -Infinity;

        function setup() {
            const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
            const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
            if (!vertex || !fragment) return;
            program = gl.createProgram();
            gl.attachShader(program, vertex);
            gl.attachShader(program, fragment);
            gl.linkProgram(program);
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Dither program failed to link', gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                program = null;
                return;
            }
            gl.useProgram(program);

            buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const position = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

            locations = Object.fromEntries(
                UNIFORMS.map((name) => [name, gl.getUniformLocation(program!, name)])
            ) as Record<UniformName, WebGLUniformLocation | null>;
        }

        function resize() {
            const scale = propsRef.current.pixelSize;
            const width = Math.max(1, Math.round(cssWidth / scale));
            const height = Math.max(1, Math.round(cssHeight / scale));
            if (canvas!.width !== width || canvas!.height !== height) {
                canvas!.width = width;
                canvas!.height = height;
                gl.viewport(0, 0, width, height);
            }
        }

        function draw(now: number) {
            if (!program || contextLost) return;
            const p = propsRef.current;
            resize();
            gl.uniform2f(locations.resolution, canvas!.width, canvas!.height);
            gl.uniform1f(locations.time, p.disableAnimation ? 0 : (now - startedAt) / 1000);
            gl.uniform1f(locations.waveSpeed, p.waveSpeed);
            gl.uniform1f(locations.waveFrequency, p.waveFrequency);
            gl.uniform1f(locations.waveAmplitude, p.waveAmplitude);
            gl.uniform3f(locations.waveColor, p.waveColor[0], p.waveColor[1], p.waveColor[2]);
            gl.uniform2f(locations.mousePos, mouse.x / p.pixelSize, mouse.y / p.pixelSize);
            gl.uniform1f(locations.enableMouseInteraction, p.enableMouseInteraction ? 1 : 0);
            gl.uniform1f(locations.mouseRadius, p.mouseRadius);
            gl.uniform1f(locations.colorNum, p.colorNum);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        const shouldAnimate = () => !propsRef.current.disableAnimation && visible && !document.hidden && !contextLost;

        function onFrame(now: number) {
            frameId = 0;
            if (shouldAnimate()) {
                frameId = requestAnimationFrame(onFrame);
                if (now - lastFrameAt < FRAME_INTERVAL_MS - 1) return;
            }
            lastFrameAt = now;
            draw(now);
        }

        // Starts or stops the loop, or schedules one frame when animation is off.
        function refresh() {
            if (!frameId && !contextLost) frameId = requestAnimationFrame(onFrame);
        }
        refreshRef.current = refresh;

        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
            cssWidth = entry.contentRect.width;
            cssHeight = entry.contentRect.height;
            refresh();
        });
        resizeObserver?.observe(canvas);

        const intersectionObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) refresh();
        });
        intersectionObserver?.observe(canvas);

        const onVisibilityChange = () => {
            if (!document.hidden) refresh();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!propsRef.current.enableMouseInteraction) return;
            mouse.x = event.offsetX;
            mouse.y = event.offsetY;
            refresh();
        };
        const onContextLost = (event: Event) => {
            event.preventDefault();
            contextLost = true;
            program = null;
            buffer = null;
            if (frameId) cancelAnimationFrame(frameId);
            frameId = 0;
        };
        const onContextRestored = () => {
            contextLost = false;
            setup();
            refresh();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('webglcontextlost', onContextLost);
        canvas.addEventListener('webglcontextrestored', onContextRestored);

        setup();
        refresh();

        return () => {
            refreshRef.current = () => undefined;
            if (frameId) cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            intersectionObserver?.disconnect();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            canvas.removeEventListener('webglcontextrestored', onContextRestored);
            if (program) gl.deleteProgram(program);
            if (buffer) gl.deleteBuffer(buffer);
            // StrictMode (dev) re-runs this effect on the same canvas, and getContext would
            // hand back a lost context. Only release it once the canvas has left the page.
            window.setTimeout(() => {
                if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
            }, 0);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full h-full relative"
            style={{ imageRendering: 'pixelated' }}
            aria-hidden="true"
        />
    );
}
