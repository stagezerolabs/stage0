import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import NotFoundPage from './NotFoundPage';

afterEach(cleanup);

it('offers a way back from an unknown route', () => {
  render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /Page not found/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Back to home/ }).getAttribute('href')).toBe('/');
});
