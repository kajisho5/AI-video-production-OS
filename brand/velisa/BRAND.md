# Velisa — Logo Guidelines

## 1. The logo
- **Idea:** every step of a production plan converges on one verified point. The arms of the V stop short of each other (independent pieces that never reach into each other's internals); the green dot is the verified artifact.
- **Versions:** horizontal (primary) · stacked · symbol · wordmark · README banner · app icon.
- **Files:** `svg/` for anything on screen or in print, `png/` when SVG is not accepted, `web/` for favicons and app icons.

## 2. Clear space
Keep a free zone of **one dot diameter** on every side of the logo. The zone scales with the logo.

## 3. Minimum size
| Version | Screen |
|---|---|
| Horizontal lockup | 96 px wide |
| Symbol | 24 px (`velisa-symbol.svg`) |
| Symbol, smaller than 24 px | `velisa-symbol-small.svg` or `web/favicon.svg` (thicker arms, wider gap) |

## 4. Colour
| Name | HEX | RGB | Use |
|---|---|---|---|
| Ink | `#101114` | 16, 17, 20 | Arms and wordmark on light backgrounds; dark backgrounds |
| Key Green | `#00A63E` | 0, 166, 62 | The dot on light backgrounds (3.2 : 1 against white) |
| Key Green Bright | `#17D16A` | 23, 209, 106 | The dot on dark backgrounds (9.3 : 1 against Ink) |
| White | `#FFFFFF` | 255, 255, 255 | Arms and wordmark on dark backgrounds |

Approved pairs: colour logo on white · `-on-dark` logo on Ink · all-black on white · all-white on any dark or photographic background.
Green is used only for the dot (and, in the wider system, for "verified / pass" signals). Never colour the arms or the wordmark green.

## 5. Wordmark
The wordmark **VELISΛ** is drawn, not typed: a round-ended monoline with the A drawn without a crossbar, so the name opens with V and closes with its mirror. Never retype it in a font. Running text uses the system font stack.

## 6. Don'ts
Don't stretch, rotate or add effects (shadows, outlines, gradients). Don't move the dot or join the arms. Don't change the spacing or size ratio inside a lockup. Don't put the colour version on busy backgrounds — use the all-white or all-black version.

## 7. Files
```
svg/  velisa-symbol(.svg|-on-dark|-black|-white|-small|-small-on-dark)
      velisa-horizontal(-on-dark|-black|-white)  velisa-stacked(-on-dark)
      velisa-wordmark(-white)  velisa-app-icon(-full)  velisa-readme-banner-(dark|light)
png/  1200 px PNG of the main versions
web/  favicon.svg (switches with dark mode) · favicon.ico · favicon-16/32/48.png
      apple-touch-icon.png · icon-192/512.png · maskable-512.png · site.webmanifest · head-snippet.html
```

### README header
```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/velisa/velisa-readme-banner-dark.svg">
  <img alt="Velisa" src="brand/velisa/velisa-readme-banner-light.svg" width="640">
</picture>
```
