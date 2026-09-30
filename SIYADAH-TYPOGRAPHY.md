# Siyadah typography and spatial rhythm

Source of truth: `siyadah-theme.css`. These roles are shared across customer pages, so another theme changes values without rewriting the layout. The account page is the first fully mapped surface; other pages still need visual review before adopting its exact sizes.

## Two font roles per language

| Language | Display: short titles and the example's main line | Body: fields, controls, explanations |
|---|---|---|
| Arabic | Readex Pro, 440 for the story and 520 for page titles | IBM Plex Sans Arabic, 400 for reading and 500 for controls |
| English | Jost, 330 for the story and 470 for page titles | Inter, 400 for reading and 500 for controls |

All fonts are self hosted through `fonts.css`, with `font-display: swap`. Arabic display text keeps natural letter spacing. English titles use a slight negative spacing. The original wordmark remains an asset, so its letterforms do not change with the interface fonts.

## Size roles

All values below assume the default 16px root size. The `rem` based limits let browser text scaling affect the hierarchy.

| Token | Use | Range |
|---|---|---|
| `--type-display-xl` | public hero when appropriate | 48–88px |
| `--type-display` | product story title | 36–52px |
| `--type-page` | page task title | 32–42px |
| `--type-section` | section title, including the compact mobile story | 22–28px |
| `--type-scene` | one selected example | 18–22px |
| `--type-body`, `--type-control` | reading, fields, main action | 16px |
| `--type-label` | labels, feedback, meaningful secondary actions | 14px |
| `--type-note` | nonessential metadata | 13px |

Arabic line height: 1.24 for display and 1.7 for body. English: 1.14 and 1.6. Notes use 1.55. Do not shrink errors, permissions, prices, or required next steps to the metadata size.

## Spacing and dimensions

Spacing tokens follow 4px increments: 4, 8, 12, 16, 20, 24, 32, 40, 48, and 64px. Reuse the tokens for repeated relationships instead of choosing a new gap for each component. The account shell has a 1120px maximum width, its form measure is 440px, and primary controls are at least 52px tall. On narrow screens the form comes first and the illustrative story follows it. Use `ch` based measures for prose, not an arbitrary full width.

The blue accent marks focus, selection, and progress; titles and long reading stay black on white or white on black. Motion must indicate a changed state and respect reduced motion. Check Arabic RTL and English LTR at 320px, 360px, and desktop widths, plus browser text enlargement, before applying a type role to another page.
