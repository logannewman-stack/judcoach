import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { Pill, Segmented } from '../../components/ios/Controls'
import { NumberPad, RpePicker } from '../../components/NumberPad'
import { Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import { e1rmSeries } from '../../store/selectors'
import { MAIN_LIFTS } from '../../data/exercises'
import { e1RM, formatRpe, roundToIncrement } from '../../domain/strength'
import { BarChart, Sparkline } from '../../components/Charts'
import { fixed, num, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'

export function TrainingMaxes() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const logs = useStore((s) => s.logs)
  const setTrainingMax = useStore((s) => s.setTrainingMax)
  const [editing, setEditing] = useState<string | null>(null)
  const [calculating, setCalculating] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      MAIN_LIFTS.map((lift) => {
        const tm = profile.trainingMaxes[lift.id] ?? 0
        const series = e1rmSeries(logs, lift.id)
        const best = series.reduce((b, p) => Math.max(b, p.value), 0)
        // The working max *is* the one-rep max estimate — every percentage in
        // the programme is derived from it through the RPE chart, so taking a
        // further 10% off would ratchet the whole block down each cycle.
        const suggested = best > 0 ? roundToIncrement(best, profile.roundingIncrement) : 0
        return { lift, tm, series, best, suggested, gap: suggested - tm }
      }),
    [profile.trainingMaxes, profile.roundingIncrement, logs],
  )

  const stale = rows.filter((r) => r.suggested > 0 && r.gap >= profile.roundingIncrement * 2)
  const unset = rows.filter((r) => r.tm <= 0)
  const anyLogged = rows.some((r) => r.best > 0)
  const anySet = rows.some((r) => r.tm > 0)

  return (
    <Screen
      title="Working maxes"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter t-subhead dim" style={{ margin: '-2px 0 24px', lineHeight: 1.4 }}>
          The most you can lift for one rep right now. Every percentage in the programme is a slice
          of these numbers, worked out through the RPE chart, so the load and the effort it asks for
          always agree.
        </div>
      }
    >
      {/* Two things can be wrong with a working max: it can be missing, or it
          can be behind what the client is already lifting. The first outranks
          the second — a number that does not exist has nothing to lag. */}
      {unset.length > 0 ? (
        <ListSection>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px var(--gutter)' }}>
            <Icon name="chart.bar" size={18} weight={2.4} color="var(--accent)" style={{ marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div className="t-headline">
                {unset.length === rows.length
                  ? 'Nothing on file yet'
                  : `${unset.map((r) => r.lift.shortName ?? r.lift.name).join(', ')} still to set`}
              </div>
              <div className="t-footnote dim" style={{ marginTop: 2, lineHeight: 1.384615 }}>
                Every set that asks for a share of{' '}
                {unset.length === 1 ? 'it' : unset.length === rows.length ? 'these' : 'them'} shows
                a percentage where the weight belongs. Tap a lift to enter one, or work it out from
                your best recent set.
              </div>
            </div>
          </div>
        </ListSection>
      ) : stale.length > 0 ? (
        <ListSection>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px var(--gutter)' }}>
            <Icon name="arrow.up" size={18} weight={2.4} color="var(--green)" style={{ marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div className="t-headline">You've outgrown some numbers</div>
              <div className="t-footnote dim" style={{ marginTop: 2 }}>
                {stale.map((r) => r.lift.shortName ?? r.lift.name).join(', ')}
                {stale.length === 1 ? ' is' : ' are'} lagging what you're actually lifting.
                Tap a lift below to update it.
              </div>
            </div>
          </div>
        </ListSection>
      ) : null}

      {/* Four numbers that are only ever read against each other — which lift is
          behind, and how far any of them is off what the logs support. A column
          of rows says each one on its own; this says all four at once, which is
          the question the screen is actually asked. */}
      {anySet && (
        <ListSection
          header="Where they stand"
          footer={
            stale.length > 0
              ? 'The dashed line is what your logged sets already support. A bar short of its line is a max with room left in it.'
              : 'Every bar is a working max. A dashed line appears above one once your logged sets support more than it.'
          }
        >
          <div style={{ padding: '16px var(--gutter) 8px' }}>
            <BarChart
              bars={rows.map((r) => ({
                label: r.lift.shortName ?? r.lift.name,
                value: r.tm,
                target: r.gap >= profile.roundingIncrement * 2 ? r.suggested : undefined,
              }))}
              height={140}
              // The rows below already say every number; a figure over each bar
              // landed on top of the dashed line it is being compared with.
              showValues={false}
            />
          </div>
        </ListSection>
      )}

      {/* The footer states the estimated-max rule, and it is the only place in
          the app that does. It named six reps at RPE 8, which is neither the
          rule in force nor any rule this codebase has ever had; the one in
          domain/strength.ts is eight reps or fewer at RPE 8 or above. */}
      <ListSection
        header="Main lifts"
        footer={
          anyLogged
            ? 'Taken from your best near-maximal set — eight reps or fewer at RPE 8 or above. Ordinary percentage work sits below a true max, so treat these as a floor; only a number above your working max means it is time to move.'
            : 'Enter what you can lift today. Jud moves these after your first heavy week, and a max that is a few pounds out costs you one warm-up set rather than the block.'
        }
      >
        {rows.map(({ lift, tm, series, best, gap }) => (
          <Row
            key={lift.id}
            // The short name, and the best e1RM alone: a row carrying a value, a
            // trend and a pill has about 120pt left for its text, which is not
            // enough for "Standing Overhead Press" over "logs support 405+".
            // Both wrapped, and four two-line rows is not a list any more.
            title={lift.shortName ?? lift.name}
            subtitle={best > 0 ? `Best e1RM ${num(best, 0)} ${profile.units}` : 'No logged sets yet'}
            ariaLabel={
              tm > 0
                ? `${lift.name}, working max ${fixed(tm, 0)} ${profile.units}`
                : `${lift.name}, no working max set`
            }
            // "0 lb" is not this client's number, it is the absence of one, and
            // at a row's value size it reads as a max of nothing. Ask instead —
            // the same call the setup flow makes for an empty weight field.
            value={
              tm > 0
                ? `${fixed(tm, 0)} ${profile.units}`
                : <span className="t-subhead semibold tint">Add</span>
            }
            trailing={
              <>
                {series.length > 2 && (
                  <Sparkline
                    values={series.slice(-12).map((p) => p.value)}
                    width={46}
                    height={20}
                    color={gap > 0 ? 'var(--green)' : 'var(--label-3)'}
                  />
                )}
                {tm > 0 && gap >= profile.roundingIncrement * 2 && <Pill tone="good">{signed(gap, 0)}</Pill>}
              </>
            }
            chevron
            onPress={() => setEditing(lift.id)}
          />
        ))}
        {/* A row cannot hold a second button, so the calculator the setup flow
            offers gets one of its own rather than being lost the moment a
            client leaves onboarding without a number. */}
        <Row
          title="Work one out from a set"
          subtitle="Best recent set in, working max out"
          chevron
          onPress={() => setCalculating(unset[0]?.lift.id ?? MAIN_LIFTS[0]!.id)}
        />
      </ListSection>

      <ListSection header="How Jud sets them">
        <div
          className="t-subhead"
          style={{ lineHeight: 1.4, color: 'var(--label-2)', padding: '13px var(--gutter)' }}
        >
          At the end of every block you work up to a top single, and that becomes your working max
          for the next one. If a top set feels heavier than the RPE asks for two weeks running, the
          max comes down — that is not failure, it is the system working.
        </div>
      </ListSection>

      {editing && (
        <NumberPad
          open={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            setTrainingMax(editing, roundToIncrement(v, profile.roundingIncrement))
            toast('Working max updated', { icon: 'check.circle.fill', tone: 'good' })
          }}
          title={MAIN_LIFTS.find((l) => l.id === editing)?.name ?? 'Working max'}
          initial={profile.trainingMaxes[editing] ?? 0}
          unit={profile.units}
          steps={[-10, -5, 5, 10]}
          hint={(() => {
            const row = rows.find((r) => r.lift.id === editing)
            return row && row.suggested > 0
              ? `Your logs support at least ${num(row.suggested, 0)} ${profile.units}`
              : undefined
          })()}
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
          toast('Working max updated', { icon: 'check.circle.fill', tone: 'good' })
        }}
      />
    </Screen>
  )
}

/**
 * Turn "the best set I've done lately" into a working max.
 *
 * Lives here rather than in the setup flow because this is the screen that owns
 * the number: a client who skipped the maxes step during setup arrives here
 * needing exactly the tool onboarding offered them, and having two copies of
 * the RPE maths is how the two would end up disagreeing.
 */
export function MaxCalculator({
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
  // The lift the sheet opened on is a starting point, not a lock: working out
  // four maxes in one sitting should not mean opening the sheet four times.
  const [lift, setLift] = useState<string | null>(null)
  const selected = lift ?? liftId

  const estimate = useMemo(() => e1RM(weight, reps, rpe), [weight, reps, rpe])
  const workingMax = roundToIncrement(estimate, increment)
  const exercise = MAIN_LIFTS.find((l) => l.id === selected)

  if (!liftId || !selected || !exercise) return null

  return (
    <Sheet
      open={!!liftId}
      onClose={() => {
        setLift(null)
        onClose()
      }}
      title="Work it out"
      left={{ label: 'Cancel', onPress: onClose }}
      right={{
        label: 'Use',
        strong: true,
        disabled: weight <= 0,
        onPress: () => onApply(selected, workingMax),
      }}
      detent={0.88}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <Segmented
          label="Lift"
          options={MAIN_LIFTS.map((l) => ({ value: l.id, label: l.shortName ?? l.name }))}
          value={selected}
          onChange={setLift}
        />

        <div className="t-footnote dim" style={{ margin: '14px 0' }}>
          Your best {exercise.name.toLowerCase()} set in the last month or so.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" className="onboarding-minifield" onClick={() => setPad('weight')}>
            <span className="eyebrow">Weight</span>
            <span className="data">
              {num(weight, 1)}
              <span className="figure-unit" style={{ fontSize: 'calc(15 * var(--pt))' }}> {units}</span>
            </span>
          </button>
          <button type="button" className="onboarding-minifield" onClick={() => setPad('reps')}>
            <span className="eyebrow">Reps</span>
            <span className="data">{reps}</span>
          </button>
        </div>

        <div className="onboarding-note" style={{ margin: '18px 0 8px' }}>
          How hard was it?
        </div>
        <RpePicker value={rpe} onChange={setRpe} />

        <div className="onboarding-result">
          <div className="eyebrow">Working max</div>
          {/* Before a weight goes in there is no estimate to show, and a 34px
              dash in the data face is a black bar. Say what is waiting on what. */}
          {weight > 0 ? (
            <>
              <div className="figure">
                {num(workingMax, 0)}
                <span className="figure-unit" style={{ fontSize: 'calc(17 * var(--pt))' }}> {units}</span>
              </div>
              <div className="t-caption1 dim">
                Worked back from {num(weight, 1)} × {reps} at {formatRpe(rpe)}
              </div>
            </>
          ) : (
            <div className="t-subhead dim">Add the weight you lifted and it appears here.</div>
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
