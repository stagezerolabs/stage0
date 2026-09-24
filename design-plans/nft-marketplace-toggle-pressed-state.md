# Marketplace filter toggles expose their selected state

Written against: 1fbf88d

## Evidence chain

- Surface: `/nft-marketplace`: category chips, Trending/Top ranking, 24h/7d/30d timeframe
- Problem: These 12 toggle buttons show which one is selected only through color and background, so assistive technology can't tell which option is active.
- Design evidence: On the same page, the favorite toggle already exposes its state with `aria-pressed={isFavorite}` (`src/pages/NFTMarketplacePage.tsx:276`). The category (`:166-171`), ranking (`:217`) and timeframe (`:221`) buttons compute an active style but set no pressed state.
- Owner: `src/pages/NFTMarketplacePage.tsx`
- Scope and affected surfaces: those three button groups
- Uncertainty: none

## Design decision

Give each toggle `aria-pressed`, set from exactly the condition that already selects its active style. Visual styling doesn't change.

## Reuse

- The existing `aria-pressed` pattern
- Exemplar: `src/pages/NFTMarketplacePage.tsx:276`

## Changes

1. `src/pages/NFTMarketplacePage.tsx`
   - Change: category buttons get `aria-pressed={category === entry && !collectionId}`; ranking buttons get `aria-pressed={ranking === entry}`; timeframe buttons get `aria-pressed={timeframe === entry}`.
   - Preserve: the class logic and click handlers.
   - Verify: on first render "All", "Trending" and "24h" are pressed; after clicking "Collectibles", "Top" and "7d", those are pressed and the previous ones are not; selecting a collection clears the category pressed state, matching the visuals.

## Scope

- Inherit: the three toggle groups
- Verify: existing filter and ranking tests
- Exclude: the sort `<select>` (a native control that already exposes its value)

## Validation

- Product: a screen reader announces "pressed" on the active category, ranking and timeframe.
- Interface: desktop and mobile; styling unchanged.
- System: same attribute pattern as the favorite toggle.
- Repository: `npm run test -- src/pages/NFTMarketplacePage.test.tsx` → all pass

## Stop conditions

- Stop if a group is meant to be a tab list controlling a panel (then `role="tab"`/`aria-selected` would be the correct pattern instead).

## Design documentation

- After acceptance and validation: none
