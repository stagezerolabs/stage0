# NFT item preview dialog covers the whole page, including the header

Written against: 1fbf88d

## Evidence chain

- Surface: `/nft-marketplace`, item preview dialog (opened from any Explore NFTs card)
- Problem: With the dialog open, the site header stays bright above the overlay, and its controls still receive pointer events. A Chrome hit test at the Connect button's center returned `{"receivesClick":true,"topIsInDialog":false}` while the dialog declared `aria-modal="true"`.
- Design evidence: The dialog overlay renders inside `<main>`, which has computed `position: relative; z-index: 10` (`src/components/layout/Layout.tsx`, `<main className="relative flex-grow" style={{ zIndex: 10 }}>`). The header has computed `z-index: 50`. The overlay's `z-[100]` (`src/pages/NFTMarketplacePage.tsx:299`) only applies inside `<main>`'s stacking context, so it can never rise above the header.
- Owner: `src/pages/NFTMarketplacePage.tsx:298-316`
- Scope and affected surfaces: this dialog only
- Uncertainty: none

## Design decision

Render the preview overlay into `document.body` through a React portal. The overlay is then in the root stacking context, where its existing `z-[100]` sits above the header (`z-50`). It dims and blocks the whole viewport, as `aria-modal` promises. The dialog's layout, styling, focus trap, scroll lock and focus restore don't change.

## Reuse

- `createPortal` from `react-dom`
- Exemplar: `src/components/ui/responsive-dialog.tsx:71` (`createPortal(<overlay/>, document.body)`)

`ResponsiveDialog` itself is not adopted. It imposes its own title block, `max-w-xl` width and a mobile bottom sheet, which would replace the preview's two-column art-and-details layout.

## Changes

1. `src/pages/NFTMarketplacePage.tsx`
   - Change: wrap the overlay element (the `fixed inset-0 z-[100] …` div and its children) in `createPortal(…, document.body)`.
   - Preserve: all classes, `modalRef`/`modalCloseRef`, the backdrop click-to-close handler, the Escape/Tab handling effect, body scroll lock and focus restore.
   - Verify: the dialog is a descendant of `document.body` and not of the page container, and the header no longer receives clicks while it is open.

## Scope

- Inherit: the item preview dialog
- Verify: existing test "opens an item preview without offering a live purchase" (focus, scroll lock, Escape, focus restore)
- Exclude: other dialogs; `Layout`'s stacking contexts

## Validation

- Product: open an item preview; the header, nav and Connect button are dimmed and not clickable; clicking the backdrop or pressing Escape closes it.
- Interface: desktop, in dark and light themes; the AI copilot button no longer sits above the overlay.
- System: no new dialog primitive; same portal pattern as `ResponsiveDialog`.
- Repository: `npm run test -- src/pages/NFTMarketplacePage.test.tsx` → all pass

## Stop conditions

- Stop if the overlay's `z-[100]` is still below any fixed element once portaled (that would mean a global z-index scale decision is needed).

## Design documentation

- After acceptance and validation: none
