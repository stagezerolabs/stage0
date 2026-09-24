import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dither from './Dither';

type FrameCallback = (now: number) => void;

let frames: Map<number, FrameCallback>;
let nextFrameId: number;

function flushFrame(now: number) {
  const pending = [...frames.entries()];
  frames.clear();
  pending.forEach(([, callback]) => callback(now));
}

function fakeWebGL() {
  const loseContext = vi.fn();
  const drawArrays = vi.fn();
  const gl = new Proxy(
    { drawArrays, getExtension: () => ({ loseContext }) } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
        if (/^[A-Z_]+$/.test(key)) return 0;
        return () => ({});
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as unknown as WebGLRenderingContext);
  return { drawArrays, loseContext };
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('renders a canvas without WebGL instead of throwing', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

  const { container } = render(<Dither />);

  expect(container.querySelector('canvas')).toBeTruthy();
});

it('animates with a single draw per frame and releases the GPU context on unmount', async () => {
  const { drawArrays, loseContext } = fakeWebGL();

  const { unmount } = render(<Dither />);
  flushFrame(100);
  flushFrame(200);

  expect(drawArrays).toHaveBeenCalledTimes(2);
  expect(frames.size).toBe(1);

  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(frames.size).toBe(0);
  expect(loseContext).toHaveBeenCalledTimes(1);
});

it('keeps its GPU context through a StrictMode remount', async () => {
  const { drawArrays, loseContext } = fakeWebGL();

  render(
    <StrictMode>
      <Dither />
    </StrictMode>,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushFrame(100);

  expect(loseContext).not.toHaveBeenCalled();
  expect(drawArrays).toHaveBeenCalledTimes(1);
});

it('draws one still frame when animation is disabled', () => {
  const { drawArrays } = fakeWebGL();

  render(<Dither disableAnimation enableMouseInteraction={false} />);
  flushFrame(100);
  flushFrame(200);

  expect(drawArrays).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
});
