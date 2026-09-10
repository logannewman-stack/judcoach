import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GritMark, GritTile, Wordmark } from '../components/Logo'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/ios/Controls'
import { NumberPad, RpePicker } from '../components/NumberPad'
import { Sheet } from '../components/ios/Sheet'
import { Barbell } from '../components/Barbell'
import { useStore } from '../store/useStore'
import { MAIN_LIFTS } from '../data/exercises'
import { COACH } from '../data/seed'
import {
  DEFAULT_PLATES_KG, DEFAULT_PLATES_LB, e1RM, formatRpe, roundToIncrement,
} from '../domain/strength'
import type { Units } from '../domain/types'
import { todayISO } from '../lib/date'
import { fixed, num } from '../lib/format'
import { haptic } from '../lib/haptics'

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

      {index > 0 && index < FLOW.length && (
        <div className="onboarding-dots" aria-hidden="true">
          {FLOW.slice(1).map((s, i) => (
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
            <div className="onboarding-eyebrow">{eyebrow}</div>
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

function Welcome({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-hero">
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <GritTile size={96} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        >
          <Wordmark size={44} align="center" />
        </motion.div>
        <motion.p
          className="onboarding-blurb"
          style={{ textAlign: 'center', maxWidth: 300 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        >
          Percentage-based training and the nutrition that pays for it — programmed
          by {COACH.name}, logged by you.
        </motion.p>
      </div>

      <motion.div
        className="onboarding-foot"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      >
        <button type="button" className="btn btn-filled" onClick={onStart} style={{ minHeight: 52 }}>
          Set up my programme
        </button>
        <button type="button" className="btn btn-plain" onClick={onDemo}>
          Look around with sample data
        </button>
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
      eyebrow="Step 1 of 5"
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
      eyebrow="Step 2 of 5"
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
        <div className="onboarding-preview-label">
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
      eyebrow="Step 3 of 5"
      title="Where are you, and where are you going?"
      blurb="Everything on the weigh-in screen is measured against these two numbers."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={needsWeight}
    >
      <div className="onboarding-fields">
        <BigField
          label="Today"
          value={profile.startWeight > 0 ? fixed(profile.startWeight, 1) : '—'}
          unit={profile.units}
          onPress={() => setEditing('start')}
        />
        <span className="onboarding-arrow" aria-hidden="true">
          <Icon name="arrow.right" size={20} weight={2.2} color="var(--label-3)" />
        </span>
        <BigField
          label="Goal"
          value={profile.goalWeight > 0 ? fixed(profile.goalWeight, 1) : '—'}
          unit={profile.units}
          onPress={() => setEditing('goal')}
        />
      </div>

      <div className="onboarding-rate">
        <div className="onboarding-preview-label">
          Weekly rate — {direction >= 0 ? 'gaining' : 'losing'}
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
              >
                {num(r, 2)}
              </button>
            )
          })}
        </div>
        {weeks > 0 && (
          <div className="onboarding-preview-label" style={{ marginTop: 10 }}>
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
      eyebrow="Step 4 of 5"
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
              className="onboarding-value mono-nums"
              onClick={() => setEditing(lift.id)}
            >
              {profile.trainingMaxes[lift.id] ? (
                <>
                  {num(profile.trainingMaxes[lift.id]!, 0)}
                  <span className="dim" style={{ fontWeight: 400 }}> {profile.units}</span>
                </>
              ) : (
                <span style={{ color: 'var(--accent)' }}>Add</span>
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
  const program = useStore((s) => s.programStartDate)
  return (
    <StepShell
      eyebrow="Step 5 of 5"
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
              <div className="t-footnote dim" style={{ lineHeight: '18px' }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="onboarding-preview-label" style={{ textAlign: 'center' }}>
        Block one started {new Date(`${program}T00:00:00`).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
        })}.
      </div>
    </StepShell>
  )
}

/* ------------------------------ helper bits ----------------------------- */

function BigField({
  label, value, unit, onPress,
}: {
  label: string
  value: string
  unit: string
  onPress: () => void
}) {
  return (
    <button type="button" className="onboarding-bigfield" onClick={onPress}>
      <span className="onboarding-preview-label">{label}</span>
      <span className="mono-nums onboarding-bigvalue">
        {value}
        <span className="dim" style={{ fontSize: 15, fontWeight: 400 }}> {unit}</span>
      </span>
    </button>
  )
}

/** Turn "the best set I've done lately" into a working max. */
function MaxCalculator({
  liftId, units, increment, onClose, onApply,
}: {
  liftId: string | null
  units: string
  increment: number
  onClose: () => void
  onApply: (liftId: string, trainingMax: number) => void
}) {
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(5)
  const [rpe, setRpe] = useState(8)
  const [pad, setPad] = useState<'weight' | 'reps' | null>(null)

  const lift = MAIN_LIFTS.find((l) => l.id === liftId)
  const estimate = useMemo(() => e1RM(weight, reps, rpe), [weight, reps, rpe])
  const workingMax = roundToIncrement(estimate, increment)

  if (!liftId || !lift) return null

  return (
    <Sheet
      open={!!liftId}
      onClose={onClose}
      title="Work it out"
      left={{ label: 'Cancel', onPress: onClose }}
      right={{
        label: 'Use',
        strong: true,
        disabled: weight <= 0,
        onPress: () => onApply(liftId, workingMax),
      }}
      detent={0.82}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="t-footnote dim" style={{ marginBottom: 14 }}>
          Your best {lift.name.toLowerCase()} set in the last month or so.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="onboarding-minifield" onClick={() => setPad('weight')}>
            <span className="onboarding-preview-label">Weight</span>
            <span className="mono-nums">{num(weight, 1)} {units}</span>
          </button>
          <button type="button" className="onboarding-minifield" onClick={() => setPad('reps')}>
            <span className="onboarding-preview-label">Reps</span>
            <span className="mono-nums">{reps}</span>
          </button>
        </div>

        <div className="onboarding-preview-label" style={{ margin: '18px 0 8px' }}>
          How hard was it?
        </div>
        <RpePicker value={rpe} onChange={setRpe} />

        <div
          style={{
            marginTop: 20,
            padding: 15,
            borderRadius: 14,
            background: 'var(--accent-soft)',
            textAlign: 'center',
          }}
        >
          <div className="t-footnote" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            WORKING MAX
          </div>
          <div className="mono-nums" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8 }}>
            {weight > 0 ? num(workingMax, 0) : '—'}
            <span className="dim" style={{ fontSize: 17, fontWeight: 400 }}> {units}</span>
          </div>
          {weight > 0 && (
            <div className="t-caption1 dim">
              Worked back from {num(weight, 1)} × {reps} at {formatRpe(rpe)}
            </div>
          )}
        </div>
      </div>

      <NumberPad
        open={pad === 'weight'}
        onClose={() => setPad(null)}
        onSubmit={setWeight}
        title="Weight lifted"
        initial={weight}
        unit={units}
        steps={[-10, -5, 5, 10]}
      />
      <NumberPad
        open={pad === 'reps'}
        onClose={() => setPad(null)}
        onSubmit={(v) => setReps(Math.max(1, Math.round(v)))}
        title="Reps"
        initial={reps}
        allowDecimal={false}
        max={30}
        steps={[-1, 1]}
      />
    </Sheet>
  )
}
