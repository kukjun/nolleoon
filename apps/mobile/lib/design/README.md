# Flutter / current travel web design mapping

Source snapshot: d551688, 2026-11-19. Current travel route is the authority, not the older `.party-app` visual scope. Flutter uses native Korean/system font fallback rather than downloading a font or assuming CSS font metrics match exactly.

| Web source | Flutter mapping |
| --- | --- |
| `travel.css .travel-app` fallback canvas `#faf8f3`, ink `#243a32` | AppTokens.canvas/ink, scaffold/onSurface |
| `.travel-muted` `#617167`,13px,1.7 | muted, bodySmall |
| `.travel-card` white, border `#dce3d9`,20px radius | surface/line/cardRadius, flat CardThemeData |
| `.travel-room-card`16px radius | roomCardRadius (feature card) |
| `.travel-main h1`28px,1.4,-1px | headlineSmall |
| `.travel-main h2`21px,1.5 | titleLarge |
| `design/styles.css :root`16px,1.65 | bodyLarge/bodyMedium |
| `.button--primary` `--brand:#245ce2`,white | primary/onPrimary, filled button |
| `.button`48px,12px20px padding,14px radius,15px/1.5/650 weight | tap/buttonRadius, button theme; native weight600 approximation |
| `.travel-textarea` border `#c7d4c9`,12px radius | input theme (no forced fixed height) |
| `.travel-main :focus-visible` amber `#bd812d` | focused input outline,3px |
| `.travel-members` `#f4f7f1` and games `#f5f8f2` | memberSurface/gameSurface |
| `.travel-presets :checked` `#315b43`/`#edf4e8` | selected/selectedSurface |
| `.travel-main` max-width680,padding20 | pageWidth/pagePadding; feature chooses responsive layout |

Legacy `party-tokens.css` (`#f5f5f0`, accent `#2455e8`, radius24, width460) was inspected but is deliberately not mixed into the travel global theme. `party-layout.css`'s 32px greeting/stage illustration belongs to that older scope, not current travel card headings.

Accessibility: padded native48dp targets retained; foreground/background and CTA contrast tests require4.5:1. Native text scaling is not clamped, inputs/buttons can wrap and grow, no fixed card height. Cards remove Material seed-tinted elevation to match web white bordered surfaces. No request/controller/game/auth behavior changes.
