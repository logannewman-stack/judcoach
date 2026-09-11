import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GritMark, GritTile, Wordmark } from '../components/Logo'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/ios/Controls'
import { NumberPad } from '../components/NumberPad'
import { Barbell } from '../components/Barbell'
import { MaxCalculator } from './settings/TrainingMaxes'
import { useStore } from '../store/useStore'
import { nextSession, useProgram } from '../store/selectors'
import { MAIN_LIFTS } from '../data/exercises'
import { COACH } from '../data/seed'
import { DEFAULT_PLATES_KG, DEFAULT_PLATES_LB, roundToIncrement } from '../domain/strength'
import type { Units } from '../domain/types'
import { relativeDay, todayISO } from '../lib/date'
import { fixed, num } from '../lib/format'
import { haptic } from '../lib/haptics'
import '../styles/onboarding.css'

/* ============================================================================
   First run.

   A brand moment, then the four things the programme genuinely cannot work
   without: what to call you, what units you count in, where your bodyweight is
   headed, and the working maxes every percentage is a slice of.
   ========================================================================== */

type Step = 'welcome' | 'name' | 'units' | 'weight' | 'maxes' | 'ready'
const FLOW: Step[] = ['welcome', 'name', 'units', 'weight', 'maxes', 'ready']

export function Onboarding() {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const saveWeighIn = useStore((s) => s.saveWeighIn)
  const completeOnboarding = useStore((s) => s.completeOnboarding)
  const startFresh = useStore((s) => s.startFresh)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const logs = useStore((s) => s.logs)

  const [step, setStep] = useState<Step>('welcome')
  const [direction, setDirection] = useState(1)
  const index = FLOW.indexOf(step)

  const go = (next: Step) => {
    setDirection(FLOW.indexOf(next) > index ? 1 : -1)
    setStep(next)
  }
  const advance = () => {
    haptic('light')
    const next = FLOW[index + 1]
    if (next) go(next)
  }
  const back = () => {
    const prev = FLOW[index - 1]
    if (prev) go(prev)
  }

  const finish = () => {
    haptic('success')
    // Seed today's weigh-in so the trend has somewhere to start from.
    if (profile.startWeight > 0) saveWeighIn({ date: todayISO(), weight: profile.startWeight })
    const rate = profile.weeklyRateTarget
    updateProfile({
      goalLabel:
        Math.abs(rate) < 0.05
          ? 'Maintaining'
          : `${rate > 0 ? 'Lean gain' : 'Cut'} · ${Math.abs(rate)} ${profile.units} / week`,
    })
    completeOnboarding()
  }

  const exploreDemo = () => {
    haptic('light')
    // Backing out of setup clears the sample data, so restore it rather than
    // opening an empty app under a button that promised sample data.
    if (logs.length === 0) resetToSeed()
    completeOnboarding()
  }

  const beginSetup = () => {
    haptic('light')
    startFresh()
    go('name')
  }

  return (
    <div className="onboarding">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -28 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="onboarding-page"
        >
          {step === 'welcome' && <Welcome onStart={beginSetup} onDemo={exploreDemo} />}
          {step === 'name' && (
            <NameStep
              value={profile.name}
              onChange={(name) => updateProfile({ name })}
              onNext={advance}
              onBack={back}
            />
          )}
          {step === 'units' && <UnitsStep onNext={advance} onBack={back} />}
          {step === 'weight' && <WeightStep onNext={advance} onBack={back} />}
          {step === 'maxes' && <MaxesStep onNext={advance} onBack={back} />}
          {step === 'ready' && <ReadyStep name={profile.name} onDone={finish} onBack={back} />}
        </motion.div>
      </AnimatePresence>

      {/* One dot per question, and none on the summary: a fifth dot lit on a
          screen whose eyebrow says "Step 4 of 4" is the progress bar and the
          counter disagreeing about the same flow. */}
      {index > 0 && index < FLOW.length - 1 && (
        <div className="onboarding-dots" aria-hidden="true">
          {FLOW.slice(1, -1).map((s, i) => (
            <span key={s} data-on={i <= index - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------- chrome -------------------------------- */

function StepShell({
  eyebrow, title, blurb, children, onNext, onBack, nextLabel = 'Continue', nextDisabled,
}: {
  eyebrow: string
  title: string
  blurb?: string
  children: React.ReactNode
  onNext: () => void
  onBack: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <>
      <div className="onboarding-nav">
        <button type="button" onClick={onBack} className="nav-btn" aria-label="Back">
          <Icon name="chevron.left" size={20} weight={2.6} />
        </button>
        <GritMark size={22} color="var(--label-3)" />
        <span style={{ width: 44 }} />
      </div>

      <div className="onboarding-body">
        {/* margin-block auto centres short steps without clipping tall ones */}
        <div className="onboarding-content">
          <div className="onboarding-head">
            <div className="eyebrow onboarding-eyebrow">{eyebrow}</div>
            <h1 className="onboarding-title">{title}</h1>
            {blurb && <p className="onboarding-blurb">{blurb}</p>}
          </div>
          {children}
        </div>
      </div>

      <div className="onboarding-foot">
        <button
          type="button"
          className="btn btn-filled"
          onClick={onNext}
          disabled={nextDisabled}
          style={{ minHeight: 52 }}
        >
          {nextLabel}
        </button>
      </div>
    </>
  )
}

/* -------------------------------- welcome ------------------------------- */

/* What setup actually asks for, in the order it asks. A client deciding whether
   to spend a minute on this deserves to know what the minute buys, and the last
   line is the one that matters: without the maxes the app has no weights to
   show them. */
const ASKS: { ask: string; detail?: string }[] = [
  { ask: 'What Jud should call you' },
  { ask: 'Pounds or kilos' },
  { ask: 'Your weight now, and the one you want' },
  {
    ask: 'A working max for each main lift',
    // Named, because "the main lifts" is the one ask a client cannot answer in
    // their head before opening the flow — and it is the ask that decides
    // whether the eight weeks arrive with weights on them.
    detail: MAIN_LIFTS.map((l) => l.shortName ?? l.name).join(' · '),
  },
]

function Welcome({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-body welcome-body">
        <motion.div
          className="onboarding-hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        >
          <GritTile size={60} />
          <Wordmark size={38} />
          {/* Left-aligned and full measure: DESIGN.md §7 rules out centred body
              text, and the old centred line was the only thing the app said
              about itself before asking for four one-rep maxes. */}
          <p className="onboarding-blurb welcome-blurb">
            An eight-week block written by {COACH.name}, the meal plan that pays for it, and one
            place to log both. Every load is a share of what you can lift, worked out through the
            RPE chart so the weight and the effort it asks for always agree.
          </p>
        </motion.div>

        <motion.div
          className="welcome-asks"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="eyebrow">Setup asks four things</div>
          <ol className="onboarding-list welcome-list">
            {ASKS.map(({ ask, detail }, i) => (
              <li key={ask} className="onboarding-list-row">
                <span className="welcome-step data" aria-hidden="true">{i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="t-subhead" style={{ display: 'block' }}>{ask}</span>
                  {detail && <span className="t-footnote dim">{detail}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="onboarding-note welcome-note">
            About a minute, and the whole eight weeks has numbers on it.
          </p>
        </motion.div>
      </div>

      <motion.div
        className="onboarding-foot"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      >
        <button type="button" className="btn btn-filled" onClick={onStart} style={{ minHeight: 52 }}>
          Set up my programme
        </button>
        <button type="button" className="btn btn-plain" onClick={onDemo}>
          Look around with sample data
        </button>
        {/* The demo is somebody else's training. Saying whose, here, is what
            stops a client logging their own weigh-in into it on Tuesday. */}
        <p className="onboarding-note welcome-demo-note">
          Opens a finished client's eight weeks so you can see the app full. Your own setup
          stays one tap away on the Today screen.
        </p>
      </motion.div>
    </div>
  )
}

/* --------------------------------- steps -------------------------------- */

function NameStep({
  value, onChange, onNext, onBack,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <StepShell
      eyebrow="Step 1 of 4"
      title="What should Jud call you?"
      blurb="It shows up on your dashboard and on every check-in he reads."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={value.trim().length === 0}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onNext()
        }}
        placeholder="First name"
        autoFocus
        aria-label="Your name"
        className="onboarding-input"
        autoComplete="given-name"
      />
    </StepShell>
  )
}

function UnitsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const profile = useStore((s) => s.profile)
  // Setup runs on an empty history, so there is nothing here to confirm — but it
  // still goes through the store, so there is only one conversion in the app.
  const setUnits = useStore((s) => s.setUnits)

  return (
    <StepShell
      eyebrow="Step 2 of 4"
      title="Pounds or kilos?"
      blurb="This sets your plate inventory and the smallest jump the app will round a percentage to."
      onNext={onNext}
      onBack={onBack}
    >
      <Segmented
        options={[
          { value: 'lb', label: 'Pounds' },
          { value: 'kg', label: 'Kilograms' },
        ]}
        value={profile.units}
        onChange={(v) => setUnits(v as Units)}
      />
      <div className="onboarding-preview">
        <div className="onboarding-note">
          A {profile.units === 'kg' ? '20 kg' : '45 lb'} bar at{' '}
          {num(profile.units === 'kg' ? 140 : 315, 0)} {profile.units} loads like this:
        </div>
        <Barbell
          target={profile.units === 'kg' ? 140 : 315}
          profile={{
            barWeight: profile.units === 'kg' ? 20 : 45,
            availablePlates: profile.units === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB,
            units: profile.units,
          }}
          height={54}
        />
      </div>
    </StepShell>
  )
}

function WeightStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const [editing, setEditing] = useState<'start' | 'goal' | null>(null)
  const needsWeight = profile.startWeight <= 0

  const direction = profile.goalWeight - profile.startWeight
  const rateOptions = profile.units === 'kg' ? [0.1, 0.2, 0.35, 0.5] : [0.25, 0.5, 0.75, 1]

  // The stored rate may not be one of the offered steps; snap it so a chip is
  // always selected and the direction always matches the goal.
  const magnitude = Math.abs(profile.weeklyRateTarget)
  const snapped = rateOptions.reduce((best, r) =>
    Math.abs(r - magnitude) < Math.abs(best - magnitude) ? r : best,
  )
  const signedRate = direction >= 0 ? snapped : -snapped
  useEffect(() => {
    if (profile.weeklyRateTarget !== signedRate) updateProfile({ weeklyRateTarget: signedRate })
  }, [signedRate, profile.weeklyRateTarget, updateProfile])

  const weeks = Math.abs(signedRate) > 0.01 ? Math.abs(direction / signedRate) : 0

  return (
    <StepShell
      eyebrow="Step 3 of 4"
      title="Where are you, and where are you going?"
      blurb="Everything on the weigh-in screen is measured against these two numbers."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={needsWeight}
    >
      <div className="onboarding-fields">
        <BigField
          label="Today"
          value={profile.startWeight > 0 ? fixed(profile.startWeight, 1) : null}
          unit={profile.units}
          onPress={() => setEditing('start')}
        />
        <span className="onboarding-arrow" aria-hidden="true">
          <Icon name="arrow.right" size={20} weight={2.2} color="var(--label-3)" />
        </span>
        <BigField
          label="Goal"
          value={profile.goalWeight > 0 ? fixed(profile.goalWeight, 1) : null}
          unit={profile.units}
          onPress={() => setEditing('goal')}
        />
      </div>

      {/* A rate needs a direction, and a direction needs two weights. Before
          they exist the row claims "gaining" on the strength of 0 minus 0. */}
      <div className="onboarding-rate" hidden={needsWeight}>
        <div className="eyebrow">
          {/* Two equal weights are not a direction; saying "gaining" of them is
              the app deciding something the client has not. */}
          Weekly rate — {direction > 0 ? 'gaining' : direction < 0 ? 'losing' : 'holding'}
        </div>
        <div className="onboarding-rate-row">
          {rateOptions.map((r) => {
            const on = Math.abs(snapped - r) < 0.001
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  haptic('selection')
                  updateProfile({ weeklyRateTarget: direction >= 0 ? r : -r })
                }}
                data-on={on}
                className="data"
              >
                {num(r, 2)}
              </button>
            )
          })}
        </div>
        {weeks > 0 && (
          <div className="onboarding-note" style={{ marginTop: 10 }}>
            About {Math.ceil(weeks)} weeks at that pace.
          </div>
        )}
      </div>

      <NumberPad
        open={editing === 'start'}
        onClose={() => setEditing(null)}
        onSubmit={(v) =>
          // Seed the goal from today's weight so the next field isn't a blank.
          updateProfile({ startWeight: v, goalWeight: profile.goalWeight > 0 ? profile.goalWeight : v })
        }
        title="Today's weight"
        initial={profile.startWeight > 0 ? profile.startWeight : 180}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
      <NumberPad
        open={editing === 'goal'}
        onClose={() => setEditing(null)}
        onSubmit={(v) => updateProfile({ goalWeight: v })}
        title="Goal weight"
        initial={profile.goalWeight > 0 ? profile.goalWeight : profile.startWeight}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
    </StepShell>
  )
}

function MaxesStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const profile = useStore((s) => s.profile)
  const setTrainingMax = useStore((s) => s.setTrainingMax)
  const [editing, setEditing] = useState<string | null>(null)
  const [calculating, setCalculating] = useState<string | null>(null)

  return (
    <StepShell
      eyebrow="Step 4 of 4"
      title="Your working maxes"
      blurb="The most you can lift for one rep right now — every percentage in the programme is a slice of it. Not sure? Tap Work it out and enter your best recent set."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={MAIN_LIFTS.some((l) => !profile.trainingMaxes[l.id])}
    >
      <div className="onboarding-list">
        {MAIN_LIFTS.map((lift) => (
          <div key={lift.id} className="onboarding-list-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-body truncate">{lift.name}</div>
              <button
                type="button"
                className="t-footnote"
                style={{ color: 'var(--accent)' }}
                onClick={() => setCalculating(lift.id)}
              >
                Work it out from a set
              </button>
            </div>
            <button
              type="button"
              className="onboarding-value data"
              onClick={() => setEditing(lift.id)}
              aria-label={`${lift.name} working max`}
            >
              {profile.trainingMaxes[lift.id] ? (
                <>
                  {num(profile.trainingMaxes[lift.id]!, 0)}
                  <span className="figure-unit" style={{ fontSize: 'calc(15 * var(--pt))' }}> {profile.units}</span>
                </>
              ) : (
                <span className="t-subhead semibold" style={{ color: 'var(--accent)' }}>Add</span>
              )}
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <NumberPad
          open={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => setTrainingMax(editing, roundToIncrement(v, profile.roundingIncrement))}
          title={MAIN_LIFTS.find((l) => l.id === editing)?.name ?? 'Working max'}
          initial={profile.trainingMaxes[editing] ?? 0}
          unit={profile.units}
          steps={[-10, -5, 5, 10]}
        />
      )}

      <MaxCalculator
        liftId={calculating}
        units={profile.units}
        increment={profile.roundingIncrement}
        onClose={() => setCalculating(null)}
        onApply={(id, tm) => {
          setTrainingMax(id, tm)
          setCalculating(null)
        }}
      />
    </StepShell>
  )
}

function ReadyStep({
  name, onDone, onBack,
}: {
  name: string
  onDone: () => void
  onBack: () => void
}) {
  // What they will actually be asked to do, rather than when a block they have
  // never seen notionally began. On an empty history this is always the first
  // session of week one, which is the point.
  const program = useProgram()
  const first = nextSession(program, [], todayISO())
  return (
    <StepShell
      eyebrow="All set"
      title={`You're set${name ? `, ${name.split(' ')[0]}` : ''}.`}
      blurb="Everything below is already waiting for you."
      onNext={onDone}
      onBack={onBack}
      nextLabel="Open GRIT"
    >
      <div className="onboarding-list">
        {[
          { icon: 'dumbbell' as const, title: 'An eight-week block', body: 'Four days a week, upper/lower, written around your maxes.' },
          { icon: 'fork' as const, title: 'A meal plan that adds up', body: 'Macros that hit the target exactly, with swaps for every food.' },
          { icon: 'scale' as const, title: 'Trend-based weigh-ins', body: 'A rolling average and a real weekly rate — never a daily delta.' },
          { icon: 'lock' as const, title: 'All on your phone', body: 'No account, no server. Export a copy whenever you want one.' },
        ].map((item) => (
          <div key={item.title} className="onboarding-list-row">
            <span className="onboarding-list-icon">
              <Icon name={item.icon} size={18} weight={2.1} color="var(--accent)" />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="t-subhead semibold">{item.title}</div>
              <div className="t-footnote dim" style={{ lineHeight: 1.384615 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
      {first && (
        <div className="onboarding-note">
          First up: {first.session.name}, {relativeDay(first.date, todayISO()).toLowerCase()}.
        </div>
      )}
    </StepShell>
  )
}

/* ------------------------------ helper bits ----------------------------- */

function BigField({
  label, value, unit, onPress,
}: {
  label: string
  value: string | null
  unit: string
  onPress: () => void
}) {
  return (
    <button type="button" className="onboarding-bigfield" onClick={onPress} aria-label={label}>
      <span className="eyebrow">{label}</span>
      {/* An empty field asks rather than holds a place. The app's dash is right
          for a number that cannot exist yet; here it is a number the client is
          about to type, and at 30px in the data face a dash is a black bar. */}
      {value == null ? (
        <span className="onboarding-bigvalue" style={{ color: 'var(--accent)', fontWeight: 600 }}>Add</span>
      ) : (
        <span className="figure onboarding-bigvalue">
          {value}
          <span className="figure-unit" style={{ fontSize: 'calc(15 * var(--pt))' }}> {unit}</span>
        </span>
      )}
    </button>
  )
}
