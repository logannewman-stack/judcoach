# GRIT — Fitness and Performance

The client-facing training app for Jud's coaching. Percentage- and RPE-based
programming, macro tracking, weigh-in trends, and the settings that make the
maths match a real gym floor.

Built as an installable PWA that reads as a native iOS app: Apple's system
palette and type scale, translucent bars, a collapsing large title, sheets with
drag-to-dismiss, and interactive edge-swipe back.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then build the PWA into `dist/` |
| `npm run build:single` | One self-contained `dist-single/index.html` |
| `npm run artifact` | The above, reduced to an embeddable fragment |
| `npm run icons` | Regenerate the app icons from the GRIT mark |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run walk` | Screenshot every screen and report console errors |

`npm run walk` needs a dev server on port 5177 (`npx vite --port 5177`) and a
Chromium for Playwright — set `CHROMIUM_PATH` if you have one already installed.

## On a phone

Open the deployed URL in Safari → Share → **Add to Home Screen**. Installed, it
runs full screen with no browser chrome and works offline through a service
worker. Everything is stored in `localStorage` on the device — no account, no
server, no analytics.

## How it's put together

```
src/
  domain/      the maths — no React in here
    strength.ts   RPE/RIR chart, e1RM, plate solving, autoregulation
    weight.ts     rolling averages, regression-fitted rate, projections
    nutrition.ts  macro totals, adherence, swaps, grocery roll-up
  data/        exercise library, generated programme, meal plan, seed history
  store/       zustand store (persisted) + derived selectors
  nav/         tab + stack navigator with the UIKit push curve
  components/  iOS primitives (nav bar, lists, sheets, controls), charts, rings
  screens/     one folder per tab
  styles/      design tokens (light/dark) and base component CSS
```

### The strength maths

`domain/strength.ts` holds the Reactive Training Systems RPE chart: reps × RPE →
percentage of a one-rep max. Everything else falls out of it.

- **RIR = 10 − RPE**, always. Both are shown wherever a target appears.
- **e1RM** works backwards from a logged set: `weight ÷ (chart[rpe][reps] / 100)`.
  Five reps at RPE 8 is ~81% of a true single, so 315 × 5 @ 8 implies ~388.
- **Prescriptions** resolve four ways: a percentage of the training max, a
  percentage of the heaviest set already hit this session (back-offs), a fixed
  load, or fully autoregulated ("work up to RPE 8").
- **Loads are rounded** to the smallest jump the client's plates allow, and the
  plate calculator shows what to load per side — including when the target isn't
  reachable with the plates they own.
- **Autoregulation** compares a logged set against *its own* target. An RPE that
  lands a full point light suggests more load; a missed rep count at or above the
  target RPE suggests less.

### The programme

`data/program.ts` generates an eight-week upper/lower block from a compact spec:
three accumulation weeks, a deload, two intensification weeks, a peak, and a
test week. Prescription IDs are deterministic (`w5-lowerA-b0-s2`) because logged
sets are keyed by them — random IDs would orphan an in-progress workout on
reload.

### Weigh-ins

Scale weight is noise. Nothing the client sees is driven by a day-to-day delta:
the headline number is a trailing 7-day average, and the weekly rate is a
least-squares slope over the last 28 days, compared against the coach's target
rate.

## Design system

`styles/tokens.css` mirrors Apple's system colours for light and dark, the iOS
type scale with real tracking values, and the fill/separator/label ramps. Themes
resolve in all three states — explicit light, explicit dark, and unstamped
system — and the app defers to an embedding host's theme stamp when the user's
own setting is "Match iPhone".

## Demo data

A fresh install seeds a client mid-block: ten weeks of weigh-ins with realistic
noise, four weeks of logged training, and three check-ins with Jud's replies, so
every chart, PR and "last time" anchor has something behind it. Settings → Data
& privacy clears it or reloads it.
