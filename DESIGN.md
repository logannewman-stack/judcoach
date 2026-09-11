# GRIT — design direction

GRIT should look and feel like **the best app Apple never shipped**. Bright,
rounded, colourful, alive. A client opens it in the morning and it is a pleasure
to look at; they open it between sets and it answers instantly.

That is the whole brief.

## 0. Two corrections, so nobody makes them again

**It was once stock iOS.** White cards on grey, system blue, nothing of its own.
Correct platform, no character. Being native is the floor, not the finish.

**Then it was an instrument.** Monospace tables, near-black, 3px corners. Precise
and cold — software for a machine operator, not an app a person is glad to open.

The answer is neither. It is iOS at its most expressive: Apple's own vocabulary —
soft continuous corners, generous colour, springy motion, translucent materials,
big friendly numerals — used with more care and more joy than most apps bother
with. **Very iOS. Very bright. Very round. Nothing sharp anywhere.**

## 1. Shape — nothing sharp

Roundness is the app's signature. Every surface is generously, softly rounded,
and the corners are *continuous* (the squircle iOS draws), never a plain arc.

| token | px | what it is |
|---|---|---|
| `--r-chip` | 14 | a small object: a set, a badge, a day |
| `--r-inset` | 18 | an inset-grouped list |
| `--r-card` | 22 | a card |
| `--r-btn` | 999 | **every button is a capsule** |
| `--r-field` | 16 | a field |
| `--r-sheet` / `--r-alert` | 28 | a panel in front of the app |
| `--r-bubble` | 22 | a message bubble |
| `--r-pill` | 999 | a pill |

If a shape needs a radius none of these names, it needs a name — add the token
and this row. Never type a number. `npm run conform` checks.

## 2. Colour — bright, and used generously

Apple's system palette, at full brightness, on a bright ground. Colour is not
rationed here: it is how the app tells you where you are and how you are doing.

**Every domain owns a colour**, the way Health and Fitness do. It tints that
tab's icons, its headers, its rings and its accents:

| domain | colour |
|---|---|
| Today | blue |
| Train | orange |
| Meals | green |
| Weigh-In | purple |
| Coach | pink |

`--tint` resolves to the current domain's colour; use it for anything that
belongs to that section. `--accent` stays blue and means *the primary action*.

**Intensity keeps its ramp.** RPE runs 6 to 10, cool to hot (`--rpe`,
`--rpe-fill`, `--rpe-solid`). It is the app's one original idea and it is
gloriously colourful, so it stays.

**Gradients are allowed** where Apple uses them — a hero card, a ring, a filled
capsule — as a *soft two-stop wash within one hue family*. Never rainbow, never
purple-to-blue, never on text.

Light is the primary appearance. Dark is a real, fully designed alternative that
keeps the same brightness of character.

## 3. Material and depth

Surfaces float. Cards sit on a tinted ground with a soft, wide, low-opacity
shadow — the iOS card, not a web box-shadow. Bars and sheets are translucent
materials with a blur behind them. Layering is real: the app recedes behind a
sheet, chrome blurs what passes under it.

## 4. Typography

| face | role |
|---|---|
| **SF Pro (system)** | every word: titles, rows, body, buttons |
| **SF Pro Rounded** (`ui-rounded`) | **every number** — targets, weights, counts, percentages, timers |

Rounded numerals are what makes an app feel warm rather than clinical; it is
what Apple Fitness and Activity use, and it is free on the device. Nunito is
bundled only so non-Apple browsers see something close in the demo.

Numbers are big and confident. A figure is a thing to be proud of, not a cell.

Classes: `.figure` (a hero number), `.data` (a number in a row), `.eyebrow` (a
small uppercase label). Never set a sentence in the rounded face.

## 5. Motion — springy and alive

Springs, not ramps. Things arrive with a little overshoot and settle. A tap
squeezes. A ring fills. A completed set pops. Nothing is stiff.

Press state comes from `data-pressed`, never `:active`. Everything respects
`prefers-reduced-motion` and the app stays delightful with it on — just still.

## 6. Density

Comfortable, not cramped. Generous padding, real breathing room, 44pt minimum on
everything tappable. An app that feels good to use beats one that fits one more
row.

## 7. Never

No sharp corners. No monospace. No grey-on-grey screens. No hairline-ruled
tables where a card would do. No colour used so sparingly the app reads as
austere. No animation that is merely decorative — but do not mistake restraint
for quality: this app should feel *alive*.
