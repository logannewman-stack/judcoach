import { useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, SectionHeader, StatTile } from '../../components/Bits'
import { Button, Pill, Segmented } from '../../components/ios/Controls'
import { SwipeRow, useSwipeGroup } from '../../components/ios/SwipeRow'
import { ActionSheet } from '../../components/ios/Sheet'
import { NumberPad } from '../../components/NumberPad'
import { LineChart } from '../../components/Charts'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { CheckIn, MeasurementEntry, ProgressPhoto, Units } from '../../domain/types'
import {
  TREND_MIN_DAYS, TREND_MIN_ENTRIES, goalProgress, rateVerdict, rollingSeries, summarizeTrend,
  targetPace, weeksToGoal, weighInsInLast,
} from '../../domain/weight'
import { formatLength } from '../../domain/units'
import { addDays, daysBetween, formatMediumDate, formatShortDate, relativeDay, todayISO } from '../../lib/date'
import { fixed, num, pluralize, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'
import '../../styles/fuel.css'

type Range = '30' | '90' | 'all'

/** Below this the rolling average is one or two mornings, not an average. */
const AVG_MIN_READINGS = 3

export function WeighInHome() {
  const today = todayISO()
  const push = useNav((s) => s.push)
  const weighIns = useStore((s) => s.weighIns)
  const measurements = useStore((s) => s.measurements)
  const photos = useStore((s) => s.photos)
  const checkIns = useStore((s) => s.checkIns)
  const profile = useStore((s) => s.profile)
  const saveWeighIn = useStore((s) => s.saveWeighIn)
  const deleteWeighIn = useStore((s) => s.deleteWeighIn)
  const decimals = useStore((s) => s.settings.weightUnitDecimals)

  const [range, setRange] = useState<Range>('90')
  const [logging, setLogging] = useState(false)
  // Tapping a row opens the same actions the swipe reveals, so deleting works
  // for keyboard, Switch Control and VoiceOver — none of which can swipe.
  const [acting, setActing] = useState<string | null>(null)
  const swipe = useSwipeGroup()

  const removeEntry = (date: string) => {
    deleteWeighIn(date)
    toast('Entry deleted', { icon: 'trash', tone: 'bad' })
  }

  const series = useMemo(() => rollingSeries(weighIns, 7), [weighIns])
  const trend = useMemo(() => summarizeTrend(weighIns, 28), [weighIns])
  const loggedToday = weighIns.some((w) => w.date === today)

  const cutoff = range === 'all' ? '0000-00-00' : addDays(today, -Number(range))
  const visible = series.filter((p) => p.date >= cutoff)
  const pace = useMemo(
    () => (profile.weeklyRateTarget === 0 ? [] : targetPace(visible, profile.weeklyRateTarget)),
    // The pace line is anchored to the first point on screen, so it is rebuilt
    // when the range changes as much as when the data does.
    [visible.length, visible[0]?.date, profile.weeklyRateTarget],
  )

  // How far the average has drifted from where the plan would have put them by
  // now — the whole point of drawing the dashed line, and the one comparison the
  // chart cannot make on the client's behalf. "Ahead" follows the plan's own
  // direction: on a gaining block, above the pace is ahead of it.
  const paceGap = (() => {
    const last = visible[visible.length - 1]
    const onPace = pace[pace.length - 1]
    if (!last || !onPace || profile.weeklyRateTarget === 0) return null
    const by = last.avg - onPace.weight
    if (Math.abs(by) < 0.05) return null
    return { by, ahead: Math.sign(by) === Math.sign(profile.weeklyRateTarget) }
  })()

  const verdict = trend?.reliable
    // The interval is the point of fitting one: a client whose target sits
    // inside it cannot be told apart from one hitting it exactly, and calling
    // that "slow" is chasing noise. It was being computed and thrown away.
    ? rateVerdict(trend.perWeek, profile.weeklyRateTarget, trend.marginPerWeek, trend.current)
    : null
  const hasGoal = profile.goalWeight > 0 && profile.startWeight > 0
  const progress = trend && hasGoal
    ? goalProgress(profile.startWeight, trend.current, profile.goalWeight)
    : 0
  const weeksLeft = trend && hasGoal
    ? weeksToGoal(trend.current, profile.goalWeight, trend.perWeek)
    : null
  const weeksAtTarget = hasGoal && trend
    ? weeksToGoal(trend.current, profile.goalWeight, profile.weeklyRateTarget)
    : null

  const latest = weighIns[weighIns.length - 1]
  const seedWeight = latest?.weight ?? profile.startWeight
  // A brand-new client has no start weight on file, so the first morning they
  // stood on the scale is the only baseline there is.
  const baseline = profile.startWeight > 0 ? profile.startWeight : weighIns[0]?.weight ?? 0
  const readings = series[series.length - 1]?.count ?? 0
  const averaged = readings >= AVG_MIN_READINGS

  // Change in the average against a week ago — the number a coach reads before
  // deciding whether to touch anything.
  const weekAgo = [...series].reverse().find((p) => daysBetween(p.date, today) >= 7)
  const loggedDays = weighInsInLast(weighIns, today, 7)
  const spanDays = weighIns.length > 1 ? daysBetween(weighIns[0]!.date, today) : 0

  const tiles: ComponentProps<typeof StatTile>[] = []
  if (trend && baseline > 0 && weighIns.length > 1) {
    tiles.push({
      label: 'Since start',
      value: signed(trend.current - baseline, 1),
      caption: `from ${num(baseline, 0)} ${profile.units}`,
      icon: trend.current >= baseline ? 'arrow.up' : 'arrow.down',
    })
  }
  if (weekAgo && trend) {
    tiles.push({
      label: 'Last 7 days',
      value: signed(trend.current - weekAgo.avg, 1),
      caption: 'vs a week ago',
      icon: 'chart.line',
    })
  }
  // A consecutive-day streak breaks on the first missed morning and then reads
  // as failure for a fortnight. Days out of seven is the same fact stated as
  // something a client can still fix today — and it is what decides whether the
  // average above means anything.
  tiles.push({
    label: 'Logged',
    value: `${loggedDays}/7`,
    caption: 'days this week',
    icon: 'flame.fill',
    tone: loggedDays >= 6 ? 'var(--orange)' : undefined,
  })

  if (weighIns.length === 0) {
    return (
      <Screen
        title="Weigh-In"
        titleAccessory={
          <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
            <div className="t-subhead dim">{profile.goalLabel || 'Step on the scale daily.'}</div>
          </div>
        }
        right={{ icon: 'plus', onPress: () => setLogging(true), ariaLabel: 'Log weigh-in' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <EmptyState
            icon="scale"
            title="No weigh-ins yet"
            message="Step on the scale first thing, after the bathroom, before food or water. Same conditions every day."
            action={<Button small onPress={() => setLogging(true)}>Log your first weigh-in</Button>}
          />
          {/* Measurements, photos and check-ins don't need a weigh-in first —
              they'd be unreachable if the empty state stood alone. */}
          <TrackMoreSection
            push={push}
            measurements={measurements}
            photos={photos}
            checkIns={checkIns}
            units={profile.units}
          />
        </div>
        <LogSheet
          open={logging}
          onClose={() => setLogging(false)}
          initial={profile.startWeight}
          units={profile.units}
          onSave={(w) => saveWeighIn({ date: today, weight: w })}
        />
      </Screen>
    )
  }

  return (
    <Screen
      title="Weigh-In"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">{profile.goalLabel || 'Step on the scale daily.'}</div>
        </div>
      }
      right={{ icon: 'plus', onPress: () => setLogging(true), ariaLabel: 'Log weigh-in' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* -------------------------------- hero -----------------------------
            The verdict, the number, and one line about the rate. Everything
            slower-moving than that — the start-to-goal bar, how many weeks are
            left — now sits under the chart, where a client goes when they want
            to zoom out rather than every time they open the tab.
            ----------------------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            {/* The verdict is read before the number that produced it, and a
                pill floated into the right margin is read after everything on
                the left. So it gets the first line to itself. */}
            <div style={{ marginBottom: 10 }}>
              {verdict ? (
                <Pill
                  tone={
                    verdict.status === 'on-track' ? 'good'
                    : verdict.status === 'wrong-way' ? 'bad'
                    : 'warn'
                  }
                >
                  {verdict.label}
                </Pill>
              ) : (
                <Pill>Building trend</Pill>
              )}
            </div>

            <div className="eyebrow">{averaged ? '7-day average' : 'Latest weigh-in'}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              {/* Under three mornings there is no average to show, and the
                  rolling one is a two-day mean that agreed with neither the
                  label above it nor the top row of the list below. */}
              <span className="figure" style={{ fontSize: 42 }}>
                {averaged
                  ? trend ? fixed(trend.current, decimals) : '—'
                  : latest ? fixed(latest.weight, decimals) : '—'}
              </span>
              <span className="figure-unit" style={{ fontSize: 20 }}>{profile.units}</span>
            </div>
            {latest && averaged && (
              <div className="t-footnote dim" style={{ marginTop: 4 }}>
                Last scale reading{' '}
                <span className="data">{fixed(latest.weight, decimals)}</span>
                {' · '}{relativeDay(latest.date, today)}
              </div>
            )}
            {latest && !averaged && (
              <div className="t-footnote dim" style={{ marginTop: 4 }}>
                {pluralize(readings, 'morning')} so far · the average starts at{' '}
                <span className="data">{AVG_MIN_READINGS}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {trend?.reliable && (
                <Pill tone="tinted">
                  <span className="data">
                    {signed(trend.perWeek, 2)}
                    <span className="data-unit" style={{ color: 'inherit', opacity: 0.75 }}>
                      {' '}{profile.units}/wk
                    </span>
                  </span>
                </Pill>
              )}
              {/* `signed` drops the sign at zero, and "Target 0/wk" is not a
                  target anyone was ever set. */}
              <Pill>
                {Math.abs(profile.weeklyRateTarget) < 0.05
                  ? 'Target: hold steady'
                  : (
                    <>
                      Target{' '}
                      <span className="data">
                        {signed(profile.weeklyRateTarget, 1)}
                        <span className="data-unit" style={{ color: 'inherit', opacity: 0.75 }}>/wk</span>
                      </span>
                    </>
                  )}
              </Pill>
            </div>

            {/* Why the number above can be trusted, or what is still missing
                before it can be. Never a blank where a rate would go. */}
            <div className="t-footnote dim" style={{ marginTop: 9 }}>
              {trend?.reliable ? (
                <>
                  <span className="data">{trend.entries}</span>
                  {' '}weigh-ins over <span className="data">{trend.sampleDays}</span> days · give or
                  take <span className="data">{num(trend.marginPerWeek, 2)}/wk</span>
                </>
              // `stale` only means the recent window came up short. After a
              // fortnight away that is a gap; on a first morning it is a
              // beginning, and telling someone off for it on day one is the
              // fastest way to lose them.
              ) : trend?.stale && trend.sampleDays > TREND_MIN_DAYS ? (
                'Too long a gap to call a rate. Weigh in daily and it comes back inside a fortnight.'
              ) : (
                <>
                  A rate needs <span className="data">{TREND_MIN_ENTRIES}</span> weigh-ins across{' '}
                  <span className="data">{TREND_MIN_DAYS}</span> days. You&rsquo;re at{' '}
                  <span className="data">{trend?.entries ?? 0}</span> across{' '}
                  <span className="data">{trend?.sampleDays ?? 0}</span>
                  {(trend?.sampleDays ?? 0) === 1 ? ' day.' : ' days.'}
                </>
              )}
            </div>
          </Card>

          {/* The day's outstanding job sits with the number it changes. */}
          {!loggedToday && (
            <div className="gutter">
              <Button icon="plus" onPress={() => setLogging(true)}>
                Log today&rsquo;s weigh-in
              </Button>
            </div>
          )}
        </div>

        {/* ------------------------------- chart -----------------------------
            Two lines and a scatter: what the scale said, what the average of it
            says, and where the plan would have put them by now. Whether the
            blue line is above or below the dashed one is the whole answer.
            ----------------------------------------------------------------- */}
        {visible.length > 1 ? (
          <div>
            {spanDays > 30 && (
              <div className="gutter" style={{ marginBottom: 10 }}>
                <Segmented
                  options={[
                    { value: '30', label: '1 month' },
                    { value: '90', label: '3 months' },
                    { value: 'all', label: 'All' },
                  ]}
                  value={range}
                  onChange={(v) => setRange(v as Range)}
                  label="Chart range"
                />
              </div>
            )}
            <Card>
              <div className="chart-legend" style={{ marginBottom: 4 }}>
                <LegendKey label="Daily" />
                <LegendKey label="7-day average" color="var(--accent)" />
                {pace.length > 1 && <LegendKey label="Target pace" dash />}
              </div>
              <LineChart
                data={visible.map((p) => ({ x: p.date, y: p.weight }))}
                secondary={visible.map((p) => ({ x: p.date, y: p.avg }))}
                reference={pace.map((p) => ({ x: p.date, y: p.weight }))}
                height={190}
                rawAsDots
                color="var(--label-2)"
                secondaryColor="var(--accent)"
                goal={profile.goalWeight > 0 ? { value: profile.goalWeight, label: 'Goal' } : undefined}
                formatValue={(v) => `${fixed(v, decimals)} ${profile.units}`}
                formatLabel={(x) => formatShortDate(x)}
                ariaLabel={
                  `Bodyweight from ${formatMediumDate(visible[0]!.date)} to ${formatMediumDate(visible[visible.length - 1]!.date)}. `
                  + `${averaged ? '7-day average' : 'Latest'} ${fixed(trend?.current ?? 0, decimals)} ${profile.units}`
                  + `${verdict ? `, ${verdict.label.toLowerCase()}` : ''}.`
                }
              />
              {/* What the dashed line is for, said in words. A client reading
                  "3 months" off a chart should not have to hold two lines in
                  their head and subtract. */}
              <div className="t-caption1 dim" style={{ marginTop: 7 }}>
                {paceGap != null ? (
                  <>
                    <span className="data">{fixed(Math.abs(paceGap.by), decimals)} {profile.units}</span>
                    {paceGap.ahead ? ' ahead of' : ' behind'} the target pace. Drag the chart to read
                    any morning.
                  </>
                ) : (
                  'Drag across the chart to read any morning.'
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <div className="t-subhead dim">
              The chart draws itself once there are two mornings to join up. Weigh in again
              tomorrow.
            </div>
          </Card>
        )}

        {/* ------------------------------- goal ------------------------------ */}
        {hasGoal ? (
          <div>
            <SectionHeader title="Toward the goal" />
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span className="eyebrow">Start <span className="data">{num(profile.startWeight, 0)}</span></span>
                <span className="eyebrow">Goal <span className="data">{num(profile.goalWeight, 0)}</span></span>
              </div>
              <div className="track" style={{ height: 8 }}>
                <motion.div
                  className="track-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: 'spring', stiffness: 110, damping: 20 }}
                />
              </div>
              <div className="t-footnote" style={{ marginTop: 8 }}>
                <span className="data">
                  {signed((trend?.current ?? profile.startWeight) - profile.startWeight, 1)}
                  <span className="data-unit"> {profile.units}</span>
                </span>
                <span className="dim">
                  {' '}so far ·{' '}
                  <span className="data">{num(Math.abs(profile.goalWeight - (trend?.current ?? 0)), 1)}</span>
                  {' '}to go
                </span>
              </div>
              {/* An arrival date is a verdict dressed as a number, so it only
                  appears once the rate behind it has earned the right to be
                  quoted — and it says what the plan would have cost instead. */}
              <div className="t-footnote dim" style={{ marginTop: 3 }}>
                {!trend?.reliable ? (
                  'A finish date needs a fortnight of weigh-ins behind it.'
                ) : weeksLeft === 0 ? (
                  'Goal reached.'
                ) : weeksLeft != null ? (
                  <>
                    About <span className="data">{Math.ceil(weeksLeft)}</span> weeks at this rate
                    {weeksAtTarget != null && Math.ceil(weeksAtTarget) !== Math.ceil(weeksLeft) ? (
                      <> — <span className="data">{Math.ceil(weeksAtTarget)}</span> at the target rate.</>
                    ) : '.'}
                  </>
                ) : (
                  'The trend isn’t heading there yet.'
                )}
              </div>
            </Card>
          </div>
        ) : (
          <ListSection
            header="Goal"
            footer="Jud steers by the gap between where you are and where you're going."
            style={{ marginBottom: 0 }}
          >
            <Row
              title="Set a start and goal weight"
              icon="target"
              iconColor="var(--accent)"
              chevron
              onPress={() => push('profileSettings')}
            />
          </ListSection>
        )}

        {/* -------------------------------- stats ----------------------------
            Only the tiles that have a number in them. A change against a start
            weight does not exist on the morning the start weight was set, and a
            change against last week does not exist in the first week — both
            were printing an em dash in a 20px data slot, which reads as a
            figure withheld rather than a figure not yet earned. So the row
            grows: one tile on day one, two by the second morning, three once
            there is a week behind it.
            ----------------------------------------------------------------- */}
        {tiles.length > 1 && (
          <div
            className="gutter"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`,
              gap: 10,
            }}
          >
            {tiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>
        )}

        {/* ------------------------------ more ------------------------------- */}
        <TrackMoreSection
          push={push}
          measurements={measurements}
          photos={photos}
          checkIns={checkIns}
          units={profile.units}
        />

        {/* ----------------------------- history ----------------------------- */}
        <ListSection
          header="Recent entries"
          footer="Tap an entry for its options, or swipe it left to delete."
          style={{ marginBottom: 0 }}
        >
          {[...weighIns]
            .slice(-14)
            .reverse()
            .map((entry, i, arr) => {
              const prev = arr[i + 1]
              const delta = prev ? entry.weight - prev.weight : 0
              const title = relativeDay(entry.date, today)
              return (
                <SwipeRow
                  key={entry.date}
                  id={entry.date}
                  openId={swipe.openId}
                  onOpenChange={swipe.onOpenChange}
                  actions={[
                    {
                      label: 'Delete',
                      icon: 'trash',
                      destructive: true,
                      onPress: () => removeEntry(entry.date),
                    },
                  ]}
                >
                  <Row
                    title={title}
                    // Older rows already read as a date — don't print it twice.
                    subtitle={
                      formatMediumDate(entry.date).endsWith(title)
                        ? undefined
                        : formatMediumDate(entry.date)
                    }
                    onPress={() => setActing(entry.date)}
                    value={
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                        {/* Uncoloured: a day-to-day move is water, and this
                            client is being paid to gain anyway. Green for down
                            and red for up would have had half the list cheering
                            for the wrong direction. */}
                        {prev && (
                          <span className="data" style={{ fontSize: 13, color: 'var(--label-2)' }}>
                            {signed(delta, 1)}
                          </span>
                        )}
                        <span className="data" style={{ fontSize: 17, color: 'var(--label)' }}>
                          {fixed(entry.weight, decimals)}
                          <span className="data-unit"> {profile.units}</span>
                        </span>
                      </span>
                    }
                  />
                </SwipeRow>
              )
            })}
        </ListSection>
      </div>

      <ActionSheet
        open={!!acting}
        onClose={() => setActing(null)}
        title={acting ? relativeDay(acting, today) : undefined}
        message={
          acting
            ? `${fixed(weighIns.find((w) => w.date === acting)?.weight ?? 0, decimals)} ${profile.units} · ${formatMediumDate(acting)}`
            : undefined
        }
        items={[
          {
            label: 'Delete entry',
            destructive: true,
            onPress: () => {
              if (acting) removeEntry(acting)
            },
          },
        ]}
      />

      <LogSheet
        open={logging}
        onClose={() => setLogging(false)}
        initial={seedWeight}
        units={profile.units}
        onSave={(w) => {
          saveWeighIn({ date: today, weight: w })
          toast(`${fixed(w, decimals)} ${profile.units} logged`, { icon: 'scale', tone: 'good' })
        }}
      />

    </Screen>
  )
}

/**
 * The rest of the body-tracking tab — reachable with or without a weigh-in.
 * Each row carries its own latest reading, so the tape and the camera read as
 * parts of the same story rather than three doors off a corridor.
 */
function TrackMoreSection({
  push, measurements, photos, checkIns, units,
}: {
  push: (key: string) => void
  measurements: MeasurementEntry[]
  photos: ProgressPhoto[]
  checkIns: CheckIn[]
  units: Units
}) {
  const tape = measurements[measurements.length - 1]
  const shot = photos.reduce<ProgressPhoto | undefined>(
    (newest, p) => (!newest || p.date > newest.date ? p : newest),
    undefined,
  )
  const note = checkIns[checkIns.length - 1]
  return (
    <ListSection header="Track more" style={{ marginBottom: 0 }}>
      <Row
        title="Body measurements"
        subtitle={
          tape?.waist != null
            ? `Waist ${formatLength(tape.waist, units)} · ${relativeDay(tape.date)}`
            : 'Waist, chest, arms, thighs'
        }
        icon="ruler"
        iconColor="var(--indigo)"
        chevron
        onPress={() => push('measurements')}
      />
      <Row
        title="Progress photos"
        subtitle={
          shot
            ? `${pluralize(photos.length, 'photo')} · latest ${relativeDay(shot.date)}`
            : 'Same light, same pose, same time'
        }
        icon="camera"
        iconColor="var(--pink)"
        chevron
        onPress={() => push('photos')}
      />
      <Row
        title="Weekly check-ins"
        subtitle={
          note
            ? `${pluralize(checkIns.length, 'check-in')} · latest ${relativeDay(note.date)}`
            : 'What Jud reads before adjusting anything'
        }
        icon="note"
        iconColor="var(--green)"
        chevron
        onPress={() => push('checkIns')}
      />
    </ListSection>
  )
}

/** A legend key: a filled dot for a line, a dashed strip for the pace. */
function LegendKey({ label, color, dash }: { label: string; color?: string; dash?: boolean }) {
  return (
    <span className="chart-key">
      {dash ? (
        <span className="chart-key-dash" />
      ) : (
        <span className="chart-key-dot" style={color ? { background: color } : undefined} />
      )}
      <span className="t-caption1 dim">{label}</span>
    </span>
  )
}

function LogSheet({
  open, onClose, initial, units, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: number
  units: string
  onSave: (weight: number) => void
}) {
  return (
    <NumberPad
      open={open}
      onClose={onClose}
      onSubmit={onSave}
      title="Today's weight"
      initial={initial}
      unit={units}
      steps={[-1, -0.2, 0.2, 1]}
      hint="First thing, after the bathroom, before food or water."
      submitLabel="Save"
    />
  )
}
