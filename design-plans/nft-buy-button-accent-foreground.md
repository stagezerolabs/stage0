# Demo Buy button uses the accent foreground color

Written against: 1fbf88d

## Evidence chain

- Surface: `/nft-marketplace`, item preview dialog, "Buy now (demo)" button
- Problem: The label is white on the green accent at 55% opacity and is barely legible (Chrome computed `color: rgb(255, 255, 255)`, `background-color: rgb(4, 223, 131)`, `opacity: 0.55`).
- Design evidence: The theme pairs the accent with `--color-accent-foreground` (`src/index.css:38`, `11 14 17` in dark; `:104`, `34 24 14` in light). `.btn-primary` applies it (`src/index.css:291`: `bg-accent text-accent-foreground`). On this same page, the "Create collection" link uses `.btn-primary` (`src/pages/NFTMarketplacePage.tsx:295`).
- Owner: `src/pages/NFTMarketplacePage.tsx:312`
- Scope and affected surfaces: this button only
- Uncertainty: none

## Design decision

Replace `text-white` with the `text-accent-foreground` token so the button's label follows the same foreground-on-accent pairing as every other accent button, in both themes.

## Reuse

- Tailwind color `accent-foreground` (`tailwind.config`)
- Exemplar: `.btn-primary` (`src/index.css:290-296`)

## Changes

1. `src/pages/NFTMarketplacePage.tsx:312`
   - Change: `text-white` → `text-accent-foreground`.
   - Preserve: `disabled`, `cursor-not-allowed`, `opacity-55`, size and shape; the button stays disabled.
   - Verify: computed color is `rgb(11, 14, 17)` in the dark theme.

## Scope

- Inherit: the Buy button
- Verify: existing test asserting the button is disabled
- Exclude: other accent buttons (already correct)

## Validation

- Product: the disabled demo Buy label is readable while clearly inactive.
- Interface: dark and light themes.
- System: uses the existing token; no new color.
- Repository: `npm run test -- src/pages/NFTMarketplacePage.test.tsx` → all pass

## Stop conditions

- Stop if the button is changed to be enabled (purchase flows are out of scope for the demo).

## Design documentation

- After acceptance and validation: none
