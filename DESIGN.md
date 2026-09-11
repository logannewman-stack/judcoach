# GRIT — design direction

The one rule every decision follows: **a strength app's content is its numbers.**
320 lb. RPE 8. 4×5. 83.7% of the max. 25,295 lb moved. Everything else on the
screen is scaffolding that carries those figures. So the numbers get a face, a
scale and a colour system chosen for them, and every other surface stays quiet,
structural and native.

This is not a licence to decorate. If a change does not make a number easier to
read, a state easier to judge, or an action easier to reach, it does not belong.

---

## 1. Typography

Two faces, split strictly by role. Getting this split wrong is the fastest way to
make the app stop feeling like iOS.

**System (SF Pro) — everything a person reads as language.**
Screen titles, row titles and subtitles, body copy, button labels, coach notes,
prose of any kind. Unchanged from today. This is what keeps the chrome native.

**Archivo (variable, self-hosted) — everything a person reads as data.**
Numerals, the units attached to them, uppercase data eyebrows, the wordmark.
Never running prose. Never a sentence.

Roles, all with `font-variant-numeric: tabular-nums`:

| role | token | use |
|---|---|---|
| hero figure | `--type-figure` | the runner's target, today's weight, a PR, a headline total |
| data figure | `--type-data` | set chips, logged loads, table cells, stat tiles |
| eyebrow | `--type-eyebrow` | `SET 1 OF 4`, `PER SIDE`, `WORKOUT`, section labels above data |

The width axis carries the role: eyebrows sit slightly wide (112) so short
uppercase strings hold a line; figures sit at normal width (100). Do not
introduce a third width without a reason you can name.

A figure and its unit are one object: the unit is smaller, lighter, and set in
the same face, never in SF.

## 2. Colour

**Ground is chalk, not Apple's blue-grey. Dark is iron, not navy.**
Apple's `#F2F2F7` has a blue cast that reads as "stock iOS". GRIT's ground is
neutral with the faintest warm bias, and its dark is a true iron black rather
than the blue-black of `systemGroupedBackground`.

**One accent.** `--accent` is GRIT blue: deeper and more saturated than
`systemBlue`, matching the sheen already in the app icon. It means *this is the
action* and nothing else. It is not a decoration and never a background for
large areas.

**Intensity has its own ramp, and it is the idea that makes this app look like
itself.** RPE is a scale from 6 to 10 and it should read as one: cool at 6, hot
at 10. Anywhere intensity appears — a set chip, a target, the RPE guide, a
session's average — it takes its colour from `--rpe-6` … `--rpe-10`. This is
information design, not theming: a client should be able to see the shape of a
session's effort by glancing down the page.

**Semantics stay separate.** Good, warning and bad keep their own colours and
never borrow the accent or the ramp. A green pill means "you are on target",
not "this is intense".

Every colour is declared on bare `:root` first. Dark overrides only redefine
values, never introduce them. Three theme states: bare `:root` is light,
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme='light'])`,
and `:root[data-theme='dark']` for the explicit toggle.

## 3. Surface

Three levels, no more:

- **ground** — the page. Nothing sits on it directly except section labels.
- **surface** — cards and inset lists. Where content lives.
- **raised** — things that genuinely float above the app: sheets, the toast, the
  active-workout bar, the rest timer.

Separation is done by hairlines and by the ground showing through, not by
shadow. A shadow means "this is in front of the app", so anything that is not in
front of the app does not get one.

Radii are named, and only named radii are used. A number typed into a style is
drift, and `npm run conform` will find it.

| token | px | what it is |
|---|---|---|
| `--r-chip` | 8 | a small object holding one value: a set chip, a day, a badge |
| `--r-inset` | 10 | an inset-grouped list |
| `--r-card` / `--r-btn` | 12 | a card, a button |
| `--r-sheet` / `--r-alert` | 14 | a panel in front of the app |
| `--r-bubble` | 18 | a speech bubble, which is not a card |
| `--r-pill` | full | a pill |

If a shape genuinely needs a radius none of these names, it needs a name — add
the token and this row, do not type the number. Hardware (the desktop device
frame) is exempt and says so with a `conform-allow` comment.

## 4. Hierarchy

**One primary action per screen, and it looks like a button.** A destination is
a row with a chevron. A number is data. Never dress the main action of a screen
as a list row — if "Start workout" is the reason the screen exists, it cannot
look like "Exercise library".

Order on every screen: what is true now → what to do about it → the detail
behind it. A verdict before the number that produced it, where there is one.

## 5. Density

The app is currently too airy for a training log. A screen that shows six
sessions should show six sessions, not four and a half.

- A row's subtitle does not wrap. Truncate, or say less.
- Section rhythm is 32. Inside a card, 10–14. Nothing else.
- Two-line rows are for content that genuinely has two lines of meaning.

## 6. Motion

One curve (`--ease-ios`) and two durations (`--dur-state` 200ms for a control
changing in place, `--dur-push` 350ms for anything presenting or dismissing).
Springs only where iOS uses them: something settling under a finger, or a
selection landing.

Press state comes from `data-pressed`, never `:active` — on touch the browser
withholds `:active` for a quarter of a second while it decides whether you are
scrolling. See `src/lib/press.ts`.

Everything respects `prefers-reduced-motion`, and the app must be fully legible
and usable with it on.

## 7. What this must never become

No gradient heroes. No purple-to-blue. No emoji as section markers. No card with
an accent bar on the left because it needed something. No shadow on a thing that
is not floating. No centred body text. No third radius. No second accent.
No animation that exists because the screen looked static.
