import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LazyLoadBoundary from './LazyLoadBoundary';

function FailedChunk(): never {
  throw new Error('chunk failed');
}

afterEach(() => vi.restoreAllMocks());

it('keeps the surrounding page mounted when a deferred chunk fails', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  render(
    <div>
      <p>Page content</p>
      <LazyLoadBoundary fallback={<p>Could not load widget</p>}>
        <FailedChunk />
      </LazyLoadBoundary>
    </div>,
  );

  expect(screen.getByText('Page content')).toBeTruthy();
  expect(screen.getByText('Could not load widget')).toBeTruthy();
});
