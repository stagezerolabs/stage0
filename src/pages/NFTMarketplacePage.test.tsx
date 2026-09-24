import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import NFTMarketplacePage from './NFTMarketplacePage';

afterEach(cleanup);

function renderPage() {
  return render(<MemoryRouter><NFTMarketplacePage /></MemoryRouter>);
}

it('shows a clearly labeled NFT marketplace demo with featured items and rankings', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'NFT Marketplace' })).toBeTruthy();
  expect(screen.getAllByText(/Demo data/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: 'Featured collections' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Trending collections' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Explore NFTs' })).toBeTruthy();
  expect(screen.getByText('Liquid Koi #082')).toBeTruthy();
});

it('filters NFT cards by search and category', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search marketplace' }), {
    target: { value: 'Liquid Koi' },
  });
  expect(screen.getByText('Liquid Koi #082')).toBeTruthy();
  expect(screen.queryByText('Ember Bloom #208')).toBeNull();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search marketplace' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Collectibles' }));
  expect(screen.getByText('Blue Orbit #026')).toBeTruthy();
  expect(screen.queryByText('Liquid Koi #082')).toBeNull();
});

it('opens an item preview without offering a live purchase', () => {
  renderPage();
  const trigger = screen.getByRole('button', { name: /View Liquid Koi #082/ });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Liquid Koi #082' })).toBeTruthy();
  expect(screen.getByText(/Transactions are disabled in this demo/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buy now (demo)' })).toHaveProperty('disabled', true);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close item preview' }));
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe('');
});

it('changes ranking order and metrics with the selected ranking and timeframe', () => {
  renderPage();
  const rankButtons = () => screen.getAllByRole('button', { name: /Explore .* collection$/ });
  expect(rankButtons()[0].getAttribute('aria-label')).toBe('Explore Fuzz Club collection');
  fireEvent.click(screen.getByRole('button', { name: 'Top' }));
  expect(rankButtons()[0].getAttribute('aria-label')).toBe('Explore Chrome Tide collection');
  fireEvent.click(screen.getByRole('button', { name: '7d' }));
  expect(screen.getByText('+6.2%')).toBeTruthy();
});
