# GRIT — design direction

GRIT is the software a strength coach programmes in and a lifter executes from.
It is an **instrument**, not a consumer app: a thing you learn, keep open, and
trust with numbers that decide what you put on a bar.

That is the whole brief. Everything below follows from it.

## 0. The correction

An earlier pass optimised for iOS fidelity and got it: white cards floating on
grey, system blue, rounded rectangles, generous padding. It looked like Settings
with fitness content in it — indistinguishable from every other app on the
phone, and nothing like a tool a professional would choose.

**Native behaviour is quality. Native chrome is generic.** Keep the first
absolutely — the push curve, the edge-swipe with velocity, momentum scrolling,
sheet physics, press states that answer the finger in the same frame. That is
what makes software feel expensive on a phone and it stays exactly as it is.

Replace the second. The surface should read as an instrument: panels rather than
cards, rules rather than gaps, density rather than air, and numbers set in a
face that says the machine means them.

## 1. Dark by default

Professional tools are dark, gyms are dark, and GRIT's own mark is iron. Dark is
the app's primary appearance and is designed first. Light is a real alternative,
fully designed, for a client who wants it — not an afterthought and not a wash
of the dark one.

## 2. Typography — three faces, split by role

| face | role | where |
|---|---|---|
| **system (SF)** | language | screen titles, row titles, body copy, buttons, coach notes, anything read as a sentence |
| **Archivo** | display figures | the runner's target, today's weight, a PR, a headline total — a number meant to be seen across a room |
| **JetBrains Mono** | data and labels | every table cell, every set, every percentage, and every uppercase label above data |

The mono is the move that makes this read as software rather than as an app. A
training log is a table; a programme is a grid; plate maths is arithmetic. In a
monospace the columns lock, the digits stop shuffling, and the page starts
looking like something that was computed rather than laid out.

Classes: `.figure` (Archivo display), `.data` (mono tabular), `.eyebrow` (mono
uppercase label). Only `.eyebrow` carries a size; the other two take the size of
what they sit in.

Never set a sentence in Archivo or in the mono. Never set a number in SF.

## 3. Surfaces — panels, not cards

A card floats. A panel is part of the instrument.

- **ground** — the chassis. Nothing sits on it loose.
- **panel** — where content lives. Meets its neighbours along a hairline rather
  than floating in a gap with a shadow under it.
- **raised** — genuinely in front of the app: a sheet, an alert, the toast, the
  rest timer. These are the only things that get a shadow.

Data runs edge to edge. A table does not get a margin because a card wanted one.

Radii are small and named. Nothing is rounder than it needs to be: `--r-chip` 3,
`--r-inset` / `--r-card` / `--r-btn` / `--r-field` 6, `--r-sheet` / `--r-alert`
10, `--r-bubble` 10, `--r-pill` full. A number typed into a style is drift and
`npm run conform` will find it.

## 4. Colour

**Neutrals do the work.** Nearly the whole app is ground, panel, rule and three
weights of text. That restraint is what reads as expensive; a screen where four
things are coloured has nothing left to emphasise with.

**One accent**, and it means *this is the action* — never decoration, never a
large fill, never a second job. Decorative row icons are grey.

**Intensity has its own ramp and it is the app's one real idea.** RPE runs 6 to
10, cool to hot, and anywhere effort appears it takes `--rpe` (type),
`--rpe-fill` (a wash behind type) or `--rpe-solid` (a bar or a series). A client
should read the shape of a session by glancing down the page.

**Semantics** — good, warning, bad — stay separate from the accent and from the
ramp. Green means on target, never "intense".

Every colour is declared on bare `:root` first; the theme blocks only redefine.
Three states: bare `:root`, `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme='light'])`, and `:root[data-theme='dark']`.

## 5. Density

An instrument shows you your data, not its own padding. A screen that can show
twelve rows shows twelve.

- A row's subtitle never wraps. Truncate, or say less.
- Section rhythm 24; inside a panel 8–12. Nothing else.
- Prefer a rule to a gap, and a column to a card.
- If a thing can be a table, it is a table.

## 6. Motion

One curve (`--ease-ios`) and two durations (`--dur-state` 200ms in place,
`--dur-push` 350ms presenting). Springs only where something settles under a
finger. Press state comes from `data-pressed`, never `:active` — see
`src/lib/press.ts`. Everything respects `prefers-reduced-motion` and the app is
fully usable with it on.

Motion is feedback, never flourish. Nothing animates because a screen looked
static.

## 7. What this must never become

No gradient heroes. No purple-to-blue. No emoji as section markers. No accent
bar down the side of a panel that needed something. No shadow on a thing that is
not in front of the app. No centred body text. No unnamed radius. No second
accent. No animation that exists to be noticed. And nothing that makes the app
look like it shipped with the phone.
